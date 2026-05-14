// -------------------------------------------------------
// Creates a MySQL connection pool shared across all services.
// Using a pool (instead of a single connection) prevents
// "too many connections" crashes under concurrent requests.
// -------------------------------------------------------

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              process.env.DB_PORT     || 3306,
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'woman_db',
  waitForConnections: true,
  connectionLimit:   10,          // max simultaneous DB connections
  queueLimit:        0,           // unlimited queued requests
  // Enable SSL when connecting to a cloud DB (e.g. Aiven, PlanetScale)
  // ssl: { rejectUnauthorized: false }
});

// -------------------------------------------------------
// MySQL connection retry logic (prevents crash on startup)
// -------------------------------------------------------
async function connectWithRetry(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      console.log('✅ MySQL connected to:', process.env.DB_NAME);
      conn.release();
      return;
    } catch (err) {
      console.log(`⏳ MySQL not ready (${i + 1}/${retries})... retrying`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.error('❌ MySQL failed after retries');
  process.exit(1);
}

// Run DB connection check
connectWithRetry();

module.exports = pool;