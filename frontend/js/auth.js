window.Auth = (() => {
  const SESSION_ALLOWED_ROLES = ['admin', 'head', 'client', 'technician'];

  function normalizeRoles(input) {
    if (input.length === 1 && Array.isArray(input[0])) {
      return input[0];
    }
    return input;
  }

  async function hydrateSession() {
    const user = await getMe();

    if (!user) return null;

    const current = getUser() || {};
    const merged = { ...current, ...user };
    saveUserSession(merged);

    return merged;
  }

  async function requireRoleAsync(...roles) {
    const normalizedRoles = normalizeRoles(roles).map((role) => String(role || '').trim().toLowerCase());
    const allowedRoles = normalizedRoles.length ? normalizedRoles : SESSION_ALLOWED_ROLES;
    let user = getUser();

    if (!getToken()) {
      if (!user) {
        console.log('requireRoleAsync: no token and no stored user, redirecting');
        window.location.href = '/login.html';
        return null;
      }
    }

    if (!user) {
      user = await hydrateSession();
    }

    if (!user) {
      console.log('requireRoleAsync: no user after hydrateSession, redirecting');
      window.location.href = '/login.html';
      return null;
    }

    const actualRole = String(user.role || '').trim();
    console.log('requireRoleAsync current role:', actualRole, 'allowed:', allowedRoles);

    if (!allowedRoles.includes(actualRole.toLowerCase())) {
      alert('Access denied.');
      window.location.href = '/login.html';
      return null;
    }

    return user;
  }

  function ticketListUrlFor(user) {
    const role = String(user?.role || '').trim().toLowerCase();
    if (role === 'admin') return '/admin/tickets.html';
    if (role === 'client') return '/client/requests.html';
    if (role === 'head' || role === 'technician') return '/technician/tickets.html';
    return '/login.html';
  }

  return {
    hydrateSession,
    requireRoleAsync,
    ticketListUrlFor
  };
})();

window.requireRole = (...roles) => window.Auth.requireRoleAsync(...roles);
