// -------------------------------------------------------
// Business logic for authentication.
// All DB queries and password checks live here — the route
// handler stays thin and only deals with HTTP concerns.
// -------------------------------------------------------

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../config/db');
const logService = require('./log.service');

const JWT_SECRET  = process.env.JWT_SECRET  || 'woman_dev_secret_change_in_prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';   // token lifetime

// ── login ────────────────────────────────────────────────
// Verifies credentials and returns a signed JWT + user info.
const login = async (email, password) => {
  // 1. Look up the user by email
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
    [email]
  );

  if (rows.length === 0) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  const user = rows[0];

  // 2. Compare submitted password with the stored bcrypt hash
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  // 3. Build the JWT payload (never include password_hash here)
  const payload = {
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    company_id: user.company_id
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  // 4. Record the login event in the audit log
  await logService.record({
    userId:  user.id,
    action:  'LOGIN',
    details: `User "${user.email}" logged in.`
  });

  return { token, user: payload };
};

// ── getMe ────────────────────────────────────────────────
// Returns fresh user data from DB for the /auth/me endpoint.
const getMe = async (userId) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.company_id, u.created_at,
            c.name AS company_name
     FROM   users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE  u.id = ? AND u.is_active = 1`,
    [userId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  return rows[0];
};

module.exports = { login, getMe };