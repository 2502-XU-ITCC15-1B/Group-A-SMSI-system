// Test: Admin resets a user's password via PUT /api/users/:id with `password` in payload
const API_BASE = process.env.API || 'http://localhost:5000/api';

async function request(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  return { status: res.status, body: json };
}

async function main() {
  console.log('API base:', API_BASE);
  // login as admin
  const login = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smsi.com', password: 'Admin@SMSI2026' })
  });
  if (login.status !== 200 || !login.body?.token) {
    console.error('Admin login failed:', login); process.exit(1);
  }
  const token = login.body.token;
  // find client user
  const users = await request('/users', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  const target = (users.body?.users || []).find(u => u.email === 'client@testco.com');
  if (!target) { console.error('Target user not found in users list'); process.exit(1); }
  console.log('Target user id:', target.id);

  const newPassword = 'NewClient@2026';
  const upd = await request(`/users/${encodeURIComponent(target.id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name: target.name, email: target.email, role: target.role, password: newPassword })
  });
  console.log('Update response:', upd.status, upd.body);
  if (!(upd.status >=200 && upd.status < 300)) { console.error('Update failed'); process.exit(1); }

  // attempt login as client with new password
  const clientLogin = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'client@testco.com', password: newPassword })
  });
  console.log('Client login response:', clientLogin.status, clientLogin.body?.message || clientLogin.body?.user?.email || clientLogin.body);
  if (clientLogin.status === 200 && clientLogin.body?.token) {
    console.log('Password reset verified: client can login with new password.');
    process.exit(0);
  } else {
    console.error('Password reset verification failed.');
    process.exit(1);
  }
}

if (typeof fetch === 'undefined') {
  console.error('Global fetch is not available. Use Node 18+'); process.exit(1);
} else {
  main().catch(err => { console.error(err); process.exit(1); });
}
