window.ClientPortal = (() => {
  let modalInitialized = false;
  let onTicketCreated = null;
  let cachedDepartments = [];
  const HELP_TOPICS = [
    { value: 'system-outage', label: 'System Outage / Service Unavailable', departmentName: 'Technical Support' },
    { value: 'software-access', label: 'Software Access / Login Problem', departmentName: 'Technical Support' },
    { value: 'bug-error', label: 'Application Bug / Error', departmentName: 'Systems Development' },
    { value: 'web-graphics-design', label: 'Web / Graphics Change Request', departmentName: 'Web & Graphics Services' },
    { value: 'network-connectivity', label: 'Network / Internet Connectivity', departmentName: 'Technical Support' },
    { value: 'hardware-device', label: 'Hardware / Device Issue', departmentName: 'Technical Support' },
    { value: 'facilities-safety', label: 'Facilities / Safety Concern', departmentName: 'Operations' },
    { value: 'infrastructure-ops', label: 'Infrastructure / Systems Operations', departmentName: 'Operations' },
    { value: 'workflow-process', label: 'Workflow / Process Improvement Request', departmentName: 'Operations' },
    { value: 'account-payroll', label: 'Account, Payroll, or Financial Concern', departmentName: '' },
    { value: 'hr-employee-concern', label: 'HR / Employee / Compliance Concern', departmentName: '' },
    { value: 'other', label: 'Other / Not Listed', departmentName: '' }
  ];
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', href: '/client/dashboard.html', icon: 'dashboard' },
    { key: 'requests', label: 'My Requests', href: '/client/requests.html', icon: 'ticket' },
    { key: 'messages', label: 'Inbox', href: '/client/messages.html', icon: 'mail' },
    { key: 'profile', label: 'Profile', href: '/client/profile.html', icon: 'settings' }
  ];

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[char];
    });
  }

  function icon(id, className = 'ui-icon') {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="${className}" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  async function loadIconSprite() {
    if (document.getElementById('icon-sprite')) return;

    const candidates = ['/_icons.html', '../_icons.html', './_icons.html', '_icons.html'];
    let response = null;
    for (const path of candidates) {
      try {
        response = await fetch(path);
        if (response && response.ok) break;
      } catch (e) {
        response = null;
      }
    }

    if (!response?.ok) return;

    document.body.insertAdjacentHTML('afterbegin', await response.text());
  }

  function renderSidebar(activeNav) {
    const user = getUser() || {};
    const sidebarHost = document.querySelector('[data-client-sidebar]');

    if (!sidebarHost) return;

    if (window.SharedNav && typeof window.SharedNav.getNavHtml === 'function') {
      sidebarHost.innerHTML = window.SharedNav.getNavHtml('client', user, activeNav);
    } else {
      sidebarHost.innerHTML = `
        <aside class="sidebar">
          <div class="brand">
            <img src="/assets/logo.png" alt="SMSi">
            <div>
              <strong>SMSi</strong>
              <span>client portal</span>
            </div>
          </div>

          <nav>
            ${navItems.map((item) => `
              <a class="nav-item ${activeNav === item.key ? 'active' : ''}" href="${item.href}">
                ${icon(item.icon)}<span>${escapeHtml(item.label)}</span>
              </a>
            `).join('')}
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-user-label">Signed in as</div>
            <div class="sidebar-user">${escapeHtml(user.name || 'Client User')}</div>
            <div class="sidebar-company">${escapeHtml(user.company_name || 'Client Account')}</div>
            <button class="btn secondary sidebar-logout" id="clientSidebarLogoutBtn" type="button">${icon('logout')}Logout</button>
          </div>
        </aside>
      `;
    }

    // wire logout button
    let logoutBtn = document.getElementById('clientSidebarLogoutBtn');
    if (!logoutBtn) {
      // fallback: SharedNav may render a logout button without an id
      logoutBtn = sidebarHost.querySelector('.sidebar-logout');
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.logout();
      });
    }
  }

  function renderTopbar({ title, subtitle = '', breadcrumbs = [], actionsHtml = '' }) {
    const topbarHost = document.querySelector('[data-client-topbar]');

    if (!topbarHost) return;

    const breadcrumbMarkup = breadcrumbs.length
      ? breadcrumbs.map((crumb, index) => `
          <span class="crumb ${index === breadcrumbs.length - 1 ? 'current' : ''}">
            ${escapeHtml(crumb)}
          </span>
        `).join('')
      : '<span class="crumb current">Client Portal</span>';

    topbarHost.innerHTML = `
      <header class="topbar">
        <div class="topbar-meta">
          <nav class="breadcrumbs">${breadcrumbMarkup}</nav>
          <div>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </div>

        <div class="topbar-actions">
          ${actionsHtml}
        </div>
      </header>
    `;
  }

  async function hydrateClientSession() {
    const me = await getMe();

    if (me) {
      const current = getUser() || {};
      saveUserSession({ ...current, ...me, role: me.role || current.role || 'client' });
    }

    return me;
  }

  function initPage(config) {
    loadIconSprite();
    renderSidebar(config.activeNav);
    renderTopbar(config);
  }

  function ensureTicketModal(options = {}) {
    onTicketCreated = options.onCreated || null;

    if (modalInitialized) {
      populateTicketContext();
      wireOpenModalButtons();
      return;
    }

    modalInitialized = true;

    const modal = document.createElement('div');
    modal.id = 'ticketModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-panel">
        <div class="modal-head">
          <div>
            <h2>New Support Request</h2>
            <p>Log a ticket and route it to the support team.</p>
          </div>
          <button class="modal-close" id="closeTicketModalBtn" type="button" aria-label="Close">${icon('close')}</button>
        </div>

        <div class="modal-body">
          <form id="clientTicketForm" class="stack">
            <div class="form-row">
              <div class="field">
                <label for="ticketClientEmail">Email</label>
                <input id="ticketClientEmail" type="email" maxlength="150" required>
              </div>

              <div class="field">
                <label for="ticketClientPhone">Phone Number</label>
                <input id="ticketClientPhone" type="text" maxlength="30" required>
              </div>
            </div>

            <div class="field">
              <label for="ticketClientName">Full Name</label>
              <input id="ticketClientName" type="text" maxlength="150" required>
            </div>

            <div class="form-row">
              <div class="field">
                <label for="ticketHelpTopic">Help Topic</label>
                <select id="ticketHelpTopic" required>
                  <option value="">Select help topic</option>
                  ${HELP_TOPICS.map((topic) => `<option value="${topic.value}">${escapeHtml(topic.label)}</option>`).join('')}
                </select>
              </div>

              <div class="field">
                <label for="ticketDepartment">Department</label>
                <select id="ticketDepartment">
                  <option value="">Auto-select by topic</option>
                </select>
                <small id="ticketDeptHint" class="help-text">Department will be auto-selected based on help topic.</small>
              </div>
            </div>

            <div class="field">
              <label for="ticketTitle">Issue Title / Summary</label>
              <input id="ticketTitle" type="text" maxlength="150" required>
            </div>

            

            <div class="field">
              <label for="ticketDescription">Description</label>
              <textarea id="ticketDescription" rows="7" required></textarea>
            </div>

            <div class="field">
              <label for="ticketAttachment">Attachment (optional)</label>
              <input id="ticketAttachment" type="file" accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx">
            </div>

            <p id="ticketModalMessage" class="form-msg" aria-live="polite"></p>

            <div class="form-actions">
              <button class="btn secondary" id="cancelTicketModalBtn" type="button">Cancel</button>
              <button class="btn" id="submitTicketBtn" type="submit">${icon('plus')}Submit Ticket</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('closeTicketModalBtn')?.addEventListener('click', closeTicketModal);
    document.getElementById('cancelTicketModalBtn')?.addEventListener('click', closeTicketModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeTicketModal();
      }
    });

    document.getElementById('clientTicketForm')?.addEventListener('submit', submitTicketForm);
    document.getElementById('ticketHelpTopic')?.addEventListener('change', handleHelpTopicChange);

    populateTicketContext();
    void hydrateDepartments();
    wireOpenModalButtons();
  }

  function wireOpenModalButtons() {
    document.querySelectorAll('[data-open-ticket-modal]').forEach((button) => {
      if (button.dataset.modalBound === 'true') return;

      button.dataset.modalBound = 'true';
      button.addEventListener('click', openTicketModal);
    });
  }

  function populateTicketContext() {
    const me = getUser() || {};
    const nameInput = document.getElementById('ticketClientName');
    const emailInput = document.getElementById('ticketClientEmail');
    const phoneInput = document.getElementById('ticketClientPhone');

    if (nameInput) nameInput.value = me.name || '';
    if (emailInput) emailInput.value = me.email || '';
    if (phoneInput) phoneInput.value = me.phone || '';
  }

  async function hydrateDepartments() {
    const departmentSelect = document.getElementById('ticketDepartment');
    if (!departmentSelect) return;

    try {
      cachedDepartments = await fetchDepartments();
    } catch (_) {
      cachedDepartments = [];
    }

    const options = ['<option value="">Auto-select by topic</option>'].concat(
      cachedDepartments.map((department) => `<option value="${department.id}">${escapeHtml(department.name || 'Unnamed Department')}</option>`)
    );

    departmentSelect.innerHTML = options.join('');
  }

  function handleHelpTopicChange() {
    const selectedTopic = document.getElementById('ticketHelpTopic')?.value || '';
    const departmentSelect = document.getElementById('ticketDepartment');
    const hint = document.getElementById('ticketDeptHint');
    if (!departmentSelect) return;

    const topicConfig = HELP_TOPICS.find((topic) => topic.value === selectedTopic);
    const mappedDepartmentName = topicConfig?.departmentName || '';
    if (!mappedDepartmentName) {
      departmentSelect.value = '';
      if (hint) hint.textContent = 'Please choose a department manually for this topic.';
      return;
    }

    const mappedDepartment = cachedDepartments.find((department) => String(department.name || '').toLowerCase() === mappedDepartmentName.toLowerCase());
    if (mappedDepartment) {
      departmentSelect.value = String(mappedDepartment.id);
      if (hint) hint.textContent = `Auto-routed to ${mappedDepartment.name}. You can still change it.`;
      return;
    }

    departmentSelect.value = '';
    if (hint) hint.textContent = `No "${mappedDepartmentName}" department found. Please select manually.`;
  }

  function setModalMessage(message = '', type = '') {
    const node = document.getElementById('ticketModalMessage');
    if (!node) return;

    node.textContent = message;
    node.className = `form-msg${type ? ` ${type}` : ''}`;
  }

  function openTicketModal() {
    populateTicketContext();
    setModalMessage();
    document.getElementById('ticketModal')?.classList.add('open');
  }

  function closeTicketModal() {
    document.getElementById('ticketModal')?.classList.remove('open');
    document.getElementById('clientTicketForm')?.reset();
    populateTicketContext();
    handleHelpTopicChange();
    setModalMessage();
  }

  async function submitTicketForm(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitTicketBtn');
    const payload = {
      client_email: document.getElementById('ticketClientEmail')?.value.trim(),
      client_phone: document.getElementById('ticketClientPhone')?.value.trim(),
      client_full_name: document.getElementById('ticketClientName')?.value.trim(),
      help_topic: document.getElementById('ticketHelpTopic')?.value,
      department_id: document.getElementById('ticketDepartment')?.value || null,
      title: document.getElementById('ticketTitle')?.value.trim(),
      priority: 'Low',
      description: document.getElementById('ticketDescription')?.value.trim()
    };

    if (!payload.client_email || !payload.client_phone || !payload.client_full_name || !payload.help_topic || !payload.title || !payload.description) {
      setModalMessage('Please complete all required fields.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const attachmentFile = document.getElementById('ticketAttachment')?.files?.[0] || null;
      const result = await createTicket(payload, attachmentFile);

      if (!result?.success) {
        setModalMessage(result?.message || 'Unable to create ticket.', 'error');
        return;
      }

      setModalMessage('Ticket created successfully.', 'success');

      if (typeof onTicketCreated === 'function') {
        await onTicketCreated(result);
      }

      window.setTimeout(closeTicketModal, 400);
    } catch (error) {
      console.error(error);
      setModalMessage('Unable to create ticket.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon('plus')}Submit Ticket`;
    }
  }

  return {
    escapeHtml,
    hydrateClientSession,
    initPage,
    ensureTicketModal,
    openTicketModal,
    icon,
    loadIconSprite
  };
})();
