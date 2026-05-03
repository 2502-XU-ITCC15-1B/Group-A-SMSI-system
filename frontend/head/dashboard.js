let currentUser;
let allTickets = [];
let currentFilter = 'all';

const el = id => document.getElementById(id);

async function init() {
  currentUser = await requireRole(['head']);
  if (!currentUser) return;

  el('userName').textContent = currentUser.name;
  el('userDept').textContent = currentUser.department_name || '';

  bindEvents();
  await loadDashboard();
}

function bindEvents() {
  el('refreshBtn').onclick = loadDashboard;

  el('searchInput').addEventListener('input', renderTable);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn')
        .forEach(b => b.classList.remove('active'));

      btn.classList.add('active');
      currentFilter = btn.dataset.filter;

      renderTable();
    };
  });
}

async function loadDashboard() {
  const res = await apiFetch('/tickets?scope=department');
  allTickets = res.tickets || [];

  renderStats();
  renderTable();
}

function renderStats() {
  const open = allTickets.filter(t => t.status === 'Open').length;
  const progress = allTickets.filter(t =>
    ['Assigned','In Progress'].includes(t.status)
  ).length;

  const resolved = allTickets.filter(t => t.status === 'Resolved').length;
  const unassigned = allTickets.filter(t => !t.technician_id).length;

  el('stat-open').textContent = open;
  el('stat-progress').textContent = progress;
  el('stat-resolved').textContent = resolved;
  el('stat-unassigned').textContent = unassigned;
  el('stat-total').textContent = allTickets.length;

  // basic average response placeholder (can be replaced by API metric)
  el('stat-response').textContent = '14m';
}

function applyFilter(tickets) {
  switch (currentFilter) {
    case 'urgent':
      return tickets.filter(t => ['High','Critical'].includes(t.priority));
    case 'assigned':
      return tickets.filter(t => t.technician_id);
    case 'unassigned':
      return tickets.filter(t => !t.technician_id);
    default:
      return tickets;
  }
}

function applySearch(tickets) {
  const q = el('searchInput').value.toLowerCase();
  if (!q) return tickets;

  return tickets.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.work_order_id || '').toLowerCase().includes(q)
  );
}

function badgeClass(status) {
  if (status === 'Open') return 'badge open';
  if (status === 'Resolved') return 'badge resolved';
  if (status === 'Closed') return 'badge closed';
  return 'badge progress';
}

function renderTable() {
  let tickets = [...allTickets];
  tickets = applyFilter(tickets);
  tickets = applySearch(tickets);

  if (!tickets.length) {
    el('ticketRows').innerHTML =
      `<tr><td colspan="7" class="table-empty">No tickets found</td></tr>`;
    return;
  }

  el('ticketRows').innerHTML = tickets.map(t => `
    <tr class="table-row-link">
      <td>${t.work_order_id}</td>

      <td>
        <strong>${t.title}</strong><br>
        <span class="response-meta">${t.company_name || ''}</span>
      </td>

      <td>${t.priority}</td>

      <td>${t.technician_name || 'Unassigned'}</td>

      <td>
        <span class="${badgeClass(t.status)}">
          ${t.status}
        </span>
      </td>

      <td>${new Date(t.created_at).toLocaleString()}</td>

      <td>
        <a href="ticket-detail.html?id=${t.id}">View</a>
      </td>
    </tr>
  `).join('');
}

init();