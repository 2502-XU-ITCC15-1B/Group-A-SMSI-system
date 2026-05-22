document.addEventListener('DOMContentLoaded', async () => {
  await ClientPortal.hydrateClientSession();
  if (!(await requireRole('client'))) return;
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

  const apiBaseCandidate = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || window.LIVE_API || '';
  const cleanedBase = apiBaseCandidate ? apiBaseCandidate.replace(/\/api\/?$/i, '').replace(/\/$/, '') : '';

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // If the URL explicitly points to localhost (from older DB values), replace host with configured backend base
      const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      if (isLocalHost && cleanedBase) {
        return `${cleanedBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url) || url.startsWith('//')) {
        return parsed.href;
      }
      if (cleanedBase && parsed.pathname.startsWith('/uploads/')) {
        return `${cleanedBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
      return parsed.href;
    }
  } catch (e) {
    // ignore malformed URL
  }

  if (cleanedBase) {
    return `${cleanedBase}${url.startsWith('/') ? url : `/${url}`}`;
  }

  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
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
  // Build absolute URL by combining configured backend base with the relative path
  const apiBase = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '';
  let backendBase = apiBase ? apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') : '';
  if (!backendBase && window.LIVE_API) {
    backendBase = window.LIVE_API.replace(/\/api\/?$/i, '');
  }
  const fullLink = /^https?:\/\//i.test(url) ? url : `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  const fullUrl = ClientPortal.escapeHtml(fullLink);
  const fileName = decodeURIComponent((url.split('/').pop() || 'attachment'));
  const label = '<p class="attachment-label">This user has sent an attachment, along with the ticket</p>';

    if (attachmentType === 'image' || (attachmentType == null && isImageAttachment(url))) {
    return `${label}<div class="timeline-attachment-wrap"><img class="timeline-attachment" src="${fullUrl}" alt="attachment"><p><a class="response-attachment" href="${fullUrl}" target="_blank" rel="noopener noreferrer">Open attachment</a></p></div>`;
  }

  return `${label}<div class="timeline-attachment-wrap"><p><a class="attachment-file-link" href="${fullUrl}" target="_blank" rel="noopener noreferrer">Download attachment: ${ClientPortal.escapeHtml(fileName)}</a></p></div>`;
}

// Authenticated download helper: fetches using stored Bearer token, converts to blob, and triggers a clean download
async function authenticatedDownload(url, suggestedFilename) {
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) {
      alert('You are not authenticated. Please sign in to download attachments.');
      return;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      // do not include credentials by default; token is sufficient
      redirect: 'follow'
    });

    if (res.status === 401 || res.status === 403) {
      alert('Unauthorized to access this attachment. Please refresh your session.');
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Attachment download failed', res.status, text);
      alert('Failed to download attachment.');
      return;
    }

    const blob = await res.blob();

    // Try to derive filename from Content-Disposition header if not provided
    let filename = suggestedFilename || '';
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename\*=UTF-8''([^;\n\r]+)|filename="?([^";]+)"?/i);
    if (!filename && match) {
      filename = decodeURIComponent(match[1] || match[2] || 'attachment');
    }
    if (!filename) {
      try {
        const u = new URL(url);
        filename = decodeURIComponent((u.pathname.split('/').pop() || 'attachment'));
      } catch (e) {
        filename = 'attachment';
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    // Append to DOM to make click() work in all browsers
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after a short delay to ensure download started
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

  } catch (err) {
    console.error('authenticatedDownload error', err);
    alert('An error occurred while downloading the attachment.');
  }
}

// Global click handler to intercept attachment links rendered above and use authenticatedDownload
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.attachment-file-link');
  if (!el) return;
  // If the link has an href to the backend uploads, intercept and download with auth
  const href = el.href;
  if (!href) return;
  e.preventDefault();
  const suggested = el.getAttribute('data-filename') || (href.split('/').pop() || 'attachment');
  authenticatedDownload(href, suggested);
});

// Authenticated image opener: fetches image with Bearer token and opens in new window
async function authenticatedOpenImage(url) {
  const win = window.open('about:blank');
  if (!win) {
    alert('Unable to open attachment in a new window. Please allow popups and try again.');
    return;
  }
  win.document.write('<!DOCTYPE html><html><head><title>Attachment</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><p>Loading attachment...</p></body></html>');
  win.document.close();

  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) {
      win.document.body.innerHTML = '<p style="padding:1rem;">You are not authenticated. Please sign in to view attachments.</p>';
      alert('You are not authenticated. Please sign in to view attachments.');
      return;
    }

    const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }, redirect: 'follow' });
    if (res.status === 401 || res.status === 403) {
      win.document.body.innerHTML = '<p style="padding:1rem;">Unauthorized to access this attachment.</p>';
      alert('Unauthorized to access this attachment.');
      return;
    }
    if (!res.ok) {
      console.error('Image fetch failed', res.status);
      win.document.body.innerHTML = `<p style="padding:1rem;">Failed to load attachment. (${res.status})</p>`;
      alert('Failed to load attachment.');
      return;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
    win.document.body.style.margin = '0';
    win.document.body.innerHTML = '';

    if (contentType.startsWith('image/')) {
      const img = win.document.createElement('img');
      img.src = objectUrl;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.alt = '';
      win.document.body.appendChild(img);
    } else if (contentType.includes('pdf') || contentType === 'application/pdf') {
      const embed = win.document.createElement('embed');
      embed.src = objectUrl;
      embed.type = 'application/pdf';
      embed.style.width = '100%';
      embed.style.height = '100vh';
      win.document.body.appendChild(embed);
    } else {
      const obj = win.document.createElement('object');
      obj.data = objectUrl;
      obj.type = contentType || 'application/octet-stream';
      obj.style.width = '100%';
      obj.style.height = '100vh';
      win.document.body.appendChild(obj);
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (err) {
    console.error('authenticatedOpenImage error', err);
    if (!win.closed) {
      win.document.body.innerHTML = '<p style="padding:1rem;">An error occurred while opening the attachment.</p>';
    }
    alert('An error occurred while opening the image.');
  }
}

// Intercept clicks on image open links
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.response-attachment');
  if (!el) return;
  const href = el.href;
  if (!href) return;
  e.preventDefault();
  authenticatedOpenImage(href);
});

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
