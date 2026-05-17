// ============================================================
// Centralized API client for WOMAN frontend
// Fully aligned with backend routes/services
// ============================================================

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('API_BASE_URL is not configured. Load frontend/js/config.js before frontend/js/api.js.');
}

/* ===========================================================
   SESSION HANDLING
=========================================================== */
const sessionKeys = ['woman_token', 'woman_user', 'woman_role'];
const TOKEN_EXP_KEY = 'woman_token_exp';

function storageGet(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function storageSet(key, value) {
  localStorage.setItem(key, value);
  sessionStorage.setItem(key, value);
}

function storageRemoveSession() {
  sessionKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  // clear stored token expiry and any scheduled auto-logout
  try { clearAutoLogout(); } catch (_) {}
}

const getToken = () => storageGet('woman_token');

const getUser = () => {
  try {
    return JSON.parse(storageGet('woman_user'));
  } catch {
    return null;
  }
};

const saveSession = (token, user) => {
  storageSet('woman_token', token);
  storageSet('woman_user', JSON.stringify(user));
  storageSet('woman_role', user.role);
  // schedule auto-logout based on token expiry
  try { scheduleAutoLogout(token); } catch (_) {}
};

function logout() {
  storageRemoveSession();
  window.location.href = '/login.html';
}

function saveTokenExpiry(exp) {
  if (!exp) return;
  storageSet(TOKEN_EXP_KEY, String(exp));
}

function clearAutoLogout() {
  if (window._woman_logout_timeout) {
    clearTimeout(window._woman_logout_timeout);
    window._woman_logout_timeout = null;
  }
  localStorage.removeItem(TOKEN_EXP_KEY);
  sessionStorage.removeItem(TOKEN_EXP_KEY);
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

function scheduleAutoLogout(token) {
  clearAutoLogout();
  if (!token) return;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return;
  saveTokenExpiry(payload.exp);
  const ms = payload.exp * 1000 - Date.now();
  if (ms <= 0) {
    // already expired
    logout();
    return;
  }
  // add small buffer
  window._woman_logout_timeout = setTimeout(() => {
    try { alert('Session expired. You will be logged out.'); } catch (_) {}
    logout();
  }, ms + 1000);
}

function isTokenExpired() {
  const exp = Number(storageGet(TOKEN_EXP_KEY));
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

function saveUserSession(user) {
  storageSet('woman_user', JSON.stringify(user));
  storageSet('woman_role', user.role);
}

/* ===========================================================
   CORE REQUEST WRAPPER
=========================================================== */
async function apiRequest(path, options = {}) {
  const token = getToken();

  // if token exists but is expired, force logout immediately
  if (token && isTokenExpired()) {
    try { logout(); } catch (_) {}
    return null;
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
      logout();
      return null;
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
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('priority', payload.priority);
    if (payload.requestor_id) formData.append('requestor_id', payload.requestor_id);
    if (payload.client_id) formData.append('client_id', payload.client_id);
    if (payload.company_id) formData.append('company_id', payload.company_id);
    if (payload.department_id) formData.append('department_id', payload.department_id);
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

  if (!roles.includes(user.role)) {
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
    const t = getToken();
    if (t) scheduleAutoLogout(t);
  } catch (e) {
    // ignore
  }
})();
