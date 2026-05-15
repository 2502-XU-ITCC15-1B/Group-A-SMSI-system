window.APP_CONFIG = {
  // For Render deployment: use full backend URL
  // For local development: use /api
  API_BASE_URL: window.APP_CONFIG?.API_BASE_URL || 
    (window.location.hostname === 'localhost' ? '/api' : 'https://smis-woman-1.onrender.com/api')
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
