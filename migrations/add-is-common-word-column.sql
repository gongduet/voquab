-- Migration: Add is_common_word column to vocabulary table
-- Date: 2025-11-01
-- Description: Add a boolean flag to mark common/stop words that shouldn't appear in flashcards

-- Add the column if it doesn't exist
ALTER TABLE vocabulary
ADD COLUMN IF NOT EXISTS is_common_word BOOLEAN DEFAULT false;

-- Add a comment to the column for documentation
COMMENT ON COLUMN vocabulary.is_common_word IS 'Marks common words (articles, prepositions, pronouns, etc.) that should be excluded from flashcard reviews';

-- Create an index to speed up queries filtering by this column
CREATE INDEX IF NOT EXISTS idx_vocabulary_is_common_word
ON vocabulary(is_common_word)
WHERE is_common_word = false;

-- Optional: Update existing common words (run after the column is added)
-- You can uncomment these lines after running the above ALTER TABLE:

/*
UPDATE vocabulary
SET is_common_word = true
WHERE lemma IN (
  -- Articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  -- Prepositions
  'de', 'a', 'en', 'con', 'por', 'para', 'sobre', 'entre', 'sin', 'bajo', 'desde', 'hasta',
  -- Pronouns
  'yo', 'tú', 'él', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas',
  'me', 'te', 'se', 'le', 'lo', 'nos', 'os', 'les', 'que', 'quien', 'cual',
  'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'este', 'esta', 'estos', 'estas',
  'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
  -- Conjunctions
  'y', 'o', 'pero', 'ni', 'sino', 'pues', 'porque',
  -- Common verbs (to be)
  'es', 'son', 'ser', 'está', 'están', 'estar',
  -- Common adverbs
  'muy', 'más', 'menos', 'también', 'tampoco', 'sí', 'no', 'ya', 'como',
  -- Other common words
  'del', 'al', 'ésta', 'éstas', 'éste', 'éstos', 'ésa', 'ésas'
);
*/
