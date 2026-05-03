-- ============================================================
-- WOMAN System — Complete Database Schema
-- Solutions Management Systems Inc. (SMSi)
-- ============================================================

CREATE DATABASE IF NOT EXISTS woman_db;
USE woman_db;

-- ============================================================
-- TABLE 1: companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  contact_person VARCHAR(150) NULL,
  contact_email VARCHAR(150) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 2: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  manager_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 3: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','head','technician','client') NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_users_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL
);

-- Add FK after users exists (circular reference)
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_manager
  FOREIGN KEY (manager_id) REFERENCES users(id)
  ON DELETE SET NULL;

-- ============================================================
-- TABLE 4: tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_order_id VARCHAR(30) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,

  priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
  status ENUM('Open','Assigned','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',

  company_id BIGINT UNSIGNED NULL,
  department_id BIGINT UNSIGNED NULL,
  requestor_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NULL,

  resolution_summary TEXT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,

  CONSTRAINT fk_tickets_company
    FOREIGN KEY (company_id) REFERENCES companies(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_tickets_department
    FOREIGN KEY (department_id) REFERENCES departments(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_tickets_requestor
    FOREIGN KEY (requestor_id) REFERENCES users(id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_tickets_technician
    FOREIGN KEY (technician_id) REFERENCES users(id)
    ON DELETE SET NULL
);

-- ============================================================
-- TABLE 5: ticket_responses
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_responses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  internal_note TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_responses_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_responses_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- ============================================================
-- TABLE 6: ticket_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  feedback TEXT NULL,
  rating TINYINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_feedback_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_feedback_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- ============================================================
-- TABLE 7: activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_logs_ticket
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- ============================================================
-- TABLE 8: password_resets
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_resets_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
