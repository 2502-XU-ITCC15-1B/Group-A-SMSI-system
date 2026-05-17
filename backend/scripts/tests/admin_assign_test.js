// Simple Node script to simulate admin login, create a ticket, and assign it to a department.
// Measures response time for the assign call.

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

  // 1) login as seeded admin
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smsi.com', password: 'Admin@SMSI2026' })
  });

  if (login.status !== 200 || !login.body || !login.body.token) {
    console.error('Login failed:', login);
    process.exit(1);
  }

  const token = login.body.token;
  console.log('Logged in as:', login.body.user?.email || 'admin', 'userId:', login.body.user?.id || 'unknown');

  // 2) create a ticket as admin (admin becomes requestor if not specified)
  const create = await request('/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ title: 'E2E assign test', priority: 'Low', description: 'Test ticket for assign flow' })
  });

  if (create.status !== 200 && create.status !== 201) {
    console.error('Ticket create failed:', create);
    process.exit(1);
  }

  const ticketId = create.body?.ticket?.id || create.body?.id || create.body?.ticketId;
  if (!ticketId) {
    console.error('Unable to determine ticket id from create response:', create);
    process.exit(1);
  }

  console.log('Created ticket id:', ticketId);

  // 3) ensure a department exists to assign to
  const deps = await request('/departments', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
  let deptId = 2; // fallback
  if (Array.isArray(deps.body?.departments) && deps.body.departments.length > 0) {
    deptId = deps.body.departments[0].id;
    console.log('Found existing department id:', deptId);
  } else {
    // create one
    const createDep = await request('/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: 'Auto Test Dept', manager_email: 'head@smsi.com', is_active: 1 })
    });
    if (createDep.status >= 200 && createDep.status < 300) {
      deptId = createDep.body?.department?.id || createDep.body?.id;
      console.log('Created department id:', deptId);
    } else {
      console.error('Failed to ensure department exists:', createDep);
      process.exit(1);
    }
  }

  // 4) assign to department (measure response time)
  const assignPayload = { department_id: deptId };
  const t0 = Date.now();
  const assign = await request(`/tickets/${encodeURIComponent(ticketId)}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(assignPayload)
  });
  const t1 = Date.now();
  const durationMs = t1 - t0;

  console.log('Assign status:', assign.status, 'duration_ms:', durationMs);
  console.log('Assign body:', assign.body);

  // Summary
  if (assign.status >= 200 && assign.status < 300) {
    console.log('Assign flow succeeded. Response time (ms):', durationMs);
    process.exit(0);
  } else {
    console.error('Assign flow failed. Response:', assign);
    process.exit(1);
  }
}

// Node 18+ has global fetch. If not available, instruct user.
if (typeof fetch === 'undefined') {
  console.error('Global fetch is not available in this Node runtime. Use Node 18+ or install node-fetch.');
  process.exit(1);
} else {
  main().catch((err) => { console.error('Test failed:', err); process.exit(1); });
}
