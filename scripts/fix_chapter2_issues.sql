-- =============================================================================
-- CHAPTER 2 CORRECTIONS
-- Generated: December 4, 2025
-- Purpose: Fix one-off issues found during Chapter 2 validation
-- =============================================================================

-- SECTION 1: FIX VERB LEMMATIZATION ERRORS
-- These are verbs where spaCy produced incorrect lemmas

-- Fix -ir → -er verb lemmas
UPDATE lemmas SET lemma_text = 'conocer' WHERE lemma_text = 'conocir';
UPDATE lemmas SET lemma_text = 'parecer' WHERE lemma_text IN ('parecierar', 'pareciera');
UPDATE lemmas SET lemma_text = 'oír' WHERE lemma_text = 'oir';

-- Fix conjugated forms stored as lemmas
UPDATE lemmas SET lemma_text = 'rehacer' WHERE lemma_text IN ('rehíce', 'rehícer');
UPDATE lemmas SET lemma_text = 'pintar' WHERE lemma_text IN ('píntamir', 'píntame');
UPDATE lemmas SET lemma_text = 'imaginar' WHERE lemma_text = 'imagínense';
UPDATE lemmas SET lemma_text = 'hacer' WHERE lemma_text = 'haz' AND part_of_speech = 'VERB';
UPDATE lemmas SET lemma_text = 'lograr' WHERE lemma_text = 'logré';
UPDATE lemmas SET lemma_text = 'mirar' WHERE lemma_text = 'miré';
UPDATE lemmas SET lemma_text = 'sacar' WHERE lemma_text = 'saqué';
UPDATE lemmas SET lemma_text = 'vivir' WHERE lemma_text = 'viví' AND part_of_speech IN ('VERB', 'PROPN');
UPDATE lemmas SET lemma_text = 'dibujar' WHERE lemma_text = 'dibujé';
UPDATE lemmas SET lemma_text = 'recordar' WHERE lemma_text = 'recordé';
UPDATE lemmas SET lemma_text = 'quedar' WHERE lemma_text IN ('quedé', 'el quedé');
UPDATE lemmas SET lemma_text = 'creer' WHERE lemma_text = 'crees';
UPDATE lemmas SET lemma_text = 'querer' WHERE lemma_text = 'quieres';
UPDATE lemmas SET lemma_text = 'ver' WHERE lemma_text IN ('ves', 'el ves');

-- SECTION 2: FIX GENDER ERRORS
-- Feminine nouns incorrectly stored with masculine article

UPDATE lemmas SET lemma_text = 'la cosa', gender = 'F' WHERE lemma_text = 'el cosa';
UPDATE lemmas SET lemma_text = 'la sorpresa', gender = 'F' WHERE lemma_text = 'el sorpresa';
UPDATE lemmas SET lemma_text = 'la sed', gender = 'F' WHERE lemma_text = 'el sed';
UPDATE lemmas SET lemma_text = 'el agua', gender = 'F' WHERE lemma_text = 'la agua';  -- phonetic rule
UPDATE lemmas SET lemma_text = 'el hambre', gender = 'F' WHERE lemma_text = 'la hambre';  -- phonetic rule

-- SECTION 3: FIX TRANSLATION ERRORS
-- Incorrect or incomplete translations

-- Verb translations (add "to " prefix)
UPDATE lemmas SET definitions = '["to be"]' WHERE lemma_text = 'estar' AND definitions->>0 = 'be';
UPDATE lemmas SET definitions = '["to have"]' WHERE lemma_text = 'haber' AND definitions->>0 = 'see';
UPDATE lemmas SET definitions = '["to know"]' WHERE lemma_text = 'saber' AND definitions->>0 = 'know';
UPDATE lemmas SET definitions = '["to live"]' WHERE lemma_text = 'vivir' AND definitions->>0 = 'to living';
UPDATE lemmas SET definitions = '["to return"]' WHERE lemma_text = 'volver' AND definitions->>0 = 'to back to';
UPDATE lemmas SET definitions = '["to carry out"]' WHERE lemma_text = 'realizar' AND definitions->>0 = 'to go to';
UPDATE lemmas SET definitions = '["to carry"]' WHERE lemma_text = 'llevar' AND definitions->>0 = 'to go to';
UPDATE lemmas SET definitions = '["to dawn"]' WHERE lemma_text = 'amanecer' AND definitions->>0 = 'to sunrise';

