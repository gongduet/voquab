-- Add fragment_id column to user_feedback table
-- Allows users to report issues with fragment translations

-- Add fragment_id column
ALTER TABLE user_feedback
ADD COLUMN fragment_id UUID REFERENCES sentence_fragments(fragment_id) ON DELETE SET NULL;

-- Add index for fragment lookups
CREATE INDEX idx_feedback_fragment ON user_feedback(fragment_id);

-- Comment
COMMENT ON COLUMN user_feedback.fragment_id IS 'Reference to fragment if feedback is about a sentence fragment';
