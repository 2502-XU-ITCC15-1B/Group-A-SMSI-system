window.ClientPortal = (() => {
  let modalInitialized = false;
  let onTicketCreated = null;

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

  function renderSidebar(activeNav) {
    const user = getUser() || {};
    const sidebarHost = document.querySelector('[data-client-sidebar]');

    if (!sidebarHost) return;

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
          <a class="nav-item ${activeNav === 'dashboard' ? 'active' : ''}" href="/client/dashboard.html">Dashboard</a>
          <a class="nav-item ${activeNav === 'requests' ? 'active' : ''}" href="/client/requests.html">My Requests</a>
          <a class="nav-item ${activeNav === 'profile' ? 'active' : ''}" href="/client/profile.html">Profile</a>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user-label">Signed in as</div>
          <div class="sidebar-user">${escapeHtml(user.name || 'Client User')}</div>
          <div class="sidebar-company">${escapeHtml(user.company_name || 'Client Account')}</div>
        </div>
      </aside>
    `;
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
          <button class="btn secondary" id="logoutBtn" type="button">Logout</button>
        </div>
      </header>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', logout);
  }

  async function hydrateClientSession() {
    const me = await getMe();

    if (me) {
      const current = getUser() || {};
      sessionStorage.setItem('woman_user', JSON.stringify({ ...current, ...me }));
      sessionStorage.setItem('woman_role', me.role || current.role || 'client');
    }

    return me;
  }

  function initPage(config) {
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
          <button class="modal-close" id="closeTicketModalBtn" type="button" aria-label="Close">x</button>
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

            <p id="ticketModalMessage" class="form-msg" aria-live="polite"></p>

            <div class="form-actions">
              <button class="btn secondary" id="cancelTicketModalBtn" type="button">Cancel</button>
              <button class="btn" id="submitTicketBtn" type="submit">Submit Ticket</button>
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
      const result = await createTicket(payload);

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
      submitBtn.textContent = 'Submit Ticket';
    }
  }

  return {
    escapeHtml,
    hydrateClientSession,
    initPage,
    ensureTicketModal,
    openTicketModal
  };
})();
