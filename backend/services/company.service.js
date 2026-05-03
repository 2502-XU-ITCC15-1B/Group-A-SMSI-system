const pool = require('../config/db');
const logService = require('./log.service');

// -------------------------------------------------------
// Business logic for managing client companies (admin-only).
// -------------------------------------------------------

const getAll = async () => {
  const [rows] = await pool.query(
    `SELECT c.*,
            COUNT(DISTINCT u.id) AS user_count,
            COUNT(DISTINCT t.id) AS ticket_count
     FROM companies c
     LEFT JOIN users u ON u.company_id = c.id
     LEFT JOIN tickets t ON t.company_id = c.id AND t.is_deleted = 0
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    'SELECT * FROM companies WHERE id = ?',
    [id]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'Company not found.' };
  }

  return rows[0];
};

const create = async ({ name, contact_person, contact_email, is_active = 1 }, adminId = null) => {
  const [result] = await pool.query(
    `INSERT INTO companies (name, contact_person, contact_email, is_active)
     VALUES (?, ?, ?, ?)`,
    [name, contact_person || null, contact_email || null, is_active ? 1 : 0]
  );

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_CREATED',
      details: `Company "${name}" created.`
    });
  }

  return { id: result.insertId, name };
};

const update = async (id, data, adminId = null) => {
  const [result] = await pool.query(
    `UPDATE companies
     SET name = COALESCE(?, name),
         contact_person = COALESCE(?, contact_person),
         contact_email = COALESCE(?, contact_email),
         is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      data.name || null,
      data.contact_person || null,
      data.contact_email || null,
      data.is_active ?? null,
      id
    ]
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'Company not found.' };
  }

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_UPDATED',
      details: `Company ID ${id} updated.`
    });
  }

  return { success: true, message: 'Company updated.' };
};

const remove = async (id, adminId = null) => {
  await pool.query(
    'UPDATE companies SET is_active = 0 WHERE id = ?',
    [id]
  );

  if (adminId) {
    await logService.record({
      userId: adminId,
      action: 'COMPANY_DEACTIVATED',
      details: `Company ID ${id} deactivated.`
    });
  }

  return { success: true, message: 'Company deactivated.' };
};

module.exports = { getAll, getById, create, update, remove };
