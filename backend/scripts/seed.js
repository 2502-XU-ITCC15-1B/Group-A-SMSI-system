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
    name: 'Systems Head',
    email: 'Systems@smsi.com',
    password: 'Systems@SMSI2026',
    phone: '+1-555-0102',
    role: 'head',
    company_id: null,
    department_id: 1
  },
  {
    name: 'System Developer 1',
    email: 'SysDev1@smsi.com',
    password: 'Dev1@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 1
  },
  {
    name: 'System Developer 2',
    email: 'SysDev2@smsi.com',
    password: 'Dev2@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 1
  },
  {
    name: 'System Developer 3',
    email: 'SysDev3@smsi.com',
    password: 'Dev3@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 1
  },
  {
    name: 'Web & Graphics Services Head',
    email: 'W&GS@smsi.com',
    password: 'W&GS@SMSI2026',
    phone: '+1-555-0103',
    role: 'head',
    company_id: null,
    department_id: 2
  },
  {
    name: 'Graphic Designers1',
    email: 'GraphDesigners1@smsi.com',
    password: 'GraphDesigners1@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 2
  },
  {
    name: 'Graphic Designers2',
    email: 'GraphDesigners2@smsi.com',
    password: 'GraphDesigners2@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 2
  },
  {
    name: 'Technical Support Head',
    email: 'TS@smsi.com',
    password: 'TS@2026',
    phone: '+1-555-0104',
    role: 'head',
    company_id: null,
    department_id: 3
  },
  {
    name: 'IT Specialist 1',
    email: 'ITSpecialist1@smsi.com',
    password: 'ITSpecialist1@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 3
  },
  {
    name: 'IT Specialist 2',
    email: 'ITSpecialist2@smsi.com',
    password: 'ITSpecialist2@SMSI2026',
    phone: '+1-555-0102',
    role: 'technician',
    company_id: null,
    department_id: 3
  },
  {
    name: 'Operations Head',
    email: 'Operations@smsi.com',
    password: 'OP@2026',
    phone: '+1-555-0105',
    role: 'head',
    company_id: null,
    department_id: 4
  },
  {
    name: 'Operations Associate 1',
    email: 'OPAssociate1@smsi.com',
    password: 'OPAssociate1@2026',
    phone: '+1-555-0105',
    role: 'technician',
    company_id: null,
    department_id: 4
  },
  {
    name: 'Operations Associate 2',
    email: 'OPAssociate2@smsi.com',
    password: 'OPAssociate2@2026',
    phone: '+1-555-0105',
    role: 'technician',
    company_id: null,
    department_id: 4
  },
  {
    name: 'John Reyes',
    email: 'client@testco.com',
    password: 'Client@2026',
    phone: '+1-555-0107',
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
  { id: 1, name: 'Systems Development', manager_email: 'Systems@smsi.com', is_active: 1 },
  { id: 2, name: 'Web & Graphics Services', manager_email: 'W&GS@smsi.com', is_active: 1 },
  { id: 3, name: 'Technical Support', manager_email: 'TS@smsi.com', is_active: 1 },
  { id: 4, name: 'Operations', manager_email: 'Operations@smsi.com', is_active: 1 }
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

    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    // ---------------- USERS ----------------
    for (const u of users) {
      // normalize and validate
      u.name = String(u.name || '').trim();
      u.email = String(u.email || '').trim().toLowerCase();
      if (!u.email || !u.email.includes('@')) {
        throw new Error(`Invalid user email in seed data: ${u.email}`);
      }

      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);

      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, company_id, department_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           company_id = VALUES(company_id),
           department_id = VALUES(department_id),
           is_active = 1`,
        [u.name, u.email, hash, u.role, u.company_id, u.department_id, 1]
      );
    }

    // map inserted user emails to IDs (build dynamic placeholders)
    const userEmails = users.map((user) => String(user.email || '').trim().toLowerCase());
    const userPlaceholders = userEmails.map(() => '?').join(', ');
    const [seedUsers] = await pool.query(
      `SELECT id, email FROM users WHERE email IN (${userPlaceholders})`,
      userEmails
    );

    userIds = seedUsers.reduce((map, user) => {
      map[String(user.email).trim().toLowerCase()] = user.id;
      return map;
    }, {});

    // ---------------- COMPANIES ----------------
    for (const c of companies) {
      await pool.query(
        `INSERT INTO companies (id, name, contact_person, contact_email, is_active)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [c.id, c.name, c.contact_person, c.contact_email, c.is_active]
      );
    }

    // ---------------- DEPARTMENTS ----------------
    for (const d of departments) {
      const managerId = userIds[String(d.manager_email || '').trim().toLowerCase()] || null;
      await pool.query(
        `INSERT INTO departments (id, name, manager_id, is_active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           manager_id = VALUES(manager_id),
           is_active = VALUES(is_active)`,
        [d.id, d.name, managerId, d.is_active]
      );
    }

    // ---------------- TICKETS ----------------
    for (const t of tickets) {
      await pool.query(
        `INSERT INTO tickets
         (work_order_id, title, description, company_id, department_id,
          requestor_id, technician_id, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           description = VALUES(description),
           company_id = VALUES(company_id),
           department_id = VALUES(department_id),
           requestor_id = VALUES(requestor_id),
           technician_id = VALUES(technician_id),
           priority = VALUES(priority),
           status = VALUES(status),
           is_deleted = 0`,
        [
          t.work_order_id,
          t.title,
          t.description,
          t.company_id,
          t.department_id,
          userIds['client@testco.com'],
          userIds['sysdev1@smsi.com'],
          t.priority,
          t.status
        ]
      );
    }

    const [seedTickets] = await pool.query(
      `SELECT id, work_order_id FROM tickets
       WHERE work_order_id IN (?)`,
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
         VALUES (?, ?, ?, ?)`,
        [ticketIds['WO-2026-0001'], userIds['sysdev1@smsi.com'], r.message, r.internal_note]
      );
    }

    // ---------------- LOGS ----------------
    for (const l of logs) {
      await pool.query(
        `INSERT INTO activity_logs (ticket_id, user_id, action, details)
         VALUES (?, ?, ?, ?)`,
        [ticketIds['WO-2026-0001'], userIds['admin@smsi.com'], l.action, l.details]
      );
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Seed completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
