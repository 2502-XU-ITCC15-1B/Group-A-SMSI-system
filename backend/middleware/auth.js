// backend/middleware/auth.js
// -------------------------------------------------------
// Two middleware factories:
//   authenticate  → verifies the JWT and attaches req.user
//   authorize     → guards a route to specific roles
//
// Usage:
//   router.get('/admin-only',
//     authenticate,
//     authorize('admin'),
//     handler
//   );
//
//   router.get('/shared',
//     authenticate,
//     authorize('admin', 'technician'),
//     handler
//   );
// -------------------------------------------------------

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'woman_dev_secret_change_in_prod';

// ── 1. authenticate ──────────────────────────────────────
// Reads the Bearer token from the Authorization header,
// verifies its signature, and stores the decoded payload
// on req.user for downstream handlers.
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Refresh user status from DB on every request to enforce immediate account disable
    const [rows] = await pool.query(
      `SELECT id, name, email, role, company_id, department_id, is_active
       FROM users WHERE id = ? LIMIT 1`,
      [decoded.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      // Immediate kick-out for disabled accounts
      return res.status(403).json({ success: false, message: 'Account disabled. Please contact administrator.' });
    }

    // Attach DB-backed user object (avoid exposing password_hash)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company_id: user.company_id,
      department_id: user.department_id
    };

    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid token.';
    return res.status(401).json({ success: false, message });
  }
};

// ── 2. authorize ─────────────────────────────────────────
// Call after authenticate. Accepts one or more allowed roles.
// Returns 403 if the authenticated user's role is not listed.
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${allowedRoles.join(', ')}.`
    });
  }

  next();
};

module.exports = { authenticate, authorize };