-- Migration: add phone column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Optional: create an index for faster lookups by phone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
