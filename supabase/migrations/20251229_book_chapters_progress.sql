-- Migration: Book Chapters Progress RPC
-- Created: 2025-12-29
-- Updated: 2025-12-29 - Include phrases in counts (matching get_book_progress)
-- Purpose: Get per-chapter progress for a book (used by BookDashboard)

-- Drop existing function (return type changed from total_lemmas to total_vocab)
DROP FUNCTION IF EXISTS get_book_chapters_progress(UUID, UUID);

CREATE OR REPLACE FUNCTION get_book_chapters_progress(p_user_id UUID, p_book_id UUID)
RETURNS TABLE (
  chapter_number INTEGER,
  title TEXT,
  total_vocab INTEGER,
  mastered INTEGER,
  familiar INTEGER,
  learning INTEGER,
  not_seen INTEGER,
  is_unlocked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked_chapters INTEGER[];
BEGIN
  -- First, calculate which chapters are unlocked (95% threshold)
  -- Based on lemmas + phrases introduced (reps >= 1)

  WITH chapter_lemmas AS (
    SELECT
      c.chapter_number,
      COUNT(DISTINCT l.lemma_id) AS total,
      COUNT(DISTINCT CASE WHEN ulp.reps >= 1 THEN l.lemma_id END) AS introduced
    FROM chapters c
    JOIN sentences s ON s.chapter_id = c.chapter_id
    JOIN words w ON w.sentence_id = s.sentence_id
    JOIN lemmas l ON l.lemma_id = w.lemma_id
    LEFT JOIN user_lemma_progress ulp ON ulp.lemma_id = l.lemma_id AND ulp.user_id = p_user_id
    WHERE c.book_id = p_book_id
      AND l.is_stop_word = FALSE
    GROUP BY c.chapter_number
  ),
  chapter_phrases AS (
    SELECT
      c.chapter_number,
      COUNT(DISTINCT po.phrase_id) AS total,
      COUNT(DISTINCT CASE WHEN upp.reps >= 1 THEN po.phrase_id END) AS introduced
    FROM chapters c
    JOIN sentences s ON s.chapter_id = c.chapter_id
    JOIN phrase_occurrences po ON po.sentence_id = s.sentence_id
    LEFT JOIN user_phrase_progress upp ON upp.phrase_id = po.phrase_id AND upp.user_id = p_user_id
    WHERE c.book_id = p_book_id
    GROUP BY c.chapter_number
  ),
  chapter_completion AS (
    SELECT
      COALESCE(cl.chapter_number, cp.chapter_number) AS chapter_number,
      COALESCE(cl.total, 0) + COALESCE(cp.total, 0) AS total,
      COALESCE(cl.introduced, 0) + COALESCE(cp.introduced, 0) AS introduced
    FROM chapter_lemmas cl
    FULL OUTER JOIN chapter_phrases cp ON cl.chapter_number = cp.chapter_number
  ),
  unlocked_calc AS (
    SELECT
      cc.chapter_number,
      CASE
        WHEN cc.chapter_number = 1 THEN TRUE
        WHEN LAG(cc.introduced::FLOAT / NULLIF(cc.total, 0), 1) OVER (ORDER BY cc.chapter_number) >= 0.95 THEN TRUE
        ELSE FALSE
      END AS is_unlocked
    FROM chapter_completion cc
  )
  SELECT ARRAY_AGG(uc.chapter_number) INTO v_unlocked_chapters
  FROM unlocked_calc uc
  WHERE uc.is_unlocked = TRUE;

  -- Handle case where no chapters are unlocked yet (chapter 1 always unlocked)
  IF v_unlocked_chapters IS NULL THEN
    v_unlocked_chapters := ARRAY[1];
  END IF;

  -- Return chapter-level stats with FSRS-based mastery thresholds
  -- Combining lemmas and phrases
  RETURN QUERY
  WITH lemma_stats AS (
    SELECT
      c.chapter_number,
      c.title,
      COUNT(DISTINCT l.lemma_id) AS total_lemmas,
      COUNT(DISTINCT CASE
        WHEN COALESCE(ulp.fsrs_state, 0) = 2 AND COALESCE(ulp.stability, 0) >= 21 THEN l.lemma_id
      END) AS mastered_lemmas,
      COUNT(DISTINCT CASE
        WHEN COALESCE(ulp.fsrs_state, 0) = 2 AND COALESCE(ulp.stability, 0) >= 7 AND COALESCE(ulp.stability, 0) < 21 THEN l.lemma_id
      END) AS familiar_lemmas,
      COUNT(DISTINCT CASE
        WHEN ulp.reps >= 1
          AND NOT (COALESCE(ulp.fsrs_state, 0) = 2 AND COALESCE(ulp.stability, 0) >= 7) THEN l.lemma_id
      END) AS learning_lemmas,
      COUNT(DISTINCT CASE
        WHEN ulp.lemma_id IS NULL OR COALESCE(ulp.reps, 0) = 0 THEN l.lemma_id
      END) AS not_seen_lemmas
    FROM chapters c
    JOIN sentences s ON s.chapter_id = c.chapter_id
    JOIN words w ON w.sentence_id = s.sentence_id
    JOIN lemmas l ON l.lemma_id = w.lemma_id
    LEFT JOIN user_lemma_progress ulp ON ulp.lemma_id = l.lemma_id AND ulp.user_id = p_user_id
    WHERE c.book_id = p_book_id
      AND l.is_stop_word = FALSE
    GROUP BY c.chapter_number, c.title
  ),
  phrase_stats AS (
    SELECT
      c.chapter_number,
      COUNT(DISTINCT po.phrase_id) AS total_phrases,
      COUNT(DISTINCT CASE
        WHEN COALESCE(upp.fsrs_state, 0) = 2 AND COALESCE(upp.stability, 0) >= 21 THEN po.phrase_id
      END) AS mastered_phrases,
      COUNT(DISTINCT CASE
        WHEN COALESCE(upp.fsrs_state, 0) = 2 AND COALESCE(upp.stability, 0) >= 7 AND COALESCE(upp.stability, 0) < 21 THEN po.phrase_id
      END) AS familiar_phrases,
      COUNT(DISTINCT CASE
        WHEN upp.reps >= 1
          AND NOT (COALESCE(upp.fsrs_state, 0) = 2 AND COALESCE(upp.stability, 0) >= 7) THEN po.phrase_id
      END) AS learning_phrases,
      COUNT(DISTINCT CASE
        WHEN upp.phrase_id IS NULL OR COALESCE(upp.reps, 0) = 0 THEN po.phrase_id
      END) AS not_seen_phrases
    FROM chapters c
    JOIN sentences s ON s.chapter_id = c.chapter_id
    JOIN phrase_occurrences po ON po.sentence_id = s.sentence_id
    LEFT JOIN user_phrase_progress upp ON upp.phrase_id = po.phrase_id AND upp.user_id = p_user_id
    WHERE c.book_id = p_book_id
    GROUP BY c.chapter_number
  )
  SELECT
    ls.chapter_number::INTEGER,
    ls.title::TEXT,
    (COALESCE(ls.total_lemmas, 0) + COALESCE(ps.total_phrases, 0))::INTEGER AS total_vocab,
    (COALESCE(ls.mastered_lemmas, 0) + COALESCE(ps.mastered_phrases, 0))::INTEGER AS mastered,
    (COALESCE(ls.familiar_lemmas, 0) + COALESCE(ps.familiar_phrases, 0))::INTEGER AS familiar,
    (COALESCE(ls.learning_lemmas, 0) + COALESCE(ps.learning_phrases, 0))::INTEGER AS learning,
    (COALESCE(ls.not_seen_lemmas, 0) + COALESCE(ps.not_seen_phrases, 0))::INTEGER AS not_seen,
    (ls.chapter_number = ANY(v_unlocked_chapters))::BOOLEAN AS is_unlocked
  FROM lemma_stats ls
  LEFT JOIN phrase_stats ps ON ls.chapter_number = ps.chapter_number
  ORDER BY ls.chapter_number;
END;
$$;

COMMENT ON FUNCTION get_book_chapters_progress(UUID, UUID) IS
  'Returns per-chapter progress stats for BookDashboard. Includes both lemmas and phrases. Uses FSRS-based mastery thresholds and 95% introduction threshold for chapter unlocking.';
