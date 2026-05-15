const pool = require('../config/db');
const logService = require('./log.service');
const mailService = require('./mail.service');

const generateWorkOrderId = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM tickets WHERE EXTRACT(YEAR FROM created_at) = $1',
    [year]
  );

  const seq = String(rows[0].total + 1).padStart(4, '0');
  return `WO-${year}-${seq}`;
};

// BASE SELECT (shared query structure)
const BASE_SELECT = `
  SELECT t.*,
         u_req.name AS requestor_name,
         u_tech.name AS technician_name,
         c.name AS company_name,
         d.name AS department_name
  FROM tickets t
  LEFT JOIN users u_req ON u_req.id = t.requestor_id
  LEFT JOIN users u_tech ON u_tech.id = t.technician_id
  LEFT JOIN companies c ON c.id = t.company_id
  LEFT JOIN departments d ON d.id = t.department_id
`;

// ── getAll ─────────────────────────────────────────────
// Retrieves tickets with role-based access control
// -------------------------------------------------------
const getAll = async (user, filters = {}) => {
  let sql = BASE_SELECT + ' WHERE t.is_deleted = 0';
  const values = [];
  let paramIndex = 1;

  if (user.role === 'client') {
    sql += ` AND t.company_id = $${paramIndex++}`;
    values.push(user.company_id);
  } else if (user.role === 'technician') {
    sql += ` AND t.technician_id = $${paramIndex++}`;
    values.push(user.id);
  } else if (user.role === 'head') {
    sql += ` AND (t.department_id = $${paramIndex++} OR t.department_id IS NULL)`;
    values.push(user.department_id || null);
  }

  if (filters.status) {
    sql += ` AND t.status = $${paramIndex++}`;
    values.push(filters.status);
  }

  if (filters.priority) {
    sql += ` AND t.priority = $${paramIndex++}`;
    values.push(filters.priority);
  }

  if (filters.company_id && user.role === 'admin') {
    sql += ` AND t.company_id = $${paramIndex++}`;
    values.push(filters.company_id);
  }

  if (filters.department_id && (user.role === 'admin' || user.role === 'head')) {
    sql += ` AND t.department_id = $${paramIndex++}`;
    values.push(filters.department_id);
  }

  sql += ' ORDER BY t.created_at DESC';

  const [rows] = await pool.query(sql, values);
  return rows;
};

// ── getMine ────────────────────────────────────────────
// Alias for getAll (current user scoped results)
// -------------------------------------------------------
const getMine = async (user) => {
  return getAll(user, {});
};

