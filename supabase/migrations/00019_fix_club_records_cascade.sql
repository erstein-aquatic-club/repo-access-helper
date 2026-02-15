-- =============================================================================
-- Migration: Fix club records cascade - add original_age column
--
-- Problem: club_records uses age cascade (younger swimmers' records appear
-- in older age categories), but club_performances doesn't. This creates
-- inconsistencies when viewing rankings.
--
-- Solution: Add original_age column to track the actual age category of
-- the performance, so we can display it correctly in the UI.
-- =============================================================================

-- Add original_age column to track the swimmer's actual age when they set the record
ALTER TABLE club_records ADD COLUMN IF NOT EXISTS original_age INTEGER;

-- Add swimmer_iuf to club_records for better tracking
ALTER TABLE club_records ADD COLUMN IF NOT EXISTS swimmer_iuf TEXT;

-- Comment explaining the columns
COMMENT ON COLUMN club_records.original_age IS 'Original age category where the record was actually set (before cascade)';
COMMENT ON COLUMN club_records.swimmer_iuf IS 'FFN IUF of the swimmer who set the record';
