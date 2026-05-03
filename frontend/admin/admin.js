const AdminPortal = (() => {
  const PAGE_META = {
    dashboard: { title: 'Dashboard Overview', subtitle: 'Monitor ticket volume, operational health, and recent system activity.' },
    tickets: { title: 'Ticket Management', subtitle: 'Review, filter, assign, and close tickets across the whole service desk.' },
    users: { title: 'User Management', subtitle: 'Maintain administrator, technician, head, and client access.' },
    companies: { title: 'Company Directory', subtitle: 'Maintain client organizations and their service-contact records.' },
    departments: { title: 'Departments', subtitle: 'Maintain operational departments and assign their managers.' },
    reports: { title: 'Reports', subtitle: 'Review ticket metrics, queue composition, and service distribution.' },
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
    if (!user || user.role !== 'admin') {
      logout();
      return null;
    }

    sessionStorage.setItem('woman_user', JSON.stringify(user));
    sessionStorage.setItem('woman_role', user.role);
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
              <div class="admin-avatar" title="${escapeHtml(state.user?.name || 'Administrator')}">${avatarInitials(state.user?.name || 'Admin')}</div>
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

  function renderPageShell(pageKey, bodyMarkup) {
    state.page = pageKey;
    document.body.innerHTML = layoutShell(pageKey);
    $('adminContent').innerHTML = bodyMarkup;
    $('adminLogoutBtn').addEventListener('click', logout);
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

        <section class="card stack">
          <div>
            <h2 class="section-title">System Activity</h2>
            <p class="section-subtitle">Most recent administrative and ticket workflow actions.</p>
          </div>
          <div id="dashboardActivity" class="responses-list"></div>
        </section>
      </section>
    `);

    const [dashboard, tickets, logs] = await Promise.all([
      apiRequest('/admin/dashboard'),
      fetchTickets(),
      fetchLogs({ limit: 8 })
    ]);

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
            <td>${escapeHtml(ticket.priority || '-')}</td>
            <td>${formatDateTimeLocal(ticket.created_at)}</td>
          </tr>
        `).join('')
      : tableEmptyRow(6, 'No tickets found.');

    recentBody.querySelectorAll('[data-ticket-id]').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.href = `/technician/ticket-detail.html?id=${row.dataset.ticketId}`;
      });
    });

    const activityNode = $('dashboardActivity');
    activityNode.innerHTML = logs.length
      ? logs.map((log) => `
          <article class="timeline-item timeline-item-log">
            <div class="timeline-item-header">
              <strong>${escapeHtml(log.action || 'Activity')}</strong>
              <span class="response-meta">${formatRelative(log.created_at)}</span>
            </div>
            <div class="response-role">${escapeHtml(log.user_name || 'System')} ${log.work_order_id ? `- ${escapeHtml(log.work_order_id)}` : ''}</div>
            <p>${escapeHtml(log.details || '')}</p>
          </article>
        `).join('')
      : '<div class="empty-state">No recent activity.</div>';
  }

  async function initTickets() {
    renderPageShell('tickets', `
      <section class="card stack">
        <div class="admin-toolbar">
          <div class="search-input">
            ${icon('search')}
            <input id="ticketSearch" type="search" placeholder="Search work order, title, company, requestor">
          </div>
          <select id="ticketStatusFilter"><option value="">All Statuses</option><option>Open</option><option>Assigned</option><option>In Progress</option><option>Resolved</option><option>Closed</option><option>Rejected</option></select>
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

    const [tickets, companies, technicians] = await Promise.all([
      fetchTickets(),
      fetchCompanies(),
      fetchTechnicians()
    ]);

    state.tickets = tickets;
    state.companies = companies;
    state.technicians = technicians;

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
        button.onclick = () => { window.location.href = `/technician/ticket-detail.html?id=${button.dataset.viewTicket}`; };
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
        title: 'Assign Ticket',
        subtitle: ticket ? ticket.work_order_id : '',
        body: `
          <form id="assignTicketForm" class="stack">
            <div class="field">
              <label for="assignTechnicianId">Technician</label>
              <select id="assignTechnicianId">
                <option value="">Select technician</option>
                ${state.technicians.map((tech) => `<option value="${tech.id}" ${String(ticket?.technician_id || '') === String(tech.id) ? 'selected' : ''}>${escapeHtml(tech.name)}${tech.department_name ? ` - ${escapeHtml(tech.department_name)}` : ''}</option>`).join('')}
              </select>
            </div>
            <p id="assignTicketMessage" class="form-msg"></p>
            <div class="form-actions">
              <button class="btn secondary" data-modal-close type="button">Cancel</button>
              <button class="btn" id="assignTicketSubmit" type="submit">Assign</button>
            </div>
          </form>
        `
      });

      document.querySelector('[data-modal-close]')?.addEventListener('click', () => Modal.close());
      $('assignTicketForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const techId = $('assignTechnicianId').value;
        if (!techId) {
          setInlineMessage($('assignTicketMessage'), 'Technician selection is required.', 'error');
          return;
        }

        const result = await assignTicket(ticketId, { technician_id: Number(techId) });
        if (result?.success) {
          Modal.close();
          notify(result.message || 'Ticket assigned.');
          state.tickets = await fetchTickets();
          render();
        } else {
          setInlineMessage($('assignTicketMessage'), result?.message || 'Unable to assign ticket.', 'error');
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
    $('userRoleFilter').addEventListener('change', (event) => {
      filterState.role = event.target.value;
      filterState.page = 1;
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

    const [departments, heads] = await Promise.all([
      fetchDepartments(),
      fetchUsers({ role: 'head' })
    ]);
    state.departments = departments;
    state.heads = heads;
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
                ${state.heads.map((head) => `<option value="${head.id}" ${String(department?.manager_id || '') === String(head.id) ? 'selected' : ''}>${escapeHtml(head.name)}</option>`).join('')}
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
    const actions = [...new Set(logs.map((log) => log.action).filter(Boolean))].sort();
    $('activityActionFilter').innerHTML += actions.map((action) => `<option value="${escapeHtml(action)}">${escapeHtml(action)}</option>`).join('');

    let search = '';
    let actionFilter = '';

    const render = () => {
      const filtered = logs.filter((log) => {
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
