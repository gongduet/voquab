# 32_LYRICS_DATABASE_SPEC.md

**Last Updated:** December 25, 2025
**Status:** Phase 4 Complete - Full UI Implementation
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

### What We're Building

A minimal implementation to validate the lyrics learning experience with a single song.

**Test Song:** "Debí Tirar Más Fotos" by Bad Bunny
- 46 learnable lines (excluding vocalizations)
- 10 sections (verses, choruses, bridge, interlude)
- ~60 standard lemmas (reuse existing system)
- ~38 slang terms (new system)

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
books                               songs
  └── chapters                        └── song_sections
        └── sentences                       └── song_lines
              └── sentence_fragments              └── (atomic for POC)

lemmas ←──────────────────────────→ slang_terms (parallel system)
  └── words                           └── song_slang (links to songs)

user_lemma_progress                 user_slang_progress
user_sentence_progress              user_line_progress
user_chapter_reading_progress       user_song_progress
```

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

### songs

Primary content container for a song.

```sql
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
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(section_id, line_order)
);

COMMENT ON TABLE song_lines IS 'Individual lyric lines with translations';
COMMENT ON COLUMN song_lines.is_skippable IS 'True for vocalizations, ad-libs, or non-translatable content';
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

### song_lemmas

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

COMMENT ON TABLE song_lemmas IS 'Links standard vocabulary (lemmas) to songs';
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
-- Song content queries
CREATE INDEX idx_song_sections_song ON song_sections(song_id, section_order);
CREATE INDEX idx_song_lines_section ON song_lines(section_id, line_order);

-- Slang lookups
CREATE INDEX idx_slang_terms_term ON slang_terms(term);
CREATE INDEX idx_slang_terms_region ON slang_terms(region);
CREATE INDEX idx_song_slang_song ON song_slang(song_id);

-- Song vocabulary
CREATE INDEX idx_song_lemmas_song ON song_lemmas(song_id);

-- User progress (already defined above)
-- idx_slang_progress_due, idx_slang_progress_state
-- idx_line_progress_due, idx_line_progress_state
```

---

## SEED DATA REFERENCE

The POC song "Debí Tirar Más Fotos" has been fully processed. Here's the structure for import:

### Song Record

```
title: "Debí Tirar Más Fotos"
artist: "Bad Bunny"
album: "DtMF"
release_year: 2025
difficulty: "intermediate"
dialect: "Puerto Rican Spanish"
themes: ['nostalgia', 'memory', 'home', 'friendship']
total_sections: 12
total_lines: 46
unique_slang_terms: 38
```

### Section Structure

| Order | Type | Label | Lines | Skippable |
|-------|------|-------|-------|-----------|
| 1 | intro | Intro | 1 | true (vocalization) |
| 2 | verse | Verse 1 - Nostalgia | 4 | false |
| 3 | pre_chorus | Pre-Chorus | 5 | false |
| 4 | verse | Verse 2 - Party | 5 | false |
| 5 | verse | Verse 3 - Romance | 5 | false |
| 6 | chorus | Chorus | 4 | false |
| 7 | chorus | Chorus (repeat) | 4 | false (repeat_of section 6) |
| 8 | verse | Verse 4 - Abuelo | 4 | false |
| 9 | verse | Verse 5 - Santurce | 5 | false |
| 10 | verse | Verse 6 - Loco | 4 | false |
| 11 | interlude | Spoken Interlude | 7 | false (valuable content) |
| 12 | verse | Verse 7 - Reflection | 5 | false |
| 13 | chorus | Chorus (variation) | 4 | false |
| 14 | outro | Outro | 1 | false |

### Slang Terms Summary (38 total)

Full slang data was provided in the previous conversation. Key categories:

**Phonetic Contractions (dropped consonants):**
- pelao, matá, patá, esbaratá, vo'a, to el día, pa, pa'l, p'acá, Toy, Vamo

**Puerto Rican Expressions:**
- Acho, Dime, corillo, chequéate, se da caña, llegarle

**Cultural/Musical Terms:**
- batá, güiro, perreo, bomba, plena, Santurce

**Terms of Endearment:**
- blanquita, perico, kilo, mami

**Anglicisms:**
- tirar fotos, babies, nudes, pa la movie

**Intensifiers/Exclamations:**
- jurado, cabrón, Diablo, cojones

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
- [ ] Identify and link standard lemmas via song_lemmas (future)
- [ ] Link standard phrases via song_phrases (future)

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

---

## RELATED DOCUMENTS

- **02_DATABASE_SCHEMA.md** - Base schema patterns and conventions
- **31_SENTENCE_COMPREHENSION.md** - Reading Mode patterns to mirror
- **04_LEARNING_ALGORITHM.md** - FSRS implementation details
- **30_FSRS_ARCHITECTURE.md** - Scheduling patterns

---

## REVISION HISTORY

- 2025-12-25: Phase 2 complete - Seed data inserted (54 lines, 38 slang terms) (Claude)
- 2025-12-25: Phase 1 complete - Database tables created and verified (Claude)
- 2025-12-25: Added song_phrases table (Peter, manual)
- 2025-12-22: Initial POC specification (Claude + Peter)
- Status: Phase 2 Complete

---

**END OF LYRICS DATABASE SPECIFICATION**
