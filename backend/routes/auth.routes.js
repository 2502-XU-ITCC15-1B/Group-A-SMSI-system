const express    = require('express');
const router     = express.Router();
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login
// Body: { email, password }
// Returns: { success, token, user }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const result = await authService.login(email, password);
    res.json({ success: true, ...result });

  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Server error.' });
  }
});

// GET /api/auth/me   (requires valid JWT)
// Returns the currently logged-in user's profile.
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;











