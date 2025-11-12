-- Add waypoint_id column to package_words table
-- This creates a proper foreign key relationship for waypoint-word associations
-- Allows efficient querying: WHERE waypoint_id = X AND reviewed = false

-- Add the waypoint_id column
ALTER TABLE package_words
ADD COLUMN waypoint_id UUID REFERENCES user_waypoints(waypoint_id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_package_words_waypoint ON package_words(waypoint_id);

-- Note: Existing packages will have NULL waypoint_id
-- They should be deleted and recreated after applying this migration
