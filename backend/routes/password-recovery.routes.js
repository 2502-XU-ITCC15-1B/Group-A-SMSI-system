const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const logService = require('../services/log.service');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/password-recovery
// Body: { email }
// → Log a password recovery request (public, no auth required)
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.'
      });
    }

    // Log the recovery request
    await pool.query(
      `INSERT INTO password_recovery_requests (email, status, created_at)
       VALUES (?, ?, NOW())`,
      [String(email).trim().toLowerCase(), 'pending']
    );

    res.json({
      success: true,
      message: 'Password recovery request submitted.'
    });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET /api/admin/password-recovery-requests
// → List all pending password recovery requests (admin-only)
router.get('/admin/password-recovery-requests', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT id, email, status, created_at
       FROM password_recovery_requests
       WHERE status = 'pending'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json({
      success: true,
      requests: requests || []
    });
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, requests: [] });
    }

    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH /api/admin/password-recovery-requests/:id/resolve
// → Mark a recovery request as resolved (admin-only)
router.patch('/admin/password-recovery-requests/:id/resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `UPDATE password_recovery_requests
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recovery request not found.'
      });
    }

    // Log activity
    await logService.record({
      userId: req.user.id,
      action: 'PASSWORD_RECOVERY_RESOLVED',
      details: `Password recovery request ID ${id} marked as resolved.`
    });

    res.json({
      success: true,
      message: 'Recovery request resolved.'
    });
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(404).json({
        success: false,
        message: 'Recovery request not found.'
      });
    }

    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
