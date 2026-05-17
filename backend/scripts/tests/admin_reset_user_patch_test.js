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
  const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: 'admin@smsi.com', password: 'Admin@SMSI2026' }) });
  if (login.status !== 200) { console.error('Admin login failed', login); process.exit(1); }
  const token = login.body.token;
  const users = await request('/users', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  const target = (users.body?.users || []).find(u => u.email === 'client@testco.com');
  if (!target) { console.error('Target user not found'); process.exit(1); }
  const newPassword = 'PatchClient@2026';
  const patch = await request(`/users/${encodeURIComponent(target.id)}/password`, { method: 'PATCH', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password: newPassword }) });
  console.log('Patch response:', patch.status, patch.body);
  if (patch.status < 200 || patch.status >= 300) { console.error('Patch failed'); process.exit(1); }
  const clientLogin = await request('/auth/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: 'client@testco.com', password: newPassword }) });
  console.log('Client login response:', clientLogin.status, clientLogin.body?.message || clientLogin.body?.user?.email);
  if (clientLogin.status === 200 && clientLogin.body?.token) { console.log('Patch reset verified'); process.exit(0); } else { console.error('Patch verification failed'); process.exit(1); }
}

if (typeof fetch === 'undefined') { console.error('Node fetch not available'); process.exit(1); } else { main().catch(err => { console.error(err); process.exit(1); }); }
