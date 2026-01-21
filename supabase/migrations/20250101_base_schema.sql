-- Base Schema Migration
-- Created: 2025-01-01 (backdated to come before all other migrations)
-- Purpose: Create all foundational tables for Voquab
-- Note: These tables were originally created directly in production.
--       This migration file enables Supabase branching to work correctly.

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTENT TABLES
-- ============================================

-- Books table
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

COMMENT ON TABLE books IS 'Book metadata for El Principito and future books';

-- Chapters table
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

COMMENT ON TABLE chapters IS 'Chapter divisions within books';

-- Sentences table
CREATE TABLE sentences (
  sentence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_order INTEGER NOT NULL,
  sentence_text TEXT NOT NULL,
  sentence_translation TEXT NOT NULL DEFAULT '',
  narrative_context TEXT,
  speaker TEXT,
  is_paragraph_start BOOLEAN DEFAULT FALSE,
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(chapter_id, sentence_order)
);

COMMENT ON TABLE sentences IS 'Individual sentences with translations';

-- ============================================
-- VOCABULARY TABLES
-- ============================================

-- Lemmas table (canonical dictionary entries)
CREATE TABLE lemmas (
  lemma_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lemma_text TEXT NOT NULL,
  language_code TEXT NOT NULL,
  part_of_speech TEXT,
  gender TEXT CHECK (gender IN ('M', 'F', NULL)),
  definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_stop_word BOOLEAN DEFAULT FALSE,
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lemma_text, language_code)
);

COMMENT ON TABLE lemmas IS 'Canonical dictionary entries - one per unique lemma';
COMMENT ON COLUMN lemmas.definitions IS 'JSONB array: ["to live", "to reside", "to dwell"]';
COMMENT ON COLUMN lemmas.lemma_text IS 'For verbs: infinitive. For nouns: singular with article (el libro, la casa)';

-- Words table (instances in text)
CREATE TABLE words (
  word_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word_text TEXT NOT NULL,
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE SET NULL,
  book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL,
  grammatical_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sentence_id, word_position)
);

COMMENT ON TABLE words IS 'Individual word instances as they appear in sentences';
COMMENT ON COLUMN words.lemma_id IS 'Nullable - words with NULL lemma_id are orphaned and need reassignment';

-- ============================================
-- PHRASE TABLES
-- ============================================

-- Phrases table
CREATE TABLE phrases (
  phrase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phrase_text TEXT NOT NULL UNIQUE,
  definitions JSONB DEFAULT '[]'::jsonb,
  component_lemmas UUID[],
  phrase_type TEXT,
  frequency_rank INTEGER,
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE phrases IS 'Idiomatic phrases and multi-word expressions';
COMMENT ON COLUMN phrases.phrase_type IS 'idiom: non-literal meaning, collocation: frequently co-occurring, compound: multi-word term';

-- Phrase occurrences table
CREATE TABLE phrase_occurrences (
  occurrence_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  start_position INTEGER,
  end_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE phrase_occurrences IS 'Tracks where phrases appear in text';
COMMENT ON COLUMN phrase_occurrences.chapter_id IS 'Denormalized for efficient chapter unlock calculations';

-- Chapter vocabulary stats (pre-computed)
CREATE TABLE chapter_vocabulary_stats (
  chapter_id UUID PRIMARY KEY REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  total_lemmas INTEGER NOT NULL DEFAULT 0,
  total_phrases INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE chapter_vocabulary_stats IS 'Pre-computed vocabulary counts per chapter for efficient unlock calculations';

-- ============================================
-- SENTENCE COMPREHENSION TABLES
-- ============================================

-- Sentence fragments table
CREATE TABLE sentence_fragments (
  fragment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  fragment_order INTEGER NOT NULL,
  start_word_position INTEGER NOT NULL,
  end_word_position INTEGER NOT NULL,
  fragment_text TEXT NOT NULL,
  fragment_translation TEXT NOT NULL,
  context_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sentence_id, fragment_order)
);

COMMENT ON TABLE sentence_fragments IS 'Meaningful chunks of sentences for reading comprehension practice';
COMMENT ON COLUMN sentence_fragments.context_note IS 'Optional note explaining grammar patterns or idiomatic usage';

-- ============================================
-- VALIDATION TABLES
-- ============================================

-- Validation reports table
CREATE TABLE validation_reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  confidence DECIMAL(5,2),
  issues JSONB DEFAULT '[]'::jsonb,
  suggested_fixes JSONB DEFAULT '{}'::jsonb,
  has_multiple_meanings BOOLEAN DEFAULT FALSE,
  alternative_meanings JSONB DEFAULT '[]'::jsonb,
  validated_at TIMESTAMPTZ,
  reviewed_by_human BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lemma_id)
);

