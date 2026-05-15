// -------------------------------------------------------
// Creates a PostgreSQL connection pool shared across all services.
// Using a pool (instead of a single connection) prevents
// "too many connections" crashes under concurrent requests.
// -------------------------------------------------------

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, // max simultaneous DB connections
});

// -------------------------------------------------------
// PostgreSQL connection retry logic (prevents crash on startup)
// -------------------------------------------------------
async function connectWithRetry(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ PostgreSQL connected to:', process.env.DATABASE_URL);
      client.release();
      return;
    } catch (err) {
      console.log(`⏳ PostgreSQL not ready (${i + 1}/${retries})... retrying`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.error('❌ PostgreSQL failed after retries');
  process.exit(1);
}

// Run DB connection check
connectWithRetry();

module.exports = pool;