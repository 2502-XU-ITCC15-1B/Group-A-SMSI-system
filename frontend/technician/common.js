window.TechnicianPortal = (() => {
  const navIcons = {
    dashboard: 'dashboard',
    tickets: 'ticket',
    activity: 'log',
    profile: 'settings'
  };

  function escapeHtml(value = '') {
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

  function isHead(user) {
    return user?.role === 'head';
  }

  function icon(id, className = 'ui-icon') {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="${className}" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  function clearAppSession() {
    ['woman_token', 'woman_user', 'woman_role'].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  function handleLogout(event) {
    if (event) event.preventDefault();
    clearAppSession();
    window.location.replace('/login.html');
  }

  window.technicianLogout = handleLogout;

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

  function enhanceNavigation() {
    document.querySelectorAll('[data-nav]').forEach((node) => {
      if (node.dataset.iconified === 'true') return;
      const label = node.textContent.trim();
      const iconId = navIcons[node.dataset.nav] || 'chevron-right';
      node.innerHTML = `${icon(iconId)}<span>${escapeHtml(label)}</span>`;
      node.dataset.iconified = 'true';
    });
  }

  function enhanceActions() {
    const actions = {
      refreshBtn: 'Refresh',
      backBtn: 'Back to Tickets',
      assignBtn: 'Assign',
      closeBtn: 'Close Ticket',
      updateStatusBtn: 'Update Status',
      sendResponseBtn: 'Send Response',
      assignSubmitBtn: 'Assign Ticket'
    };

    Object.entries(actions).forEach(([id, label]) => {
      const button = document.getElementById(id);
      if (!button || button.dataset.iconified === 'true') return;

      const iconId = id === 'backBtn' ? 'arrow-left'
        : id === 'assignBtn' || id === 'assignSubmitBtn' ? 'users'
          : id === 'closeBtn' || id === 'updateStatusBtn' ? 'check'
            : id === 'sendResponseBtn' ? 'mail'
              : 'refresh';

      button.innerHTML = `${icon(iconId)}${escapeHtml(label)}`;
      button.dataset.iconified = 'true';
    });

    const closeButton = document.getElementById('assignCloseBtn');
    if (closeButton && closeButton.dataset.iconified !== 'true') {
      closeButton.innerHTML = icon('close');
      closeButton.dataset.iconified = 'true';
    }
  }

  function configureShell(user, activeNav) {
    loadIconSprite();
    enhanceNavigation();
    enhanceActions();

    const portalLabel = document.getElementById('portalLabel');
    const userName = document.getElementById('sessionUserName');
    const userMeta = document.getElementById('sessionUserMeta');

    if (portalLabel) {
      portalLabel.textContent = isHead(user) ? 'department head portal' : 'technician portal';
    }

    if (userName) {
      userName.textContent = user?.name || 'Unknown User';
    }

    if (userMeta) {
      userMeta.textContent = `${user?.role || 'user'}${user?.department_name ? ` - ${user.department_name}` : ''}`;
    }

    document.querySelectorAll('[data-nav]').forEach((node) => {
      node.classList.toggle('active', node.dataset.nav === activeNav);
    });

    // Ensure logout button exists in the sidebar footer
    let logoutBtn = document.getElementById('technicianLogoutBtn');
    if (!logoutBtn) {
      const footer = document.querySelector('.sidebar-footer');
      if (footer) {
        const button = document.createElement('button');
        button.className = 'btn secondary sidebar-logout';
        button.id = 'technicianLogoutBtn';
        button.type = 'button';
        button.setAttribute('aria-label', 'Logout');
        button.textContent = 'Logout';
        button.addEventListener('click', handleLogout);
        button.onclick = handleLogout;
        footer.appendChild(button);
        logoutBtn = button;
      }
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
      logoutBtn.onclick = handleLogout;
    }
  }

  async function fetchScopedTickets(user) {
    if (isHead(user)) {
      return fetchTickets({ scope: 'department' });
    }
    return fetchMyTickets();
  }

  function ticketListUrl() {
    return '/technician/tickets.html';
  }

  return {
    escapeHtml,
    icon,
    loadIconSprite,
    isHead,
    configureShell,
    fetchScopedTickets,
    ticketListUrl
  };
})();
