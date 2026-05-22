const express = require('express');
const router = express.Router();
const messageService = require('../services/message.service');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', async (req, res) => {
  try {
    const payload = {
      sender_id: req.user.id,
      sender_role: req.user.role,
      receiver_id: req.body.receiver_id ?? null,
      message: req.body.message
    };
    const result = await messageService.createMessage(payload);
    res.json({ success: true, message: 'Message sent successfully.', data: result });
  } catch (err) {
    console.error('[messages.post] error', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to send message.' });
  }
});

router.get('/default-admin', async (req, res) => {
  try {
    const adminId = await messageService.getDefaultAdminId();
    res.json({ success: true, admin_id: adminId });
  } catch (err) {
    console.error('[messages.default-admin] error', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to resolve default admin.' });
  }
});

router.get('/recipients', async (req, res) => {
  try {
    const recipients = await messageService.getMessageRecipients();
    res.json({ success: true, recipients });
  } catch (err) {
    console.error('[messages.recipients] error', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load message recipients.' });
  }
});

router.get('/user/:id', async (req, res) => {
  try {
    const messages = await messageService.getMessagesByUserId(
      Number(req.params.id),
      req.user.id,
      req.user.role
    );
    res.json({ success: true, messages });
  } catch (err) {
    console.error('[messages.get user] error', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load messages.' });
  }
});
router.get('/admin', authorize('admin'), async (req, res) => {
  try {
    const threads = await messageService.getAdminThreads();
    res.json({ success: true, threads });
  } catch (err) {
    console.error('[messages.get admin] error', err);
    res.status(err.status || 500).json({ success: false, message: err.message || 'Unable to load admin threads.' });
  }
});

module.exports = router;
