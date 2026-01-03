-- Create albums table for grouping songs
CREATE TABLE albums (
  album_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  release_year INTEGER,
  cover_image_url TEXT,
  description TEXT,
  total_songs INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE albums IS 'Album metadata for grouping songs';

-- Create index for lookups
CREATE INDEX idx_albums_artist ON albums(artist);
CREATE INDEX idx_albums_published ON albums(is_published);

-- Enable RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

-- RLS policy: anyone can read published albums
CREATE POLICY "Public can view published albums" ON albums
  FOR SELECT USING (is_published = true);

-- RLS policy: admins can do everything (matches existing pattern)
CREATE POLICY "Admins have full access to albums" ON albums
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_settings
      WHERE user_settings.user_id = auth.uid()
      AND user_settings.is_admin = true
    )
  );
