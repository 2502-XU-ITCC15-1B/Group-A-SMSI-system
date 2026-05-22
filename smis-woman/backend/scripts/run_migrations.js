require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log('Applying:', file);
    await pool.query(sql);
  }
  console.log('Migrations applied successfully');
}

if (require.main === module) {
  (async () => {
    try {
      await applyMigrations();
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err.message || err);
      process.exit(1);
    }
  })();
}

module.exports = { applyMigrations };