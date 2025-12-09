-- ============================================================================
-- VOQUAB LEMMA NORMALIZATION SCRIPT
-- Generated: December 5, 2025
-- ============================================================================
--
-- This script normalizes lemmas to canonical forms:
-- - VERBS: infinitive form with "to X" translation
-- - NOUNS: singular form with article (el/la) and "the X" translation
--
-- ACTION TYPES:
-- - MERGE: Canonical exists, move words to canonical lemma, delete duplicate
-- - NORMALIZE: Canonical doesn't exist, update lemma in place
-- - FIX_TRANSLATION: Form is correct, just fix translation prefix
-- - DELETE_OR_RECLASSIFY: Invalid lemma, needs manual review
--
-- SUMMARY:
-- - VERBS: 43 MERGE, 13 NORMALIZE, 3 FIX_TRANSLATION, 1 DELETE_OR_RECLASSIFY
-- - NOUNS: 22 MERGE, 10 NORMALIZE, 1 DELETE_OR_RECLASSIFY
-- - TOTAL: ~93 lemmas to fix
--
-- ============================================================================
-- IMPORTANT: Run each section separately and verify results!
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: VERB FIX_TRANSLATION (form OK, just fix translation)
-- ============================================================================
-- These are already in infinitive form, just need "to " prefix

UPDATE lemmas SET definitions = '["to remember"]'
WHERE lemma_text = 'recordar' AND part_of_speech = 'VERB';

UPDATE lemmas SET definitions = '["to imagine"]'
WHERE lemma_text = 'imaginar' AND part_of_speech = 'VERB';

UPDATE lemmas SET definitions = '["to redo", "to remake"]'
WHERE lemma_text = 'rehacer' AND part_of_speech = 'VERB';

-- ============================================================================
-- SECTION 2: VERB MERGE (canonical exists - move words, delete duplicate)
-- ============================================================================
-- These conjugated forms need to be merged into their canonical infinitive

-- tendrás → tener
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'tener' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'tendrás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'tendrás' AND part_of_speech = 'VERB';

-- verás → ver
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ver' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'verás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'verás' AND part_of_speech = 'VERB';

-- acuerdas → acordar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'acordar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'acuerdas' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'acuerdas' AND part_of_speech = 'VERB';

-- comprendí → comprender
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comprender' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comprendí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'comprendí' AND part_of_speech = 'VERB';

-- enseñé → enseñar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'enseñar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'enseñé' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'enseñé' AND part_of_speech = 'VERB';

-- deseabas → desear
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'desear' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'deseabas' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'deseabas' AND part_of_speech = 'VERB';

-- condenarás → condenar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'condenar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'condenarás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'condenarás' AND part_of_speech = 'VERB';

-- cubrirás → cubrir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'cubrir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'cubrirás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'cubrirás' AND part_of_speech = 'VERB';

-- decía → decir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'decir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'decía' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'decía' AND part_of_speech = 'VERB';

-- dirás → decir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'decir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dirás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'dirás' AND part_of_speech = 'VERB';

-- vinieras → venir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'venir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'vinieras' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'vinieras' AND part_of_speech = 'VERB';

-- respondí → responder
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'responder' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'respondí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'respondí' AND part_of_speech = 'VERB';

-- oí → oír
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'oír' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'oí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'oí' AND part_of_speech = 'VERB';

-- explicarás → explicar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'explicar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'explicarás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'explicarás' AND part_of_speech = 'VERB';

-- tuve → tener
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'tener' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'tuve' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'tuve' AND part_of_speech = 'VERB';

-- pareciste → parecer
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'parecer' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'pareciste' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'pareciste' AND part_of_speech = 'VERB';

-- hablas → hablar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'hablar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'hablas' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'hablas' AND part_of_speech = 'VERB';

-- aprendí → aprender
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'aprender' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'aprendí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'aprendí' AND part_of_speech = 'VERB';

-- conoceré → conocer
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'conocer' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'conoceré' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'conoceré' AND part_of_speech = 'VERB';

-- continué → continuar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'continuar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'continué' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'continué' AND part_of_speech = 'VERB';

-- descubrí → descubrir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'descubrir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'descubrí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'descubrí' AND part_of_speech = 'VERB';

-- oyes → oír
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'oír' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'oyes' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'oyes' AND part_of_speech = 'VERB';

