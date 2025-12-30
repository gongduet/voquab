-- Paginated phrase search with server-side filtering
-- Used by AdminPhrases for efficient phrase management

CREATE OR REPLACE FUNCTION search_phrases(
  p_search TEXT DEFAULT '',
  p_type TEXT DEFAULT 'all',
  p_reviewed TEXT DEFAULT 'all',
  p_chapter_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'alphabetical',
  p_sort_order TEXT DEFAULT 'asc',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  phrase_id UUID,
  phrase_text TEXT,
  definitions JSONB,
  phrase_type TEXT,
  is_reviewed BOOLEAN,
  occurrence_count BIGINT,
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
  SELECT COUNT(DISTINCT p.phrase_id) INTO v_total
  FROM phrases p
  LEFT JOIN phrase_occurrences po ON po.phrase_id = p.phrase_id
  LEFT JOIN sentences s ON s.sentence_id = po.sentence_id
  WHERE
    -- Search filter (phrase text or definitions)
    (p_search = ''
      OR p.phrase_text ILIKE '%' || p_search || '%'
      OR p.definitions::text ILIKE '%' || p_search || '%')
    -- Type filter
    AND (p_type = 'all' OR p.phrase_type = p_type)
    -- Reviewed filter
    AND (p_reviewed = 'all'
      OR (p_reviewed = 'reviewed' AND p.is_reviewed = TRUE)
      OR (p_reviewed = 'unreviewed' AND p.is_reviewed = FALSE))
    -- Chapter filter
    AND (p_chapter_id IS NULL OR s.chapter_id = p_chapter_id);

  -- Return paginated results with occurrence counts
  RETURN QUERY
  SELECT
    p.phrase_id,
    p.phrase_text,
    p.definitions,
    p.phrase_type,
    p.is_reviewed,
    COUNT(po.phrase_id)::BIGINT AS occurrence_count,
    v_total AS total_count
  FROM phrases p
  LEFT JOIN phrase_occurrences po ON po.phrase_id = p.phrase_id
  LEFT JOIN sentences s ON s.sentence_id = po.sentence_id
  WHERE
    -- Search filter (phrase text or definitions)
    (p_search = ''
      OR p.phrase_text ILIKE '%' || p_search || '%'
      OR p.definitions::text ILIKE '%' || p_search || '%')
    -- Type filter
    AND (p_type = 'all' OR p.phrase_type = p_type)
    -- Reviewed filter
    AND (p_reviewed = 'all'
      OR (p_reviewed = 'reviewed' AND p.is_reviewed = TRUE)
      OR (p_reviewed = 'unreviewed' AND p.is_reviewed = FALSE))
    -- Chapter filter
    AND (p_chapter_id IS NULL OR s.chapter_id = p_chapter_id)
  GROUP BY p.phrase_id, p.phrase_text, p.definitions, p.phrase_type, p.is_reviewed
  ORDER BY
    CASE WHEN p_sort_by = 'occurrences' AND p_sort_order = 'desc' THEN COUNT(po.phrase_id) END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'occurrences' AND p_sort_order = 'asc' THEN COUNT(po.phrase_id) END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'alphabetical' AND p_sort_order = 'asc' THEN p.phrase_text END ASC,
    CASE WHEN p_sort_by = 'alphabetical' AND p_sort_order = 'desc' THEN p.phrase_text END DESC,
    p.phrase_text ASC  -- Secondary sort for consistency
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;
