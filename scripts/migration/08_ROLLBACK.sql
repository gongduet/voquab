-- ============================================
-- ROLLBACK SCRIPT
-- ============================================
-- Purpose: Undo migration if something goes wrong
-- ONLY RUN IF MIGRATION FAILED
-- ============================================

-- ============================================
-- WARNING: This will delete all new tables
-- and their data. Only run if needed!
-- ============================================

-- Uncomment and run these if rollback needed:

/*

-- Step 1: Drop new tables (in order due to foreign keys)
DROP TABLE IF EXISTS user_word_encounters CASCADE;
DROP TABLE IF EXISTS user_lemma_progress CASCADE;
DROP TABLE IF EXISTS words CASCADE;
DROP TABLE IF EXISTS lemmas CASCADE;

-- Step 2: Verify old tables still exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('vocabulary', 'vocabulary_occurrences', 'user_vocabulary_progress');

-- Step 3: If old tables were renamed, restore them
-- ALTER TABLE vocabulary_old RENAME TO vocabulary;
-- ALTER TABLE vocabulary_occurrences_old RENAME TO vocabulary_occurrences;
-- ALTER TABLE user_vocabulary_progress_old RENAME TO user_vocabulary_progress;

-- Step 4: Verify restoration
SELECT 'vocabulary' as table_name, COUNT(*) FROM vocabulary
UNION ALL SELECT 'vocabulary_occurrences', COUNT(*) FROM vocabulary_occurrences
UNION ALL SELECT 'user_vocabulary_progress', COUNT(*) FROM user_vocabulary_progress;

*/

-- ============================================
-- If rollback is needed:
-- 1. Uncomment the statements above
-- 2. Run them in order
-- 3. Verify data is restored
-- 4. Report results to Peter
-- ============================================

SELECT 'Rollback script ready - uncomment to execute' as status;
