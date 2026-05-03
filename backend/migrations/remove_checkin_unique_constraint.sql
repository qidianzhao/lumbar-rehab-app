-- Migration: Remove unique constraint on checkins to support multiple daily sessions
-- Date: 2026-05-04
-- Purpose: Support multiple training sessions per day (P1-311)

-- Drop the unique constraint that prevents multiple checkins per day
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS uq_checkins_user_date;

-- Note: Users can now have multiple checkin records for the same date
-- Each checkin is associated with a different training_session_id
