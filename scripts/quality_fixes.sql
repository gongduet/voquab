-- ============================================================================
-- VOQUAB QUALITY AUDIT FIX SCRIPTS
-- Generated: December 5, 2025
-- ============================================================================
-- This script fixes POS tagging and translation issues identified in the
-- comprehensive quality audit of all 1,944 lemmas and 844 phrases.
-- ============================================================================

-- ============================================================================
-- HIGH PRIORITY FIXES: Wrong POS for frequently used words
-- ============================================================================

-- The main issue: spaCy incorrectly tagged many conjugated verb forms as PROPN
-- These need to be fixed, but the translations are also problematic because
-- they show conjugated meanings instead of infinitive meanings.
--
-- DECISION: For conjugated forms that appear as separate lemmas (due to spaCy
-- errors), we have two options:
-- 1. Fix POS to VERB and keep conjugated translation
-- 2. Delete these entries and re-link words to proper infinitive lemmas
--
-- For now, we fix POS tags. Translation cleanup is a separate task.

-- Fix PROPN -> VERB (high-frequency conjugated forms)
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'creer' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'recordar' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'imaginar' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'rehacer' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'sabes' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'tendrás' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'tuve' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'enseñé' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'dudo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'quiera' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'pareciste' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'hablas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'aprendí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'aproxímate' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'anda' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'ordénele' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'perdóname' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'condenarás' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'puedo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'golpea' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'decía' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'poseo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'busco' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'conoceré' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'gano' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'vea' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'comienzo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'formo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'respondí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'continué' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'descubrí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'oyes' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'comprendí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'levanté' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'bosquejé' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'caí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'vuelve' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'déjame' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'proseguí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'dirigí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'llegué' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'estreché' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'esperé' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'abrirás' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'seguí' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'comprendes' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'examínenlo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'VERB' WHERE lemma_text = 'ríe' AND part_of_speech = 'PROPN';

-- Fix PROPN -> NOUN (common nouns incorrectly tagged)
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'tierra' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'la boa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'geógrafo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'pozo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'baobab' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'bozal' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'el lápiz' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'casa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'derecho' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'la balsa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'virgen' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'estrellas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'ladrillo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'niños' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'flores' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'asteroides' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'rey' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'planeta' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'lápiz' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'reyes' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'moscas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'abejas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'sed' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'vida' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'cazo' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'guardavía' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'historias' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'juegos' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'rosal' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'marina' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'elegía' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'cólera' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'astronomía' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'F' WHERE lemma_text = 'vergüenza' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NOUN', gender = 'M' WHERE lemma_text = 'fin' AND part_of_speech = 'PROPN';

-- Fix PROPN -> ADJ (adjectives incorrectly tagged)
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'buenos' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'buenas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'rosa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'rosas' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'falto' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'preciosa' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'internacional' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'europea' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'borracho' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'nueva' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADJ' WHERE lemma_text = 'alguna' AND part_of_speech = 'PROPN';

-- ============================================================================
-- MEDIUM PRIORITY FIXES: Additional POS corrections
-- ============================================================================

-- Fix PROPN -> INTJ (interjections)
UPDATE lemmas SET part_of_speech = 'INTJ' WHERE lemma_text = 'ejem' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'INTJ' WHERE lemma_text = 'eh' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'INTJ' WHERE lemma_text = 'hum' AND part_of_speech = 'PROPN';

-- Fix PROPN -> DET (determiners)
UPDATE lemmas SET part_of_speech = 'DET' WHERE lemma_text = 'vuestra' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'DET' WHERE lemma_text = 'tus' AND part_of_speech = 'PROPN';

-- Fix PROPN -> ADV (adverbs)
UPDATE lemmas SET part_of_speech = 'ADV' WHERE lemma_text = 'indudablemente' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'ADV' WHERE lemma_text = 'acá' AND part_of_speech = 'PROPN';

-- Fix PROPN -> NUM (numerals)
UPDATE lemmas SET part_of_speech = 'NUM' WHERE lemma_text = 'quince' AND part_of_speech = 'PROPN';
UPDATE lemmas SET part_of_speech = 'NUM' WHERE lemma_text = 'veintidós' AND part_of_speech = 'PROPN';

-- ============================================================================
-- TRANSLATION FIXES
-- ============================================================================

-- Fix "ir" translation: "to go to" -> "to go"
UPDATE lemmas SET definitions = '["to go"]' WHERE lemma_text = 'ir' AND part_of_speech = 'VERB';

-- ============================================================================
-- LOW PRIORITY / OPTIONAL FIXES
-- ============================================================================

-- These are context-dependent and may be correct as-is:
-- - saber (AUX vs VERB) - both are valid depending on context
-- - que, este, otro, mismo (PRON vs DET) - depends on grammatical function

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- HIGH PRIORITY:
--   - ~48 PROPN -> VERB fixes (conjugated verb forms)
--   - ~35 PROPN -> NOUN fixes (common nouns)
--   - ~11 PROPN -> ADJ fixes (adjectives)
--   - 1 translation fix (ir: to go to -> to go)
--
-- MEDIUM PRIORITY:
--   - 3 PROPN -> INTJ fixes
--   - 2 PROPN -> DET fixes
--   - 2 PROPN -> ADV fixes
--   - 2 PROPN -> NUM fixes
--
-- TOTAL: ~104 lemma fixes
-- ============================================================================
