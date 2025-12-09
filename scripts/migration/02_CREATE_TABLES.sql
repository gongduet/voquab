-- ============================================
-- PHASE 1: CREATE NEW TABLES
-- ============================================
-- Purpose: Create the new schema tables
-- Run AFTER backup is complete
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: Create books table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS books (
    book_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    language_code TEXT NOT NULL,
    total_chapters INTEGER NOT NULL DEFAULT 0,
    total_sentences INTEGER NOT NULL DEFAULT 0,
    cover_image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert El Principito if not exists
INSERT INTO books (book_id, title, author, language_code, total_chapters, total_sentences, description)
SELECT
    uuid_generate_v4(),
    'El Principito',
    'Antoine de Saint-Exupéry',
    'es',
    (SELECT COUNT(*) FROM chapters),
    (SELECT COUNT(*) FROM sentences),
    'Spanish translation of The Little Prince'
WHERE NOT EXISTS (SELECT 1 FROM books WHERE title = 'El Principito');

-- Get the book_id for later use
SELECT book_id, title FROM books;

-- ============================================
-- STEP 2: Add book_id to chapters if missing
-- ============================================
-- Check if book_id column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'chapters' AND column_name = 'book_id';

-- If book_id doesn't exist in chapters, add it:
-- ALTER TABLE chapters ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(book_id);

-- Update chapters to link to the book (run after confirming book exists)
-- UPDATE chapters SET book_id = (SELECT book_id FROM books WHERE title = 'El Principito' LIMIT 1)
-- WHERE book_id IS NULL;

-- ============================================
-- STEP 3: Create lemmas table
-- ============================================
CREATE TABLE IF NOT EXISTS lemmas (
    lemma_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lemma_text TEXT NOT NULL,
    language_code TEXT NOT NULL DEFAULT 'es',
    part_of_speech TEXT,
    gender TEXT CHECK (gender IN ('M', 'F', NULL)),
    definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_stop_word BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lemma_text, language_code)
);

-- Verify creation
SELECT 'lemmas' as table_name, COUNT(*) as rows FROM lemmas;

-- ============================================
-- STEP 4: Create words table
-- ============================================
CREATE TABLE IF NOT EXISTS words (
    word_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word_text TEXT NOT NULL,
    lemma_id UUID NOT NULL REFERENCES lemmas(lemma_id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(book_id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
    sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
    word_position INTEGER NOT NULL DEFAULT 0,
    grammatical_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We'll add the UNIQUE constraint after migration
-- to avoid issues with missing word_position data

-- Verify creation
SELECT 'words' as table_name, COUNT(*) as rows FROM words;

-- ============================================
-- STEP 5: Create user_lemma_progress table
-- ============================================
CREATE TABLE IF NOT EXISTS user_lemma_progress (
    user_id UUID NOT NULL,
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

-- Verify creation
SELECT 'user_lemma_progress' as table_name, COUNT(*) as rows FROM user_lemma_progress;

-- ============================================
-- STEP 6: Create user_word_encounters table
-- ============================================
CREATE TABLE IF NOT EXISTS user_word_encounters (
    encounter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    word_id UUID NOT NULL REFERENCES words(word_id) ON DELETE CASCADE,
    first_encountered_at TIMESTAMPTZ DEFAULT NOW(),
    times_encountered INTEGER DEFAULT 1,
    last_encountered_sentence_id UUID REFERENCES sentences(sentence_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, word_id)
);

-- Verify creation
SELECT 'user_word_encounters' as table_name, COUNT(*) as rows FROM user_word_encounters;

-- ============================================
-- STEP 7: Create user_chapter_progress table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS user_chapter_progress (
    user_id UUID NOT NULL,
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

-- Verify creation
SELECT 'user_chapter_progress' as table_name, COUNT(*) as rows FROM user_chapter_progress;

-- ============================================
-- VERIFICATION: Show all new tables
-- ============================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('books', 'lemmas', 'words', 'user_lemma_progress', 'user_word_encounters', 'user_chapter_progress')
ORDER BY table_name;

-- ============================================
-- PHASE 1 COMPLETE!
-- New tables created (all empty)
-- Proceed to Phase 2: Migrate Lemmas
-- ============================================
