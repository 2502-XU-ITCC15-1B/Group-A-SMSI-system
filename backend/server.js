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
const companyRoutes    = require('./routes/companies.routes');
const departmentRoutes = require('./routes/departments.routes'); 
const logRoutes        = require('./routes/logs.routes');
const profileRoutes    = require('./routes/profile.routes');
const adminRoutes      = require('./routes/admin.routes');
const passwordRecoveryRoutes = require('./routes/password-recovery.routes');
const messagesRoutes   = require('./routes/messages.routes');
const { authenticate, authorize } = require('./middleware/auth');
const ticketService = require('./services/ticket.service');
 
// ── App setup ──────────────────────────────────────────────
const app = express();
 
// CORS — tighten origin in production by setting ALLOWED_ORIGIN in .env
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
 
app.use(express.json());
// Ensure uploads directory exists so multer can write files
const uploadsDir = path.join(__dirname, 'uploads', 'ticket_responses');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('[Server] ensured uploads directory exists:', uploadsDir);
} catch (e) {
  console.error('[Server] failed to create uploads directory:', e.message);
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple API request logger to aid debugging routes
app.use((req, res, next) => {
  if (String(req.originalUrl || '').startsWith('/api/')) {
    console.log(`[API REQ] ${req.method} ${req.originalUrl} - Auth: ${req.headers.authorization ? 'present' : 'none'}`);
  }
  next();
});
 
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
app.use('/api/companies',   companyRoutes);
app.use('/api/departments', departmentRoutes); 
app.use('/api/logs',        logRoutes);
app.use('/api/profile',     profileRoutes);
app.use('/api/messages',    messagesRoutes);
// Ensure password-recovery routes are mounted before the admin router so
// requests to `/api/admin/password-recovery-requests` are handled by the
// dedicated password-recovery router instead of being captured (and 404'd)
// by the `/api/admin` router which doesn't define that path.
app.use('/api',             passwordRecoveryRoutes);
app.use('/api/admin',       adminRoutes);
 
// Fallback DELETE handler for ticket response removals.
// This catches malformed or variant DELETE requests that might not match
// the router (helps older frontends or unexpected URL shapes). It still
// enforces authentication and admin authorization before delegating.
app.delete('/api/tickets/*', authenticate, authorize('admin'), async (req, res) => {
  try {
    const url = req.originalUrl || '';
    // match /api/tickets/:id/responses/:responseId
    // match /api/tickets/:id/responses/:responseId (accept non-numeric ids too)
    const m = url.match(/\/tickets\/([^\/]+)\/responses\/([^\/]+)/i);
    if (m) {
      const ticketId = decodeURIComponent(m[1]);
      const responseId = decodeURIComponent(m[2]);
      const result = await ticketService.removeResponse(ticketId, responseId, req.user);
      return res.json(result);
    }

    // try query/body fallbacks: ?ticketId=1&responseId=6 or JSON body
    const ticketId = req.query.ticketId || req.query.ticket_id || req.body.ticketId || req.body.ticket_id;
    const responseId = req.query.responseId || req.query.response_id || req.body.responseId || req.body.response_id;
    if (ticketId && responseId) {
      const result = await ticketService.removeResponse(ticketId, responseId, req.user);
      return res.json(result);
    }

    // nothing matched — delegate to 404 below
    return res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

// ── 404 handler — unknown API routes ──────────────────────
app.use('/api/*', (req, res) => {
  console.warn('[API 404] Route not found:', req.method, req.originalUrl, 'Auth:', req.headers.authorization ? 'present' : 'none');
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`
  });
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

