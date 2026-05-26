// Runtime frontend config.
// Prefers explicit overrides, otherwise uses localhost backend in local dev and Railway in deployed environments.
(function configureApp() {
  const LIVE_API = 'https://smis-backend-production-afa5.up.railway.app/api';
  window.LIVE_API = LIVE_API;

  const presetApi = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiBase = presetApi || (isLocal ? 'http://localhost:5000/api' : LIVE_API);

  window.APP_CONFIG = {
    API_BASE_URL: apiBase,
    DEFAULT_ADMIN_ID: 1
  };

  window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
})();
