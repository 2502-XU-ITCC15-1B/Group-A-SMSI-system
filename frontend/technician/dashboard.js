let dashboardUser = null;
let dashboardTickets = [];

document.addEventListener('DOMContentLoaded', async () => {
  dashboardUser = await Auth.requireRoleAsync('technician', 'head');
  if (!dashboardUser) return;

  TechnicianPortal.configureShell(dashboardUser, 'dashboard');
  configureDashboardCopy();
  bindDashboardEvents();
  await loadDashboard();
});

function configureDashboardCopy() {
  const isHead = TechnicianPortal.isHead(dashboardUser);
  document.getElementById('pageTitle').textContent = isHead ? 'Department Dashboard' : 'My Dashboard';
  document.getElementById('pageSubtitle').textContent = isHead
    ? 'Monitor department ticket flow, assignment gaps, and recent activity.'
    : 'Track the tickets currently assigned to you and their latest status.';
  document.getElementById('metricThirdLabel').textContent = isHead ? 'Unassigned' : 'Resolved';
  document.getElementById('recentTitle').textContent = isHead ? 'Recent Department Tickets' : 'Recent Assigned Tickets';
  document.getElementById('recentSubtitle').textContent = isHead
    ? 'Latest tickets visible within your department scope.'
    : 'Latest tickets in your personal workload.';
}

function bindDashboardEvents() {
  document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
  document.getElementById('dashboardSearch').addEventListener('input', renderDashboardTable);
}

async function loadDashboard() {
  setDashboardMessage('Loading tickets...');
  try {
    const tickets = await TechnicianPortal.fetchScopedTickets(dashboardUser);
    dashboardTickets = Array.isArray(tickets) ? tickets : [];
    renderDashboardMetrics();
    renderDashboardTable();
    setDashboardMessage(dashboardTickets.length ? '' : 'No tickets found for this view.');
  } catch (_error) {
    dashboardTickets = [];
    renderDashboardMetrics();
    renderDashboardTable();
    setDashboardMessage('Unable to load dashboard tickets.', 'error');
  }
}

function renderDashboardMetrics() {
  const open = dashboardTickets.filter((ticket) => ticket.status === 'Open').length;
  const progress = dashboardTickets.filter((ticket) => ['Assigned', 'In Progress'].includes(ticket.status)).length;
  const resolved = dashboardTickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status)).length;
  const unassigned = dashboardTickets.filter((ticket) => !ticket.technician_id).length;

  document.getElementById('metricOpen').textContent = open;
  document.getElementById('metricProgress').textContent = progress;
  document.getElementById('metricThird').textContent = TechnicianPortal.isHead(dashboardUser) ? unassigned : resolved;
  document.getElementById('metricTotal').textContent = dashboardTickets.length;
}

function renderDashboardTable() {
  const search = document.getElementById('dashboardSearch').value.trim().toLowerCase();
  const rows = dashboardTickets
    .filter((ticket) => {
      if (!search) return true;
      return [ticket.work_order_id, ticket.title, ticket.company_name, ticket.priority, ticket.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const body = document.getElementById('recentTicketRows');

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="table-empty">No tickets match the current search.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((ticket) => `
    <tr>
      <td>${TechnicianPortal.escapeHtml(ticket.work_order_id || '-')}</td>
      <td>${TechnicianPortal.escapeHtml(ticket.title || '-')}</td>
      <td>${TechnicianPortal.escapeHtml(ticket.company_name || '-')}</td>
      <td>${TechnicianPortal.escapeHtml(ticket.priority || '-')}</td>
      <td><span class="badge ${statusClass(ticket.status)}">${TechnicianPortal.escapeHtml(ticket.status || '-')}</span></td>
      <td>${formatDateTime(ticket.created_at)}</td>
      <td><a href="/technician/ticket-detail.html?id=${ticket.id}">View</a></td>
    </tr>
  `).join('');
}

function setDashboardMessage(message, type = '') {
  const node = document.getElementById('dashboardMessage');
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
