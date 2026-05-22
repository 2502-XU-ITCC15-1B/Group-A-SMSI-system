window.Auth = (() => {
  const SESSION_ALLOWED_ROLES = ['admin', 'head', 'client', 'technician'];

  function normalizeRoles(input) {
    if (input.length === 1 && Array.isArray(input[0])) {
      return input[0];
    }
    return input;
  }

  async function hydrateSession() {
    // Nag-assume ta nga naa kay getMe() ug saveUserSession() nga functions sa laing file
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
      window.location.href = ticketListUrlFor(user);
      return null;
    }

    return user;
  }

  // DINHI ANG PAG-FIX SA REDIRECTION
  function ticketListUrlFor(user) {
    if (!user || !user.role) return '/login.html';

    const role = user.role.toLowerCase();

    if (role === 'admin') {
      return '/admin/index.html';
    } else if (role === 'head' || role === 'department head') {
      return '/head/index.html';
    } else if (role === 'technician') {
      return '/technician/index.html';
    } else if (role === 'client') {
      return '/client/index.html';
    } else {
      return '/index.html';
    }
  }

  return {
    hydrateSession,
    requireRoleAsync,
    ticketListUrlFor
  };
})();

window.requireRole = (...roles) => window.Auth.requireRoleAsync(...roles);
