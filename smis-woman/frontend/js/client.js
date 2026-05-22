window.ClientPortal = (() => {
  let modalInitialized = false;
  let onTicketCreated = null;
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

    const logoutBtn = document.getElementById('clientSidebarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.logout();
      });
    }

    document.getElementById('clientSidebarLogoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.logout();
    });
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
                <label for="ticketRequestor">Requesting User</label>
                <input id="ticketRequestor" type="text" readonly>
              </div>

              <div class="field">
                <label for="ticketCompany">Company</label>
                <input id="ticketCompany" type="text" readonly>
              </div>
            </div>

            <div class="field">
              <label for="ticketTitle">Title</label>
              <input id="ticketTitle" type="text" maxlength="150" required>
            </div>

            <div class="field">
              <label for="ticketPriority">Priority</label>
              <select id="ticketPriority" required>
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
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

    populateTicketContext();
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
    const requestorInput = document.getElementById('ticketRequestor');
    const companyInput = document.getElementById('ticketCompany');

    if (requestorInput) requestorInput.value = me.name || '';
    if (companyInput) companyInput.value = me.company_name || 'Not assigned';
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
    document.getElementById('ticketPriority').value = 'Medium';
    populateTicketContext();
    setModalMessage();
  }

  async function submitTicketForm(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitTicketBtn');
    const payload = {
      title: document.getElementById('ticketTitle')?.value.trim(),
      priority: document.getElementById('ticketPriority')?.value,
      description: document.getElementById('ticketDescription')?.value.trim()
    };

    if (!payload.title || !payload.description || !payload.priority) {
      setModalMessage('All ticket fields are required.', 'error');
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
