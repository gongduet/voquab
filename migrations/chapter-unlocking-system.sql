-- =====================================================
-- PHASE 6: Chapter Unlocking & Progression System
-- =====================================================
-- Implements dual-path chapter unlocking:
-- - PATH A (Quality): High mastery (avg 40)
-- - PATH B (Quantity): Sufficient exposure (50 reviews)
-- - PATH C (Balanced): Combination (30 mastery + 30 reviews)

-- =====================================================
-- 1. CREATE user_chapter_progress TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_chapter_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  words_encountered INTEGER DEFAULT 0,
  total_chapter_words INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  average_mastery DECIMAL(5,2) DEFAULT 0,
  unlock_progress DECIMAL(5,2) DEFAULT 0, -- Percentage toward unlock (0-100)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);

-- =====================================================
-- 2. ENABLE RLS
-- =====================================================
ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CREATE RLS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view own chapter progress" ON user_chapter_progress;
CREATE POLICY "Users can view own chapter progress"
  ON user_chapter_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chapter progress" ON user_chapter_progress;
CREATE POLICY "Users can update own chapter progress"
  ON user_chapter_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chapter progress" ON user_chapter_progress;
CREATE POLICY "Users can insert own chapter progress"
  ON user_chapter_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. INITIALIZE CHAPTER 1 AS UNLOCKED FOR EXISTING USERS
-- =====================================================
-- For each existing user, create chapter progress records
-- Chapter 1 is unlocked by default, others start locked
INSERT INTO user_chapter_progress (user_id, chapter_id, is_unlocked, unlocked_at)
SELECT
  u.id as user_id,
  c.chapter_id,
  CASE WHEN c.chapter_number = 1 THEN TRUE ELSE FALSE END as is_unlocked,
  CASE WHEN c.chapter_number = 1 THEN NOW() ELSE NULL END as unlocked_at
FROM auth.users u
CROSS JOIN chapters c
WHERE NOT EXISTS (
  SELECT 1 FROM user_chapter_progress ucp
  WHERE ucp.user_id = u.id AND ucp.chapter_id = c.chapter_id
);

-- =====================================================
-- 5. UPDATE EXISTING CHAPTER PROGRESS WITH CURRENT DATA
-- =====================================================
-- Calculate words_encountered, total_reviews, and average_mastery
-- for chapters users have already started
UPDATE user_chapter_progress ucp
SET
  words_encountered = (
    SELECT COUNT(DISTINCT uvp.vocab_id)
    FROM user_vocabulary_progress uvp
    JOIN vocabulary v ON v.vocab_id = uvp.vocab_id
    WHERE uvp.user_id = ucp.user_id
      AND v.chapter_id = ucp.chapter_id
  ),
  total_chapter_words = (
    SELECT COUNT(*)
    FROM vocabulary v
    WHERE v.chapter_id = ucp.chapter_id
  ),
  total_reviews = (
    SELECT COALESCE(SUM(uvp.total_reviews), 0)
    FROM user_vocabulary_progress uvp
    JOIN vocabulary v ON v.vocab_id = uvp.vocab_id
    WHERE uvp.user_id = ucp.user_id
      AND v.chapter_id = ucp.chapter_id
  ),
  average_mastery = (
    SELECT COALESCE(AVG(uvp.mastery_level), 0)
    FROM user_vocabulary_progress uvp
    JOIN vocabulary v ON v.vocab_id = uvp.vocab_id
    WHERE uvp.user_id = ucp.user_id
      AND v.chapter_id = ucp.chapter_id
  ),
  updated_at = NOW();

-- =====================================================
-- 6. CALCULATE UNLOCK PROGRESS FOR CHAPTER 2
-- =====================================================
-- Update unlock_progress for chapters that are not yet unlocked
UPDATE user_chapter_progress ucp
SET unlock_progress = CASE
  -- Must encounter 80% of words first
  WHEN (words_encountered::DECIMAL / NULLIF(total_chapter_words, 0) < 0.8) THEN
    (words_encountered::DECIMAL / NULLIF(total_chapter_words, 0)) * 50
  ELSE
    -- Calculate progress via three paths, take maximum
    GREATEST(
      -- Path A: Mastery progress (40 needed)
      LEAST(100, (average_mastery / 40.0) * 100),
      -- Path B: Exposure progress (50 reviews needed)
      LEAST(100, (total_reviews::DECIMAL / 50.0) * 100),
      -- Path C: Balanced (30 mastery + 30 reviews)
      LEAST(100, ((average_mastery / 30.0) * 50) + ((total_reviews::DECIMAL / 30.0) * 50))
    )
  END
WHERE is_unlocked = FALSE;

-- =====================================================
-- 7. AUTO-UNLOCK CHAPTERS THAT MEET REQUIREMENTS
-- =====================================================
-- Unlock chapters where requirements are met
UPDATE user_chapter_progress
SET
  is_unlocked = TRUE,
  unlocked_at = NOW()
WHERE
  is_unlocked = FALSE
  AND (words_encountered::DECIMAL / NULLIF(total_chapter_words, 0) >= 0.8)
  AND (
    average_mastery >= 40 OR
    total_reviews >= 50 OR
    (average_mastery >= 30 AND total_reviews >= 30)
  );

-- =====================================================
-- 8. CREATE INDEX FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_user_id
  ON user_chapter_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_unlocked
  ON user_chapter_progress(user_id, is_unlocked);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Chapter unlocking system initialized successfully!';
  RAISE NOTICE '📊 Chapter 1 is unlocked for all users by default';
  RAISE NOTICE '🔒 Chapters 2-10 will unlock based on progress';
  RAISE NOTICE '⭐ Unlock paths: 40 mastery OR 50 reviews OR 30+30 balanced';
END $$;
