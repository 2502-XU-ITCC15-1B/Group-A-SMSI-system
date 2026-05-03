require('dotenv').config();
 
const express  = require('express');
const cors     = require('cors');
 
// ── DB pool (import triggers the connection health check) ──
require('./config/db');
 
// ── Route modules ──────────────────────────────────────────
const authRoutes       = require('./routes/auth.routes');
const ticketRoutes     = require('./routes/tickets.routes');
const userRoutes       = require('./routes/users.routes');
const companyRoutes    = require('./routes/companies.routes');
const departmentRoutes = require('./routes/departments.routes'); 
const logRoutes        = require('./routes/logs.routes');
 
// ── App setup ──────────────────────────────────────────────
const app = express();
 
// CORS — tighten origin in production by setting ALLOWED_ORIGIN in .env
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
 
app.use(express.json());
 
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
 
// ── 404 handler — unknown API routes ──────────────────────
app.use('/api/*', (req, res) => {
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