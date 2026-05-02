// -------------------------------------------------------
// Business logic for managing client companies (admin-only).
// -------------------------------------------------------

const pool = require('../config/db');

const getAll = async () => {
  const [rows] = await pool.query(
    `SELECT c.*,
            COUNT(u.id) AS user_count,
            COUNT(t.id) AS ticket_count
     FROM   companies c
     LEFT JOIN users    u ON u.company_id = c.id AND u.is_active = 1
     LEFT JOIN tickets  t ON t.company_id = c.id
     GROUP  BY c.id
     ORDER  BY c.name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    'SELECT * FROM companies WHERE id = ?', [id]
  );
  if (rows.length === 0) throw { status: 404, message: 'Company not found.' };
  return rows[0];
};

const create = async ({ name, contact_person, contact_email }) => {
  const [result] = await pool.query(
    'INSERT INTO companies (name, contact_person, contact_email) VALUES (?, ?, ?)',
    [name, contact_person, contact_email]
  );
  return { id: result.insertId, name };
};

const update = async (id, { name, contact_person, contact_email, is_active }) => {
  const [result] = await pool.query(
    `UPDATE companies
     SET name           = COALESCE(?, name),
         contact_person = COALESCE(?, contact_person),
         contact_email  = COALESCE(?, contact_email),
         is_active      = COALESCE(?, is_active)
     WHERE id = ?`,
    [name, contact_person, contact_email, is_active, id]
  );
  if (result.affectedRows === 0) throw { status: 404, message: 'Company not found.' };
  return { success: true };
};

module.exports = { getAll, getById, create, update };