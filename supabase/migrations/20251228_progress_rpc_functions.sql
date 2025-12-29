-- Migration: Progress RPC Functions
-- Created: 2025-12-28
-- Updated: 2025-12-28 - Use FSRS-based categorization instead of mastery_level
-- Purpose: Single source of truth for progress counts (dashboard + sessionBuilder)

-- ============================================
-- FUNCTION 1: get_book_progress
-- ============================================
-- Returns progress stats for a book including unlocked chapters,
-- due/new counts, and mastery breakdown.
--
-- FSRS Categorization:
-- - not_seen: No progress record OR reps = 0
-- - mastered: stability >= 21 AND fsrs_state = 2 (Review)
-- - familiar: stability >= 7 AND < 21 AND fsrs_state = 2
-- - learning: Everything else with reps >= 1

CREATE OR REPLACE FUNCTION get_book_progress(p_user_id UUID, p_book_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_total_chapters INTEGER;
  v_unlocked_chapters INTEGER[];
  v_current_chapter INTEGER;
  v_chapter_record RECORD;
  v_chapter_lemmas UUID[];
  v_chapter_phrases UUID[];
  v_introduced_lemmas INTEGER;
  v_introduced_phrases INTEGER;
  v_total_items INTEGER;
  v_intro_ratio NUMERIC;
  v_chapter_unlocked BOOLEAN;

  -- Vocab counts
  v_total_vocab INTEGER;
  v_due_count INTEGER;
  v_new_count INTEGER;

  -- Mastery breakdown
  v_mastered INTEGER := 0;
  v_familiar INTEGER := 0;
  v_learning INTEGER := 0;
  v_not_seen INTEGER := 0;

  -- Book vocab arrays
  v_book_lemmas UUID[];
  v_book_phrases UUID[];
  v_unlocked_lemmas UUID[];
  v_unlocked_phrases UUID[];
BEGIN
  -- Get total chapters for this book
  SELECT total_chapters INTO v_total_chapters
  FROM books WHERE book_id = p_book_id;

  IF v_total_chapters IS NULL THEN
    RETURN json_build_object(
      'due_count', 0,
      'new_count', 0,
      'mastered', 0,
      'familiar', 0,
      'learning', 0,
      'not_seen', 0,
      'total_vocab', 0,
      'unlocked_chapters', ARRAY[1],
      'current_chapter', 1,
      'total_chapters', 0
    );
  END IF;

  -- ========================================
  -- STEP 1: Calculate unlocked chapters
  -- ========================================
  v_unlocked_chapters := ARRAY[1]; -- Chapter 1 always unlocked
  v_current_chapter := 1;

  FOR v_chapter_record IN
    SELECT c.chapter_id, c.chapter_number
    FROM chapters c
    WHERE c.book_id = p_book_id
    ORDER BY c.chapter_number
  LOOP
    -- Get unique lemma_ids for this chapter (excluding stop words)
    SELECT ARRAY_AGG(DISTINCT w.lemma_id) INTO v_chapter_lemmas
    FROM words w
    JOIN lemmas l ON w.lemma_id = l.lemma_id
    WHERE w.chapter_id = v_chapter_record.chapter_id
      AND l.is_stop_word = FALSE
      AND w.lemma_id IS NOT NULL;

    v_chapter_lemmas := COALESCE(v_chapter_lemmas, ARRAY[]::UUID[]);

    -- Get unique phrase_ids for this chapter
    SELECT ARRAY_AGG(DISTINCT po.phrase_id) INTO v_chapter_phrases
    FROM phrase_occurrences po
    JOIN sentences s ON po.sentence_id = s.sentence_id
    WHERE s.chapter_id = v_chapter_record.chapter_id;

    v_chapter_phrases := COALESCE(v_chapter_phrases, ARRAY[]::UUID[]);

    -- Count introduced items
    SELECT COUNT(*) INTO v_introduced_lemmas
    FROM user_lemma_progress ulp
    WHERE ulp.user_id = p_user_id
      AND ulp.lemma_id = ANY(v_chapter_lemmas)
      AND ulp.reps >= 1;

    SELECT COUNT(*) INTO v_introduced_phrases
    FROM user_phrase_progress upp
    WHERE upp.user_id = p_user_id
      AND upp.phrase_id = ANY(v_chapter_phrases)
      AND upp.reps >= 1;

    v_total_items := COALESCE(array_length(v_chapter_lemmas, 1), 0) + COALESCE(array_length(v_chapter_phrases, 1), 0);

    -- Calculate introduction ratio
    IF v_total_items > 0 THEN
      v_intro_ratio := (v_introduced_lemmas + v_introduced_phrases)::NUMERIC / v_total_items;
    ELSE
      v_intro_ratio := 1.0; -- Empty chapter counts as complete
    END IF;

    -- Check if next chapter should be unlocked (95% threshold)
    IF v_intro_ratio >= 0.95 THEN
      -- This chapter is complete, unlock next if exists
      IF v_chapter_record.chapter_number < v_total_chapters THEN
        IF NOT (v_chapter_record.chapter_number + 1) = ANY(v_unlocked_chapters) THEN
          v_unlocked_chapters := array_append(v_unlocked_chapters, v_chapter_record.chapter_number + 1);
        END IF;
      END IF;
      v_current_chapter := v_chapter_record.chapter_number + 1;
    ELSE
      -- This chapter not complete, stop here
      v_current_chapter := v_chapter_record.chapter_number;
      EXIT;
    END IF;
  END LOOP;

  -- Cap current_chapter at total_chapters
  IF v_current_chapter > v_total_chapters THEN
    v_current_chapter := v_total_chapters;
  END IF;

  -- ========================================
  -- STEP 2: Calculate total vocab for book
  -- ========================================
  -- Get all unique lemmas in book (excluding stop words)
  SELECT ARRAY_AGG(DISTINCT w.lemma_id) INTO v_book_lemmas
  FROM words w
  JOIN lemmas l ON w.lemma_id = l.lemma_id
  WHERE w.book_id = p_book_id
    AND l.is_stop_word = FALSE
    AND w.lemma_id IS NOT NULL;

  v_book_lemmas := COALESCE(v_book_lemmas, ARRAY[]::UUID[]);

  -- Get all unique phrases in book
  SELECT ARRAY_AGG(DISTINCT po.phrase_id) INTO v_book_phrases
  FROM phrase_occurrences po
  JOIN sentences s ON po.sentence_id = s.sentence_id
  JOIN chapters c ON s.chapter_id = c.chapter_id
  WHERE c.book_id = p_book_id;

  v_book_phrases := COALESCE(v_book_phrases, ARRAY[]::UUID[]);

  v_total_vocab := COALESCE(array_length(v_book_lemmas, 1), 0) + COALESCE(array_length(v_book_phrases, 1), 0);

  -- ========================================
  -- STEP 3: Calculate due count
  -- ========================================
  SELECT COUNT(*) INTO v_due_count
  FROM (
    SELECT ulp.lemma_id
    FROM user_lemma_progress ulp
    WHERE ulp.user_id = p_user_id
      AND ulp.lemma_id = ANY(v_book_lemmas)
      AND ulp.due_date <= NOW()
    UNION ALL
    SELECT upp.phrase_id
    FROM user_phrase_progress upp
    WHERE upp.user_id = p_user_id
      AND upp.phrase_id = ANY(v_book_phrases)
      AND upp.due_date <= NOW()
  ) due_items;

  -- ========================================
  -- STEP 4: Calculate new count (unlocked chapters only)
  -- ========================================
  -- Get vocab from unlocked chapters
  SELECT ARRAY_AGG(DISTINCT w.lemma_id) INTO v_unlocked_lemmas
  FROM words w
  JOIN lemmas l ON w.lemma_id = l.lemma_id
  JOIN chapters c ON w.chapter_id = c.chapter_id
  WHERE c.book_id = p_book_id
    AND c.chapter_number = ANY(v_unlocked_chapters)
    AND l.is_stop_word = FALSE
    AND w.lemma_id IS NOT NULL;

  v_unlocked_lemmas := COALESCE(v_unlocked_lemmas, ARRAY[]::UUID[]);

  SELECT ARRAY_AGG(DISTINCT po.phrase_id) INTO v_unlocked_phrases
  FROM phrase_occurrences po
  JOIN sentences s ON po.sentence_id = s.sentence_id
  JOIN chapters c ON s.chapter_id = c.chapter_id
  WHERE c.book_id = p_book_id
    AND c.chapter_number = ANY(v_unlocked_chapters);

  v_unlocked_phrases := COALESCE(v_unlocked_phrases, ARRAY[]::UUID[]);

  -- Count new lemmas (no progress OR reps = 0)
  SELECT COUNT(*) INTO v_new_count
  FROM (
    SELECT unnest(v_unlocked_lemmas) AS item_id
    EXCEPT
    SELECT ulp.lemma_id
    FROM user_lemma_progress ulp
    WHERE ulp.user_id = p_user_id
      AND ulp.lemma_id = ANY(v_unlocked_lemmas)
      AND ulp.reps >= 1
  ) new_lemmas;

  -- Add new phrases
  v_new_count := v_new_count + (
    SELECT COUNT(*)
    FROM (
      SELECT unnest(v_unlocked_phrases) AS item_id
      EXCEPT
      SELECT upp.phrase_id
      FROM user_phrase_progress upp
      WHERE upp.user_id = p_user_id
        AND upp.phrase_id = ANY(v_unlocked_phrases)
        AND upp.reps >= 1
    ) new_phrases
  );

  -- ========================================
  -- STEP 5: Calculate mastery breakdown (entire book)
  -- Using FSRS-based categorization:
  -- - mastered: stability >= 21 AND fsrs_state = 2
  -- - familiar: stability >= 7 AND < 21 AND fsrs_state = 2
  -- - learning: reps >= 1 (everything else)
  -- ========================================
  -- Lemmas
  SELECT
    COALESCE(SUM(CASE
      WHEN COALESCE(ulp.stability, 0) >= 21 AND COALESCE(ulp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN COALESCE(ulp.stability, 0) >= 7 AND COALESCE(ulp.stability, 0) < 21 AND COALESCE(ulp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN ulp.reps >= 1
        AND NOT (COALESCE(ulp.stability, 0) >= 21 AND COALESCE(ulp.fsrs_state, 0) = 2)
        AND NOT (COALESCE(ulp.stability, 0) >= 7 AND COALESCE(ulp.stability, 0) < 21 AND COALESCE(ulp.fsrs_state, 0) = 2)
      THEN 1
      ELSE 0
    END), 0)
  INTO v_mastered, v_familiar, v_learning
  FROM user_lemma_progress ulp
  WHERE ulp.user_id = p_user_id
    AND ulp.lemma_id = ANY(v_book_lemmas);

  -- Add phrases to mastery counts
  SELECT
    v_mastered + COALESCE(SUM(CASE
      WHEN COALESCE(upp.stability, 0) >= 21 AND COALESCE(upp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    v_familiar + COALESCE(SUM(CASE
      WHEN COALESCE(upp.stability, 0) >= 7 AND COALESCE(upp.stability, 0) < 21 AND COALESCE(upp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    v_learning + COALESCE(SUM(CASE
      WHEN upp.reps >= 1
        AND NOT (COALESCE(upp.stability, 0) >= 21 AND COALESCE(upp.fsrs_state, 0) = 2)
        AND NOT (COALESCE(upp.stability, 0) >= 7 AND COALESCE(upp.stability, 0) < 21 AND COALESCE(upp.fsrs_state, 0) = 2)
      THEN 1
      ELSE 0
    END), 0)
  INTO v_mastered, v_familiar, v_learning
  FROM user_phrase_progress upp
  WHERE upp.user_id = p_user_id
    AND upp.phrase_id = ANY(v_book_phrases);

  -- Not seen = total - (mastered + familiar + learning)
  v_not_seen := v_total_vocab - (v_mastered + v_familiar + v_learning);

  -- ========================================
  -- Build result
  -- ========================================
  v_result := json_build_object(
    'due_count', COALESCE(v_due_count, 0),
    'new_count', COALESCE(v_new_count, 0),
    'mastered', COALESCE(v_mastered, 0),
    'familiar', COALESCE(v_familiar, 0),
    'learning', COALESCE(v_learning, 0),
    'not_seen', COALESCE(v_not_seen, 0),
    'total_vocab', COALESCE(v_total_vocab, 0),
    'unlocked_chapters', v_unlocked_chapters,
    'current_chapter', v_current_chapter,
    'total_chapters', v_total_chapters
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- FUNCTION 2: get_song_progress
-- ============================================
-- Returns progress stats for a song including due/new counts
-- and mastery breakdown. Only tracks lemmas + phrases (no slang).
--
-- FSRS Categorization:
-- - not_seen: No progress record OR reps = 0
-- - mastered: stability >= 21 AND fsrs_state = 2 (Review)
-- - familiar: stability >= 7 AND < 21 AND fsrs_state = 2
-- - learning: Everything else with reps >= 1

CREATE OR REPLACE FUNCTION get_song_progress(p_user_id UUID, p_song_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_sections INTEGER;
  v_total_vocab INTEGER;
  v_due_count INTEGER;
  v_new_count INTEGER;

  -- Mastery breakdown
  v_mastered INTEGER := 0;
  v_familiar INTEGER := 0;
  v_learning INTEGER := 0;
  v_not_seen INTEGER := 0;

  -- Song vocab arrays
  v_song_lemmas UUID[];
  v_song_phrases UUID[];
BEGIN
  -- ========================================
  -- STEP 1: Get song vocab (lemmas + phrases only)
  -- ========================================
  SELECT ARRAY_AGG(sl.lemma_id) INTO v_song_lemmas
  FROM song_lemmas sl
  WHERE sl.song_id = p_song_id;

  v_song_lemmas := COALESCE(v_song_lemmas, ARRAY[]::UUID[]);

  SELECT ARRAY_AGG(sp.phrase_id) INTO v_song_phrases
  FROM song_phrases sp
  WHERE sp.song_id = p_song_id;

  v_song_phrases := COALESCE(v_song_phrases, ARRAY[]::UUID[]);

  v_total_vocab := COALESCE(array_length(v_song_lemmas, 1), 0) + COALESCE(array_length(v_song_phrases, 1), 0);

  -- ========================================
  -- STEP 2: Get section count
  -- ========================================
  SELECT COUNT(*) INTO v_sections
  FROM song_sections ss
  WHERE ss.song_id = p_song_id;

  -- ========================================
  -- STEP 3: Calculate due count
  -- ========================================
  SELECT COUNT(*) INTO v_due_count
  FROM (
    SELECT ulp.lemma_id
    FROM user_lemma_progress ulp
    WHERE ulp.user_id = p_user_id
      AND ulp.lemma_id = ANY(v_song_lemmas)
      AND ulp.due_date <= NOW()
    UNION ALL
    SELECT upp.phrase_id
    FROM user_phrase_progress upp
    WHERE upp.user_id = p_user_id
      AND upp.phrase_id = ANY(v_song_phrases)
      AND upp.due_date <= NOW()
  ) due_items;

  -- ========================================
  -- STEP 4: Calculate new count
  -- ========================================
  -- Count new lemmas (no progress OR reps = 0)
  SELECT COUNT(*) INTO v_new_count
  FROM (
    SELECT unnest(v_song_lemmas) AS item_id
    EXCEPT
    SELECT ulp.lemma_id
    FROM user_lemma_progress ulp
    WHERE ulp.user_id = p_user_id
      AND ulp.lemma_id = ANY(v_song_lemmas)
      AND ulp.reps >= 1
  ) new_lemmas;

  -- Add new phrases
  v_new_count := v_new_count + (
    SELECT COUNT(*)
    FROM (
      SELECT unnest(v_song_phrases) AS item_id
      EXCEPT
      SELECT upp.phrase_id
      FROM user_phrase_progress upp
      WHERE upp.user_id = p_user_id
        AND upp.phrase_id = ANY(v_song_phrases)
        AND upp.reps >= 1
    ) new_phrases
  );

  -- ========================================
  -- STEP 5: Calculate mastery breakdown
  -- Using FSRS-based categorization:
  -- - mastered: stability >= 21 AND fsrs_state = 2
  -- - familiar: stability >= 7 AND < 21 AND fsrs_state = 2
  -- - learning: reps >= 1 (everything else)
  -- ========================================
  -- Lemmas
  SELECT
    COALESCE(SUM(CASE
      WHEN COALESCE(ulp.stability, 0) >= 21 AND COALESCE(ulp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN COALESCE(ulp.stability, 0) >= 7 AND COALESCE(ulp.stability, 0) < 21 AND COALESCE(ulp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN ulp.reps >= 1
        AND NOT (COALESCE(ulp.stability, 0) >= 21 AND COALESCE(ulp.fsrs_state, 0) = 2)
        AND NOT (COALESCE(ulp.stability, 0) >= 7 AND COALESCE(ulp.stability, 0) < 21 AND COALESCE(ulp.fsrs_state, 0) = 2)
      THEN 1
      ELSE 0
    END), 0)
  INTO v_mastered, v_familiar, v_learning
  FROM user_lemma_progress ulp
  WHERE ulp.user_id = p_user_id
    AND ulp.lemma_id = ANY(v_song_lemmas);

  -- Add phrases to mastery counts
  SELECT
    v_mastered + COALESCE(SUM(CASE
      WHEN COALESCE(upp.stability, 0) >= 21 AND COALESCE(upp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    v_familiar + COALESCE(SUM(CASE
      WHEN COALESCE(upp.stability, 0) >= 7 AND COALESCE(upp.stability, 0) < 21 AND COALESCE(upp.fsrs_state, 0) = 2 THEN 1
      ELSE 0
    END), 0),
    v_learning + COALESCE(SUM(CASE
      WHEN upp.reps >= 1
        AND NOT (COALESCE(upp.stability, 0) >= 21 AND COALESCE(upp.fsrs_state, 0) = 2)
        AND NOT (COALESCE(upp.stability, 0) >= 7 AND COALESCE(upp.stability, 0) < 21 AND COALESCE(upp.fsrs_state, 0) = 2)
      THEN 1
      ELSE 0
    END), 0)
  INTO v_mastered, v_familiar, v_learning
  FROM user_phrase_progress upp
  WHERE upp.user_id = p_user_id
    AND upp.phrase_id = ANY(v_song_phrases);

  -- Not seen = total - (mastered + familiar + learning)
  v_not_seen := v_total_vocab - (v_mastered + v_familiar + v_learning);

  -- ========================================
  -- Build result
  -- ========================================
  v_result := json_build_object(
    'due_count', COALESCE(v_due_count, 0),
    'new_count', COALESCE(v_new_count, 0),
    'mastered', COALESCE(v_mastered, 0),
    'familiar', COALESCE(v_familiar, 0),
    'learning', COALESCE(v_learning, 0),
    'not_seen', COALESCE(v_not_seen, 0),
    'total_vocab', COALESCE(v_total_vocab, 0),
    'sections', COALESCE(v_sections, 0)
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION get_book_progress(UUID, UUID) IS
  'Returns comprehensive progress stats for a book: due/new counts, FSRS-based mastery breakdown, unlocked chapters. Single source of truth for dashboard and sessionBuilder.';

COMMENT ON FUNCTION get_song_progress(UUID, UUID) IS
  'Returns progress stats for a song: due/new counts, FSRS-based mastery breakdown, section count. Tracks lemmas + phrases only (no slang).';
