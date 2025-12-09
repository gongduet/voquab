# 02_DATABASE_SCHEMA.md

**Last Updated:** December 4, 2025
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
9. [Complete SQL Definitions](#complete-sql-definitions)
10. [Indexes & Performance](#indexes--performance)
11. [Design Rationale](#design-rationale)
12. [Quick Reference](#quick-reference)

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
  admin_notes TEXT, -- Manual notes for tricky words
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(lemma_text, language_code)
);

COMMENT ON COLUMN lemmas.definitions IS 'JSONB array: ["to live", "to reside", "to dwell"]';
COMMENT ON COLUMN lemmas.lemma_text IS 'For verbs: infinitive. For nouns: singular with article (el libro, la casa)';
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
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL, -- Position in sentence (1-indexed)
  grammatical_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sentence_id, word_position)
);

COMMENT ON COLUMN words.grammatical_info IS 'Verb: {tense, person, number}. Noun: {number}. Adj: {gender, number}';
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
  phrase_type TEXT, -- 'idiom', 'collocation', 'compound'
  frequency_rank INTEGER,
  is_reviewed BOOLEAN DEFAULT FALSE, -- Manual approval status
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
  start_position INTEGER, -- Where phrase starts in sentence (0-indexed)
  end_position INTEGER, -- Where phrase ends in sentence (0-indexed)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE phrase_occurrences IS 'Tracks where phrases appear in text';
```

**Purpose:** Track exact locations of phrases within sentences for highlighting and learning context.

---

### user_phrase_progress

Tracks user mastery of phrases (parallel to user_lemma_progress).

```sql
CREATE TABLE user_phrase_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  total_reviews INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  review_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, phrase_id)
);

COMMENT ON TABLE user_phrase_progress IS 'User mastery tracking for idiomatic phrases';
```

**Purpose:** Allow users to study phrases as flashcards alongside individual lemmas.

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
  suggested_fixes JSONB DEFAULT '[]'::jsonb, -- Suggested corrections
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_by TEXT DEFAULT 'ai', -- 'ai' or 'manual'

  UNIQUE(lemma_id)
);

COMMENT ON TABLE validation_reports IS 'AI-generated validation results for lemma quality assurance';
COMMENT ON COLUMN validation_reports.issues IS 'Array of issues: [{type, description, severity}]';
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
  "suggested_fixes": [
    {
      "action": "merge",
      "target_lemma": "comprar",
      "reason": "conjugated form should be merged to infinitive"
    }
  ],
  "validated_at": "2025-12-06T10:30:00Z",
  "validated_by": "ai"
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

Tracks user's mastery and health for each lemma.

```sql
CREATE TABLE user_lemma_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  
  -- Mastery tracking
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  last_correct_review_at TIMESTAMPTZ,
  
  -- Health tracking
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  last_reviewed_at TIMESTAMPTZ,
  
  -- Review counts
  total_reviews INTEGER DEFAULT 0,
  correct_reviews INTEGER DEFAULT 0,
  
  -- Spaced repetition
  review_due DATE,
  
  -- Struggling word detection
  failed_in_last_3_sessions BOOLEAN DEFAULT FALSE,
  
  -- Review history (last 20 reviews)
  review_history JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, lemma_id)
);

COMMENT ON COLUMN user_lemma_progress.health IS 'Starts at 0 for new words, increases with reviews, decays over time';
COMMENT ON COLUMN user_lemma_progress.review_history IS 'Array of last 20 reviews: [{date, difficulty, mastery_before, mastery_after}]';
```

**Example:**

```json
{
  "user_id": "user-abc",
  "lemma_id": "uuid-1", // "vivir"
  "mastery_level": 45,
  "health": 70,
  "total_reviews": 12,
  "correct_reviews": 9,
  "last_reviewed_at": "2025-11-30T14:30:00Z",
  "review_due": "2025-12-03",
  "failed_in_last_3_sessions": false
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
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
| phrase_occurrences | Phrase locations | phrase_id, sentence_id, start_position |
| validation_reports | AI quality checks | is_valid, issues, suggested_fixes |
| user_lemma_progress | Mastery tracking | mastery_level, health |
| user_word_encounters | Form exposure | times_encountered, last_encountered_sentence_id |
| user_chapter_progress | Chapter unlocks | encounter_percentage, is_unlocked |

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

## RELATED DOCUMENTS

- See **03_CONTENT_PIPELINE.md** for how data flows into these tables
- See **21_MIGRATION_PLAN.md** for migrating from old schema
- See **22_ADMIN_DASHBOARD.md** for editing lemmas and words
- See **04_LEARNING_ALGORITHM.md** for how progress tables are used

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- 2025-12-06: Added validation_reports table for AI quality assurance (Claude)
- Status: Active

---

**END OF DATABASE SCHEMA**
