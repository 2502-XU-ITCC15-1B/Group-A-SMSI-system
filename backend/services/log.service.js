const pool = require('../config/db');

// -------------------------------------------------------
// Writes to the activity_logs table.
// Used internally by other services — never called directly
// from route handlers.
// -------------------------------------------------------

/**
 * record({ ticketId?, userId, action, details? })
 * ticketId is optional — some events (LOGIN, USER_CREATED)
 * are not tied to a specific ticket.
 */
const record = async ({ ticketId = null, userId, action, details = null }) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (ticket_id, user_id, action, details)
       VALUES (?, ?, ?, ?)`,
      [ticketId, userId, action, details]
    );
  } catch (err) {
    // Logging must never break the main request flow
    console.error('[LogService] Failed to write log entry:', err.message);
  }
};

// ── getAll ───────────────────────────────────────────────
// Returns system activity logs with optional filters.
const getAll = async ({ ticketId = null, userId = null, limit = 100 } = {}) => {
  let sql = `
    SELECT l.*, u.name AS user_name, u.role AS user_role,
           t.work_order_id
    FROM activity_logs l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN tickets t ON t.id = l.ticket_id
    WHERE 1=1
  `;

  const values = [];

  if (ticketId) {
    sql += ' AND l.ticket_id = ?';
    values.push(ticketId);
  }

  if (userId) {
    sql += ' AND l.user_id = ?';
    values.push(userId);
  }

  sql += ' ORDER BY l.created_at DESC LIMIT ?';
  values.push(limit);

  const [rows] = await pool.query(sql, values);
  return rows;
};

module.exports = { record, getAll };