-- ============================================
-- PHASE 0: DISCOVERY - Run this FIRST
-- ============================================
-- Purpose: Understand current database state before migration
-- Run each section separately and save the results
-- ============================================

-- ============================================
-- SECTION 1: List all tables in public schema
-- ============================================
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- SECTION 2: Get row counts for all relevant tables
-- ============================================
SELECT 'vocabulary' as table_name, COUNT(*) as row_count FROM vocabulary
UNION ALL SELECT 'sentences', COUNT(*) FROM sentences
UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
UNION ALL SELECT 'user_vocabulary_progress', COUNT(*) FROM user_vocabulary_progress
UNION ALL SELECT 'user_daily_stats', COUNT(*) FROM user_daily_stats
ORDER BY table_name;

-- ============================================
-- SECTION 3: Check vocabulary table structure
-- ============================================
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'vocabulary'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- SECTION 4: Check if old tables exist
-- ============================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'vocabulary_forms',
    'vocabulary_lemmas',
    'vocabulary_occurrences',
    'books',
    'lemmas',
    'words'
  );

-- ============================================
-- SECTION 5: Sample vocabulary data (first 10 rows)
-- ============================================
SELECT
    vocab_id,
    lemma,
    english_definition,
    part_of_speech,
    is_canonical,
    canonical_vocab_id,
    is_stop_word,
    form_metadata
FROM vocabulary
LIMIT 10;

-- ============================================
-- SECTION 6: Check canonical relationship status
-- ============================================
SELECT
    is_canonical,
    COUNT(*) as count,
    COUNT(canonical_vocab_id) as has_canonical_id,
    COUNT(*) - COUNT(canonical_vocab_id) as missing_canonical_id
FROM vocabulary
GROUP BY is_canonical;

-- ============================================
-- SECTION 7: Check vocabulary_occurrences structure
-- ============================================
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'vocabulary_occurrences'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- SECTION 8: Sample vocabulary_occurrences
-- ============================================
SELECT * FROM vocabulary_occurrences LIMIT 10;

-- ============================================
-- SECTION 9: Check chapters table
-- ============================================
SELECT
    chapter_id,
    chapter_number,
    title
FROM chapters
ORDER BY chapter_number;

-- ============================================
-- SECTION 10: Check sentences table structure
-- ============================================
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'sentences'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- SECTION 11: Check user_vocabulary_progress structure
-- ============================================
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'user_vocabulary_progress'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- SECTION 12: Check if books table exists and has data
-- ============================================
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'books' AND table_schema = 'public'
) as books_table_exists;

-- If books exists, show data:
-- SELECT * FROM books;

-- ============================================
-- SECTION 13: Part of speech distribution
-- ============================================
SELECT
    part_of_speech,
    COUNT(*) as count,
    COUNT(CASE WHEN is_canonical = true THEN 1 END) as canonical_count,
    COUNT(CASE WHEN is_canonical = false THEN 1 END) as non_canonical_count
FROM vocabulary
GROUP BY part_of_speech
ORDER BY count DESC;

-- ============================================
-- SECTION 14: Check for existing user progress
-- ============================================
SELECT
    user_id,
    COUNT(*) as progress_records,
    AVG(mastery_level) as avg_mastery,
    AVG(health) as avg_health
FROM user_vocabulary_progress
GROUP BY user_id;

-- ============================================
-- SAVE THESE RESULTS!
-- Copy the output to a file before proceeding
-- ============================================
