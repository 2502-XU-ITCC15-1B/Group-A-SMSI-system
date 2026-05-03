window.TechnicianPortal = (() => {
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

  function configureShell(user, activeNav) {
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
    isHead,
    configureShell,
    fetchScopedTickets,
    ticketListUrl
  };
})();
