-- Library & Dashboard Restructure Migration
-- Adds active content tracking and explicit content preference to user_settings
-- Spec: docs/33_LIBRARY_DASHBOARD_SPEC.md

-- Add active content tracking columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS active_book_id UUID REFERENCES books(book_id),
ADD COLUMN IF NOT EXISTS active_song_id UUID REFERENCES songs(song_id);

-- Add explicit content preference (for vulgar slang)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS allow_explicit_content BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.active_book_id IS 'Currently active book for learning';
COMMENT ON COLUMN user_settings.active_song_id IS 'Currently active song for learning';
COMMENT ON COLUMN user_settings.allow_explicit_content IS 'Allow vulgar slang terms (default false)';
