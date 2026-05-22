let currentUser = null;
let currentTicket = null;
let currentTicketId = null;

const ticketStatuses = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await Auth.requireRoleAsync('technician', 'head');
  if (!currentUser) return;

  currentTicketId = new URLSearchParams(window.location.search).get('id');
  if (!currentTicketId) {
    window.location.href = Auth.ticketListUrlFor(currentUser);
    return;
  }

  initializeShell();
  bindEvents();

  await refreshPage();
});

function initializeShell() {
  TechnicianPortal.configureShell(currentUser, 'tickets');
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = Auth.ticketListUrlFor(currentUser);
  });

  if (currentUser.role === 'head') {
    document.getElementById('assignBtn').classList.remove('is-hidden');
    document.getElementById('closeBtn').classList.remove('is-hidden');
  }
}

function bindEvents() {
  document.getElementById('updateStatusBtn').addEventListener('click', handleStatusUpdate);
  document.getElementById('sendResponseBtn').addEventListener('click', handleResponseSubmit);
  document.getElementById('assignBtn').addEventListener('click', openAssignModal);
  document.getElementById('closeBtn').addEventListener('click', handleCloseTicket);
  document.getElementById('assignCloseBtn').addEventListener('click', () => AppModals.close('assignModal'));
  document.getElementById('assignCancelBtn').addEventListener('click', () => AppModals.close('assignModal'));
  document.getElementById('assignSubmitBtn').addEventListener('click', submitAssignment);
}

async function refreshPage() {
  setPageMessage('Loading ticket...');

  const ticket = await fetchTicket(currentTicketId);
  if (!ticket) {
    setPageMessage('Unable to load ticket details.', 'error');
    document.getElementById('timeline').innerHTML = '<div class="empty-state">Ticket detail is unavailable.</div>';
    return;
  }

  currentTicket = ticket;
  renderTicket(ticket);

  await Promise.all([
    renderTimeline(),
    prepareStatusOptions(ticket.status)
  ]);

  setPageMessage('');
}

function renderTicket(ticket) {
  document.title = `${ticket.work_order_id} - Ticket Detail`;
  document.getElementById('breadcrumbTicket').textContent = ticket.work_order_id || 'Detail';
  document.getElementById('ticketTitle').textContent = ticket.title || 'Untitled Ticket';
  document.getElementById('ticketDescription').textContent = ticket.description || 'No description provided.';
  document.getElementById('ticketWorkOrder').textContent = ticket.work_order_id || '-';
  document.getElementById('ticketStatus').innerHTML = `<span class="badge ${statusClass(ticket.status)}">${escapeHtml(ticket.status || '-')}</span>`;
  document.getElementById('ticketPriority').textContent = ticket.priority || '-';
  document.getElementById('ticketCompany').textContent = ticket.company_name || '-';
  document.getElementById('ticketAssignee').textContent = ticket.technician_name || 'Unassigned';
  document.getElementById('ticketDepartment').textContent = ticket.department_name || 'Unassigned';
  document.getElementById('ticketCreated').textContent = formatDateTime(ticket.created_at);
  document.getElementById('ticketRequestor').textContent = ticket.requestor_name || '-';

  const closeBtn = document.getElementById('closeBtn');
  if (currentUser.role === 'head') {
    closeBtn.disabled = ticket.status !== 'Resolved';
  }
}

