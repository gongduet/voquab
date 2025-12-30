# 02_DATABASE_SCHEMA.md

**Last Updated:** December 30, 2025
**Status:** Active
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Schema Philosophy](#schema-philosophy)
3. [Content Tables](#content-tables)
4. [Vocabulary Tables](#vocabulary-tables)
5. [Phrase Tables](#phrase-tables)
6. [Validation Tables](#validation-tables)
7. [User Progress Tables](#user-progress-tables)
8. [User Management Tables](#user-management-tables)
9. [Lyrics Tables (POC)](#lyrics-tables-poc)
10. [Complete SQL Definitions](#complete-sql-definitions)
11. [Indexes & Performance](#indexes--performance)
12. [Design Rationale](#design-rationale)
13. [Quick Reference](#quick-reference)

---

## OVERVIEW

This document defines the complete Voquab database schema. The design prioritizes:
- **Simplicity:** Easy to understand and maintain
- **Clarity:** Words point to lemmas, lemmas have definitions
- **Performance:** Proper indexes for common queries
- **Scalability:** Ready for multiple books and languages

**Core Principle:** "Words point to Lemmas. Lemmas have definitions. Users master Lemmas."

---

## SCHEMA PHILOSOPHY

### The Three-Layer Model

```
Layer 1: CONTENT (books, chapters, sentences)
           ↓
Layer 2: VOCABULARY (lemmas, words)
           ↓
Layer 3: USER PROGRESS (mastery, health, encounters)
```

### Key Design Decisions

1. **Lemmas are canonical dictionary entries**
   - One entry for "vivir" (to live)
   - Stores definitions, part of speech, gender

2. **Words are instances in text**
   - "vivía" appears in sentence X
   - Points to lemma "vivir"
   - Stores grammatical context

3. **Users track progress on lemmas**
   - Mastery of "vivir" (the concept)
   - Not separate mastery for each conjugation
   - Prevents flashcard deck flooding

4. **User encounters track form exposure**
   - Which forms has user seen? (vivía, vivió, vivo)
   - When and where did they see them?
   - Supports sentence selection logic

---

## CONTENT TABLES

### books

Stores book metadata for El Principito and future books.

```sql
CREATE TABLE books (
  book_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  language_code TEXT NOT NULL, -- 'es', 'fr', 'it'
  total_chapters INTEGER NOT NULL,
  total_sentences INTEGER NOT NULL,
  cover_image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example:**
```
book_id: abc-123
title: "El Principito"
author: "Antoine de Saint-Exupéry"
language_code: "es"
total_chapters: 27
```

---

### chapters

Stores chapter information with Little Prince theming.

```sql
CREATE TABLE chapters (
  chapter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  planet_name TEXT, -- "Asteroid B-612", "The Rose's Planet"
  planet_description TEXT,
  illustration_url TEXT,
  total_sentences_in_chapter INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(book_id, chapter_number)
);
```

**Example:**
```
chapter_id: def-456
book_id: abc-123
chapter_number: 1
title: "Capítulo 1"
planet_name: "Earth"
total_sentences_in_chapter: 42
```

---

### sentences

Stores individual sentences with translations.

```sql
CREATE TABLE sentences (
  sentence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_order INTEGER NOT NULL,
  sentence_text TEXT NOT NULL, -- Spanish text
  sentence_translation TEXT NOT NULL, -- English translation
  narrative_context TEXT, -- "The narrator reflects on childhood"
  speaker TEXT, -- "The Prince", "The Narrator", etc.
  is_paragraph_start BOOLEAN DEFAULT FALSE, -- Marks paragraph boundaries
  is_reviewed BOOLEAN DEFAULT FALSE, -- Manual review status for admin curation
  reviewed_at TIMESTAMPTZ, -- When sentence was reviewed
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chapter_id, sentence_order)
);
```

**Example:**
```
sentence_id: ghi-789
chapter_id: def-456
sentence_order: 1
sentence_text: "Cuando yo tenía seis años..."
sentence_translation: "When I was six years old..."
```

---

## VOCABULARY TABLES

### lemmas

The canonical dictionary entries. One entry per unique lemma.

```sql
CREATE TABLE lemmas (
  lemma_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lemma_text TEXT NOT NULL, -- "vivir", "el libro", "la casa"
  language_code TEXT NOT NULL, -- 'es', 'fr', 'it'
  part_of_speech TEXT, -- VERB, NOUN, ADJ, ADV, PREP, DET, PRON, etc.
  gender TEXT CHECK (gender IN ('M', 'F', NULL)), -- For nouns
  definitions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of English translations
  is_stop_word BOOLEAN DEFAULT FALSE,
  is_reviewed BOOLEAN DEFAULT FALSE, -- Manual review status for admin curation
  reviewed_at TIMESTAMPTZ, -- When lemma was reviewed
  admin_notes TEXT, -- Manual notes for tricky words
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lemma_text, language_code)
);

COMMENT ON COLUMN lemmas.definitions IS 'JSONB array: ["to live", "to reside", "to dwell"]';
COMMENT ON COLUMN lemmas.lemma_text IS 'For verbs: infinitive. For nouns: singular with article (el libro, la casa)';
COMMENT ON COLUMN lemmas.is_reviewed IS 'Admin curation status - true when manually reviewed';
```

**Examples:**

```json
// Verb lemma
{
  "lemma_id": "uuid-1",
  "lemma_text": "vivir",
  "language_code": "es",
  "part_of_speech": "VERB",
  "gender": null,
  "definitions": ["to live", "to reside"],
  "is_stop_word": false
}

// Noun lemma
{
  "lemma_id": "uuid-2",
  "lemma_text": "el libro",
  "language_code": "es",
  "part_of_speech": "NOUN",
  "gender": "M",
  "definitions": ["the book"],
  "is_stop_word": false
}

// Common word (stop word)
{
  "lemma_id": "uuid-3",
  "lemma_text": "de",
  "language_code": "es",
  "part_of_speech": "PREP",
  "gender": null,
  "definitions": ["of", "from"],
  "is_stop_word": true
}
```

---

### words

Individual word instances as they appear in sentences.

```sql
CREATE TABLE words (
  word_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_text TEXT NOT NULL, -- The word as it appears: "vivía", "libros"
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE SET NULL, -- Nullable for orphaned words
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL, -- Position in sentence (1-indexed)
  grammatical_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sentence_id, word_position)
);

COMMENT ON COLUMN words.grammatical_info IS 'Verb: {tense, person, number}. Noun: {number}. Adj: {gender, number}';
COMMENT ON COLUMN words.lemma_id IS 'Nullable - words with NULL lemma_id are "orphaned" and need reassignment';
```

**Examples:**

```json
// Verb form "vivía"
{
  "word_id": "uuid-100",
  "word_text": "vivía",
  "lemma_id": "uuid-1", // Points to "vivir"
  "sentence_id": "ghi-789",
  "word_position": 3,
  "grammatical_info": {
    "tense": "imperfect",
    "person": "1st",
    "number": "singular"
  }
}

// Noun form "libros" (plural)
{
  "word_id": "uuid-101",
  "word_text": "libros",
  "lemma_id": "uuid-2", // Points to "el libro"
  "sentence_id": "ghi-790",
  "word_position": 5,
  "grammatical_info": {
    "number": "plural"
  }
}
```

---

## PHRASE TABLES

### phrases

Stores idiomatic phrases and multi-word expressions where meaning differs from individual words.

```sql
CREATE TABLE phrases (
  phrase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phrase_text TEXT NOT NULL UNIQUE, -- "personas mayores", "dar miedo"
  definitions JSONB DEFAULT '[]'::jsonb, -- Array of English translations
  component_lemmas UUID[], -- Lemmas that make up the phrase
  phrase_type TEXT, -- 'idiom', 'collocation', 'compound', 'expression'
  frequency_rank INTEGER,
  is_reviewed BOOLEAN DEFAULT FALSE, -- Manual approval status
  reviewed_at TIMESTAMPTZ, -- When phrase was reviewed
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN phrases.phrase_type IS 'idiom: non-literal meaning, collocation: frequently co-occurring, compound: multi-word term';
COMMENT ON COLUMN phrases.component_lemma_ids IS 'Array of lemma UUIDs that make up this phrase';
```

**Purpose:** Detect and track idiomatic expressions like "personas mayores" (grown-ups) where meaning ≠ sum of words.

**Examples:**

```json
// Compound expression
{
  "phrase_id": "uuid-phrase-1",
  "phrase_text": "personas mayores",
  "definitions": ["grown-ups", "adults"],
  "component_lemmas": ["uuid-persona", "uuid-mayor"],
  "phrase_type": "compound",
  "is_reviewed": true,
  "admin_notes": "In children's literature, refers to adults/grown-ups"
}

// Idiom
{
  "phrase_id": "uuid-phrase-2",
  "phrase_text": "dar miedo",
  "definitions": ["to scare", "to frighten"],
  "component_lemmas": ["uuid-dar", "uuid-miedo"],
  "phrase_type": "idiom",
  "is_reviewed": false
}
```

---

### phrase_occurrences

Links phrases to sentences where they appear.

```sql
CREATE TABLE phrase_occurrences (
  occurrence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  start_position INTEGER, -- Where phrase starts in sentence (0-indexed)
  end_position INTEGER, -- Where phrase ends in sentence (0-indexed)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance index for chapter-based queries
CREATE INDEX idx_phrase_occurrences_chapter ON phrase_occurrences(chapter_id);

COMMENT ON TABLE phrase_occurrences IS 'Tracks where phrases appear in text';
COMMENT ON COLUMN phrase_occurrences.chapter_id IS 'Denormalized for efficient chapter unlock calculations';
```

**Purpose:** Track exact locations of phrases within sentences for highlighting and learning context. The `chapter_id` column is denormalized from the sentence's chapter for performance - enables efficient chapter unlock calculations without joining through sentences.

---

### chapter_vocabulary_stats

Pre-computed vocabulary totals per chapter for efficient chapter unlock calculations.

```sql
CREATE TABLE chapter_vocabulary_stats (
  chapter_id UUID PRIMARY KEY REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  total_lemmas INTEGER NOT NULL DEFAULT 0,   -- Unique lemmas excluding stop words
  total_phrases INTEGER NOT NULL DEFAULT 0,  -- Unique phrases in chapter
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE chapter_vocabulary_stats IS 'Pre-computed vocabulary counts per chapter for efficient unlock calculations';
COMMENT ON COLUMN chapter_vocabulary_stats.total_lemmas IS 'Count of unique lemmas in chapter, excluding stop words';
COMMENT ON COLUMN chapter_vocabulary_stats.total_phrases IS 'Count of unique phrases in chapter';
```

**Purpose:** Caches vocabulary totals per chapter to avoid counting 13K+ words on every chapter unlock check. Refreshed via `refresh_chapter_vocabulary_stats()` RPC after content changes.

**Usage:**
- Used by `getUnlockedChapterIds()` and `getUnlockedChapters()` in sessionBuilder.js
- Combined with `get_user_chapter_progress()` RPC to calculate unlock percentage
- Chapter unlocks when `introduced_count / (total_lemmas + total_phrases) >= 0.95`

---

### user_phrase_progress

Tracks user's FSRS-based progress for phrases (parallel to user_lemma_progress).

```sql
CREATE TABLE user_phrase_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,

  -- FSRS Scheduling Columns (Active)
  stability REAL,                    -- Days until 90% recall probability
  difficulty REAL,                   -- Item complexity on 1-10 scale
  due_date TIMESTAMPTZ,             -- When card should be reviewed
  fsrs_state SMALLINT DEFAULT 0,    -- 0=New, 1=Learning, 2=Review, 3=Relearning
  reps INTEGER DEFAULT 0,           -- Total number of reviews
  lapses INTEGER DEFAULT 0,         -- Number of times "Again" pressed
  last_seen_at TIMESTAMPTZ,         -- Last time card shown (review or exposure)

  -- Deprecated Columns (will be removed after 30 days)
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  last_reviewed_at TIMESTAMPTZ,

  -- Still active
  total_reviews INTEGER DEFAULT 0,
  review_history JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, phrase_id)
);

-- FSRS Indexes for phrase queries
CREATE INDEX idx_phrase_progress_due ON user_phrase_progress(user_id, due_date);
CREATE INDEX idx_phrase_progress_exposure ON user_phrase_progress(user_id, stability, fsrs_state, last_seen_at);

COMMENT ON TABLE user_phrase_progress IS 'FSRS-based progress tracking for idiomatic phrases';
```

**Purpose:** Allows users to study phrases as flashcards with the same FSRS scheduling as lemmas.

**Phrase Integration:**
- Phrases appear in Learn sessions as soon as chapter is unlocked (proportional mix)
- Proportional lemma-to-phrase ratio based on available unexposed items
- Same FSRS algorithm applies to phrases

> **Note:** There is no `introduced` column. To determine if a card has been introduced, check `reps >= 1`.

---

## VALIDATION TABLES

### validation_reports

Stores AI validation results for lemmas, tracking issues and suggested fixes.

```sql
CREATE TABLE validation_reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  confidence DECIMAL(5,2), -- AI confidence score 0-100
  issues JSONB DEFAULT '[]'::jsonb, -- Array of issue objects
  suggested_fixes JSONB DEFAULT '{}'::jsonb, -- Suggested corrections (object)
  has_multiple_meanings BOOLEAN DEFAULT FALSE, -- Flag for polysemous words
  alternative_meanings JSONB DEFAULT '[]'::jsonb, -- Additional meanings not in primary definition
  validated_at TIMESTAMPTZ, -- When validation was performed
  reviewed_by_human BOOLEAN DEFAULT FALSE, -- Manual review flag
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lemma_id)
);

COMMENT ON TABLE validation_reports IS 'AI-generated validation results for lemma quality assurance';
COMMENT ON COLUMN validation_reports.issues IS 'Array of issues: [{type, description, severity}]';
COMMENT ON COLUMN validation_reports.has_multiple_meanings IS 'True if word has multiple distinct meanings beyond primary definition';
```

**Purpose:** Track quality issues found during AI validation of lemmas.

**Example:**

```json
{
  "report_id": "uuid-report-1",
  "lemma_id": "uuid-compran",
  "is_valid": false,
  "confidence": 95,
  "issues": [
    {
      "type": "conjugation",
      "description": "compran is a conjugated form of comprar",
      "severity": "high"
    }
  ],
  "suggested_fixes": {
    "action": "merge",
    "target_lemma": "comprar",
    "reason": "conjugated form should be merged to infinitive"
  },
  "has_multiple_meanings": false,
  "alternative_meanings": [],
  "validated_at": "2025-12-06T10:30:00Z",
  "reviewed_by_human": false,
  "created_at": "2025-12-06T18:14:35.083Z"
}
```

**Issue Types:**

| Type | Description | Action |
|------|-------------|--------|
| **conjugation** | Verb form instead of infinitive | Merge to infinitive |
| **garbage** | Non-existent Spanish word | Delete |
| **variant** | Adjective not masculine singular | Merge to canonical |
| **misspelling** | Typo or OCR error | Rename or delete |
| **duplicate** | Same meaning as another lemma | Merge |

---

## USER PROGRESS TABLES

### user_lemma_progress

Tracks user's FSRS-based progress for each lemma.

```sql
CREATE TABLE user_lemma_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,

  -- FSRS Scheduling Columns (Active)
  stability REAL,                    -- Days until 90% recall probability
  difficulty REAL,                   -- Item complexity on 1-10 scale
  due_date TIMESTAMPTZ,             -- When card should be reviewed
  fsrs_state SMALLINT DEFAULT 0,    -- 0=New, 1=Learning, 2=Review, 3=Relearning
  reps INTEGER DEFAULT 0,           -- Total number of reviews
  lapses INTEGER DEFAULT 0,         -- Number of times "Again" pressed
  last_seen_at TIMESTAMPTZ,         -- Last time card shown (review or exposure)

  -- Deprecated Columns (will be removed after 30 days - 2025-01-13)
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),  -- Use stability instead
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),                        -- Use retrievability calc
  correct_reviews INTEGER DEFAULT 0,                                                      -- Use (reps - lapses)
  last_correct_review_at TIMESTAMPTZ,  -- Replaced by due_date
  last_reviewed_at TIMESTAMPTZ,         -- Replaced by last_seen_at
  review_due DATE,                      -- Replaced by due_date (TIMESTAMPTZ)

  -- Still active
  total_reviews INTEGER DEFAULT 0,
  failed_in_last_3_sessions BOOLEAN DEFAULT FALSE,
  review_history JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, lemma_id)
);

-- FSRS Indexes for efficient queries
CREATE INDEX idx_user_progress_due ON user_lemma_progress(user_id, due_date);
CREATE INDEX idx_user_progress_exposure ON user_lemma_progress(user_id, stability, fsrs_state, last_seen_at);

COMMENT ON COLUMN user_lemma_progress.stability IS 'FSRS: Days until 90% recall probability. Higher = better learned.';
COMMENT ON COLUMN user_lemma_progress.difficulty IS 'FSRS: Item complexity 1-10. Higher = harder to learn.';
COMMENT ON COLUMN user_lemma_progress.due_date IS 'FSRS: When card should be reviewed. NULL = new card.';
COMMENT ON COLUMN user_lemma_progress.fsrs_state IS 'FSRS state: 0=New, 1=Learning, 2=Review, 3=Relearning';
COMMENT ON COLUMN user_lemma_progress.reps IS 'Total number of times this card has been reviewed';
COMMENT ON COLUMN user_lemma_progress.lapses IS 'Number of times user pressed Again (forgot)';
COMMENT ON COLUMN user_lemma_progress.last_seen_at IS 'Last exposure (review OR oversampling)';
```

> **Note:** There is no `introduced` column. To determine if a card has been introduced, check `reps >= 1`.

**FSRS State Values:**

| State | Value | Description |
|-------|-------|-------------|
| New | 0 | Never reviewed |
| Learning | 1 | Just started, short intervals |
| Review | 2 | In regular review cycle |
| Relearning | 3 | Failed, back to short intervals |

**Example (FSRS):**

```json
{
  "user_id": "user-abc",
  "lemma_id": "uuid-1",
  "stability": 14.5,
  "difficulty": 4.2,
  "due_date": "2025-12-27T14:30:00Z",
  "fsrs_state": 2,
  "reps": 8,
  "lapses": 1,
  "last_seen_at": "2025-12-13T14:30:00Z",
  "total_reviews": 8
}
```

---

### user_word_encounters

Tracks which word forms user has encountered and when.

```sql
CREATE TABLE user_word_encounters (
  encounter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
  first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  times_encountered INTEGER DEFAULT 1,
  last_encountered_sentence_id UUID REFERENCES sentences(sentence_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, word_id)
);

COMMENT ON TABLE user_word_encounters IS 'Tracks exposure to specific word forms (vivía, vivió, etc.)';
```

**Purpose:** Supports sentence selection logic ("show most recent sentence with this form").

**Example:**

```json
{
  "encounter_id": "uuid-500",
  "user_id": "user-abc",
  "word_id": "uuid-100", // "vivía" form
  "first_encountered_at": "2025-11-20T10:00:00Z",
  "times_encountered": 5,
  "last_encountered_sentence_id": "ghi-789"
}
```

---

### user_chapter_progress

Tracks chapter unlock status and progress.

```sql
CREATE TABLE user_chapter_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  
  -- Unlock status
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  
  -- Progress metrics (computed)
  unique_lemmas_in_chapter INTEGER DEFAULT 0, -- Total distinct lemmas in this chapter
  lemmas_encountered INTEGER DEFAULT 0, -- How many user has seen
  encounter_percentage DECIMAL(5,2) DEFAULT 0, -- lemmas_encountered / unique_lemmas_in_chapter
  
  ready_to_unlock_next BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, chapter_id)
);

COMMENT ON COLUMN user_chapter_progress.encounter_percentage IS 'Must reach 100% (1.00) to unlock next chapter';
```

**Chapter unlock logic:**
```sql
-- User can unlock next chapter when:
WHERE encounter_percentage >= 1.0
```

---

## USER MANAGEMENT TABLES

### user_profiles

Extended user information beyond Supabase auth.

```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  native_language TEXT DEFAULT 'en', -- User's native language
  target_languages TEXT[] DEFAULT '{}', -- Languages they're learning ['es', 'fr']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### user_settings

User preferences for learning experience.

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal_words INTEGER DEFAULT 100,
  cards_per_session INTEGER DEFAULT 25,
  default_package VARCHAR(20) DEFAULT 'standard', -- foundation/standard/immersion/mastery
  active_book_id UUID REFERENCES books(book_id),  -- Currently active book
  active_song_id UUID REFERENCES songs(song_id),  -- Currently active song
  allow_explicit_content BOOLEAN DEFAULT FALSE,   -- Show vulgar slang terms
  is_admin BOOLEAN DEFAULT FALSE,                 -- Admin access flag (manually granted)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN user_settings.is_admin IS 'Admin access flag. Only granted manually by super admin.';
```

---

### user_review_history

Append-only log of every review event for accurate activity tracking.

```sql
CREATE TABLE user_review_history (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_id UUID,                                        -- Legacy - nullable for new records
  lemma_id UUID REFERENCES lemmas(lemma_id),           -- FK to lemmas (NULL if phrase review)
  phrase_id UUID REFERENCES phrases(phrase_id),        -- FK to phrases (NULL if lemma review)
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),               -- When the review occurred
  difficulty VARCHAR(20),                              -- User's response (again/hard/got-it)
  review_context TEXT,                                 -- Optional context
  response_time_ms INTEGER,                            -- Optional response time
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Exactly one of lemma_id or phrase_id must be set (for new records)
  CONSTRAINT chk_review_item CHECK (
    (lemma_id IS NOT NULL AND phrase_id IS NULL) OR
    (lemma_id IS NULL AND phrase_id IS NOT NULL) OR
    (lemma_id IS NULL AND phrase_id IS NULL AND vocab_id IS NOT NULL)
  )
);

-- Indexes for efficient activity queries
CREATE INDEX idx_review_history_user_lemma_date
  ON user_review_history(user_id, reviewed_at DESC, lemma_id)
  WHERE lemma_id IS NOT NULL;

CREATE INDEX idx_review_history_user_phrase_date
  ON user_review_history(user_id, reviewed_at DESC, phrase_id)
  WHERE phrase_id IS NOT NULL;

-- RLS Policies
ALTER TABLE user_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own review history" ON user_review_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own review history" ON user_review_history
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE user_review_history IS 'Append-only log for activity tracking - do not update, only insert';
```

**Purpose:** Provides accurate activity tracking by logging every review event. Unlike `last_seen_at` which overwrites, this preserves full history.

**Key Constraints:**
- Exactly one of `lemma_id` or `phrase_id` must be set (for new records)
- Legacy records may have only `vocab_id` set

**Query Pattern:**
```sql
-- Get unique cards reviewed per day
SELECT
  DATE(reviewed_at) as review_date,
  COUNT(DISTINCT lemma_id) + COUNT(DISTINCT phrase_id) as unique_cards
FROM user_review_history
WHERE user_id = ?
  AND (lemma_id IS NOT NULL OR phrase_id IS NOT NULL)
  AND reviewed_at >= NOW() - INTERVAL '35 days'
GROUP BY DATE(reviewed_at);
```

---

### user_daily_stats

Daily activity tracking.

```sql
CREATE TABLE user_daily_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,

  -- Activity counts
  words_reviewed INTEGER DEFAULT 0,
  new_words_learned INTEGER DEFAULT 0,
  time_spent_minutes INTEGER DEFAULT 0,
  sentences_read INTEGER DEFAULT 0,

  -- Streak tracking
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  longest_streak_start DATE,
  longest_streak_end DATE,
  total_active_days INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, review_date)
);
```

---

## LYRICS TABLES (POC)

These tables support lyrics-based vocabulary learning. See **32_LYRICS_DATABASE_SPEC.md** for full specification.

### songs

Primary content container for a song.

```sql
CREATE TABLE songs (
  song_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  release_year INTEGER,
  difficulty TEXT NOT NULL DEFAULT 'intermediate',  -- 'beginner', 'intermediate', 'advanced'
  dialect TEXT,                                      -- "Puerto Rican Spanish"
  themes TEXT[],                                     -- ARRAY['nostalgia', 'memory', 'home']
  total_sections INTEGER DEFAULT 0,
  total_lines INTEGER DEFAULT 0,
  unique_lemmas INTEGER DEFAULT 0,
  unique_slang_terms INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### song_sections

Structural divisions within a song (verse, chorus, bridge, etc.).

```sql
CREATE TABLE song_sections (
  section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,             -- 'intro', 'verse', 'chorus', 'bridge', 'outro'
  section_order INTEGER NOT NULL,
  section_label TEXT,
  is_skippable BOOLEAN DEFAULT FALSE,
  repeat_of_section_id UUID REFERENCES song_sections(section_id),
  total_lines INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, section_order)
);
```

### song_lines

Individual lines of lyrics with translations.

```sql
CREATE TABLE song_lines (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES song_sections(section_id) ON DELETE CASCADE,
  line_order INTEGER NOT NULL,
  line_text TEXT NOT NULL,
  translation TEXT NOT NULL,
  grammar_note TEXT,
  cultural_note TEXT,
  is_skippable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, line_order)
);
```

### slang_terms

Non-standard vocabulary with cultural context (parallel to lemmas table).

```sql
CREATE TABLE slang_terms (
  slang_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  standard_equivalent TEXT,
  region TEXT,
  part_of_speech TEXT,
  cultural_note TEXT,
  usage_note TEXT,
  formality TEXT DEFAULT 'informal',      -- 'informal', 'vulgar', 'neutral'
  example_spanish TEXT,
  example_english TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(term, region)
);
```

### song_slang

Junction table linking slang terms to songs.

```sql
CREATE TABLE song_slang (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,
  PRIMARY KEY (song_id, slang_id)
);
```

### song_lemmas

Junction table linking standard lemmas to songs.

```sql
CREATE TABLE song_lemmas (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,
  PRIMARY KEY (song_id, lemma_id)
);
```

### song_phrases

Junction table linking standard phrases to songs. Enables unified vocabulary tracking - if a phrase appears in both books and songs, user learns it once.

```sql
CREATE TABLE song_phrases (
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,
  first_line_id UUID REFERENCES song_lines(line_id),
  occurrence_count INTEGER DEFAULT 1,
  PRIMARY KEY (song_id, phrase_id)
);
```

### user_slang_progress

FSRS-scheduled progress on slang vocabulary.

```sql
CREATE TABLE user_slang_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slang_id UUID NOT NULL REFERENCES slang_terms(slang_id) ON DELETE CASCADE,
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  is_introduced BOOLEAN DEFAULT FALSE,
  introduced_at TIMESTAMPTZ,
  first_seen_song_id UUID REFERENCES songs(song_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, slang_id)
);
```

### user_line_progress

FSRS-scheduled progress on line comprehension.

```sql
CREATE TABLE user_line_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES song_lines(line_id) ON DELETE CASCADE,
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  last_score REAL,
  best_score REAL,
  times_completed INTEGER DEFAULT 0,
  first_seen_in TEXT DEFAULT 'study',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, line_id)
);
```

### user_song_progress

Overall song learning progress.

```sql
CREATE TABLE user_song_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
  current_section_order INTEGER DEFAULT 1,
  current_line_order INTEGER DEFAULT 1,
  furthest_line_reached INTEGER DEFAULT 1,
  vocab_complete BOOLEAN DEFAULT FALSE,
  study_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  total_lines INTEGER,
  lines_completed INTEGER DEFAULT 0,
  slang_introduced INTEGER DEFAULT 0,
  slang_total INTEGER,
  lemmas_introduced INTEGER DEFAULT 0,
  lemmas_total INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);
```

### Lyrics Indexes

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
CREATE INDEX idx_song_phrases_song ON song_phrases(song_id);

-- User progress
CREATE INDEX idx_slang_progress_due ON user_slang_progress(user_id, due_date);
CREATE INDEX idx_slang_progress_state ON user_slang_progress(user_id, fsrs_state);
CREATE INDEX idx_line_progress_due ON user_line_progress(user_id, due_date);
CREATE INDEX idx_line_progress_state ON user_line_progress(user_id, fsrs_state);
```

---

## COMPLETE SQL DEFINITIONS

### Full Schema Creation Script

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTENT TABLES
-- ============================================

CREATE TABLE books (
  book_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  language_code TEXT NOT NULL,
  total_chapters INTEGER NOT NULL,
  total_sentences INTEGER NOT NULL,
  cover_image_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chapters (
  chapter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  planet_name TEXT,
  planet_description TEXT,
  illustration_url TEXT,
  total_sentences_in_chapter INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, chapter_number)
);

CREATE TABLE sentences (
  sentence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_order INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  sentence_translation TEXT NOT NULL,
  narrative_context TEXT,
  speaker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, sentence_order)
);

-- ============================================
-- VOCABULARY TABLES
-- ============================================

CREATE TABLE lemmas (
  lemma_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lemma_text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  part_of_speech TEXT,
  gender TEXT CHECK (gender IN ('M', 'F', NULL)),
  definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_stop_word BOOLEAN DEFAULT FALSE,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lemma_text, language_code)
);

CREATE TABLE words (
  word_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_text TEXT NOT NULL,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL,
  grammatical_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sentence_id, word_position)
);

-- ============================================
-- USER PROGRESS TABLES
-- ============================================

CREATE TABLE user_lemma_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  last_correct_review_at TIMESTAMPTZ,
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  last_reviewed_at TIMESTAMPTZ,
  total_reviews INTEGER DEFAULT 0,
  correct_reviews INTEGER DEFAULT 0,
  review_due DATE,
  failed_in_last_3_sessions BOOLEAN DEFAULT FALSE,
  review_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, lemma_id)
);

CREATE TABLE user_word_encounters (
  encounter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
  first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
  times_encountered INTEGER DEFAULT 1,
  last_encountered_sentence_id UUID REFERENCES sentences(sentence_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE TABLE user_chapter_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  unique_lemmas_in_chapter INTEGER DEFAULT 0,
  lemmas_encountered INTEGER DEFAULT 0,
  encounter_percentage DECIMAL(5,2) DEFAULT 0,
  ready_to_unlock_next BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);

-- ============================================
-- USER MANAGEMENT TABLES
-- ============================================

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  native_language TEXT DEFAULT 'en',
  target_languages TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal_words INTEGER DEFAULT 100,
  cards_per_session INTEGER DEFAULT 25,
  default_package VARCHAR(20) DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_daily_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  words_reviewed INTEGER DEFAULT 0,
  new_words_learned INTEGER DEFAULT 0,
  time_spent_minutes INTEGER DEFAULT 0,
  sentences_read INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  longest_streak_start DATE,
  longest_streak_end DATE,
  total_active_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, review_date)
);
```

---

## RPC FUNCTIONS

Server-side RPC functions for efficient querying with filters and pagination.

### Progress RPC Functions

```sql
-- Book-level progress with vocabulary mastery
get_book_progress(p_user_id UUID, p_book_id UUID)
RETURNS: due_count, new_count, mastered, familiar, learning, not_seen,
         total_vocab, unlocked_chapters[], current_chapter, total_chapters

-- Song-level progress with vocabulary mastery
get_song_progress(p_user_id UUID, p_song_id UUID)
RETURNS: due_count, new_count, mastered, familiar, learning, not_seen,
         total_vocab, sections

-- Per-chapter progress breakdown
get_book_chapters_progress(p_user_id UUID, p_book_id UUID)
RETURNS: chapter_number, title, total_vocab, mastered, familiar,
         learning, not_seen, is_unlocked
```

### Admin Search RPC Functions

```sql
-- Paginated lemma search with server-side filtering
search_lemmas(
  p_search TEXT DEFAULT '',
  p_pos TEXT DEFAULT 'all',
  p_stop_words TEXT DEFAULT 'all',
  p_reviewed TEXT DEFAULT 'all',
  p_chapter_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'frequency',
  p_sort_order TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS: lemma_id, lemma_text, definitions, part_of_speech, gender,
         is_stop_word, is_reviewed, frequency, total_count

-- Paginated phrase search with server-side filtering
search_phrases(
  p_search TEXT DEFAULT '',
  p_type TEXT DEFAULT 'all',
  p_reviewed TEXT DEFAULT 'all',
  p_chapter_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'alphabetical',
  p_sort_order TEXT DEFAULT 'asc',
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS: phrase_id, phrase_text, definitions, phrase_type,
         is_reviewed, occurrence_count, total_count
```

### Chapter Unlock RPC Functions

```sql
-- Get user's introduced vocabulary counts per chapter (for unlock calculations)
get_user_chapter_progress(p_user_id UUID)
RETURNS: chapter_id, introduced_lemmas, introduced_phrases

-- Refresh pre-computed vocabulary stats for a chapter (after content changes)
refresh_chapter_vocabulary_stats(p_chapter_id UUID)
RETURNS: void (updates chapter_vocabulary_stats table)
```

**Purpose:** These functions power the optimized chapter unlock calculation:
- `get_user_chapter_progress`: Returns how many lemmas/phrases the user has introduced per chapter (server-side counting, no URL length limits)
- `refresh_chapter_vocabulary_stats`: Updates cached totals after import or admin changes

**Performance:** Reduced chapter unlock calculation from 61 API calls (57s) to 3 API calls (<2s).

**Migration Files:**
- `supabase/migrations/20251228_progress_rpc_functions.sql`
- `supabase/migrations/20251229_book_chapters_progress.sql`
- `supabase/migrations/20251229_search_lemmas_rpc.sql`
- `supabase/migrations/20251230_search_phrases_rpc.sql`
- `supabase/migrations/20251230_chapter_vocabulary_stats.sql`
- `supabase/migrations/20251230_get_user_chapter_progress.sql`

---

## INDEXES & PERFORMANCE

### Critical Indexes for Common Queries

```sql
-- ============================================
-- CONTENT INDEXES
-- ============================================

CREATE INDEX idx_chapters_book ON chapters(book_id);
CREATE INDEX idx_sentences_chapter ON sentences(chapter_id);
CREATE INDEX idx_sentences_order ON sentences(chapter_id, sentence_order);

-- ============================================
-- VOCABULARY INDEXES
-- ============================================

CREATE INDEX idx_lemmas_language ON lemmas(language_code);
CREATE INDEX idx_lemmas_pos ON lemmas(part_of_speech);
CREATE INDEX idx_lemmas_stop_word ON lemmas(is_stop_word);

CREATE INDEX idx_words_lemma ON words(lemma_id);
CREATE INDEX idx_words_sentence ON words(sentence_id);
CREATE INDEX idx_words_chapter ON words(chapter_id);
CREATE INDEX idx_words_book ON words(book_id);

-- ============================================
-- USER PROGRESS INDEXES
-- ============================================

CREATE INDEX idx_user_progress_health ON user_lemma_progress(user_id, health);
CREATE INDEX idx_user_progress_mastery ON user_lemma_progress(user_id, mastery_level);
CREATE INDEX idx_user_progress_review_due ON user_lemma_progress(user_id, review_due);
CREATE INDEX idx_user_progress_last_reviewed ON user_lemma_progress(user_id, last_reviewed_at);

CREATE INDEX idx_user_encounters_user_word ON user_word_encounters(user_id, word_id);
CREATE INDEX idx_user_encounters_times ON user_word_encounters(user_id, times_encountered DESC);

CREATE INDEX idx_user_chapter_progress_unlocked ON user_chapter_progress(user_id, is_unlocked);
CREATE INDEX idx_user_chapter_progress_ready ON user_chapter_progress(user_id, ready_to_unlock_next);

CREATE INDEX idx_daily_stats_date ON user_daily_stats(user_id, review_date DESC);
CREATE INDEX idx_daily_stats_streak ON user_daily_stats(user_id, current_streak DESC);
```

### Query Performance Notes

**Fast Queries (Using Indexes):**
- Find user's due words: `WHERE user_id = X AND review_due <= today`
- Find low health words: `WHERE user_id = X AND health < 20`
- Get chapter sentences: `WHERE chapter_id = X ORDER BY sentence_order`
- Find lemma by text: `WHERE lemma_text = 'vivir' AND language_code = 'es'`

**Slow Queries (Needs Optimization):**
- Count distinct lemmas per chapter (requires aggregation)
- Find all forms of a lemma across all chapters (large join)

---

## DESIGN RATIONALE

### Why This Schema vs Old Schema?

**Old Schema Problems:**
1. Three separate vocabulary systems (vocabulary, vocabulary_forms, vocabulary_lemmas)
2. Unclear relationships between tables
3. Redundant data (vocab_id AND form_id in occurrences)
4. Users tracked progress on word forms, not lemmas (deck flooding)

**New Schema Solutions:**
1. Two simple tables: `lemmas` (canonical) + `words` (instances)
2. Clear hierarchy: words → lemmas → definitions
3. No redundancy: each relationship has purpose
4. Users track lemma mastery (one flashcard per concept)

---

### How This Prevents Verb Form Flooding

**Problem:** "vivir" has 50 conjugations (vivía, vivió, vivo, etc.)

**Old approach:**
- User sees flashcard for "vivía"
- User sees flashcard for "vivió"
- User sees flashcard for "vivo"
- Result: 50 flashcards for one verb

**New approach:**
```sql
-- Flashcard query selects distinct lemmas
SELECT DISTINCT ON (ulp.lemma_id)
  l.lemma_text, -- "vivir"
  l.definitions, -- ["to live"]
  ulp.health,
  ulp.mastery_level,
  (SELECT w.word_text FROM words w 
   WHERE w.lemma_id = l.lemma_id 
   ORDER BY random() LIMIT 1) as example_form -- "vivía"
FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
WHERE ulp.user_id = :user_id
ORDER BY ulp.health ASC;
```

**Result:** User sees ONE flashcard for "vivir", showing one encountered form as context.

---

### Data Integrity Guarantees

**Cascading Deletes:**
- Delete book → deletes chapters → deletes sentences → deletes words
- Delete lemma → deletes associated words and user progress
- Delete user → deletes all user data (GDPR compliance)

**Unique Constraints:**
- One lemma per (lemma_text, language_code)
- One word per (sentence_id, word_position)
- One chapter per (book_id, chapter_number)
- One user progress record per (user_id, lemma_id)

**Check Constraints:**
- mastery_level: 0-100
- health: 0-100
- gender: M/F/NULL

---

## QUICK REFERENCE

### Table Summary

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| books | Book metadata | title, author, language_code |
| chapters | Chapter divisions | chapter_number, title |
| sentences | Text + translations | sentence_text, sentence_translation |
| lemmas | Canonical forms | lemma_text, definitions, part_of_speech |
| words | Word instances | word_text, lemma_id, sentence_id |
| phrases | Idiomatic expressions | phrase_text, definitions, phrase_type |
| phrase_occurrences | Phrase locations | phrase_id, sentence_id, chapter_id, start_position |
| chapter_vocabulary_stats | Cached vocab totals | chapter_id, total_lemmas, total_phrases |
| validation_reports | AI quality checks | is_valid, issues, suggested_fixes |
| user_lemma_progress | Mastery tracking | mastery_level, health |
| user_word_encounters | Form exposure | times_encountered, last_encountered_sentence_id |
| user_chapter_progress | Chapter unlocks | encounter_percentage, is_unlocked |
| **Lyrics Tables** | | |
| songs | Song metadata | title, artist, dialect, themes |
| song_sections | Verse/chorus/bridge | section_type, section_order |
| song_lines | Lyric lines + translations | line_text, translation |
| slang_terms | Non-standard vocabulary | term, definition, region |
| song_slang | Slang ↔ song links | song_id, slang_id |
| song_lemmas | Standard vocab ↔ song links | song_id, lemma_id |
| song_phrases | Standard phrases ↔ song links | song_id, phrase_id |
| user_slang_progress | FSRS slang progress | stability, due_date, fsrs_state |
| user_line_progress | FSRS line progress | stability, due_date, last_score |
| user_song_progress | Song learning progress | vocab_complete, study_complete |

### Common Queries

```sql
-- Get all words in a sentence with lemmas
SELECT w.word_text, w.word_position, l.lemma_text, l.definitions
FROM words w
JOIN lemmas l ON w.lemma_id = l.lemma_id
WHERE w.sentence_id = :sentence_id
ORDER BY w.word_position;

-- Get user's due flashcards
SELECT l.lemma_text, l.definitions, ulp.health, ulp.mastery_level
FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
WHERE ulp.user_id = :user_id
  AND ulp.review_due <= CURRENT_DATE
ORDER BY ulp.health ASC
LIMIT 25;

-- Check chapter unlock eligibility
SELECT 
  ucp.encounter_percentage,
  ucp.is_unlocked,
  CASE WHEN ucp.encounter_percentage >= 1.0 THEN true ELSE false END as can_unlock
FROM user_chapter_progress ucp
WHERE ucp.user_id = :user_id AND ucp.chapter_id = :chapter_id;
```

---

## RPC FUNCTIONS (Progress Service)

Server-side PostgreSQL functions for efficient progress queries. These solve 431 Request Header Fields Too Large errors caused by large `.in()` clauses.

### get_book_progress(p_user_id UUID, p_book_id UUID)

Returns comprehensive progress stats for a book. Used by BookDashboard and ActiveContentCards.

```sql
-- Returns: TABLE (
--   due_count INTEGER,
--   new_count INTEGER,
--   mastered INTEGER,
--   familiar INTEGER,
--   learning INTEGER,
--   not_seen INTEGER,
--   total_vocab INTEGER,
--   unlocked_chapters INTEGER[],
--   current_chapter INTEGER,
--   total_chapters INTEGER
-- )

-- FSRS-based mastery thresholds:
-- Mastered: fsrs_state = 2 AND stability >= 21
-- Familiar: fsrs_state = 2 AND stability >= 7 AND stability < 21
-- Learning: reps >= 1 AND NOT (fsrs_state = 2 AND stability >= 7)
-- Not Seen: reps = 0 OR no progress record
```

Migration: `supabase/migrations/20251228_progress_rpc_functions.sql`

### get_song_progress(p_user_id UUID, p_song_id UUID)

Returns progress stats for a song's vocabulary. Used by SongDashboard and ActiveContentCards.

```sql
-- Returns: TABLE (
--   due_count INTEGER,
--   new_count INTEGER,
--   mastered INTEGER,
--   familiar INTEGER,
--   learning INTEGER,
--   not_seen INTEGER,
--   total_vocab INTEGER,
--   sections INTEGER
-- )
```

Migration: `supabase/migrations/20251228_progress_rpc_functions.sql`

### get_book_chapters_progress(p_user_id UUID, p_book_id UUID)

Returns per-chapter progress for BookDashboard's ChapterCarousel.

```sql
-- Returns: TABLE (
--   chapter_number INTEGER,
--   title TEXT,
--   total_vocab INTEGER,      -- Lemmas + phrases combined
--   mastered INTEGER,
--   familiar INTEGER,
--   learning INTEGER,
--   not_seen INTEGER,
--   is_unlocked BOOLEAN       -- Based on 95% introduction threshold
-- )
```

Migration: `supabase/migrations/20251229_book_chapters_progress.sql`

### Usage from JavaScript

```javascript
import { supabase } from '../lib/supabase'

// Call RPC function
const { data, error } = await supabase.rpc('get_book_progress', {
  p_user_id: userId,
  p_book_id: bookId
})

// Returns: { due_count, new_count, mastered, familiar, learning, not_seen, ... }
```

---

## RLS POLICIES (Admin Suite)

The following Row Level Security policies enable admin CRUD operations:

### Lemmas

```sql
-- Allow authenticated users to insert lemmas
CREATE POLICY "Allow insert for authenticated" ON lemmas
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update lemmas
CREATE POLICY "Allow update for authenticated" ON lemmas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to delete lemmas
CREATE POLICY "Allow delete for authenticated" ON lemmas
  FOR DELETE TO authenticated USING (true);
```

### Phrases

```sql
-- Allow authenticated users full access to phrases
CREATE POLICY "Allow select for authenticated" ON phrases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON phrases
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON phrases
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated" ON phrases
  FOR DELETE TO authenticated USING (true);
```

### Phrase Occurrences

```sql
-- Allow authenticated users full access to phrase_occurrences
CREATE POLICY "Allow select for authenticated" ON phrase_occurrences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON phrase_occurrences
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON phrase_occurrences
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete for authenticated" ON phrase_occurrences
  FOR DELETE TO authenticated USING (true);
```

### CASCADE Delete Constraints

These foreign key constraints ensure referential integrity when deleting lemmas or phrases:

```sql
-- user_review_history: CASCADE delete when lemma/phrase is deleted
ALTER TABLE user_review_history
  DROP CONSTRAINT IF EXISTS user_review_history_lemma_id_fkey,
  ADD CONSTRAINT user_review_history_lemma_id_fkey
    FOREIGN KEY (lemma_id) REFERENCES lemmas(lemma_id) ON DELETE CASCADE;

ALTER TABLE user_review_history
  DROP CONSTRAINT IF EXISTS user_review_history_phrase_id_fkey,
  ADD CONSTRAINT user_review_history_phrase_id_fkey
    FOREIGN KEY (phrase_id) REFERENCES phrases(phrase_id) ON DELETE CASCADE;

-- phrase_occurrences: CASCADE delete when phrase is deleted
ALTER TABLE phrase_occurrences
  DROP CONSTRAINT IF EXISTS phrase_occurrences_phrase_id_fkey,
  ADD CONSTRAINT phrase_occurrences_phrase_id_fkey
    FOREIGN KEY (phrase_id) REFERENCES phrases(phrase_id) ON DELETE CASCADE;

-- user_phrase_progress: CASCADE delete when phrase is deleted
ALTER TABLE user_phrase_progress
  DROP CONSTRAINT IF EXISTS user_phrase_progress_phrase_id_fkey,
  ADD CONSTRAINT user_phrase_progress_phrase_id_fkey
    FOREIGN KEY (phrase_id) REFERENCES phrases(phrase_id) ON DELETE CASCADE;
```

---

## RELATED DOCUMENTS

- See **03_CONTENT_PIPELINE.md** for how data flows into these tables
- See **21_MIGRATION_PLAN.md** for migrating from old schema
- See **22_ADMIN_DASHBOARD.md** for editing lemmas and words
- See **04_LEARNING_ALGORITHM.md** for how progress tables are used

---

## REVISION HISTORY

- 2025-12-30: **Chapter Unlock Performance Optimization** - Added chapter_id column to phrase_occurrences (NOT NULL, with index), created chapter_vocabulary_stats table for cached vocab totals, added get_user_chapter_progress and refresh_chapter_vocabulary_stats RPC functions. Reduced chapter unlock calculation from 61 API calls to 3. (Claude)
- 2025-12-29: **RPC Functions** - Added section documenting get_book_progress, get_song_progress, get_book_chapters_progress server-side functions for efficient progress queries (Claude)
- 2025-12-25: **Lyrics Database POC** - Added 10 new tables for lyrics-based learning: songs, song_sections, song_lines, slang_terms, song_slang, song_lemmas, song_phrases, user_slang_progress, user_line_progress, user_song_progress (Claude)
- 2025-12-24: **Admin Suite Phase 2** - Added is_reviewed/reviewed_at to lemmas, sentences, phrases; made words.lemma_id nullable for orphaned words; added RLS policies section; added CASCADE delete constraints
- 2025-12-13: **Major update** - Added FSRS columns to user_lemma_progress and user_phrase_progress, marked old mastery/health columns as deprecated (Claude)
- 2025-12-12: Updated validation_reports schema to match actual columns (Claude)
- 2025-12-06: Added validation_reports table for AI quality assurance (Claude)
- 2025-11-30: Initial draft (Claude)
- Status: Active

---

**END OF DATABASE SCHEMA**
