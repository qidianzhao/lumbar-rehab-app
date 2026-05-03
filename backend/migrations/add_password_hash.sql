-- Migration: Add password_hash field to users table
-- Date: 2026-05-13
-- Purpose: Support password-based login (P1-301)

-- Add password_hash column (nullable to support existing users)
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);

-- Optional: Add index for faster password lookups
-- CREATE INDEX idx_users_password_hash ON users(password_hash);

-- Note: Existing users can continue using SMS code login
-- They can set password later via /api/v1/auth/set-password endpoint
