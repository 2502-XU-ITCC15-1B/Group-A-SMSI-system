const express5   = require('express');
const router5    = express5.Router();
const logService = require('../services/log.service');
const { authenticate: auth5, authorize: authz5 } = require('../middleware/auth');

// GET /api/logs   → admin: full log | technician: own activity only
router5.get('/', auth5, authz5('admin', 'technician'), async (req, res) => {
  try {
    const filters = {};
    if (req.user.role === 'technician') filters.userId = req.user.id;
    if (req.query.ticket_id) filters.ticketId = req.query.ticket_id;
    if (req.query.limit)     filters.limit     = parseInt(req.query.limit, 10);

    const logs = await logService.getAll(filters);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/logs/ticket/:ticketId → admin | technician
router5.get('/ticket/:ticketId', auth5, authz5('admin', 'technician'), async (req, res) => {
  try {
    const logs = await logService.getAll({ ticketId: req.params.ticketId });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router5;