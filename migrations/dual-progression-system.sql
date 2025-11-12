-- Migration: Dual Progression System (Mastery + Exposure)
-- Created: 2025-11-05
-- Description: Implements two-track progression system tracking quality (mastery) and quantity (exposure)

-- ============================================================
-- DUAL PROGRESSION SYSTEM OVERVIEW
-- ============================================================
-- TRACK 1: MASTERY (Quality - How well you KNOW the word)
--   - Scale: 0-100
--   - Based on: Difficulty ratings (Easy/Medium/Hard/Don't Know)
--   - Controls: Spaced repetition intervals
--   - Purpose: Long-term retention, efficiency
--
-- TRACK 2: EXPOSURE (Quantity - How much TIME you've spent)
--   - Metrics: Total reviews, recent activity, accuracy
--   - Based on: Raw review count (even "Don't Know" counts!)
--   - Controls: Chapter unlocking eligibility
--   - Purpose: Reward effort, encourage practice
-- ============================================================

-- ============================================================
-- 1. Rename status_level to mastery_level
-- ============================================================
-- Check if the old column exists before renaming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_vocabulary_progress'
    AND column_name = 'status_level'
  ) THEN
    ALTER TABLE user_vocabulary_progress
      RENAME COLUMN status_level TO mastery_level;

    RAISE NOTICE 'Renamed status_level to mastery_level in user_vocabulary_progress';
  ELSE
    RAISE NOTICE 'Column status_level does not exist, skipping rename';
  END IF;
END $$;

-- ============================================================
-- 2. Convert mastery_level from 0-10 scale to 0-100 scale
-- ============================================================
-- Update existing values by multiplying by 10
UPDATE user_vocabulary_progress
SET mastery_level = mastery_level * 10
WHERE mastery_level <= 10;

RAISE NOTICE 'Converted mastery_level values from 0-10 scale to 0-100 scale';

-- Add constraint to ensure mastery_level is between 0 and 100
ALTER TABLE user_vocabulary_progress
  DROP CONSTRAINT IF EXISTS mastery_level_range;

ALTER TABLE user_vocabulary_progress
  ADD CONSTRAINT mastery_level_range CHECK (mastery_level >= 0 AND mastery_level <= 100);

-- Add comment explaining the mastery_level column
COMMENT ON COLUMN user_vocabulary_progress.mastery_level IS
'Mastery score (0-100) based on difficulty ratings. Controls spaced repetition intervals. Updated by: Don''t Know -10, Hard +3, Medium +7, Easy +15';

-- ============================================================
-- 3. Add EXPOSURE tracking columns
-- ============================================================

-- Total number of times this word has been reviewed (all attempts)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

COMMENT ON COLUMN user_vocabulary_progress.total_reviews IS
'Total number of times reviewed (includes all difficulty ratings, even "Don''t Know"). Used for chapter unlocking.';

-- Number of "correct" reviews (Medium or Easy ratings)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS correct_reviews INTEGER DEFAULT 0;

COMMENT ON COLUMN user_vocabulary_progress.correct_reviews IS
'Number of successful reviews (Medium or Easy only). Used to calculate accuracy percentage.';

-- Number of reviews in the last 7 days
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS last_7_days_reviews INTEGER DEFAULT 0;

COMMENT ON COLUMN user_vocabulary_progress.last_7_days_reviews IS
'Number of reviews in the last 7 days. Updated daily by cleanup job or on review.';

-- Date of the most recent review
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS last_review_date DATE;

COMMENT ON COLUMN user_vocabulary_progress.last_review_date IS
'Date (local time) of the most recent review. Used to track active learning streaks.';

-- JSON array storing recent review history for analytics
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_vocabulary_progress.review_history IS
'Array of recent reviews: [{date, difficulty, mastery_change}]. Max 20 entries for analytics.';

-- ============================================================
-- 4. Backfill exposure data from existing review history
-- ============================================================
-- Calculate total_reviews and correct_reviews from user_review_history
DO $$
BEGIN
  -- Update total_reviews count
  UPDATE user_vocabulary_progress uvp
  SET total_reviews = (
    SELECT COUNT(*)
    FROM user_review_history urh
    WHERE urh.user_id = uvp.user_id
      AND urh.vocab_id = uvp.vocab_id
  );

  -- Update correct_reviews count (medium and easy only)
  UPDATE user_vocabulary_progress uvp
  SET correct_reviews = (
    SELECT COUNT(*)
    FROM user_review_history urh
    WHERE urh.user_id = uvp.user_id
      AND urh.vocab_id = uvp.vocab_id
      AND urh.difficulty IN ('medium', 'easy')
  );

  -- Update last_review_date
  UPDATE user_vocabulary_progress uvp
  SET last_review_date = (
    SELECT DATE(MAX(reviewed_at))
    FROM user_review_history urh
    WHERE urh.user_id = uvp.user_id
      AND urh.vocab_id = uvp.vocab_id
  );

  -- Update last_7_days_reviews
  UPDATE user_vocabulary_progress uvp
  SET last_7_days_reviews = (
    SELECT COUNT(*)
    FROM user_review_history urh
    WHERE urh.user_id = uvp.user_id
      AND urh.vocab_id = uvp.vocab_id
      AND urh.reviewed_at >= NOW() - INTERVAL '7 days'
  );

  RAISE NOTICE 'Backfilled exposure metrics from existing review history';
END $$;

-- ============================================================
-- 5. Create indexes for performance
-- ============================================================

-- Index for finding words by mastery level (for vocabulary breakdown)
CREATE INDEX IF NOT EXISTS idx_user_vocab_progress_mastery
  ON user_vocabulary_progress(user_id, mastery_level);

-- Index for finding recently reviewed words
CREATE INDEX IF NOT EXISTS idx_user_vocab_progress_last_review
  ON user_vocabulary_progress(user_id, last_review_date DESC NULLS LAST);

-- Index for finding words with high exposure
CREATE INDEX IF NOT EXISTS idx_user_vocab_progress_total_reviews
  ON user_vocabulary_progress(user_id, total_reviews DESC);

-- Composite index for chapter unlocking queries (needs minimum exposure)
CREATE INDEX IF NOT EXISTS idx_user_vocab_progress_exposure
  ON user_vocabulary_progress(user_id, total_reviews, last_7_days_reviews);

-- ============================================================
-- 6. Add helper columns for analytics (optional but useful)
-- ============================================================

-- Calculate accuracy percentage (derived column, not stored)
-- This will be calculated in queries as: ROUND((correct_reviews::float / NULLIF(total_reviews, 0)) * 100, 1)

-- ============================================================
-- VERIFICATION QUERIES (uncomment to check schema)
-- ============================================================

-- Check user_vocabulary_progress schema:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'user_vocabulary_progress'
-- ORDER BY ordinal_position;

-- Check mastery_level values are in 0-100 range:
-- SELECT MIN(mastery_level), MAX(mastery_level), AVG(mastery_level)
-- FROM user_vocabulary_progress;

-- Check exposure metrics:
-- SELECT
--   user_id,
--   COUNT(*) as total_words,
--   AVG(mastery_level) as avg_mastery,
--   AVG(total_reviews) as avg_reviews,
--   AVG(ROUND((correct_reviews::float / NULLIF(total_reviews, 0)) * 100, 1)) as avg_accuracy
-- FROM user_vocabulary_progress
-- GROUP BY user_id;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Dual Progression System migration complete!';
  RAISE NOTICE '   TRACK 1: MASTERY (0-100 scale) - Controls spaced repetition';
  RAISE NOTICE '   TRACK 2: EXPOSURE (review counts) - Controls chapter unlocking';
  RAISE NOTICE '   - Renamed status_level → mastery_level';
  RAISE NOTICE '   - Converted values to 0-100 scale';
  RAISE NOTICE '   - Added total_reviews, correct_reviews columns';
  RAISE NOTICE '   - Added last_7_days_reviews, last_review_date columns';
  RAISE NOTICE '   - Added review_history JSONB column';
  RAISE NOTICE '   - Backfilled metrics from existing data';
  RAISE NOTICE '   - Created performance indexes';
END $$;
