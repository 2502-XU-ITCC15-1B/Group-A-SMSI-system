let ticketsUser = null;
let allTickets = [];
let filteredTickets = [];
let currentPage = 1;
const pageSize = 10;

document.addEventListener('DOMContentLoaded', async () => {
  ticketsUser = await Auth.requireRoleAsync('technician', 'head');
  if (!ticketsUser) return;

  TechnicianPortal.configureShell(ticketsUser, 'tickets');
  configurePageCopy();
  bindTicketEvents();
  await loadTicketsPage();
});

function configurePageCopy() {
  const isHead = TechnicianPortal.isHead(ticketsUser);
  document.getElementById('pageTitle').textContent = isHead ? 'Department Tickets' : 'My Tickets';
  document.getElementById('pageSubtitle').textContent = isHead
    ? 'Review, search, and open every ticket within your department scope.'
    : 'Review, search, and open the tickets currently assigned to you.';
}

function bindTicketEvents() {
  document.getElementById('refreshBtn').addEventListener('click', loadTicketsPage);
  document.getElementById('searchInput').addEventListener('input', applyTicketFilters);
  document.getElementById('statusFilter').addEventListener('change', applyTicketFilters);
  document.getElementById('priorityFilter').addEventListener('change', applyTicketFilters);
  document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));
}

async function loadTicketsPage() {
  setTicketsMessage('Loading tickets...');
  try {
    const tickets = await TechnicianPortal.fetchScopedTickets(ticketsUser);
    allTickets = Array.isArray(tickets) ? tickets : [];
    populateStatusFilter(allTickets);
    currentPage = 1;
    applyTicketFilters();
    setTicketsMessage(allTickets.length ? '' : 'No tickets found for this view.');
  } catch (_error) {
    allTickets = [];
    filteredTickets = [];
    populateStatusFilter([]);
    renderTicketPage();
    setTicketsMessage('Unable to load tickets.', 'error');
  }
}

function populateStatusFilter(tickets) {
  const statuses = [...new Set(tickets.map((ticket) => ticket.status).filter(Boolean))];
  const select = document.getElementById('statusFilter');
  const current = select.value;
  select.innerHTML = '<option value="">All statuses</option>' + statuses.map((status) => `
    <option value="${status}">${status}</option>
  `).join('');
  select.value = statuses.includes(current) ? current : '';
}

function applyTicketFilters() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const priority = document.getElementById('priorityFilter').value;

  filteredTickets = allTickets
    .filter((ticket) => !status || ticket.status === status)
    .filter((ticket) => !priority || ticket.priority === priority)
    .filter((ticket) => {
      if (!search) return true;
      return [
        ticket.work_order_id,
        ticket.title,
        ticket.company_name,
        ticket.status,
        ticket.priority,
        ticket.technician_name
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  renderTicketPage();
}

function renderTicketPage() {
  const start = (currentPage - 1) * pageSize;
  const rows = filteredTickets.slice(start, start + pageSize);
  const body = document.getElementById('ticketRows');

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="table-empty">No tickets match the current filters.</td></tr>';
  } else {
    body.innerHTML = rows.map((ticket) => `
      <tr>
        <td>${TechnicianPortal.escapeHtml(ticket.work_order_id || '-')}</td>
        <td>${TechnicianPortal.escapeHtml(ticket.title || '-')}</td>
        <td>${TechnicianPortal.escapeHtml(ticket.company_name || '-')}</td>
        <td>${TechnicianPortal.escapeHtml(ticket.priority || '-')}</td>
        <td><span class="badge ${statusClass(ticket.status)}">${TechnicianPortal.escapeHtml(ticket.status || '-')}</span></td>
        <td>${TechnicianPortal.escapeHtml(ticket.technician_name || 'Unassigned')}</td>
        <td>${formatDateTime(ticket.created_at)}</td>
        <td><a href="/technician/ticket-detail.html?id=${ticket.id}">View</a></td>
      </tr>
    `).join('');
  }

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  document.getElementById('paginationInfo').textContent = `${filteredTickets.length} result${filteredTickets.length === 1 ? '' : 's'} - page ${currentPage} of ${totalPages}`;
  document.getElementById('prevPageBtn').disabled = currentPage <= 1;
  document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
}

function changePage(direction) {
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const nextPage = currentPage + direction;
  if (nextPage < 1 || nextPage > totalPages) return;
  currentPage = nextPage;
  renderTicketPage();
}

function setTicketsMessage(message, type = '') {
  const node = document.getElementById('ticketsMessage');
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
