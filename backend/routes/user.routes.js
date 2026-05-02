const express3    = require('express');
const router3     = express3.Router();
const userService = require('../services/user.service');
const { authenticate: auth3, authorize: authz3 } = require('../middleware/auth');

// All user management routes are admin-only
router3.use(auth3, authz3('admin'));

// GET    /api/users                  → list all users (filter by ?role= or ?company_id=)
router3.get('/', async (req, res) => {
  try {
    const users = await userService.getAll(req.query);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET    /api/users/technicians      → list technicians with active ticket count
router3.get('/technicians', async (req, res) => {
  try {
    const technicians = await userService.getTechnicians();
    res.json({ success: true, technicians });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST   /api/users                  → create a new user
// Body: { name, email, password, role, company_id? }
router3.post('/', async (req, res) => {
  try {
    const user = await userService.create(req.body, req.user.id);
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH  /api/users/:id              → update user fields
router3.patch('/:id', async (req, res) => {
  try {
    const result = await userService.update(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH  /api/users/:id/password     → reset a user's password
router3.patch('/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    const result = await userService.resetPassword(req.params.id, password, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id              → soft-deactivate user
router3.delete('/:id', async (req, res) => {
  try {
    const result = await userService.deactivate(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router3;