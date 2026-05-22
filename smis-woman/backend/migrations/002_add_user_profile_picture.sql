-- Migration: add profile_picture column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255);
