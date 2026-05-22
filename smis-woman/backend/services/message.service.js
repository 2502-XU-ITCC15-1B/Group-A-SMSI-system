const pool = require('../config/db');
const logService = require('./log.service');

const getDefaultAdminId = async () => {
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE LOWER(role) = 'admin' AND is_active = 1 ORDER BY created_at ASC LIMIT 1`
  );

  if (!rows || rows.length === 0) {
    throw { status: 500, message: 'No active administrator account available.' };
  }

  return rows[0].id;
};

const getMessageRecipients = async () => {
  const [rows] = await pool.query(
    `SELECT u.id,
            u.name,
            u.email,
            u.role,
            u.department_id,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE LOWER(u.role) IN ('admin','head')
       AND u.is_active = 1
     ORDER BY LOWER(u.role) = 'admin' DESC, d.name ASC, u.name ASC`
  );

  return rows.map((recipient) => {
    const recipientRole = String(recipient.role || '').trim().toLowerCase();
    return {
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      department_id: recipient.department_id,
      department_name: recipient.department_name || null,
      label: recipientRole === 'admin'
        ? `Admin (${recipient.name})`
        : `Head of ${recipient.department_name || 'Department'} (${recipient.name})`
    };
  });
};

const createMessage = async ({ senderId, senderRole, receiverId, message }) => {
  const normalizedMessage = (message || '').trim();

  if (!senderId) {
    throw { status: 400, message: 'Sender is required.' };
  }

  if (!normalizedMessage) {
    throw { status: 400, message: 'Message cannot be empty.' };
  }

  let resolvedReceiverId = receiverId ? Number(receiverId) : null;

  // If sender is a non-admin (client/technician/head) and receiver not provided,
  // deliver to the default admin.
  const normalizedSenderRole = String(senderRole || '').trim().toLowerCase();
  if (!resolvedReceiverId) {
    if (normalizedSenderRole !== 'client' && normalizedSenderRole !== 'technician' && normalizedSenderRole !== 'head') {
      throw { status: 400, message: 'receiver_id is required when sending from admin.' };
    }

    resolvedReceiverId = await getDefaultAdminId();
  }

  // Verify both users exist
  const [users] = await pool.query(
    `SELECT id, role FROM users WHERE id = ANY($1)`,
    [[senderId, resolvedReceiverId]]
  );

  if (!users || users.length < 1) {
    throw { status: 400, message: 'Sender or receiver is invalid.' };
  }

  const senderRow = users.find((row) => Number(row.id) === Number(senderId));
  const receiverRow = users.find((row) => Number(row.id) === Number(resolvedReceiverId));

  if (!senderRow || !receiverRow) {
    throw { status: 400, message: 'Sender or receiver is invalid.' };
  }

  const normalizedReceiverRole = String(receiverRow.role || '').trim().toLowerCase();

  // Non-admins must send to admin only
  if ((normalizedSenderRole === 'client' || normalizedSenderRole === 'technician' || normalizedSenderRole === 'head')
      && normalizedReceiverRole !== 'admin') {
    throw { status: 400, message: 'Messages from clients, technicians, or department heads must be addressed to an admin.' };
  }

  // Admin should not message other admins via this endpoint
  if (normalizedSenderRole === 'admin' && normalizedReceiverRole === 'admin') {
    throw { status: 400, message: 'Admin messages must be sent to a client or technician.' };
  }

  const [result] = await pool.query(
    `INSERT INTO messages (sender_id, receiver_id, message, is_read)
     VALUES ($1, $2, $3, $4)
     RETURNING id, sender_id, receiver_id, message, is_read, created_at`,
    [senderId, resolvedReceiverId, normalizedMessage, false]
  );

  if (!result || result.length === 0) {
    throw { status: 500, message: 'Failed to create message.' };
  }

  try {
    await logService.record({
      userId: senderId,
      action: senderRole === 'admin' ? 'PRIVATE_MESSAGE_REPLY' : 'PRIVATE_MESSAGE_SENT',
      details: `Private message from user ${senderId} to user ${resolvedReceiverId}.`
    });
  } catch (e) {
    // non-fatal logging error
    console.warn('[message.service] log record failed', e?.message || e);
  }

  return result[0];
};

const getMessagesByUserId = async (targetUserId, requestingUserId, requestingUserRole) => {
  const normalizedRequestingRole = String(requestingUserRole || '').trim().toLowerCase();
  if ((normalizedRequestingRole === 'client' || normalizedRequestingRole === 'technician' || normalizedRequestingRole === 'head')
      && Number(requestingUserId) !== Number(targetUserId)) {
    throw { status: 403, message: 'Access denied.' };
  }

  const [rows] = await pool.query(
    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
            sender.id AS sender_user_id, sender.name AS sender_name, sender.email AS sender_email, sender.role AS sender_role,
            receiver.id AS receiver_user_id, receiver.name AS receiver_name, receiver.email AS receiver_email, receiver.role AS receiver_role
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE (m.sender_id = $1 AND LOWER(receiver.role) = 'admin')
        OR (m.receiver_id = $1 AND LOWER(sender.role) = 'admin')
     ORDER BY m.created_at ASC`,
    [Number(targetUserId)]
  );

  // mark admin->user messages as read when the user views
  if (requestingUserRole === 'client' || requestingUserRole === 'technician' || requestingUserRole === 'head') {
    await pool.query(
      `UPDATE messages SET is_read = TRUE
       WHERE receiver_id = $1 AND is_read = FALSE AND sender_id IN (
         SELECT id FROM users WHERE LOWER(role) = 'admin'
       )`,
      [Number(targetUserId)]
    );
  }

  // when admin views, mark all messages addressed to admin as read
  if (requestingUserRole === 'admin') {
    await pool.query(
      `UPDATE messages SET is_read = TRUE
       WHERE receiver_id = $1 AND is_read = FALSE`,
      [Number(requestingUserId)]
    );
  }

  return rows || [];
};

const getAdminThreads = async () => {
  const [rows] = await pool.query(
    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.is_read, m.created_at,
            sender.id AS sender_user_id, sender.name AS sender_name, sender.email AS sender_email, sender.role AS sender_role,
            receiver.id AS receiver_user_id, receiver.name AS receiver_name, receiver.email AS receiver_email, receiver.role AS receiver_role
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE ((LOWER(sender.role) = 'client' OR LOWER(sender.role) = 'technician' OR LOWER(sender.role) = 'head') AND LOWER(receiver.role) = 'admin')
        OR (LOWER(sender.role) = 'admin' AND (LOWER(receiver.role) = 'client' OR LOWER(receiver.role) = 'technician' OR LOWER(receiver.role) = 'head'))
     ORDER BY m.created_at DESC`
  );

  return rows || [];
};

module.exports = {
  getDefaultAdminId,
  getMessageRecipients,
  createMessage,
  getMessagesByUserId,
  getAdminThreads
};
