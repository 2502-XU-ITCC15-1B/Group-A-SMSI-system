const express      = require('express');
const multer       = require('multer');
const path         = require('path');
const router       = express.Router();
const pool         = require('../config/db');
const ticketService = require('../services/ticket.service');
const { authenticate, authorize } = require('../middleware/auth');

const attachmentStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'ticket_responses'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf/;
    const extAllowed = allowed.test(path.extname(file.originalname).toLowerCase());
    const typeAllowed = allowed.test(file.mimetype);
    cb(extAllowed && typeAllowed ? null : new Error('Only JPG, PNG, GIF, and PDF files are allowed.'));
  }
});

// GET    /api/tickets
// → admin: all | technician: assigned | client: own company
router.get('/', authenticate, async (req, res) => {
  try {
    const tickets = await ticketService.getAll(req.user, req.query);
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/tickets/mine
// Roles: technician
// → get tickets assigned to current technician
router.get('/mine', authenticate, authorize('technician'), async (req, res) => {
  try {
    const tickets = await ticketService.getMine(req.user);
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/tickets/:id
// → admin | technician (if assigned) | client (own company)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await ticketService.getById(req.params.id, req.user);
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// GET    /api/tickets/:id/responses
// → get responses for a ticket (access-controlled via service)
router.get('/:id/responses', authenticate, async (req, res) => {
  try {
    const responses = await ticketService.getResponses(req.params.id, req.user);
    res.json({ success: true, responses });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/tickets
// Roles: admin, client
// Body: { title, description, priority, company_id? }
// → create ticket
router.post('/', authenticate, authorize('admin', 'client'), async (req, res) => {
  try {
    const body = req.user.role === 'client'
      ? { ...req.body, company_id: req.user.company_id, requestor_id: req.user.id }
      : { ...req.body, requestor_id: req.user.id };

    const ticket = await ticketService.create(body, req.user);
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT    /api/tickets/:id
// Roles: admin, head, technician
// → update ticket
router.put('/:id', authenticate, authorize('admin', 'head', 'technician'), async (req, res) => {
  try {
    const result = await ticketService.update(req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH  /api/tickets/:id/status
// Roles: admin, head, technician
// Body: { status }
// → update ticket status
router.patch('/:id/status', authenticate, authorize('admin', 'head', 'technician'), async (req, res) => {
  try {
    const { status } = req.body;

    const result = await ticketService.updateStatus(
      req.params.id,
      status,
      req.user
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH  /api/tickets/:id/assign
// Roles: admin, head
// → assign technician to ticket
router.patch('/:id/assign', authenticate, authorize('admin', 'head'), async (req, res) => {
  try {
    const result = await ticketService.assign(
      req.params.id,
      req.body,
      req.user
    );

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// PATCH  /api/tickets/:id/close
// Roles: admin, head
// → close ticket
router.patch('/:id/close', authenticate, authorize('admin', 'head'), async (req, res) => {
  try {
    const result = await ticketService.close(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/tickets/:id/responses
// Roles: admin, head, technician, client
// Body: multipart/form-data { message, internal_note?, attachment }
// → add response to ticket
router.post('/:id/responses', authenticate, authorize('admin', 'head', 'technician', 'client'), attachmentUpload.single('attachment'), async (req, res) => {
  try {
    const internalNote = req.user.role === 'client'
      ? false
      : ['1', 'true', 'on'].includes(String(req.body.internal_note || '').toLowerCase());

    const payload = {
      message: req.body.message,
      internal_note: internalNote,
      attachment_url: req.file ? `/uploads/ticket_responses/${req.file.filename}` : null
    };

    const result = await ticketService.addResponse(req.params.id, payload, req.user);

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/tickets/:id/feedback
// Roles: client
// Body: { rating, feedback }
// → submit ticket feedback
router.post('/:id/feedback', authenticate, authorize('client'), async (req, res) => {
  try {
    const result = await ticketService.addFeedback(
      req.params.id,
      req.body,
      req.user
    );

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// DELETE /api/tickets/:id
// Roles: admin
// → remove ticket (soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await ticketService.remove(req.params.id, req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// --- BAG-ONG ADDITION PARA SA ADMIN ASSIGNMENT ---
// POST /api/tickets/:id/assign-dept
router.post('/:id/assign-dept', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { department_id } = req.body;
    const ticketId = req.params.id;

    // Query the department's manager
    const [dept] = await pool.query('SELECT manager_id FROM departments WHERE id = $1', [department_id]);
    if (dept.length === 0) {
      throw { status: 400, message: 'Department not found.' };
    }
    const technician_id = dept[0].manager_id;
    if (!technician_id) {
      throw { status: 400, message: 'Department has no manager assigned.' };
    }

    // Assign to department and department head
    const result = await ticketService.assign(ticketId, { department_id, technician_id }, req.user);

    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});
// ------------------------------------------------

module.exports = router;
