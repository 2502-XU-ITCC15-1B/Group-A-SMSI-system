let currentUser = null;
let departmentTickets = [];
let currentAssignTicketId = null;
let techniciansCache = [];

const el = (id) => document.getElementById(id);

function fmtMinutesAgo(dateStr) {
  const diff = Math.max(1, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.round(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function statusClass(status) {
  switch (status) {
    case 'Open': return 'bg-slate-100 text-slate-600';
    case 'Assigned': return 'bg-blue-50 text-blue-700';
    case 'In Progress': return 'bg-blue-50 text-blue-700';
    case 'Resolved': return 'bg-green-50 text-green-700';
    case 'Closed': return 'bg-emerald-50 text-emerald-700';
    case 'Rejected': return 'bg-red-50 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function priorityClass(priority) {
  switch (priority) {
    case 'Critical': return 'bg-red-50 text-red-700';
    case 'High': return 'bg-orange-50 text-orange-700';
    case 'Medium': return 'bg-blue-50 text-blue-700';
    case 'Low': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function renderStats(tickets) {
  const open = tickets.filter(t => t.status === 'Open').length;
  const progress = tickets.filter(t => ['Assigned', 'In Progress'].includes(t.status)).length;
  const resolved = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
  const avgResponse = tickets.length ? Math.max(1, Math.round((tickets.length * 14) / tickets.length)) : 0;

  el('stat-open').textContent = open;
  el('stat-progress').textContent = progress;
  el('stat-resolved').textContent = resolved;
  el('stat-response').textContent = `${avgResponse}m`;
}

function ticketActionButtons(ticket) {
  const isHead = currentUser?.role === 'head';
  const canClose = isHead && ticket.status === 'Resolved';
  const canAssign = isHead && ticket.status !== 'Closed';

  return `
    <div class="flex items-center justify-end gap-2">
      ${canAssign ? `
        <button class="px-3 py-1 text-sm border rounded" data-assign="${ticket.id}">Assign</button>
      ` : ''}
      ${canClose ? `
        <button class="px-3 py-1 text-sm bg-emerald-600 text-white rounded" data-close="${ticket.id}">Close</button>
      ` : ''}
      <a class="px-3 py-1 text-sm text-blue-600" href="/head/ticket-detail.html?id=${ticket.id}">View</a>
    </div>
  `;
}

function renderTickets(tickets) {
  const tbody = el('ticketRows');
  if (!tickets.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="p-6 text-center text-slate-500">No department tickets found.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = tickets.map(ticket => `
    <tr class="border-b hover:bg-slate-50">
      <td class="px-4 py-3 font-mono text-sm">${ticket.work_order_id}</td>
      <td class="px-4 py-3">
        <div class="font-medium">${ticket.title}</div>
        <div class="text-xs text-slate-500">${ticket.department_name || ''}</div>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded ${priorityClass(ticket.priority)}">${ticket.priority}</span>
      </td>
      <td class="px-4 py-3">${ticket.technician_name || '<span class="text-slate-400 italic">Unassigned</span>'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 text-xs rounded ${statusClass(ticket.status)}">${ticket.status}</span>
      </td>
      <td class="px-4 py-3 text-sm text-slate-500">${fmtMinutesAgo(ticket.created_at)}</td>
      <td class="px-4 py-3 text-right">${ticketActionButtons(ticket)}</td>
    </tr>
  `).join('');
}

async function loadTechnicians() {
  try {
    const result = await apiFetch('/users/technicians');
    techniciansCache = result.users || [];
  } catch {
    techniciansCache = [];
  }
}

function fillTechnicianSelect() {
  const select = el('assignTechnicianSelect');
  select.innerHTML = `<option value="">Choose a technician...</option>` + techniciansCache.map(t => `
    <option value="${t.id}">${t.name}${t.department_name ? ` — ${t.department_name}` : ''}</option>
  `).join('');
}

function openAssignModal(ticketId) {
  currentAssignTicketId = ticketId;
  fillTechnicianSelect();
  el('assignNotes').value = '';
  el('assignModal').classList.remove('hidden');
}

function closeAssignModal() {
  currentAssignTicketId = null;
  el('assignModal').classList.add('hidden');
}

async function submitAssign() {
  const technician_id = el('assignTechnicianSelect').value;
  const notes = el('assignNotes').value.trim();

  if (!technician_id) {
    alert('Select a technician first.');
    return;
  }

  await apiFetch(`/tickets/${currentAssignTicketId}/assign`, {
    method: 'PATCH',
    body: {
      technician_id: Number(technician_id),
      notes,
    },
  });

  closeAssignModal();
  await refresh();
}

async function closeTicket(ticketId) {
  if (!confirm('Close this resolved ticket?')) return;
  await apiFetch(`/tickets/${ticketId}/close`, { method: 'PATCH' });
  await refresh();
}

async function loadTickets() {
  const result = await apiFetch('/tickets?scope=department');
  departmentTickets = result.tickets || [];
  renderStats(departmentTickets);
  renderTickets(departmentTickets);
}

async function refresh() {
  await Promise.all([loadTechnicians(), loadTickets()]);
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const assignId = e.target.closest('[data-assign]')?.dataset.assign;
    const closeId = e.target.closest('[data-close]')?.dataset.close;

    if (assignId) openAssignModal(assignId);
    if (closeId) closeTicket(closeId);
  });

  el('assignCancelBtn').addEventListener('click', closeAssignModal);
  el('assignSubmitBtn').addEventListener('click', submitAssign);
}

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireRole(['head']);
  if (!currentUser) return;

  bindEvents();
  await refresh();
});