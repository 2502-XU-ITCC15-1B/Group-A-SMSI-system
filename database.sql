-- ============================================================
-- WOMAN System — Complete Database Schema
-- Solutions Management Systems Inc. (SMSi)
-- ============================================================

CREATE DATABASE IF NOT EXISTS woman_db;
USE woman_db;

-- ============================================================
-- TABLE 1: companies
-- Represents each client organization using the WOMAN system.
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) DEFAULT NULL,
  contact_email VARCHAR(100) DEFAULT NULL,
  is_active     TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 2: users
-- Stores all system users. Role determines access level.
--   admin      → full system access
--   technician → view/update assigned tickets
--   client     → submit tickets, view own company's tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','technician','client') NOT NULL DEFAULT 'client',
  company_id    INT          DEFAULT NULL,   -- NULL for admin & technician
  is_active     TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_users_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE SET NULL
);

-- ============================================================
-- TABLE 3: tickets
-- Core entity — one row per work order / service request.
-- work_order_id is human-readable: WO-YYYY-NNNN
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  work_order_id  VARCHAR(20)  NOT NULL UNIQUE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT         DEFAULT NULL,
  company_id     INT          NOT NULL,
  requestor_id   INT          NOT NULL,
  technician_id  INT          DEFAULT NULL,
  priority       ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  status         ENUM('Submitted','Assigned','In Progress','Resolved','Closed')
                              NOT NULL DEFAULT 'Submitted',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  resolved_at    TIMESTAMP    NULL DEFAULT NULL,
  closed_at      TIMESTAMP    NULL DEFAULT NULL,

  -- Computed columns for SLA tracking (minutes)
  response_time_min  INT GENERATED ALWAYS AS (
    CASE WHEN resolved_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, created_at, resolved_at)
         ELSE NULL END
  ) STORED,

  CONSTRAINT fk_tickets_company
    FOREIGN KEY (company_id)    REFERENCES companies(id),
  CONSTRAINT fk_tickets_requestor
    FOREIGN KEY (requestor_id)  REFERENCES users(id),
  CONSTRAINT fk_tickets_technician
    FOREIGN KEY (technician_id) REFERENCES users(id)
    ON DELETE SET NULL
);

-- ============================================================
-- TABLE 4: responses
-- Technician or admin replies attached to a ticket.
-- ============================================================
CREATE TABLE IF NOT EXISTS responses (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id  INT  NOT NULL,
  user_id    INT  NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_responses_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_responses_user
    FOREIGN KEY (user_id)   REFERENCES users(id)
);

-- ============================================================
-- TABLE 5: activity_logs
-- Immutable audit trail — every meaningful state change is recorded.
-- action values: TICKET_CREATED | STATUS_CHANGED | TICKET_ASSIGNED |
--               RESPONSE_ADDED | USER_CREATED | USER_UPDATED | LOGIN
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id  INT          DEFAULT NULL,
  user_id    INT          NOT NULL,
  action     VARCHAR(50)  NOT NULL,
  details    TEXT         DEFAULT NULL,   -- JSON string for extra context
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_logs_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
  CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id)   REFERENCES users(id)
);

-- ============================================================
-- INDEXES — improve query performance for common lookups
-- ============================================================
CREATE INDEX idx_tickets_status       ON tickets(status);
CREATE INDEX idx_tickets_company      ON tickets(company_id);
CREATE INDEX idx_tickets_technician   ON tickets(technician_id);
CREATE INDEX idx_logs_ticket          ON activity_logs(ticket_id);
CREATE INDEX idx_logs_user            ON activity_logs(user_id);
CREATE INDEX idx_users_role           ON users(role);

-- ============================================================
-- SEED DATA
-- Run `node backend/scripts/seed.js` to insert hashed passwords.
-- The raw credentials below are for reference only.
--
--   Admin       → email: admin@smsi.com      pass: Admin@SMSI2026
--   Technician  → email: tech@smsi.com       pass: Tech@SMSI2026
--   Client      → email: client@testco.com   pass: Client@2026
-- ============================================================

-- Default companies
INSERT INTO companies (name, contact_person, contact_email) VALUES
  ('Solutions Management Systems Inc.', 'Admin',        'admin@smsi.com'),
  ('Test Client Company',               'John Reyes',   'client@testco.com');

-- Placeholder users (replace password_hash with bcrypt output from seed.js)
INSERT INTO users (name, email, password_hash, role, company_id) VALUES
  ('Administrator', 'admin@smsi.com',    'SEED_REQUIRED', 'admin',      NULL),
  ('Tech Support',  'tech@smsi.com',     'SEED_REQUIRED', 'technician', NULL),
  ('John Reyes',    'client@testco.com', 'SEED_REQUIRED', 'client',     2);