-- =====================================================
-- PHASE 1: Health System & Priority Scoring
-- =====================================================
-- Adds health tracking and time gate columns to support
-- intelligent card prioritization
-- =====================================================

BEGIN;

-- Add health column (0-100, decays over time)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100
  CHECK (health >= 0 AND health <= 100);

-- Add time gate tracking (for future Phase 2)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS last_correct_review_at TIMESTAMPTZ;

-- Add struggling word detection
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS failed_in_last_3_sessions BOOLEAN DEFAULT FALSE;

-- Add index for health-based queries
CREATE INDEX IF NOT EXISTS idx_user_vocab_health
  ON user_vocabulary_progress(user_id, health);

-- Backfill health for existing words
UPDATE user_vocabulary_progress
SET health = 100
WHERE health IS NULL;

COMMIT;

COMMENT ON COLUMN user_vocabulary_progress.health IS
  'Word health (0-100). Decays over time based on mastery level. Low health = needs review urgently.';

COMMENT ON COLUMN user_vocabulary_progress.last_correct_review_at IS
  'Timestamp of last correct review (Hard/Medium/Easy). Used for time gate enforcement in Phase 2.';

COMMENT ON COLUMN user_vocabulary_progress.failed_in_last_3_sessions IS
  'True if word was marked "Don''t Know" in any of the last 3 review sessions. Used for leech detection.';
