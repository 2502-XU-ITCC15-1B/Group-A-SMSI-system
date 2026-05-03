// ============================================================
// Centralized API client for the WOMAN frontend.
// All fetch() calls go through this file.
//
// Auth flow:
//   1. login()  → stores the JWT in sessionStorage
//   2. All other calls automatically attach the Bearer token
//   3. logout() → clears sessionStorage and redirects to login
// ============================================================

 const API_BASE_URL = window.API_BASE_URL;

// ── Token helpers ──────────────────────────────────────────
const getToken = ()       => sessionStorage.getItem('woman_token');
const getUser  = ()       => JSON.parse(sessionStorage.getItem('woman_user') || 'null');
const saveSession = (token, user) => {
  sessionStorage.setItem('woman_token',  token);
  sessionStorage.setItem('woman_user',   JSON.stringify(user));
  sessionStorage.setItem('woman_role',   user.role);
};
 
// ── Core request wrapper ───────────────────────────────────
// Automatically adds Content-Type and Authorization headers.
// Redirects to login.html on 401 Unauthorized.
async function apiRequest(path, options = {}) {
  const token = getToken();
 
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
 
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
 
    // Auto-logout on expired/invalid token
    if (res.status === 401) {
      logout();
      return null;
    }
 
    return await res.json();
 
  } catch (err) {
    console.error(`[API] Request failed — ${path}:`, err.message);
    return { success: false, message: 'Connection error. Is the server running?' };
  }
}
 
// ── AUTH ───────────────────────────────────────────────────
 
// login({ email, password })
// Returns { success, token, user } or { success: false, message }
async function login({ email, password }) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body:   JSON.stringify({ email, password })
  });
 
  if (data?.success) {
    saveSession(data.token, data.user);
  }
 
  return data;
}
 
// logout() — clears local session and redirects
function logout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}
 
// getMe() — fetch the current user's profile from the server
async function getMe() {
  return await apiRequest('/auth/me');
}
 
// ── TICKETS ────────────────────────────────────────────────
 
// fetchTickets(filters)  e.g. fetchTickets({ status: 'Open', company_id: 1 })
async function fetchTickets(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const path   = `/tickets${params ? '?' + params : ''}`;
  const data   = await apiRequest(path);
  return data?.tickets || [];
}
 
// fetchTicket(id) — single ticket with full detail
async function fetchTicket(id) {
  const data = await apiRequest(`/tickets/${id}`);
  return data?.ticket || null;
}
 
// createTicket({ title, description, priority, company_id? })
async function createTicket(payload) {
  return await apiRequest('/tickets', {
    method: 'POST',
    body:   JSON.stringify(payload)
  });
}
 
// updateTicketStatus(id, status)
async function updateTicketStatus(id, status) {
  return await apiRequest(`/tickets/${id}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status })
  });
}
 
// assignTicket(ticketId, technicianId)
async function assignTicket(ticketId, technicianId) {
  return await apiRequest(`/tickets/${ticketId}/assign`, {
    method: 'PATCH',
    body:   JSON.stringify({ technician_id: technicianId })
  });
}
 
// ── RESPONSES ──────────────────────────────────────────────
 
// fetchResponses(ticketId)
async function fetchResponses(ticketId) {
  const data = await apiRequest(`/tickets/${ticketId}/responses`);
  return data?.responses || [];
}
 
// submitResponse(ticketId, message)
async function submitResponse(ticketId, message) {
  return await apiRequest(`/tickets/${ticketId}/responses`, {
    method: 'POST',
    body:   JSON.stringify({ message })
  });
}
 
// ── USERS (admin only) ─────────────────────────────────────
async function fetchUsers(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const data   = await apiRequest(`/users${params ? '?' + params : ''}`);
  return data?.users || [];
}
 
async function fetchTechnicians() {
  const data = await apiRequest('/users/technicians');
  return data?.technicians || [];
}
 
async function createUser(payload) {
  return await apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) });
}
 
// ── COMPANIES (admin only) ─────────────────────────────────
async function fetchCompanies() {
  const data = await apiRequest('/companies');
  return data?.companies || [];
}
 
async function createCompany(payload) {
  return await apiRequest('/companies', { method: 'POST', body: JSON.stringify(payload) });
}
 
// ── LOGS (admin / technician) ──────────────────────────────
async function fetchLogs(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  const data   = await apiRequest(`/logs${params ? '?' + params : ''}`);
  return data?.logs || [];
}
 
async function fetchTicketLogs(ticketId) {
  const data = await apiRequest(`/logs/ticket/${ticketId}`);
  return data?.logs || [];
}
 
// ── Guard helper (call at top of each protected page) ──────
// Usage:  requireRole('admin') or requireRole('admin','technician')
function requireRole(...allowedRoles) {
  const user = getUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  if (!allowedRoles.includes(user.role)) {
    alert('⚠️ Access denied. You do not have permission to view this page.');
    history.back();
    return false;
  }
  return true;
}