// ============================================================
// Run ONCE after creating the DB schema to seed initial data
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

const SALT_ROUNDS = 10;

// ------------------------------------------------------------
// USERS
// ------------------------------------------------------------
const users = [
  {
    name: 'Administrator',
    email: 'admin@smsi.com',
    password: 'Admin@SMSI2026',
    phone: '+1-555-0101',
    role: 'admin',
    company_id: null,
    department_id: null
  },
  {
    name: 'Tech Support',
    email: 'tech@smsi.com',
    password: 'Tech@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 1
  },
  {
    name: 'Department Head',
    email: 'head@smsi.com',
    password: 'Head@SMSI2026',
    phone: '+1-555-0103',
    role: 'head',
    company_id: null,
    department_id: 1
  },
  {
    name: 'John Reyes',
    email: 'client@testco.com',
    password: 'Client@2026',
    phone: '+1-555-0104',
    role: 'client',
    company_id: 1,
    department_id: null
  }
];

let userIds = {};
let ticketIds = {};

// ------------------------------------------------------------
// COMPANIES
// ------------------------------------------------------------
const companies = [
  {
    id: 1,
    name: 'Test Company',
    contact_person: 'Jane Doe',
    contact_email: 'contact@testco.com',
    is_active: 1
  }
];

// ------------------------------------------------------------
// DEPARTMENTS
// ------------------------------------------------------------
const departments = [
  {
    id: 1,
    name: 'IT Support',
    manager_id: 3,
    is_active: 1
  }
];

// ------------------------------------------------------------
// TICKETS
// ------------------------------------------------------------
const tickets = [
  {
    work_order_id: 'WO-2026-0001',
    title: 'Cannot access email',
    description: 'User cannot log in to email account',
    company_id: 1,
    department_id: 1,
    requestor_id: 4,
    technician_id: 2,
    priority: 'High',
    status: 'Open'
  }
];

// ------------------------------------------------------------
// RESPONSES (ticket_responses table)
// ------------------------------------------------------------
const responses = [
  {
    ticket_id: 1,
    user_id: 2,
    message: 'We are investigating the issue.',
    internal_note: 0
  }
];

// ------------------------------------------------------------
// ACTIVITY LOGS
// ------------------------------------------------------------
const logs = [
  {
    ticket_id: 1,
    user_id: 1,
    action: 'SYSTEM_INIT',
    details: 'Initial seed data created.'
  }
];

// ============================================================
// SEED EXECUTION
// ============================================================

(async () => {
  try {

    // ---------------- USERS ----------------
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);

      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, company_id, department_id, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           company_id = EXCLUDED.company_id,
           department_id = EXCLUDED.department_id,
           phone = COALESCE(EXCLUDED.phone, users.phone),
           is_active = 1`,
        [u.name, u.email, hash, u.role, u.company_id, u.department_id, u.phone || null]
      );
    }

    const [seedUsers] = await pool.query(
      `SELECT id, email FROM users
       WHERE email = ANY($1)`,
      [users.map((user) => user.email)]
    );

    userIds = seedUsers.reduce((map, user) => {
      map[user.email] = user.id;
      return map;
    }, {});

    // ---------------- COMPANIES ----------------
    for (const c of companies) {
      await pool.query(
        `INSERT INTO companies (id, name, contact_person, contact_email, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [c.id, c.name, c.contact_person, c.contact_email, c.is_active]
      );
    }

    // ---------------- DEPARTMENTS ----------------
    for (const d of departments) {
      await pool.query(
        `INSERT INTO departments (id, name, manager_id, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           manager_id = EXCLUDED.manager_id,
           is_active = EXCLUDED.is_active`,
        [d.id, d.name, userIds['head@smsi.com'], d.is_active]
      );
    }

    // ---------------- TICKETS ----------------
    for (const t of tickets) {
      await pool.query(
        `INSERT INTO tickets
         (work_order_id, title, description, company_id, department_id,
          requestor_id, technician_id, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (work_order_id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           company_id = EXCLUDED.company_id,
           department_id = EXCLUDED.department_id,
           requestor_id = EXCLUDED.requestor_id,
           technician_id = EXCLUDED.technician_id,
           priority = EXCLUDED.priority,
           status = EXCLUDED.status,
           is_deleted = 0`,
        [
          t.work_order_id,
          t.title,
          t.description,
          t.company_id,
          t.department_id,
          userIds['client@testco.com'],
          userIds['tech@smsi.com'],
          t.priority,
          t.status
        ]
      );
    }

    const [seedTickets] = await pool.query(
      `SELECT id, work_order_id FROM tickets
       WHERE work_order_id = ANY($1)`,
      [tickets.map((ticket) => ticket.work_order_id)]
    );

    ticketIds = seedTickets.reduce((map, ticket) => {
      map[ticket.work_order_id] = ticket.id;
      return map;
    }, {});

    // ---------------- RESPONSES ----------------
    for (const r of responses) {
      await pool.query(
        `INSERT INTO ticket_responses (ticket_id, user_id, message, internal_note)
         VALUES ($1, $2, $3, $4)`,
        [ticketIds['WO-2026-0001'], userIds['tech@smsi.com'], r.message, r.internal_note]
      );
    }

    // ---------------- LOGS ----------------
    for (const l of logs) {
      await pool.query(
        `INSERT INTO activity_logs (ticket_id, user_id, action, details)
         VALUES ($1, $2, $3, $4)`,
        [ticketIds['WO-2026-0001'], userIds['admin@smsi.com'], l.action, l.details]
      );
    }

    console.log('Seed completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
