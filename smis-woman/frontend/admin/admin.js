const AdminPortal = (() => {
  const PAGE_META = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Monitor ticket volume, operational health, and recent system activity.' },
    tickets: { title: 'Ticket Management', subtitle: 'Review, filter, assign, and close tickets across the whole service desk.' },
    users: { title: 'User Management', subtitle: 'Maintain administrator, technician, head, and client access.' },
    companies: { title: 'Company Directory', subtitle: 'Maintain client organizations and their service-contact records.' },
    departments: { title: 'Departments', subtitle: 'Maintain operational departments and assign their managers.' },
    reports: { title: 'Reports', subtitle: 'Review ticket metrics, queue composition, and service distribution.' },
    messages: { title: 'Messages', subtitle: 'Review user inbox threads and reply directly to client concerns.' },
    activity: { title: 'Activity Log', subtitle: 'Inspect recent system actions and operator audit history.' },
    profile: { title: 'Profile', subtitle: 'Update your administrator profile and password.' }
  };

  const PAGE_SIZE = 10;
  const state = {
    user: null,
    page: null,
    tickets: [],
    users: [],
    companies: [],
    departments: [],
    technicians: [],
    heads: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function getAttachmentExtension(url) {
    try {
      const parsed = new URL(url, window.location.href);
      url = parsed.pathname;
    } catch (e) {
      // ignore malformed URL
    }
    const parts = String(url || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function isImageAttachment(url) {
    const ext = getAttachmentExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
  }

  function renderAttachmentHtml(url, attachmentType) {
    if (!url) return '';
    if (!url) return '';
    // Build absolute URL by combining configured backend base with the relative path
    const apiBase = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '';
    let backendBase = apiBase ? apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') : '';
    if (!backendBase && window.LIVE_API) {
      backendBase = window.LIVE_API.replace(/\/api\/?$/i, '');
    }
    let fullLink = '';
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        const isLocalHost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
        if (isLocalHost && backendBase) {
          fullLink = `${backendBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } else {
          fullLink = parsed.href;
        }
      }
    } catch (e) {
      // not an absolute url
    }
    if (!fullLink) fullLink = `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
    const fullUrl = escapeHtml(fullLink);
    const fileName = decodeURIComponent(String(url).split('/').pop() || 'attachment');
    const label = '<p class="attachment-label">This response includes a file attachment</p>';

    if (attachmentType === 'image' || (attachmentType == null && isImageAttachment(url))) {
      return `${label}<div class="timeline-attachment-wrap"><img class="timeline-attachment" src="${fullUrl}" alt="${escapeHtml(fileName)}"><p><a class="response-attachment" href="${fullUrl}" target="_blank" rel="noopener noreferrer">Open image attachment</a></p></div>`;
    }

    return `${label}<div class="timeline-attachment-wrap"><p><a class="attachment-file-link" href="${fullUrl}" target="_blank" rel="noopener noreferrer">📎 Download attachment: ${escapeHtml(fileName)}</a></p></div>`;
  }

  // Authenticated download helper for admin shell
  async function authenticatedDownload(url, suggestedFilename) {
    try {
      const token = typeof getToken === 'function' ? getToken() : null;
      if (!token) { alert('You are not authenticated. Please sign in to download attachments.'); return; }
      const res = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }, redirect: 'follow' });
      if (res.status === 401 || res.status === 403) { alert('Unauthorized to access this attachment.'); return; }
      if (!res.ok) { console.error('Attachment download failed', res.status); alert('Failed to download attachment.'); return; }
      const blob = await res.blob();
      let filename = suggestedFilename || '';
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename\*=UTF-8''([^;\n\r]+)|filename="?([^";]+)"?/i);
      if (!filename && match) filename = decodeURIComponent(match[1] || match[2] || 'attachment');
      if (!filename) { try { const u = new URL(url); filename = decodeURIComponent((u.pathname.split('/').pop() || 'attachment')); } catch (e) { filename = 'attachment'; } }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objectUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) { console.error('authenticatedDownload error', err); alert('An error occurred while downloading the attachment.'); }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.attachment-file-link');
    if (!el) return;
    const href = el.href; if (!href) return; e.preventDefault();
    const suggested = el.getAttribute('data-filename') || (href.split('/').pop() || 'attachment');
    authenticatedDownload(href, suggested);
  });

  // Intercept image open links and fetch with auth (smis-woman admin)
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.response-attachment');
    if (!el) return;
    const href = el.href; if (!href) return; e.preventDefault();
    (async function () {
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
        const res = await fetch(href, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }, redirect: 'follow' });
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
        if (contentType.startsWith('image/')) { const img = win.document.createElement('img'); img.src = objectUrl; img.style.maxWidth = '100%'; img.style.height = 'auto'; win.document.body.appendChild(img); }
        else if (contentType.includes('pdf') || contentType === 'application/pdf') { const embed = win.document.createElement('embed'); embed.src = objectUrl; embed.type = 'application/pdf'; embed.style.width = '100%'; embed.style.height = '100vh'; win.document.body.appendChild(embed); }
        else { const obj = win.document.createElement('object'); obj.data = objectUrl; obj.type = contentType || 'application/octet-stream'; obj.style.width = '100%'; obj.style.height = '100vh'; win.document.body.appendChild(obj); }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } catch (err) {
        console.error('response-attachment handler error', err);
        if (!win.closed) { win.document.body.innerHTML = '<p style="padding:1rem;">An error occurred while opening the attachment.</p>'; }
        alert('An error occurred while opening the image.');
      }
    })();
  });

  function icon(id, className = 'ui-icon') {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="${className}" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  async function loadIconSprite() {
    if (document.getElementById('icon-sprite')) return;

    const response = await fetch('/_icons.html').catch(() => fetch('../_icons.html'));
    if (!response || !response.ok) {
      throw new Error('Unable to load icon sprite.');
    }

    const markup = await response.text();
    document.body.insertAdjacentHTML('afterbegin', markup);
  }

  async function requireAdmin() {
    if (!getToken()) {
      window.location.href = '/login.html';
      return null;
    }

    const user = await getMe();
    const normalizedRole = String(user?.role || '').trim().toLowerCase();
    const allowedRoles = ['admin'];

    if (!user || !allowedRoles.includes(normalizedRole)) {
      logout();
      return null;
    }

    saveUserSession(user);
    state.user = user;
    return user;
  }

  function layoutShell(pageKey) {
    const meta = PAGE_META[pageKey];
    return `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <img src="/assets/logo.png" alt="SMSi">
            <div>
              <strong>SMSi</strong>
              <span>admin portal</span>
            </div>
          </div>

          <nav>
            ${navLink('dashboard', 'Dashboard', 'dashboard')}
            ${navLink('tickets', 'Tickets', 'ticket')}
            ${navLink('users', 'Users', 'users')}
            ${navLink('companies', 'Companies', 'building')}
            ${navLink('departments', 'Departments', 'dept')}
            ${navLink('reports', 'Reports', 'report')}
            ${navLink('messages', 'Messages', 'mail')}
            ${navLink('activity', 'Activity Log', 'log')}
            ${navLink('profile', 'Profile', 'settings')}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user-label">Signed in as</div>
            <div class="sidebar-user">${escapeHtml(state.user?.name || 'Administrator')}</div>
            <div class="sidebar-company">${escapeHtml(state.user?.email || '')}</div>
            <button class="btn secondary sidebar-logout" id="adminLogoutBtn" type="button">${icon('logout')}Logout</button>
          </div>
        </aside>

        <div class="main">
          <header class="topbar">
            <div class="topbar-meta">
              <nav class="breadcrumbs">
                <span class="crumb">Admin Portal</span>
                <span class="crumb current">${escapeHtml(meta.title)}</span>
              </nav>
              <div>
                <h1 class="page-title">${escapeHtml(meta.title)}</h1>
                <p class="page-subtitle">${escapeHtml(meta.subtitle)}</p>
              </div>
            </div>

            <div class="topbar-actions">
              <button class="btn secondary icon-only" id="adminTopbarBell" type="button" aria-label="Notifications">${icon('bell')}</button>
              ${renderAvatarHtml(state.user)}
            </div>
          </header>

          <main class="content stack" id="adminContent"></main>
        </div>
      </div>
    `;
  }

  function navLink(pageKey, label, iconId) {
    const active = state.page === pageKey ? ' active' : '';
    return `<a class="nav-item${active}" href="/admin/${pageKey}.html">${icon(iconId)}<span>${escapeHtml(label)}</span></a>`;
  }

  function avatarInitials(name) {
    return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  function getBackendBase() {
    const apiBaseCandidate = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || window.LIVE_API || '';
    const cleanedBase = apiBaseCandidate ? apiBaseCandidate.replace(/\/api\/?$/i, '').replace(/\/$/, '') : '';
    return cleanedBase || window.location.origin;
  }

  function renderAvatarHtml(user) {
    if (user && user.profile_picture) {
      const backendBase = getBackendBase();
      const src = `${backendBase}${user.profile_picture.startsWith('/') ? '' : '/'}${user.profile_picture}`;
      return `<img class="admin-avatar-img" src="${escapeHtml(src)}" alt="${escapeHtml(user.name || 'avatar')}" title="${escapeHtml(user.name || '')}">`;
    }
    return `<div class="admin-avatar" title="${escapeHtml(user?.name || 'Administrator')}">${avatarInitials(user?.name || 'Admin')}</div>`;
  }

  function renderPageShell(pageKey, bodyMarkup) {
    state.page = pageKey;
    document.body.innerHTML = layoutShell(pageKey);
    $('adminContent').innerHTML = bodyMarkup;
    const logoutButton = $('adminLogoutBtn') || document.querySelector('.sidebar-logout');
    if (logoutButton) {
      logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        window.logout();
      });
    }
  }

  function statusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    let cls = 'closed';

    if (normalized === 'open') cls = 'open';
    else if (normalized === 'assigned' || normalized === 'in progress') cls = 'progress';
    else if (normalized === 'resolved' || normalized === 'active') cls = 'resolved';
    else if (normalized === 'closed' || normalized === 'inactive') cls = 'closed';

    return `<span class="badge ${cls}">${escapeHtml(status || '-')}</span>`;
  }

  function roleBadge(role) {
    return `<span class="role-badge role-${escapeHtml(String(role || '').toLowerCase())}">${escapeHtml(role || '-')}</span>`;
  }

  function formatShortDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTimeLocal(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  }

  function formatRelative(value) {
    if (!value) return '-';
    const ms = Date.now() - new Date(value).getTime();
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  function setInlineMessage(node, text, type = '') {
    node.textContent = text;
    node.className = `form-msg${type ? ` ${type}` : ''}`;
  }

  function notify(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }


  const Modal = {
    ensureRoot() {
      if ($('adminModalRoot')) return;
      const root = document.createElement('div');
      root.id = 'adminModalRoot';
      root.className = 'modal';
      root.innerHTML = `
        <div class="modal-panel">
          <div class="modal-head">
            <div>
              <h2 id="adminModalTitle"></h2>
              <p id="adminModalSubtitle"></p>
            </div>
            <button class="modal-close" id="adminModalClose" type="button" aria-label="Close">${icon('close')}</button>
          </div>
          <div class="modal-body" id="adminModalBody"></div>
        </div>
      `;
      document.body.appendChild(root);
      root.addEventListener('click', (event) => {
        if (event.target === root) Modal.close();
      });
      $('adminModalClose').addEventListener('click', () => Modal.close());
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') Modal.close();
      });
    },
    open({ title, subtitle = '', body }) {
      Modal.ensureRoot();
      $('adminModalTitle').textContent = title;
      $('adminModalSubtitle').textContent = subtitle;
      $('adminModalBody').innerHTML = body;
      $('adminModalRoot').classList.add('open');
    },
    close() {
      $('adminModalRoot')?.classList.remove('open');
    }
  };

  function renderPagination(container, totalItems, currentPage, onSelect) {
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addButton = (label, disabled, page) => {
      const button = document.createElement('button');
      button.className = `btn secondary pagination-button${page === currentPage ? ' active-page' : ''}`;
      button.type = 'button';
      button.disabled = disabled;
      button.textContent = label;
      if (!disabled) button.addEventListener('click', () => onSelect(page));
      container.appendChild(button);
    };

    addButton('Prev', currentPage === 1, currentPage - 1);
    for (let page = 1; page <= totalPages; page += 1) {
      if (page > 5 && page !== totalPages) continue;
      addButton(String(page), false, page);
    }
    addButton('Next', currentPage === totalPages, currentPage + 1);
  }

  function tableEmptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="table-empty">${escapeHtml(message)}</td></tr>`;
  }

  function pageSlice(items, page) {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }

  async function boot(pageKey) {
    await loadIconSprite();
    const user = await requireAdmin();
    if (!user) return;

    if (!PAGE_META[pageKey]) throw new Error(`Unknown admin page: ${pageKey}`);

    const initializer = PAGE_INITIALIZERS[pageKey];
    if (!initializer) throw new Error(`No initializer for admin page: ${pageKey}`);
    await initializer();
  }

  async function initDashboard() {
    renderPageShell('dashboard', `
      <section class="grid-4">
        <article class="card metric-card"><span class="metric-label">Total Tickets</span><strong class="metric-value" id="dashboardTotalTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Open Tickets</span><strong class="metric-value" id="dashboardOpenTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">In Progress</span><strong class="metric-value" id="dashboardProgressTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Resolved / Closed</span><strong class="metric-value" id="dashboardResolvedTickets">--</strong></article>
      </section>

      <section class="admin-two-column">
        <section class="card stack">
          <div class="section-head">
            <div>
              <h2 class="section-title">Recent Tickets</h2>
              <p class="section-subtitle">Latest requests across every company and department.</p>
            </div>
            <a class="btn secondary" href="/admin/tickets.html">View Tickets</a>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Work Order</th><th>Title</th><th>Company</th><th>Status</th><th>Priority</th><th>Created</th></tr>
              </thead>
              <tbody id="dashboardRecentTickets"></tbody>
            </table>
          </div>
        </section>

        <!-- System Activity removed from dashboard center; available via Activity Log link -->
      </section>
    `);

    const [dashboard, tickets, departments] = await Promise.all([
      apiRequest('/admin/dashboard'),
      fetchTickets(),
      fetchDepartments()
    ]);

    state.departments = departments;
    $('dashboardTotalTickets').textContent = dashboard?.totalTickets ?? tickets.length;
    $('dashboardOpenTickets').textContent = dashboard?.openTickets ?? tickets.filter((ticket) => ticket.status === 'Open').length;
    $('dashboardProgressTickets').textContent = dashboard?.inProgressTickets ?? tickets.filter((ticket) => ['Assigned', 'In Progress'].includes(ticket.status)).length;
    $('dashboardResolvedTickets').textContent = dashboard?.resolvedTickets ?? tickets.filter((ticket) => ['Resolved', 'Closed'].includes(ticket.status)).length;

    const recentBody = $('dashboardRecentTickets');
    const recentTickets = tickets.slice(0, 6);
    recentBody.innerHTML = recentTickets.length
    
    ? recentTickets.map((ticket) => `
    <tr class="table-row-link" data-ticket-id="${ticket.id}">
      <td>${escapeHtml(ticket.work_order_id || '-')}</td>
      <td>${escapeHtml(ticket.title || '-')}</td>
      <td>${escapeHtml(ticket.company_name || '-')}</td>
      <td>${statusBadge(ticket.status)}</td>
      
      <td>
        <select id="dept-select-${ticket.id}" class="form-select" onclick="event.stopPropagation()" style="width: 180px; font-size: 12px; padding: 2px;">
          <option value="">-- Forward to Department --</option>
          ${state.departments.length ? state.departments.map((department) => `
            <option value="${department.id}">${escapeHtml(department.name)}${department.manager_name ? ` - ${escapeHtml(department.manager_name)}` : ''}</option>
          `).join('') : '<option value="">No departments available</option>'}
        </select>
      </td>

      <td>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); assignTicketToDept(${ticket.id})" style="font-size: 11px; padding: 2px 8px;">
          Confirm
        </button>
      </td>

      <td>${escapeHtml(ticket.priority || '-')}</td>
      <td>${formatDateTimeLocal(ticket.created_at)}</td>
    </tr>