async function renderTimeline() {
  const [logs, responses] = await Promise.all([
    fetchTicketLogs(currentTicketId),
    fetchResponses(currentTicketId)
  ]);

  const items = [
    ...(Array.isArray(logs) ? logs.filter((l) => String(l.action || '').toUpperCase() !== 'RESPONSE_ADDED') : []).map((log) => ({
      type: 'log',
      timestamp: log.created_at,
      title: log.action,
      meta: log.user_name ? `${log.user_name} (${log.user_role})` : 'System',
      message: log.details || 'System activity recorded.',
      attachmentUrl: log.attachment_url || log.attachmentUrl || log.attachment || null,
      attachmentType: log.attachment_type || log.attachmentType || log.attachment_type || null
    })),
    ...responses.map((response) => ({
      type: response.internal_note ? 'internal' : 'response',
      timestamp: response.created_at,
      title: response.internal_note ? 'Internal Note' : 'Response',
      meta: `${response.author_name || 'Unknown'}${response.author_role ? ` (${response.author_role})` : ''}`,
      message: response.message || '',
      attachmentUrl: response.attachment_url || response.attachmentUrl || response.attachment || null,
      attachmentType: response.attachment_type || response.attachmentType || response.attachment_type || null
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const timeline = document.getElementById('timeline');

  if (!items.length) {
    timeline.innerHTML = '<div class="empty-state">No activity recorded for this ticket.</div>';
    return;
  }

  timeline.innerHTML = items.map((item) => `
    <article class="timeline-item timeline-item-${item.type}">
      <div class="timeline-item-header">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="response-meta">${formatDateTime(item.timestamp)}</span>
      </div>
      <div class="response-role">${escapeHtml(item.meta)}</div>
      <p class="response-message">${escapeHtml(item.message)}</p>

      ${item.attachmentUrl ? `
        ${renderAttachment(item.attachmentUrl)}
      ` : ''}
    </article>
  `).join('');
}

// Dedicated attachment renderer used by the timeline.
// Detects extension and returns either an image preview or a download link with label/icon.
function renderAttachment(fileUrl) {
  if (!fileUrl) return '';
  const built = buildAttachmentUrl(fileUrl);
  const ext = getAttachmentExtension(built);
  const fullUrl = escapeHtml(built);
  let fileName = 'attachment';
  try {
    const parsed = new URL(built, window.location.href);
    fileName = decodeURIComponent((parsed.pathname.split('/').pop() || 'attachment'));
  } catch (e) {
    fileName = decodeURIComponent((fileUrl.split('/').pop() || 'attachment'));
  }

  const label = '<p class="attachment-label">This user has sent an attachment, along with the ticket</p>';

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return `${label}<div class="timeline-attachment-container"><div class="timeline-attachment-wrap"><img class="timeline-attachment" src="${fullUrl}" alt="${escapeHtml(fileName)}"><p><a class="response-attachment" href="${fullUrl}" target="_blank" rel="noopener noreferrer">Open attachment</a></p></div></div>`;
  }

  // PDF / documents — show download link with filename
  return `${label}<div class="timeline-attachment-container"><div class="timeline-attachment-wrap"><p><a class="attachment-file-link" href="${fullUrl}" target="_blank" rel="noopener noreferrer">📎 Download attachment: ${escapeHtml(fileName)}</a></p></div></div>`;
}

// Authenticated download helper: perform bearer-authenticated fetch and save blob
async function authenticatedDownload(url, suggestedFilename) {
  try {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) {
      alert('You are not authenticated. Please sign in to download attachments.');
      return;
    }

    const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }, redirect: 'follow' });
    if (res.status === 401 || res.status === 403) {
      alert('Unauthorized to access this attachment.');
      return;
    }
    if (!res.ok) {
      console.error('Attachment download failed', res.status);
      alert('Failed to download attachment.');
      return;
    }
    const blob = await res.blob();
    let filename = suggestedFilename || '';
    const cd = res.headers.get('Content-Disposition') || '';
    const match = cd.match(/filename\*=UTF-8''([^;\n\r]+)|filename="?([^";]+)"?/i);
    if (!filename && match) filename = decodeURIComponent(match[1] || match[2] || 'attachment');
    if (!filename) {
      try { const u = new URL(url); filename = decodeURIComponent((u.pathname.split('/').pop() || 'attachment')); } catch (e) { filename = 'attachment'; }
    }
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = objectUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch (err) {
    console.error('authenticatedDownload error', err);
    alert('An error occurred while downloading the attachment.');
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.attachment-file-link');
  if (!el) return;
  const href = el.href;
  if (!href) return;
  e.preventDefault();
  const suggested = el.getAttribute('data-filename') || (href.split('/').pop() || 'attachment');
  authenticatedDownload(href, suggested);
});

// Intercept image open links and fetch with auth
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
      const img = win.document.createElement('img'); img.src = objectUrl; img.style.maxWidth = '100%'; img.style.height = 'auto'; win.document.body.appendChild(img);
    } else if (contentType.includes('pdf') || contentType === 'application/pdf') {
      const embed = win.document.createElement('embed'); embed.src = objectUrl; embed.type = 'application/pdf'; embed.style.width = '100%'; embed.style.height = '100vh'; win.document.body.appendChild(embed);
    } else {
      const obj = win.document.createElement('object'); obj.data = objectUrl; obj.type = contentType || 'application/octet-stream'; obj.style.width = '100%'; obj.style.height = '100vh'; win.document.body.appendChild(obj);
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

document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.response-attachment');
  if (!el) return;
  const href = el.href; if (!href) return; e.preventDefault(); authenticatedOpenImage(href);
});

