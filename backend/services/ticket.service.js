const pool = require('../config/db');
const logService = require('./log.service');
const mailService = require('./mail.service');

// ── generateWorkOrderId ────────────────────────────────
// Produces a unique, human-readable ID: WO-2026-0042
// -------------------------------------------------------
const generateWorkOrderId = async () => {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM tickets WHERE YEAR(created_at) = ?',
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

  if (user.role === 'client') {
    sql += ' AND t.company_id = ?';
    values.push(user.company_id);
  } else if (user.role === 'technician') {
    sql += ' AND t.technician_id = ?';
    values.push(user.id);
  } else if (user.role === 'head') {
    sql += ' AND (t.department_id = ? OR t.department_id IS NULL)';
    values.push(user.department_id || null);
  }

  if (filters.status) {
    sql += ' AND t.status = ?';
    values.push(filters.status);
  }

  if (filters.priority) {
    sql += ' AND t.priority = ?';
    values.push(filters.priority);
  }

  if (filters.company_id && user.role === 'admin') {
    sql += ' AND t.company_id = ?';
    values.push(filters.company_id);
  }

  if (filters.department_id && (user.role === 'admin' || user.role === 'head')) {
    sql += ' AND t.department_id = ?';
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
  const [rows] = await pool.query(BASE_SELECT + ' WHERE t.id = ? AND t.is_deleted = 0', [id]);

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

  if (user.role === 'head' && user.department_id && ticket.department_id !== user.department_id && ticket.department_id !== null) {
    throw { status: 403, message: 'Access denied.' };
  }

  return ticket;
};

// ── create ─────────────────────────────────────────────
// Creates new ticket + generates work order ID
// -------------------------------------------------------
const create = async (data, user) => {
  const work_order_id = await generateWorkOrderId();

  // Validate referenced company and department IDs if provided
  if (data.company_id) {
    const [compRows] = await pool.query('SELECT id FROM companies WHERE id = ?', [data.company_id]);
    if (!compRows.length) {
      throw { status: 400, message: 'Invalid company_id provided.' };
    }
  }

  if (data.department_id) {
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE id = ?', [data.department_id]);
    if (!deptRows.length) {
      throw { status: 400, message: 'Invalid department_id provided.' };
    }
  }

  const [result] = await pool.query(
    `INSERT INTO tickets
      (work_order_id, title, description, company_id, department_id, requestor_id, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Open')`,
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
    ticketId: result.insertId,
    userId: user.id,
    action: 'TICKET_CREATED',
    details: `Work order ${work_order_id} created.`
  });

  return { id: result.insertId, work_order_id };
};