// ── getById ─────────────────────────────────────────────
// Fetch single ticket with strict access control
// -------------------------------------------------------
const getById = async (id, user) => {
  const [rows] = await pool.query(BASE_SELECT + ' WHERE t.id = $1 AND t.is_deleted = 0', [id]);

  if (rows.length === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  const ticket = rows[0];

  if (user.role === 'client' && ticket.company_id !== user.company_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  if (user.role === 'technician' && ticket.technician_id !== user.id) {
    throw { status: 403, message: 'Access denied.' };
  }

  if (user.role === 'head' && user.department_id && ticket.department_id !== user.department_id) {
    throw { status: 403, message: 'Access denied.' };
  }

  return ticket;
};

// ── create ─────────────────────────────────────────────
// Creates new ticket + generates work order ID
// -------------------------------------------------------
const create = async (data, user) => {
  const work_order_id = await generateWorkOrderId();

  const [result] = await pool.query(
    `INSERT INTO tickets
      (work_order_id, title, description, company_id, department_id, requestor_id, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Open')
     RETURNING id`,
    [
      work_order_id,
      data.title,
      data.description || null,
      data.company_id || null,
      data.department_id || null,
      data.requestor_id,
      data.priority || 'Medium'
    ]
  );

  await logService.record({
    ticketId: result.id,
    userId: user.id,
    action: 'TICKET_CREATED',
    details: `Work order ${work_order_id} created.`
  });

  return { id: result.id, work_order_id };
};

// ── update ─────────────────────────────────────────────
// Updates ticket fields (partial update supported)
// -------------------------------------------------------
const update = async (ticketId, data, user) => {
  const [result] = await pool.query(
    `UPDATE tickets
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3, priority),
         department_id = COALESCE($4, department_id)
     WHERE id = $5`,
    [data.title || null, data.description || null, data.priority || null, data.department_id ?? null, ticketId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'TICKET_UPDATED',
    details: 'Ticket details updated.'
  });

  return { success: true, message: 'Ticket updated.' };
};

// ── updateStatus ───────────────────────────────────────
// Updates ticket status with validation
// -------------------------------------------------------
const updateStatus = async (ticketId, status, user) => {
  const allowed = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

  if (!allowed.includes(status)) {
    throw { status: 400, message: 'Invalid status value.' };
  }

  if (status === 'Closed' && user.role === 'technician') {
    throw { status: 403, message: 'Only an administrator or department head can close tickets.' };
  }

  const [result] = await pool.query(
    `UPDATE tickets
     SET status = $1,
         resolved_at = CASE WHEN $1 = 'Resolved' THEN NOW() ELSE resolved_at END,
         closed_at   = CASE WHEN $1 = 'Closed' THEN NOW() ELSE closed_at END
     WHERE id = $2`,
    [status, ticketId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'STATUS_CHANGED',
    details: `Status updated to "${status}".`
  });

  return { success: true, message: `Status updated to ${status}.` };
};

// ── assign ─────────────────────────────────────────────
// Assigns technician or department to ticket
// -------------------------------------------------------
const assign = async (ticketId, data, user) => {
  const technicianId = data.technician_id || null;
  const departmentId = data.department_id || null;

  if (!technicianId && !departmentId) {
    throw { status: 400, message: 'technician_id or department_id is required.' };
  }

  if (user.role === 'admin' && technicianId && !departmentId) {
    throw { status: 403, message: 'Admins may only forward tickets to department heads. Department heads assign technicians.' };
  }

  const [result] = await pool.query(
    `UPDATE tickets
     SET technician_id = COALESCE($1, technician_id),
         department_id = COALESCE($2, department_id),
         status = 'Assigned'
     WHERE id = $3`,
    [technicianId, departmentId, ticketId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'TICKET_ASSIGNED',
    details: 'Ticket assignment updated.'
  });

  return { success: true, message: 'Ticket assigned.' };
};

// ── close ──────────────────────────────────────────────
// Closes ticket + sends resolution email
// -------------------------------------------------------
const close = async (ticketId, user) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.email AS requester_email, u.name AS requester_name
     FROM tickets t
     LEFT JOIN users u ON u.id = t.requestor_id
     WHERE t.id = $1`,
    [ticketId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  const ticket = rows[0];

  await pool.query(
    `UPDATE tickets
     SET status = 'Closed', closed_at = NOW()
     WHERE id = $1`,
    [ticketId]
  );

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'TICKET_CLOSED',
    details: `Work order ${ticket.work_order_id} closed.`
  });

  await mailService.sendResolutionEmail({
    to: ticket.requester_email,
    name: ticket.requester_name,
    workOrderId: ticket.work_order_id,
    title: ticket.title,
    resolution: ticket.resolution_summary || null
  });

  return { success: true, message: 'Ticket closed and email sent.' };
};

// ── addResponse ────────────────────────────────────────
// Adds internal or external ticket response
// -------------------------------------------------------
const addResponse = async (ticketId, data, user) => {
  const message = data.message || data.response || '';

  if (!message.trim()) {
    throw { status: 400, message: 'Message is required.' };
  }

  await getById(ticketId, user);

  await pool.query(
    `INSERT INTO ticket_responses (ticket_id, user_id, message, internal_note, attachment_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, user.id, message, data.internal_note ? 1 : 0, data.attachment_url || null]
  );

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'RESPONSE_ADDED',
    details: 'A response was added to the ticket.'
  });

  return { message: 'Response submitted.' };
};

// ── getResponses ───────────────────────────────────────
// Retrieves all responses for a ticket
// -------------------------------------------------------
const getResponses = async (ticketId, user) => {
  await getById(ticketId, user);

  const [rows] = await pool.query(
    `SELECT r.*, u.name AS author_name, u.role AS author_role
     FROM ticket_responses r
     JOIN users u ON u.id = r.user_id
     WHERE r.ticket_id = $1
     ORDER BY r.created_at ASC`,
    [ticketId]
  );

  return rows;
};

// ── remove ─────────────────────────────────────────────
// Soft delete ticket
// -------------------------------------------------------
const remove = async (ticketId, user) => {
  await pool.query(
    'UPDATE tickets SET is_deleted = 1 WHERE id = $1',
    [ticketId]
  );

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'TICKET_DELETED',
    details: 'Ticket soft-deleted.'
  });

  return { success: true, message: 'Ticket deleted.' };
};

module.exports = {
  getAll,
  getMine,
  getById,
  create,
  update,
  updateStatus,
  assign,
  close,
  addResponse,
  getResponses,
  remove
};