-- Noun translations
UPDATE lemmas SET definitions = '["the favor"]' WHERE lemma_text = 'el favor' AND definitions->>0 = 'the please';
UPDATE lemmas SET definitions = '["the surroundings"]' WHERE lemma_text = 'el alrededor' AND definitions->>0 = 'the around';
UPDATE lemmas SET definitions = '["the young man"]' WHERE lemma_text = 'el joven' AND definitions->>0 = 'the young';
UPDATE lemmas SET definitions = '["the sick person"]' WHERE lemma_text = 'el enfermo' AND definitions->>0 = 'the sick';
UPDATE lemmas SET definitions = '["the middle"]' WHERE lemma_text = 'el medio' AND definitions->>0 = 'the half';

-- Conjunction/preposition translations
UPDATE lemmas SET definitions = '["neither, nor"]' WHERE lemma_text = 'ni' AND definitions->>0 = 'ni';
UPDATE lemmas SET definitions = '["or"]' WHERE lemma_text = 'o' AND definitions->>0 = 'o';
UPDATE lemmas SET definitions = '["since, as"]' WHERE lemma_text = 'como' AND part_of_speech = 'SCONJ';
UPDATE lemmas SET definitions = '["well, so, then"]' WHERE lemma_text = 'pues' AND definitions->>0 = 'for';
UPDATE lemmas SET definitions = '["until, up to"]' WHERE lemma_text = 'hasta' AND definitions->>0 = 'to';

-- Adverb translations
UPDATE lemmas SET definitions = '["attentively"]' WHERE lemma_text = 'atentamente' AND definitions->>0 = 'kind regards';
UPDATE lemmas SET definitions = '["so much"]' WHERE lemma_text = 'tanto' AND definitions->>0 = 'both';
UPDATE lemmas SET definitions = '["late, later"]' WHERE lemma_text = 'tarde' AND definitions->>0 = 'afternoon';

-- Adjective translations
UPDATE lemmas SET definitions = '["older"]' WHERE lemma_text = 'mayor' AND definitions->>0 = 'more';
UPDATE lemmas SET definitions = '["unique"]' WHERE lemma_text = 'único' AND definitions->>0 = 'only';
UPDATE lemmas SET definitions = '["strange"]' WHERE lemma_text = 'extraño' AND part_of_speech = 'ADJ' AND definitions->>0 = 'stranger';

-- Pronoun/proper noun capitalizations
UPDATE lemmas SET definitions = '["I"]' WHERE lemma_text = 'yo' AND definitions->>0 = 'i';
UPDATE lemmas SET lemma_text = 'Sáhara', definitions = '["Sahara"]' WHERE lemma_text = 'sáhara';

-- SECTION 4: FIX PART OF SPEECH
-- Words with wrong POS classification

UPDATE lemmas SET part_of_speech = 'ADV' WHERE lemma_text = 'adentro' AND part_of_speech = 'ADJ';
UPDATE lemmas SET part_of_speech = 'NOUN' WHERE lemma_text = 'la fuente' AND part_of_speech = 'ADJ';
UPDATE lemmas SET part_of_speech = 'NOUN' WHERE lemma_text = 'la balsa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN' WHERE lemma_text = 'el elefante' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'INTJ' WHERE lemma_text = 'eh' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'falto' AND part_of_speech = 'PROPN';

-- SECTION 5: DELETE INVALID LEMMAS
-- Pronouns/determiners incorrectly stored as nouns

