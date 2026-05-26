// ============================================================
// Centralized API client for WOMAN frontend
// Fully aligned with backend routes/services
// ============================================================

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '/api';

// Shared navigation helper used by multiple role shells
window.SharedNav = (function () {
  function icon(id) {
    const symbol = id.startsWith('ic-') ? id : `ic-${id}`;
    return `<svg class="ui-icon" aria-hidden="true"><use href="#${symbol}"></use></svg>`;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function buildNavItems(role) {
    if (role === 'admin') {
      return [
        { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard.html', icon: 'dashboard' },
        { key: 'tickets', label: 'Tickets', href: '/admin/tickets.html', icon: 'ticket' },
        { key: 'users', label: 'Users', href: '/admin/users.html', icon: 'users' },
        { key: 'companies', label: 'Companies', href: '/admin/companies.html', icon: 'building' },
        { key: 'departments', label: 'Departments', href: '/admin/departments.html', icon: 'dept' },
        { key: 'reports', label: 'Reports', href: '/admin/reports.html', icon: 'report' },
        { key: 'activity', label: 'Activity Log', href: '/admin/activity-log.html', icon: 'log' },
        { key: 'system-activity', label: 'System Activity', href: '/admin/system-activity.html', icon: 'log' },
        { key: 'messages', label: 'Inbox', href: '/admin/messages.html', icon: 'mail' },
        { key: 'profile', label: 'Profile', href: '/admin/profile.html', icon: 'settings' }
      ];
    }

    if (role === 'client') {
      return [
        { key: 'dashboard', label: 'Dashboard', href: '/client/dashboard.html', icon: 'dashboard' },
        { key: 'requests', label: 'My Requests', href: '/client/requests.html', icon: 'ticket' },
        { key: 'messages', label: 'Inbox', href: '/client/messages.html', icon: 'mail' },
        { key: 'profile', label: 'Profile', href: '/client/profile.html', icon: 'settings' }
      ];
    }

    // default technician/head shell
    return [
      { key: 'dashboard', label: 'Dashboard', href: '/technician/dashboard.html', icon: 'dashboard' },
      { key: 'tickets', label: 'Tickets', href: '/technician/tickets.html', icon: 'ticket' },
      { key: 'activity', label: 'Activity', href: '/technician/activity.html', icon: 'log' },
      { key: 'messages', label: 'Inbox', href: '/technician/messages.html', icon: 'mail' },
      { key: 'profile', label: 'Profile', href: '/technician/profile.html', icon: 'settings' }
    ];
  }

  function getNavHtml(role, user, activeKey) {
    const items = buildNavItems(role);
    const navItems = items.map((it) => `
      <a class="nav-item${activeKey === it.key ? ' active' : ''}" data-nav="${it.key}" href="${it.href}">${icon(it.icon)}<span>${escapeHtml(it.label)}</span></a>
    `).join('');

    const userName = escapeHtml((user && user.name) || (role === 'admin' ? 'Administrator' : 'User'));
    const userMeta = escapeHtml((user && (user.email || user.company_name)) || '');

    return `
      <aside class="sidebar">
        <div class="brand">
          <img src="/assets/logo.png" alt="SMSi">
          <div>
            <strong>SMSi</strong>
            <span>${escapeHtml(role === 'admin' ? 'admin portal' : role === 'client' ? 'client portal' : 'technician portal')}</span>
          </div>
        </div>
        <nav>
          ${navItems}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user-label">Signed in as</div>
          <div class="sidebar-user">${userName}</div>
          <div class="sidebar-company">${userMeta}</div>
          <button id="sidebarLogoutBtn" class="btn secondary sidebar-logout" type="button">Logout</button>
        </div>
      </aside>
    `;
  }

  return {
    getNavHtml
  };
})();

/* ===========================================================
   SESSION HANDLING
=========================================================== */
const SESSION_BASE_KEYS = {
  token: 'woman_token',
  user: 'woman_user',
  id: 'woman_user_id',
  role: 'woman_role',
  company_id: 'woman_company_id',
  company_name: 'woman_company_name',
  department_id: 'woman_department_id',
  department_name: 'woman_department_name',
  exp: 'woman_token_exp'
};

function getPageRole() {
  const rawPath = String(window.location.pathname || window.location.href || '');
  const segments = rawPath.split(/[\/]+/).map((segment) => String(segment || '').trim().toLowerCase()).filter(Boolean);
  const role = segments.find((segment) => ['admin', 'client', 'technician', 'head'].includes(segment));
  return role || '';
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function normalizeStorageRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'head' ? 'technician' : normalized;
}

function buildSessionKey(baseKey, role) {
  const suffix = normalizeStorageRole(role) ? `_${normalizeStorageRole(role)}` : '';
  return `${baseKey}${suffix}`;
}

function storageGet(key, role) {
  const actualKey = buildSessionKey(SESSION_BASE_KEYS[key], role || getPageRole());
  const storedValue = localStorage.getItem(actualKey) || sessionStorage.getItem(actualKey);
  if (storedValue != null) {
    return storedValue;
  }

  // fallback for sessions stored under shared legacy keys
  const legacyKey = SESSION_BASE_KEYS[key];
  return localStorage.getItem(legacyKey) || sessionStorage.getItem(legacyKey);
}

function storageSet(key, value, role) {
  const actualKey = buildSessionKey(SESSION_BASE_KEYS[key], role || getPageRole());
  localStorage.setItem(actualKey, value);
  sessionStorage.setItem(actualKey, value);

  const legacyKey = SESSION_BASE_KEYS[key];
  if (legacyKey !== actualKey) {
    localStorage.setItem(legacyKey, value);
    sessionStorage.setItem(legacyKey, value);
  }
}

function storageRemoveSession(role = getPageRole()) {
  const normalizedRole = normalizeStorageRole(role);
  ['token', 'user', 'id', 'role', 'company_id', 'company_name', 'department_id', 'department_name', 'exp'].forEach((key) => {
    const legacyKey = SESSION_BASE_KEYS[key];
    localStorage.removeItem(legacyKey);
    sessionStorage.removeItem(legacyKey);

    if (normalizedRole) {
      const actualKey = buildSessionKey(SESSION_BASE_KEYS[key], normalizedRole);
      if (actualKey !== legacyKey) {
        localStorage.removeItem(actualKey);
        sessionStorage.removeItem(actualKey);
      }
    }
  });

  if (normalizedRole) {
    try { clearAutoLogout(normalizedRole); } catch (_) {}
  }
}

function getToken() { return storageGet('token'); }

const getUser = () => {
  try {
    return JSON.parse(storageGet('user'));
  } catch {
    return null;
  }
};

const saveSession = (token, user) => {
  const actualRole = normalizeRole(user?.role) || getPageRole();
  const storageRole = normalizeStorageRole(user?.role) || getPageRole();
  if (!actualRole || !storageRole) return;

  storageSet('token', token, storageRole);
  storageSet('user', JSON.stringify(user), storageRole);
  storageSet('role', actualRole, storageRole);
  if (user?.id) {
    storageSet('id', String(user.id), storageRole);
  }
  if (user?.company_id) {
    storageSet('company_id', String(user.company_id), storageRole);
  }
  if (user?.company_name) {
    storageSet('company_name', String(user.company_name), storageRole);
  }
  if (user?.department_id) {
    storageSet('department_id', String(user.department_id), storageRole);
  }
  if (user?.department_name) {
    storageSet('department_name', String(user.department_name), storageRole);
  }

  try { scheduleAutoLogout(token, storageRole); } catch (_) {}
};

function logout(role = getPageRole()) {
  storageRemoveSession(role);
  const path = String(window.location.pathname || '').toLowerCase();
  if (path.endsWith('/login.html') || path === '/login.html') {
    return;
  }
  window.location.href = '/login.html';
}

function saveTokenExpiry(exp, role = getPageRole()) {
  if (!exp) return;
  const storageRole = normalizeStorageRole(role) || getPageRole();
  storageSet('exp', String(exp), storageRole);
}

function clearAutoLogout(role = getPageRole()) {
  if (!window._woman_logout_timeouts) {
    window._woman_logout_timeouts = {};
  }

  const normalizedRole = normalizeStorageRole(role);
  if (!normalizedRole) return;

  if (window._woman_logout_timeouts[normalizedRole]) {
    clearTimeout(window._woman_logout_timeouts[normalizedRole]);
    delete window._woman_logout_timeouts[normalizedRole];
  }

  const expKey = buildSessionKey(SESSION_BASE_KEYS.exp, normalizedRole);
  localStorage.removeItem(expKey);
  sessionStorage.removeItem(expKey);
}

function parseJwt(token) {
  try {
    const part = (token || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function scheduleAutoLogout(token, role = getPageRole()) {
  clearAutoLogout(role);
  if (!token) return;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return;
  saveTokenExpiry(payload.exp, role);
  const ms = payload.exp * 1000 - Date.now();
  if (ms <= 0) {
    logout(role);
    return;
  }
  if (!window._woman_logout_timeouts) {
    window._woman_logout_timeouts = {};
  }
  const normalizedRole = normalizeStorageRole(role);
  window._woman_logout_timeouts[normalizedRole] = setTimeout(() => {
    try { alert('Session expired. You will be logged out.'); } catch (_) {}
    logout(role);
  }, ms + 1000);
}

function isTokenExpired(role = getPageRole()) {
  const exp = Number(storageGet('exp', role));
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

function saveUserSession(user) {
  const actualRole = normalizeRole(user?.role) || getPageRole();
  const storageRole = normalizeStorageRole(user?.role) || getPageRole();
  if (!actualRole || !storageRole) return;

  storageSet('user', JSON.stringify(user), storageRole);
  if (user?.id) {
    storageSet('id', String(user.id), storageRole);
  }
  if (user?.role) {
    storageSet('role', actualRole, storageRole);
  }
  if (user?.company_id) {
    storageSet('company_id', String(user.company_id), storageRole);
  }
  if (user?.company_name) {
    storageSet('company_name', String(user.company_name), storageRole);
  }
  if (user?.department_id) {
    storageSet('department_id', String(user.department_id), storageRole);
  }
  if (user?.department_name) {
    storageSet('department_name', String(user.department_name), storageRole);
  }
}

/* ===========================================================
   CORE REQUEST WRAPPER
=========================================================== */
async function apiRequest(path, options = {}) {
  const token = storageGet('token');

  // if token exists, try to determine expiry (prefer stored expiry, fall back to JWT payload)
  if (token) {
    try {
      const expFromStorage = Number(storageGet('exp')) || 0;
      const jwtPayload = parseJwt(token) || {};
      const exp = expFromStorage || (jwtPayload.exp ? Number(jwtPayload.exp) : 0);
      if (exp && Date.now() >= exp * 1000) {
        try { logout(); } catch (_) {}
        return null;
      }
    } catch (e) {
      // if parsing fails, do not force logout here — let requests fail gracefully
    }
  }

  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      if (path === '/auth/login') {
        return {
          success: false,
          message: data.message || 'Invalid login credentials'
        };
      }

      if (path === '/auth/me') {
        return null;
      }

      const user = getUser();
      const normalizedRole = String(user?.role || '').trim().toLowerCase();
      const allowedRoles = ['admin', 'head', 'client', 'technician'];

      if (allowedRoles.includes(normalizedRole) && normalizedRole !== 'admin') {
        return {
          success: false,
          message: data.message || 'Unauthorized'
        };
      }

      logout();
      return null;
    }

    // If account was disabled server-side, immediately clear session and force re-login
    if (res.status === 403) {
      const msg = String(data?.message || '').toLowerCase();
      if (msg.includes('disabled') || msg.includes('account disabled')) {
        try { alert('Your account has been disabled. You will be logged out.'); } catch (_) {}
        try { logout(); } catch (_) {}
        return null;
      }
    }

    if (!res.ok) {
      return {
        success: false,
        message: data.message || 'Request failed'
      };
    }

    return data;

  } catch (err) {
    console.error('[API ERROR]', path, err);
    return {
      success: false,
      message: 'Network error. Backend unreachable.'
    };
  }
}

/* ===========================================================
   AUTH
=========================================================== */
async function login({ email, password }) {
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (res?.success) {
    saveSession(res.token, res.user);
  }

  return res;
}

async function getMe() {
  const res = await apiRequest('/auth/me');
  return res?.user || null;
}

async function updateProfile(data) {
  return await apiRequest('/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function changePassword(payload) {
  return await apiRequest('/profile/password', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

async function forgotPassword(email) {
  return await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

async function resetPassword(token, new_password) {
  return await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password })
  });
}

async function submitPasswordRecoveryRequest(email) {
  return await apiRequest('/password-recovery', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

/* ===========================================================
   TICKETS
=========================================================== */
async function fetchTickets(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await apiRequest(`/tickets${params ? '?' + params : ''}`);
  return res?.tickets || [];
}

async function fetchMyTickets() {
  const res = await apiRequest('/tickets/mine');
  return res?.tickets || [];
}

async function fetchTicket(id) {
  const res = await apiRequest(`/tickets/${id}`);
  return res?.ticket || null;
}

async function createTicket(payload, attachmentFile) {
  if (attachmentFile) {
    const formData = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      formData.append(key, value);
    });
    formData.append('attachment', attachmentFile);
    return await apiRequest('/tickets', {
      method: 'POST',
      body: formData
    });
  }

  return await apiRequest('/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateTicket(id, payload) {
  return await apiRequest(`/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function updateTicketStatus(id, status) {
  return await apiRequest(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function assignTicket(id, payload) {
  return await apiRequest(`/tickets/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

async function closeTicket(id) {
  return await apiRequest(`/tickets/${id}/close`, {
    method: 'PATCH'
  });
}

async function deleteTicket(id) {
  return await apiRequest(`/tickets/${id}`, {
    method: 'DELETE'
  });
}

/* ===========================================================
   RESPONSES / COMMENTS
=========================================================== */
async function fetchResponses(ticketId) {
  const res = await apiRequest(`/tickets/${ticketId}/responses`);
  return res?.responses || [];
}

async function submitResponse(ticketId, message, internal_note = false, attachmentFile = null) {
  if (attachmentFile) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('internal_note', internal_note ? '1' : '0');
    formData.append('attachment', attachmentFile);
    return await apiRequest(`/tickets/${ticketId}/responses`, {
      method: 'POST',
      body: formData
    });
  }

  return await apiRequest(`/tickets/${ticketId}/responses`, {
    method: 'POST',
    body: JSON.stringify({ message, internal_note })
  });
}

async function deleteResponse(ticketId, responseId) {
  if (!ticketId || !responseId) {
    console.error('[deleteResponse] invalid ids', { ticketId, responseId });
    return { success: false, message: 'Invalid ticket or response id.' };
  }

  const t = encodeURIComponent(String(ticketId));
  const r = encodeURIComponent(String(responseId));
  const path = `/tickets/${t}/responses/${r}`;

  return await apiRequest(path, {
    method: 'DELETE'
  });
}

async function submitFeedback(ticketId, rating, feedback) {
  return await apiRequest(`/tickets/${ticketId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, feedback })
  });
}

/* ===========================================================
   USERS (ADMIN)
=========================================================== */
async function fetchUsers(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await apiRequest(`/users${params ? '?' + params : ''}`);
  return res?.users || [];
}

async function fetchUser(id) {
  const res = await apiRequest(`/users/${id}`);
  return res?.user || null;
}

async function fetchTechnicians() {
  const res = await apiRequest('/users/technicians');
  return res?.users || [];
}

async function fetchManagers() {
  const res = await apiRequest('/users/managers');
  return res?.users || [];
}

async function createUser(payload) {
  return await apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateUser(id, payload) {
  return await apiRequest(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function updateUserStatus(id, is_active) {
  return await apiRequest(`/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active })
  });
}

async function resetUserPassword(id, password) {
  return await apiRequest(`/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password })
  });
}

async function deleteUser(id) {
  return await apiRequest(`/users/${id}`, {
    method: 'DELETE'
  });
}

/* ===========================================================
   COMPANIES
=========================================================== */
async function fetchCompanies() {
  const res = await apiRequest('/companies');
  return res?.companies || [];
}

async function fetchCompany(id) {
  const res = await apiRequest(`/companies/${id}`);
  return res?.company || null;
}

async function createCompany(payload) {
  return await apiRequest('/companies', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateCompany(id, payload) {
  return await apiRequest(`/companies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function deleteCompany(id) {
  return await apiRequest(`/companies/${id}`, {
    method: 'DELETE'
  });
}

/* ===========================================================
   DEPARTMENTS
=========================================================== */
async function fetchDepartments() {
  const res = await apiRequest('/departments');
  return res?.departments || [];
}

/* ===========================================================
   MESSAGING
=========================================================== */
async function sendMessage(payload) {
  // payload: { receiver_id?, message }
  if (!payload) return { success: false, message: 'Invalid payload' };

  const working = { ...payload };

  // If receiver_id not provided, request default admin id from backend.
  if (!working.receiver_id) {
    const adminRes = await apiRequest('/messages/default-admin');
    if (adminRes?.success && adminRes.admin_id) {
      working.receiver_id = adminRes.admin_id;
    } else {
      const defaultAdminId = Number(window.APP_CONFIG?.DEFAULT_ADMIN_ID || 1);
      if (!defaultAdminId) {
        return { success: false, message: adminRes?.message || 'Unable to resolve default admin.' };
      }
      working.receiver_id = defaultAdminId;
    }
  }

  const res = await apiRequest('/messages', {
    method: 'POST',
    body: JSON.stringify(working)
  });

  if (!res) return { success: false, message: 'No response' };
  return res;
}

async function fetchUserMessages(userId) {
  if (!userId) return [];
  const res = await apiRequest(`/messages/user/${encodeURIComponent(String(userId))}`);
  if (!res?.success) return [];
  return res.messages || [];
}

async function fetchAdminMessageThreads() {
  const res = await apiRequest('/messages/admin');
  if (!res?.success) return [];
  return res.threads || [];
}

async function fetchMessageRecipients() {
  const res = await apiRequest('/messages/recipients');
  if (!res?.success) return [];
  return res.recipients || [];
}

async function fetchDepartment(id) {
  const res = await apiRequest(`/departments/${id}`);
  return res?.department || null;
}

async function createDepartment(payload) {
  return await apiRequest('/departments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateDepartment(id, payload) {
  return await apiRequest(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function deleteDepartment(id) {
  return await apiRequest(`/departments/${id}`, {
    method: 'DELETE'
  });
}

/* ===========================================================
   LOGS
=========================================================== */
async function fetchLogs(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const res = await apiRequest(`/logs${params ? '?' + params : ''}`);
  return res?.logs || [];
}

async function fetchTicketLogs(ticketId) {
  const res = await apiRequest(`/logs/ticket/${ticketId}`);
  return res?.logs || [];
}

async function fetchPasswordRecoveryRequests() {
  const res = await apiRequest('/admin/password-recovery-requests');
  return res?.requests || [];
}

async function resolvePasswordRecoveryRequest(requestId) {
  return await apiRequest(`/admin/password-recovery-requests/${requestId}/resolve`, {
    method: 'PATCH'
  });
}

/* ===========================================================
   ROLE GUARD
=========================================================== */
function requireRole(...roles) {
  const user = getUser();

  if (!user) {
    window.location.href = '/login.html';
    return false;
  }

  const normalizedRole = String(user.role || '').trim().toLowerCase();
  const allowedRoles = roles.map((role) => String(role || '').trim().toLowerCase());

  if (!allowedRoles.includes(normalizedRole)) {
    alert('Access denied.');
    history.back();
    return false;
  }

  return true;
}

async function apiFetch(path, options = {}) {
  const normalized = { ...options };

  if (normalized.body && !(normalized.body instanceof FormData) && typeof normalized.body !== 'string') {
    normalized.body = JSON.stringify(normalized.body);
  }

  return apiRequest(path, normalized);
}

// Expose logout to window scope
window.logout = logout;

// Initialize auto-logout scheduler if a valid token exists on load
(function initSession() {
  try {
    const t = storageGet('token');
    if (t) scheduleAutoLogout(t);
  } catch (e) {
    // ignore
  }
})();

