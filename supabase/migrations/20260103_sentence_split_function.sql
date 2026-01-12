-- Function to split a sentence into multiple sentences
-- Uses SECURITY DEFINER to bypass RLS for admin operations

CREATE OR REPLACE FUNCTION split_sentence(
  p_original_sentence_id UUID,
  p_new_sentences JSONB  -- Array of {text, translation, is_paragraph_start}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_chapter_id UUID;
  v_original_order INT;
  v_order_shift INT;
  v_new_sentence JSONB;
  v_new_sentence_id UUID;
  v_new_sentence_ids UUID[] := '{}';
  v_index INT := 0;
  v_sentence_to_shift RECORD;
BEGIN
  -- Step 1: Get original sentence details
  SELECT * INTO v_original
  FROM sentences
  WHERE sentence_id = p_original_sentence_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Original sentence not found');
  END IF;

  v_chapter_id := v_original.chapter_id;
  v_original_order := v_original.sentence_order;
  v_order_shift := jsonb_array_length(p_new_sentences) - 1;

  -- Step 2: Delete related data for original sentence FIRST
  DELETE FROM sentence_fragments WHERE sentence_id = p_original_sentence_id;
  DELETE FROM words WHERE sentence_id = p_original_sentence_id;
  DELETE FROM phrase_occurrences WHERE sentence_id = p_original_sentence_id;
  DELETE FROM user_sentence_progress WHERE sentence_id = p_original_sentence_id;

  -- Step 3: Delete original sentence to free up its order slot
  DELETE FROM sentences WHERE sentence_id = p_original_sentence_id;

  -- Step 4: Shift subsequent sentences if needed (in REVERSE order to avoid conflicts)
  IF v_order_shift > 0 THEN
    FOR v_sentence_to_shift IN
      SELECT sentence_id, sentence_order
      FROM sentences
      WHERE chapter_id = v_chapter_id
        AND sentence_order >= v_original_order
      ORDER BY sentence_order DESC
    LOOP
      UPDATE sentences
      SET sentence_order = v_sentence_to_shift.sentence_order + v_order_shift
      WHERE sentence_id = v_sentence_to_shift.sentence_id;
    END LOOP;
  END IF;

  -- Step 5: Create new sentences
  FOR v_new_sentence IN SELECT * FROM jsonb_array_elements(p_new_sentences)
  LOOP
    INSERT INTO sentences (
      chapter_id,
      sentence_order,
      sentence_text,
      sentence_translation,
      is_paragraph_start,
      is_reviewed
    ) VALUES (
      v_chapter_id,
      v_original_order + v_index,
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
    v_index := v_index + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'newSentenceIds', to_jsonb(v_new_sentence_ids),
    'message', format('Split into %s sentences', jsonb_array_length(p_new_sentences))
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (admin check should be done in app)
GRANT EXECUTE ON FUNCTION split_sentence TO authenticated;

COMMENT ON FUNCTION split_sentence IS 'Splits a sentence into multiple sentences. Admin operation that bypasses RLS.';
