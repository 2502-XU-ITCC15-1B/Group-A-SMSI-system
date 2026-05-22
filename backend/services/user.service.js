// -------------------------------------------------------
// Business logic for managing users (admin-only operations).
// All DB queries and business rules live here.
// Routes remain thin and only handle HTTP requests.
// -------------------------------------------------------

const bcrypt     = require('bcryptjs');
const pool       = require('../config/db');
const logService = require('./log.service');

const SALT_ROUNDS = 10;

function isStrongPassword(pw) {
  if (!pw || typeof pw !== 'string') return false;
  // Minimum 8 characters, at least one uppercase letter, one number, and one special character
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(pw);
}

const VALID_USER_ROLES = ['admin', 'head', 'technician', 'client'];
const normalizeRoleFilter = (role) => {
  const candidate = String(role || '').trim().toLowerCase();
  if (!candidate) return null;
  if (candidate === 'manager') return 'admin';
  return VALID_USER_ROLES.includes(candidate) ? candidate : null;
};

// ── getAll ───────────────────────────────────────────────
// Returns list of users with optional filters (role, company)
const getAll = async (filters = {}) => {
  let query = `
    SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
           u.company_id, u.department_id,
           c.name AS company_name,
           d.name AS department_name
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE 1=1
  `;

  const vals = [];

  if (filters.role) {
    const roleFilter = normalizeRoleFilter(filters.role);
    if (!roleFilter) {
      throw { status: 400, message: 'Invalid role filter provided.' };
    }
    query += ' AND LOWER(u.role) = ?';
    vals.push(roleFilter);
  }

  if (filters.company_id) {
    query += ' AND u.company_id = ?';
    vals.push(filters.company_id);
  }

  if (filters.department_id) {
    query += ' AND u.department_id = ?';
    vals.push(filters.department_id);
  }

  if (filters.search) {
    query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
    vals.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  query += ' ORDER BY u.created_at DESC';

  const [rows] = await pool.query(query, vals);
  return rows;
};

// ── getById ──────────────────────────────────────────────
// Returns a single user by ID
const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            u.company_id, u.department_id,
            c.name AS company_name,
            d.name AS department_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  return rows[0];
};

// ── getTechnicians ───────────────────────────────────────
// Returns technicians with active ticket count
const getTechnicians = async () => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.department_id,
            d.name AS department_name,
            COUNT(t.id) AS active_tickets
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     LEFT JOIN tickets t
       ON t.technician_id = u.id
      AND t.status NOT IN ('Resolved', 'Closed')
     WHERE u.role = 'technician' AND u.is_active = 1
     GROUP BY u.id, d.name
     ORDER BY active_tickets ASC, u.name ASC`
  );

  return rows;
};

// ── getManagers ───────────────────────────────────────────
// Returns active administrator/manager users for department assignment
const getManagers = async () => {
  const [rows] = await pool.query(
    `SELECT id, name
     FROM users
     WHERE LOWER(role) IN ('admin', 'manager')
       AND is_active = 1
     ORDER BY name ASC`
  );

  return rows;
};

// ── create ───────────────────────────────────────────────
// Creates a new user (admin action)
const create = async ({ name, email, password, role, company_id, department_id }, adminId) => {
  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existing.length > 0) {
    throw { status: 409, message: 'A user with that email already exists.' };
  }

  if (role === 'client' && !company_id) {
    throw { status: 400, message: 'Client users require company_id.' };
  }

  if (!isStrongPassword(password)) {
    throw { status: 400, message: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.' };
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, company_id, department_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, email, password_hash, role, company_id || null, department_id || null]
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw { status: 409, message: 'A user with that email already exists.' };
    }
    throw err;
  }

  await logService.record({
    userId: adminId,
    action: 'USER_CREATED',
    details: `User "${email}" created.`
  });

  return {
    id: result.insertId,
    name,
    email,
    role,
    company_id: company_id || null,
    department_id: department_id || null
  };
};

// ── update ───────────────────────────────────────────────
// Updates user details
const update = async (id, data, adminId) => {
  const fields = [];
  const values = [];

  ['name', 'email', 'role', 'company_id', 'department_id'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      fields.push(`${field} = ?`);
      values.push(data[field] === '' ? null : data[field]);
    }
  });

  const hasPassword = Object.prototype.hasOwnProperty.call(data, 'password');

  if (!fields.length) {
    return { success: true, message: 'No user changes submitted.' };
  }

  values.push(id);

  let result;
  try {
    [result] = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw { status: 409, message: 'A user with that email already exists.' };
    }
    throw err;
  }

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  await logService.record({
    userId: adminId,
    action: 'USER_UPDATED',
    details: `User ID ${id} updated.`
  });

  // If password was provided in payload, perform the reset after the update
  if (hasPassword) {
    await resetPassword(id, String(data.password), adminId);
  }

  return { success: true, message: 'User updated.' };
};

// ── setStatus ────────────────────────────────────────────
// Activates or deactivates a user
const setStatus = async (id, isActive, adminId) => {
  await pool.query(
    'UPDATE users SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, id]
  );

  await logService.record({
    userId: adminId,
    action: 'USER_STATUS_CHANGED',
    details: `User ID ${id} status changed to ${isActive ? 'active' : 'inactive'}.`
  });

  return { success: true, message: 'User status updated.' };
};

// ── resetPassword ────────────────────────────────────────
// Admin resets a user's password
const resetPassword = async (id, password, adminId) => {
  if (!isStrongPassword(password)) {
    throw { status: 400, message: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.' };
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  await pool.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [password_hash, id]
  );

  await logService.record({
    userId: adminId,
    action: 'USER_PASSWORD_RESET',
    details: `Password reset for user ID ${id}.`
  });

  return { success: true, message: 'Password updated.' };
};

// ── remove ───────────────────────────────────────────────
// Soft delete (deactivate user instead of deleting)
const remove = async (id, adminId) => {
  await pool.query(
    'UPDATE users SET is_active = 0 WHERE id = ?',
    [id]
  );

  await logService.record({
    userId: adminId,
    action: 'USER_DEACTIVATED',
    details: `User ID ${id} deactivated.`
  });

  return { success: true, message: 'User deactivated.' };
};

module.exports = {
  getAll,
  getById,
  getTechnicians,
  getManagers,
  create,
  update,
  setStatus,
  resetPassword,
  remove
};
