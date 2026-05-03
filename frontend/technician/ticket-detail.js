let currentUser = null;
let currentTicket = null;
let currentTicketId = null;

const ticketStatuses = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await Auth.requireRoleAsync('technician', 'head');
  if (!currentUser) return;

  currentTicketId = new URLSearchParams(window.location.search).get('id');
  if (!currentTicketId) {
    window.location.href = Auth.ticketListUrlFor(currentUser);
    return;
  }

  initializeShell();
  bindEvents();

  await refreshPage();
});

function initializeShell() {
  TechnicianPortal.configureShell(currentUser, 'tickets');
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = Auth.ticketListUrlFor(currentUser);
  });

  if (currentUser.role === 'head') {
    document.getElementById('assignBtn').classList.remove('is-hidden');
    document.getElementById('closeBtn').classList.remove('is-hidden');
  }
}

function bindEvents() {
  document.getElementById('updateStatusBtn').addEventListener('click', handleStatusUpdate);
  document.getElementById('sendResponseBtn').addEventListener('click', handleResponseSubmit);
  document.getElementById('assignBtn').addEventListener('click', openAssignModal);
  document.getElementById('closeBtn').addEventListener('click', handleCloseTicket);
  document.getElementById('assignCloseBtn').addEventListener('click', () => AppModals.close('assignModal'));
  document.getElementById('assignCancelBtn').addEventListener('click', () => AppModals.close('assignModal'));
  document.getElementById('assignSubmitBtn').addEventListener('click', submitAssignment);
}

async function refreshPage() {
  setPageMessage('Loading ticket...');

  const ticket = await fetchTicket(currentTicketId);
  if (!ticket) {
    setPageMessage('Unable to load ticket details.', 'error');
    document.getElementById('timeline').innerHTML = '<div class="empty-state">Ticket detail is unavailable.</div>';
    return;
  }

  currentTicket = ticket;
  renderTicket(ticket);

  await Promise.all([
    renderTimeline(),
    prepareStatusOptions(ticket.status)
  ]);

  setPageMessage('');
}

function renderTicket(ticket) {
  document.title = `${ticket.work_order_id} - Ticket Detail`;
  document.getElementById('breadcrumbTicket').textContent = ticket.work_order_id || 'Detail';
  document.getElementById('ticketTitle').textContent = ticket.title || 'Untitled Ticket';
  document.getElementById('ticketDescription').textContent = ticket.description || 'No description provided.';
  document.getElementById('ticketWorkOrder').textContent = ticket.work_order_id || '-';
  document.getElementById('ticketStatus').innerHTML = `<span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status || '-')}</span>`;
  document.getElementById('ticketPriority').textContent = ticket.priority || '-';
  document.getElementById('ticketCompany').textContent = ticket.company_name || '-';
  document.getElementById('ticketAssignee').textContent = ticket.technician_name || 'Unassigned';
  document.getElementById('ticketDepartment').textContent = ticket.department_name || 'Unassigned';
  document.getElementById('ticketCreated').textContent = formatDateTime(ticket.created_at);
  document.getElementById('ticketRequestor').textContent = ticket.requestor_name || '-';

  const closeBtn = document.getElementById('closeBtn');
  if (currentUser.role === 'head') {
    closeBtn.disabled = ticket.status !== 'Resolved';
  }
}

