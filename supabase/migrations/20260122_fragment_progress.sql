-- Fragment Flashcard System Progress Tables
-- Tracks user progress on sentence fragments for both Read Mode and Review Mode

-- =============================================================================
-- Table: user_fragment_progress
-- =============================================================================
-- Track individual fragment FSRS progress (similar to user_lemma_progress)

CREATE TABLE user_fragment_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fragment_id UUID NOT NULL REFERENCES sentence_fragments(fragment_id) ON DELETE CASCADE,

  -- FSRS scheduling fields (matching user_lemma_progress pattern)
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  fsrs_state SMALLINT DEFAULT 0 CHECK (fsrs_state IN (0, 1, 2, 3)),
  -- 0 = New, 1 = Learning, 2 = Review, 3 = Relearning

  -- Review scheduling
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, fragment_id)
);

-- Indexes for user_fragment_progress
CREATE INDEX idx_fragment_progress_user ON user_fragment_progress(user_id);
CREATE INDEX idx_fragment_progress_next_review ON user_fragment_progress(user_id, next_review_at);
CREATE INDEX idx_fragment_progress_state ON user_fragment_progress(user_id, fsrs_state);
CREATE INDEX idx_fragment_progress_fragment ON user_fragment_progress(fragment_id);

-- =============================================================================
-- Table: user_chapter_fragment_progress
-- =============================================================================
-- Track read mode completion per chapter (for resume and unlock functionality)

CREATE TABLE user_chapter_fragment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,

  -- Read mode progress
  fragments_seen INTEGER DEFAULT 0,
  total_fragments INTEGER NOT NULL DEFAULT 0,
  last_fragment_order INTEGER DEFAULT 0,
  last_sentence_order INTEGER DEFAULT 0,
  is_read_complete BOOLEAN DEFAULT FALSE,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, chapter_id)
);

-- Indexes for user_chapter_fragment_progress
CREATE INDEX idx_chapter_fragment_progress_user ON user_chapter_fragment_progress(user_id);
CREATE INDEX idx_chapter_fragment_progress_complete ON user_chapter_fragment_progress(user_id, is_read_complete);
CREATE INDEX idx_chapter_fragment_progress_chapter ON user_chapter_fragment_progress(chapter_id);

-- =============================================================================
-- Row Level Security Policies
-- =============================================================================

ALTER TABLE user_fragment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_fragment_progress ENABLE ROW LEVEL SECURITY;

-- user_fragment_progress policies
CREATE POLICY "Users can view own fragment progress"
  ON user_fragment_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fragment progress"
  ON user_fragment_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fragment progress"
  ON user_fragment_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fragment progress"
  ON user_fragment_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- user_chapter_fragment_progress policies
CREATE POLICY "Users can view own chapter fragment progress"
  ON user_chapter_fragment_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chapter fragment progress"
  ON user_chapter_fragment_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chapter fragment progress"
  ON user_chapter_fragment_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chapter fragment progress"
  ON user_chapter_fragment_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Get fragments due for review count (for dashboard button)
CREATE OR REPLACE FUNCTION get_fragments_due_count(p_user_id UUID, p_book_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  due_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO due_count
  FROM user_fragment_progress ufp
  JOIN sentence_fragments sf ON ufp.fragment_id = sf.fragment_id
  JOIN sentences s ON sf.sentence_id = s.sentence_id
  JOIN chapters c ON s.chapter_id = c.chapter_id
  WHERE ufp.user_id = p_user_id
    AND c.book_id = p_book_id
    AND ufp.next_review_at <= NOW()
    AND ufp.fsrs_state != 0;  -- Not new (has been reviewed at least once)

  RETURN COALESCE(due_count, 0);
END;
$$;

-- Get chapter fragment stats (for chapter card progress bars)
CREATE OR REPLACE FUNCTION get_chapter_fragment_stats(p_user_id UUID, p_chapter_id UUID)
RETURNS TABLE (
  total_fragments INTEGER,
  fragments_seen INTEGER,
  fragments_learning INTEGER,
  fragments_review INTEGER,
  is_read_complete BOOLEAN,
  last_fragment_order INTEGER,
  last_sentence_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(sf.fragment_id)::INTEGER as total_fragments,
    COUNT(ufp.fragment_id)::INTEGER as fragments_seen,
    COUNT(ufp.fragment_id) FILTER (WHERE ufp.fsrs_state IN (1, 3))::INTEGER as fragments_learning,
    COUNT(ufp.fragment_id) FILTER (WHERE ufp.fsrs_state = 2)::INTEGER as fragments_review,
    COALESCE(ucfp.is_read_complete, FALSE) as is_read_complete,
    COALESCE(ucfp.last_fragment_order, 0)::INTEGER as last_fragment_order,
    COALESCE(ucfp.last_sentence_order, 0)::INTEGER as last_sentence_order
  FROM sentences s
  JOIN sentence_fragments sf ON s.sentence_id = sf.sentence_id
  LEFT JOIN user_fragment_progress ufp ON sf.fragment_id = ufp.fragment_id AND ufp.user_id = p_user_id
  LEFT JOIN user_chapter_fragment_progress ucfp ON s.chapter_id = ucfp.chapter_id AND ucfp.user_id = p_user_id
  WHERE s.chapter_id = p_chapter_id
  GROUP BY ucfp.is_read_complete, ucfp.last_fragment_order, ucfp.last_sentence_order;
END;
$$;

-- Get all chapter fragment stats for a book (batch query for dashboard efficiency)
CREATE OR REPLACE FUNCTION get_book_fragment_stats(p_user_id UUID, p_book_id UUID)
RETURNS TABLE (
  chapter_id UUID,
  chapter_number INTEGER,
  total_fragments INTEGER,
  fragments_seen INTEGER,
  fragments_learning INTEGER,
  fragments_review INTEGER,
  is_read_complete BOOLEAN,
  last_fragment_order INTEGER,
  last_sentence_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.chapter_id,
    c.chapter_number,
    COUNT(sf.fragment_id)::INTEGER as total_fragments,
    COUNT(ufp.fragment_id)::INTEGER as fragments_seen,
    COUNT(ufp.fragment_id) FILTER (WHERE ufp.fsrs_state IN (1, 3))::INTEGER as fragments_learning,
    COUNT(ufp.fragment_id) FILTER (WHERE ufp.fsrs_state = 2)::INTEGER as fragments_review,
    COALESCE(MAX(ucfp.is_read_complete::int)::boolean, FALSE) as is_read_complete,
    COALESCE(MAX(ucfp.last_fragment_order), 0)::INTEGER as last_fragment_order,
    COALESCE(MAX(ucfp.last_sentence_order), 0)::INTEGER as last_sentence_order
  FROM chapters c
  LEFT JOIN sentences s ON c.chapter_id = s.chapter_id
  LEFT JOIN sentence_fragments sf ON s.sentence_id = sf.sentence_id
  LEFT JOIN user_fragment_progress ufp ON sf.fragment_id = ufp.fragment_id AND ufp.user_id = p_user_id
  LEFT JOIN user_chapter_fragment_progress ucfp ON c.chapter_id = ucfp.chapter_id AND ucfp.user_id = p_user_id
  WHERE c.book_id = p_book_id
  GROUP BY c.chapter_id, c.chapter_number
  ORDER BY c.chapter_number;
END;
$$;
