-- ============================================
-- PHASE 6: CREATE INDEXES
-- ============================================
-- Purpose: Add performance indexes to new tables
-- Run AFTER validation passes
-- ============================================

-- ============================================
-- VOCABULARY INDEXES
-- ============================================

-- Lemmas: Search by language and stop word status
CREATE INDEX IF NOT EXISTS idx_lemmas_language ON lemmas(language_code);
CREATE INDEX IF NOT EXISTS idx_lemmas_stop_word ON lemmas(is_stop_word);
CREATE INDEX IF NOT EXISTS idx_lemmas_pos ON lemmas(part_of_speech);
CREATE INDEX IF NOT EXISTS idx_lemmas_text ON lemmas(lemma_text);

-- Words: Primary lookups
CREATE INDEX IF NOT EXISTS idx_words_lemma ON words(lemma_id);
CREATE INDEX IF NOT EXISTS idx_words_sentence ON words(sentence_id);
CREATE INDEX IF NOT EXISTS idx_words_chapter ON words(chapter_id);
CREATE INDEX IF NOT EXISTS idx_words_book ON words(book_id);

-- ============================================
-- USER PROGRESS INDEXES
-- ============================================

-- Critical for flashcard selection queries
CREATE INDEX IF NOT EXISTS idx_user_progress_health ON user_lemma_progress(user_id, health);
CREATE INDEX IF NOT EXISTS idx_user_progress_mastery ON user_lemma_progress(user_id, mastery_level);
CREATE INDEX IF NOT EXISTS idx_user_progress_review_due ON user_lemma_progress(user_id, review_due);
CREATE INDEX IF NOT EXISTS idx_user_progress_last_reviewed ON user_lemma_progress(user_id, last_reviewed_at);

-- User encounters
CREATE INDEX IF NOT EXISTS idx_encounters_user ON user_word_encounters(user_id);
CREATE INDEX IF NOT EXISTS idx_encounters_word ON user_word_encounters(word_id);

-- ============================================
-- VERIFY INDEXES
-- ============================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('lemmas', 'words', 'user_lemma_progress', 'user_word_encounters')
ORDER BY tablename, indexname;

-- ============================================
-- ANALYZE TABLES for query planner
-- ============================================
ANALYZE lemmas;
ANALYZE words;
ANALYZE user_lemma_progress;
ANALYZE user_word_encounters;

SELECT 'Indexes created and tables analyzed' as status;