async function renderTimeline() {
  const [logs, responses] = await Promise.all([
    fetchTicketLogs(currentTicketId),
    fetchResponses(currentTicketId)
  ]);

  const items = [
    ...logs.map((log) => ({
      type: 'log',
      timestamp: log.created_at,
      title: log.action,
      meta: log.user_name ? `${log.user_name} (${log.user_role})` : 'System',
      message: log.details || 'System activity recorded.'
    })),
    ...responses.map((response) => ({
      type: response.internal_note ? 'internal' : 'response',
      timestamp: response.created_at,
      title: response.internal_note ? 'Internal Note' : 'Response',
      meta: `${response.author_name || 'Unknown'}${response.author_role ? ` (${response.author_role})` : ''}`,
      message: response.message || ''
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const timeline = document.getElementById('timeline');

  if (!items.length) {
    timeline.innerHTML = '<div class="empty-state">No activity recorded for this ticket.</div>';
    return;
  }

  timeline.innerHTML = items.map((item) => `
    <article class="timeline-item timeline-item-${item.type}">
      <div class="timeline-item-header">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="response-meta">${formatDateTime(item.timestamp)}</span>
      </div>
      <div class="response-role">${escapeHtml(item.meta)}</div>
      <p>${escapeHtml(item.message)}</p>
    </article>
  `).join('');
}

async function prepareStatusOptions(currentStatus) {
  const select = document.getElementById('statusSelect');
  const allowed = [...ticketStatuses];

  select.innerHTML = allowed.map((status) => `
    <option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>
  `).join('');
}

async function handleStatusUpdate() {
  const button = document.getElementById('updateStatusBtn');
  const status = document.getElementById('statusSelect').value;

  if (!currentTicket || !status || status === currentTicket.status) {
    setPageMessage('Select a different status to update.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Updating...';
  setPageMessage('');

  try {
    const result = await updateTicketStatus(currentTicketId, status);

    if (!result?.success) {
      setPageMessage(result?.message || 'Unable to update ticket status.', 'error');
      return;
    }

    setPageMessage(result.message || 'Ticket status updated.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Update Status';
  }
}

async function handleResponseSubmit() {
  const button = document.getElementById('sendResponseBtn');
  const messageNode = document.getElementById('responseMessage');
  const message = document.getElementById('responseText').value.trim();
  const internalOnly = document.getElementById('internalNote').checked;

  if (!message) {
    setMessage(messageNode, 'Response message is required.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';
  setMessage(messageNode, '');

  try {
    const result = await submitResponse(currentTicketId, message, internalOnly);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to submit response.', 'error');
      return;
    }

    document.getElementById('responseText').value = '';
    document.getElementById('internalNote').checked = false;
    setMessage(messageNode, result.message || 'Response submitted.', 'success');
    await renderTimeline();
  } finally {
    button.disabled = false;
    button.textContent = 'Send Response';
  }
}

async function openAssignModal() {
  if (currentUser.role !== 'head') return;

  const [technicians, departments] = await Promise.all([
    fetchTechnicians(),
    fetchDepartments()
  ]);

  const techSelect = document.getElementById('assignTechnicianSelect');
  const deptSelect = document.getElementById('assignDepartmentSelect');

  techSelect.innerHTML = '<option value="">Select technician</option>' + technicians.map((user) => `
    <option value="${user.id}" ${String(currentTicket?.technician_id || '') === String(user.id) ? 'selected' : ''}>
      ${escapeHtml(user.name)}${Number.isFinite(Number(user.active_tickets)) ? ` (${user.active_tickets} active)` : ''}
    </option>
  `).join('');

  deptSelect.innerHTML = '<option value="">Keep current department</option>' + departments.map((department) => `
    <option value="${department.id}" ${String(currentTicket?.department_id || '') === String(department.id) ? 'selected' : ''}>
      ${escapeHtml(department.name)}
    </option>
  `).join('');

  setMessage(document.getElementById('assignMessage'), '');
  AppModals.open('assignModal');
}

async function submitAssignment() {
  const button = document.getElementById('assignSubmitBtn');
  const technicianId = document.getElementById('assignTechnicianSelect').value;
  const departmentId = document.getElementById('assignDepartmentSelect').value;
  const messageNode = document.getElementById('assignMessage');

  if (!technicianId && !departmentId) {
    setMessage(messageNode, 'Select a technician or department for assignment.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Assigning...';
  setMessage(messageNode, '');

  try {
    const payload = {
      technician_id: technicianId ? Number(technicianId) : null,
      department_id: departmentId ? Number(departmentId) : null
    };
    const result = await assignTicket(currentTicketId, payload);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to assign ticket.', 'error');
      return;
    }

    AppModals.close('assignModal');
    setPageMessage(result.message || 'Ticket assigned.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Assign Ticket';
  }
}

async function handleCloseTicket() {
  if (currentUser.role !== 'head' || !currentTicket) return;

  if (currentTicket.status !== 'Resolved') {
    setPageMessage('Only resolved tickets can be closed.', 'error');
    return;
  }

  if (!window.confirm('Close this resolved ticket?')) return;

  const button = document.getElementById('closeBtn');
  button.disabled = true;
  button.textContent = 'Closing...';
  setPageMessage('');

  try {
    const result = await closeTicket(currentTicketId);

    if (!result?.success) {
      setPageMessage(result?.message || 'Unable to close ticket.', 'error');
      return;
    }

    setPageMessage(result.message || 'Ticket closed.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Close Ticket';
  }
}

function setPageMessage(message, type = '') {
  setMessage(document.getElementById('pageMessage'), message, type);
}

function setMessage(node, message, type = '') {
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]
  ));
}
