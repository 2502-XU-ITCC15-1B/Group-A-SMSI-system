// ============================================================
// Centralized API client for WOMAN frontend
// Fully aligned with backend routes/services
// ============================================================

const apiBaseUrl = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL || '/api';

/* ===========================================================
   SESSION HANDLING
=========================================================== */
const SESSION_BASE_KEYS = {
  token: 'woman_token',
  user: 'woman_user',
  role: 'woman_role',
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
  return localStorage.getItem(actualKey) || sessionStorage.getItem(actualKey);
}

function storageSet(key, value, role) {
  const actualKey = buildSessionKey(SESSION_BASE_KEYS[key], role || getPageRole());
  localStorage.setItem(actualKey, value);
  sessionStorage.setItem(actualKey, value);
}

function storageRemoveSession(role = getPageRole()) {
  const normalizedRole = normalizeStorageRole(role);
  if (!normalizedRole) return;

  ['token', 'user', 'role', 'exp'].forEach((key) => {
    const actualKey = buildSessionKey(SESSION_BASE_KEYS[key], normalizedRole);
    localStorage.removeItem(actualKey);
    sessionStorage.removeItem(actualKey);
  });
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
  const role = normalizeStorageRole(user?.role) || getPageRole();
  if (!role) return;

  storageSet('token', token, role);
  storageSet('user', JSON.stringify(user), role);
  storageSet('role', role, role);
};

function logout(role = getPageRole()) {
  storageRemoveSession(role);
  window.location.href = '/login.html';
}

function saveUserSession(user) {
  const role = normalizeStorageRole(user?.role) || getPageRole();
  if (!role) return;

  if (user && user.token) {
    storageSet('token', user.token, role);
  }

  storageSet('user', JSON.stringify(user), role);
  storageSet('role', role, role);
}

/* ===========================================================
   CORE REQUEST WRAPPER
=========================================================== */
async function apiRequest(path, options = {}) {
  const token = storageGet('token');

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

/* ===========================================================
   MESSAGES
=========================================================== */
async function sendMessage(payload) {
  return await apiRequest('/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function fetchUserMessages(userId) {
  const res = await apiRequest(`/messages/user/${userId}`);
  return res?.messages || [];
}

async function fetchAdminMessageThreads() {
  const res = await apiRequest('/messages/admin');
  return res?.threads || [];
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


