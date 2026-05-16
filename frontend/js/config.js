const defaultApiBaseUrl = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL;
// if running on localhost (any port) prefer the backend on port 5000
const localDevFallback = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

window.APP_CONFIG = {
  API_BASE_URL: defaultApiBaseUrl || localDevFallback
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
