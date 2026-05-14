#!/bin/sh
set -e

API_BASE_URL="${API_BASE_URL:-/api}"

printf 'window.APP_CONFIG = { API_BASE_URL: "%s" };\nwindow.API_BASE_URL = window.APP_CONFIG.API_BASE_URL;\n' "$API_BASE_URL" > /usr/share/nginx/html/js/config.js

exec nginx -g 'daemon off;'
