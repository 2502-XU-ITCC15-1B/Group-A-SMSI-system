const express    = require('express');
const router     = express.Router();
const logService = require('../services/log.service');
const { authenticate, authorize } = require('../middleware/auth');

// GET    /api/logs
// Roles: admin, head, technician
// → STRICT: users only see logs for tickets they have access to
// Admin: all logs | Head: department logs | Technician: assigned tickets logs
// Query: ?ticket_id= & ?limit=
router.get('/', authenticate, authorize('admin', 'head', 'technician'), async (req, res) => {
  try {
    const filters = {
      limit: req.query.limit ? Number(req.query.limit) : 100,
      ticketId: req.query.ticket_id || null,
      userRole: req.user.role,
      userId: req.user.id,
      departmentId: req.user.department_id
    };

    const logs = await logService.getAll(filters);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/logs/ticket/:ticketId
// Roles: admin, head, technician
// → get logs for a specific ticket
router.get('/ticket/:ticketId', authenticate, authorize('admin', 'head', 'technician'), async (req, res) => {
  try {
    const logs = await logService.getAll({
      ticketId: req.params.ticketId,
      limit: 500
    });

    res.json({ success: true, logs });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;