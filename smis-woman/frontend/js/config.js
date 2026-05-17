// Simple config for plain JavaScript
const API_BASE_URL = "https://smis-backend-production-a1a5.up.railway.app/api";

window.APP_CONFIG = {
  API_BASE_URL: API_BASE_URL,
};

window.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

console.log("API_BASE_URL configured:", window.API_BASE_URL);
