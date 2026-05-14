FROM node:18-slim

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy backend and frontend source
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]
