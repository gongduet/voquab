-- =============================================================================
-- ADD FSRS COLUMNS TO USER_LEMMA_PROGRESS AND USER_PHRASE_PROGRESS
-- Date: December 12, 2025
-- Purpose: Add columns required for FSRS algorithm implementation
-- =============================================================================

-- Pre-check: Show current column state
SELECT 'PRE-MIGRATION STATUS' as step;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_lemma_progress'
ORDER BY ordinal_position;

-- =============================================================================
-- STEP 1: Add FSRS columns to user_lemma_progress
-- =============================================================================

-- stability: Days until 90% recall probability
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS stability REAL DEFAULT NULL;

-- difficulty: Item complexity (1-10 scale, FSRS uses ~1-10)
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS difficulty REAL DEFAULT NULL;

-- due_date: When card should be reviewed
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT NULL;

-- fsrs_state: 0=New, 1=Learning, 2=Review, 3=Relearning
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS fsrs_state SMALLINT DEFAULT 0;

-- reps: Total repetitions
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0;

-- lapses: Times failed (pressed Again)
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0;

-- last_seen_at: Last exposure (review OR oversampling)
ALTER TABLE user_lemma_progress
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================================
-- STEP 2: Add FSRS columns to user_phrase_progress
-- =============================================================================

-- stability
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS stability REAL DEFAULT NULL;

-- difficulty
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS difficulty REAL DEFAULT NULL;

-- due_date
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT NULL;

-- fsrs_state
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS fsrs_state SMALLINT DEFAULT 0;

-- reps
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0;

-- lapses
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0;

-- last_seen_at
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- =============================================================================
-- STEP 3: Create indexes for efficient queries
-- =============================================================================

-- Index for finding due cards (most common query)
CREATE INDEX IF NOT EXISTS idx_user_lemma_progress_due_date
ON user_lemma_progress(user_id, due_date)
WHERE due_date IS NOT NULL;

-- Index for exposure oversampling (stability > 30 days, not seen recently)
CREATE INDEX IF NOT EXISTS idx_user_lemma_progress_exposure
ON user_lemma_progress(user_id, stability, last_seen_at)
WHERE stability > 30 AND fsrs_state = 2;

-- Index for FSRS state queries
CREATE INDEX IF NOT EXISTS idx_user_lemma_progress_fsrs_state
ON user_lemma_progress(user_id, fsrs_state);

-- Same indexes for phrase progress
CREATE INDEX IF NOT EXISTS idx_user_phrase_progress_due_date
ON user_phrase_progress(user_id, due_date)
WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_phrase_progress_exposure
ON user_phrase_progress(user_id, stability, last_seen_at)
WHERE stability > 30 AND fsrs_state = 2;

-- =============================================================================
-- STEP 4: Add comments for documentation
-- =============================================================================

COMMENT ON COLUMN user_lemma_progress.stability IS 'FSRS: Days until 90% recall probability';
COMMENT ON COLUMN user_lemma_progress.difficulty IS 'FSRS: Item complexity (1-10 scale)';
COMMENT ON COLUMN user_lemma_progress.due_date IS 'FSRS: When card should be reviewed';
COMMENT ON COLUMN user_lemma_progress.fsrs_state IS 'FSRS: 0=New, 1=Learning, 2=Review, 3=Relearning';
COMMENT ON COLUMN user_lemma_progress.reps IS 'FSRS: Total repetitions';
COMMENT ON COLUMN user_lemma_progress.lapses IS 'FSRS: Times failed (pressed Again)';
COMMENT ON COLUMN user_lemma_progress.last_seen_at IS 'FSRS: Last exposure (review OR oversampling)';

-- Mark deprecated columns
COMMENT ON COLUMN user_lemma_progress.mastery_level IS 'DEPRECATED: Use stability instead. Will be removed 2026-01-12';
COMMENT ON COLUMN user_lemma_progress.health IS 'DEPRECATED: Use due_date + retrievability calculation. Will be removed 2026-01-12';
COMMENT ON COLUMN user_lemma_progress.correct_reviews IS 'DEPRECATED: Use (reps - lapses) instead. Will be removed 2026-01-12';

-- =============================================================================
-- POST-MIGRATION VERIFICATION
-- =============================================================================

SELECT 'POST-MIGRATION STATUS' as step;

-- Verify columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_lemma_progress'
  AND column_name IN ('stability', 'difficulty', 'due_date', 'fsrs_state', 'reps', 'lapses', 'last_seen_at')
ORDER BY ordinal_position;

-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('user_lemma_progress', 'user_phrase_progress')
  AND indexname LIKE '%fsrs%' OR indexname LIKE '%due_date%' OR indexname LIKE '%exposure%';

SELECT 'FSRS MIGRATION COMPLETE' as status;