// ── update ─────────────────────────────────────────────
// Updates ticket fields (partial update supported)
// -------------------------------------------------------
const update = async (ticketId, data, user) => {
  const [result] = await pool.query(
    `UPDATE tickets
     SET title = COALESCE(?, title),
         description = COALESCE(?, description),
         priority = COALESCE(?, priority),
         department_id = COALESCE(?, department_id)
     WHERE id = ?`,
    [data.title || null, data.description || null, data.priority || null, data.department_id ?? null, ticketId]
  );

  if (result.affectedRows === 0) {
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
     SET status = ?,
         resolved_at = CASE WHEN ? = 'Resolved' THEN NOW() ELSE resolved_at END,
         closed_at   = CASE WHEN ? = 'Closed' THEN NOW() ELSE closed_at END
     WHERE id = ?`,
    [status, status, status, ticketId]
  );

  if (result.affectedRows === 0) {
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
  const hasTechnician = Object.prototype.hasOwnProperty.call(data, 'technician_id');
  const hasDepartment = Object.prototype.hasOwnProperty.call(data, 'department_id');

  if (!hasTechnician && !hasDepartment) {
    throw { status: 400, message: 'technician_id or department_id is required.' };
  }

  // Build update dynamically so we can explicitly clear technician when forwarding department
  const updates = [];
  const params = [];

  // If admin forwarded to a department and did not explicitly provide a technician,
  // fetch department manager and auto-assign the ticket to that manager (department head).
  let autoAssignManagerId = null;
  if (hasDepartment && !hasTechnician && user.role === 'admin') {
    const [mgrRows] = await pool.query('SELECT manager_id FROM departments WHERE id = ?', [data.department_id]);
    autoAssignManagerId = mgrRows[0] ? mgrRows[0].manager_id : null;
  }

  if (hasTechnician || autoAssignManagerId !== null) {
    updates.push('technician_id = ?');
    if (hasTechnician) params.push(data.technician_id === null ? null : data.technician_id);
    else params.push(autoAssignManagerId);
  }

  if (hasDepartment) {
    updates.push('department_id = ?');
    params.push(data.department_id === null ? null : data.department_id);
  }

  updates.push("status = 'Assigned'");

  params.push(ticketId);

  const [result] = await pool.query(
    `UPDATE tickets\n     SET ${updates.join(',\n         ')}\n     WHERE id = ?`,
    params
  );

  if (result.affectedRows === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'TICKET_ASSIGNED',
    details: 'Ticket assignment updated.'
  });
  // If department was changed, notify the department manager (head)
  if (hasDepartment) {
    try {
      const [deptRows] = await pool.query(
        `SELECT d.id, d.name AS department_name, u.id AS manager_id, u.email AS manager_email, u.name AS manager_name
         FROM departments d
         LEFT JOIN users u ON u.id = d.manager_id
         WHERE d.id = ?`,
        [data.department_id]
      );

      if (deptRows.length) {
        const dept = deptRows[0];
        await logService.record({
          ticketId,
          userId: user.id,
          action: 'TICKET_FORWARDED',
          details: `Forwarded to department ${dept.department_name} (manager id ${dept.manager_id}).`
        });

        // Send a notification stub to manager if email exists
        const mailService = require('./mail.service');
        if (dept.manager_email) {
          try {
            const [ticketRows] = await pool.query(
              'SELECT work_order_id, title FROM tickets WHERE id = ?',
              [ticketId]
            );
            const ticketInfo = ticketRows[0] || {};

            await mailService.sendResolutionEmail({
              to: dept.manager_email,
              name: dept.manager_name || 'Manager',
              workOrderId: ticketInfo.work_order_id || 'Unknown',
              title: ticketInfo.title || 'Ticket forwarded',
              resolution: `A ticket has been forwarded to your department: ${dept.department_name}`
            });
          } catch (e) {
            // don't fail the main flow on mail errors
            console.error('[TicketService] Failed to notify department manager:', e.message);
          }
        }
      }
    } catch (e) {
      console.error('[TicketService] Failed post-assign department actions:', e.message);
    }
  }

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
     WHERE t.id = ?`,
    [ticketId]
  );

  if (rows.length === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  const ticket = rows[0];

  await pool.query(
    `UPDATE tickets
     SET status = 'Closed', closed_at = NOW()
     WHERE id = ?`,
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

  const [insertResult] = await pool.query(
    `INSERT INTO ticket_responses (ticket_id, user_id, message, internal_note, attachment_url, attachment_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ticketId, user.id, message, data.internal_note ? 1 : 0, data.attachment_url || null, data.attachment_type || null]
  );

  const responseId = insertResult.insertId;
  const [rows] = await pool.query(
    `SELECT r.id, r.ticket_id, r.user_id, r.message, r.internal_note, r.attachment_url, r.attachment_type, r.created_at,
            u.name AS author_name, u.role AS author_role
     FROM ticket_responses r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = ?`,
    [responseId]
  );

  await logService.record({
    ticketId,
    userId: user.id,
    action: 'RESPONSE_ADDED',
    details: `Response added; response_id=${responseId}${data.attachment_url ? `; attachment_url=${data.attachment_url}` : ''}${data.attachment_type ? `; attachment_type=${data.attachment_type}` : ''}`
  });

  return {
    message: 'Response submitted.',
    response: rows[0] || null
  };
};

// ── getResponses ───────────────────────────────────────
// Retrieves all responses for a ticket
// -------------------------------------------------------
const getResponses = async (ticketId, user) => {
  // Fetch ticket to perform role-aware access control for responses
  const [ticketRows] = await pool.query('SELECT id, company_id, department_id, technician_id FROM tickets WHERE id = ? AND is_deleted = 0', [ticketId]);
  if (ticketRows.length === 0) {
    throw { status: 404, message: 'Ticket not found.' };
  }

  const ticket = ticketRows[0];

  // Simple rule: admins, technicians, and department heads can view responses/attachments
  if (['admin', 'technician', 'head'].includes(user.role)) {
    // allowed
  } else if (user.role === 'client') {
    if (ticket.company_id !== user.company_id) throw { status: 403, message: 'Access denied.' };
  } else {
    throw { status: 403, message: 'Access denied.' };
  }

  const [rows] = await pool.query(
    `SELECT r.id, r.ticket_id, r.user_id, r.message, r.internal_note, r.created_at, r.is_deleted,
            r.attachment_url, r.attachment_type,
            u.name AS author_name, u.role AS author_role
     FROM ticket_responses r
     JOIN users u ON u.id = r.user_id
     WHERE r.ticket_id = ? AND r.is_deleted = 0
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
    'UPDATE tickets SET is_deleted = 1 WHERE id = ?',
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
  // Soft-delete a response (admin only)
  removeResponse: async (ticketId, responseId, adminUser, reason = null) => {
    // validate ticket access
    await getById(ticketId, adminUser);

    const [rows] = await pool.query(
      'SELECT r.*, r.ticket_id, r.user_id FROM ticket_responses r WHERE r.id = ? AND r.ticket_id = ?',
      [responseId, ticketId]
    );

    if (!rows.length) {
      throw { status: 404, message: 'Response not found.' };
    }

    await pool.query(
      'UPDATE ticket_responses SET is_deleted = 1 WHERE id = ?',
      [responseId]
    );

    await logService.record({
      ticketId,
      userId: adminUser.id,
      action: 'RESPONSE_REMOVED',
      details: `Response ${responseId} removed by admin ${adminUser.id}.${reason ? ' Reason: ' + reason : ''}`
    });

    return { success: true, message: 'Response removed.' };
  },
};
