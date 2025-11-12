-- Migration: Fix column name mismatches between code and database
-- Created: 2025-11-02
-- Description: Rename columns to match what the application code expects

-- ============================================================
-- 1. Fix user_review_history: Rename difficulty_rating to difficulty
-- ============================================================
-- Check if the old column exists before renaming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_review_history'
    AND column_name = 'difficulty_rating'
  ) THEN
    ALTER TABLE user_review_history
      RENAME COLUMN difficulty_rating TO difficulty;

    RAISE NOTICE 'Renamed difficulty_rating to difficulty in user_review_history';
  ELSE
    RAISE NOTICE 'Column difficulty_rating does not exist, skipping rename';
  END IF;
END $$;

-- Make sure difficulty is nullable (since we're inserting it from code)
-- If it was NOT NULL before, change it to allow NULL
ALTER TABLE user_review_history
  ALTER COLUMN difficulty DROP NOT NULL;

-- ============================================================
-- 2. Verify user_daily_stats has correct columns
-- ============================================================
-- The code expects: review_date, current_streak, words_reviewed
-- Let's make sure they all exist and have correct types

-- Add review_date if missing (from previous migration, but just in case)
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS review_date DATE;

-- Add current_streak if missing (from previous migration, but just in case)
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- Add words_reviewed if missing
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS words_reviewed INTEGER DEFAULT 0;

-- ============================================================
-- 3. Update NOT NULL constraints on user_daily_stats
-- ============================================================
-- Make sure review_date is NOT NULL (required for the unique constraint)
ALTER TABLE user_daily_stats
  ALTER COLUMN review_date SET NOT NULL;

-- current_streak and words_reviewed should allow NULL initially,
-- but have defaults, so we keep them as is

-- ============================================================
-- 4. Recreate unique constraint (in case it wasn't created properly)
-- ============================================================
-- Drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_daily_stats_user_date_unique'
  ) THEN
    ALTER TABLE user_daily_stats
      DROP CONSTRAINT user_daily_stats_user_date_unique;
  END IF;
END $$;

-- Create the unique constraint
ALTER TABLE user_daily_stats
  ADD CONSTRAINT user_daily_stats_user_date_unique
  UNIQUE (user_id, review_date);

-- ============================================================
-- VERIFICATION QUERIES (uncomment to check schema)
-- ============================================================

-- Check user_review_history schema:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_review_history'
-- ORDER BY ordinal_position;

-- Check user_daily_stats schema:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_daily_stats'
-- ORDER BY ordinal_position;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete! Column names fixed.';
  RAISE NOTICE '   - user_review_history.difficulty_rating → difficulty';
  RAISE NOTICE '   - user_daily_stats columns verified';
END $$;
