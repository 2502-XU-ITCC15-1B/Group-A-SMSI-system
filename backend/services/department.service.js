const pool = require('../config/db');
const logService = require('./log.service');

const DEPARTMENT_KEYWORDS = [
  'department', 'support', 'hr', 'it', 'billing', 'finance', 'accounts',
  'operations', 'facilities', 'security', 'compliance', 'customer', 'technical',
  'sales', 'procurement', 'logistics', 'service', 'administration', 'staff'
];

function normalizeName(value) {
  return String(value || '').trim();
}

function looksLikeAcronym(name) {
  return /^[A-Z]{2,5}$/.test(name);
}

function isValidDepartmentName(name) {
  const normalized = normalizeName(name);
  if (!normalized) return false;

  const lower = normalized.toLowerCase();
  if (looksLikeAcronym(normalized)) {
    return ['hr', 'it', 'qa', 'ux', 'ui', 'pr', 'hr'].includes(lower);
  }

  if (DEPARTMENT_KEYWORDS.some((term) => lower.includes(term))) {
    return true;
  }

  return false;
}

async function validateDepartmentName(name) {
  const normalized = normalizeName(name);
  if (!normalized) {
    throw { status: 400, message: 'Department name is required.' };
  }

  if (!isValidDepartmentName(normalized)) {
    throw { status: 400, message: 'Department name must be a valid department (e.g. IT Department, HR, Billing, Technical Support).' };
  }

  return normalized;
}

// -------------------------------------------------------
// Business logic for managing departments (admin-only).
// -------------------------------------------------------

const getAll = async () => {
  const [rows] = await pool.query(
    `SELECT d.*,
            u.name AS manager_name,
            COUNT(t.id) AS ticket_count
     FROM departments d
     LEFT JOIN users u ON u.id = d.manager_id
     LEFT JOIN tickets t ON t.department_id = d.id AND t.is_deleted = 0
     GROUP BY d.id
     ORDER BY d.name ASC`
  );

  return rows;
};

async function validateDepartmentManager(manager_id) {
  if (!manager_id) return;
  const [rows] = await pool.query(
    'SELECT role FROM users WHERE id = ?',
    [manager_id]
  );
  if (rows.length === 0) {
    throw { status: 400, message: 'Selected manager does not exist.' };
  }
  const validRoles = ['admin', 'manager'];
  if (!validRoles.includes(String(rows[0].role || '').toLowerCase())) {
    throw { status: 400, message: 'Department manager must be an Admin or Manager.' };
  }
}

const getById = async (id) => {
  const [rows] = await pool.query(
    'SELECT * FROM departments WHERE id = ?',
    [id]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'Department not found.' };
  }

  return rows[0];
};

const create = async ({ name, manager_id, is_active = 1 }, adminId) => {
  const trimmedName = await validateDepartmentName(name);

  if (manager_id) {
    await validateDepartmentManager(manager_id);
  }

  const [existing] = await pool.query(
    'SELECT id FROM departments WHERE name = ?',
    [trimmedName]
  );
  if (existing.length > 0) {
    throw { status: 400, message: 'Department name already exists.' };
  }

  const [result] = await pool.query(
    `INSERT INTO departments (name, manager_id, is_active)
     VALUES (?, ?, ?)`,
    [trimmedName, manager_id || null, is_active ? 1 : 0]
  );

  await logService.record({
    userId: adminId,
    action: 'DEPARTMENT_CREATED',
    details: `Department "${name}" created.`
  });

  return { id: result.insertId, name };
};

const update = async (id, data, adminId) => {
  const fields = [];
  const values = [];

  ['name', 'manager_id', 'is_active'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      fields.push(`${field} = ?`);
      if (field === 'name') {
        values.push(String(data.name || '').trim());
      } else {
        values.push(data[field] === '' ? null : data[field]);
      }
    }
  });

  if (!fields.length) {
    return { success: true, message: 'No department changes submitted.' };
  }

  if (Object.prototype.hasOwnProperty.call(data, 'manager_id') && data.manager_id) {
    await validateDepartmentManager(data.manager_id);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = await validateDepartmentName(data.name);
    const [existing] = await pool.query(
      'SELECT id FROM departments WHERE name = ? AND id != ?',
      [data.name, id]
    );
    if (existing.length > 0) {
      throw { status: 400, message: 'Department name already exists.' };
    }
  }

  values.push(id);

  const [result] = await pool.query(
    `UPDATE departments SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'Department not found.' };
  }

  await logService.record({
    userId: adminId,
    action: 'DEPARTMENT_UPDATED',
    details: `Department ID ${id} updated.`
  });

  return { success: true, message: 'Department updated.' };
};

const remove = async (id, adminId) => {
  await pool.query(
    'UPDATE departments SET is_active = 0 WHERE id = ?',
    [id]
  );

  await logService.record({
    userId: adminId,
    action: 'DEPARTMENT_DEACTIVATED',
    details: `Department ID ${id} deactivated.`
  });

  return { success: true, message: 'Department deactivated.' };
};

module.exports = { getAll, getById, create, update, remove };
