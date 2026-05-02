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

const JWT_SECRET = process.env.JWT_SECRET || 'woman_dev_secret_change_in_prod';

// ── 1. authenticate ──────────────────────────────────────
// Reads the Bearer token from the Authorization header,
// verifies its signature, and stores the decoded payload
// on req.user for downstream handlers.
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;   // { id, name, email, role, company_id }
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