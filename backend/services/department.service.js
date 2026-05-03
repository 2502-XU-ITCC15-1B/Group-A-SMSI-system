const pool = require('../config/db');
const logService = require('./log.service');

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
     LEFT JOIN tickets t ON t.department_id = d.id
     GROUP BY d.id
     ORDER BY d.name ASC`
  );

  return rows;
};

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
  const [result] = await pool.query(
    `INSERT INTO departments (name, manager_id, is_active)
     VALUES (?, ?, ?)`,
    [name, manager_id || null, is_active ? 1 : 0]
  );

  await logService.record({
    userId: adminId,
    action: 'DEPARTMENT_CREATED',
    details: `Department "${name}" created.`
  });

  return { id: result.insertId, name };
};

const update = async (id, data, adminId) => {
  const [result] = await pool.query(
    `UPDATE departments
     SET name = COALESCE(?, name),
         manager_id = COALESCE(?, manager_id),
         is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [data.name || null, data.manager_id ?? null, data.is_active ?? null, id]
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