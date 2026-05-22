const pool = require('../config/db');
const logService = require('./log.service');

const getDefaultAdminId = async () => {
  const [rows] = await pool.query(
    'SELECT id FROM users WHERE LOWER(role) = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
    ['admin']
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

const canSendMessage = async (sender, receiver) => {
  if (!sender || !receiver) return false;

  const senderRole = String(sender.role || '').trim().toLowerCase();
  const receiverRole = String(receiver.role || '').trim().toLowerCase();

  if (senderRole === 'admin') {
    return receiverRole !== 'admin';
  }

  if (senderRole === 'client') {
    return receiverRole === 'admin' || receiverRole === 'head';
  }

  if (senderRole === 'head') {
    if (receiverRole === 'admin' || receiverRole === 'client') {
      return true;
    }
    if (receiverRole === 'technician') {
      return sender.department_id && receiver.department_id && sender.department_id === receiver.department_id;
    }
    return false;
  }

  if (senderRole === 'technician') {
    if (receiverRole === 'admin') {
      return true;
    }
    if (receiverRole === 'head') {
      return sender.department_id && receiver.department_id && sender.department_id === receiver.department_id;
    }
    if (receiverRole === 'client') {
      const [rows] = await pool.query(
        `SELECT id FROM tickets WHERE technician_id = ? AND requestor_id = ? LIMIT 1`,
        [sender.id, receiver.id]
      );
      return rows.length > 0;
    }
    return false;
  }

  return false;
};

const createMessage = async ({ sender_id, sender_role, receiver_id, message }) => {
  if (!sender_id || !sender_role) {
    throw { status: 401, message: 'Authentication required to send messages.' };
  }

  if (!message || !String(message).trim()) {
    throw { status: 400, message: 'Message is required.' };
  }

  let resolvedReceiverId = receiver_id ? Number(receiver_id) : null;

  if (!resolvedReceiverId) {
    resolvedReceiverId = await getDefaultAdminId();
  }

  const [users] = await pool.query(
    'SELECT id, role, department_id FROM users WHERE id IN (?, ?) AND is_active = 1',
    [sender_id, resolvedReceiverId]
  );

  const senderRow = users.find((row) => Number(row.id) === Number(sender_id));
  const receiverRow = users.find((row) => Number(row.id) === Number(resolvedReceiverId));

  if (!senderRow || !receiverRow) {
    throw { status: 404, message: 'Sender or recipient not found.' };
  }

  const allowed = await canSendMessage(senderRow, receiverRow);
  if (!allowed) {
    throw {
      status: 403,
      message: 'Messaging is only allowed between compatible support roles. Clients may message admin or department heads; technicians and heads may message support contacts in their department or assigned tickets.'
    };
  }

  const [result] = await pool.query(
    `INSERT INTO messages (sender_id, receiver_id, message, is_read)
     VALUES (?, ?, ?, ?)`,
    [sender_id, resolvedReceiverId, String(message).trim(), 0]
  );

  await logService.record({
    userId: sender_id,
    action: 'MESSAGE_SENT',
    details: `Message sent from user ${sender_id} to ${resolvedReceiverId}`
  });

  return { id: result.insertId, success: true };
};

const getMessagesByUserId = async (targetUserId, requestingUserId, requestingUserRole) => {
  if (!targetUserId) {
    throw { status: 400, message: 'Target user id is required.' };
  }

  const normalizedRequestingRole = String(requestingUserRole || '').trim().toLowerCase();
  if (normalizedRequestingRole !== 'admin' && Number(requestingUserId) !== Number(targetUserId)) {
    throw { status: 403, message: 'Access denied.' };
  }

  if (Number(requestingUserId) === Number(targetUserId)) {
    await pool.query(
      `UPDATE messages
       SET is_read = 1
       WHERE receiver_id = ?`,
      [targetUserId]
    );
  }

  const [rows] = await pool.query(
    `SELECT
       m.id AS message_id,
       m.sender_id,
       sender.name AS sender_name,
       sender.role AS sender_role,
       sender.email AS sender_email,
       sender.phone AS sender_phone,
       m.receiver_id,
       receiver.name AS receiver_name,
       receiver.role AS receiver_role,
       receiver.email AS receiver_email,
       receiver.phone AS receiver_phone,
       m.message,
       m.is_read,
       m.created_at
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE m.sender_id = ? OR m.receiver_id = ?
     ORDER BY m.created_at ASC`,
    [targetUserId, targetUserId]
  );

  return rows;
};

const getAdminThreads = async () => {
  const [rows] = await pool.query(
    `SELECT
       m.id AS message_id,
       m.sender_id,
       sender.name AS sender_name,
       sender.role AS sender_role,
       sender.email AS sender_email,
       sender.phone AS sender_phone,
       m.receiver_id,
       receiver.name AS receiver_name,
       receiver.role AS receiver_role,
       receiver.email AS receiver_email,
       receiver.phone AS receiver_phone,
       m.message,
       m.is_read,
       m.created_at
     FROM messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN users receiver ON receiver.id = m.receiver_id
     WHERE LOWER(sender.role) = 'admin' OR LOWER(receiver.role) = 'admin'
     ORDER BY m.created_at DESC`
  );

  return rows;
};

module.exports = {
  getDefaultAdminId,
  getMessageRecipients,
  createMessage,
  getMessagesByUserId,
  getAdminThreads
};
