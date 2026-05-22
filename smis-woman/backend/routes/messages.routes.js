const express = require('express');
const router = express.Router();
const messageService = require('../services/message.service');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// POST /api/messages
// Body: { receiver_id?, message }
// Client or technician without receiver_id sends message to default admin.
router.post('/', authorize('admin', 'client', 'technician', 'head'), async (req, res) => {
  try {
    const { receiver_id, message } = req.body || {};
    const payload = {
      senderId: req.user.id,
      senderRole: req.user.role,
      receiverId: receiver_id ? Number(receiver_id) : null,
      message
    };

    console.log('[messages.post] body:', req.body);
    console.log('[messages.post] payload:', payload);

    const created = await messageService.createMessage(payload);
    return res.status(201).json({ success: true, message: created });
  } catch (err) {
    console.error('[messages.post] error', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to send message.' });
  }
});

// GET /api/messages/default-admin
// Returns the id of the default admin account (for frontend to target messages)
router.get('/default-admin', authorize('admin', 'client', 'technician', 'head'), async (req, res) => {
  try {
    const id = await messageService.getDefaultAdminId();
    return res.json({ success: true, admin_id: id });
  } catch (err) {
    console.error('[messages.default-admin] error', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to resolve default admin.' });
  }
});

// GET /api/messages/recipients
// Returns available recipients for client/technician message composition.
router.get('/recipients', authorize('admin', 'client', 'technician', 'head'), async (req, res) => {
  try {
    const recipients = await messageService.getMessageRecipients();
    return res.json({ success: true, recipients });
  } catch (err) {
    console.error('[messages.recipients] error', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load message recipients.' });
  }
});

// GET /api/messages/user/:id
// Returns a conversation between a user and the admin team.
router.get('/user/:id', authorize('admin', 'client', 'technician', 'head'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (Number.isNaN(targetId)) return res.status(400).json({ success: false, message: 'Invalid user id.' });

    const messages = await messageService.getMessagesByUserId(
      targetId,
      req.user.id,
      req.user.role
    );
    return res.json({ success: true, messages });
  } catch (err) {
    console.error('[messages.get user] error', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load messages.' });
  }
});

// GET /api/messages/admin
// Returns all client-admin message traffic for admin overview.
router.get('/admin', authorize('admin'), async (req, res) => {
  try {
    const threads = await messageService.getAdminThreads();
    return res.json({ success: true, threads });
  } catch (err) {
    console.error('[messages.get admin] error', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load message threads.' });
  }
});

module.exports = router;
