-- Migration: Stop Words System for Admin Management
-- Date: November 12, 2025
-- Description: Adds stop word flagging and admin notes to vocabulary table

BEGIN;

-- Add stop word column (words that shouldn't be shown in learning sessions)
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS is_stop_word BOOLEAN DEFAULT FALSE;

-- Add admin notes for internal documentation
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create index for efficient filtering of stop words
CREATE INDEX IF NOT EXISTS idx_vocabulary_stop_words
  ON vocabulary(is_stop_word);

-- Add comments for documentation
COMMENT ON COLUMN vocabulary.is_stop_word IS
  'TRUE if word is too common/basic to include in learning sessions (e.g., "el", "de", "en"). Managed via admin dashboard.';

COMMENT ON COLUMN vocabulary.admin_notes IS
  'Internal notes from admin about this word (why marked as stop word, special considerations, etc.)';

COMMIT;

-- Verification query (uncomment to test):
-- SELECT
--   lemma,
--   is_stop_word,
--   is_common_word,
--   admin_notes
-- FROM vocabulary
-- WHERE is_stop_word = TRUE
-- ORDER BY lemma
-- LIMIT 20;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Stop words system migration complete!';
  RAISE NOTICE '   - Added is_stop_word column (BOOLEAN)';
  RAISE NOTICE '   - Added admin_notes column (TEXT)';
  RAISE NOTICE '   - Created index on is_stop_word';
  RAISE NOTICE '   - Ready for admin dashboard management';
END $$;
