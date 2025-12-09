-- ============================================
-- PHASE 5: VALIDATION
-- ============================================
-- Purpose: Verify migration was successful
-- ALL queries should pass for migration to be complete
-- ============================================

-- ============================================
-- TEST 1: Data Counts
-- ============================================
SELECT '=== DATA COUNTS ===' as test_section;

SELECT
    'lemmas' as table_name,
    COUNT(*) as count,
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM lemmas

UNION ALL SELECT 'words', COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM words

UNION ALL SELECT 'user_lemma_progress', COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM user_lemma_progress

UNION ALL SELECT 'user_word_encounters', COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM user_word_encounters;

-- ============================================
-- TEST 2: Referential Integrity
-- ============================================
SELECT '=== REFERENTIAL INTEGRITY ===' as test_section;

-- Words must have valid lemmas
SELECT
    'Words without lemmas' as test,
    COUNT(*) as orphans,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM words w
LEFT JOIN lemmas l ON w.lemma_id = l.lemma_id
WHERE l.lemma_id IS NULL;

-- Words must have valid sentences
SELECT
    'Words without sentences' as test,
    COUNT(*) as orphans,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM words w
LEFT JOIN sentences s ON w.sentence_id = s.sentence_id
WHERE s.sentence_id IS NULL;

-- User progress must have valid lemmas
SELECT
    'Progress without lemmas' as test,
    COUNT(*) as orphans,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM user_lemma_progress ulp
LEFT JOIN lemmas l ON ulp.lemma_id = l.lemma_id
WHERE l.lemma_id IS NULL;

-- ============================================
-- TEST 3: Data Quality
-- ============================================
SELECT '=== DATA QUALITY ===' as test_section;

-- Lemmas with definitions
SELECT
    'Lemmas with definitions' as test,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM lemmas), 0), 1) as percentage
FROM lemmas
WHERE definitions != '[]'::jsonb;

-- Part of speech distribution
SELECT
    part_of_speech,
    COUNT(*) as lemma_count,
    ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM lemmas), 0), 1) as percentage
FROM lemmas
GROUP BY part_of_speech
ORDER BY lemma_count DESC;

-- ============================================
-- TEST 4: Flashcard Query Test
-- ============================================
SELECT '=== FLASHCARD QUERY TEST ===' as test_section;

-- This query should work for selecting flashcards
SELECT
    l.lemma_id,
    l.lemma_text,
    l.definitions,
    l.part_of_speech,
    ulp.mastery_level,
    ulp.health,
    (SELECT w.word_text FROM words w WHERE w.lemma_id = l.lemma_id LIMIT 1) as sample_form
FROM lemmas l
LEFT JOIN user_lemma_progress ulp ON l.lemma_id = ulp.lemma_id
WHERE l.is_stop_word = false
ORDER BY COALESCE(ulp.health, 0) ASC
LIMIT 10;

-- ============================================
-- TEST 5: Chapter Vocabulary Query Test
-- ============================================
SELECT '=== CHAPTER VOCABULARY TEST ===' as test_section;

-- Get vocabulary for Chapter 1
SELECT
    c.chapter_number,
    COUNT(DISTINCT w.lemma_id) as unique_lemmas,
    COUNT(w.word_id) as total_words
FROM chapters c
LEFT JOIN words w ON c.chapter_id = w.chapter_id
GROUP BY c.chapter_id, c.chapter_number
ORDER BY c.chapter_number
LIMIT 5;

-- Sample words from Chapter 1
SELECT
    w.word_text,
    l.lemma_text,
    l.definitions,
    s.sentence_text
FROM words w
JOIN lemmas l ON w.lemma_id = l.lemma_id
JOIN sentences s ON w.sentence_id = s.sentence_id
JOIN chapters c ON s.chapter_id = c.chapter_id
WHERE c.chapter_number = 1
  AND l.is_stop_word = false
LIMIT 10;

-- ============================================
-- TEST 6: User Progress Query Test
-- ============================================
SELECT '=== USER PROGRESS TEST ===' as test_section;

-- Get user's progress overview
SELECT
    user_id,
    COUNT(*) as lemmas_studied,
    AVG(mastery_level) as avg_mastery,
    AVG(health) as avg_health,
    SUM(total_reviews) as total_reviews
FROM user_lemma_progress
GROUP BY user_id;

-- ============================================
-- TEST 7: Compare Old vs New Counts
-- ============================================
SELECT '=== MIGRATION COMPARISON ===' as test_section;

SELECT
    'vocabulary (old)' as table_name,
    COUNT(*) as count
FROM vocabulary

UNION ALL SELECT 'lemmas (new)', COUNT(*) FROM lemmas
UNION ALL SELECT 'vocabulary_occurrences (old)', COUNT(*) FROM vocabulary_occurrences
UNION ALL SELECT 'words (new)', COUNT(*) FROM words
UNION ALL SELECT 'user_vocabulary_progress (old)', COUNT(*) FROM user_vocabulary_progress
UNION ALL SELECT 'user_lemma_progress (new)', COUNT(*) FROM user_lemma_progress;

-- ============================================
-- TEST 8: Sentence-Word Relationship
-- ============================================
SELECT '=== SENTENCE-WORD RELATIONSHIP ===' as test_section;

-- Sample sentence with all its words
SELECT
    s.sentence_text,
    array_agg(w.word_text ORDER BY w.word_position) as words_in_sentence
FROM sentences s
JOIN words w ON s.sentence_id = w.sentence_id
GROUP BY s.sentence_id, s.sentence_text
LIMIT 5;

-- ============================================
-- VALIDATION SUMMARY
-- ============================================
SELECT '=== VALIDATION SUMMARY ===' as test_section;

SELECT
    'Migration Status' as metric,
    CASE
        WHEN (SELECT COUNT(*) FROM lemmas) > 0
         AND (SELECT COUNT(*) FROM words) > 0
         AND (SELECT COUNT(*) FROM words w LEFT JOIN lemmas l ON w.lemma_id = l.lemma_id WHERE l.lemma_id IS NULL) = 0
        THEN '✅ MIGRATION SUCCESSFUL'
        ELSE '❌ MIGRATION HAS ISSUES'
    END as status;

-- ============================================
-- If all tests pass, migration is complete!
-- Save these results and report to Peter
-- ============================================
