const express2        = require('express');
const router2         = express2.Router();
const ticketService   = require('../services/ticket.service');
const { authenticate: auth2, authorize } = require('../middleware/auth');

// GET  /api/tickets          → admin: all | tech: assigned | client: own company
router2.get('/', auth2, async (req, res) => {
  try {
    const tickets = await ticketService.getAll(req.user, req.query);
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET  /api/tickets/:id      → admin | tech (if assigned) | client (if own company)
router2.get('/:id', auth2, async (req, res) => {
  try {
    const ticket = await ticketService.getById(req.params.id, req.user);
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/tickets          → admin | client
// Body: { title, description, priority, company_id }
router2.post('/', auth2, authorize('admin', 'client'), async (req, res) => {
  try {
    // Clients always submit under their own company
    const body = req.user.role === 'client'
      ? { ...req.body, company_id: req.user.company_id }
      : req.body;

    if (!body.title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    const result = await ticketService.create(body, req.user.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/tickets/:id/status  → admin | technician
// Body: { status }
router2.patch('/:id/status', auth2, authorize('admin', 'technician'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    const result = await ticketService.updateStatus(req.params.id, status, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// PATCH /api/tickets/:id/assign  → admin only
// Body: { technician_id }
router2.patch('/:id/assign', auth2, authorize('admin'), async (req, res) => {
  try {
    const { technician_id } = req.body;
    if (!technician_id) {
      return res.status(400).json({ success: false, message: 'technician_id is required.' });
    }
    const result = await ticketService.assign(req.params.id, technician_id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// POST /api/tickets/:id/responses  → admin | technician
// Body: { message }
router2.post('/:id/responses', auth2, authorize('admin', 'technician'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    const result = await ticketService.addResponse(req.params.id, message, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// GET  /api/tickets/:id/responses  → admin | technician | client (own company)
router2.get('/:id/responses', auth2, async (req, res) => {
  try {
    // Verify access to the parent ticket first
    await ticketService.getById(req.params.id, req.user);
    const responses = await ticketService.getResponses(req.params.id);
    res.json({ success: true, responses });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = { authRouter: router, ticketRouter: router2 };