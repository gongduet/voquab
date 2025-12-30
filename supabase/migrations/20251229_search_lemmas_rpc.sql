-- Paginated lemma search with server-side filtering
-- Used by AdminCommonWords for efficient lemma management

CREATE OR REPLACE FUNCTION search_lemmas(
  p_search TEXT DEFAULT '',
  p_pos TEXT DEFAULT 'all',
  p_stop_words TEXT DEFAULT 'all',
  p_reviewed TEXT DEFAULT 'all',
  p_definition TEXT DEFAULT 'all',
  p_chapter_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'frequency',
  p_sort_order TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  lemma_id UUID,
  lemma_text TEXT,
  definitions JSONB,
  part_of_speech TEXT,
  is_stop_word BOOLEAN,
  is_reviewed BOOLEAN,
  gender TEXT,
  word_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
BEGIN
  v_offset := p_page * p_page_size;

  -- Get total count matching filters (for pagination)
  SELECT COUNT(DISTINCT l.lemma_id) INTO v_total
  FROM lemmas l
  LEFT JOIN words w ON w.lemma_id = l.lemma_id
  LEFT JOIN sentences s ON s.sentence_id = w.sentence_id
  WHERE l.language_code = 'es'
    -- Search filter
    AND (p_search = '' OR l.lemma_text ILIKE '%' || p_search || '%')
    -- POS filter
    AND (p_pos = 'all' OR l.part_of_speech = p_pos)
    -- Stop words filter
    AND (p_stop_words = 'all'
      OR (p_stop_words = 'stop' AND l.is_stop_word = TRUE)
      OR (p_stop_words = 'active' AND l.is_stop_word = FALSE))
    -- Reviewed filter
    AND (p_reviewed = 'all'
      OR (p_reviewed = 'reviewed' AND l.is_reviewed = TRUE)
      OR (p_reviewed = 'unreviewed' AND l.is_reviewed = FALSE))
    -- Definition filter
    AND (p_definition = 'all'
      OR (p_definition = 'has' AND l.definitions IS NOT NULL AND l.definitions::text != '[]' AND l.definitions::text != 'null')
      OR (p_definition = 'missing' AND (l.definitions IS NULL OR l.definitions::text = '[]' OR l.definitions::text = 'null')))
    -- Chapter filter
    AND (p_chapter_id IS NULL OR s.chapter_id = p_chapter_id);

  -- Return paginated results with word counts
  RETURN QUERY
  SELECT
    l.lemma_id,
    l.lemma_text,
    l.definitions,
    l.part_of_speech,
    l.is_stop_word,
    l.is_reviewed,
    l.gender,
    COUNT(w.word_id)::BIGINT AS word_count,
    v_total AS total_count
  FROM lemmas l
  LEFT JOIN words w ON w.lemma_id = l.lemma_id
  LEFT JOIN sentences s ON s.sentence_id = w.sentence_id
  WHERE l.language_code = 'es'
    -- Search filter
    AND (p_search = '' OR l.lemma_text ILIKE '%' || p_search || '%')
    -- POS filter
    AND (p_pos = 'all' OR l.part_of_speech = p_pos)
    -- Stop words filter
    AND (p_stop_words = 'all'
      OR (p_stop_words = 'stop' AND l.is_stop_word = TRUE)
      OR (p_stop_words = 'active' AND l.is_stop_word = FALSE))
    -- Reviewed filter
    AND (p_reviewed = 'all'
      OR (p_reviewed = 'reviewed' AND l.is_reviewed = TRUE)
      OR (p_reviewed = 'unreviewed' AND l.is_reviewed = FALSE))
    -- Definition filter
    AND (p_definition = 'all'
      OR (p_definition = 'has' AND l.definitions IS NOT NULL AND l.definitions::text != '[]' AND l.definitions::text != 'null')
      OR (p_definition = 'missing' AND (l.definitions IS NULL OR l.definitions::text = '[]' OR l.definitions::text = 'null')))
    -- Chapter filter
    AND (p_chapter_id IS NULL OR s.chapter_id = p_chapter_id)
  GROUP BY l.lemma_id, l.lemma_text, l.definitions, l.part_of_speech, l.is_stop_word, l.is_reviewed, l.gender
  ORDER BY
    CASE WHEN p_sort_by = 'frequency' AND p_sort_order = 'desc' THEN COUNT(w.word_id) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'frequency' AND p_sort_order = 'asc' THEN COUNT(w.word_id) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'alpha' AND p_sort_order = 'asc' THEN l.lemma_text END ASC,
    CASE WHEN p_sort_by = 'alpha' AND p_sort_order = 'desc' THEN l.lemma_text END DESC,
    l.lemma_text ASC  -- Secondary sort for consistency
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;
