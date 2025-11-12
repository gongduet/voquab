-- Add 'getting_started' package type to user_packages table constraint
-- This enables the beginner-friendly package for users with < 50 words

-- Drop existing constraint
ALTER TABLE user_packages
DROP CONSTRAINT IF EXISTS user_packages_package_type_check;

-- Add updated constraint with 'getting_started' included
ALTER TABLE user_packages
ADD CONSTRAINT user_packages_package_type_check
CHECK (package_type IN ('getting_started', 'foundation', 'standard', 'immersion', 'mastery'));

-- Note: Run this migration after the waypoints table migration
