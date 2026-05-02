// Writes to the activity_logs table.
// Used internally by other services — never called directly
// from route handlers.
// -------------------------------------------------------

const pool2 = require('../config/db');

/**
 * record({ ticketId?, userId, action, details? })
 * ticketId is optional — some events (LOGIN, USER_CREATED)
 * are not tied to a specific ticket.
 */
const record = async ({ ticketId = null, userId, action, details = null }) => {
  try {
    await pool2.query(
      'INSERT INTO activity_logs (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [ticketId, userId, action, details]
    );
  } catch (err) {
    // Logging must never crash the main request flow
    console.error('[LogService] Failed to write log entry:', err.message);
  }
};

// ── getAll ───────────────────────────────────────────────
const getAll = async ({ ticketId, userId, limit = 100 } = {}) => {
  let query  = `
    SELECT l.*, u.name AS user_name, u.role AS user_role,
           t.work_order_id
    FROM   activity_logs l
    JOIN   users u    ON u.id = l.user_id
    LEFT JOIN tickets t ON t.id = l.ticket_id
    WHERE  1=1
  `;
  const vals = [];

  if (ticketId) { query += ' AND l.ticket_id = ?'; vals.push(ticketId); }
  if (userId)   { query += ' AND l.user_id   = ?'; vals.push(userId);   }

  query += ' ORDER BY l.created_at DESC LIMIT ?';
  vals.push(limit);

  const [rows] = await pool2.query(query, vals);
  return rows;
};

module.exports = { record, getAll };