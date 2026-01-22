-- User feedback table for flashcard error reports
-- Allows users to report issues with flashcard content (translations, definitions, etc.)

CREATE TABLE user_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who submitted
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What they're reporting (one of these will be populated)
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE SET NULL,
  phrase_id UUID REFERENCES phrases(phrase_id) ON DELETE SET NULL,
  sentence_id UUID REFERENCES sentences(sentence_id) ON DELETE SET NULL,

  -- The feedback
  feedback_text TEXT NOT NULL,
  card_side TEXT CHECK (card_side IN ('front', 'back')),

  -- Resolution status
  resolution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending', 'fixed', 'wont_fix')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,

  -- Admin response
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_feedback_lemma ON user_feedback(lemma_id);
CREATE INDEX idx_feedback_phrase ON user_feedback(phrase_id);
CREATE INDEX idx_feedback_status ON user_feedback(resolution_status);
CREATE INDEX idx_feedback_archived ON user_feedback(is_archived);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can submit their own feedback
CREATE POLICY "Users can submit feedback" ON user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can do everything (view all, update, delete)
CREATE POLICY "Admins have full access" ON user_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );

-- Add comment for documentation
COMMENT ON TABLE user_feedback IS 'User-submitted feedback on flashcard content errors';