COMMENT ON TABLE validation_reports IS 'AI-generated validation results for lemma quality assurance';

-- ============================================
-- USER PROGRESS TABLES
-- ============================================

-- User lemma progress (FSRS-based)
CREATE TABLE user_lemma_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,

  -- FSRS Scheduling Columns
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,

  -- Legacy columns (deprecated but kept for compatibility)
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  correct_reviews INTEGER DEFAULT 0,
  last_correct_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  review_due DATE,

  -- Active columns
  total_reviews INTEGER DEFAULT 0,
  failed_in_last_3_sessions BOOLEAN DEFAULT FALSE,
  review_history JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, lemma_id)
);

COMMENT ON TABLE user_lemma_progress IS 'FSRS-based progress tracking for lemmas';

-- User phrase progress (FSRS-based)
CREATE TABLE user_phrase_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase_id UUID NOT NULL REFERENCES phrases(phrase_id) ON DELETE CASCADE,

  -- FSRS Scheduling Columns
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,

  -- Legacy columns (deprecated)
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  health INTEGER DEFAULT 0 CHECK (health >= 0 AND health <= 100),
  last_reviewed_at TIMESTAMPTZ,

  -- Active columns
  total_reviews INTEGER DEFAULT 0,
  review_history JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, phrase_id)
);

COMMENT ON TABLE user_phrase_progress IS 'FSRS-based progress tracking for phrases';

-- User sentence progress (FSRS-based)
CREATE TABLE user_sentence_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,

  -- FSRS scheduling columns
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,

  -- Comprehension-specific data
  last_score REAL,
  best_score REAL,
  last_fragment_results JSONB,
  times_completed INTEGER DEFAULT 0,
  first_seen_in TEXT DEFAULT 'reading',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, sentence_id)
);

COMMENT ON TABLE user_sentence_progress IS 'FSRS-based sentence comprehension progress';

-- User word encounters
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

COMMENT ON TABLE user_word_encounters IS 'Tracks exposure to specific word forms';

-- User chapter progress
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

COMMENT ON TABLE user_chapter_progress IS 'Chapter unlock status and progress';

-- ============================================
-- USER MANAGEMENT TABLES
-- ============================================

-- User profiles
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  native_language TEXT DEFAULT 'en',
  target_languages TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal_words INTEGER DEFAULT 100,
  cards_per_session INTEGER DEFAULT 25,
  default_package VARCHAR(20) DEFAULT 'standard',
  active_book_id UUID REFERENCES books(book_id),
  active_song_id UUID,  -- Will reference songs table after lyrics migration
  allow_explicit_content BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN user_settings.is_admin IS 'Admin access flag. Only granted manually by super admin.';

-- User daily stats
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