-- Delete words first (foreign key constraint)
DELETE FROM words WHERE lemma_id IN (
    SELECT lemma_id FROM lemmas WHERE lemma_text IN ('el conmigo', 'el mía', 'el quedé', 'el ves', 'el boas')
);

-- Then delete the lemmas
DELETE FROM lemmas WHERE lemma_text IN ('el conmigo', 'el mía', 'el quedé', 'el ves', 'el boas');

-- SECTION 6: FIX NOUN LEMMAS MISSING ARTICLES

-- Add articles to nouns that need them
UPDATE lemmas SET lemma_text = 'la boa', gender = 'F' WHERE lemma_text = 'boa' AND part_of_speech IN ('NOUN', 'INTJ');
UPDATE lemmas SET lemma_text = 'la boa', gender = 'F' WHERE lemma_text = 'boas' AND part_of_speech IN ('ADJ', 'NOUN');
UPDATE lemmas SET lemma_text = 'el elefante', gender = 'M' WHERE lemma_text = 'elefante' AND part_of_speech IN ('NOUN', 'PROPN');
UPDATE lemmas SET lemma_text = 'la balsa', gender = 'F' WHERE lemma_text = 'balsa' AND part_of_speech IN ('NOUN', 'PROPN');
UPDATE lemmas SET lemma_text = 'la fuente', gender = 'F' WHERE lemma_text = 'fuente' AND part_of_speech IN ('ADJ', 'NOUN');
UPDATE lemmas SET lemma_text = 'el gramático', gender = 'M' WHERE lemma_text = 'gramático' AND part_of_speech = 'ADJ';
UPDATE lemmas SET lemma_text = 'el mecánico', gender = 'M' WHERE lemma_text = 'mecánico' AND part_of_speech = 'ADJ';

-- SECTION 7: MARK AS REVIEWED
-- After fixes, mark validation reports as reviewed

UPDATE validation_reports SET reviewed_by_human = true
WHERE lemma_id IN (
    SELECT lemma_id FROM lemmas WHERE lemma_text IN (
        'conocer', 'parecer', 'oír', 'rehacer', 'pintar', 'imaginar', 'hacer',
        'lograr', 'mirar', 'sacar', 'vivir', 'dibujar', 'recordar', 'quedar',
        'creer', 'querer', 'ver', 'la cosa', 'la sorpresa', 'la sed',
        'el agua', 'el hambre', 'estar', 'haber', 'saber', 'volver',
        'realizar', 'llevar', 'amanecer', 'el favor', 'el alrededor',
        'el joven', 'el enfermo', 'el medio', 'ni', 'o', 'como', 'pues',
        'hasta', 'atentamente', 'tanto', 'tarde', 'mayor', 'único',
        'extraño', 'yo', 'Sáhara', 'adentro', 'la fuente', 'la balsa',
        'el elefante', 'eh', 'falto', 'la boa', 'el gramático', 'el mecánico'
    )
);

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after applying fixes to confirm success
-- =============================================================================

-- Check for remaining conjugated verb forms in lemmas
SELECT lemma_text, part_of_speech FROM lemmas
WHERE lemma_text ~ '^[a-záéíóúñ]+é$' OR lemma_text ~ '^[a-záéíóúñ]+í$'
AND part_of_speech = 'VERB';

-- Check for remaining gender errors
SELECT lemma_text, gender FROM lemmas
WHERE (lemma_text LIKE 'el cosa%' OR lemma_text LIKE 'el sorpresa%' OR lemma_text LIKE 'el sed%');

-- Count remaining validation issues for Chapter 2
SELECT COUNT(*) as remaining_issues
FROM validation_reports vr
JOIN lemmas l ON vr.lemma_id = l.lemma_id
WHERE vr.is_valid = false AND vr.reviewed_by_human = false
AND l.lemma_id IN (
    SELECT DISTINCT lemma_id FROM words
    WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = 2)
);
