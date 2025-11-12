-- Migration: Fix schema mismatch for user_review_history and user_daily_stats
-- Created: 2025-11-02
-- Description: Adds missing columns that the application code expects

-- ============================================================
-- 1. Fix user_review_history table
-- ============================================================
-- Add difficulty column to track how hard/easy the user found each word
ALTER TABLE user_review_history
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20);

-- Add a comment to explain the column
COMMENT ON COLUMN user_review_history.difficulty IS 'User difficulty rating: easy, medium, hard, dont-know';

-- ============================================================
-- 2. Fix user_daily_stats table
-- ============================================================
-- Add review_date column to track which day the stats are for
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS review_date DATE;

-- Add current_streak column to track consecutive days of review
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- Add comments to explain the columns
COMMENT ON COLUMN user_daily_stats.review_date IS 'The date (YYYY-MM-DD) these stats are for';
COMMENT ON COLUMN user_daily_stats.current_streak IS 'Number of consecutive days the user has reviewed';

-- ============================================================
-- 3. Create unique constraint on review_date per user
-- ============================================================
-- Ensure there's only one stats entry per user per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_daily_stats_user_date_unique'
  ) THEN
    ALTER TABLE user_daily_stats
      ADD CONSTRAINT user_daily_stats_user_date_unique
      UNIQUE (user_id, review_date);
  END IF;
END $$;

-- ============================================================
-- 4. Create index for faster queries
-- ============================================================
-- Index on review_date for faster date-based queries in Progress page
CREATE INDEX IF NOT EXISTS idx_user_daily_stats_review_date
  ON user_daily_stats(user_id, review_date DESC);

-- Index on reviewed_at for faster Recent Activity queries
CREATE INDEX IF NOT EXISTS idx_user_review_history_reviewed_at
  ON user_review_history(user_id, reviewed_at DESC);

-- ============================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================
-- Uncomment to verify the migration worked:

-- Check user_review_history columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_review_history'
-- ORDER BY ordinal_position;

-- Check user_daily_stats columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_daily_stats'
-- ORDER BY ordinal_position;
