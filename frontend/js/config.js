// Live Railway backend (used when not developing locally)
const LIVE_API = 'https://smis-backend-production-afa5.up.railway.app/api';
window.LIVE_API = LIVE_API;

// Allow an override via a pre-set `window.APP_CONFIG.API_BASE_URL` (e.g. injected at deploy-time)
const envApi = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL;

// Use localhost backend when running the frontend locally for development, otherwise use LIVE_API
const apiBase = envApi || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : LIVE_API);

window.APP_CONFIG = {
  API_BASE_URL: apiBase,
  DEFAULT_ADMIN_ID: 1
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

// Open attachments directly in a new tab (do not intercept or create blob URLs)
// No interception for attachments — open as normal anchors to backend uploads.
