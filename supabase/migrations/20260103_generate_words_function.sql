-- Function to generate words for a sentence
-- Attempts to find existing lemmas, creates placeholders if not found
-- Uses SECURITY DEFINER to bypass RLS for admin operations

CREATE OR REPLACE FUNCTION generate_words_for_sentence(
  p_sentence_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sentence RECORD;
  v_book_id UUID;
  v_tokens TEXT[];
  v_token TEXT;
  v_position INT := 1;
  v_lemma_id UUID;
  v_words_created INT := 0;
  v_lemma_text TEXT;
BEGIN
  -- Get sentence details
  SELECT s.*, c.book_id INTO v_sentence
  FROM sentences s
  JOIN chapters c ON s.chapter_id = c.chapter_id
  WHERE s.sentence_id = p_sentence_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sentence not found');
  END IF;

  v_book_id := v_sentence.book_id;

  -- Delete existing words for this sentence (in case of regeneration)
  DELETE FROM words WHERE sentence_id = p_sentence_id;

  -- Tokenize: split on whitespace
  v_tokens := regexp_split_to_array(v_sentence.sentence_text, '\s+');

  -- Process each token
  FOREACH v_token IN ARRAY v_tokens
  LOOP
    -- Clean the token: remove leading/trailing punctuation for lemma lookup
    v_lemma_text := lower(regexp_replace(v_token, '^[^\w]+|[^\w]+$', '', 'g'));

    -- Skip empty tokens
    IF v_lemma_text = '' OR v_lemma_text IS NULL THEN
      CONTINUE;
    END IF;

    -- Try to find existing lemma
    SELECT lemma_id INTO v_lemma_id
    FROM lemmas
    WHERE lower(lemma_text) = v_lemma_text
    LIMIT 1;

    -- If no lemma found, create a placeholder
    IF v_lemma_id IS NULL THEN
      INSERT INTO lemmas (lemma_text, language_code, part_of_speech, definitions, admin_notes)
      VALUES (
        v_lemma_text,
        'es',
        'unknown',
        '[]'::jsonb,
        'Auto-generated from sentence split'
      )
      ON CONFLICT (lemma_text, language_code) DO UPDATE SET lemma_text = EXCLUDED.lemma_text
      RETURNING lemma_id INTO v_lemma_id;
    END IF;

    -- Create word entry
    INSERT INTO words (
      word_text,
      lemma_id,
      book_id,
      chapter_id,
      sentence_id,
      word_position
    ) VALUES (
      v_token,
      v_lemma_id,
      v_book_id,
      v_sentence.chapter_id,
      p_sentence_id,
      v_position
    );

    v_words_created := v_words_created + 1;
    v_position := v_position + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'wordsCreated', v_words_created,
    'message', format('Created %s words for sentence', v_words_created)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_words_for_sentence TO authenticated;

COMMENT ON FUNCTION generate_words_for_sentence IS 'Generates word entries for a sentence by tokenizing and linking to lemmas.';
