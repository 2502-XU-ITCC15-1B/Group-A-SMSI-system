let activityUser = null;
let activityItems = [];
let activityFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  activityUser = await Auth.requireRoleAsync('technician', 'head');
  if (!activityUser) return;

  TechnicianPortal.configureShell(activityUser, 'activity');
  configureActivityCopy();
  bindActivityEvents();
  await loadActivityPage();
});

function configureActivityCopy() {
  const isHead = TechnicianPortal.isHead(activityUser);
  document.getElementById('pageTitle').textContent = isHead ? 'Department Activity' : 'My Activity';
  document.getElementById('pageSubtitle').textContent = isHead
    ? 'Track department-wide ticket responses and system changes in one timeline.'
    : 'Track responses and ticket changes across the work currently assigned to you.';
}

function bindActivityEvents() {
  document.getElementById('refreshBtn').addEventListener('click', loadActivityPage);
  document.getElementById('searchInput').addEventListener('input', renderActivityTimeline);
  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((node) => node.classList.remove('active'));
      button.classList.add('active');
      activityFilter = button.dataset.filter;
      renderActivityTimeline();
    });
  });
}

async function loadActivityPage() {
  setActivityMessage('Loading activity...');
  try {
    const tickets = await TechnicianPortal.fetchScopedTickets(activityUser);
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const items = [];

    await Promise.all(safeTickets.map(async (ticket) => {
      try {
        const [logs, responses] = await Promise.all([
          fetchTicketLogs(ticket.id),
          fetchResponses(ticket.id)
        ]);

        logs.forEach((log) => {
          // Skip internal system logs that only track response IDs
          if (String(log.action || '').toUpperCase() === 'RESPONSE_ADDED') return;
          items.push({
            type: 'log',
            title: log.action || 'System activity',
            actor: log.user_name || 'System',
            message: log.details || 'System activity recorded.',
            created_at: log.created_at,
            work_order_id: ticket.work_order_id,
            ticket_title: ticket.title
          });
        });

        responses.forEach((response) => {
          items.push({
            type: response.internal_note ? 'internal' : 'response',
            title: response.internal_note ? 'Internal Note' : 'Response',
            actor: response.author_name || 'Unknown User',
            message: response.message || '',
            created_at: response.created_at,
            work_order_id: ticket.work_order_id,
            ticket_title: ticket.title
          });
        });
      } catch (_error) {
        // Ignore single-ticket activity failures so the rest of the timeline can still render.
      }
    }));

    activityItems = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderActivityTimeline();
    setActivityMessage(activityItems.length ? '' : 'No activity found for this view.');
  } catch (_error) {
    activityItems = [];
    renderActivityTimeline();
    setActivityMessage('Unable to load activity.', 'error');
  }
}

function renderActivityTimeline() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = activityItems.filter((item) => {
    if (activityFilter !== 'all' && item.type !== activityFilter) return false;
    if (!search) return true;
    return [
      item.title,
      item.actor,
      item.message,
      item.work_order_id,
      item.ticket_title
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  const container = document.getElementById('timelineContainer');

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">No activity matches the current filters.</div>';
    return;
  }

  container.innerHTML = filtered.map((item) => `
    <article class="timeline-item timeline-item-${item.type}">
      <div class="timeline-item-header">
        <strong>${TechnicianPortal.escapeHtml(item.title)}</strong>
        <span class="response-meta">${formatDateTime(item.created_at)}</span>
      </div>
      <div class="response-role">${TechnicianPortal.escapeHtml(item.actor)}</div>
      <p>${TechnicianPortal.escapeHtml(item.message)}</p>
      <div class="response-meta">
        Ticket ${TechnicianPortal.escapeHtml(item.work_order_id || '-')} - ${TechnicianPortal.escapeHtml(item.ticket_title || '-')}
      </div>
    </article>
  `).join('');
}

function setActivityMessage(message, type = '') {
  const node = document.getElementById('activityMessage');
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
