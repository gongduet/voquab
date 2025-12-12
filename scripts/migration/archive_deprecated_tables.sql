-- =============================================================================
-- ARCHIVE DEPRECATED VOCABULARY TABLES
-- Date: December 12, 2025
-- Purpose: Rename old vocabulary tables to archive them, delete empty table
-- =============================================================================

-- Pre-check: Verify tables exist and show row counts
SELECT 'PRE-ARCHIVE STATUS' as step;
SELECT 'vocabulary' as table_name, COUNT(*) as rows FROM vocabulary
UNION ALL SELECT 'vocabulary_forms', COUNT(*) FROM vocabulary_forms
UNION ALL SELECT 'vocabulary_lemmas', COUNT(*) FROM vocabulary_lemmas
UNION ALL SELECT 'vocabulary_occurrences', COUNT(*) FROM vocabulary_occurrences;

-- =============================================================================
-- STEP 1: Rename vocabulary -> vocabulary_deprecated_20251212
-- =============================================================================
ALTER TABLE vocabulary RENAME TO vocabulary_deprecated_20251212;

-- =============================================================================
-- STEP 2: Rename vocabulary_forms -> vocabulary_forms_deprecated_20251212
-- =============================================================================
ALTER TABLE vocabulary_forms RENAME TO vocabulary_forms_deprecated_20251212;

-- =============================================================================
-- STEP 3: Rename vocabulary_lemmas -> vocabulary_lemmas_deprecated_20251212
-- =============================================================================
ALTER TABLE vocabulary_lemmas RENAME TO vocabulary_lemmas_deprecated_20251212;

-- =============================================================================
-- STEP 4: Drop empty vocabulary_occurrences table
-- =============================================================================
DROP TABLE IF EXISTS vocabulary_occurrences;

-- =============================================================================
-- POST-ARCHIVE VERIFICATION
-- =============================================================================
SELECT 'POST-ARCHIVE STATUS' as step;

-- Verify renamed tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%deprecated%'
ORDER BY table_name;

-- Verify vocabulary_occurrences is gone
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'vocabulary_occurrences'
) as vocabulary_occurrences_exists;

-- Verify active tables still work
SELECT 'ACTIVE TABLES CHECK' as step;
SELECT 'lemmas' as table_name, COUNT(*) as rows FROM lemmas
UNION ALL SELECT 'words', COUNT(*) FROM words
UNION ALL SELECT 'sentences', COUNT(*) FROM sentences
UNION ALL SELECT 'chapters', COUNT(*) FROM chapters
UNION ALL SELECT 'books', COUNT(*) FROM books;

SELECT 'ARCHIVE COMPLETE' as status;
