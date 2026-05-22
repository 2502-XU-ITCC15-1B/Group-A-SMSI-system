-- Migration: create password_recovery_requests table for admin recovery queue
CREATE TABLE IF NOT EXISTS password_recovery_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  INDEX idx_password_recovery_status (status),
  INDEX idx_password_recovery_email (email)
);
