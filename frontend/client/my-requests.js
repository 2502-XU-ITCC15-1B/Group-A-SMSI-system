let tickets = [];
let filteredTickets = [];
let currentPage = 1;
const perPage = 8;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireRole('client')) return;

  await ClientPortal.hydrateClientSession();
  ClientPortal.initPage({
    activeNav: 'requests',
    title: 'My Requests',
    subtitle: 'Review all submitted tickets, filter by status, and open a request for full detail.',
    breadcrumbs: ['Client Portal', 'My Requests'],
    actionsHtml: '<button class="btn" type="button" data-open-ticket-modal>New Ticket</button>'
  });

  ClientPortal.ensureTicketModal({
    onCreated: async () => {
      await loadTickets();
    }
  });

  bindFilters();
  bindPagination();

  await loadTickets();
});

async function loadTickets() {
  tickets = await fetchTickets();
  applyFilters();
}

function bindFilters() {
  document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
  document.getElementById('priorityFilter')?.addEventListener('change', applyFilters);
}

function bindPagination() {
  document.getElementById('prevBtn')?.addEventListener('click', () => changePage(-1));
  document.getElementById('nextBtn')?.addEventListener('click', () => changePage(1));
}

function applyFilters() {
  const status = document.getElementById('statusFilter')?.value || '';
  const priority = document.getElementById('priorityFilter')?.value || '';

  filteredTickets = tickets.filter((ticket) => {
    const statusMatch = !status || ticket.status === status;
    const priorityMatch = !priority || ticket.priority === priority;
    return statusMatch && priorityMatch;
  });

  currentPage = 1;
  renderTable();
}

function changePage(direction) {
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / perPage));
  const nextPage = currentPage + direction;

  if (nextPage < 1 || nextPage > totalPages) return;

  currentPage = nextPage;
  renderTable();
}

function renderTable() {
  const body = document.getElementById('requestsTableBody');
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / perPage));
  const start = (currentPage - 1) * perPage;
  const items = filteredTickets.slice(start, start + perPage);

  if (!items.length) {
    body.innerHTML = '<tr><td colspan="5" class="table-empty">No requests match the selected filters.</td></tr>';
  } else {
    body.innerHTML = items.map((ticket) => `
      <tr class="table-row-link" data-ticket-id="${ticket.id}">
        <td>${ClientPortal.escapeHtml(ticket.work_order_id || '-')}</td>
        <td>${ClientPortal.escapeHtml(ticket.title || '-')}</td>
        <td><span class="badge ${statusClass(ticket.status)}">${ClientPortal.escapeHtml(ticket.status || '-')}</span></td>
        <td>${ClientPortal.escapeHtml(ticket.priority || '-')}</td>
        <td>${formatDate(ticket.created_at)}</td>
      </tr>
    `).join('');
  }

  body.querySelectorAll('[data-ticket-id]').forEach((row) => {
    row.addEventListener('click', () => {
      window.location.href = `/client/ticket-detail.html?id=${row.dataset.ticketId}`;
    });
  });

  document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
  document.getElementById('prevBtn').disabled = currentPage === 1;
  document.getElementById('nextBtn').disabled = currentPage === totalPages || !filteredTickets.length;
}
