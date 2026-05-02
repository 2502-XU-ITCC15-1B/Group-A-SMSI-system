// -------------------------------------------------------
// Business logic for managing users (admin-only operations).
// -------------------------------------------------------

const bcrypt     = require('bcryptjs');
const pool       = require('../config/db');
const logService = require('./log.service');

const SALT_ROUNDS = 10;

// ── getAll ───────────────────────────────────────────────
const getAll = async (filters = {}) => {
  let query  = `
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           c.name AS company_name
    FROM   users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE  1=1
  `;
  const vals = [];

  if (filters.role) {
    query += ' AND u.role = ?';
    vals.push(filters.role);
  }
  if (filters.company_id) {
    query += ' AND u.company_id = ?';
    vals.push(filters.company_id);
  }

  query += ' ORDER BY u.created_at DESC';
  const [rows] = await pool.query(query, vals);
  return rows;
};

// ── getTechnicians ───────────────────────────────────────
// Convenience query for the ticket assignment dropdown.
const getTechnicians = async () => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email,
            COUNT(t.id) AS active_tickets
     FROM   users u
     LEFT JOIN tickets t ON t.technician_id = u.id
                        AND t.status NOT IN ('Resolved', 'Closed')
     WHERE  u.role = 'technician' AND u.is_active = 1
     GROUP  BY u.id
     ORDER  BY active_tickets ASC`
  );
  return rows;
};

// ── create ───────────────────────────────────────────────
const create = async ({ name, email, password, role, company_id }, adminId) => {
  // Check for duplicate email
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = ?', [email]
  );
  if (existing.length > 0) {
    throw { status: 409, message: 'A user with that email already exists.' };
  }

  // Clients must belong to a company; admins/technicians must not
  if (role === 'client' && !company_id) {
    throw { status: 400, message: 'Client users require a company_id.' };
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, company_id)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, password_hash, role, company_id || null]
  );

  await logService.record({
    userId:  adminId,
    action:  'USER_CREATED',
    details: `User "${email}" (${role}) created.`
  });

  return { id: result.insertId, name, email, role };
};

// ── update ───────────────────────────────────────────────
const update = async (userId, { name, email, role, company_id, is_active }, adminId) => {
  const [result] = await pool.query(
    `UPDATE users
     SET name = COALESCE(?, name),
         email = COALESCE(?, email),
         role  = COALESCE(?, role),
         company_id = COALESCE(?, company_id),
         is_active  = COALESCE(?, is_active)
     WHERE id = ?`,
    [name, email, role, company_id, is_active, userId]
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  await logService.record({
    userId:  adminId,
    action:  'USER_UPDATED',
    details: `User ID ${userId} updated.`
  });

  return { success: true };
};

// ── resetPassword ────────────────────────────────────────
const resetPassword = async (userId, newPassword, adminId) => {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await pool.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [password_hash, userId]
  );

  await logService.record({
    userId:  adminId,
    action:  'USER_UPDATED',
    details: `Password reset for user ID ${userId}.`
  });

  return { success: true };
};

// ── deactivate ───────────────────────────────────────────
// Soft-delete: set is_active = 0 instead of dropping the row.
// This preserves foreign key integrity (ticket history, logs).
const deactivate = async (userId, adminId) => {
  await pool.query(
    'UPDATE users SET is_active = 0 WHERE id = ?',
    [userId]
  );

  await logService.record({
    userId:  adminId,
    action:  'USER_UPDATED',
    details: `User ID ${userId} deactivated.`
  });

  return { success: true };
};

module.exports = { getAll, getTechnicians, create, update, resetPassword, deactivate };