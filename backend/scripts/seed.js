// ============================================================
// Run ONCE after creating the DB schema to insert users
// with properly hashed passwords.
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

const SALT_ROUNDS = 10;

const users = [
  {
    name:     'Administrator',
    email:    'admin@smsi.com',
    password: 'Admin@SMSI2026',
    role:     'admin',
    company_id: null
  },
  {
    name:     'Tech Support',
    email:    'tech@smsi.com',
    password: 'Tech@SMSI2026',
    role:     'technician',
    company_id: null
  },
  {
    name:     'John Reyes',
    email:    'client@testco.com',
    password: 'Client@2026',
    role:     'client',
    company_id: 2    // Test Client Company (must match company seed in database.sql)
  }
];

(async () => {
  try {
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, company_id)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
        [u.name, u.email, hash, u.role, u.company_id]
      );
      console.log(`✅ Seeded: ${u.email} (${u.role})`);
    }
    console.log('\n🎉 All seed users inserted successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
})();