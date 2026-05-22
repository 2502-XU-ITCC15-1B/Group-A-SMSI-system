const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const logService = require('../services/log.service');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/password-recovery
// Body: { email }
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required.'
      });
    }

    await pool.query(
      `INSERT INTO password_recovery_requests (email, status, created_at)
       VALUES ($1, $2, NOW())`,
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
router.get('/admin/password-recovery-requests', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, status, created_at
       FROM password_recovery_requests
       WHERE status = 'pending'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    const requests = (result && result.rows) ? result.rows : [];
    res.json({ success: true, requests });
  } catch (err) {
    // Handle missing table for both PostgreSQL and MySQL
    if (err && (err.code === '42P01' || err.code === 'ER_NO_SUCH_TABLE')) {
      return res.json({ success: true, requests: [] });
    }

    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/password-recovery-requests/:id/resolve
router.patch('/admin/password-recovery-requests/:id/resolve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE password_recovery_requests
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1`,
      [id]
    );

    if (!result || result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Recovery request not found.' });
    }

    await logService.record({
      userId: req.user.id,
      action: 'PASSWORD_RECOVERY_RESOLVED',
      details: `Password recovery request ID ${id} marked as resolved.`
    });

    res.json({ success: true, message: 'Recovery request resolved.' });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
