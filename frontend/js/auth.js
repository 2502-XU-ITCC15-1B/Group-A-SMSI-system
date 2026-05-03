window.Auth = (() => {
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
    sessionStorage.setItem('woman_user', JSON.stringify(merged));
    sessionStorage.setItem('woman_role', merged.role);

    return merged;
  }

  async function requireRoleAsync(...roles) {
    const allowedRoles = normalizeRoles(roles);
    let user = getUser();

    if (!getToken()) {
      window.location.href = '/login.html';
      return null;
    }

    if (!user) {
      user = await hydrateSession();
    }

    if (!user) {
      window.location.href = '/login.html';
      return null;
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      alert('Access denied.');
      const fallback = user.role === 'head' ? '/technician/dashboard.html' : '/login.html';
      window.location.href = fallback;
      return null;
    }

    return user;
  }

  function ticketListUrlFor(user) {
    return '/technician/tickets.html';
  }

  return {
    hydrateSession,
    requireRoleAsync,
    ticketListUrlFor
  };
})();

window.requireRole = (...roles) => window.Auth.requireRoleAsync(...roles);
