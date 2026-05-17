#!/usr/bin/env node
/**
 * cleanup_companies.js
 * Simple script to remove a company record by name (e.g. 'John Reyes')
 * Usage:
 *   node backend/scripts/cleanup_companies.js         # runs deletion
 *   DRY_RUN=1 node backend/scripts/cleanup_companies.js  # lists matches without deleting
 */

const pool = require('../config/db');

const TARGET_NAME = process.env.COMPANY_NAME || 'John Reyes';
const DRY_RUN = !!process.env.DRY_RUN;

async function run() {
  try {
    console.log(`Searching for companies with name = "${TARGET_NAME}"`);
    const [rows] = await pool.query('SELECT id, name, contact_email FROM companies WHERE name = ?', [TARGET_NAME]);
    if (!rows.length) {
      console.log('No matching company records found.');
      process.exit(0);
    }

    console.log('Matches:');
    rows.forEach((r) => console.log(`  id=${r.id} name=${r.name} email=${r.contact_email}`));

    if (DRY_RUN) {
      console.log('DRY_RUN enabled — no deletions performed.');
      process.exit(0);
    }

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [delResult] = await pool.query(`DELETE FROM companies WHERE id IN (${placeholders})`, ids);
    console.log(`Deleted ${delResult.affectedRows} company record(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Error running cleanup:', err.message || err);
    process.exit(2);
  }
}

run();
