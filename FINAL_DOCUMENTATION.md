# WOMAN System Final Documentation

## 1. Purpose and Scope

This document describes the actual implementation of the WOMAN ticketing system as it exists in this repository.

It covers the active backend API, frontend session and request flow, database wiring, migrations, and key feature behavior.

> Note: The seed file is only initial test data. The final documentation is based on the active code in `backend/` and `frontend/`, not only on `smis-woman/backend/scripts/seed.js`.

---

## 2. System Architecture

### 2.1 Components

- `backend/` — Node.js + Express REST API
- `frontend/` — static HTML/JS pages and shared client code
- `backend/config/db.js` — MySQL connection pool with retry logic
- `backend/scripts/run_migrations.js` — automatic schema migration runner
- `backend/migrations/` — SQL migration files, including `003_create_password_recovery_requests.sql`
- `backend/uploads/ticket_responses` — attachment storage directory

### 2.2 Runtime Flow

1. User interacts with the browser UI.
2. Frontend JS calls the backend API using `frontend/js/api.js`.
3. Backend Express routes validate requests and call service modules.
4. Service modules perform business logic and database queries.
5. Results are returned to the frontend.

---

## 3. Backend Implementation

### 3.1 Entry point

- `backend/server.js`
  - Loads environment variables
  - Starts automatic migration with `applyMigrations()` from `backend/scripts/run_migrations.js`
  - Creates `backend/uploads/ticket_responses` if missing
  - Mounts routes and serves static uploads
  - Provides health check at `GET /api/health`

### 3.2 Database connection

- `backend/config/db.js`
  - Uses `mysql2/promise`
  - Creates a pool with retry logic
  - Host, port, credentials, and database name are loaded from environment variables

### 3.3 Migration support

- `backend/scripts/run_migrations.js`
  - Reads SQL files from `backend/migrations`
  - Executes each statement sequentially
  - Ignores already-applied schema errors such as:
    - `ER_TABLE_EXISTS_ERROR`
    - `ER_DUP_FIELDNAME`
    - `ER_DUP_KEYNAME`
    - `ER_DUP_ENTRY`
    - `ER_BAD_FIELD_ERROR`
  - Ensures the database schema is aligned before the API starts

---

## 4. Authentication and Authorization

### 4.1 Auth routes

- `backend/routes/auth.routes.js`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PUT /api/auth/me`
  - `PUT /api/auth/change-password`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`

### 4.2 Auth service

- `backend/services/auth.service.js`
  - `login(email, password)`
  - `getMe(userId)`
  - `updateMe(userId, data)`
  - `changePassword(userId, currentPassword, newPassword)`
  - `requestPasswordReset(email)`
  - `resetPassword(token, newPassword)`

### 4.3 JWT and session handling

- Uses `jsonwebtoken` with secret `JWT_SECRET`
- Token expiration is configured by `JWT_EXPIRES` (default `8h`)
- Frontend stores token and user data in `localStorage` / `sessionStorage`
- `frontend/js/api.js` attaches `Authorization: Bearer <token>` to requests
- `frontend/js/api.js` also schedules auto-logout based on JWT `exp`

### 4.4 Password reset behavior

- `POST /api/auth/forgot-password`
  - validates email and returns `400` if invalid
  - `auth.service.requestPasswordReset()` checks whether the email exists
  - if not found, returns `400` with `Email does not exist`
  - if found, stores a secure token in `password_resets`
  - sends reset email using `backend/services/mail.service.js`

- `POST /api/auth/reset-password`
  - validates token and expiration
  - updates the user password
  - marks the token as used
  - sends confirmation email via `mail.service.js`

---

## 5. Ticket Management

### 5.1 Routes

- `backend/routes/tickets.routes.js`
  - `GET /api/tickets`
  - `GET /api/tickets/mine`
  - `GET /api/tickets/:id`
  - `GET /api/tickets/:id/responses`
  - `POST /api/tickets`
  - `PUT /api/tickets/:id`
  - `PATCH /api/tickets/:id/status`
  - `PATCH /api/tickets/:id/assign`
  - `PATCH /api/tickets/:id/assign-dept`
  - `PATCH /api/tickets/:id/close`
  - `POST /api/tickets/:id/responses`
  - `POST /api/tickets/:id/feedback`
  - `DELETE /api/tickets/:id/responses/:responseId`
  - `DELETE /api/tickets/:id`

### 5.2 Attachments