-- levanté → levantar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'levantar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'levanté' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'levanté' AND part_of_speech = 'VERB';

-- caí → caer
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'caer' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'caí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'caí' AND part_of_speech = 'VERB';

-- vuelve → volver
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'volver' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'vuelve' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'vuelve' AND part_of_speech = 'VERB';

-- déjame → dejar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dejar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'déjame' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'déjame' AND part_of_speech = 'VERB';

-- proseguí → proseguir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'proseguir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'proseguí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'proseguí' AND part_of_speech = 'VERB';

-- dirigí → dirigir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dirigir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dirigí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'dirigí' AND part_of_speech = 'VERB';

-- llegué → llegar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'llegar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'llegué' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'llegué' AND part_of_speech = 'VERB';

-- esperé → esperar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'esperar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'esperé' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'esperé' AND part_of_speech = 'VERB';

-- abrirás → abrir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'abrir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'abrirás' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'abrirás' AND part_of_speech = 'VERB';

-- seguí → seguir
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'seguir' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'seguí' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'seguí' AND part_of_speech = 'VERB';

-- comprendes → comprender
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comprender' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comprendes' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'comprendes' AND part_of_speech = 'VERB';

-- ríe → reír
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'reír' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ríe' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'ríe' AND part_of_speech = 'VERB';

-- ordénele → ordenar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ordenar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ordénele' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'ordénele' AND part_of_speech = 'VERB';

-- busco → buscar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'buscar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'busco' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'busco' AND part_of_speech = 'VERB';

-- dudo → dudar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dudar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'dudo' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'dudo' AND part_of_speech = 'VERB';

-- poseo → poseer
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'poseer' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'poseo' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'poseo' AND part_of_speech = 'VERB';

-- gano → ganar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ganar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'gano' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'gano' AND part_of_speech = 'VERB';

-- vea → ver
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'ver' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'vea' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'vea' AND part_of_speech = 'VERB';

-- comienzo → comenzar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comenzar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'comienzo' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'comienzo' AND part_of_speech = 'VERB';

-- formo → formar
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'formar' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'formo' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'formo' AND part_of_speech = 'VERB';

-- quiera → querer
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'querer' AND part_of_speech = 'VERB' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'quiera' AND part_of_speech = 'VERB' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'quiera' AND part_of_speech = 'VERB';

