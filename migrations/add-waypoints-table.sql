-- Migration: Add Waypoints Table
-- Phase 3 - Waypoint System
-- Creates table for breaking packages into themed chunks

-- Create user_waypoints table
CREATE TABLE user_waypoints (
  waypoint_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES user_packages(package_id) ON DELETE CASCADE,

  -- Waypoint details
  waypoint_number INTEGER NOT NULL CHECK (waypoint_number > 0),
  theme VARCHAR(30) NOT NULL CHECK (theme IN ('critical', 'mastery_ready', 'exposure', 'new')),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(10) NOT NULL,

  -- Progress tracking
  total_words INTEGER NOT NULL CHECK (total_words > 0),
  words_completed INTEGER DEFAULT 0 CHECK (words_completed >= 0 AND words_completed <= total_words),
  word_ids JSONB NOT NULL, -- Array of vocab_ids in this waypoint

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE (package_id, waypoint_number),
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_waypoints_package ON user_waypoints(package_id, waypoint_number);
CREATE INDEX idx_waypoints_status ON user_waypoints(package_id, status);
CREATE INDEX idx_waypoints_theme ON user_waypoints(theme);

-- Add RLS policies
ALTER TABLE user_waypoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own waypoints"
  ON user_waypoints FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = user_waypoints.package_id
    AND user_packages.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own waypoints"
  ON user_waypoints FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = user_waypoints.package_id
    AND user_packages.user_id = auth.uid()
  ));

CREATE POLICY "System can insert waypoints"
  ON user_waypoints FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = user_waypoints.package_id
    AND user_packages.user_id = auth.uid()
  ));

-- Auto-update timestamp trigger
CREATE TRIGGER update_waypoints_updated_at
  BEFORE UPDATE ON user_waypoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verification query
SELECT 'user_waypoints table created successfully' AS status;
