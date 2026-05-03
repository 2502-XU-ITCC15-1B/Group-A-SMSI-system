let currentUser = null;
let ticketId = null;
let ticketData = null;

const el = (id) => document.getElementById(id);

function getTicketIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadTicket() {
  const result = await apiFetch(`/tickets/${ticketId}`);
  ticketData = result.ticket;
}

async function loadResponses() {
  const result = await apiFetch(`/tickets/${ticketId}/responses`);
  return result.responses || [];
}

async function loadLogs() {
  const result = await apiFetch(`/logs/ticket/${ticketId}`);
  return result.logs || [];
}

function renderTicket(ticket) {
  el('ticketTitle').textContent = ticket.title;
  el('ticketDesc').textContent = ticket.description || '';
  el('ticketId').textContent = ticket.work_order_id;
  el('ticketStatus').textContent = ticket.status;
  el('ticketPriority').textContent = ticket.priority;
  el('ticketCompany').textContent = ticket.company_name || '-';
  el('ticketDept').textContent = ticket.department_name || '-';
  el('ticketAssignee').textContent = ticket.technician_name || 'Unassigned';

  const closeBtn = el('closeBtn');
  closeBtn.disabled = ticket.status !== 'Resolved';
  closeBtn.classList.toggle('opacity-50', ticket.status !== 'Resolved');
}

function renderTimeline(logs, responses) {
  const items = [
    ...logs.map(l => ({
      type: 'log',
      time: l.created_at,
      label: l.action,
      text: l.details || '',
      author: l.user_name || '',
    })),
    ...responses.map(r => ({
      type: 'response',
      time: r.created_at,
      label: r.author_role === 'head' ? 'Head Reply' : 'Technician Reply',
      text: r.message,
      author: r.author_name,
    })),
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  const wrapper = el('timeline');
  if (!items.length) {
    wrapper.innerHTML = `<div class="text-slate-500 text-sm">No activity yet.</div>`;
    return;
  }

  wrapper.innerHTML = items.map(item => `
    <div class="border-l pl-4 pb-4">
      <div class="text-xs text-slate-500">${new Date(item.time).toLocaleString()}</div>
      <div class="font-semibold">${item.label}</div>
      <div class="text-sm text-slate-700">${item.text}</div>
      <div class="text-xs text-slate-500">${item.author}</div>
    </div>
  `).join('');
}

async function updateStatus(status) {
  await apiFetch(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: { status },
  });
  await refresh();
}

async function closeTicket() {
  if (!confirm('Close this resolved ticket?')) return;
  await apiFetch(`/tickets/${ticketId}/close`, { method: 'PATCH' });
  await refresh();
}

async function assignTicket() {
  const technician_id = Number(el('assignTechnicianSelect').value);
  if (!technician_id) return alert('Select a technician.');

  await apiFetch(`/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    body: { technician_id },
  });

  el('assignModal').classList.add('hidden');
  await refresh();
}

async function refresh() {
  await loadTicket();
  renderTicket(ticketData);

  const [responses, logs] = await Promise.all([loadResponses(), loadLogs()]);
  renderTimeline(logs, responses);
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireRole(['head']);
  if (!currentUser) return;

  ticketId = getTicketIdFromUrl();
  if (!ticketId) {
    window.location.href = '/head/tickets.html';
    return;
  }

  await refresh();

  el('btnInProgress').addEventListener('click', () => updateStatus('In Progress'));
  el('btnResolved').addEventListener('click', () => updateStatus('Resolved'));
  el('closeBtn').addEventListener('click', closeTicket);

  el('assignBtn').addEventListener('click', () => el('assignModal').classList.remove('hidden'));
  el('assignCancelBtn').addEventListener('click', () => el('assignModal').classList.add('hidden'));
  el('assignSubmitBtn').addEventListener('click', assignTicket);
});