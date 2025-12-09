-- ============================================
-- PHASE 3: MIGRATE WORDS
-- ============================================
-- Purpose: Create word instances from vocabulary_occurrences
-- Each occurrence becomes a word pointing to its lemma
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

-- Verify mapping exists
SELECT COUNT(*) as mapping_count FROM vocab_to_lemma;

-- ============================================
-- STEP 1: Preview word migration
-- ============================================
-- Count occurrences to migrate
SELECT
    'vocabulary_occurrences to migrate' as metric,
    COUNT(*) as count
FROM vocabulary_occurrences;

-- Check what data is available
SELECT
    vo.vocab_id,
    vo.sentence_id,
    v.lemma as word_text,
    s.chapter_id
FROM vocabulary_occurrences vo
JOIN vocabulary v ON vo.vocab_id = v.vocab_id
JOIN sentences s ON vo.sentence_id = s.sentence_id
LIMIT 10;

-- ============================================
-- STEP 2: Get book_id for El Principito
-- ============================================
-- Store book_id in a temp table for the INSERT
CREATE TEMP TABLE temp_book AS
SELECT book_id FROM books WHERE title = 'El Principito' LIMIT 1;

SELECT * FROM temp_book;

-- ============================================
-- STEP 3: Insert words from vocabulary_occurrences
-- ============================================
INSERT INTO words (
    word_id,
    word_text,
    lemma_id,
    book_id,
    chapter_id,
    sentence_id,
    word_position,
    grammatical_info,
    created_at
)
SELECT
    gen_random_uuid() as word_id,
    v.lemma as word_text,  -- The form as it appears in text
    vtl.lemma_id,
    (SELECT book_id FROM temp_book) as book_id,
    s.chapter_id,
    vo.sentence_id,
    COALESCE(vo.word_position, 0) as word_position,
    COALESCE(v.form_metadata, '{}'::jsonb) as grammatical_info,
    COALESCE(vo.created_at, NOW()) as created_at
FROM vocabulary_occurrences vo
JOIN vocabulary v ON vo.vocab_id = v.vocab_id
JOIN sentences s ON vo.sentence_id = s.sentence_id
JOIN vocab_to_lemma vtl ON vo.vocab_id = vtl.old_vocab_id
WHERE vtl.lemma_id IN (SELECT lemma_id FROM lemmas);  -- Only where lemma exists

-- ============================================
-- STEP 4: Verify word migration
-- ============================================
SELECT
    'Words created' as metric,
    COUNT(*) as count
FROM words;

-- Compare to original occurrences
SELECT
    'Original occurrences' as source,
    COUNT(*) as count
FROM vocabulary_occurrences

UNION ALL

SELECT
    'New words',
    COUNT(*)
FROM words;

-- Check words per chapter
SELECT
    c.chapter_number,
    COUNT(w.word_id) as word_count
FROM chapters c
LEFT JOIN words w ON c.chapter_id = w.chapter_id
GROUP BY c.chapter_number
ORDER BY c.chapter_number;

-- Sample words with their lemmas
SELECT
    w.word_text,
    l.lemma_text,
    l.part_of_speech,
    w.sentence_id,
    w.word_position
FROM words w
JOIN lemmas l ON w.lemma_id = l.lemma_id
LIMIT 20;

-- ============================================
-- STEP 5: Check for orphaned words
-- ============================================
-- Words without valid lemmas (should be 0)
SELECT
    'Orphaned words (no lemma)' as issue,
    COUNT(*) as count
FROM words w
LEFT JOIN lemmas l ON w.lemma_id = l.lemma_id
WHERE l.lemma_id IS NULL;

-- Words without sentences (should be 0)
SELECT
    'Orphaned words (no sentence)' as issue,
    COUNT(*)
FROM words w
LEFT JOIN sentences s ON w.sentence_id = s.sentence_id
WHERE s.sentence_id IS NULL;

-- ============================================
-- PHASE 3 COMPLETE!
-- Report these numbers:
-- - Original occurrences: ____
-- - Words created: ____
-- - Orphaned words: ____ (should be 0)
-- Proceed to Phase 4: Migrate User Progress
-- ============================================