- Uses `multer` disk storage
- Saves files to `backend/uploads/ticket_responses`
- Allowed extensions:
  - `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`, `.svg`
  - `.pdf`, `.doc`, `.docx`, `.txt`, `.xls`, `.xlsx`
- Max file size: 5 MB
- Responses normalize `attachment_url` so frontend can consume paths consistently

### 5.3 Authorization rules

- `POST /api/tickets` — admin and client
- `PUT /api/tickets/:id`, `PATCH /api/tickets/:id/status` — admin/head/technician
- `PATCH /api/tickets/:id/assign` and `/assign-dept` — admin/head
- `PATCH /api/tickets/:id/close` — admin/head
- `POST /api/tickets/:id/responses` — admin/head/technician/client
- `POST /api/tickets/:id/feedback` — client only
- `DELETE /api/tickets/:id` — admin only

---

## 6. Password Recovery Request Queue

### 6.1 Request logging

- `backend/routes/password-recovery.routes.js`
  - `POST /api/password-recovery`
  - `GET /api/admin/password-recovery-requests`
  - `PATCH /api/admin/password-recovery-requests/:id/resolve`

### 6.2 Recovery table

- Created by `backend/migrations/003_create_password_recovery_requests.sql`
- Columns:
  - `id`
  - `email`
  - `status` (`pending` / `resolved`)
  - `created_at`
  - `resolved_at`

### 6.3 Admin behavior

- admin route is mounted after `/api` routes in `backend/server.js`
- requests to `/api/admin/password-recovery-requests` are handled before the general admin router
- if the table is missing, the route returns an empty list or `404` gracefully

---

## 7. Admin Dashboard and Reporting

### 7.1 Admin routes

- `backend/routes/admin.routes.js`
  - `GET /api/admin/dashboard`
  - `GET /api/admin/reports`

### 7.2 Metrics returned

- total tickets
- open tickets
- in-progress tickets
- resolved/closed tickets
- total users
- active users
- total companies
- active companies
- total departments
- active departments
- priority breakdown
- company and department ticket breakdowns

---

## 8. Email Service

- `backend/services/mail.service.js` uses `nodemailer`
- Default mail host is `sandbox.smtp.mailtrap.io`
- Sends:
  - password reset link email
  - password reset confirmation email
  - ticket resolution email
- Email settings are configurable through environment variables:
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_USER`
  - `MAIL_PASS`

---

## 9. Frontend Behavior

### 9.1 API wrapper

- `frontend/js/api.js`
  - `apiRequest()` attaches JSON headers and Bearer token
  - handles expired tokens by logging out
  - uses `saveSession()` to persist session data
  - stores `token`, `user`, `role`, `id`, `company_id`, `department_id`, and expiration

### 9.2 Session storage rules

- normalizes roles for storage keys
- supports `localStorage` and `sessionStorage`
- uses `scheduleAutoLogout()` to expire sessions automatically

---

## 10. Seed Data and Testing

### 10.1 Seed purpose

- `smis-woman/backend/scripts/seed.js` is a seed script for initial demo/test data
- It inserts users, companies, departments, tickets, responses, and logs
- It is not the main application logic

### 10.2 Test accounts seeded

- `admin@smsi.com` / `Admin@SMSI2026`
- `tech@smsi.com` / `Tech@SMSI2026`
- `head@smsi.com` / `Head@SMSI2026`
- `client@testco.com` / `Client@2026`

> Use these only after the database schema exists and the backend is configured.

---

## 11. Deployment and Startup

### 11.1 Backend

- Run `node server.js` or `npm start` from `backend/`
- On startup, the backend automatically applies migrations
- Ensure `.env` values are correct for `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `PORT`

### 11.2 Docker Compose

- The repository includes `Docker-compose.yml`
- Backend is expected to run on port `5000`
- Frontend served separately under the `frontend/` service

---

## 12. Important Notes for Final Documentation

- The final documentation should be based on the active implementation in `backend/` and `frontend/`.
- The seed file is helpful for sample data, but it is not sufficient alone.
- Use route files and service modules as the authoritative source.

---

## 13. Recommended Structure for Submission

1. Overview
2. Architecture
3. Authentication flow
4. Ticket flow
5. Password recovery flow
6. Admin/reporting features
7. File upload handling
8. Database/migrations
9. Test data and verification
10. Deployment notes
11. Limitations

---

## 14. Limitations

- No full automated unit or integration test suite is present.
- Email delivery depends on SMTP configuration.
- Static uploads are served from a public folder and do not have ACL restrictions.
- The frontend is built as plain static HTML/JS without a build pipeline.
