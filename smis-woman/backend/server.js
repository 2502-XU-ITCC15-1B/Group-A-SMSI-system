require('dotenv').config();
 
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
 
// ── DB pool (import triggers the connection health check) ──
require('./config/db');
const { applyMigrations } = require('./scripts/run_migrations');

// Apply database migrations automatically on startup.
(async () => {
  try {
    await applyMigrations();
  } catch (err) {
    console.error('Failed to apply migrations:', err.message || err);
    process.exit(1);
  }
})();
 
// ── Route modules ──────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const ticketRoutes     = require('./routes/tickets.routes');
const userRoutes       = require('./routes/users.routes');
const messagesRoutes   = require('./routes/messages.routes');
const companyRoutes    = require('./routes/companies.routes');
const departmentRoutes = require('./routes/departments.routes'); 
const logRoutes        = require('./routes/logs.routes');
const profileRoutes    = require('./routes/profile.routes');
const adminRoutes      = require('./routes/admin.routes');
const passwordRecoveryRoutes = require('./routes/password-recovery.routes');
 
// ── App setup ──────────────────────────────────────────────
const app = express();
 
// CORS — tighten origin in production by setting ALLOWED_ORIGIN in .env
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
 
app.use(express.json());

// Ensure uploads folders exist for attachments and avatars
const uploadsRoot = path.join(__dirname, 'uploads');
const ticketResponsesDir = path.join(uploadsRoot, 'ticket_responses');
const usersDir = path.join(uploadsRoot, 'users');
[uploadsRoot, ticketResponsesDir, usersDir].forEach((d) => { try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch (e) { console.warn('Failed to create upload dir', d, e && e.message); } });

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Serve frontend static files ────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Health check (public — no auth required) ───────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true, 
    status:  'ok',
    system:  'WOMAN API',
    version: '2.0.0',
    time:    new Date().toISOString()
  });
});
 
// ── API routes ─────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/tickets',     ticketRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/messages',    messagesRoutes);
app.use('/api/companies',   companyRoutes);
app.use('/api/departments', departmentRoutes); 
app.use('/api/logs',        logRoutes);
app.use('/api/profile',     profileRoutes);
// Mount password-recovery routes before the admin router so the dedicated
// password-recovery endpoints under `/api/admin/*` are not shadowed by
// the `/api/admin` router which doesn't define them.
app.use('/api',             passwordRecoveryRoutes);
app.use('/api/admin',       adminRoutes);
 
// ── 404 handler — unknown API routes ──────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
});

// ── SPA fallback — serve index.html for all other routes ───
// This allows frontend routing (React Router, etc.) to work
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});
 
// ── Global error handler ───────────────────────────────────
// Catches any error passed via next(err) or thrown inside async middleware
// when using Express 5 (which auto-wraps async errors).
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred.'
  });
});
 
// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WOMAN API running on port ${PORT}`);
  console.log(`Health check → http://localhost:${PORT}/api/health`);
});
 
module.exports = app;
