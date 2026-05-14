document.addEventListener('DOMContentLoaded', async () => {
  if (!requireRole('client')) return;

  await ClientPortal.hydrateClientSession();
  ClientPortal.initPage({
    activeNav: 'requests',
    title: 'Ticket Detail',
    subtitle: 'Inspect the request and continue the support conversation.',
    breadcrumbs: ['Client Portal', 'My Requests', 'Ticket Detail']
  });

  const ticketId = new URLSearchParams(window.location.search).get('id');

  if (!ticketId) {
    document.getElementById('ticketDetail').innerHTML = '<div class="empty-state">Ticket ID is missing.</div>';
    document.getElementById('responsesList').innerHTML = '<div class="empty-state">No conversation available.</div>';
    return;
  }

  bindResponseForm(ticketId);

  await loadTicketDetail(ticketId);
  await loadResponses(ticketId);
});

async function loadTicketDetail(ticketId) {
  const ticket = await fetchTicket(ticketId);
  const detail = document.getElementById('ticketDetail');

  if (!ticket) {
    detail.innerHTML = '<div class="empty-state">Unable to load ticket details.</div>';
    return;
  }

  detail.innerHTML = `
    <div class="detail-grid">
      <div>
        <span class="context-label">Work Order</span>
        <strong>${ClientPortal.escapeHtml(ticket.work_order_id || '-')}</strong>
      </div>
      <div>
        <span class="context-label">Status</span>
        <strong><span class="badge ${statusClass(ticket.status)}">${ClientPortal.escapeHtml(ticket.status || '-')}</span></strong>
      </div>
      <div>
        <span class="context-label">Priority</span>
        <strong>${ClientPortal.escapeHtml(ticket.priority || '-')}</strong>
      </div>
      <div>
        <span class="context-label">Submitted</span>
        <strong>${formatDateTime(ticket.created_at)}</strong>
      </div>
    </div>

    <div class="detail-block">
      <span class="context-label">Title</span>
      <p>${ClientPortal.escapeHtml(ticket.title || '-')}</p>
    </div>

    <div class="detail-block">
      <span class="context-label">Description</span>
      <p>${ClientPortal.escapeHtml(ticket.description || 'No description provided.')}</p>
    </div>
  `;
}

async function loadResponses(ticketId) {
  const responses = await fetchResponses(ticketId);
  const list = document.getElementById('responsesList');

  if (!responses.length) {
    list.innerHTML = '<div class="empty-state">No responses yet.</div>';
    return;
  }

  list.innerHTML = responses.map((response) => `
    <article class="response-card">
      <div class="response-head">
        <strong>${ClientPortal.escapeHtml(response.author_name || 'Support')}</strong>
        <span class="response-role">${ClientPortal.escapeHtml(response.author_role || '')}</span>
      </div>
      <div class="response-meta">${formatDateTime(response.created_at)}</div>
      <p>${ClientPortal.escapeHtml(response.message || '')}</p>
    </article>
  `).join('');
}

function bindResponseForm(ticketId) {
  const form = document.getElementById('responseForm');
  const button = document.getElementById('responseSubmitBtn');
  const message = document.getElementById('responseMessage');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const text = document.getElementById('message').value.trim();

    if (!text) {
      setResponseMessage(message, 'Message is required.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending...';
    setResponseMessage(message, '');

    try {
      const result = await submitResponse(ticketId, text);

      if (!result?.success) {
        setResponseMessage(message, result?.message || 'Unable to send response.', 'error');
        return;
      }

      form.reset();
      setResponseMessage(message, 'Response sent successfully.', 'success');
      await loadResponses(ticketId);
    } finally {
      button.disabled = false;
      button.innerHTML = `${ClientPortal.icon('mail')}Send Response`;
    }
  });
}

function setResponseMessage(node, text, type = '') {
  node.textContent = text;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}