`).join('')

      : tableEmptyRow(6, 'No tickets found.');

    recentBody.querySelectorAll('[data-ticket-id]').forEach((row) => {
      row.addEventListener('click', () => {
        openTicketPreviewModal(row.dataset.ticketId);
      });
    });

    // System activity intentionally not rendered on the dashboard center.
  }

  async function openTicketPreviewModal(ticketId) {
    Modal.open({
      title: 'Ticket Detail',
      subtitle: '',
      body: '<div class="empty-state">Loading ticket detail...</div>'
    });

    try {
      const [ticket, logs, responses] = await Promise.all([
        fetchTicket(ticketId),
        fetchTicketLogs(ticketId),
        fetchResponses(ticketId)
      ]);

      if (!ticket) {
        $('adminModalBody').innerHTML = '<div class="empty-state">Ticket detail is unavailable.</div>';
        return;
      }

      $('adminModalTitle').textContent = ticket.work_order_id || 'Ticket Detail';
      $('adminModalSubtitle').textContent = ticket.title || '';

      const timeline = [
        ... (Array.isArray(logs) ? logs.filter((l) => String(l.action || '').toUpperCase() !== 'RESPONSE_ADDED') : []).map((log) => ({
          type: 'log',
          title: log.action || 'Activity',
          actor: log.user_name || 'System',
          message: log.details || '',
          created_at: log.created_at
        })),
          ...responses.map((response) => {
            const rawUrl = response.attachment_url || response.file_path || response.attachment || '';
            const absUrl = rawUrl ? buildAttachmentUrl(rawUrl) : '';
            return {
              type: response.internal_note ? 'internal' : 'response',
              title: response.internal_note ? 'Internal Note' : 'Response',
              actor: response.author_name || 'Unknown User',
              message: response.message || '',
              attachment_url: absUrl,
              attachment_type: response.attachment_type || response.attachmentType || null,
              created_at: response.created_at
            };
          })
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      $('adminModalBody').innerHTML = `
        <div class="stack">
          <section class="detail-grid">
            <div><span class="context-label">Status</span><strong>${statusBadge(ticket.status)}</strong></div>
            <div><span class="context-label">Priority</span><strong>${escapeHtml(ticket.priority || '-')}</strong></div>
            <div><span class="context-label">Company</span><strong>${escapeHtml(ticket.company_name || '-')}</strong></div>
            <div><span class="context-label">Assignee</span><strong>${escapeHtml(ticket.technician_name || 'Unassigned')}</strong></div>
            <div><span class="context-label">Department</span><strong>${escapeHtml(ticket.department_name || 'Unassigned')}</strong></div>
            <div><span class="context-label">Requestor</span><strong>${escapeHtml(ticket.requestor_name || '-')}</strong></div>
            <div><span class="context-label">Created</span><strong>${formatDateTimeLocal(ticket.created_at)}</strong></div>
            <div><span class="context-label">Updated</span><strong>${formatDateTimeLocal(ticket.updated_at)}</strong></div>
          </section>
          <section>
            <span class="context-label">Description</span>
            <p>${escapeHtml(ticket.description || 'No description provided.')}</p>
          </section>
          <section class="stack">
            <h3 class="section-title">Activity</h3>
            ${timeline.length ? timeline.map((item) => `
              <article class="timeline-item timeline-item-${item.type}">
                <div class="timeline-item-header">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="response-meta">${formatDateTimeLocal(item.created_at)}</span>
                </div>
                <div class="response-role">${escapeHtml(item.actor)}</div>
                <p>${escapeHtml(item.message)}</p>
                ${item.attachment_url ? renderAttachmentHtml(item.attachment_url, item.attachment_type) : ''}
              </article>
            `).join('') : '<div class="empty-state">No activity recorded for this ticket.</div>'}
          </section>
        </div>
      `;
    } catch (_error) {
      $('adminModalBody').innerHTML = '<div class="empty-state">Unable to load ticket detail.</div>';
    }
  }

  async function initTickets() {
    renderPageShell('tickets', `
      <section class="card stack">
        <div class="admin-toolbar">
          <div class="search-input">
            ${icon('search')}
            <input id="ticketSearch" type="search" placeholder="Search work order, title, company, requestor">
          </div>
          <select id="ticketStatusFilter"><option value="">All Statuses</option><option>Open</option><option>Assigned</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select>
          <select id="ticketPriorityFilter"><option value="">All Priorities</option><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
          <select id="ticketCompanyFilter"><option value="">All Companies</option></select>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Work Order</th><th>Title</th><th>Company</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody id="adminTicketsBody"></tbody>
          </table>
        </div>
        <div class="pagination-line">
          <span id="adminTicketsInfo" class="pagination-info"></span>
          <div id="adminTicketsPagination" class="pagination"></div>
        </div>
      </section>
    `);

    const [tickets, companies, departments] = await Promise.all([
      fetchTickets(),
      fetchCompanies(),
      fetchDepartments()
    ]);

    state.tickets = tickets;
    state.companies = companies;
    state.departments = departments;

    $('ticketCompanyFilter').innerHTML += companies.map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`).join('');

    const filterState = { search: '', status: '', priority: '', companyId: '', page: 1 };

    const render = () => {
      const filtered = state.tickets.filter((ticket) => {
        const text = `${ticket.work_order_id || ''} ${ticket.title || ''} ${ticket.company_name || ''} ${ticket.requestor_name || ''}`.toLowerCase();
        return (!filterState.search || text.includes(filterState.search))
          && (!filterState.status || ticket.status === filterState.status)
          && (!filterState.priority || ticket.priority === filterState.priority)
          && (!filterState.companyId || String(ticket.company_id) === filterState.companyId);
      });

      const items = pageSlice(filtered, filterState.page);
      $('adminTicketsBody').innerHTML = items.length ? items.map((ticket) => `
        <tr>
          <td>${escapeHtml(ticket.work_order_id || '-')}</td>
          <td>${escapeHtml(ticket.title || '-')}</td>
          <td>${escapeHtml(ticket.company_name || '-')}</td>
          <td>${escapeHtml(ticket.technician_name || 'Unassigned')}</td>
          <td>${statusBadge(ticket.status)}</td>
          <td>${escapeHtml(ticket.priority || '-')}</td>
          <td>${formatShortDate(ticket.created_at)}</td>
          <td class="admin-actions-cell">
            <button class="icon-button" data-view-ticket="${ticket.id}" title="View">${icon('eye')}</button>
            <button class="icon-button" data-assign-ticket="${ticket.id}" title="Assign">${icon('users')}</button>
            <button class="icon-button" data-close-ticket="${ticket.id}" title="Close" ${ticket.status !== 'Resolved' ? 'disabled' : ''}>${icon('check')}</button>
          </td>
        </tr>
      `).join('') : tableEmptyRow(8, 'No tickets matched the current filters.');

      $('adminTicketsInfo').textContent = filtered.length
        ? `Showing ${(filterState.page - 1) * PAGE_SIZE + 1}-${Math.min(filterState.page * PAGE_SIZE, filtered.length)} of ${filtered.length} tickets`
        : 'Showing 0 tickets';

      renderPagination($('adminTicketsPagination'), filtered.length, filterState.page, (page) => {
        filterState.page = page;
        render();
      });

      bindTicketActions();
    };

    const resetPageAndRender = () => {
      filterState.page = 1;
      render();
    };

    $('ticketSearch').addEventListener('input', (event) => {
      filterState.search = event.target.value.trim().toLowerCase();
      resetPageAndRender();
    });
    $('ticketStatusFilter').addEventListener('change', (event) => {
      filterState.status = event.target.value;
      resetPageAndRender();
    });
    $('ticketPriorityFilter').addEventListener('change', (event) => {
      filterState.priority = event.target.value;
      resetPageAndRender();
    });
    $('ticketCompanyFilter').addEventListener('change', (event) => {
      filterState.companyId = event.target.value;
      resetPageAndRender();
    });

    async function bindTicketActions() {
      document.querySelectorAll('[data-view-ticket]').forEach((button) => {
        button.onclick = () => openTicketPreviewModal(button.dataset.viewTicket);
      });
      document.querySelectorAll('[data-assign-ticket]').forEach((button) => {
        button.onclick = () => openAssignTicketModal(button.dataset.assignTicket);
      });
      document.querySelectorAll('[data-close-ticket]').forEach((button) => {
        button.onclick = async () => {
          const result = await closeTicket(button.dataset.closeTicket);
          if (result?.success) {
            notify(result.message || 'Ticket closed.');
            state.tickets = await fetchTickets();
            render();
          } else {
            notify(result?.message || 'Unable to close ticket.', 'error');
          }
        };
      });
    }

    function openAssignTicketModal(ticketId) {
      const ticket = state.tickets.find((item) => String(item.id) === String(ticketId));
      Modal.open({
        title: 'Forward Ticket',
        subtitle: ticket ? ticket.work_order_id : '',
        body: `
          <form id="assignTicketForm" class="stack">
            <div class="field">
              <label for="assignDepartmentId">Department</label>
              <select id="assignDepartmentId">
                <option value="">Select department</option>
                ${state.departments.map((department) => `<option value="${department.id}" ${String(ticket?.department_id || '') === String(department.id) ? 'selected' : ''}>${escapeHtml(department.name)}${department.manager_name ? ` - ${escapeHtml(department.manager_name)}` : ''}</option>`).join('')}
              </select>
            </div>
            <p class="form-note">Admins forward tickets to department heads. Department heads then assign technicians.</p>
            <p id="assignTicketMessage" class="form-msg"></p>
            <div class="form-actions">
              <button class="btn secondary" data-modal-close type="button">Cancel</button>
              <button class="btn" id="assignTicketSubmit" type="submit">Forward</button>
            </div>
          </form>
        `
      });

      document.querySelector('[data-modal-close]')?.addEventListener('click', () => Modal.close());
      $('assignTicketForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const departmentId = $('assignDepartmentId').value;
        if (!departmentId) {
          setInlineMessage($('assignTicketMessage'), 'Department selection is required.', 'error');
          return;
        }

        const result = await apiRequest(`/tickets/${ticketId}/assign`, {
          method: 'PATCH',
          body: JSON.stringify({ department_id: Number(departmentId) })
        });

        if (result?.success) {
          Modal.close();
          notify(result.message || 'Ticket forwarded to department head.');
          state.tickets = await fetchTickets();
          render();
        } else {
          setInlineMessage($('assignTicketMessage'), result?.message || 'Unable to forward ticket.', 'error');
        }
      });
    }

    render();
  }

  async function initUsers() {
    renderPageShell('users', `
      <section class="card stack">
        <div class="section-head">
          <div class="admin-toolbar compact-toolbar">
            <div class="search-input">
              ${icon('search')}
              <input id="userSearch" type="search" placeholder="Search name or email">
            </div>
            <select id="userRoleFilter"><option value="">All Roles</option><option value="admin">Admin</option><option value="technician">Technician</option><option value="head">Head</option><option value="client">Client</option></select>
            <select id="userStatusFilter"><option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </div>
          <button class="btn" id="addUserBtn" type="button">${icon('plus')}Add User</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody id="adminUsersBody"></tbody>
          </table>
        </div>
        <div class="pagination-line">
          <span id="adminUsersInfo" class="pagination-info"></span>
          <div id="adminUsersPagination" class="pagination"></div>
        </div>
      </section>
    `);

    const [users, departments, companies] = await Promise.all([
      fetchUsers(),
      fetchDepartments(),
      fetchCompanies()
    ]);
    state.users = users;
    state.departments = departments;
    state.companies = companies;

    const filterState = { search: '', role: '', status: '', page: 1 };

    const render = () => {
      const filtered = state.users.filter((user) => {
        const text = `${user.name || ''} ${user.email || ''}`.toLowerCase();
        const statusValue = user.is_active ? 'active' : 'inactive';
        return (!filterState.search || text.includes(filterState.search))
          && (!filterState.role || user.role === filterState.role)
          && (!filterState.status || statusValue === filterState.status);
      });

      const items = pageSlice(filtered, filterState.page);
      $('adminUsersBody').innerHTML = items.length ? items.map((user) => `
        <tr>
          <td>
            <div class="entity-title">${escapeHtml(user.name || '-')}</div>
            <div class="entity-subtitle">${escapeHtml(user.company_name || '')}</div>
          </td>
          <td>${escapeHtml(user.email || '-')}</td>
          <td>${roleBadge(user.role)}</td>
          <td>${escapeHtml(user.department_name || '-')}</td>
          <td>${statusBadge(user.is_active ? 'Active' : 'Inactive')}</td>
          <td class="admin-actions-cell">
            <button class="icon-button" data-edit-user="${user.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-button" data-toggle-user="${user.id}" title="Toggle Status">${icon(user.is_active ? 'ban' : 'check')}</button>
          </td>
        </tr>
      `).join('') : tableEmptyRow(6, 'No users matched the current filters.');

      $('adminUsersInfo').textContent = filtered.length
        ? `Showing ${(filterState.page - 1) * PAGE_SIZE + 1}-${Math.min(filterState.page * PAGE_SIZE, filtered.length)} of ${filtered.length} users`
        : 'Showing 0 users';

      renderPagination($('adminUsersPagination'), filtered.length, filterState.page, (page) => {
        filterState.page = page;
        render();
      });

      bindUserActions();
    };

    function bindUserActions() {
      document.querySelectorAll('[data-edit-user]').forEach((button) => {
        button.onclick = () => openUserModal(state.users.find((user) => String(user.id) === button.dataset.editUser), false);
      });
      document.querySelectorAll('[data-toggle-user]').forEach((button) => {
        button.onclick = async () => {
          const user = state.users.find((item) => String(item.id) === button.dataset.toggleUser);
          const result = await updateUserStatus(user.id, !user.is_active);
          if (result?.success) {
            notify(result.message || 'User status updated.');
            state.users = await fetchUsers();
            render();
          } else {
            notify(result?.message || 'Unable to update user status.', 'error');
          }
        };
      });
    }

    function openUserModal(user = null, createMode = true) {
      const isCreate = createMode;
      Modal.open({
        title: isCreate ? 'Add User' : 'Edit User',
        subtitle: isCreate ? 'Create a new account and assign role access.' : escapeHtml(user?.email || ''),
        body: `
          <form id="adminUserForm" class="stack">
            <div class="form-row">
              <div class="field"><label for="userName">Name</label><input id="userName" type="text" value="${escapeHtml(user?.name || '')}" required></div>
              <div class="field"><label for="userEmail">Email</label><input id="userEmail" type="email" value="${escapeHtml(user?.email || '')}" required></div>
            </div>
            <div class="form-row">
              <div class="field">
                <label for="userRole">Role</label>
                <select id="userRole">
                  ${['admin', 'technician', 'head', 'client'].map((role) => `<option value="${role}" ${user?.role === role ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="userDepartment">Department</label>
                <select id="userDepartment"><option value="">None</option>${state.departments.map((department) => `<option value="${department.id}" ${String(user?.department_id || '') === String(department.id) ? 'selected' : ''}>${escapeHtml(department.name)}</option>`).join('')}</select>
              </div>
            </div>
            <div class="field">
              <label for="userCompany">Company</label>
              <select id="userCompany"><option value="">None</option>${state.companies.map((company) => `<option value="${company.id}" ${String(user?.company_id || '') === String(company.id) ? 'selected' : ''}>${escapeHtml(company.name)}</option>`).join('')}</select>
            </div>
            <div class="field">
              <label for="userPassword">${isCreate ? 'Password' : 'Reset Password'}</label>
              <input id="userPassword" type="password" ${isCreate ? 'required' : ''} minlength="8">
            </div>
            <p id="userModalMessage" class="form-msg"></p>
            <div class="form-actions">
              ${!isCreate ? '<button class="btn secondary" id="userDeleteBtn" type="button">Deactivate</button>' : ''}
              <button class="btn secondary" id="userCancelBtn" type="button">Cancel</button>
              <button class="btn" id="userSubmitBtn" type="submit">${isCreate ? 'Create User' : 'Save Changes'}</button>
            </div>
          </form>
        `
      });

      $('userCancelBtn').addEventListener('click', () => Modal.close());
      $('userDeleteBtn')?.addEventListener('click', async () => {
        const result = await updateUserStatus(user.id, false);
        if (result?.success) {
          Modal.close();
          notify(result.message || 'User deactivated.');
          state.users = await fetchUsers();
          render();
        } else {
          setInlineMessage($('userModalMessage'), result?.message || 'Unable to deactivate user.', 'error');
        }
      });
      $('adminUserForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
          name: $('userName').value.trim(),
          email: $('userEmail').value.trim(),
          role: $('userRole').value,
          department_id: $('userDepartment').value ? Number($('userDepartment').value) : null,
          company_id: $('userCompany').value ? Number($('userCompany').value) : null
        };
        const password = $('userPassword').value;
        if (isCreate) payload.password = password;

        let result;
        if (isCreate) {
          result = await createUser(payload);
        } else {
          result = await updateUser(user.id, payload);
          if (result?.success && password) {
            const resetResult = await resetUserPassword(user.id, password);
            if (!resetResult?.success) {
              setInlineMessage($('userModalMessage'), resetResult?.message || 'User updated, password reset failed.', 'error');
              return;
            }
          }
        }

        if (result?.success || result?.user?.id) {
          Modal.close();
          notify(isCreate ? 'User created.' : 'User updated.');
          state.users = await fetchUsers();
          render();
        } else {
          setInlineMessage($('userModalMessage'), result?.message || 'Unable to save user.', 'error');
        }
      });
    }

    $('addUserBtn').addEventListener('click', () => openUserModal(null, true));
    $('userSearch').addEventListener('input', (event) => {
      filterState.search = event.target.value.trim().toLowerCase();
      filterState.page = 1;
      render();
    });
    $('userRoleFilter').addEventListener('change', async (event) => {
      filterState.role = event.target.value;
      filterState.page = 1;
      state.users = await fetchUsers(filterState.role ? { role: filterState.role } : {});
      render();
    });
    $('userStatusFilter').addEventListener('change', (event) => {
      filterState.status = event.target.value;
      filterState.page = 1;
      render();
    });

    render();
  }

  async function initCompanies() {
    renderPageShell('companies', `
      <section class="card stack">
        <div class="section-head">
          <div class="search-input">
            ${icon('search')}
            <input id="companySearch" type="search" placeholder="Search company or contact email">
          </div>
          <button class="btn" id="addCompanyBtn" type="button">${icon('plus')}Add Company</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Contact Person</th><th>Contact Email</th><th>Status</th><th>Users</th><th>Tickets</th><th>Actions</th></tr></thead>
            <tbody id="adminCompaniesBody"></tbody>
          </table>
        </div>
      </section>
    `);

    state.companies = await fetchCompanies();
    let query = '';

    const render = () => {
      const filtered = state.companies.filter((company) => {
        const text = `${company.name || ''} ${company.contact_person || ''} ${company.contact_email || ''}`.toLowerCase();
        return !query || text.includes(query);
      });

      $('adminCompaniesBody').innerHTML = filtered.length ? filtered.map((company) => `
        <tr>
          <td>${escapeHtml(company.name || '-')}</td>
          <td>${escapeHtml(company.contact_person || '-')}</td>
          <td>${escapeHtml(company.contact_email || '-')}</td>
          <td>${statusBadge(company.is_active ? 'Active' : 'Inactive')}</td>
          <td>${escapeHtml(company.user_count ?? 0)}</td>
          <td>${escapeHtml(company.ticket_count ?? 0)}</td>
          <td class="admin-actions-cell">
            <button class="icon-button" data-edit-company="${company.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-button" data-delete-company="${company.id}" title="Deactivate">${icon('trash')}</button>
          </td>
        </tr>
      `).join('') : tableEmptyRow(7, 'No companies matched the search.');

      document.querySelectorAll('[data-edit-company]').forEach((button) => {
        button.onclick = () => openCompanyModal(state.companies.find((company) => String(company.id) === button.dataset.editCompany), false);
      });
      document.querySelectorAll('[data-delete-company]').forEach((button) => {
        button.onclick = async () => {
          const result = await deleteCompany(button.dataset.deleteCompany);
          if (result?.success) {
            notify(result.message || 'Company deactivated.');
            state.companies = await fetchCompanies();
            render();
          } else {
            notify(result?.message || 'Unable to deactivate company.', 'error');
          }
        };
      });
    };

    function openCompanyModal(company = null, createMode = true) {
      const isCreate = createMode;
      Modal.open({
        title: isCreate ? 'Add Company' : 'Edit Company',
        body: `
          <form id="companyForm" class="stack">
            <div class="field"><label for="companyName">Company Name</label><input id="companyName" type="text" value="${escapeHtml(company?.name || '')}" required></div>
            <div class="form-row">
              <div class="field"><label for="companyContact">Contact Person</label><input id="companyContact" type="text" value="${escapeHtml(company?.contact_person || '')}"></div>
              <div class="field"><label for="companyEmail">Contact Email</label><input id="companyEmail" type="email" value="${escapeHtml(company?.contact_email || '')}"></div>
            </div>
            <div class="field">
              <label for="companyStatus">Status</label>
              <select id="companyStatus">
                <option value="1" ${company?.is_active ? 'selected' : ''}>Active</option>
                <option value="0" ${company && !company.is_active ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
            <p id="companyModalMessage" class="form-msg"></p>
            <div class="form-actions">
              <button class="btn secondary" id="companyCancelBtn" type="button">Cancel</button>
              <button class="btn" id="companySubmitBtn" type="submit">${isCreate ? 'Create Company' : 'Save Changes'}</button>
            </div>
          </form>
        `
      });

      $('companyCancelBtn').addEventListener('click', () => Modal.close());
      $('companyForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
          name: $('companyName').value.trim(),
          contact_person: $('companyContact').value.trim(),
          contact_email: $('companyEmail').value.trim(),
          is_active: Number($('companyStatus').value)
        };

        const result = isCreate ? await createCompany(payload) : await updateCompany(company.id, payload);
        if (result?.success || result?.company?.id) {
          Modal.close();
          notify(isCreate ? 'Company created.' : 'Company updated.');
          state.companies = await fetchCompanies();
          render();
        } else {
          setInlineMessage($('companyModalMessage'), result?.message || 'Unable to save company.', 'error');
        }
      });
    }

    $('addCompanyBtn').addEventListener('click', () => openCompanyModal(null, true));
    $('companySearch').addEventListener('input', (event) => {
      query = event.target.value.trim().toLowerCase();
      render();
    });

    render();
  }

  async function initDepartments() {
    renderPageShell('departments', `
      <section class="grid-3">
        <article class="card metric-card"><span class="metric-label">Departments</span><strong class="metric-value" id="departmentTotalCount">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Active Departments</span><strong class="metric-value" id="departmentActiveCount">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Assigned Managers</span><strong class="metric-value" id="departmentManagerCount">--</strong></article>
      </section>
      <section class="card stack">
        <div class="section-head">
          <div class="search-input">
            ${icon('search')}
            <input id="departmentSearch" type="search" placeholder="Search departments">
          </div>
          <button class="btn" id="addDepartmentBtn" type="button">${icon('plus')}Add Department</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Manager</th><th>Tickets</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="adminDepartmentsBody"></tbody>
          </table>
        </div>
      </section>
    `);

    const [departments, managers] = await Promise.all([
      fetchDepartments(),
      fetchManagers()
    ]);
    state.departments = departments;
    state.managers = managers;
    let query = '';

    const render = () => {
      const filtered = state.departments.filter((department) => {
        const text = `${department.name || ''} ${department.manager_name || ''}`.toLowerCase();
        return !query || text.includes(query);
      });

      $('departmentTotalCount').textContent = state.departments.length;
      $('departmentActiveCount').textContent = state.departments.filter((department) => department.is_active).length;
      $('departmentManagerCount').textContent = state.departments.filter((department) => department.manager_id).length;

      $('adminDepartmentsBody').innerHTML = filtered.length ? filtered.map((department) => `
        <tr>
          <td>${escapeHtml(department.name || '-')}</td>
          <td>${escapeHtml(department.manager_name || 'Unassigned')}</td>
          <td>${escapeHtml(department.ticket_count ?? 0)}</td>
          <td>${statusBadge(department.is_active ? 'Active' : 'Inactive')}</td>
          <td class="admin-actions-cell">
            <button class="icon-button" data-edit-department="${department.id}" title="Edit">${icon('edit')}</button>
          </td>
        </tr>
      `).join('') : tableEmptyRow(5, 'No departments matched the search.');

      document.querySelectorAll('[data-edit-department]').forEach((button) => {
        button.onclick = () => openDepartmentModal(state.departments.find((department) => String(department.id) === button.dataset.editDepartment), false);
      });
    };

    function isValidDepartmentName(name) {
      const normalized = String(name || '').trim();
      if (!normalized) return false;

      const departmentKeywords = ['department', 'support', 'hr', 'it', 'billing', 'finance', 'accounts', 'operations', 'facilities', 'security', 'compliance', 'customer', 'technical', 'sales', 'procurement', 'logistics', 'service', 'administration', 'staff'];
      const lowerName = normalized.toLowerCase();
      if (/^[A-Z]{2,5}$/.test(normalized) && ['HR', 'IT', 'QA', 'UX', 'UI', 'PR'].includes(normalized)) {
        return true;
      }
      return departmentKeywords.some((keyword) => lowerName.includes(keyword));
    }

    function openDepartmentModal(department = null, createMode = true) {
      const isCreate = createMode;
      Modal.open({
        title: isCreate ? 'Add Department' : 'Edit Department',
        body: `
          <form id="departmentForm" class="stack">
            <div class="field"><label for="departmentName">Department Name</label><input id="departmentName" type="text" value="${escapeHtml(department?.name || '')}" required></div>
            <div class="field">
              <label for="departmentManager">Manager</label>
              <select id="departmentManager">
                <option value="">No manager</option>
                ${state.managers.map((manager) => `<option value="${manager.id}" ${String(department?.manager_id || '') === String(manager.id) ? 'selected' : ''}>${escapeHtml(manager.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="departmentStatus">Status</label>
              <select id="departmentStatus">
                <option value="1" ${department?.is_active ? 'selected' : ''}>Active</option>
                <option value="0" ${department && !department.is_active ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
            <p id="departmentModalMessage" class="form-msg"></p>
            <div class="form-actions">
              <button class="btn secondary" id="departmentCancelBtn" type="button">Cancel</button>
              <button class="btn" id="departmentSubmitBtn" type="submit">${isCreate ? 'Create Department' : 'Save Changes'}</button>
            </div>
          </form>
        `
      });

      $('departmentCancelBtn').addEventListener('click', () => Modal.close());
      $('departmentForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
          name: $('departmentName').value.trim(),
          manager_id: $('departmentManager').value ? Number($('departmentManager').value) : null,
          is_active: Number($('departmentStatus').value)
        };

        if (!payload.name) {
          setInlineMessage($('departmentModalMessage'), 'Department name is required.', 'error');
          return;
        }

        if (!isValidDepartmentName(payload.name)) {
          setInlineMessage($('departmentModalMessage'), 'Department name must be a real department, such as IT Support, HR, Billing, or Technical Support.', 'error');
          return;
        }

        const result = isCreate ? await createDepartment(payload) : await updateDepartment(department.id, payload);
        if (result?.success || result?.department?.id) {
          Modal.close();
          notify(isCreate ? 'Department created.' : 'Department updated.');
          state.departments = await fetchDepartments();
          render();
        } else {
          setInlineMessage($('departmentModalMessage'), result?.message || 'Unable to save department.', 'error');
        }
      });
    }

    $('addDepartmentBtn').addEventListener('click', () => openDepartmentModal(null, true));
    $('departmentSearch').addEventListener('input', (event) => {
      query = event.target.value.trim().toLowerCase();
      render();
    });

    render();
  }

  async function initReports() {
    renderPageShell('reports', `
      <section class="grid-4">
        <article class="card metric-card"><span class="metric-label">Total Tickets</span><strong class="metric-value" id="reportTotalTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Open Tickets</span><strong class="metric-value" id="reportOpenTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Active Tickets</span><strong class="metric-value" id="reportActiveTickets">--</strong></article>
        <article class="card metric-card"><span class="metric-label">Completed Tickets</span><strong class="metric-value" id="reportCompletedTickets">--</strong></article>
      </section>
      <section class="admin-two-column">
        <section class="card stack">
          <div><h2 class="section-title">Priority Breakdown</h2><p class="section-subtitle">Ticket distribution by urgency level.</p></div>
          <div class="table-wrap">
            <table><thead><tr><th>Priority</th><th>Count</th></tr></thead><tbody id="reportPriorityBody"></tbody></table>
          </div>
        </section>
        <section class="card stack">
          <div><h2 class="section-title">Top Companies</h2><p class="section-subtitle">Organizations generating the highest ticket volume.</p></div>
          <div class="table-wrap">
            <table><thead><tr><th>Company</th><th>Tickets</th></tr></thead><tbody id="reportCompanyBody"></tbody></table>
          </div>
        </section>
      </section>
      <section class="card stack">
        <div><h2 class="section-title">Department Distribution</h2><p class="section-subtitle">Ticket load by department.</p></div>
        <div class="table-wrap">
          <table><thead><tr><th>Department</th><th>Tickets</th></tr></thead><tbody id="reportDepartmentBody"></tbody></table>
        </div>
      </section>
    `);

    const report = await apiRequest('/admin/reports');
    if (!report?.success) {
      throw new Error(report?.message || 'Unable to load reports.');
    }

    $('reportTotalTickets').textContent = report.overview.total_tickets ?? 0;
    $('reportOpenTickets').textContent = report.overview.open_tickets ?? 0;
    $('reportActiveTickets').textContent = report.overview.active_tickets ?? 0;
    $('reportCompletedTickets').textContent = report.overview.completed_tickets ?? 0;

    $('reportPriorityBody').innerHTML = report.priorityBreakdown.length
      ? report.priorityBreakdown.map((item) => `<tr><td>${escapeHtml(item.priority || '-')}</td><td>${item.count}</td></tr>`).join('')
      : tableEmptyRow(2, 'No priority metrics available.');
    $('reportCompanyBody').innerHTML = report.companyBreakdown.length
      ? report.companyBreakdown.slice(0, 8).map((item) => `<tr><td>${escapeHtml(item.name || '-')}</td><td>${item.ticket_count}</td></tr>`).join('')
      : tableEmptyRow(2, 'No company metrics available.');
    $('reportDepartmentBody').innerHTML = report.departmentBreakdown.length
      ? report.departmentBreakdown.map((item) => `<tr><td>${escapeHtml(item.name || '-')}</td><td>${item.ticket_count}</td></tr>`).join('')
      : tableEmptyRow(2, 'No department metrics available.');
  }

  async function initMessages() {
    renderPageShell('messages', `
      <section class="admin-two-column">
        <section class="card stack" style="min-width:320px; max-width:380px;">
          <div class="section-head">
            <div>
              <h2 class="section-title">User Conversations</h2>
              <p class="section-subtitle">Select a client to review the private support thread.</p>
            </div>
          </div>
          <div class="table-wrap" style="max-height:660px; overflow:auto;">
            <table>
              <thead>
                <tr><th>User</th><th>Email</th><th>Last Message</th><th>Unread</th></tr>
              </thead>
              <tbody id="adminMessageThreadsBody"></tbody>
            </table>
          </div>
        </section>

        <section class="card stack" id="adminMessageThreadPanel">
          <div>
            <h2 class="section-title">Message Preview</h2>
            <p class="section-subtitle">Choose a user thread to reply directly.</p>
          </div>
          <div id="adminMessageThreadContent" class="responses-list"></div>
          <form id="adminReplyForm" class="stack" style="margin-top:16px;">
            <div class="field">
              <label for="adminReplyText">Reply to client</label>
              <textarea id="adminReplyText" rows="4" required placeholder="Type your reply here..."></textarea>
            </div>
            <p id="adminReplyStatus" class="form-msg"></p>
            <div class="form-actions">
              <button class="btn" type="submit">Send Reply</button>
            </div>
          </form>
        </section>
      </section>
    `);

    const threads = await fetchAdminMessageThreads();
    state.messageThreads = threads;
    state.activeMessageUserId = null;

    const threadSummary = threads.reduce((map, message) => {
      const clientId = message.sender_role === 'client' ? message.sender_id : message.receiver_id;
      const clientName = message.sender_role === 'client' ? message.sender_name : message.receiver_name;
      const clientEmail = message.sender_role === 'client' ? message.sender_email : message.receiver_email;
      const lastMessage = message.message;
      const lastAt = message.created_at;
      const unreadCount = message.receiver_role === 'admin' && !message.is_read ? 1 : 0;

      if (!map[clientId]) {
        map[clientId] = {
          user_id: clientId,
          user_name: clientName,
          user_email: clientEmail,
          last_message: lastMessage,
          last_at: lastAt,
          unread_count: unreadCount
        };
      } else {
        map[clientId].unread_count += unreadCount;
        if (new Date(message.created_at) > new Date(map[clientId].last_at)) {
          map[clientId].last_message = lastMessage;
          map[clientId].last_at = message.created_at;
        }
      }

      return map;
    }, {});

    const rows = Object.values(threadSummary).sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
    const tableBody = $('adminMessageThreadsBody');
    tableBody.innerHTML = rows.length
      ? rows.map((thread) => `
          <tr class="table-row-link" data-client-id="${thread.user_id}">
            <td>${escapeHtml(thread.user_name)}</td>
            <td>${escapeHtml(thread.user_email)}</td>
            <td>${escapeHtml(thread.last_message || '-')}</td>
            <td>${thread.unread_count > 0 ? `<strong>${thread.unread_count}</strong>` : '-'}</td>
          </tr>
        `).join('')
      : tableEmptyRow(4, 'No private messages available.');

    tableBody.querySelectorAll('[data-client-id]').forEach((row) => {
      row.addEventListener('click', () => loadAdminThread(Number(row.dataset.clientId)));
    });

    document.getElementById('adminReplyForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const userId = state.activeMessageUserId;
      const textarea = document.getElementById('adminReplyText');
      const statusNode = document.getElementById('adminReplyStatus');

      if (!userId) {
        statusNode.textContent = 'Please select a conversation first.';
        return;
      }

      const value = textarea.value.trim();
      if (!value) {
        statusNode.textContent = 'Reply cannot be empty.';
        return;
      }

      const result = await sendMessage({ receiver_id: userId, message: value });

      if (!result?.success) {
        statusNode.textContent = result?.message || 'Unable to send reply.';
        textarea.focus();
        return;
      }

      textarea.value = '';
      statusNode.textContent = 'Reply sent successfully.';
      await loadAdminThread(userId);
    });

    async function loadAdminThread(userId) {
      state.activeMessageUserId = userId;
      const messages = await fetchUserMessages(userId);
      const panel = $('adminMessageThreadContent');

      panel.innerHTML = messages.length
        ? messages.map((msg) => `
            <article class="timeline-item timeline-item-${msg.sender_role === 'client' ? 'response' : 'internal'}">
              <div class="timeline-item-header">
                <strong>${escapeHtml(msg.sender_role === 'client' ? msg.sender_name : 'Admin')}</strong>
                <span class="response-meta">${formatDateTimeLocal(msg.created_at)}</span>
              </div>
              <p>${escapeHtml(msg.message)}</p>
            </article>
          `).join('')
        : '<div class="empty-state">No conversation history yet.</div>';
    }
  }

  async function initActivity() {
    renderPageShell('activity', `
      <section class="card stack">
        <div class="admin-toolbar">
          <div class="search-input">
            ${icon('search')}
            <input id="activitySearch" type="search" placeholder="Search action, user, or work order">
          </div>
          <select id="activityActionFilter"><option value="">All Actions</option></select>
        </div>
        <div id="adminActivityList" class="responses-list"></div>
      </section>
    `);

    const logs = await fetchLogs({ limit: 200 });
    const visibleLogs = Array.isArray(logs) ? logs.filter((log) => String(log.action || '').toUpperCase() !== 'RESPONSE_ADDED') : [];
    const actions = [...new Set(visibleLogs.map((log) => log.action).filter(Boolean))].sort();
    $('activityActionFilter').innerHTML += actions.map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`).join('');

    let search = '';
    let actionFilter = '';

    const render = () => {
      const filtered = logs.filter((log) => {
        if (String(log.action || '').toUpperCase() === 'RESPONSE_ADDED') return false;
        const text = `${log.action || ''} ${log.details || ''} ${log.user_name || ''} ${log.work_order_id || ''}`.toLowerCase();
        return (!search || text.includes(search)) && (!actionFilter || log.action === actionFilter);
      });

      $('adminActivityList').innerHTML = filtered.length ? filtered.map((log) => `
        <article class="timeline-item timeline-item-log">
          <div class="timeline-item-header">
            <strong>${escapeHtml(log.action || 'Activity')}</strong>
            <span class="response-meta">${formatDateTimeLocal(log.created_at)}</span>
          </div>
          <div class="response-role">${escapeHtml(log.user_name || 'System')} ${log.work_order_id ? `- ${escapeHtml(log.work_order_id)}` : ''}</div>
          <p>${escapeHtml(log.details || '')}</p>
        </article>
      `).join('') : '<div class="empty-state">No activity matched the current filters.</div>';
    };

    $('activitySearch').addEventListener('input', (event) => {
      search = event.target.value.trim().toLowerCase();
      render();
    });
    $('activityActionFilter').addEventListener('change', (event) => {
      actionFilter = event.target.value;
      render();
    });

    render();
  }

  async function initProfile() {
    renderPageShell('profile', `
      <section class="card stack">
        <div><h2 class="section-title">Account Information</h2><p class="section-subtitle">Maintain your administrator profile details.</p></div>
        <form id="adminProfileForm" class="stack">
          <div class="form-row">
            <div class="field"><label for="adminName">Name</label><input id="adminName" type="text" required></div>
            <div class="field"><label for="adminEmail">Email</label><input id="adminEmail" type="email" required></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="adminRole">Role</label><input id="adminRole" type="text" readonly></div>
            <div class="field"><label for="adminDepartment">Department</label><input id="adminDepartment" type="text" readonly></div>
          </div>
          <p id="adminProfileMessage" class="form-msg"></p>
          <div class="form-actions"><button class="btn" id="adminProfileSubmit" type="submit">Save Changes</button></div>
        </form>
      </section>
      <section class="card stack">
        <div><h2 class="section-title">Password</h2><p class="section-subtitle">Change the password tied to this administrator account.</p></div>
        <form id="adminPasswordForm" class="stack">
          <div class="form-row">
            <div class="field"><label for="adminCurrentPassword">Current Password</label><input id="adminCurrentPassword" type="password" required></div>
            <div class="field"><label for="adminNewPassword">New Password</label><input id="adminNewPassword" type="password" minlength="8" required></div>
          </div>
          <p id="adminPasswordMessage" class="form-msg"></p>
          <div class="form-actions"><button class="btn secondary" id="adminPasswordSubmit" type="submit">Update Password</button></div>
        </form>
      </section>
    `);

    const user = await getMe();
    $('adminName').value = user?.name || '';
    $('adminEmail').value = user?.email || '';
    $('adminRole').value = user?.role || '';
    $('adminDepartment').value = user?.department_name || 'Not assigned';

    $('adminProfileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await updateProfile({
        name: $('adminName').value.trim(),
        email: $('adminEmail').value.trim()
      });
      if (result?.success) {
        notify(result.message || 'Profile updated.');
        setInlineMessage($('adminProfileMessage'), result.message || 'Profile updated.', 'success');
      } else {
        setInlineMessage($('adminProfileMessage'), result?.message || 'Unable to update profile.', 'error');
      }
    });

    $('adminPasswordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await changePassword({
        current_password: $('adminCurrentPassword').value,
        new_password: $('adminNewPassword').value
      });
      if (result?.success) {
        $('adminPasswordForm').reset();
        setInlineMessage($('adminPasswordMessage'), result.message || 'Password updated.', 'success');
      } else {
        setInlineMessage($('adminPasswordMessage'), result?.message || 'Unable to update password.', 'error');
      }
    });
  }

  const PAGE_INITIALIZERS = {
    dashboard: initDashboard,
    tickets: initTickets,
    users: initUsers,
    companies: initCompanies,
    departments: initDepartments,
    reports: initReports,
    messages: initMessages,
    activity: initActivity,
    profile: initProfile
  };

  return {
    boot,
    icon,
    Modal
  };
})();

window.AdminPortal = AdminPortal;


async function assignTicketToDept(ticketId) {
    const deptSelect = document.getElementById(`dept-select-${ticketId}`);
    
    if (!deptSelect) {
        console.error("Error: Dropdown element not found for ID:", `dept-select-${ticketId}`);
        alert("System Error: Cannot find department selection.");
        return;
    }

    const selectedDeptId = deptSelect.value;

    if (!selectedDeptId || selectedDeptId === "") {
        alert("Please select a department first.");
        return;
    }

    const token = getToken();

    if (!token) {
        alert("Session expired. Please logout and login again.");
        return;
    }

    const result = await apiRequest(`/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
            department_id: Number(selectedDeptId)
        })
    });

    if (result?.success) {
        alert("Ticket successfully assigned to the Department Head!");
        location.reload();
    } else {
        console.error("Server Response Error:", result);
        alert("Error: " + (result?.message || "Unable to assign department."));
    }
}
