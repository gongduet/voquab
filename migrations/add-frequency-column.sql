-- Add frequency column to vocabulary table
-- This eliminates the need to JOIN vocabulary_occurrences every time
-- Fixes "URL too long" error in admin dashboard

BEGIN;

-- Add frequency column (stores pre-calculated occurrence count)
ALTER TABLE vocabulary
  ADD COLUMN IF NOT EXISTS frequency INTEGER DEFAULT 0;

-- Populate frequencies (one-time calculation)
UPDATE vocabulary v
SET frequency = (
  SELECT COUNT(*)
  FROM vocabulary_occurrences vo
  WHERE vo.vocab_id = v.vocab_id
);

-- Add index for fast sorting by frequency
CREATE INDEX IF NOT EXISTS idx_vocabulary_frequency
  ON vocabulary(frequency DESC);

-- Add comment for documentation
COMMENT ON COLUMN vocabulary.frequency IS
  'Pre-calculated count of occurrences in vocabulary_occurrences table. Updated when importing new content.';

COMMIT;

-- Verify results
SELECT
  COUNT(*) as total_words,
  AVG(frequency) as avg_frequency,
  MAX(frequency) as max_frequency,
  MIN(frequency) as min_frequency
FROM vocabulary;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Frequency column migration complete!';
  RAISE NOTICE '   - Added frequency column (INTEGER)';
  RAISE NOTICE '   - Populated frequencies from vocabulary_occurrences';
  RAISE NOTICE '   - Created descending index for fast sorting';
  RAISE NOTICE '   - Admin dashboard will now load instantly';
END $$;
