// For Render deployment we may set a full backend URL; for local dev prefer localhost:5000
const defaultApiBaseUrl = window.APP_CONFIG?.API_BASE_URL || window.API_BASE_URL;
const localDevFallback = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000/api'
  : 'https://smis-woman-1.onrender.com/api';

window.APP_CONFIG = {
  API_BASE_URL: defaultApiBaseUrl || localDevFallback
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
