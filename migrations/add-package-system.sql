-- Migration: Phase 3 - Daily Package System
-- Date: November 9, 2025
-- Description: Adds package system, badge system, and related tables

BEGIN;

-- ============================================================================
-- STEP 1: CREATE user_packages TABLE
-- ============================================================================

-- Drop existing table if re-running migration (development only)
-- DROP TABLE IF EXISTS user_packages CASCADE;

-- Create user_packages table
CREATE TABLE user_packages (
  package_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PACKAGE DETAILS
  package_type VARCHAR(20) NOT NULL CHECK (package_type IN ('foundation', 'standard', 'immersion', 'mastery')),
  total_words INTEGER NOT NULL CHECK (total_words > 0),
  words_completed INTEGER DEFAULT 0 CHECK (words_completed >= 0 AND words_completed <= total_words),

  -- STATUS
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

  -- PERFORMANCE TRACKING
  dont_know_count INTEGER DEFAULT 0 CHECK (dont_know_count >= 0),
  hard_count INTEGER DEFAULT 0 CHECK (hard_count >= 0),
  medium_count INTEGER DEFAULT 0 CHECK (medium_count >= 0),
  easy_count INTEGER DEFAULT 0 CHECK (easy_count >= 0),

  -- TIME TRACKING
  estimated_minutes INTEGER, -- Estimated completion time
  actual_minutes INTEGER, -- Actual time spent (calculated on completion)

  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- CONSTRAINTS
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_user_packages_user_status ON user_packages(user_id, status);
CREATE INDEX idx_user_packages_user_date ON user_packages(user_id, created_at DESC);
CREATE INDEX idx_user_packages_expires ON user_packages(expires_at) WHERE status = 'active';

-- Add RLS policies
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own packages"
  ON user_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own packages"
  ON user_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own packages"
  ON user_packages FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_packages_updated_at
  BEFORE UPDATE ON user_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 2: CREATE package_words JUNCTION TABLE
-- ============================================================================

-- Junction table linking packages to specific words
CREATE TABLE package_words (
  package_id UUID NOT NULL REFERENCES user_packages(package_id) ON DELETE CASCADE,
  vocab_id UUID NOT NULL REFERENCES vocabulary(vocab_id) ON DELETE CASCADE,

  -- ORDER AND CATEGORIZATION
  word_order INTEGER NOT NULL, -- Order within package (1-250)
  category VARCHAR(20) NOT NULL CHECK (category IN ('critical', 'mastery_ready', 'exposure', 'new')),

  -- REVIEW TRACKING
  reviewed BOOLEAN DEFAULT FALSE,
  review_response VARCHAR(20) CHECK (review_response IN ('dont_know', 'hard', 'medium', 'easy')),
  reviewed_at TIMESTAMPTZ,

  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (package_id, vocab_id)
);

-- Indexes
CREATE INDEX idx_package_words_package ON package_words(package_id, word_order);
CREATE INDEX idx_package_words_reviewed ON package_words(package_id, reviewed);

-- RLS policies
ALTER TABLE package_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own package words"
  ON package_words FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own package words"
  ON package_words FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  ));

-- ============================================================================
-- STEP 3: CREATE user_badges TABLE
-- ============================================================================

-- Tracks earned badges
CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id VARCHAR(50) NOT NULL,

  -- BADGE INFO
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon VARCHAR(10) NOT NULL,
  badge_tier VARCHAR(20) NOT NULL CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'diamond')),
  badge_category VARCHAR(30) NOT NULL CHECK (badge_category IN ('completion', 'streak', 'achievement', 'milestone')),

  -- METADATA
  earned_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, badge_id)
);

-- Indexes
CREATE INDEX idx_user_badges_user_date ON user_badges(user_id, earned_at DESC);
CREATE INDEX idx_user_badges_category ON user_badges(user_id, badge_category);

-- RLS policies
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert badges"
  ON user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: UPDATE user_settings TABLE
-- ============================================================================

-- Add package preferences to existing user_settings table
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS default_package VARCHAR(20) DEFAULT 'standard'
    CHECK (default_package IN ('foundation', 'standard', 'immersion', 'mastery')),
  ADD COLUMN IF NOT EXISTS show_package_recommendations BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_create_daily_package BOOLEAN DEFAULT FALSE;

-- Update existing rows
UPDATE user_settings
SET default_package = 'standard'
WHERE default_package IS NULL;

-- ============================================================================
-- STEP 5: UPDATE user_daily_stats TABLE
-- ============================================================================

-- Enhance existing user_daily_stats table for package tracking
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS package_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(20)
    CHECK (package_type IN ('foundation', 'standard', 'immersion', 'mastery')),
  ADD COLUMN IF NOT EXISTS streak_maintained BOOLEAN DEFAULT FALSE;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries (run manually after migration):
-- SELECT COUNT(*) FROM user_packages;
-- SELECT COUNT(*) FROM package_words;
-- SELECT COUNT(*) FROM user_badges;
-- \d user_packages
-- \d package_words
-- \d user_badges
