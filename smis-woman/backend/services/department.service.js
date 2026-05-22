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
  if (looksLikeAcronym(normalized) && ['hr', 'it', 'qa', 'ux', 'ui', 'pr'].includes(lower)) {
    return true;
  }

  return DEPARTMENT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function validateDepartmentName(name) {
  const trimmedName = normalizeName(name);
  if (!trimmedName) {
    throw { status: 400, message: 'Department name is required.' };
  }

  if (!isValidDepartmentName(trimmedName)) {
    throw { status: 400, message: 'Department name must be a valid department, such as IT Support, HR, Billing, or Technical Support.' };
  }

  return trimmedName;
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
    'SELECT role FROM users WHERE id = $1',
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
    'SELECT * FROM departments WHERE id = $1',
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

  const [result] = await pool.query(
    `INSERT INTO departments (name, manager_id, is_active)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [trimmedName, manager_id || null, is_active ? 1 : 0]
  );

  await logService.record({
    userId: adminId,
    action: 'DEPARTMENT_CREATED',
    details: `Department "${name}" created.`
  });

  return { id: result.id, name };
};

const update = async (id, data, adminId) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    data.name = await validateDepartmentName(data.name);
  }

  if (Object.prototype.hasOwnProperty.call(data, 'manager_id') && data.manager_id) {
    await validateDepartmentManager(data.manager_id);
  }

  ['name', 'manager_id', 'is_active'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      fields.push(`${field} = $${paramIndex++}`);
      values.push(data[field] === '' ? null : data[field]);
    }
  });

  if (!fields.length) {
    return { success: true, message: 'No department changes submitted.' };
  }

  values.push(id);

  const [result] = await pool.query(
    `UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if (result.rowCount === 0) {
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
    'UPDATE departments SET is_active = 0 WHERE id = $1',
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