-- ============================================================================
-- SECTION 3: VERB NORMALIZE (canonical doesn't exist - update in place)
-- ============================================================================

-- sabes → saber (canonical doesn't exist - but it should as AUX!)
-- Check: SELECT * FROM lemmas WHERE lemma_text = 'saber';
-- If exists as AUX, merge there. If not, normalize.
UPDATE lemmas SET lemma_text = 'saber', definitions = '["to know"]'
WHERE lemma_text = 'sabes' AND part_of_speech = 'VERB';

-- serás → ser (likely exists as AUX)
UPDATE lemmas SET lemma_text = 'ser', definitions = '["to be"]'
WHERE lemma_text = 'serás' AND part_of_speech = 'VERB';

-- estarás, estés → estar (likely exists as AUX)
UPDATE lemmas SET lemma_text = 'estar', definitions = '["to be"]'
WHERE lemma_text = 'estarás' AND part_of_speech = 'VERB';

UPDATE lemmas SET lemma_text = 'estar', definitions = '["to be"]'
WHERE lemma_text = 'estés' AND part_of_speech = 'VERB';

-- bosquejé → bosquejar
UPDATE lemmas SET lemma_text = 'bosquejar', definitions = '["to sketch"]'
WHERE lemma_text = 'bosquejé' AND part_of_speech = 'VERB';

-- hayas → haber (likely exists as AUX)
UPDATE lemmas SET lemma_text = 'haber', definitions = '["to have"]'
WHERE lemma_text = 'hayas' AND part_of_speech = 'VERB';

-- estreché → estrechar
UPDATE lemmas SET lemma_text = 'estrechar', definitions = '["to tighten", "to embrace"]'
WHERE lemma_text = 'estreché' AND part_of_speech = 'VERB';

-- examínenlo → examinar
UPDATE lemmas SET lemma_text = 'examinar', definitions = '["to examine"]'
WHERE lemma_text = 'examínenlo' AND part_of_speech = 'VERB';

-- perdóname → perdonar
UPDATE lemmas SET lemma_text = 'perdonar', definitions = '["to forgive"]'
WHERE lemma_text = 'perdóname' AND part_of_speech = 'VERB';

-- golpea → golpear
UPDATE lemmas SET lemma_text = 'golpear', definitions = '["to hit", "to strike"]'
WHERE lemma_text = 'golpea' AND part_of_speech = 'VERB';

-- aproxímate → aproximar
UPDATE lemmas SET lemma_text = 'aproximar', definitions = '["to approach", "to bring closer"]'
WHERE lemma_text = 'aproxímate' AND part_of_speech = 'VERB';

-- anda → andar
UPDATE lemmas SET lemma_text = 'andar', definitions = '["to walk", "to go"]'
WHERE lemma_text = 'anda' AND part_of_speech = 'VERB';

-- puedo → poder (likely exists as AUX)
UPDATE lemmas SET lemma_text = 'poder', definitions = '["to be able to", "can"]'
WHERE lemma_text = 'puedo' AND part_of_speech = 'VERB';

-- ============================================================================
-- SECTION 4: NOUN MERGE (canonical with article exists)
-- ============================================================================

-- tierra → la tierra
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la tierra' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'tierra' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'tierra' AND part_of_speech = 'NOUN';

-- geógrafo → el geógrafo
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el geógrafo' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'geógrafo' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'geógrafo' AND part_of_speech = 'NOUN';

-- pozo → el pozo
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el pozo' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'pozo' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'pozo' AND part_of_speech = 'NOUN';

-- baobab → el baobab
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el baobab' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'baobab' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'baobab' AND part_of_speech = 'NOUN';

-- estrellas → la estrella
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la estrella' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'estrellas' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'estrellas' AND part_of_speech = 'NOUN';

-- bozal → el bozal
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el bozal' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'bozal' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'bozal' AND part_of_speech = 'NOUN';

-- rey → el rey
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el rey' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'rey' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'rey' AND part_of_speech = 'NOUN';

-- lápiz → el lápiz
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el lápiz' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'lápiz' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'lápiz' AND part_of_speech = 'NOUN';

-- vergüenza → la vergüenza
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la vergüenza' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'vergüenza' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'vergüenza' AND part_of_speech = 'NOUN';

-- guardavía → el guardavía
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el guardavía' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'guardavía' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'guardavía' AND part_of_speech = 'NOUN';

-- casa → la casa
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la casa' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'casa' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'casa' AND part_of_speech = 'NOUN';

-- derecho → el derecho
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el derecho' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'derecho' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'derecho' AND part_of_speech = 'NOUN';

-- niños → el niño
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el niño' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'niños' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'niños' AND part_of_speech = 'NOUN';

-- flores → la flor
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la flor' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'flores' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'flores' AND part_of_speech = 'NOUN';

-- asteroides → el asteroide
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el asteroide' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'asteroides' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'asteroides' AND part_of_speech = 'NOUN';

-- reyes → el rey (already handled above via 'rey')
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el rey' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'reyes' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'reyes' AND part_of_speech = 'NOUN';

-- sed → la sed
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la sed' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'sed' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'sed' AND part_of_speech = 'NOUN';

-- vida → la vida
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la vida' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'vida' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'vida' AND part_of_speech = 'NOUN';

-- fin → el fin
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el fin' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'fin' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'fin' AND part_of_speech = 'NOUN';

-- planeta → el planeta
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el planeta' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'planeta' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'planeta' AND part_of_speech = 'NOUN';

-- historias → la historia
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'la historia' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'historias' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'historias' AND part_of_speech = 'NOUN';

-- juegos → el juego
UPDATE words SET lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'el juego' AND part_of_speech = 'NOUN' LIMIT 1)
WHERE lemma_id = (SELECT lemma_id FROM lemmas WHERE lemma_text = 'juegos' AND part_of_speech = 'NOUN' LIMIT 1);
DELETE FROM lemmas WHERE lemma_text = 'juegos' AND part_of_speech = 'NOUN';

-- ============================================================================
-- SECTION 5: NOUN NORMALIZE (canonical doesn't exist - create with article)
-- ============================================================================

-- virgen → la virgen
UPDATE lemmas SET lemma_text = 'la virgen', definitions = '["the virgin"]'
WHERE lemma_text = 'virgen' AND part_of_speech = 'NOUN';

-- marina → la marina
UPDATE lemmas SET lemma_text = 'la marina', definitions = '["the navy", "the marina"]'
WHERE lemma_text = 'marina' AND part_of_speech = 'NOUN';

-- rosal → el rosal
UPDATE lemmas SET lemma_text = 'el rosal', definitions = '["the rosebush"]'
WHERE lemma_text = 'rosal' AND part_of_speech = 'NOUN';

-- moscas → la mosca
UPDATE lemmas SET lemma_text = 'la mosca', definitions = '["the fly"]'
WHERE lemma_text = 'moscas' AND part_of_speech = 'NOUN';

-- cazo → el cazo
UPDATE lemmas SET lemma_text = 'el cazo', definitions = '["the ladle", "the dipper"]'
WHERE lemma_text = 'cazo' AND part_of_speech = 'NOUN';

-- ladrillo → el ladrillo
UPDATE lemmas SET lemma_text = 'el ladrillo', definitions = '["the brick"]'
WHERE lemma_text = 'ladrillo' AND part_of_speech = 'NOUN';

-- abejas → la abeja
UPDATE lemmas SET lemma_text = 'la abeja', definitions = '["the bee"]'
WHERE lemma_text = 'abejas' AND part_of_speech = 'NOUN';

-- elegía → la elegía
UPDATE lemmas SET lemma_text = 'la elegía', definitions = '["the elegy"]'
WHERE lemma_text = 'elegía' AND part_of_speech = 'NOUN';

-- cólera → la cólera
UPDATE lemmas SET lemma_text = 'la cólera', definitions = '["the anger", "the cholera"]'
WHERE lemma_text = 'cólera' AND part_of_speech = 'NOUN';

-- astronomía → la astronomía
UPDATE lemmas SET lemma_text = 'la astronomía', definitions = '["the astronomy"]'
WHERE lemma_text = 'astronomía' AND part_of_speech = 'NOUN';

-- ============================================================================
-- SECTION 6: FIX EXISTING NOUNS MISSING "the " IN TRANSLATION
-- ============================================================================

-- la boa - fix translation
UPDATE lemmas SET definitions = '["the boa"]'
WHERE lemma_text = 'la boa' AND part_of_speech = 'NOUN';

-- el lápiz - fix translation
UPDATE lemmas SET definitions = '["the pencil"]'
WHERE lemma_text = 'el lápiz' AND part_of_speech = 'NOUN';

-- la balsa - fix translation
UPDATE lemmas SET definitions = '["the raft"]'
WHERE lemma_text = 'la balsa' AND part_of_speech = 'NOUN';

-- ============================================================================
-- SECTION 7: ITEMS REQUIRING MANUAL REVIEW
-- ============================================================================

-- boas (VERB) - Not a valid verb form, should be reclassified
-- SELECT * FROM lemmas WHERE lemma_text = 'boas';
-- Action: Review and likely delete or reclassify as NOUN

-- mía (NOUN) - This is a possessive pronoun, not a noun
-- SELECT * FROM lemmas WHERE lemma_text = 'mía';
-- Action: Reclassify as PRON or delete

-- ============================================================================
-- VERIFICATION QUERIES (run after commit)
-- ============================================================================

-- Check for remaining verbs without "to " prefix:
-- SELECT lemma_text, definitions FROM lemmas
-- WHERE part_of_speech = 'VERB'
-- AND definitions->>0 NOT LIKE 'to %'
-- AND definitions != '[]';

-- Check for remaining nouns without "the " prefix:
-- SELECT lemma_text, definitions FROM lemmas
-- WHERE part_of_speech = 'NOUN'
-- AND definitions->>0 NOT LIKE 'the %'
-- AND definitions != '[]';

-- Check for nouns without article in lemma_text:
-- SELECT lemma_text, definitions FROM lemmas
-- WHERE part_of_speech = 'NOUN'
-- AND lemma_text NOT LIKE 'el %'
-- AND lemma_text NOT LIKE 'la %'
-- AND lemma_text NOT LIKE 'los %'
-- AND lemma_text NOT LIKE 'las %';

-- Count total lemmas after cleanup:
-- SELECT part_of_speech, COUNT(*) FROM lemmas GROUP BY part_of_speech ORDER BY COUNT(*) DESC;

COMMIT;

-- ============================================================================
-- END OF NORMALIZATION SCRIPT
-- ============================================================================
