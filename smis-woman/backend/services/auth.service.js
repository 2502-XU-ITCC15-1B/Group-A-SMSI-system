// -------------------------------------------------------
// Business logic for authentication.
// All DB queries, token handling, and password operations
// live here — routes stay thin and handle only HTTP.
// -------------------------------------------------------

const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const pool       = require('../config/db');
const logService = require('./log.service');
const mailService = require('./mail.service');

const JWT_SECRET  = process.env.JWT_SECRET  || 'woman_dev_secret_change_in_prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';   // token lifetime
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

// ── login ────────────────────────────────────────────────
// Verifies credentials and returns a signed JWT + user info.
const login = async (email, password) => {
  // 1. Look up the user by email
  const [rows] = await pool.query(
    `SELECT id, name, email, role, company_id, department_id, password_hash, is_active
     FROM users
     WHERE email = $1 AND is_active = 1
     LIMIT 1`,
    [email]
  );

  if (rows.length === 0) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  const user = rows[0];

  // 2. Compare submitted password with stored hash
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  // 3. Build JWT payload (exclude sensitive fields)
  const payload = {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    company_id: user.company_id,
    department_id: user.department_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  // 4. Record login activity
  await logService.record({
    userId:  user.id,
    action:  'LOGIN',
    details: `User "${user.email}" logged in.`
  });

  return { token, user: payload };
};

// ── getMe ────────────────────────────────────────────────
// Returns fresh user data for the authenticated user.
const getMe = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.company_id, u.department_id, u.profile_picture, u.created_at, u.is_active,
            c.name AS company_name,
            d.name AS department_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  return rows[0];
};

// Updates the authenticated user's basic profile fields.
const updateMe = async (userId, data) => {
  const name = (data.name || '').trim();
  const email = (data.email || '').trim();

  if (!name || !email) {
    throw { status: 400, message: 'Name and email are required.' };
  }

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
    [email, userId]
  );

  if (existing.length > 0) {
    throw { status: 409, message: 'A user with that email already exists.' };
  }

  const [result] = await pool.query(
    `UPDATE users
     SET name = $1, email = $2
     WHERE id = $3`,
    [name, email, userId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  await logService.record({
    userId,
    action: 'PROFILE_UPDATED',
    details: 'User updated their profile.'
  });

  return getMe(userId);
};

// Changes the authenticated user's password.
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw { status: 400, message: 'Current and new passwords are required.' };
  }

  if (newPassword.length < 8) {
    throw { status: 400, message: 'New password must be at least 8 characters.' };
  }

  const [rows] = await pool.query(
    'SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  const user = rows[0];
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValid) {
    throw { status: 401, message: 'Current password is incorrect.' };
  }

  const password_hash = await bcrypt.hash(newPassword, 10);

  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [password_hash, userId]
  );

  await logService.record({
    userId,
    action: 'PASSWORD_CHANGED',
    details: 'User changed their password.'
  });

  return { message: 'Password updated successfully.' };
};

// ── requestPasswordReset ─────────────────────────────────
// Generates a reset token and stores it with expiration.
const register = async ({ name, email, password, company_id = null, department_id = null }) => {
  const normalizedName = (name || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPassword = password || '';

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    throw { status: 400, message: 'Name, email, and password are required.' };
  }

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = $1 LIMIT 1',
    [normalizedEmail]
  );

  if (existing.length > 0) {
    throw { status: 409, message: 'A user with that email already exists.' };
  }

  const password_hash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);

  const [result] = await pool.query(
    `INSERT INTO users
       (name, email, password_hash, role, company_id, department_id, is_active)
     VALUES ($1, $2, $3, 'client', $4, $5, 1)
     RETURNING id, name, email, role, company_id, department_id`,
    [normalizedName, normalizedEmail, password_hash, company_id || null, department_id || null]
  );

  const user = result[0];
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    company_id: user.company_id,
    department_id: user.department_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  await logService.record({
    userId: user.id,
    action: 'USER_REGISTERED',
    details: `New account created for ${user.email}`
  });

  return { token, user: payload };
};

const requestPasswordReset = async (email) => {
  if (!email || !String(email).includes('@')) {
    throw { status: 400, message: 'A valid email address is required.' };
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const [rows] = await pool.query(
    'SELECT id, name, email FROM users WHERE email = $1 AND is_active = 1 LIMIT 1',
    [normalizedEmail]
  );

  if (rows.length === 0) {
    throw { status: 400, message: 'Email does not exist' };
  }

  const user = rows[0];

  // Generate secure token + expiration (30 minutes)
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, token, expiresAt]
  );

  const resetUrl = `${FRONTEND_URL.replace(/\/$/, '')}/reset-confirmation.html?token=${token}`;

  await mailService.sendMail({
    to: user.email,
    subject: 'SMSi Password Reset Instructions',
    text: `Hello ${user.name},\n\nWe received a request to reset your SMSi password. Please open the link below and set a new password:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\nThank you.`,
    html: `<p>Hello ${user.name},</p><p>We received a request to reset your SMSi password. Please click the link below and set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p><p>Thank you.</p>`
  });

  // Log request
  await logService.record({
    userId:  user.id,
    action:  'PASSWORD_RESET_REQUESTED',
    details: `Password reset requested for "${email}".`
  });

  return {
    message: 'Password reset instructions have been emailed if the account exists.'
  };
};

// ── resetPassword ────────────────────────────────────────
// Validates reset token and updates the user's password.
const resetPassword = async (token, newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw { status: 400, message: 'New password must be at least 8 characters.' };
  }

  // 1. Validate token
  const [rows] = await pool.query(
    `SELECT pr.user_id, pr.expires_at
     FROM password_resets pr
     WHERE pr.token = $1 AND pr.used_at IS NULL
     LIMIT 1`,
    [token]
  );

  if (rows.length === 0) {
    throw { status: 400, message: 'Invalid or expired reset token.' };
  }

  // 2. Check expiration
  if (new Date(rows[0].expires_at).getTime() < Date.now()) {
    throw { status: 400, message: 'Reset token expired.' };
  }

  // 3. Hash new password
  const password_hash = await bcrypt.hash(newPassword, 10);

  // 4. Update password
  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [password_hash, rows[0].user_id]
  );

  // 5. Mark token as used
  await pool.query(
    'UPDATE password_resets SET used_at = NOW() WHERE token = $1',
    [token]
  );

  // 6. Log completion
  await logService.record({
    userId:  rows[0].user_id,
    action:  'PASSWORD_RESET_COMPLETED',
    details: 'Password reset completed.'
  });

  return { message: 'Password updated successfully.' };
};

module.exports = {
  login,
  register,
  getMe,
  updateMe,
  changePassword,
  requestPasswordReset,
  resetPassword
};
