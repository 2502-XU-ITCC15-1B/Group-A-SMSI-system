<<<<<<< HEAD
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
=======
// Simple config for plain JavaScript
const API_BASE_URL = "https://smis-backend-production-a1a5.up.railway.app/api";

window.APP_CONFIG = {
  API_BASE_URL: API_BASE_URL,
>>>>>>> a20a4ab5f9376d21012724d9c087700f558fb2f3
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

<<<<<<< HEAD
// Open attachments directly in a new tab (do not intercept or create blob URLs)
// No interception for attachments — open as normal anchors to backend uploads.
=======
console.log("API_BASE_URL configured:", window.API_BASE_URL);
>>>>>>> a20a4ab5f9376d21012724d9c087700f558fb2f3
