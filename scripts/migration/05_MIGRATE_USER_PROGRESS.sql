-- ============================================
-- PHASE 4: MIGRATE USER PROGRESS
-- ============================================
-- Purpose: Convert user_vocabulary_progress to user_lemma_progress
-- Strategy: Map vocab_id to lemma_id, merge duplicates
-- ============================================

-- ============================================
-- STEP 0: Recreate mapping table (temp tables don't persist)
-- ============================================
DROP TABLE IF EXISTS vocab_to_lemma;
CREATE TEMP TABLE vocab_to_lemma AS
SELECT
    v.vocab_id as old_vocab_id,
    COALESCE(
        v.canonical_vocab_id,
        CASE WHEN v.is_canonical THEN v.vocab_id END,
        v.vocab_id
    ) as lemma_id
FROM vocabulary v;

-- ============================================
-- STEP 1: Preview user progress to migrate
-- ============================================
SELECT
    'User progress records to migrate' as metric,
    COUNT(*) as count
FROM user_vocabulary_progress;

-- Check distinct users
SELECT
    COUNT(DISTINCT user_id) as distinct_users
FROM user_vocabulary_progress;

-- Sample current progress
SELECT
    user_id,
    vocab_id,
    mastery_level,
    health,
    total_reviews,
    last_reviewed_at
FROM user_vocabulary_progress
LIMIT 10;

-- ============================================
-- STEP 2: Preview lemma mapping for user progress
-- ============================================
-- Check how many progress records map to valid lemmas
SELECT
    'Maps to valid lemma' as status,
    COUNT(*) as count
FROM user_vocabulary_progress uvp
JOIN vocab_to_lemma vtl ON uvp.vocab_id = vtl.old_vocab_id
WHERE vtl.lemma_id IN (SELECT lemma_id FROM lemmas)

UNION ALL

SELECT
    'No valid lemma mapping',
    COUNT(*)
FROM user_vocabulary_progress uvp
LEFT JOIN vocab_to_lemma vtl ON uvp.vocab_id = vtl.old_vocab_id
LEFT JOIN lemmas l ON vtl.lemma_id = l.lemma_id
WHERE l.lemma_id IS NULL;

-- ============================================
-- STEP 3: Insert user lemma progress
-- ============================================
-- First pass: Insert all progress records
INSERT INTO user_lemma_progress (
    user_id,
    lemma_id,
    mastery_level,
    last_correct_review_at,
    health,
    last_reviewed_at,
    total_reviews,
    correct_reviews,
    review_due,
    failed_in_last_3_sessions,
    review_history,
    created_at,
    updated_at
)
SELECT
    uvp.user_id,
    vtl.lemma_id,
    COALESCE(uvp.mastery_level, 0),
    uvp.last_correct_review_at,
    COALESCE(uvp.health, 0),
    uvp.last_reviewed_at,
    COALESCE(uvp.total_reviews, 0),
    COALESCE(uvp.correct_reviews, 0),
    NULL as review_due,  -- Will be calculated
    false as failed_in_last_3_sessions,  -- Will be calculated
    '[]'::jsonb as review_history,
    COALESCE(uvp.created_at, NOW()),
    COALESCE(uvp.updated_at, NOW())
FROM user_vocabulary_progress uvp
JOIN vocab_to_lemma vtl ON uvp.vocab_id = vtl.old_vocab_id
WHERE vtl.lemma_id IN (SELECT lemma_id FROM lemmas)
ON CONFLICT (user_id, lemma_id) DO UPDATE SET
    -- If duplicate, keep highest mastery and sum reviews
    mastery_level = GREATEST(user_lemma_progress.mastery_level, EXCLUDED.mastery_level),
    health = LEAST(user_lemma_progress.health, EXCLUDED.health),  -- Keep lowest (more urgent)
    total_reviews = user_lemma_progress.total_reviews + EXCLUDED.total_reviews,
    correct_reviews = user_lemma_progress.correct_reviews + EXCLUDED.correct_reviews,
    last_reviewed_at = GREATEST(user_lemma_progress.last_reviewed_at, EXCLUDED.last_reviewed_at),
    updated_at = NOW();

-- ============================================
-- STEP 4: Verify user progress migration
-- ============================================
SELECT
    'Original user_vocabulary_progress' as source,
    COUNT(*) as records,
    COUNT(DISTINCT user_id) as users
FROM user_vocabulary_progress

UNION ALL

SELECT
    'New user_lemma_progress',
    COUNT(*),
    COUNT(DISTINCT user_id)
FROM user_lemma_progress;

-- Check mastery distribution
SELECT
    CASE
        WHEN mastery_level = 0 THEN '0 (New)'
        WHEN mastery_level < 30 THEN '1-29 (Beginner)'
        WHEN mastery_level < 60 THEN '30-59 (Intermediate)'
        WHEN mastery_level < 90 THEN '60-89 (Advanced)'
        ELSE '90-100 (Mastered)'
    END as mastery_range,
    COUNT(*) as count
FROM user_lemma_progress
GROUP BY 1
ORDER BY 1;

-- Check health distribution
SELECT
    CASE
        WHEN health < 20 THEN 'Critical (<20)'
        WHEN health < 40 THEN 'Low (20-39)'
        WHEN health < 60 THEN 'Medium (40-59)'
        WHEN health < 80 THEN 'Good (60-79)'
        ELSE 'Excellent (80-100)'
    END as health_range,
    COUNT(*) as count
FROM user_lemma_progress
GROUP BY 1
ORDER BY 1;

-- ============================================
-- STEP 5: Create user word encounters
-- ============================================
-- Track which word forms users have encountered
INSERT INTO user_word_encounters (
    encounter_id,
    user_id,
    word_id,
    first_encountered_at,
    times_encountered,
    last_encountered_sentence_id,
    created_at
)
SELECT
    gen_random_uuid(),
    uvp.user_id,
    w.word_id,
    uvp.created_at as first_encountered_at,
    1 as times_encountered,
    w.sentence_id as last_encountered_sentence_id,
    NOW()
FROM user_vocabulary_progress uvp
JOIN vocab_to_lemma vtl ON uvp.vocab_id = vtl.old_vocab_id
JOIN words w ON vtl.lemma_id = w.lemma_id
WHERE uvp.total_reviews > 0
ON CONFLICT (user_id, word_id) DO NOTHING;

-- Verify encounters
SELECT
    'User word encounters created' as metric,
    COUNT(*) as count
FROM user_word_encounters;

-- ============================================
-- PHASE 4 COMPLETE!
-- Report these numbers:
-- - Original progress records: ____
-- - New lemma progress records: ____
-- - Word encounters created: ____
-- Proceed to Phase 5: Validation
-- ============================================
