-- ============================================
-- PHASE 2: MIGRATE LEMMAS
-- ============================================
-- Purpose: Create lemma entries from vocabulary table
-- Strategy: Use canonical entries + orphaned forms
-- ============================================

-- ============================================
-- STEP 1: Preview what will be migrated
-- ============================================
-- Count entries that will become lemmas
SELECT
    'Will become lemmas' as category,
    COUNT(*) as count
FROM vocabulary
WHERE is_canonical = true
   OR canonical_vocab_id IS NULL;

-- Show sample of what will be migrated
SELECT
    vocab_id,
    lemma,
    english_definition,
    part_of_speech,
    is_canonical,
    canonical_vocab_id
FROM vocabulary
WHERE is_canonical = true
   OR canonical_vocab_id IS NULL
LIMIT 20;

-- ============================================
-- STEP 2: Insert lemmas from vocabulary
-- ============================================
-- This converts canonical vocabulary entries to lemmas
-- Also includes orphaned entries (no canonical link)

INSERT INTO lemmas (
    lemma_id,
    lemma_text,
    language_code,
    part_of_speech,
    gender,
    definitions,
    is_stop_word,
    admin_notes,
    created_at,
    updated_at
)
SELECT
    v.vocab_id as lemma_id,  -- Keep same ID for easy mapping
    -- Normalize lemma text
    CASE
        -- Nouns: ensure article prefix
        WHEN v.part_of_speech = 'NOUN' AND v.lemma NOT LIKE 'el %' AND v.lemma NOT LIKE 'la %' THEN
            CASE
                WHEN v.lemma LIKE 'la%' THEN v.lemma  -- Already has article embedded
                WHEN v.lemma LIKE 'el%' THEN v.lemma
                ELSE 'el ' || v.lemma  -- Default to masculine
            END
        ELSE v.lemma
    END as lemma_text,
    COALESCE(v.language_code, 'es') as language_code,
    v.part_of_speech,
    NULL as gender,  -- We'll update this later if needed
    -- Convert definition to JSONB array
    CASE
        WHEN v.english_definition IS NOT NULL AND v.english_definition != '' AND v.english_definition != v.lemma THEN
            jsonb_build_array(
                CASE
                    -- Add "to" prefix for verbs
                    WHEN v.part_of_speech = 'VERB' AND NOT v.english_definition ILIKE 'to %'
                        THEN 'to ' || v.english_definition
                    ELSE v.english_definition
                END
            )
        ELSE '[]'::jsonb
    END as definitions,
    COALESCE(v.is_stop_word, false) as is_stop_word,
    NULL as admin_notes,
    COALESCE(v.created_at, NOW()) as created_at,
    COALESCE(v.updated_at, NOW()) as updated_at
FROM vocabulary v
WHERE (v.is_canonical = true OR v.canonical_vocab_id IS NULL)
ON CONFLICT (lemma_text, language_code) DO NOTHING;  -- Skip duplicates

-- ============================================
-- STEP 3: Verify lemma migration
-- ============================================
SELECT
    'Lemmas created' as metric,
    COUNT(*) as count
FROM lemmas;

-- Check part of speech distribution
SELECT
    part_of_speech,
    COUNT(*) as count
FROM lemmas
GROUP BY part_of_speech
ORDER BY count DESC;

-- Check definitions quality
SELECT
    'Has definition' as category,
    COUNT(*) as count
FROM lemmas
WHERE definitions != '[]'::jsonb

UNION ALL

SELECT
    'Missing definition',
    COUNT(*)
FROM lemmas
WHERE definitions = '[]'::jsonb;

-- Sample lemmas created
SELECT
    lemma_id,
    lemma_text,
    part_of_speech,
    definitions,
    is_stop_word
FROM lemmas
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- STEP 4: Create temporary mapping table
-- ============================================
-- Maps old vocab_id to new lemma_id
CREATE TEMP TABLE vocab_to_lemma AS
SELECT
    v.vocab_id as old_vocab_id,
    COALESCE(
        -- If has canonical, use that as lemma_id
        v.canonical_vocab_id,
        -- If is canonical, use own id
        CASE WHEN v.is_canonical THEN v.vocab_id END,
        -- Otherwise, use own id (orphaned entry became a lemma)
        v.vocab_id
    ) as lemma_id
FROM vocabulary v;

-- Verify mapping
SELECT
    'Vocabulary entries' as metric,
    COUNT(*) as count
FROM vocab_to_lemma

UNION ALL

SELECT
    'Mapped to lemmas',
    COUNT(DISTINCT lemma_id)
FROM vocab_to_lemma;

-- Check for unmapped entries
SELECT
    'Unmapped entries',
    COUNT(*)
FROM vocab_to_lemma vtl
LEFT JOIN lemmas l ON vtl.lemma_id = l.lemma_id
WHERE l.lemma_id IS NULL;

-- ============================================
-- PHASE 2 COMPLETE!
-- Report these numbers:
-- - Total lemmas created: ____
-- - With definitions: ____
-- - Unmapped entries: ____ (should be 0)
-- Proceed to Phase 3: Migrate Words
-- ============================================
