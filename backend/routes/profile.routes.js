const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    const user = await authService.updateMe(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH /api/profile/password
router.patch('/password', async (req, res) => {
  try {
    const result = await authService.changePassword(
      req.user.id,
      req.body.current_password,
      req.body.new_password
    );

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
