-- Lyrics Database Migration
-- Created: 2025-12-25
-- Purpose: Add tables for lyrics-based vocabulary learning (POC)
-- Reference: docs/32_LYRICS_DATABASE_SPEC.md

-- ============================================
-- TABLE 1: songs
-- Primary content container for a song
-- ============================================
CREATE TABLE songs (
  song_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic metadata
  title TEXT NOT NULL,                    -- "Debí Tirar Más Fotos"
  artist TEXT NOT NULL,                   -- "Bad Bunny" (simple text for POC)
  album TEXT,                             -- "DtMF"
  release_year INTEGER,                   -- 2025

  -- Learning metadata
  difficulty TEXT NOT NULL DEFAULT 'intermediate',  -- 'beginner', 'intermediate', 'advanced'
  dialect TEXT,                           -- "Puerto Rican Spanish"
  themes TEXT[],                          -- ARRAY['nostalgia', 'memory', 'home']

  -- Stats (computed, updated on content changes)
  total_sections INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  unique_lemmas INTEGER DEFAULT 0,        -- Standard vocabulary count
  unique_slang_terms INTEGER DEFAULT 0,   -- Slang vocabulary count

  -- Status
  is_published BOOLEAN DEFAULT FALSE,     -- Show to users?

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE songs IS 'Song metadata for lyrics-based vocabulary learning';
COMMENT ON COLUMN songs.difficulty IS 'beginner (A1-A2), intermediate (B1-B2), advanced (C1-C2)';
COMMENT ON COLUMN songs.dialect IS 'Regional Spanish variant, e.g., Puerto Rican, Mexican, Castilian';

-- ============================================
-- TABLE 2: song_sections
-- Structural divisions within a song (verse, chorus, bridge, etc.)
-- ============================================
CREATE TABLE song_sections (
  section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,

  -- Section identification
  section_type TEXT NOT NULL,             -- 'intro', 'verse', 'pre_chorus', 'chorus', 'bridge', 'interlude', 'outro'
  section_order INTEGER NOT NULL,         -- Display order (1, 2, 3...)
  section_label TEXT,                     -- Optional label: "Verse 1", "Chorus", "Abuelo Section"

  -- Learning metadata
  is_skippable BOOLEAN DEFAULT FALSE,     -- Skip vocalizations, spoken interludes
  repeat_of_section_id UUID REFERENCES song_sections(section_id),  -- Points to original if this is a repeat

  -- Stats
  total_lines INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(song_id, section_order)
);

COMMENT ON TABLE song_sections IS 'Structural divisions of songs (verse, chorus, bridge, etc.)';
COMMENT ON COLUMN song_sections.repeat_of_section_id IS 'If this section repeats another (e.g., Chorus 2 repeats Chorus 1), point to original';
COMMENT ON COLUMN song_sections.is_skippable IS 'True for non-learnable content like vocalizations or purely instrumental sections';

-- ============================================
-- TABLE 3: song_lines
-- Individual lines of lyrics with translations
-- ============================================
CREATE TABLE song_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES song_sections(section_id) ON DELETE CASCADE,

  -- Content
  line_order INTEGER NOT NULL,            -- Order within section (1, 2, 3...)
  line_text TEXT NOT NULL,                -- "Debí tirar más fotos de cuando te tuve"
  translation TEXT NOT NULL,              -- "I should have taken more photos when I had you"

  -- Learning metadata
  grammar_note TEXT,                      -- Optional explanation
  cultural_note TEXT,                     -- Cultural context if needed
  is_skippable BOOLEAN DEFAULT FALSE,     -- Skip "eh eh" or similar

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(section_id, line_order)
);

COMMENT ON TABLE song_lines IS 'Individual lyric lines with translations';
COMMENT ON COLUMN song_lines.is_skippable IS 'True for vocalizations, ad-libs, or non-translatable content';

-- ============================================
-- TABLE 4: slang_terms
-- Non-standard vocabulary with cultural context (parallel to lemmas table)
-- ============================================
CREATE TABLE slang_terms (
  slang_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core content
  term TEXT NOT NULL,                     -- "tirar fotos"
  definition TEXT NOT NULL,               -- "to take photos"

  -- Linguistic context
  standard_equivalent TEXT,               -- "tomar fotos" / "sacar fotos"
  region TEXT,                            -- "Puerto Rico", "Caribbean", "Mexico"
  part_of_speech TEXT,                    -- 'phrase', 'noun', 'verb', 'exclamation', 'adjective'

  -- Cultural context
  cultural_note TEXT,                     -- Extended explanation
  usage_note TEXT,                        -- When/how to use
  formality TEXT DEFAULT 'informal',      -- 'informal', 'vulgar', 'neutral'

  -- Example
  example_spanish TEXT,                   -- "Déjame tirarte una foto"
  example_english TEXT,                   -- "Let me take a photo of you"

  -- Status
  is_approved BOOLEAN DEFAULT FALSE,      -- QA reviewed?

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(term, region)                    -- Same term can exist in different regions
);

