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

// Quick health-check on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL pool connected to:', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL pool connection failed:', err.message);
    process.exit(1);   // crash fast — don't run a broken server
  });

module.exports = pool;