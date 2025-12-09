-- ============================================
-- EXTRA DISCOVERY - Run this to complete picture
-- ============================================

-- SECTION 1: What's in the books table?
SELECT * FROM books;

-- SECTION 2: Count vocabulary_occurrences
SELECT COUNT(*) as occurrence_count FROM vocabulary_occurrences;

-- SECTION 3: Check form_metadata POS vs part_of_speech column
-- This shows the mismatch between column and metadata
SELECT
    part_of_speech as column_pos,
    form_metadata->>'pos' as metadata_pos,
    COUNT(*) as count
FROM vocabulary
WHERE form_metadata IS NOT NULL
  AND form_metadata != '{}'::jsonb
GROUP BY part_of_speech, form_metadata->>'pos'
ORDER BY count DESC;

-- SECTION 4: Sample verbs to understand canonical relationship
SELECT
    lemma,
    part_of_speech,
    form_metadata->>'pos' as actual_pos,
    form_metadata->'morph'->>'VerbForm' as verb_form,
    is_canonical,
    canonical_vocab_id
FROM vocabulary
WHERE form_metadata->>'pos' = 'VERB'
LIMIT 20;

-- SECTION 5: Check how many true infinitives exist
SELECT
    lemma,
    form_metadata->'morph'->>'VerbForm' as verb_form
FROM vocabulary
WHERE form_metadata->>'pos' = 'VERB'
  AND form_metadata->'morph'->>'VerbForm' = 'Inf'
LIMIT 20;

-- SECTION 6: Vocabulary_forms and vocabulary_lemmas tables
-- Check if they have useful data
SELECT COUNT(*) as vocabulary_forms_count FROM vocabulary_forms;
SELECT COUNT(*) as vocabulary_lemmas_count FROM vocabulary_lemmas;

-- SECTION 7: Sample vocabulary_lemmas
SELECT * FROM vocabulary_lemmas LIMIT 10;

-- SECTION 8: Sample vocabulary_forms
SELECT * FROM vocabulary_forms LIMIT 10;