COMMENT ON TABLE slang_terms IS 'Non-standard vocabulary (slang, dialect, anglicisms) with cultural context';
COMMENT ON COLUMN slang_terms.standard_equivalent IS 'How you would say this in standard/formal Spanish';
COMMENT ON COLUMN slang_terms.formality IS 'informal = casual speech, vulgar = potentially offensive, neutral = widely accepted';

-- ============================================
-- TABLE 5: song_slang
-- Junction table linking slang terms to songs where they appear
-- ============================================
CREATE TABLE song_slang (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,

  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),  -- Where it first appears
  occurrence_count INTEGER DEFAULT 1,     -- How many times in this song

  PRIMARY KEY (song_id, slang_id)
);

COMMENT ON TABLE song_slang IS 'Links slang terms to songs where they appear';

-- ============================================
-- TABLE 6: song_lemmas
-- Junction table linking standard lemmas to songs (reuses existing lemmas table)
-- ============================================
CREATE TABLE song_lemmas (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,

  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,

  PRIMARY KEY (song_id, lemma_id)
);

COMMENT ON TABLE song_lemmas IS 'Links standard vocabulary (lemmas) to songs';

-- ============================================
-- TABLE 7: song_phrases
-- Junction table linking standard phrases to songs (reuses existing phrases table)
-- ============================================
CREATE TABLE song_phrases (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,

  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,

  PRIMARY KEY (song_id, phrase_id)
);

COMMENT ON TABLE song_phrases IS 'Links standard phrases to songs';

-- ============================================
-- TABLE 8: user_slang_progress
-- FSRS-scheduled progress on slang vocabulary (mirrors user_lemma_progress)
-- ============================================
CREATE TABLE user_slang_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,

  -- FSRS scheduling columns (same pattern as lemma progress)
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,          -- 0=New, 1=Learning, 2=Review, 3=Relearning
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review_at TIMESTAMPTZ,

  -- Learning state
  is_introduced BOOLEAN DEFAULT FALSE,
  introduced_at TIMESTAMPTZ,

  -- Source tracking
  first_seen_song_id UUID REFERENCES songs(song_id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, slang_id)
);

COMMENT ON TABLE user_slang_progress IS 'FSRS-scheduled progress on slang vocabulary';

-- ============================================
-- TABLE 8: user_line_progress
-- FSRS-scheduled progress on line comprehension (mirrors user_sentence_progress)
-- ============================================
CREATE TABLE user_line_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES song_lines(line_id) ON DELETE CASCADE,

  -- FSRS scheduling columns
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,

  -- Comprehension data
  last_score REAL,                        -- 0.0 to 1.0
  best_score REAL,
  times_completed INTEGER DEFAULT 0,

  -- Source tracking
  first_seen_in TEXT DEFAULT 'study',     -- 'study' or 'review'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, line_id)
);

COMMENT ON TABLE user_line_progress IS 'FSRS-scheduled line comprehension progress';

-- ============================================
-- TABLE 9: user_song_progress
-- Overall song learning progress (mirrors user_chapter_reading_progress)
-- ============================================
CREATE TABLE user_song_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,

  -- Position tracking
  current_section_order INTEGER DEFAULT 1,
  current_line_order INTEGER DEFAULT 1,
  furthest_line_reached INTEGER DEFAULT 1,

  -- Completion status
  vocab_complete BOOLEAN DEFAULT FALSE,   -- All vocab introduced?
  study_complete BOOLEAN DEFAULT FALSE,   -- All lines studied?
  completed_at TIMESTAMPTZ,

  -- Aggregate stats
  total_lines INTEGER,
  lines_completed INTEGER DEFAULT 0,
  slang_introduced INTEGER DEFAULT 0,
  slang_total INTEGER,
  lemmas_introduced INTEGER DEFAULT 0,
  lemmas_total INTEGER,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, song_id)
);

COMMENT ON TABLE user_song_progress IS 'Overall song learning progress tracking';

-- ============================================
-- INDEXES
-- Performance indexes for common query patterns
-- ============================================

-- Song content queries
CREATE INDEX idx_song_sections_song ON song_sections(song_id, section_order);
CREATE INDEX idx_song_lines_section ON song_lines(section_id, line_order);

-- Slang lookups
CREATE INDEX idx_slang_terms_term ON slang_terms(term);
CREATE INDEX idx_slang_terms_region ON slang_terms(region);
CREATE INDEX idx_song_slang_song ON song_slang(song_id);

-- Song vocabulary
CREATE INDEX idx_song_lemmas_song ON song_lemmas(song_id);
CREATE INDEX idx_song_phrases_song ON song_phrases(song_id);

-- User slang progress
CREATE INDEX idx_slang_progress_due ON user_slang_progress(user_id, due_date);
CREATE INDEX idx_slang_progress_state ON user_slang_progress(user_id, fsrs_state);

-- User line progress
CREATE INDEX idx_line_progress_due ON user_line_progress(user_id, due_date);
CREATE INDEX idx_line_progress_state ON user_line_progress(user_id, fsrs_state);

-- ============================================
-- ALTER user_settings to add FK to songs
-- ============================================
ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_active_song_id_fkey
  FOREIGN KEY (active_song_id) REFERENCES songs(song_id);

-- ============================================
-- End of Lyrics Database Migration
-- ============================================
