-- =============================================================================
-- CREATE CHAPTER PROGRESS FUNCTION
-- Date: December 12, 2025
-- Purpose: Calculate chapter-by-chapter word introduction progress for users
-- =============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_chapter_progress(uuid);

-- Create the function
CREATE OR REPLACE FUNCTION get_chapter_progress(p_user_id uuid)
RETURNS TABLE (
  chapter_number integer,
  total_words bigint,
  introduced_words bigint,
  introduced_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH chapter_lemmas AS (
    -- Get all lemmas that appear in each chapter (via words -> sentences -> chapters)
    SELECT DISTINCT
      c.chapter_number,
      w.lemma_id
    FROM chapters c
    JOIN sentences s ON s.chapter_id = c.chapter_id
    JOIN words w ON w.sentence_id = s.sentence_id
    JOIN lemmas l ON l.lemma_id = w.lemma_id
    WHERE l.is_stop_word = false
  ),
  user_introduced AS (
    -- Get lemmas the user has started learning
    SELECT lemma_id
    FROM user_lemma_progress
    WHERE user_id = p_user_id
  )
  SELECT
    cl.chapter_number::integer,
    COUNT(DISTINCT cl.lemma_id) as total_words,
    COUNT(DISTINCT ui.lemma_id) as introduced_words,
    ROUND(
      (COUNT(DISTINCT ui.lemma_id)::numeric / NULLIF(COUNT(DISTINCT cl.lemma_id), 0)) * 100,
      1
    ) as introduced_pct
  FROM chapter_lemmas cl
  LEFT JOIN user_introduced ui ON cl.lemma_id = ui.lemma_id
  GROUP BY cl.chapter_number
  ORDER BY cl.chapter_number;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION get_chapter_progress(uuid) IS 'Returns chapter-by-chapter word introduction progress for a user. Used for chapter unlocking (95% threshold).';

-- =============================================================================
-- TEST THE FUNCTION
-- =============================================================================

-- Test with a sample user ID (replace with actual user ID to test)
-- SELECT * FROM get_chapter_progress('your-user-uuid-here');

-- Example output:
-- chapter_number | total_words | introduced_words | introduced_pct
-- ---------------+-------------+------------------+----------------
--              1 |          52 |               52 |          100.0
--              2 |          40 |               38 |           95.0
--              3 |          35 |               30 |           85.7

SELECT 'get_chapter_progress function created successfully' as status;
