// -------------------------------------------------------
// All business logic for work orders (tickets).
// -------------------------------------------------------

const pool       = require('../config/db');
const logService = require('./log.service');

// ── generateWorkOrderId ──────────────────────────────────
// Produces a unique, human-readable ID: WO-2026-0042
const generateWorkOrderId = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM tickets WHERE YEAR(created_at) = ?",
    [year]
  );
  const seq = String(rows[0].total + 1).padStart(4, '0');
  return `WO-${year}-${seq}`;
};

// BASE SELECT with joined names used by multiple queries
const BASE_SELECT = `
  SELECT  t.*,
          u_req.name  AS requestor_name,
          u_tech.name AS technician_name,
          c.name      AS company_name
  FROM    tickets t
  LEFT JOIN users     u_req  ON u_req.id  = t.requestor_id
  LEFT JOIN users     u_tech ON u_tech.id = t.technician_id
  LEFT JOIN companies c      ON c.id      = t.company_id
`;

// ── getAll ───────────────────────────────────────────────
// Admin: all tickets.  Technician: only their assigned tickets.
// Client: only their company's tickets.
const getAll = async (user, filters = {}) => {
  let query  = BASE_SELECT + ' WHERE 1=1';
  const vals = [];

  // Role-based data scoping
  if (user.role === 'technician') {
    query += ' AND t.technician_id = ?';
    vals.push(user.id);
  } else if (user.role === 'client') {
    query += ' AND t.company_id = ?';
    vals.push(user.company_id);
  }

  // Optional filters (usable by admin)
  if (filters.status) {
    query += ' AND t.status = ?';
    vals.push(filters.status);
  }
  if (filters.priority) {
    query += ' AND t.priority = ?';
    vals.push(filters.priority);
  }
  if (filters.company_id && user.role === 'admin') {
    query += ' AND t.company_id = ?';
    vals.push(filters.company_id);
  }

  query += ' ORDER BY t.created_at DESC';

  const [rows] = await pool.query(query, vals);
  return rows;
};

// ── getById ──────────────────────────────────────────────
const getById = async (id, user) => {
  const [rows] = await pool.query(BASE_SELECT + ' WHERE t.id = ?', [id]);

  if (rows.length === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  const ticket = rows[0];

  // Enforce data isolation: clients can only see their company's tickets
  if (user.role === 'client' && ticket.company_id !== user.company_id) {
    throw { status: 403, message: 'Access denied.' };
  }
  // Technicians can only see their assigned tickets
  if (user.role === 'technician' && ticket.technician_id !== user.id) {
    throw { status: 403, message: 'Access denied.' };
  }

  return ticket;
};

// ── create ───────────────────────────────────────────────
const create = async ({ title, description, priority, company_id }, requestorId) => {
  const work_order_id = await generateWorkOrderId();

  const [result] = await pool.query(
    `INSERT INTO tickets
       (work_order_id, title, description, company_id, requestor_id, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Submitted')`,
    [work_order_id, title, description, company_id, requestorId, priority || 'Medium']
  );

  const ticketId = result.insertId;

  await logService.record({
    ticketId,
    userId:  requestorId,
    action:  'TICKET_CREATED',
    details: `Work order ${work_order_id} created.`
  });

  return { id: ticketId, work_order_id };
};

// ── updateStatus ─────────────────────────────────────────
const updateStatus = async (ticketId, newStatus, userId) => {
  // Automatically set timestamps when reaching terminal states
  const extra = newStatus === 'Resolved' ? ', resolved_at = NOW()' :
                newStatus === 'Closed'   ? ', closed_at   = NOW()' : '';

  const [result] = await pool.query(
    `UPDATE tickets SET status = ? ${extra} WHERE id = ?`,
    [newStatus, ticketId]
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  await logService.record({
    ticketId,
    userId,
    action:  'STATUS_CHANGED',
    details: `Status updated to "${newStatus}".`
  });

  return { success: true, message: `Status updated to ${newStatus}.` };
};

// ── assign ───────────────────────────────────────────────
const assign = async (ticketId, technicianId, adminId) => {
  // Verify the target user exists and is actually a technician
  const [techRows] = await pool.query(
    'SELECT id, name FROM users WHERE id = ? AND role = "technician" AND is_active = 1',
    [technicianId]
  );

  if (techRows.length === 0) {
    throw { status: 400, message: 'Technician not found or invalid role.' };
  }

  await pool.query(
    `UPDATE tickets
     SET technician_id = ?, status = 'Assigned'
     WHERE id = ?`,
    [technicianId, ticketId]
  );

  await logService.record({
    ticketId,
    userId:  adminId,
    action:  'TICKET_ASSIGNED',
    details: `Assigned to technician "${techRows[0].name}" (ID: ${technicianId}).`
  });

  return { success: true, message: `Ticket assigned to ${techRows[0].name}.` };
};

// ── addResponse ──────────────────────────────────────────
const addResponse = async (ticketId, message, userId) => {
  await pool.query(
    'INSERT INTO responses (ticket_id, user_id, message) VALUES (?, ?, ?)',
    [ticketId, userId, message]
  );

  await logService.record({
    ticketId,
    userId,
    action:  'RESPONSE_ADDED',
    details: 'A response was added to the ticket.'
  });

  return { success: true, message: 'Response submitted.' };
};

// ── getResponses ─────────────────────────────────────────
const getResponses = async (ticketId) => {
  const [rows] = await pool.query(
    `SELECT r.*, u.name AS author_name, u.role AS author_role
     FROM   responses r
     JOIN   users u ON u.id = r.user_id
     WHERE  r.ticket_id = ?
     ORDER BY r.created_at ASC`,
    [ticketId]
  );
  return rows;
};

module.exports = { getAll, getById, create, updateStatus, assign, addResponse, getResponses };