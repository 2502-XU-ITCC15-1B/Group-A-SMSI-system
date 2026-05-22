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
    const extAllowed = /\.(jpe?g|png|gif|pdf|doc|docx|txt|xls|xlsx|bmp|webp|svg)$/i.test(path.extname(file.originalname));
    const typeAllowed = /(image\/.*|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|text\/plain)/i.test(file.mimetype);
    cb(extAllowed && typeAllowed ? null : new Error('Only JPG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX, TXT, BMP, WEBP, and SVG files are allowed.'));
  }
});

const getAttachmentType = (originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext) ? 'image' : 'document';
};

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
// Roles: technician, client
// → get tickets assigned to current technician or created by current client
router.get('/mine', authenticate, authorize('technician', 'client'), async (req, res) => {
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
    const normalized = (responses || []).map((r) => {
      const orig = r || {};
      let attachmentUrl = orig.attachment_url || orig.attachment || orig.file_path || null;
      // Keep relative paths as-is (ensure leading slash). If an absolute URL is stored, leave it.
      if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) {
        attachmentUrl = attachmentUrl.startsWith('/') ? attachmentUrl : `/${attachmentUrl}`;
      }
      return {
        ...orig,
        attachment_url: attachmentUrl,
        attachment_type: orig.attachment_type || null
      };
    });

    try {
      const attachmentsCount = normalized.filter(r => r && (r.attachment_url || r.attachment_type)).length;
      console.log(`[SMIS RESPONSES DEBUG] ticket=${req.params.id} user=${req.user.id} role=${req.user.role} responses=${normalized.length} attachments=${attachmentsCount}`);
    } catch (e) {
      console.log('[SMIS RESPONSES DEBUG] failed to inspect responses:', e && e.message);
    }

    res.json({ success: true, responses: normalized });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// POST   /api/tickets
// Roles: admin, client
// Body: { title, description, priority, requestor_id?, client_id?, company_id?, department_id? }
// Multipart/form-data: add `attachment` file for ticket creation
// → create ticket
router.post('/', authenticate, authorize('admin', 'client'), attachmentUpload.single('attachment'), async (req, res) => {
  try {
    const body = req.user.role === 'client'
      ? { ...req.body, company_id: req.user.company_id, requestor_id: req.user.id }
      : {
          ...req.body,
          requestor_id: req.body.requestor_id || req.body.client_id || req.user.id,
          company_id: req.body.company_id ?? null,
          department_id: req.body.department_id ?? null
        };

    const ticket = await ticketService.create(body, req.user);

    if (req.file) {
      const attachmentType = getAttachmentType(req.file.originalname);
      const attachmentUrl = `/uploads/ticket_responses/${req.file.filename}`;
      await ticketService.addResponse(ticket.id, {
        message: 'Attachment added at ticket creation.',
        internal_note: false,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType
      }, req.user);
    }

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
// → assign technician or department to ticket
const handleAssignRequest = async (req, res) => {
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
};

router.patch('/:id/assign', authenticate, authorize('admin', 'head'), handleAssignRequest);
router.patch('/:id/assign-dept', authenticate, authorize('admin', 'head'), handleAssignRequest);

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
      attachment_url: req.file ? `/uploads/ticket_responses/${req.file.filename}` : null,
      attachment_type: req.file ? getAttachmentType(req.file.originalname) : null
    };

    const result = await ticketService.addResponse(req.params.id, payload, req.user);

    if (result && result.response) {
      const r = result.response;
      let attachmentUrl = r.attachment_url || r.attachment || r.file_path || null;
      if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) {
        attachmentUrl = attachmentUrl.startsWith('/') ? attachmentUrl : `/${attachmentUrl}`;
      }
      result.response.attachment_url = attachmentUrl;
      result.response.attachment_type = r.attachment_type || (attachmentUrl ? getAttachmentType(attachmentUrl) : null);
    }

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
