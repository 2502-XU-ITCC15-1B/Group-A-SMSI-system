document.addEventListener('DOMContentLoaded', async () => {
  await ClientPortal.hydrateClientSession();
  if (!requireRole('client')) return;
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
    <article class="response-card" data-response-id="${response.id}">
      <div class="response-head">
        <strong>${ClientPortal.escapeHtml(response.author_name || 'Support')}</strong>
        <span class="response-role">${ClientPortal.escapeHtml(response.author_role || '')}</span>
      </div>
      <div class="response-meta">${formatDateTime(response.created_at)}</div>
      <div class="response-body">
        <p>${ClientPortal.escapeHtml(response.message || '')}</p>
        ${response.attachment_url ? renderAttachmentHtml(response.attachment_url, response.attachment_type) : ''}
      </div>
    </article>
  `).join('');
}

function buildAttachmentUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  } catch (e) {}

  const apiBase = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '';
  if (apiBase) {
    const cleaned = apiBase.replace(/\/api\/?$/i, '');
    return `${cleaned}${url}`;
  }

  return `${window.location.origin}${url}`;
}

function getAttachmentExtension(url) {
  try {
    const parsed = new URL(url, window.location.href);
    url = parsed.pathname;
  } catch (e) {
    // ignore malformed URL
  }

  const parts = url.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isImageAttachment(url) {
  const ext = getAttachmentExtension(url);
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
}

function renderAttachmentHtml(url, attachmentType) {
  const fullUrl = ClientPortal.escapeHtml(buildAttachmentUrl(url));
  const fileName = decodeURIComponent((url.split('/').pop() || 'attachment'));
  const label = '<p class="attachment-label">This user has sent an attachment, along with the ticket</p>';

  if (attachmentType === 'image' || (attachmentType == null && isImageAttachment(url))) {
    return `${label}<div class="timeline-attachment-wrap"><img class="timeline-attachment" src="${fullUrl}" alt="attachment"><p><a class="response-attachment" href="${fullUrl}" target="_blank" rel="noopener">Open attachment</a></p></div>`;
  }

  return `${label}<div class="timeline-attachment-wrap"><p><a class="attachment-file-link" href="${fullUrl}" target="_blank" rel="noopener">Download attachment: ${ClientPortal.escapeHtml(fileName)}</a></p></div>`;
}

function bindResponseForm(ticketId) {
  const form = document.getElementById('responseForm');
  const button = document.getElementById('responseSubmitBtn');
  const message = document.getElementById('responseMessage');

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const text = document.getElementById('message').value.trim();
    const attachmentInput = document.getElementById('responseAttachment');
    const attachmentFile = attachmentInput?.files?.[0] || null;

    if (!text) {
      setResponseMessage(message, 'Message is required.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Sending...';
    setResponseMessage(message, '');

    try {
      const result = await submitResponse(ticketId, text, false, attachmentFile);

      if (!result?.success) {
        setResponseMessage(message, result?.message || 'Unable to send response.', 'error');
        return;
      }

      form.reset();
      if (attachmentInput) attachmentInput.value = '';
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
