// -------------------------------------------------------
// Creates a PostgreSQL connection pool shared across all services.
// Using a pool (instead of a single connection) prevents
// "too many connections" crashes under concurrent requests.
// -------------------------------------------------------

const { Pool } = require('pg');

function buildConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (!process.env.DB_HOST) {
    return undefined;
  }

  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const password = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : '';
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || 5432;
  const database = process.env.DB_NAME || 'postgres';

  return `postgresql://${user}${password}@${host}:${port}/${database}`;
}

const connectionString = buildConnectionString();

const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // max simultaneous DB connections
});

// -------------------------------------------------------
// PostgreSQL connection retry logic (prevents crash on startup)
// -------------------------------------------------------
async function connectWithRetry(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ PostgreSQL connected to:', connectionString || 'default pg environment');
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