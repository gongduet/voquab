-- Sentence Split V2: Migrates words instead of deleting them
-- Preserves lemma associations for proper vocabulary learning
-- Uses temporary high order numbers to avoid constraint violations

CREATE OR REPLACE FUNCTION split_sentence_v2(
  p_original_sentence_id UUID,
  p_new_sentences JSONB  -- Array of {text, translation, isParagraphStart}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_chapter_id UUID;
  v_book_id UUID;
  v_original_order INT;
  v_order_shift INT;
  v_new_sentence JSONB;
  v_new_sentence_id UUID;
  v_new_sentence_ids UUID[] := '{}';
  v_temp_order INT := 10000; -- Temporary high order number
  v_index INT := 0;
  v_sentence_to_shift RECORD;
  v_db_words UUID[];
  v_db_word_count INT;
  v_ui_word_counts INT[] := '{}';
  v_ui_total_words INT := 0;
  v_word_cursor INT := 1;
  v_word_count_for_sentence INT;
  v_new_position INT;
  v_word_id UUID;
  v_j INT;
BEGIN
  -- Step 1: Get original sentence details
  SELECT s.*, c.book_id INTO v_original
  FROM sentences s
  JOIN chapters c ON s.chapter_id = c.chapter_id
  WHERE s.sentence_id = p_original_sentence_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original sentence not found');
  END IF;

  v_chapter_id := v_original.chapter_id;
  v_book_id := v_original.book_id;
  v_original_order := v_original.sentence_order;
  v_order_shift := jsonb_array_length(p_new_sentences) - 1;

  -- Step 2: Get all words for original sentence (ordered by position)
  SELECT ARRAY_AGG(word_id ORDER BY word_position)
  INTO v_db_words
  FROM words
  WHERE sentence_id = p_original_sentence_id;

  v_db_word_count := COALESCE(array_length(v_db_words, 1), 0);

  -- Step 3: Count words in each UI sentence text
  FOR v_new_sentence IN SELECT * FROM jsonb_array_elements(p_new_sentences)
  LOOP
    v_word_count_for_sentence := array_length(
      regexp_split_to_array(trim(v_new_sentence->>'text'), '\s+'),
      1
    );
    v_ui_word_counts := array_append(v_ui_word_counts, v_word_count_for_sentence);
    v_ui_total_words := v_ui_total_words + v_word_count_for_sentence;
  END LOOP;

  -- Step 4: VALIDATE word counts match
  IF v_db_word_count != v_ui_total_words THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format(
        'Word count mismatch: database has %s words, UI expects %s words. Cannot safely migrate words.',
        v_db_word_count, v_ui_total_words
      ),
      'dbWordCount', v_db_word_count,
      'uiWordCount', v_ui_total_words
    );
  END IF;

  -- Step 5: Delete related data (but NOT words - we'll migrate those)
  DELETE FROM sentence_fragments WHERE sentence_id = p_original_sentence_id;
  DELETE FROM phrase_occurrences WHERE sentence_id = p_original_sentence_id;
  DELETE FROM user_sentence_progress WHERE sentence_id = p_original_sentence_id;

  -- Step 6: Create new sentences with TEMPORARY high order numbers and migrate words
  v_index := 0;
  v_word_cursor := 1;

  FOR v_new_sentence IN SELECT * FROM jsonb_array_elements(p_new_sentences)
  LOOP
    -- Create with temporary order (10000+) to avoid constraint conflicts
    INSERT INTO sentences (
      chapter_id,
      sentence_order,
      sentence_text,
      sentence_translation,
      is_paragraph_start,
      is_reviewed
    ) VALUES (
      v_chapter_id,
      v_temp_order + v_index,
      v_new_sentence->>'text',
      COALESCE(v_new_sentence->>'translation', ''),
      CASE
        WHEN v_index = 0 THEN v_original.is_paragraph_start
        ELSE COALESCE((v_new_sentence->>'isParagraphStart')::boolean, false)
      END,
      false
    )
    RETURNING sentence_id INTO v_new_sentence_id;

    v_new_sentence_ids := array_append(v_new_sentence_ids, v_new_sentence_id);

    -- Migrate words immediately to new sentence
    v_word_count_for_sentence := v_ui_word_counts[v_index + 1];
    v_new_position := 1;

    FOR v_j IN 1..v_word_count_for_sentence
    LOOP
      IF v_word_cursor <= v_db_word_count THEN
        v_word_id := v_db_words[v_word_cursor];

        UPDATE words
        SET sentence_id = v_new_sentence_id,
            word_position = v_new_position
        WHERE word_id = v_word_id;

        v_new_position := v_new_position + 1;
        v_word_cursor := v_word_cursor + 1;
      END IF;
    END LOOP;

    v_index := v_index + 1;
  END LOOP;

  -- Step 7: Delete original sentence (words are already migrated)
  DELETE FROM sentences WHERE sentence_id = p_original_sentence_id;

  -- Step 8: Shift subsequent sentences if needed (in REVERSE order to avoid conflicts)
  IF v_order_shift > 0 THEN
    FOR v_sentence_to_shift IN
      SELECT sentence_id, sentence_order
      FROM sentences
      WHERE chapter_id = v_chapter_id
        AND sentence_order >= v_original_order
        AND sentence_order < 10000  -- Exclude our temporary sentences
      ORDER BY sentence_order DESC
    LOOP
      UPDATE sentences
      SET sentence_order = v_sentence_to_shift.sentence_order + v_order_shift
      WHERE sentence_id = v_sentence_to_shift.sentence_id;
    END LOOP;
  END IF;

  -- Step 9: Move new sentences from temporary to correct order positions
  FOR v_index IN 0..(array_length(v_new_sentence_ids, 1) - 1)
  LOOP
    UPDATE sentences
    SET sentence_order = v_original_order + v_index
    WHERE sentence_id = v_new_sentence_ids[v_index + 1];
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'newSentenceIds', to_jsonb(v_new_sentence_ids),
    'message', format('Split into %s sentences, migrated %s words', jsonb_array_length(p_new_sentences), v_db_word_count),
    'wordsMigrated', v_db_word_count
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (admin check should be done in app)
GRANT EXECUTE ON FUNCTION split_sentence_v2 TO authenticated;

COMMENT ON FUNCTION split_sentence_v2 IS 'Splits a sentence into multiple sentences, MIGRATING words to preserve lemma associations. Use generate_fragments.py CLI after splitting.';
