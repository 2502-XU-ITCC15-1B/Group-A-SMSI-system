document.addEventListener('DOMContentLoaded', async () => {
  await ClientPortal.hydrateClientSession();
  if (!requireRole('client')) return;
  ClientPortal.initPage({
    activeNav: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Track your support activity and create new requests.',
    breadcrumbs: ['Client Portal', 'Dashboard'],
    actionsHtml: `<button class="btn" type="button" data-open-ticket-modal>${ClientPortal.icon('plus')}New Ticket</button>`
  });

  ClientPortal.ensureTicketModal({
    onCreated: async () => {
      await loadDashboard();
    }
  });

  if (new URLSearchParams(window.location.search).get('newTicket') === '1') {
    ClientPortal.openTicketModal();
  }

  await loadDashboard();
});

async function loadDashboard() {
  const tickets = await fetchMyTickets();

  renderSummary(tickets);
  renderRecentTickets(tickets);
}

function renderSummary(tickets) {
  const resolvedStatuses = new Set(['Resolved', 'Closed']);
  const openCount = tickets.filter((ticket) => !resolvedStatuses.has(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => resolvedStatuses.has(ticket.status)).length;

  document.getElementById('metricTotal').textContent = String(tickets.length);
  document.getElementById('metricOpen').textContent = String(openCount);
  document.getElementById('metricResolved').textContent = String(resolvedCount);
}

function renderRecentTickets(tickets) {
  const body = document.getElementById('recentTicketsBody');
  const rows = tickets.slice(0, 5);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5" class="table-empty">No tickets submitted yet.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((ticket) => `
    <tr class="table-row-link" data-ticket-id="${ticket.id}">
      <td>${ClientPortal.escapeHtml(ticket.work_order_id || '-')}</td>
      <td>${ClientPortal.escapeHtml(ticket.title || '-')}</td>
      <td>${ClientPortal.escapeHtml(ticket.priority || '-')}</td>
      <td><span class="badge ${statusClass(ticket.status)}">${ClientPortal.escapeHtml(ticket.status || '-')}</span></td>
      <td>${formatDate(ticket.created_at)}</td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-ticket-id]').forEach((row) => {
    row.addEventListener('click', () => {
      window.location.href = `/client/ticket-detail.html?id=${row.dataset.ticketId}`;
    });
  });
}
