const express     = require('express');
const router      = express.Router();
const userService = require('../services/user.service');
const { authenticate, authorize } = require('../middleware/auth');

// All user management routes are admin-only
router.use(authenticate, authorize('admin'));

// GET    /api/users
// → list all users (supports filters via query params)
router.get('/', async (req, res) => {
  try {
    const users = await userService.getAll(req.query);
    res.json({ success: true, users });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/users/technicians
// → list technicians (optionally with workload/metrics)
router.get('/technicians', async (req, res) => {
  try {
    const users = await userService.getTechnicians();
    res.json({ success: true, users });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/users/:id
// → get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await userService.getById(req.params.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/users
// Body: { name, email, password, role, company_id?, department_id? }
// → create a new user
router.post('/', async (req, res) => {
  try {
    const user = await userService.create(req.body, req.user.id);
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT    /api/users/:id
// → update user (full update)
router.put('/:id', async (req, res) => {
  try {
    const result = await userService.update(req.params.id, req.body, req.user.id);

    // If admin included a password in the update payload, perform the reset explicitly
    if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
      // delegate to the dedicated reset function to ensure consistent behavior
      const pwResult = await userService.resetPassword(req.params.id, req.body.password, req.user.id);
      // merge messages
      return res.json({ success: true, message: `${result.message} ${pwResult.message}`.trim() });
    }

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH  /api/users/:id/status
// Body: { is_active }
// → activate/deactivate user
router.patch('/:id/status', async (req, res) => {
  try {
    const { is_active } = req.body;

    const result = await userService.setStatus(
      req.params.id,
      is_active,
      req.user.id
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH  /api/users/:id/password
// Body: { password }
// → reset a user's password
router.patch('/:id/password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters.'
      });
    }

    const result = await userService.resetPassword(
      req.params.id,
      password,
      req.user.id
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// DELETE /api/users/:id
// → remove or deactivate user
router.delete('/:id', async (req, res) => {
  try {
    const result = await userService.remove(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;