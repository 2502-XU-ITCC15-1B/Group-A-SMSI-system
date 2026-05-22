require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log('Applying migration:', file);
    const statements = sql
      .split(/;\s*\n/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        const ignorableErrorCodes = [
          'ER_DUP_FIELDNAME',
          'ER_DUP_KEYNAME',
          'ER_TABLE_EXISTS_ERROR',
          'ER_DUP_ENTRY',
          'ER_BAD_FIELD_ERROR'
        ];

        if (err && err.code && ignorableErrorCodes.includes(err.code)) {
          console.log(`Skipping already applied step: ${err.code} - ${err.message}`);
          continue;
        }

        throw err;
      }
    }
  }

  console.log('Migrations applied successfully');
}

if (require.main === module) {
  (async () => {
    try {
      await applyMigrations();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error.message || error);
      process.exit(1);
    }
  })();
}

module.exports = { applyMigrations };