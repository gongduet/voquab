# 32_LYRICS_DATABASE_SPEC.md

**Last Updated:** January 2, 2026
**Status:** Phase 6 Complete - Word-Level Vocabulary Architecture
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [POC Scope](#poc-scope)
3. [Schema Design](#schema-design)
4. [Table Definitions](#table-definitions)
5. [User Progress Tables](#user-progress-tables)
6. [Indexes](#indexes)
7. [Seed Data Reference](#seed-data-reference)
8. [Integration Notes](#integration-notes)
9. [Implementation Checklist](#implementation-checklist)

---

## OVERVIEW

This document specifies the database schema for **Voquab for Music**, a lyrics-based vocabulary learning feature. Users learn Spanish through song lyrics using the same fragment-based comprehension model as Reading Mode for books.

**Core Insight:** Song lyrics offer unique pedagogical advantages:
- Natural repetition (choruses repeat 3-4x)
- Emotional anchoring through music
- High user motivation (people want to understand favorite songs)
- Cultural immersion (slang, dialect, real-world language)

**Key Difference from Books:** Lyrics introduce non-standard vocabulary (slang) requiring a parallel vocabulary system alongside the existing lemmas table.

---

## POC SCOPE

### What We Built

Full album import pipeline validated with Bad Bunny's "Debí Tirar Más Fotos" album.

**First Import:** Bad Bunny - "Debí Tirar Más Fotos" (Full Album)

| Metric | Count |
|--------|-------|
| Songs | 17 |
| Total lines | 922 |
| Learnable lines | 909 |
| Skippable lines | 13 |
| Slang terms | 215 |
| Phrases | 118 |
| Lemmas linked | 292 |
| Translation fixes | 311 |

**Vocabulary Overlap:** 17.2% of El Principito lemmas appear in Bad Bunny lyrics (287 shared lemmas)

### What's Included

- Song content tables (songs, sections, lines)
- Slang vocabulary system
- User progress tracking (mirrors sentence comprehension)
- Line-by-line study mode support

### What's Excluded (Future)

- Audio integration/sync
- Artist management (artist is just a text field for now)
- Multiple songs per artist
- Karaoke mode
- Fragment-level breakdown (lines are atomic units for POC)

---

## SCHEMA DESIGN

### Relationship to Existing Schema

```
EXISTING (Books)                    NEW (Lyrics)
─────────────────                   ─────────────
books                               albums
  └── chapters                        └── songs
        └── sentences                       └── song_sections
              └── sentence_fragments              └── song_lines
                    └── words                           └── song_line_words
                                                              └── lemmas

lemmas ←──────────────────────────→ slang_terms (parallel system)
  └── words                           └── song_line_slang_occurrences
                                      └── song_line_phrase_occurrences

user_lemma_progress                 user_slang_progress
user_sentence_progress              user_line_progress
user_chapter_reading_progress       user_song_progress
```

### Word-Level Architecture (Phase 6)

As of January 2026, the lyrics system uses **word-level vocabulary linking**:

- **`song_line_words`** - Individual words in each line linked to lemmas
- **`song_line_phrase_occurrences`** - Phrase positions within lines
- **`song_line_slang_occurrences`** - Slang positions within lines
- **`song_lemmas`** (deprecated) - Old song-level lemma linking

### Design Principles

1. **Slang is parallel to lemmas, not a replacement**
   - Standard vocabulary uses existing `lemmas` table
   - Slang terms get their own table with dialect/cultural context
   - Users track progress on both independently

2. **Lines are atomic (no fragments for POC)**
   - Book sentences get fragment breakdowns
   - Song lines are typically shorter, self-contained
   - Can add line_fragments table later if needed

3. **Sections replace chapters**
   - Songs have verses, choruses, bridges
   - Section order matters for learning flow
   - Repeat count tracks chorus appearances

4. **Progress mirrors sentence comprehension**
   - FSRS scheduling for line mastery
   - Song-level progress tracking
   - Same proven patterns, new content type

---

## TABLE DEFINITIONS

### albums

Album metadata for organizing songs.

```sql
CREATE TABLE albums (
  album_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic metadata
  title TEXT NOT NULL,                    -- "Debí Tirar Más Fotos"
  artist TEXT NOT NULL,                   -- "Bad Bunny"
  release_year INTEGER,                   -- 2025
  cover_image_url TEXT,                   -- Album artwork URL

  -- Learning metadata
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  dialect TEXT,                           -- "Puerto Rican Spanish"
  themes TEXT[],                          -- ARRAY['nostalgia', 'memory']

  -- Stats (computed)
  total_songs INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  unique_lemmas INTEGER DEFAULT 0,
  unique_slang_terms INTEGER DEFAULT 0,

  -- Status
  is_published BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE albums IS 'Album metadata for organizing songs';
```

---

### songs

Primary content container for a song.

```sql
CREATE TABLE songs (
  song_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Album reference (optional for backward compatibility)
  album_id UUID REFERENCES albums(album_id) ON DELETE SET NULL,

  -- Basic metadata
  title TEXT NOT NULL,                    -- "Debí Tirar Más Fotos"
  artist TEXT NOT NULL,                   -- "Bad Bunny" (simple text for POC)
  album TEXT,                             -- "DtMF" (legacy text field)
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
```

---

### song_sections

Structural divisions within a song (verse, chorus, bridge, etc.).

```sql
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
```

---

### song_lines

Individual lines of lyrics with translations.

```sql
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

  -- Review status
  is_reviewed BOOLEAN DEFAULT FALSE,      -- Has this line been reviewed for quality?
  reviewed_at TIMESTAMPTZ,                -- When was it reviewed?

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(section_id, line_order)
);

COMMENT ON TABLE song_lines IS 'Individual lyric lines with translations';
COMMENT ON COLUMN song_lines.is_skippable IS 'True for vocalizations, ad-libs, or non-translatable content';
COMMENT ON COLUMN song_lines.is_reviewed IS 'True when line translation and vocabulary have been manually reviewed';
```

---

### slang_terms

Non-standard vocabulary with cultural context (parallel to lemmas table).

```sql
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
```

---

### song_slang

Junction table linking slang terms to songs where they appear.

```sql
CREATE TABLE song_slang (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,
  
  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),  -- Where it first appears
  occurrence_count INTEGER DEFAULT 1,     -- How many times in this song
  
  PRIMARY KEY (song_id, slang_id)
);

COMMENT ON TABLE song_slang IS 'Links slang terms to songs where they appear';
```

---

### song_lemmas ⚠️ DEPRECATED

> **Note:** This table is deprecated as of January 2026. Use `song_line_words` for word-level vocabulary linking instead. The `song_lemmas` table provided song-level lemma aggregation but lacked positional information needed for inline vocabulary highlights.

Junction table linking standard lemmas to songs (reuses existing lemmas table).

```sql
CREATE TABLE song_lemmas (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,

  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,

  PRIMARY KEY (song_id, lemma_id)
);

COMMENT ON TABLE song_lemmas IS 'DEPRECATED: Use song_line_words instead';
```

---

### song_line_words

Word-level vocabulary linking. Each word in a line is tokenized and linked to a lemma.

```sql
CREATE TABLE song_line_words (
  word_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES song_sections(section_id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES song_lines(line_id) ON DELETE CASCADE,
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE SET NULL,

  -- Word content
  word_text TEXT NOT NULL,                -- Original text as it appears in line
  word_position INTEGER NOT NULL,         -- 0-indexed position within line

  -- Grammatical information (from spaCy)
  grammatical_info JSONB,                 -- {pos, morph, gender, lemma_form}

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(line_id, word_position)
);

COMMENT ON TABLE song_line_words IS 'Word-level vocabulary linking for song lines';
COMMENT ON COLUMN song_line_words.grammatical_info IS 'spaCy morphology: pos, morph, gender, lemma_form';

CREATE INDEX idx_song_line_words_line ON song_line_words(line_id);
CREATE INDEX idx_song_line_words_lemma ON song_line_words(lemma_id);
CREATE INDEX idx_song_line_words_song ON song_line_words(song_id);
```

---

### song_line_phrase_occurrences

Tracks where phrases appear in song lines with word positions.

```sql
CREATE TABLE song_line_phrase_occurrences (
  occurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  line_id UUID NOT NULL REFERENCES song_lines(line_id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,

  -- Position within line (word indices, 0-indexed)
  start_position INTEGER NOT NULL,        -- First word index
  end_position INTEGER NOT NULL,          -- Last word index (inclusive)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(line_id, phrase_id, start_position)
);

COMMENT ON TABLE song_line_phrase_occurrences IS 'Phrase positions within song lines';

CREATE INDEX idx_phrase_occurrences_line ON song_line_phrase_occurrences(line_id);
CREATE INDEX idx_phrase_occurrences_phrase ON song_line_phrase_occurrences(phrase_id);
```

---

### song_line_slang_occurrences

Tracks where slang terms appear in song lines with word positions.

```sql
CREATE TABLE song_line_slang_occurrences (
  occurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  line_id UUID NOT NULL REFERENCES song_lines(line_id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,

  -- Position within line (word indices, 0-indexed)
  start_position INTEGER NOT NULL,        -- First word index
  end_position INTEGER NOT NULL,          -- Last word index (inclusive)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(line_id, slang_id, start_position)
);

COMMENT ON TABLE song_line_slang_occurrences IS 'Slang term positions within song lines';

CREATE INDEX idx_slang_occurrences_line ON song_line_slang_occurrences(line_id);
CREATE INDEX idx_slang_occurrences_slang ON song_line_slang_occurrences(slang_id);
```

---

### song_phrases

Junction table linking standard phrases to songs (reuses existing phrases table). Enables unified vocabulary tracking - if "valer la pena" appears in both El Principito and a Bad Bunny song, user learns it once.

```sql
CREATE TABLE song_phrases (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,

  -- First occurrence reference
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,

  PRIMARY KEY (song_id, phrase_id)
);

CREATE INDEX idx_song_phrases_song ON song_phrases(song_id);

COMMENT ON TABLE song_phrases IS 'Links standard phrases to songs where they appear';
```

---

## USER PROGRESS TABLES

### user_slang_progress

FSRS-scheduled progress on slang vocabulary (mirrors user_lemma_progress).

```sql
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

CREATE INDEX idx_slang_progress_due ON user_slang_progress(user_id, due_date);
CREATE INDEX idx_slang_progress_state ON user_slang_progress(user_id, fsrs_state);
```

---

### user_line_progress

FSRS-scheduled progress on line comprehension (mirrors user_sentence_progress).

```sql
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

CREATE INDEX idx_line_progress_due ON user_line_progress(user_id, due_date);
CREATE INDEX idx_line_progress_state ON user_line_progress(user_id, fsrs_state);
```

---

### user_song_progress

Overall song learning progress (mirrors user_chapter_reading_progress).

```sql
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
```

---

## INDEXES

Performance indexes for common query patterns.

```sql
-- Album/song queries
CREATE INDEX idx_songs_album ON songs(album_id);

-- Song content queries
CREATE INDEX idx_song_sections_song ON song_sections(song_id, section_order);
CREATE INDEX idx_song_lines_section ON song_lines(section_id, line_order);

-- Slang lookups
CREATE INDEX idx_slang_terms_term ON slang_terms(term);
CREATE INDEX idx_slang_terms_region ON slang_terms(region);
CREATE INDEX idx_song_slang_song ON song_slang(song_id);

-- Word-level vocabulary (new architecture)
CREATE INDEX idx_song_line_words_line ON song_line_words(line_id);
CREATE INDEX idx_song_line_words_lemma ON song_line_words(lemma_id);
CREATE INDEX idx_song_line_words_song ON song_line_words(song_id);

-- Phrase/slang occurrences
CREATE INDEX idx_phrase_occurrences_line ON song_line_phrase_occurrences(line_id);
CREATE INDEX idx_phrase_occurrences_phrase ON song_line_phrase_occurrences(phrase_id);
CREATE INDEX idx_slang_occurrences_line ON song_line_slang_occurrences(line_id);
CREATE INDEX idx_slang_occurrences_slang ON song_line_slang_occurrences(slang_id);

-- Song vocabulary (deprecated - keeping for backward compatibility)
CREATE INDEX idx_song_lemmas_song ON song_lemmas(song_id);

-- User progress (already defined above)
-- idx_slang_progress_due, idx_slang_progress_state
-- idx_line_progress_due, idx_line_progress_state
```

---

## SEED DATA REFERENCE

### Full Album Import: Bad Bunny "Debí Tirar Más Fotos"

The complete album has been imported via `scripts/import_lyrics.py`. See **34_LYRICS_IMPORT_PIPELINE.md** for the full import process.

### Album Statistics

| Song | Lines | Lemmas |
|------|-------|--------|
| Lo Que Le Pasó a Hawaii | 48 | 24 |
| Voy a Llevarte Pa' PR | 58 | 33 |
| La Mudanza | 64 | 37 |
| Nuevayol | 72 | 25 |
| Baile Inolvidable | 60 | 44 |
| Bokete | 52 | 54 |
| Turista | 44 | 37 |
| El Clúb | 56 | 54 |
| Weltita | 60 | 44 |
| Eoo | 76 | 45 |
| Ketu Tecré | 68 | 37 |
| Kloufrens | 56 | 34 |
| DTMF | 80 | 52 |
| Veldá | 84 | 44 |
| Café con Ron | 76 | 41 |
| Perfumito Nuevo | 60 | 34 |
| Pitorro de Coco | 46 | 29 |

### Slang Terms Summary (215 total)

**By Formality:**
- Informal: 208
- Vulgar: 7

**By Type:**
- Phonetic spellings (dropped letters): 80 terms (año', pa', to', etc.)
- True slang vocabulary: 135 terms (bellaqueo, perreo, bichota, etc.)

**Key Categories:**

**Phonetic Contractions:**
- pa', año', to', vamo', ere', tiene', etc.

**Puerto Rican Expressions:**
- Acho, bellaqueo, perreo, bichota, corillo, jangueo

**Cultural/Musical Terms:**
- batá, güiro, dembow, reggaetón

**Terms of Endearment:**
- blanquita, blanquito, mami, papi

**Vulgar Terms (7):**
- bichota, bichote, cabrón, cojón, puñeta, singue, chingao

---

## INTEGRATION NOTES

### Reusing Existing Infrastructure

1. **FSRS Scheduling** - Same ts-fsrs library and patterns
2. **Lemmas Table** - Standard vocabulary links via song_lemmas
3. **User Authentication** - Same auth.users reference
4. **Admin Interface** - Extend existing patterns for song management

### UI Components to Adapt

1. **Reading Mode → Study Mode** - Same line-by-line progression
2. **Chapter Selection → Song Selection** - Simple list for POC
3. **Sentence Display → Line Display** - Tap-to-translate pattern
4. **Progress Dashboard** - Add "Songs" section

### API Patterns

```javascript
// Get song with sections and lines
const { data: song } = await supabase
  .from('songs')
  .select(`
    *,
    song_sections (
      *,
      song_lines (*)
    )
  `)
  .eq('song_id', songId)
  .single();

// Get slang for a song
const { data: slang } = await supabase
  .from('song_slang')
  .select(`
    slang_terms (*)
  `)
  .eq('song_id', songId);

// Get user's song progress
const { data: progress } = await supabase
  .from('user_song_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('song_id', songId)
  .single();
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Database Setup ✅ COMPLETE (2025-12-25)

- [x] Create `songs` table
- [x] Create `song_sections` table
- [x] Create `song_lines` table
- [x] Create `slang_terms` table
- [x] Create `song_slang` junction table
- [x] Create `song_lemmas` junction table
- [x] Create `song_phrases` junction table (added manually by Peter)
- [x] Create `user_slang_progress` table
- [x] Create `user_line_progress` table
- [x] Create `user_song_progress` table
- [x] Create all indexes
- [x] Run migration on Supabase

**Migration file:** `supabase/migrations/20251225_lyrics_database.sql`
**Total tables:** 10

### Phase 2: Seed Data ✅ COMPLETE (2025-12-25)

- [x] Insert "Debí Tirar Más Fotos" song record
- [x] Insert 14 sections
- [x] Insert 54 lines with translations (more than spec estimate)
- [x] Insert 38 slang terms with cultural notes
- [x] Link slang terms to song via song_slang
- [x] Identify and link standard lemmas via song_lemmas (Phase 5)
- [x] Link standard phrases via song_phrases (Phase 5)

**Seed script:** `scripts/seed-lyrics-poc.js`
**Verify script:** `scripts/verify-lyrics-seed.js`

### Phase 3: Admin Interface ✅ COMPLETE (2025-12-25)

- [x] Song list view (`AdminSongs.jsx` at `/admin/songs`)
- [x] Song detail/edit view (`SongDeepDive.jsx` at `/admin/songs/:songId`)
- [x] Slang term management (`AdminSlang.jsx` at `/admin/slang`)
- [x] Slang detail/edit view (`SlangDeepDive.jsx` at `/admin/slang/:slangId`)
- [x] Toggle published/approved status
- [ ] Section management (future - view only for now)
- [ ] Line editing with translations (future)

**Files created:**
- `src/pages/AdminSongs.jsx`
- `src/pages/SongDeepDive.jsx`
- `src/pages/AdminSlang.jsx`
- `src/pages/SlangDeepDive.jsx`

### Phase 4: User-Facing Features ✅ COMPLETE (2025-12-25)

- [x] Song browser (`Songs.jsx` at `/songs`)
- [x] "Learn Vocab First" mode - slang flashcards (`SlangFlashcards.jsx` at `/songs/:songId/vocab`)
- [x] "Study Song" mode - line-by-line (`SongStudy.jsx` at `/songs/:songId/study`)
- [x] Dashboard "Songs" section (button in QuickActions)
- [ ] Progress tracking integration (future - FSRS not wired up yet)

**Files created:**
- `src/pages/Songs.jsx`
- `src/pages/SlangFlashcards.jsx`
- `src/pages/SongStudy.jsx`

**Files modified:**
- `src/components/dashboard/QuickActions.jsx` - Added Songs button

### Phase 5: Full Album Import Pipeline ✅ COMPLETE (2026-01-02)

- [x] 8-phase import pipeline (`scripts/import_lyrics.py`)
- [x] Parse album text file structure
- [x] DeepL bulk translation
- [x] Vocalization detection and flagging
- [x] AI-powered slang/phrase detection
- [x] Insert vocabulary to database
- [x] spaCy lemma extraction with gender heuristics
- [x] AI translation correction pass
- [x] Full album import: 17 songs, 922 lines

**Import script:** `scripts/import_lyrics.py`
**Documentation:** `docs/34_LYRICS_IMPORT_PIPELINE.md`

**Import statistics:**
- 215 slang terms created
- 118 phrases linked
- 292 lemmas linked
- 311 translation corrections

### Phase 6: Word-Level Vocabulary Architecture ✅ COMPLETE (2026-01-02)

- [x] Create `albums` table
- [x] Add `album_id` column to `songs` table
- [x] Add `is_reviewed`, `reviewed_at` columns to `song_lines` table
- [x] Create `song_line_words` table for word-level vocabulary linking
- [x] Create `song_line_phrase_occurrences` table
- [x] Create `song_line_slang_occurrences` table
- [x] Create backfill script for song_line_words (`scripts/backfill_song_line_words.py`)
- [x] Create backfill script for occurrences (`scripts/backfill_phrase_slang_occurrences.py`)
- [x] Update import_lyrics.py with Phase 7 (Extract Words) and Phase 8 (Detect Occurrences)
- [x] Backfill all existing lines (2,019 words, 263 new lemmas)
- [x] Backfill all occurrences (14 phrases, 61 slang)

**Migration file:** `supabase/migrations/20260102_create_albums_table.sql`
**Backfill scripts:**
- `scripts/backfill_song_line_words.py`
- `scripts/backfill_phrase_slang_occurrences.py`

**Architecture change:** Song vocabulary now uses word-level linking through `song_line_words` instead of song-level aggregation via `song_lemmas`. This enables:
- Precise word positions for inline highlights
- Per-word grammatical information from spaCy
- Phrase/slang occurrence positions for multi-word highlights

---

## RELATED DOCUMENTS

- **34_LYRICS_IMPORT_PIPELINE.md** - Full import pipeline documentation
- **02_DATABASE_SCHEMA.md** - Base schema patterns and conventions
- **31_SENTENCE_COMPREHENSION.md** - Reading Mode patterns to mirror
- **04_LEARNING_ALGORITHM.md** - FSRS implementation details
- **30_FSRS_ARCHITECTURE.md** - Scheduling patterns

---

## REVISION HISTORY

- 2026-01-02: Phase 6 complete - Word-level vocabulary architecture (Claude)
  - Added `albums` table for album-level organization
  - Added `song_line_words` table for word-level vocabulary linking
  - Added `song_line_phrase_occurrences` and `song_line_slang_occurrences` tables
  - Updated `songs` table with `album_id` foreign key
  - Updated `song_lines` table with `is_reviewed`, `reviewed_at` columns
  - Deprecated `song_lemmas` table (replaced by `song_line_words`)
  - Updated schema diagram and indexes
- 2026-01-02: Phase 5 complete - Full album import pipeline (17 songs, 922 lines, 215 slang, 292 lemmas) (Claude)
- 2025-12-25: Phase 4 complete - User-facing features (Songs browser, Study mode, Vocab mode) (Claude)
- 2025-12-25: Phase 3 complete - Admin interface (Song management, Slang management) (Claude)
- 2025-12-25: Phase 2 complete - Seed data inserted (54 lines, 38 slang terms) (Claude)
- 2025-12-25: Phase 1 complete - Database tables created and verified (Claude)
- 2025-12-25: Added song_phrases table (Peter, manual)
- 2025-12-22: Initial POC specification (Claude + Peter)
- Status: Phase 6 Complete

---

**END OF LYRICS DATABASE SPECIFICATION**