function buildAttachmentUrl(url) {
  if (!url) return '';

  const apiBase = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '';
  let cleanedBase = apiBase ? apiBase.replace(/\/api\/?$/i, '') : '';
  if (!cleanedBase && window.LIVE_API) {
    cleanedBase = window.LIVE_API.replace(/\/api\/?$/i, '');
  }

  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      // If the URL explicitly points to localhost (legacy DB values), rewrite to configured backend base
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

async function prepareStatusOptions(currentStatus) {
  const select = document.getElementById('statusSelect');
  const allowed = [...ticketStatuses];

  select.innerHTML = allowed.map((status) => `
    <option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>
  `).join('');
}

async function handleStatusUpdate() {
  const button = document.getElementById('updateStatusBtn');
  const status = document.getElementById('statusSelect').value;

  if (!currentTicket || !status || status === currentTicket.status) {
    setPageMessage('Select a different status to update.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Updating...';
  setPageMessage('');

  try {
    const result = await updateTicketStatus(currentTicketId, status);

    if (!result?.success) {
      setPageMessage(result?.message || 'Unable to update ticket status.', 'error');
      return;
    }

    setPageMessage(result.message || 'Ticket status updated.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Update Status';
  }
}

async function handleResponseSubmit() {
  const button = document.getElementById('sendResponseBtn');
  const messageNode = document.getElementById('responseMessage');
  const messageElem = document.getElementById('responseText');
  const attachmentInput = document.getElementById('responseAttachment');
  const attachmentFile = attachmentInput?.files?.[0] || null;
  const rawValue = messageElem ? messageElem.value : null;

  let message = '';
  if (messageElem) {
    message = (messageElem.value || messageElem.textContent || '').trim();
  }
  
  const internalOnly = document.getElementById('internalNote').checked;

  if (!message) {
    console.warn('[handleResponseSubmit] message empty; element.value:', rawValue, 'textContent:', rawText);
    setMessage(messageNode, `Response message is required. (read: "${rawValue ?? ''}")`, 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';
  setMessage(messageNode, '');

  try {
    const result = await submitResponse(currentTicketId, message, internalOnly, attachmentFile);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to submit response.', 'error');
      return;
    }

    if (messageElem) messageElem.value = '';
    document.getElementById('internalNote').checked = false;
    if (attachmentInput) attachmentInput.value = '';
    setMessage(messageNode, result.message || 'Response submitted.', 'success');
    await renderTimeline();
  } finally {
    button.disabled = false;
    button.textContent = 'Send Response';
  }
}

async function openAssignModal() {
  if (currentUser.role !== 'head') return;

  const [technicians, departments] = await Promise.all([
    fetchTechnicians(),
    fetchDepartments()
  ]);

  const techSelect = document.getElementById('assignTechnicianSelect');
  const deptSelect = document.getElementById('assignDepartmentSelect');

  techSelect.innerHTML = '<option value="">Select technician</option>' + technicians.map((user) => `
    <option value="${user.id}" ${String(currentTicket?.technician_id || '') === String(user.id) ? 'selected' : ''}>
      ${escapeHtml(user.name)}${Number.isFinite(Number(user.active_tickets)) ? ` (${user.active_tickets} active)` : ''}
    </option>
  `).join('');

  deptSelect.innerHTML = '<option value="">Keep current department</option>' + departments.map((department) => `
    <option value="${department.id}" ${String(currentTicket?.department_id || '') === String(department.id) ? 'selected' : ''}>
      ${escapeHtml(department.name)}
    </option>
  `).join('');

  setMessage(document.getElementById('assignMessage'), '');
  AppModals.open('assignModal');
}

async function submitAssignment() {
  const button = document.getElementById('assignSubmitBtn');
  const technicianId = document.getElementById('assignTechnicianSelect').value;
  const departmentId = document.getElementById('assignDepartmentSelect').value;
  const messageNode = document.getElementById('assignMessage');

  if (!technicianId && !departmentId) {
    setMessage(messageNode, 'Select a technician or department for assignment.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Assigning...';
  setMessage(messageNode, '');

  try {
    const payload = {
      technician_id: technicianId ? Number(technicianId) : null,
      department_id: departmentId ? Number(departmentId) : null
    };
    const result = await assignTicket(currentTicketId, payload);

    if (!result?.success) {
      setMessage(messageNode, result?.message || 'Unable to assign ticket.', 'error');
      return;
    }

    AppModals.close('assignModal');
    setPageMessage(result.message || 'Ticket assigned.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Assign Ticket';
  }
}

async function handleCloseTicket() {
  if (currentUser.role !== 'head' || !currentTicket) return;

  if (currentTicket.status !== 'Resolved') {
    setPageMessage('Only resolved tickets can be closed.', 'error');
    return;
  }

  if (!window.confirm('Close this resolved ticket?')) return;

  const button = document.getElementById('closeBtn');
  button.disabled = true;
  button.textContent = 'Closing...';
  setPageMessage('');

  try {
    const result = await closeTicket(currentTicketId);

    if (!result?.success) {
      setPageMessage(result?.message || 'Unable to close ticket.', 'error');
      return;
    }

    setPageMessage(result.message || 'Ticket closed.', 'success');
    await refreshPage();
  } finally {
    button.disabled = false;
    button.textContent = 'Close Ticket';
  }
}

function setPageMessage(message, type = '') {
  setMessage(document.getElementById('pageMessage'), message, type);
}

function setMessage(node, message, type = '') {
  node.textContent = message;
  node.className = `form-msg${type ? ` ${type}` : ''}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]
  ));
}