-- User review history (append-only log)
CREATE TABLE user_review_history (
  review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab_id UUID,
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
  phrase_id UUID REFERENCES phrases(phrase_id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  difficulty VARCHAR(20),
  review_context TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_review_item CHECK (
    (lemma_id IS NOT NULL AND phrase_id IS NULL) OR
    (lemma_id IS NULL AND phrase_id IS NOT NULL) OR
    (lemma_id IS NULL AND phrase_id IS NULL AND vocab_id IS NOT NULL)
  )
);

COMMENT ON TABLE user_review_history IS 'Append-only log for activity tracking - do not update, only insert';

-- ============================================
-- INDEXES
-- ============================================

-- Content indexes
CREATE INDEX idx_chapters_book ON chapters(book_id);
CREATE INDEX idx_sentences_chapter ON sentences(chapter_id);
CREATE INDEX idx_sentences_order ON sentences(chapter_id, sentence_order);

-- Vocabulary indexes
CREATE INDEX idx_lemmas_language ON lemmas(language_code);
CREATE INDEX idx_lemmas_pos ON lemmas(part_of_speech);
CREATE INDEX idx_lemmas_stop_word ON lemmas(is_stop_word);

CREATE INDEX idx_words_lemma ON words(lemma_id);
CREATE INDEX idx_words_sentence ON words(sentence_id);
CREATE INDEX idx_words_chapter ON words(chapter_id);
CREATE INDEX idx_words_book ON words(book_id);

-- Phrase indexes
CREATE INDEX idx_phrase_occurrences_chapter ON phrase_occurrences(chapter_id);
CREATE INDEX idx_phrase_occurrences_sentence ON phrase_occurrences(sentence_id);

-- Sentence fragment indexes
CREATE INDEX idx_fragments_sentence ON sentence_fragments(sentence_id, fragment_order);

-- User progress indexes (FSRS)
CREATE INDEX idx_user_progress_due ON user_lemma_progress(user_id, due_date);
CREATE INDEX idx_user_progress_exposure ON user_lemma_progress(user_id, stability, fsrs_state, last_seen_at);
CREATE INDEX idx_phrase_progress_due ON user_phrase_progress(user_id, due_date);
CREATE INDEX idx_phrase_progress_exposure ON user_phrase_progress(user_id, stability, fsrs_state, last_seen_at);
CREATE INDEX idx_sentence_progress_due ON user_sentence_progress(user_id, due_date);

-- Legacy indexes (kept for compatibility)
CREATE INDEX idx_user_progress_health ON user_lemma_progress(user_id, health);
CREATE INDEX idx_user_progress_mastery ON user_lemma_progress(user_id, mastery_level);
CREATE INDEX idx_user_progress_review_due ON user_lemma_progress(user_id, review_due);
CREATE INDEX idx_user_progress_last_reviewed ON user_lemma_progress(user_id, last_reviewed_at);

-- User encounter indexes
CREATE INDEX idx_user_encounters_user_word ON user_word_encounters(user_id, word_id);
CREATE INDEX idx_user_encounters_times ON user_word_encounters(user_id, times_encountered DESC);

-- User chapter progress indexes
CREATE INDEX idx_user_chapter_progress_unlocked ON user_chapter_progress(user_id, is_unlocked);
CREATE INDEX idx_user_chapter_progress_ready ON user_chapter_progress(user_id, ready_to_unlock_next);

-- Daily stats indexes
CREATE INDEX idx_daily_stats_date ON user_daily_stats(user_id, review_date DESC);
CREATE INDEX idx_daily_stats_streak ON user_daily_stats(user_id, current_streak DESC);

-- Review history indexes
CREATE INDEX idx_review_history_user_lemma_date
  ON user_review_history(user_id, reviewed_at DESC, lemma_id)
  WHERE lemma_id IS NOT NULL;

CREATE INDEX idx_review_history_user_phrase_date
  ON user_review_history(user_id, reviewed_at DESC, phrase_id)
  WHERE phrase_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on user-specific tables
ALTER TABLE user_lemma_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_phrase_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sentence_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_review_history ENABLE ROW LEVEL SECURITY;

-- User can only access their own progress
CREATE POLICY "Users can view own lemma progress" ON user_lemma_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lemma progress" ON user_lemma_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lemma progress" ON user_lemma_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own phrase progress" ON user_phrase_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own phrase progress" ON user_phrase_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own phrase progress" ON user_phrase_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sentence progress" ON user_sentence_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sentence progress" ON user_sentence_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sentence progress" ON user_sentence_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own word encounters" ON user_word_encounters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own word encounters" ON user_word_encounters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own word encounters" ON user_word_encounters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chapter progress" ON user_chapter_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chapter progress" ON user_chapter_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chapter progress" ON user_chapter_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily stats" ON user_daily_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily stats" ON user_daily_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily stats" ON user_daily_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review history" ON user_review_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own review history" ON user_review_history
  FOR SELECT USING (auth.uid() = user_id);

-- Public read access for content tables
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lemmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE phrase_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentence_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON books FOR SELECT USING (true);
CREATE POLICY "Public read access" ON chapters FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sentences FOR SELECT USING (true);
CREATE POLICY "Public read access" ON lemmas FOR SELECT USING (true);
CREATE POLICY "Public read access" ON words FOR SELECT USING (true);
CREATE POLICY "Public read access" ON phrases FOR SELECT USING (true);
CREATE POLICY "Public read access" ON phrase_occurrences FOR SELECT USING (true);
CREATE POLICY "Public read access" ON sentence_fragments FOR SELECT USING (true);

-- Admin write access for content tables (authenticated users for now)
CREATE POLICY "Allow insert for authenticated" ON lemmas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON lemmas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON lemmas
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON phrases
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON phrases
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON phrases
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON phrase_occurrences
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON phrase_occurrences
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON phrase_occurrences
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON sentences
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON sentences
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON sentences
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON words
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON words
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON words
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated" ON sentence_fragments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON sentence_fragments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON sentence_fragments
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- End of Base Schema Migration
-- ============================================
