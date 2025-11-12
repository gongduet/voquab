-- Migration: User Settings and Enhanced Streak Tracking
-- Created: 2025-11-05
-- Description: Adds user_settings table for customizable goals and enhances streak tracking

-- ============================================================
-- 1. CREATE user_settings TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal_words INTEGER DEFAULT 100,
  cards_per_session INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE user_settings IS 'User-customizable settings for daily goals and session preferences';
COMMENT ON COLUMN user_settings.daily_goal_words IS 'Target number of words to review per day (default: 100)';
COMMENT ON COLUMN user_settings.cards_per_session IS 'Number of cards to show in each review session (default: 25)';

-- ============================================================
-- 2. ENABLE RLS (Row Level Security) ON user_settings
-- ============================================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. UPDATE user_daily_stats FOR ENHANCED STREAK TRACKING
-- ============================================================

-- Add columns for longest streak tracking
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak_start DATE,
  ADD COLUMN IF NOT EXISTS longest_streak_end DATE,
  ADD COLUMN IF NOT EXISTS total_active_days INTEGER DEFAULT 0;

-- Add comments
COMMENT ON COLUMN user_daily_stats.longest_streak IS 'Best streak ever achieved by this user';
COMMENT ON COLUMN user_daily_stats.longest_streak_start IS 'Start date of the longest streak';
COMMENT ON COLUMN user_daily_stats.longest_streak_end IS 'End date of the longest streak';
COMMENT ON COLUMN user_daily_stats.total_active_days IS 'Total number of days with reviews (non-consecutive)';

-- ============================================================
-- 4. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. CREATE INDEX FOR PERFORMANCE
-- ============================================================

-- Index on user_id for faster lookups (already primary key, but explicit)
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
  ON user_settings(user_id);

-- ============================================================
-- 6. BACKFILL LONGEST STREAK DATA (OPTIONAL)
-- ============================================================

-- Calculate longest streaks from existing user_daily_stats data
-- This is a one-time operation to populate the new columns

DO $$
DECLARE
  user_record RECORD;
  streak_count INTEGER;
  max_streak INTEGER;
  streak_start DATE;
  streak_end DATE;
  temp_start DATE;
  temp_count INTEGER;
  prev_date DATE;
  total_days INTEGER;
BEGIN
  -- Loop through each user
  FOR user_record IN
    SELECT DISTINCT user_id FROM user_daily_stats
  LOOP
    max_streak := 0;
    streak_start := NULL;
    streak_end := NULL;
    temp_start := NULL;
    temp_count := 0;
    prev_date := NULL;
    total_days := 0;

    -- Get all dates for this user, ordered
    FOR streak_count IN
      SELECT review_date
      FROM user_daily_stats
      WHERE user_id = user_record.user_id
        AND review_date IS NOT NULL
        AND words_reviewed > 0
      ORDER BY review_date ASC
    LOOP
      total_days := total_days + 1;

      -- Check if this continues the streak (consecutive day)
      IF prev_date IS NULL OR (streak_count - prev_date = 1) THEN
        IF temp_count = 0 THEN
          temp_start := streak_count;
        END IF;
        temp_count := temp_count + 1;

        -- Update max streak if current is longer
        IF temp_count > max_streak THEN
          max_streak := temp_count;
          streak_start := temp_start;
          streak_end := streak_count;
        END IF;
      ELSE
        -- Streak broken, reset
        temp_count := 1;
        temp_start := streak_count;
      END IF;

      prev_date := streak_count;
    END LOOP;

    -- Update user's longest streak in the most recent daily_stats entry
    UPDATE user_daily_stats
    SET
      longest_streak = max_streak,
      longest_streak_start = streak_start,
      longest_streak_end = streak_end,
      total_active_days = total_days
    WHERE user_id = user_record.user_id
      AND review_date = (
        SELECT MAX(review_date)
        FROM user_daily_stats
        WHERE user_id = user_record.user_id
      );

  END LOOP;

  RAISE NOTICE 'Backfilled longest streak data for all users';
END $$;

-- ============================================================
-- VERIFICATION QUERIES (uncomment to check schema)
-- ============================================================

-- Check user_settings schema:
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_settings'
-- ORDER BY ordinal_position;

-- Check user_daily_stats new columns:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'user_daily_stats'
--   AND column_name IN ('longest_streak', 'longest_streak_start', 'longest_streak_end', 'total_active_days');

-- Check RLS policies on user_settings:
-- SELECT * FROM pg_policies WHERE tablename = 'user_settings';

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ User Settings & Streak Tracking migration complete!';
  RAISE NOTICE '   - Created user_settings table';
  RAISE NOTICE '   - Added RLS policies for user_settings';
  RAISE NOTICE '   - Added longest_streak columns to user_daily_stats';
  RAISE NOTICE '   - Backfilled historical streak data';
  RAISE NOTICE '   - Users can now customize daily goals and session size';
  RAISE NOTICE '   - Enhanced streak tracking with longest streak history';
END $$;
