const express      = require('express');
const multer       = require('multer');
const path         = require('path');
const router       = express.Router();
const ticketService = require('../services/ticket.service');
const { authenticate, authorize } = require('../middleware/auth');

const attachmentStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'ticket_responses'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const SUPPORTED_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx'];

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = SUPPORTED_ATTACHMENT_EXTENSIONS.includes(ext);
    if (!safeExt) {
      return cb(new Error('Only JPG, PNG, GIF, PDF, DOC, DOCX, TXT, XLS, and XLSX files are allowed.'));
    }
    cb(null, true);
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
    // Normalize attachment fields and ensure absolute URLs so the Admin UI can render them
    const normalized = (responses || []).map((r) => {
      const orig = r || {};
      let attachmentUrl = orig.attachment_url || orig.attachment || orig.file_path || null;
      if (attachmentUrl) {
        // convert to absolute URL if it's a relative path
        if (!/^https?:\/\//i.test(attachmentUrl)) {
          const base = `${req.protocol}://${req.get('host')}`;
          attachmentUrl = attachmentUrl.startsWith('/') ? `${base}${attachmentUrl}` : `${base}/${attachmentUrl}`;
        }
      }
      return {
        ...orig,
        attachment_url: attachmentUrl,
        attachment_type: orig.attachment_type || null
      };
    });

    try {
      const attachmentsCount = normalized.filter(r => r && (r.attachment_url || r.attachment_type)).length;
      console.log(`[RESPONSES DEBUG] ticket=${req.params.id} user=${req.user.id} role=${req.user.role} responses=${normalized.length} attachments=${attachmentsCount}`);
    } catch (e) {
      console.log('[RESPONSES DEBUG] failed to inspect responses:', e && e.message);
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
      const attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/ticket_responses/${req.file.filename}`;
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
    console.log('[UPLOAD DEBUG] Content-Type:', req.headers['content-type']);
    console.log('[UPLOAD DEBUG] req.body keys:', Object.keys(req.body || {}));
    console.log('[UPLOAD DEBUG] req.file present:', !!req.file, req.file ? { originalname: req.file.originalname, size: req.file.size, filename: req.file.filename, path: req.file.path } : null);
    const internalNote = req.user.role === 'client'
      ? false
      : ['1', 'true', 'on'].includes(String(req.body.internal_note || '').toLowerCase());

    const attachmentType = req.file ? (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(path.extname(req.file.originalname).toLowerCase()) ? 'image' : 'document') : null;
    const attachmentUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/ticket_responses/${req.file.filename}` : null;
    const payload = {
      message: req.body.message,
      internal_note: internalNote,
      attachment_url: attachmentUrl,
      attachment_type: attachmentType
    };

    const result = await ticketService.addResponse(req.params.id, payload, req.user);

    // Normalize response attachment URL before returning
    if (result && result.response) {
      const r = result.response;
      let attachmentUrl = r.attachment_url || r.attachment || r.file_path || null;
      if (attachmentUrl && !/^https?:\/\//i.test(attachmentUrl)) {
        const base = `${req.protocol}://${req.get('host')}`;
        attachmentUrl = attachmentUrl.startsWith('/') ? `${base}${attachmentUrl}` : `${base}/${attachmentUrl}`;
      }
      result.response.attachment_url = attachmentUrl;
      result.response.attachment_type = r.attachment_type || null;
    }

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message
    });
  }
});

// DELETE /api/tickets/:id/responses/:responseId
// Roles: admin
router.delete('/:id/responses/:responseId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id, responseId } = req.params;
    const result = await ticketService.removeResponse(id, responseId, req.user);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
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

module.exports = router;
