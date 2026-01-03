# 28_CHANGELOG.md

**Document Type:** LIVING DOCUMENT (Updated Continuously)
**Last Updated:** January 3, 2026 (Header/Settings Redesign)
**Maintainer:** Peter + Claude

---

## ABOUT THIS DOCUMENT

This changelog tracks all significant changes to Voquab. It follows [Keep a Changelog](https://keepachangelog.com/) format.

**Categories:**
- **Added:** New features
- **Changed:** Changes to existing features
- **Deprecated:** Features being phased out
- **Removed:** Features that were removed
- **Fixed:** Bug fixes
- **Security:** Security improvements

---

## [Unreleased]

### Foundation Phase (Current)
Working on final polish and testing before MVP launch.

#### In Progress
- Component library build-out
- End-to-end testing

---

## 2026-01-03 - Flashcard FSRS Bug Fixes & UX Improvements

### Overview
Critical bug fixes for the FSRS spaced repetition system and flashcard user experience. These fixes ensure proper scheduling for phrases, correct handling of the "Again" button, and improved visual consistency during card transitions.

### Fixed

#### FSRS Phrase Scheduling
- **Issue:** Phrases were stuck at 2-3 day intervals regardless of how many times reviewed
- **Cause:** `last_reviewed_at` was only being saved for lemmas, not phrases. FSRS needs this timestamp to calculate `elapsed_days` for proper interval scheduling.
- **Fix:** `useProgressTracking.js` now saves `last_reviewed_at` for both lemmas and phrases
- **File:** `src/hooks/flashcard/useProgressTracking.js:147-148`

#### "Again" Button Not Affecting Requeued Cards
- **Issue:** When clicking "Again", the card was requeued but the second review ignored the "Again" click - FSRS calculated intervals based on stale card data
- **Cause:** When a card was requeued, the card object in `cardQueue` retained its old FSRS values. The database was updated correctly, but the in-memory card wasn't.
- **Fix:** After "Again" is clicked, the requeued card in `cardQueue` is now updated with the new FSRS values (reduced stability, increased difficulty, Relearning state)
- **Files:** `src/hooks/flashcard/useProgressTracking.js:199,202`, `src/pages/Flashcards.jsx:73,281-299`

#### Sentences Missing in Review Mode
- **Issue:** Flashcards in "Review Now" mode showed no example sentences, while "Learn New" mode worked correctly
- **Cause:** Review sessions use background sentence loading for fast startup. The `cards` state was updated with sentences, but `cardQueue` (which the UI displays from) was never updated.
- **Fix:** `loadSentencesInBackground()` now updates both `cards` state and `cardQueue` when sentences are loaded
- **File:** `src/pages/Flashcards.jsx:187-195`

#### Partial Word Bolding in Sentences
- **Issue:** Short words like "mi" were being bolded inside other words (e.g., "fa**mi**lia", "a**mi**go")
- **Cause:** The regex for highlighting didn't use word boundaries, matching the pattern anywhere in the sentence
- **Fix:** Added Spanish-aware word boundary detection that checks characters before/after each match, including accented characters (á, é, í, ó, ú, ñ)
- **File:** `src/components/flashcard/FlashcardDisplay.jsx:53-90`

#### Flash of English Translation on Card Advance
- **Issue:** When clicking a rating button while viewing the English side, the next card briefly flashed its English translation before flipping to Spanish
- **Cause:** CSS flip animation (400ms) was animating from 180° back to 0° while the new card's content was already rendered
- **Fix:** Added `key` prop based on card ID to force React to mount a fresh component for each card, eliminating the animation during card changes
- **File:** `src/components/flashcard/FlashcardDisplay.jsx:128`

### Technical Details

#### FSRS State Flow for "Again" Button
When a user clicks "Again" on a card with stability=30:
- `stability`: 30 → 2.32 days (92% reduction)
- `difficulty`: 5 → 8.34 (increased)
- `fsrs_state`: Review (2) → Relearning (3)
- `lapses`: 0 → 1 (incremented)
- `due_date`: Now + 10 minutes

The card is requeued to the end of the session AND its in-memory FSRS values are updated so subsequent reviews use the correct state.

#### Spanish Word Boundary Detection
```javascript
const isSpanishLetter = (char) => /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(char)

// Check boundaries before bolding
const boundaryBefore = !charBefore || !isSpanishLetter(charBefore)
const boundaryAfter = !charAfter || !isSpanishLetter(charAfter)
```

### Files Modified
- `src/hooks/flashcard/useProgressTracking.js` - Phrase scheduling fix, return new FSRS fields
- `src/pages/Flashcards.jsx` - Card queue updates for "Again" and background sentences
- `src/components/flashcard/FlashcardDisplay.jsx` - Word boundary detection, card key for transitions

---

## 2026-01-03 - Header Dropdown & Settings Page Redesign

### Overview
Consolidated header navigation into a user dropdown menu and redesigned the Settings page with a clean Notion-like aesthetic.

### Added

#### UserMenu Dropdown Component
- **New component:** `src/components/dashboard/UserMenu.jsx`
- Replaces separate Settings, Admin, and Avatar buttons with unified dropdown
- Features:
  - User avatar trigger with initial letter
  - User info header (name + active language)
  - Language switcher with inline submenu
  - Settings link
  - Admin link (conditional on isAdmin)
  - Logout button
- Compact Notion-like styling with smaller fonts

#### Multi-Language Support Infrastructure
- **Database:** `languages` table with `language_code`, `language_name`, `flag_emoji`, `is_active`, `display_order`
- **Database:** `active_language` column on `user_settings` table
- Language switching updates `active_language`, `active_book_id`, and resets `active_song_id`
- ContentSwitcher now filters books/songs by user's active language

### Changed

#### DashboardHeader Simplification
- Removed individual Settings, Admin, and Avatar buttons
- Added single UserMenu component
- Cleaner header with logo, content switcher, streak pill, and user menu

#### ContentSwitcher Language Filtering
- Now fetches user's `active_language` from settings
- Filters books and songs to only show content in the active language

#### Settings Page Redesign
- Complete rewrite of `src/pages/Settings.jsx`
- Clean Notion-like aesthetic with white cards and subtle borders
- Three sections:
  - **Account:** Display name (editable), email (read-only)
  - **Learning:** Daily word goal (10-500), cards per session (5-100)
  - **Content:** Explicit content toggle switch
- Manual save button with "Saved" confirmation feedback (2 second display)
- Lucide icons for section headers

### Fixed

#### Streak Pill Centering and Sizing
- **Issue:** Flame icon and streak number weren't centered in the compact pill, and the pill was too small for 2+ digit streaks
- **Fix:** Added `justify-center` for proper centering and dynamic width calculation based on digit count:
  - 1 digit: 52px
  - 2 digits: 64px
  - 3+ digits: 76px
- **File:** `src/components/dashboard/DashboardHeader.jsx:46-52`

### Database Changes Required
```sql
-- Languages table (new)
CREATE TABLE languages (
  language_code TEXT PRIMARY KEY,
  language_name TEXT NOT NULL,
  flag_emoji TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0
);

INSERT INTO languages (language_code, language_name, flag_emoji, display_order)
VALUES ('es', 'Spanish', '🇪🇸', 1);

-- Add active_language to user_settings
ALTER TABLE user_settings
ADD COLUMN active_language TEXT DEFAULT 'es' REFERENCES languages(language_code);
```

### Files Modified/Created
- `src/components/dashboard/UserMenu.jsx` (NEW)
- `src/components/dashboard/DashboardHeader.jsx` - Simplified, uses UserMenu, streak pill fix
- `src/components/dashboard/ContentSwitcher.jsx` - Language filtering
- `src/pages/Settings.jsx` - Complete redesign

---

## 2026-01-02 - Word-Level Vocabulary Architecture Migration

### Overview
Major architecture migration from song-level vocabulary linking (`song_lemmas`) to word-level linking (`song_line_words`). This enables precise word positions for inline highlights and accurate phrase/slang occurrence tracking.

### Added

#### New Database Tables
- **`albums`** - Album-level organization with metadata (title, artist, difficulty, dialect, themes)
- **`song_line_words`** - Word-level vocabulary linking with positions and grammatical info (spaCy)
- **`song_line_phrase_occurrences`** - Tracks phrase positions within lines (start/end word indices)
- **`song_line_slang_occurrences`** - Tracks slang positions within lines (start/end word indices)

#### Backfill Scripts
- **`scripts/backfill_song_line_words.py`** - Tokenizes all song lines into words linked to lemmas
- **`scripts/backfill_phrase_slang_occurrences.py`** - Detects phrase/slang positions with word boundaries

#### Import Pipeline Updates (`scripts/import_lyrics.py`)
- **Phase 7: Extract Words** - Creates `song_line_words` records with spaCy NLP
- **Phase 8: Detect Occurrences** - Creates phrase/slang occurrence records with positions
- Phases renumbered: Fix Translations is now Phase 9

### Changed

#### Updated Database Tables
- **`songs`** - Added `album_id` foreign key (nullable for backward compatibility)
- **`song_lines`** - Added `is_reviewed` and `reviewed_at` columns for QA tracking

### Deprecated
- **`song_lemmas`** - Replaced by `song_line_words` for word-level linking

### Technical Details

#### Backfill Results
- **2,019 word records** created from existing song lines
- **263 new lemmas** auto-created during tokenization
- **14 phrase occurrences** detected
- **61 slang occurrences** detected

#### Word Boundary Matching
Fixed false positive matching (e.g., "Pa" inside "paso", "to" inside "Toca"):
- Regex word boundary matching: `(?:^|[^\w])pattern(?:$|[^\w])`
- Short terms (< 3 chars) require exact word match

#### spaCy Processing
- Uses `es_core_news_sm` model for Spanish NLP
- POS filtering: NOUN, VERB, ADJ, ADV, PROPN
- Lemma formatting: `el/la` + noun based on gender, verbs as infinitive
- Gender detection via spaCy morphology + heuristics

### Files Created
- `supabase/migrations/20260102_create_albums_table.sql`
- `scripts/backfill_song_line_words.py`
- `scripts/backfill_phrase_slang_occurrences.py`

### Files Modified
- `scripts/import_lyrics.py` - Added Phase 7 and Phase 8
- `docs/34_LYRICS_IMPORT_PIPELINE.md` - Updated with new phases
- `docs/32_LYRICS_DATABASE_SPEC.md` - Added new tables, updated schema diagram

### Architecture Benefits
1. **Precise word positions** - Enable inline vocabulary highlights
2. **Per-word grammatical info** - POS, morphology, gender from spaCy
3. **Phrase/slang positions** - Multi-word expression highlighting
4. **Resume capability** - Scripts skip already-processed lines

---

## 2026-01-02 - Bad Bunny "Debí Tirar Más Fotos" Album Import

### Overview
Complete lyrics import pipeline created and executed for Bad Bunny's album "Debí Tirar Más Fotos" - the first full album in the Voquab lyrics learning system.

### Added
- **`scripts/import_lyrics.py`** - 8-phase lyrics import pipeline
- **`docs/34_LYRICS_IMPORT_PIPELINE.md`** - Complete pipeline documentation
- **`scripts/song_mappings.json`** - Song ID mappings for database linking
- **`scripts/vocabulary_analysis.json`** - AI-generated vocabulary analysis
- **`scripts/translation_fixes.json`** - Log of AI translation corrections

### Import Statistics
| Metric | Count |
|--------|-------|
| Songs imported | 17 |
| Total lines | 922 |
| Learnable lines | 909 |
| Skippable (vocalizations) | 13 |
| Slang terms created | 215 |
| Phrases linked | 118 |
| Lemmas linked | 292 |
| Translation fixes | 311 |

### 8-Phase Import Process
1. **Parse** (`--write`) - Extract sections and lines from album text file
2. **Translate** (`--translate`) - Bulk DeepL translation of Spanish lyrics
3. **Flag** (`--flag-skippable`) - Detect vocalizations (oh, eh, yeah, etc.)
4. **Analyze** (`--analyze`) - AI slang/phrase detection with Claude API
5. **Insert Vocab** (`--insert-vocab`) - Create slang_terms, phrases, song links
6. **Extract Lemmas** (`--extract-lemmas`) - spaCy NLP + gender heuristics
7. **Fix Translations** (`--fix-translations`) - AI review and correction pass

### Key Technical Decisions
- **spaCy over API for lemmas**: Faster, free, works offline
- **Heuristic gender detection**: Spanish word endings (95%+ accuracy for common patterns)
- **Incremental saves**: Process one song at a time, commit before next
- **Slang/lemma separation**: Slang terms excluded from lemma extraction to prevent duplicates
- **Phonetic spellings as slang**: Dropped-letter pronunciations (pa', año') stored in slang_terms

### Vocabulary Overlap
- 17.2% of El Principito lemmas appear in Bad Bunny lyrics
- 287 shared lemmas, 5 song-only lemmas created

### Files Changed
- **Database**: songs, song_sections, song_lines, slang_terms, song_slang, song_lemmas, phrases, song_phrases tables populated
- **Documentation**: 32_LYRICS_DATABASE_SPEC.md updated with actual counts

### Lessons Learned
1. **DeepL struggles with PR slang**: Many mistranslations required AI correction pass
2. **Claude API timeouts**: Need retry logic and JSON extraction fallbacks
3. **Gender determination**: spaCy morphology + ending heuristics beats API calls
4. **Phonetic spellings**: 80 of 215 slang terms are dropped-letter pronunciations

---

## 2025-12-30 - AdminRoute Component for Admin Access Control

### Added
- **`src/components/AdminRoute.jsx`** - New route protection component for admin pages

### Changed
- **`src/App.jsx`** - Admin routes now wrapped with `<AdminRoute>` instead of being unprotected
- **`src/pages/Admin.jsx`** - Removed password authentication logic (now handled by AdminRoute)

### Removed (from Admin.jsx)
- Password login screen and form
- `VITE_ADMIN_PASSWORD` environment variable dependency
- `sessionStorage` authentication persistence
- Logout button (users log out via main app)
- `useState`/`useEffect` hooks for auth state

### How AdminRoute Works
1. Checks if user is authenticated (via `useAuth` context)
2. Queries `user_settings.is_admin` for the logged-in user
3. Shows loading spinner while checking both auth and admin status
4. Redirects to `/login` if not authenticated
5. Redirects to `/dashboard` if authenticated but not admin
6. Renders children if user has `is_admin = true`

### Security Model
- **Database**: `user_settings.is_admin` boolean column (manually granted)
- **Client**: `AdminRoute` component for UX protection
- **Server**: RLS policies enforce admin-only operations

### Route Protection Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `ProtectedRoute` | `src/components/ProtectedRoute.jsx` | Auth check only |
| `AdminRoute` | `src/components/AdminRoute.jsx` | Auth + admin flag check |

---

## 2025-12-30 - Chapter Unlock Performance Fix (N+1 Query Elimination)

### Problem
Flashcard session loading was extremely slow (57 seconds) due to N+1 query problem in chapter unlock calculation:
- Old code ran 4 queries per chapter × 27 chapters = 108 sequential API calls
- Each query fetched sentence IDs, then words, then phrases, then user progress
- URL length limit exceeded with 600+ UUIDs in IN clauses (400 Bad Request)
- Fetched all 13K+ words to count per-chapter totals

### Solution
Complete rewrite using server-side RPC and pre-computed stats:

#### Database Changes
1. **Added `chapter_id` to `phrase_occurrences`** (NOT NULL)
   - Denormalized column for direct chapter lookups
   - Index: `idx_phrase_occurrences_chapter`

2. **Created `chapter_vocabulary_stats` table**
   - Pre-computed totals: `total_lemmas` (excluding stop words), `total_phrases`
   - One row per chapter (27 rows vs counting 13K words)

3. **Created `get_user_chapter_progress(p_user_id)` RPC**
   - Returns introduced lemma/phrase counts per chapter
   - Server-side counting eliminates URL length issues

4. **Created `refresh_chapter_vocabulary_stats(p_chapter_id)` RPC**
   - Updates cached totals after content changes
   - Called by import scripts and admin UI

#### Code Changes
- **`src/services/sessionBuilder.js`** - Rewrote `getUnlockedChapterIds()` and `getUnlockedChapters()` to use RPC (3 queries instead of 108)
- **`scripts/import_chapter.py`** - Added `chapter_id` to phrase inserts, calls refresh RPC after import
- **`src/components/admin/AddPhraseModal.jsx`** - Added `chapter_id` to inserts, calls refresh RPC
- **`src/components/admin/PhrasesSection.jsx`** - Now passes `chapterId` prop
- **`src/pages/SentenceDeepDive.jsx`** - Now passes `chapterId` to PhrasesSection

### Performance Results
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls | 61 | ~3 | 95% reduction |
| Load Time | 57s | <2s | 96% faster |
| Data Transfer | 2.6MB | ~50KB | 98% reduction |

### Lessons Learned
1. **N+1 queries are insidious** - Loop with await inside always deserves scrutiny
2. **URL length limits bite** - Large IN clauses should use RPC instead
3. **Denormalize for read performance** - `chapter_id` on phrase_occurrences avoids joins
4. **Pre-compute aggregates** - Stats table beats counting 13K rows every time

### Migration Files
- `supabase/migrations/20251230_phrase_occurrences_chapter_id.sql`
- `supabase/migrations/20251230_chapter_vocabulary_stats.sql`
- `supabase/migrations/20251230_get_user_chapter_progress.sql`
- `supabase/migrations/20251230_refresh_chapter_vocabulary_stats.sql`

---

## 2025-12-30 - Flashcard 4-Button System, Loading UX & Admin Optimizations

### Flashcards
- **4-button FSRS system**: Added Easy button alongside Again/Hard/Got It
- **Tuned FSRS parameters**: 94% retention (more conservative), 5-day hard cap
- **New config file**: `src/config/fsrsConfig.js` for tunable FSRS settings
- **Optimistic UI**: Card transitions are now instant (no waiting for DB)
- **Context-aware navigation**: Returns to correct dashboard (book/song/main)
- **Updated button colors**: Again (#d4806a), Hard (#e5989b), Got It (#5aada4), Easy (#006d77)
- **Session summary**: "Needs Attention" now includes Hard + Again ratings
- **Multiple definitions**: Flashcards now show all definitions comma-separated
- **Floating animation**: Skipped for "Again" (card requeues immediately)

### Loading Screen & Performance
- **Progress indicator**: LoadingScreen now shows progress bar with stage messages
- **4-stage progress tracking**: "Loading your progress..." → "Finding due cards..." → "Loading sentences..." → "Building session..."
- **Background sentence loading**: Sessions start immediately, sentences load in background
- **Deferred sentence loading**: Cards display instantly, sentences appear when ready
- **Exported sentence functions**: `addSentencesToCards` and `addSentencesToPhraseCards` now exported from sessionBuilder

### Admin - Lemmas
- **Copy button**: One-click copy lemma to clipboard
- **Collins dictionary link**: Opens Spanish-English dictionary in new tab
- **Server-side pagination**: 50 lemmas per page (was loading all 1,800+)
- **Server-side filtering**: Search, POS, stop words, reviewed, chapter filters
- **Debounced search**: 300ms delay for better performance
- **Inline definition editing**: Click definition to edit directly (Enter to save, Esc to cancel)
- **New RPC**: `search_lemmas()` for paginated queries

### Admin - Phrases
- **Copy button**: One-click copy phrase to clipboard
- **Server-side pagination**: 50 phrases per page
- **Server-side filtering**: Search, type, reviewed, chapter filters
- **Debounced search**: 300ms delay
- **Inline definition editing**: Click definition to edit directly
- **New RPC**: `search_phrases()` for paginated queries

### Admin Access
- **is_admin flag**: Added to user_settings table
- **Admin header link**: Amber shield icon shows for admin users only
- **Dashboard link**: Added "← Dashboard" link in admin header

### Bug Fixes
- **Streak calculation**: Fixed bug where streak showed 0 if no activity today yet
- **Query history**: Extended from 35 to 70 days for accurate streak calculation

### Database Migrations
- `20251229_search_lemmas_rpc.sql` - Paginated lemma search
- `20251230_search_phrases_rpc.sql` - Paginated phrase search
- `20251230_add_is_admin.sql` - Admin flag for users

### Files Changed
- `src/config/fsrsConfig.js` (new)
- `src/services/fsrsService.js`
- `src/services/sessionBuilder.js` (progress callbacks, skipSentences option, exported functions)
- `src/components/flashcard/DifficultyButtons.jsx`
- `src/components/flashcard/FloatingFeedback.jsx`
- `src/components/flashcard/SessionSummary.jsx`
- `src/components/flashcard/LoadingScreen.jsx` (progress prop, progress bar UI)
- `src/hooks/flashcard/useFlashcardSession.js`
- `src/pages/Flashcards.jsx` (background sentence loading)
- `src/pages/Dashboard.jsx`
- `src/pages/BookDashboard.jsx`
- `src/pages/Admin.jsx`
- `src/pages/AdminCommonWords.jsx`
- `src/pages/AdminPhrases.jsx`
- `src/components/dashboard/DashboardHeader.jsx`

---

## 2025-12-29 - Performance Optimization & Progress Service Architecture

### Added

#### Supabase RPC Functions (Database)
Created server-side RPC functions for efficient progress queries, solving 431 Request Header Fields Too Large errors caused by large `.in()` clauses:

- **`get_book_progress(p_user_id, p_book_id)`** - Comprehensive book stats
  - Returns: due_count, new_count, mastered, familiar, learning, not_seen, total_vocab
  - Also returns: unlocked_chapters[], current_chapter, total_chapters
  - Uses FSRS thresholds: mastered (stability≥21, fsrs_state=2), familiar (7≤stability<21, fsrs_state=2)
  - Migration: `supabase/migrations/20251228_progress_rpc_functions.sql`

- **`get_song_progress(p_user_id, p_song_id)`** - Song vocabulary stats
  - Returns: due_count, new_count, mastered, familiar, learning, not_seen, total_vocab, sections
  - Same FSRS thresholds as book progress
  - Migration: `supabase/migrations/20251228_progress_rpc_functions.sql`

- **`get_book_chapters_progress(p_user_id, p_book_id)`** - Per-chapter progress
  - Returns: chapter_number, title, total_vocab, mastered, familiar, learning, not_seen, is_unlocked
  - Combines lemmas and phrases in all counts
  - Uses 95% introduction threshold for chapter unlocking
  - Migration: `supabase/migrations/20251229_book_chapters_progress.sql`

#### Progress Service (`src/services/progressService.js`)
Single source of truth for progress data across the app:

- `getBookProgress(userId, bookId)` - Calls `get_book_progress` RPC
- `getSongProgress(userId, songId)` - Calls `get_song_progress` RPC
- `getBookChaptersProgress(userId, bookId)` - Calls `get_book_chapters_progress` RPC
- `getGlobalDueCount(userId)` - Counts due items across lemmas and phrases

### Changed

#### Dashboard Query Optimizations
- **`Dashboard.jsx` fetchForecastData**: Reduced from 14 separate COUNT queries to 2 parallel queries that fetch all due_dates and group client-side
- **`Dashboard.jsx`**: Removed all slang-related queries (slang removed from MVP scope)
- **`Dashboard.jsx`**: Now passes `user_settings` (with `active_book_id`, `active_song_id`) as props to `ActiveContentCards` instead of duplicate fetch

#### BookDashboard Rewrite (`src/pages/BookDashboard.jsx`)
Complete rewrite using RPC functions:
- Uses `getBookProgress` and `getBookChaptersProgress` from progressService
- Uses shared dashboard components (`DashboardHeader`, `HeroStats`, `ChapterCarousel`)
- Added back button to navigate to Dashboard
- Added quick action buttons: Review (blue), Learn New (amber), Continue Reading (outline)
- Streak calculation from `user_review_history` (counts consecutive days with activity)

#### ChapterCarousel Improvements (`src/components/dashboard/ChapterCarousel.jsx`)
- Fixed chapter display to center around current chapter (1 before, current, 2 after)
- Fixed `isNextToUnlock` logic to require 95% completion of previous chapter
- Updated `StackedProgressBar` to show gray progress on locked chapters

#### Session Builder Optimizations (`src/services/sessionBuilder.js`)
- **`buildReviewSession()`**: Parallelized all independent queries with `Promise.all`
  - Now fetches: userSettings, lemmaProgress, phraseProgress in parallel
- **`buildReviewSession()`**: Disabled exposure oversampling for MVP
  - Commented out exposure logic with TODO for post-MVP reintroduction
  - Stats hardcoded to `exposureAvailable: 0`, `selectedExposure: 0`

#### Flashcards Fix (`src/pages/Flashcards.jsx`)
- Added `loadingRef` to prevent duplicate `loadSession()` calls from React StrictMode
- Guard clause at start of function, reset in finally block

### Fixed

- **ActiveContentCards.jsx**: Fixed `.toLocaleString()` error on undefined by adding `|| 0` fallback
- **get_book_chapters_progress RPC**: Fixed to include phrases in counts (was only counting lemmas)
- **BookDashboard.jsx**: Fixed `totalLemmas` → `totalVocab` mapping for phrase-inclusive counts

### Technical Details

#### FSRS-Based Mastery Thresholds (used in all RPCs)
```
Mastered: fsrs_state = 2 AND stability >= 21 (3+ weeks)
Familiar: fsrs_state = 2 AND stability >= 7 AND stability < 21 (1-3 weeks)
Learning: reps >= 1 AND NOT (fsrs_state = 2 AND stability >= 7)
Not Seen: reps = 0 OR no progress record
```

#### Files Created
- `supabase/migrations/20251228_progress_rpc_functions.sql`
- `supabase/migrations/20251229_book_chapters_progress.sql`
- `src/services/progressService.js`

#### Files Modified
- `src/pages/Dashboard.jsx` - Query optimizations
- `src/pages/BookDashboard.jsx` - Complete rewrite
- `src/pages/Flashcards.jsx` - StrictMode fix
- `src/services/sessionBuilder.js` - Parallelization & exposure disabled
- `src/components/dashboard/ActiveContentCards.jsx` - Uses progressService
- `src/components/dashboard/ChapterCarousel.jsx` - Chapter display fixes

---

## 2025-12-25 - Critical Fixes & Notion-like Design Refresh

### Fixed

#### Database Query Fixes
- **404 Error Fixed**: Changed queries from non-existent `user_chapter_reading_progress` to correct `user_book_reading_progress` table
  - `src/components/dashboard/ActiveContentCards.jsx` - Fixed reading progress query
  - `src/pages/BookDashboard.jsx` - Fixed reading progress and vocabulary queries

- **Book Dashboard Data**: Now queries book-specific vocabulary (lemmas via chapters → sentences → words) instead of all user progress
  - Mastery thresholds: ≥80 (mastered), ≥50 (familiar), >0 (learning), 0 (not seen)

- **Song Dashboard Themes**: Added `Array.isArray()` check with `join(' · ')` separator for theme display

- **Song Study Blur**: Blurred/future lines now have `pointer-events-none` and conditional click handler to prevent interaction

### Changed

#### Notion-like Design Language
Updated color palette across all dashboard components for a cleaner, more professional look:

- **Tailwind Config** (`tailwind.config.js`):
  - Primary accent: `#2563eb` (Notion-like blue)
  - Muted amber for books: `#d4a24e`, `#b8862f`
  - Muted purple for songs: `#8b7aa3`, `#6f5d8a`
  - Neutrals aligned with Notion: `#37352f` (text), `#6b7280` (secondary), `#e5e5e5` (borders)

- **Components Updated**:
  - `HeroStats.jsx` - Muted blue progress ring and stats
  - `QuickActions.jsx` - Notion-blue Review button
  - `ActiveContentCards.jsx` - Muted amber/purple theme with subtle shadows
  - `BookDashboard.jsx` - Muted amber progress circle, updated action buttons
  - `SongDashboard.jsx` - Muted purple progress circle, updated action buttons
  - `SongStudy.jsx` - Muted purple progress bar and line highlighting

#### Chapter Grid Improvements
- Added Lock icons for locked chapters
- Added "Next" chapter styling (dashed amber border)
- Added chapter count header ("X of Y")
- Added legend showing Complete/Current/Next/Locked states

---

## 2025-12-25 - Library & Dashboard Restructure (Phases 1-8)

### Added

#### Database Changes
- Added `active_book_id` and `active_song_id` columns to `user_settings` for active content tracking
- Added `allow_explicit_content` boolean to `user_settings` for vulgar slang filtering
- Created migration file: `migrations/library-dashboard-restructure.sql`

#### Settings Page Updates
- Added "Content Settings" section with explicit content toggle
- Toggle controls whether vulgar slang terms are shown in song vocabulary

#### Content Switcher Component
- **ContentSwitcher.jsx** - Header dropdown for switching active book/song
- Shows current active content with chevron indicator
- Clicking content navigates to that content's dashboard
- "Browse Library" link to /library
- Integrated into DashboardHeader

#### Library Page (`/library`)
- **Library.jsx** - Browse all available content
- Tabs for Books and Songs with counts
- Content cards showing title, author/artist, metadata
- "Active" badge on currently selected content
- "Set as Active" action on cards
- Search functionality across title and author/artist
- Click card navigates to content dashboard

#### Book Dashboard (`/book/:bookId`)
- **BookDashboard.jsx** - Deep dive into specific book progress
- Progress circle with completion percentage
- Vocabulary stats grid (Mastered/Familiar/Learning/Not Seen)
- Review and Learn New action buttons
- Continue Reading button with current chapter info
- Chapter grid with unlock status and navigation

#### Song Dashboard (`/song/:songId`)
- **SongDashboard.jsx** - Deep dive into specific song progress
- Progress tracking with completion percentage
- Slang terms preview (respects explicit content setting)
- Section structure display with type badges
- Learn Slang, Review, and Study Lyrics action buttons
- Themes display

#### Main Dashboard Refactor
- **ActiveContentCards.jsx** - Shows active book and song cards
- Cards display progress bars and quick actions
- "Continue Reading" and "Study Lyrics" CTAs
- Links to Library for browsing more content
- Integrated into Dashboard between QuickActions and CategoryPills

#### Route Structure Updates
- Added routes: `/book/:bookId/read`, `/book/:bookId/read/:chapterNumber`
- Added routes: `/song/:songId/vocab`, `/song/:songId/study`
- Legacy routes maintained for backward compatibility
- ReadingMode now accepts `bookId` param (falls back to active book or El Principito)

### Changed
- Updated navigation links throughout app to use new route format
- SlangFlashcards and SongStudy now navigate back to song dashboard
- QuickActions "Songs" button now goes to Library

### Fixed
- Fixed Tailwind dynamic class issue in Library ContentCard (JIT compilation)

---

## 2025-12-25 - Lyrics Database Phase 3 & 4: Admin & User Interface

### Added

#### Admin Interface (Phase 3)

- **AdminSongs.jsx** (`/admin/songs`) - Song management list page
  - Stats cards (total, published, draft)
  - Filters: difficulty, publication status, search
  - Sorting by title, artist, lines, slang count
  - Keyboard navigation (↑/↓/Enter)
  - Toggle published status

- **SongDeepDive.jsx** (`/admin/songs/:songId`) - Song detail/edit page
  - Edit song metadata (title, artist, album, difficulty, dialect, themes)
  - View sections with line counts
  - Stats overview
  - Published toggle

- **AdminSlang.jsx** (`/admin/slang`) - Slang terms management page
  - Stats cards (total, approved, needs review)
  - Filters: region, formality, approval status, search
  - Keyboard navigation
  - Toggle approval status

- **SlangDeepDive.jsx** (`/admin/slang/:slangId`) - Slang term detail/edit page
  - Edit term, definition, region, formality
  - Cultural context and examples editing
  - View linked songs

#### User-Facing Interface (Phase 4)

- **Songs.jsx** (`/songs`) - Song browser page
  - Browse published songs with difficulty filter
  - Search by title/artist
  - Song cards with stats (lines, slang count, difficulty)
  - Links to flashcards and study mode

- **SlangFlashcards.jsx** (`/songs/:songId/vocab`) - Slang flashcard review
  - Card-flip interaction
  - Show term, definition, cultural context
  - Progress tracking through deck
  - Keyboard navigation (←/→/Space/C)

- **SongStudy.jsx** (`/songs/:songId/study`) - Line-by-line study mode
  - Lyrics display by section
  - Translation toggle
  - Auto-play mode
  - Cultural notes for each line
  - Expandable slang term reference
  - Keyboard navigation (↑/↓/T/P)

#### Dashboard Integration

- **QuickActions.jsx** - Added purple "Songs" button alongside Read button
  - Purple (#9333ea) color to match Songs theme

#### Routing

- Added admin routes: `/admin/songs`, `/admin/songs/:songId`, `/admin/slang`, `/admin/slang/:slangId`
- Added user routes: `/songs`, `/songs/:songId/vocab`, `/songs/:songId/study`
- Updated Admin.jsx navigation with Songs and Slang tabs (separated by divider)
- Updated Admin.jsx dashboard cards for Songs and Slang

### Files Created

- `src/pages/AdminSongs.jsx`
- `src/pages/SongDeepDive.jsx`
- `src/pages/AdminSlang.jsx`
- `src/pages/SlangDeepDive.jsx`
- `src/pages/Songs.jsx`
- `src/pages/SlangFlashcards.jsx`
- `src/pages/SongStudy.jsx`

### Files Modified

- `src/App.jsx` - Added all new routes and imports
- `src/pages/Admin.jsx` - Added Songs/Slang tabs and dashboard cards
- `src/components/dashboard/QuickActions.jsx` - Added Songs button

---

## 2025-12-25 - Lyrics Database Phase 2: Seed Data

### Added

- **Seed script** (`scripts/seed-lyrics-poc.js`) - Inserts complete song data
- **Verify script** (`scripts/verify-lyrics-seed.js`) - Validates seeded data

### Seeded Data

- **Song:** "Debí Tirar Más Fotos" by Bad Bunny
- **14 sections:** intro, verses, pre-chorus, chorus, interlude, outro
- **54 lines** with Spanish lyrics and English translations
- **38 slang terms** with definitions, regions, and cultural notes
- **38 song-slang links**

### Documentation

- Updated `32_LYRICS_DATABASE_SPEC.md` with Phase 2 completion
- Added `song_phrases` table to documentation (manually added by Peter)

---

## 2025-12-25 - Lyrics Database Phase 1: Database Setup

### Added

- **Lyrics Database Schema** - 10 new tables for lyrics-based vocabulary learning (POC)
  - `songs` - Song metadata (title, artist, album, dialect, themes)
  - `song_sections` - Structural divisions (verse, chorus, bridge, etc.)
  - `song_lines` - Individual lyric lines with translations
  - `slang_terms` - Non-standard vocabulary with cultural context
  - `song_slang` - Junction table linking slang to songs
  - `song_lemmas` - Junction table linking standard lemmas to songs
  - `song_phrases` - Junction table linking standard phrases to songs (added by Peter)
  - `user_slang_progress` - FSRS-scheduled slang learning progress
  - `user_line_progress` - FSRS-scheduled line comprehension progress
  - `user_song_progress` - Overall song learning progress

- **11 Performance Indexes** for lyrics queries

### Files Created

- `supabase/migrations/20251225_lyrics_database.sql` - Complete migration
- `scripts/run-lyrics-migration.js` - Migration info script
- `scripts/execute-lyrics-migration.js` - Migration executor
- `scripts/verify-supabase-connection.js` - Connection verification

### Documentation Updated

- `02_DATABASE_SCHEMA.md` - Added Lyrics Tables (POC) section with all 9 tables

---

## 2025-12-25 - Flashcard Display Improvements

### Changed

- **FlashcardDisplay.jsx** - Show all definitions joined with comma (was only showing first)
- **FlashcardDisplay.jsx** - Reduced Spanish word font size from `text-7xl` to `text-4xl`
- **FlashcardDisplay.jsx** - Reduced English translation font size from `text-6xl` to `text-3xl`
- **FlashcardDisplay.jsx** - Added `break-words` class to prevent long words/phrases from overflowing card

### Technical Details

- `displayTranslation` now uses `definitions.join(', ')` instead of `definitions[0]`
- Long definitions like "to answer, to reply, to respond" now display correctly

---

## 2025-12-24 - Admin Suite Phase 2d: Sentences Review Status

### Added

- **Review status filter** on Sentences list (All/Reviewed/Needs Review)
- **Reviewed toggle column** in Sentences table
- **Reviewed toggle button** in Sentence Deep Dive header

### Completed

- Admin Suite Phase 2 is now complete!

---

## 2025-12-24 - Admin Suite Phase 2c: Phrases Management

### Added

- **Phrases Tab** in Admin navigation (between Lemmas and Sentences)

- **Phrases List Page** (`/admin/phrases`)
  - View all phrases with occurrence counts
  - Filter by type (idiom, compound, collocation, expression)
  - Filter by chapter, review status
  - Search by phrase text or definition
  - Toggle reviewed status
  - Create new phrase modal
  - Keyboard navigation (↑/↓ to navigate, Enter to open)

- **Phrase Deep Dive** (`/admin/phrases/:phraseId`)
  - Edit phrase text, definitions, type
  - Toggle reviewed status
  - View all occurrences grouped by chapter
  - Link to sentence deep dive from occurrences
  - Delete individual occurrences
  - Delete phrase (cascades to occurrences)

- **Create Phrase Modal**
  - Add phrase text
  - Multiple definitions
  - Select type

### Files Created

- `src/pages/AdminPhrases.jsx`
- `src/pages/PhraseDeepDive.jsx`
- `src/components/admin/CreatePhraseModal.jsx`

### Files Modified

- `src/App.jsx` - Added phrases routes
- `src/pages/Admin.jsx` - Added Phrases tab and dashboard card

---

## 2025-12-24 - Admin Suite Phase 2b: Orphaned Words & Delete Safeguards

### Added

- **Orphaned Words Page** (`/admin/lemmas/orphaned`)
  - View all words without valid lemma assignments (lemma_id is NULL)
  - Grouped by chapter for easy navigation
  - Assign lemma to each orphaned word via search modal
  - Link from main Lemmas page (AlertTriangle icon button)
  - Empty state celebration when no orphaned words exist

- **Enhanced Delete Lemma Flow** (`LemmaDeepDive.jsx`)
  - Warning when words are assigned to lemma being deleted
  - Option to make words orphaned (for later reassignment)
  - Option to bulk reassign all words to another lemma before deletion
  - Target lemma search modal for reassignment
  - Confirmation required before deletion

### Changed

- LemmaReassignModal now supports `currentLemmaId` prop to exclude a lemma from search results
- LemmaReassignModal `onConfirm` callback now passes lemma data as second argument

### Files Created

- `src/pages/OrphanedWords.jsx`

### Files Modified

- `src/App.jsx` - Added `/admin/lemmas/orphaned` route (before `:lemmaId` route)
- `src/pages/AdminCommonWords.jsx` - Added link to Orphaned Words page
- `src/pages/LemmaDeepDive.jsx` - Enhanced delete confirmation modal with orphan/reassign options
- `src/components/admin/LemmaReassignModal.jsx` - Added currentLemmaId exclusion support

---

## 2025-12-24 - Admin Suite Phase 2a: Lemmas Management

### Added

**Enhanced Lemmas List** (renamed from Common Words):
- Tab and dashboard card renamed from "Common Words" to "Lemmas"
- `is_reviewed` toggle column with visual indicator (checkmark/circle icon)
- POS filter dropdown (Nouns, Verbs, Adjectives, etc.)
- Chapter filter dropdown (shows lemmas appearing in specific chapters)
- Review status filter (reviewed/unreviewed)
- Definition filter (has/missing definition)
- Deep dive link for each lemma (ExternalLink icon)
- Create New Lemma button and modal

**Lemma Deep Dive** (`/admin/lemmas/:lemmaId`):
- Edit lemma text, definitions, POS, gender
- Toggle stop word and reviewed status
- Word occurrences grouped by chapter with expandable sections
- Sentence context for each occurrence
- Reassign words to different lemma
- Delete lemma (with safeguards - blocks if words still attached)
- Link to Sentence Deep Dive from occurrences

**Create Lemma Modal** (`CreateLemmaModal.jsx`):
- Full form for new lemma creation
- Multiple definitions support with add/remove
- POS and gender selection
- Stop word checkbox

### Fixed
- AddPhraseModal now includes `component_lemmas` when creating new phrases (required field)
- Changed `definitions: null` to `definitions: []` in AddPhraseModal

### Files Created
- `src/components/admin/CreateLemmaModal.jsx`
- `src/pages/LemmaDeepDive.jsx`

### Files Modified
- `src/pages/Admin.jsx` - Renamed tab, updated descriptions and routing logic
- `src/pages/AdminCommonWords.jsx` - Added filters, reviewed column, create button
- `src/App.jsx` - Added `/admin/lemmas/:lemmaId` route

---

## 2025-12-24 - Admin Suite Final Fixes

### Common Words Enhancements

**Fixed 1000 word limit** (`AdminCommonWords.jsx`):
- Added `.range(0, 9999)` to fetch all ~1,854 lemmas (Supabase defaults to 1000)
- Console logs now show actual total count

**Word frequency counts**:
- Fetches all words and counts occurrences per lemma
- Displays frequency column with color-coded badges (>50: blue, >10: light blue, else neutral)
- Bulk "Mark Top N" now correctly uses frequency to identify most common words

**Sorting options**:
- Sort by Frequency (default, descending)
- Sort Alphabetically
- Toggle sort order (↑/↓ button)

**Find in sentences link**:
- External link icon next to each word's action buttons
- Links to `/admin/sentences?search={lemma}` to find all occurrences

---

## 2025-12-24 - Admin Suite Bug Fixes & Enhancements

### Bug Fixes

**Phrase toggle refresh fix** (`PhrasesSection.jsx`):
- Added `e.preventDefault()` and `e.stopPropagation()` to reviewed toggle handler
- Added `type="button"` to prevent form submission behavior
- Phrase reviewed status now toggles without page refresh

**Lemma reassign debugging** (`SentenceDeepDive.jsx`):
- Added console logging for reassign operations
- Uses `.select()` to verify database update

### Enhancements

**Multiple definitions UI** (`WordsTable.jsx`):
- Definitions now treated as array (JSONB format)
- Inline editing shows each definition separately with remove button
- "Add definition" button to append new definitions
- Enter in last input adds new definition, or saves if empty
- Handles both array and legacy string formats

**Stop word toggle on word rows** (`WordsTable.jsx`, `SentenceDeepDive.jsx`):
- Clickable badge next to lemma text: "stop" or "mark stop"
- Hover states show intent (red for unmark, green for mark)
- `handleToggleStopWord` updates lemma and local state

**Add phrase modal** (`AddPhraseModal.jsx`, `PhrasesSection.jsx`):
- New "Add Phrase" button in PhrasesSection header
- Modal with:
  - Start/end position dropdowns (populated from words)
  - Live preview of selected word range
  - Radio toggle: "Link to existing phrase" vs "Create new phrase"
  - Existing phrase search with debounced results
  - New phrase form: text, definition, type (compound/idiom/collocation/expression)
- Creates phrase_occurrences record (and phrases record if new)

### Common Words UI Refresh (`AdminCommonWords.jsx`)

Complete redesign to match Notion aesthetic:
- Removed all `font-serif` classes
- Stats cards: border instead of shadow, neutral colors
- Flattened filters: inline search + dropdown + bulk menu
- Bulk actions moved to dropdown menu instead of colorful buttons
- Applied `.admin-table` styling with subtle borders
- Added keyboard navigation (↑/↓ to move, S to toggle stop word)
- Keyboard hint row matching AdminSentences pattern

---

## 2025-12-23 - Admin Suite Phase 1: Sentence Deep Dive

### New Components

**`src/pages/SentenceDeepDive.jsx`** - Main page for complete sentence breakdown:
- Route: `/admin/sentences/:sentenceId`
- Fetches sentence with fragments, words with lemmas, phrase occurrences
- Prev/next sentence navigation within chapter
- Keyboard shortcuts: `←/→` navigate sentences, `Esc` back to list
- Handlers for translation save, paragraph toggle, fragment save, lemma edit/reassign

**`src/components/admin/SentenceHeader.jsx`**:
- Displays Spanish sentence text (read-only)
- Inline editable translation with Enter to save, Esc to cancel
- Paragraph start toggle button
- Chapter info display

**`src/components/admin/WordsTable.jsx`**:
- Table of words with position, word text, lemma, POS, definitions
- Inline editable definitions
- Stop word and gender indicators
- Reassign lemma action button

**`src/components/admin/LemmaReassignModal.jsx`**:
- Search lemmas by text (debounced)
- Display results with definitions and POS
- Confirm reassignment updates word-to-lemma mapping

**`src/components/admin/PhrasesSection.jsx`**:
- List phrase occurrences with phrase info
- Edit phrase definitions inline
- Toggle reviewed status
- Delete occurrence button

### Changes
- **`src/App.jsx`**: Added route for `/admin/sentences/:sentenceId`
- **`src/pages/Admin.jsx`**: Updated breadcrumb and tab highlighting for deep dive route
- **`src/components/admin/SentenceRow.jsx`**: Added deep dive link (external link icon) alongside quick edit button
- **`src/components/admin/SentenceTable.jsx`**: Updated Actions column header

---

## 2025-12-23 - Chapter Gate & Navigation Fixes

### Chapter Gate (v22)
- **New function**: `checkChapterVocabReady(bookId, chapterNumber)` in `useReadingProgress.js`
  - Fetches all unique lemma IDs for target chapter (excluding stop words via `lemmas.is_stop_word = false`)
  - Counts how many user has introduced (`reps >= 1` in `user_lemma_progress`)
  - Returns `{ ready: boolean, percentage: number, seen: number, total: number }`
- **Chapter Locked UI** in `ReadingPage.jsx`:
  - Shows "Chapter X Locked" with percentage of words introduced
  - "Return to Dashboard" button dismisses and navigates
  - "Stay Here" button dismisses and keeps user on last sentence
- **Gate applied in three places**:
  - `handleSentenceComplete` - blocks when completing last sentence of chapter
  - `goToNextChapter` - blocks manual chapter forward navigation (vv button)
  - Both check vocab readiness before allowing advancement

### Chapter Unlock Timing Fix (v22)
- **New function**: `registerChapterReached(bookId, chapterNumber, sentenceId)` in `useReadingProgress.js`
  - Updates `furthest_sentence_id` immediately when entering a new chapter
  - Compares against current furthest to only update if further
- **Called in three places**:
  - `handleSentenceComplete` - when crossing chapter boundary
  - `goToNextSentence` - when navigating forward crosses chapter
  - `jumpToChapter` - when explicitly jumping to a chapter
- **Result**: User can immediately use `^^` to return to a chapter they just entered

### Bug Fixes
- **v23: Chapter gate showing "Fin" instead of locked message**
  - Root cause: Code was setting `setCurrentSentence(null)` when chapter locked, which triggered `isEndOfBook` check
  - Fix: Removed `setCurrentSentence(null)` from locked block - keep showing last sentence while locked UI displays
  - The `chapterLocked` state is checked before `isEndOfBook` in ReadingPage render logic
- **v20: Stale closure in handleSentenceComplete**
  - Root cause: `moveToNextFragment` called `handleSentenceComplete` directly, capturing stale `nextSentencePreview` value
  - Fix: Added `handleSentenceCompleteRef` (useRef) that always holds latest callback
  - `moveToNextFragment` now calls `handleSentenceCompleteRef.current()` instead

### Files Modified
- `src/hooks/reading/useReadingProgress.js` - Added `checkChapterVocabReady`, `registerChapterReached`
- `src/hooks/reading/useReadingSession.js` - Added `chapterLocked` state, gate checks, ref pattern
- `src/components/reading/ReadingPage.jsx` - Added Chapter Locked UI render block

---

## 2025-12-23 - Reading Mode Complete Implementation

### Reading Mode Core
- **Flowing Paragraphs**: Completed sentences flow as continuous text like a real book, grouped by paragraph based on `is_paragraph_start` flag
- **Fragment-by-Fragment Reading**: Users progress through sentences one fragment at a time, with upcoming fragments blurred (3px blur) until active
- **Tap-to-Peek Translation**: Tap any fragment to see its translation via tooltip; peeked fragments score 0.7 instead of 1.0
- **Single Check Button**: Green check button below paragraph confirms fragment comprehension (replaces 3-button flow)
- **Sentence Highlighting**: Users can highlight sentences for later review via tooltip toggle; highlighted sentences show amber underline/background
- **Blurred Next Sentence Preview**: Shows blurred preview of upcoming sentence inline, or chapter title ("Capítulo II" in Roman numerals) at chapter boundaries
- **Chapter-Only View**: Performance optimization - only loads current chapter's sentences instead of entire book history
- **Smooth Transitions**: Batched state updates, opacity transitions, and `requestAnimationFrame` timing eliminate jarring sentence-to-sentence jumps

### Navigation Controls
- **Tape Deck Navigation**: Fixed-position controls on right side of content area (`left-[calc(50%+400px)]`)
  - Single chevron (ChevronUp/ChevronDown): Move one sentence back/forward
  - Double chevron (ChevronsUp/ChevronsDown): Jump to previous/next chapter
- **Smart Navigation Permissions**: Forward navigation only enabled for already-visited content (tracked via `furthestPosition`)
- **Seamless Navigation**: No loading screens when navigating - instant state manipulation using local state

### Reading Mode UI Components
- **StickyHeader**: Shows "Exit" button, book title ("El Principito"), and current chapter number
- **ChapterTitle**: Roman numerals (Capítulo I, II, etc.) with elegant typography using custom `toRoman()` function
- **FlowingParagraph**: Renders completed sentences with inline active sentence when not starting new paragraph
- **ActiveSentenceInline**: Fragment-by-fragment display with peek tooltips, exposes `wasCurrentFragmentPeeked()` via ref
- **SentenceTooltip**: Shows translation, fragment breakdown, and highlight toggle when tapping completed sentences
- **NavigationControls**: Lucide icons for tape-deck style navigation

### Reading Session Hooks
- **useReadingSession**: Main session hook managing all state and actions
  - States: `currentChapter`, `currentSentence`, `completedSentences`, `nextSentencePreview`, `nextChapterPreview`, `isTransitioning`
  - Actions: `handleConfirm`, `jumpToChapter`, `goToPreviousSentence`, `goToNextSentence`, `goToPreviousChapter`, `goToNextChapter`
  - Uses `handleSentenceCompleteRef` to fix stale closure bug in callbacks
- **useReadingProgress**: Database operations hook
  - `fetchChapterSentences()`: Loads only current chapter's completed sentences
  - `fetchNextSentencePreview()`: Lightweight preview with chapter boundary detection
  - `fetchChapterFirstSentence()`: Gets first sentence of a chapter by number
  - `saveSentenceComplete()`: FSRS scheduling integration for sentence progress
- **useScrollToPosition**: Manages scroll behavior and auto-scroll to current sentence

### Admin - Sentence Management
- **New Route**: `/admin/sentences` for managing sentence content
- **Notion-Style Table**: SentenceTable component with columns for sentence number, paragraph toggle, Spanish text, English translation, fragment count
- **Inline Paragraph Toggle**: ParagraphToggle component - single-click to mark paragraph starts with optimistic updates
- **Edit Modal**: SentenceEditModal for editing sentence translations, fragment translations, and context notes
- **Keyboard Shortcuts**: Arrow keys to navigate, Enter to edit, P to toggle paragraph, Escape to close modal
- **Chapter Filter**: Dropdown to filter sentences by chapter
- **Search**: Filter by Spanish or English text

### Database Changes
- Added `is_paragraph_start` boolean column to `sentences` table
- Added `is_highlighted` boolean column to `user_sentence_progress` table
- Uses `user_book_reading_progress` table for position tracking with `furthest_sentence_id`
- RLS policy for authenticated users to update sentences

### Bug Fixes
- **Stale Closure Bug**: Fixed premature "end of book" detection caused by `moveToNextFragment` calling `handleSentenceComplete` with stale `nextSentencePreview` value - solved using `useRef` pattern
- **Chapter Boundary Detection**: At chapter end, nextSentencePreview is null but nextChapterPreview is set - now correctly fetches first sentence of next chapter
- **Fragment Breakdown Display**: Fragment translations now show correctly in peek tooltips
- **Sentence Transition Flash**: Eliminated duplicate content flash by clearing previews immediately and using `!isTransitioning` guards
- **React Temporal Dead Zone**: Fixed `canSentenceForward` referenced before defined by calculating inline

### Performance
- **Chapter-Only Loading**: Only loads sentences for current chapter, not entire book history
- **Lightweight Previews**: `fetchNextSentencePreview()` fetches minimal fields (sentence_text, is_paragraph_start, chapter_id, chapter_number)
- **Background DB Operations**: `Promise.all()` for non-blocking saves after sentence completion
- **Batched State Updates**: React 18 automatic batching plus explicit grouping for clarity

### Technical Implementation Details
- **File Structure**:
  - `src/hooks/reading/useReadingSession.js` - 670+ lines, main session hook
  - `src/hooks/reading/useReadingProgress.js` - 950+ lines, database operations
  - `src/components/reading/` - 12 React components
  - `src/pages/AdminSentences.jsx` - Admin page for sentence management
  - `src/components/admin/` - SentenceTable, ParagraphToggle, SentenceEditModal, FragmentEditor

### Future Enhancements (Documented)
- Virtualized full-book view for seamless scrolling across chapters
- Sentence Review mode with FSRS scheduling for weak sentences
- Session summary on exit with stats
- Chapter unlock trigger on chapter entry, not first sentence completion

---

## [0.1.5] - Dashboard Polish & Bug Fixes (December 15, 2025)

### Added
- **4-Level Progress Visualization:** Chapter progress bars and HeroStats ring now show depth of knowledge
  - Mastered (#1e3a5f): stability >= 21 days, fsrs_state = 2
  - Familiar (#0369a1): stability 7-20 days, fsrs_state = 2
  - Learning (#38bdf8): stability < 7 days OR fsrs_state IN (1, 3)
  - Not Seen (#d6d3d1): no progress record
  - New `StackedProgressBar` component in ChapterCarousel
  - New `categorizeByLevel()` helper function in Dashboard
- **Animated Streak Pill:** Header streak indicator auto-expands on page load showing "X days", collapses after 3 seconds, click to toggle
- **Notion-Style Loading Screen:** New `LoadingScreen.jsx` component with animated opening book and floating Spanish words (luna, flor, rey, zorro), replacing basic emoji loading state
- **Netlify SPA Routing:** Added `public/_redirects` file to fix 404 errors on page refresh or direct URL access on mobile

### Fixed
- **Streak Calculation Bug:** `updateStreak()` was always setting streak to 1 - now properly counts consecutive days by checking each expected date has activity
- **Streak Display:** Both header pill and Activity heatmap now show correct streak count
- **Streak Date Timezone Bug:** `fetchStreakData()` now uses `formatLocalDate()` instead of `toISOString().split('T')[0]` to match Activity heatmap date handling - fixes off-by-one day issues near midnight UTC
- **Daily Stats Date Storage Bug:** `updateDailyStats()` and `updateStreak()` in `useProgressTracking.js` now use local date format instead of UTC - ensures records are stored with correct local date matching streak calculations
- **Longest Streak Tracking:** Now updates `longest_streak`, `longest_streak_start`, `longest_streak_end` when current exceeds previous best
- **Forecast "Today" Count:** Now includes all overdue cards from previous days using `.lte('due_date', endISO)` instead of date range
- **"Learn New" Count Mismatch:** Dashboard's `getChaptersThroughCurrent()` now uses same 95% unlock threshold as session builder's `getUnlockedChapterIds()` - button count matches actual session content
- **HeroStats Frame:** Removed unnecessary white card frame around progress ring for cleaner look
- **Redundant "TODAY" Label:** Removed duplicate "TODAY" text above forecast bar (label below is sufficient)

### Changed
- `fetchStreakData()` rewritten to calculate streak from consecutive days instead of trusting stored values
- `fetchActivityData()` now calculates streak from activity map and queries `longest_streak` from database
- `updateDailyStats()` no longer hardcodes `current_streak: 1` on insert
- `fetchForecastData()` uses conditional logic: `.lte()` for today, `.gte().lt()` range for future days
- `getChaptersThroughCurrent()` checks if PREVIOUS chapter >= 95% complete to include current chapter (aligned with session builder)
- `DashboardHeader.jsx` completely rewritten with useState for expand/collapse animation
- `HeroStats.jsx` now receives and displays `familiarCount` and `learningCount` props
- `ChapterCarousel.jsx` chapter objects now include `mastered`, `familiar`, `learning`, `notSeen` counts

### Technical Details
- New files: `src/components/flashcard/LoadingScreen.jsx`, `public/_redirects`
- Modified files: `Dashboard.jsx`, `HeroStats.jsx`, `ChapterCarousel.jsx`, `DashboardHeader.jsx`, `ReviewForecast.jsx`, `Flashcards.jsx`, `useProgressTracking.js`

---

## 2025-12-14: Session Summary Screen & Documentation Update

### Summary
New Notion-inspired session summary screen that replaces the basic completion view, with comprehensive card tracking, "Needs Focus" section for trouble words, and expandable all-cards list.

---

### 1. Session Summary Screen (New Feature)

**Location:** `src/components/flashcard/SessionSummary.jsx` (new file)

**Design Philosophy:** Clean, sophisticated, adult-oriented (not gamified). Matches dashboard styling with white card on stone background, thin dividers, and amber accent color.

#### Component Props

| Prop | Type | Description |
|------|------|-------------|
| `totalCards` | number | Total cards reviewed in session |
| `ratings` | object | `{ again: number, hard: number, gotIt: number }` |
| `reviewedCards` | array | Array of card review data objects |
| `dueCount` | number | Remaining due cards (from sessionStats) |
| `newAvailable` | number | Available new cards to learn |
| `onNewSession` | function | Callback for "Review More" button |
| `onDashboard` | function | Callback for "Back to Dashboard" button |

#### Card Data Structure (reviewedCards array)

Each card object in the array contains:

```javascript
{
  lemma: string,           // The word/phrase text
  cardId: string,          // UUID (phrase_id or lemma_id)
  cardType: string,        // 'lemma' or 'phrase'
  partOfSpeech: string,    // e.g., 'noun', 'verb', 'PHRASE'
  wasMarkedAgain: boolean, // STICKY flag - true if ever marked "again"
  finalRating: string,     // 'again', 'hard', or 'gotIt'
  dueFormatted: string,    // Human-readable due time (e.g., "10 min", "2 days")
  dueTimestamp: number     // Unix timestamp for sorting
}
```

#### The "wasMarkedAgain" Sticky Flag

**Key Behavior:** Once a card is marked "again" (or "dont-know") during a session, it appears in "Needs Focus" even if the user later answers it correctly.

**Rationale:** If a user struggled with a word at any point during the session, it's worth highlighting for future study, regardless of whether they eventually got it right.

**Implementation:**
```javascript
wasMarkedAgain: existing?.wasMarkedAgain || isAgain
```

#### Sorting Logic

Cards are sorted by:
1. Rating priority: again → hard → gotIt
2. Then by due date (soonest first)

```javascript
function sortCards(a, b) {
  const ratingOrder = { again: 0, hard: 1, gotIt: 2 }
  // ... sort by rating, then timestamp
}
```

#### UI Sections

1. **Header** - "Session Complete" label with blue dot, "Summary" title, today's date
2. **Metrics Grid** - Success rate | Total Cards | Got It count (with thin dividers)
3. **Responses** - Again/Hard/Got It breakdown with color-coded numbers
4. **Needs Focus** OR **Perfect Session** - Conditional rendering
5. **All X Cards** - Expandable section with chevron toggle
6. **Action Buttons** - Smart labels based on remaining cards

#### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Again dot | Mauve | `#6d6875` |
| Hard dot | Dusty rose | `#e5989b` |
| Got It dot | Sage green | `#98c1a3` |
| Perfect checkmark | Amber | `#f59e0b` |
| Primary button | Sky blue | `#0ea5e9` |
| Background | Stone | `#fafaf9` |
| Card background | White | `#ffffff` |
| Dividers | Light stone | `#e7e5e4` |

---

### 2. Flashcards.jsx State Management Changes

**Before:** `troubleWords` array with limited 5-word capture
**After:** `reviewedCards` Map tracking ALL cards with full metadata

#### State Declaration

```javascript
// Track all reviewed cards with their ratings and due dates
// Key: lemmaId or phraseId, Value: card review data
const [reviewedCards, setReviewedCards] = useState(new Map())
```

#### Card Tracking in handleDifficulty

```javascript
if (result?.success) {
  const cardId = currentCard.phrase_id || currentCard.lemma_id
  const isAgain = difficulty === 'again' || difficulty === 'dont-know'

  setReviewedCards(prev => {
    const updated = new Map(prev)
    const existing = updated.get(cardId)

    updated.set(cardId, {
      lemma: currentCard.lemma,
      cardId: cardId,
      cardType: currentCard.card_type || 'lemma',
      partOfSpeech: currentCard.part_of_speech || null,
      wasMarkedAgain: existing?.wasMarkedAgain || isAgain,
      finalRating: isAgain ? 'again' : difficulty === 'hard' ? 'hard' : 'gotIt',
      dueFormatted: result.dueFormatted || 'Now',
      dueTimestamp: result.dueDate ? new Date(result.dueDate).getTime() : Date.now()
    })

    return updated
  })
}
```

**Important:** Using a Map ensures cards are deduplicated by ID. If a card is reviewed multiple times (e.g., marked "again" and shown again), only one entry exists with updated values.

---

### 3. Session Builder Stats Additions

Added `dueRemaining` and `newRemaining` to all session builder stats objects:

**buildReviewSession:**
```javascript
dueRemaining: Math.max(0, dueCards.length - selectedDue.length),
newRemaining: 0
```

**buildLearnSession:**
```javascript
dueRemaining: 0,
newRemaining: Math.max(0, totalPool - session.length)
```

**buildChapterFocusSession:**
```javascript
dueRemaining: Math.max(0, chapterDue.length + otherDue.length - selectedChapterDue.length - selectedOtherDue.length),
newRemaining: 0
```

These values enable smart button labels:
- "Review More (X due)" when dueRemaining > 0
- "Learn New Words (X)" when newRemaining > 0 and dueRemaining = 0
- "Return to Dashboard" when both are 0

---

### 4. Files Modified

| File | Changes |
|------|---------|
| `src/components/flashcard/SessionSummary.jsx` | **New file** - Complete session summary component |
| `src/pages/Flashcards.jsx` | Replaced `troubleWords` with `reviewedCards` Map, updated tracking logic, updated SessionSummary props |
| `src/services/sessionBuilder.js` | Added `dueRemaining` and `newRemaining` to all three build functions |

---

### 5. Edge Cases Handled

1. **Empty session** - Metrics show 0/0, "Perfect session" displays
2. **Card reviewed multiple times** - Map deduplication ensures single entry with latest values
3. **Exposure cards** - Only tracked if `result.success` is true
4. **Missing dueFormatted** - Falls back to "Now"
5. **Missing part of speech** - Gracefully hidden in CardRow
6. **Long lemma text** - Truncated with `truncate` class

---

### 6. Future Considerations

- Could add card tap-to-expand for full details
- Could persist session history for cross-session analytics
- "Needs Focus" could link to a dedicated review mode for trouble words
- Success rate calculation treats "hard" as success (debatable)

---

## 2025-12-13: Dashboard Overhaul, Activity Tracking System, & Performance Optimization

### Summary
Major dashboard rebuild with accurate activity tracking, optimized chapter loading (15s → 1.5s), and complete phrase integration throughout the learning system.

---

### 1. Activity Tracking System (New)

**Problem:** Activity heatmap was showing inaccurate counts. The system used `last_seen_at` timestamp which only stores the most recent review, causing historical data to be overwritten.

**Solution:** Implemented proper review history logging using the `user_review_history` table.

**Schema Changes:**
```sql
-- Added new columns for lemma/phrase tracking
ALTER TABLE user_review_history
  ADD COLUMN lemma_id UUID REFERENCES lemmas(lemma_id),
  ADD COLUMN phrase_id UUID REFERENCES phrases(phrase_id);

-- Made vocab_id nullable (was NOT NULL, blocking inserts)
ALTER TABLE user_review_history ALTER COLUMN vocab_id DROP NOT NULL;

-- Added check constraint for data integrity
ALTER TABLE user_review_history
  ADD CONSTRAINT chk_review_item CHECK (
    (lemma_id IS NOT NULL AND phrase_id IS NULL) OR
    (lemma_id IS NULL AND phrase_id IS NOT NULL) OR
    (lemma_id IS NULL AND phrase_id IS NULL AND vocab_id IS NOT NULL)
  );

-- Added indexes for efficient activity queries
CREATE INDEX idx_review_history_user_lemma_date
  ON user_review_history(user_id, reviewed_at DESC, lemma_id)
  WHERE lemma_id IS NOT NULL;

CREATE INDEX idx_review_history_user_phrase_date
  ON user_review_history(user_id, reviewed_at DESC, phrase_id)
  WHERE phrase_id IS NOT NULL;
```

**Code Changes:**
- `useProgressTracking.js`: Added `logReviewEvent()` function that inserts a row on every review
- `Dashboard.jsx`: `fetchActivityData()` now queries `user_review_history` for accurate unique card counts per day
- `ActivityHeatmap.jsx`: Fixed property name mismatch (`count` → `reviews`)

**Result:** Activity heatmap now shows accurate count of UNIQUE cards reviewed each day, with no double-counting and preserved historical data.

---

### 2. Dashboard Performance Optimization

**Problem:** Dashboard took ~15 seconds to load due to 81+ sequential database queries (27 chapters × 3 queries each).

**Solution:** Replaced sequential queries with parallel execution using `Promise.all`.

**Before:**
```javascript
// Sequential: 27 chapters × 3 queries = 81 queries, ~15 seconds
for (const chapter of chapters) {
  const sentences = await fetchSentences(chapter.id)
  const words = await fetchWords(sentences)
  const phrases = await fetchPhrases(sentences)
  // ...
}
```

**After:**
```javascript
// Parallel: All 27 chapters fetched simultaneously, ~1.5 seconds
const chapterStatsPromises = chapters.map(async (chapter) => {
  const [sentences, words, phrases] = await Promise.all([
    fetchSentences(chapter.id),
    fetchWords(sentences),
    fetchPhrases(sentences)
  ])
  // ...
})
const chapterStats = await Promise.all(chapterStatsPromises)
```

**Performance:**
| Approach | Queries | Load Time |
|----------|---------|-----------|
| Before (sequential) | 81 | ~15 sec |
| After (parallel) | ~55 | ~1.5 sec |

---

### 3. Chapter Display Logic

**New Logic:** "1 back, current, 2 forward"

Shows 4 chapters based on user's current progress:
- 1 chapter before current (for review)
- Current chapter (actively working on)
- 2 chapters ahead (upcoming)

**Examples:**
| Current Chapter | Visible Chapters |
|-----------------|------------------|
| 1 | 1, 2, 3, 4 |
| 2 | 1, 2, 3, 4 |
| 10 | 9, 10, 11, 12 |
| 26 | 24, 25, 26, 27 |

**"View all" expands instantly** using cached data from initial load.

---

### 4. Session Builder Unlock Fix

**Problem:** Chapter 2 would never unlock because the unlock calculation included stop words in the denominator.

**Math (Before):**
- Total lemmas with stop words: 175
- Learnable lemmas (non-stop): 141
- Max possible rate: 141/175 = 80.5% < 95% threshold
- Result: Chapter 2 never unlocks

**Fix:** Updated `getUnlockedChapterIds()` and `getUnlockedChapters()` to:
1. Exclude stop words from total count
2. Include phrases in both total and introduced counts

**Math (After):**
- Total: 141 lemmas + 20 phrases = 161
- Introduced: 161
- Rate: 161/161 = 100% ≥ 95%
- Result: Chapter 2 unlocks correctly

---

### 5. Dashboard Component Fixes

**ActivityHeatmap:**
- Fixed timezone handling (uses local time consistently)
- Colors scale based on user's `daily_goal_words` setting
- Future dates shown with muted styling and dashed borders
- Added "X / 28 days" practiced stat
- Today cell has prominent ring + shadow highlight

**ReviewForecast:**
- Fixed bar rendering (was showing only numbers, no bars)
- Bars use pixel-based heights for reliable rendering
- Removed duplicate "Review X cards" button
- Compact layout with calendar icon

**ChapterCarousel:**
- Shows combined lemma + phrase counts
- Proper unlock state visualization
- "View all" lazy loads remaining chapters

---

### 6. Database Schema Notes

**Critical:** There is NO `introduced` column in `user_lemma_progress` or `user_phrase_progress`.

Use `reps >= 1` as proxy for "card has been introduced/reviewed at least once".

**Progress table columns:**
- `reps` - Number of reviews (≥1 means introduced)
- `stability` - FSRS stability value
- `due_date` - Next scheduled review
- `last_seen_at` - Timestamp of last review

---

### Files Modified

**Core Logic:**
- `src/services/sessionBuilder.js` - Unlock calculation, proportional mixing
- `src/hooks/flashcard/useProgressTracking.js` - Added `logReviewEvent()`

**Dashboard:**
- `src/pages/Dashboard.jsx` - Parallel queries, activity data from review history
- `src/components/dashboard/ActivityHeatmap.jsx` - Fixed property name, timezone
- `src/components/dashboard/ReviewForecast.jsx` - Bar rendering fix
- `src/components/dashboard/ChapterCarousel.jsx` - New props for lazy loading

---

### Lessons Learned

1. **Verify database schema before writing queries** - The `introduced` column bug caused cascading failures
2. **Use local time for user-facing dates, UTC for storage**
3. **Pixel-based heights are more reliable than percentages in flex containers**
4. **Supabase has a default 1000-row limit** - Use `.range(0, 50000)` for bulk queries
5. **Append-only tables (like review history) are better for activity tracking** than overwriting timestamps
6. **Parallel queries with Promise.all** dramatically improve load times

---

## [2025-12-13] - Dashboard Overhaul & Phrase Integration

### Summary

Major dashboard rebuild with complete phrase integration into the learning system. Fixed critical data bugs, implemented new UI components, and established consistent patterns for lemma+phrase handling throughout the app.

### Critical Fixes

**Database Query Fixes**
- Replaced non-existent `introduced` column references with `reps >= 1` throughout codebase
- Fixed chapter progress to include phrases in both total and user progress counts
- Fixed chapter progress to exclude stop words from totals (was showing 175, now correctly shows 161 for Chapter 1)
- Chapter unlock now triggers correctly when previous chapter reaches 95%

**Phrase Progress Tracking**
- Phrase reviews now save correctly to `user_phrase_progress` table
- FSRS scheduling works for phrases (stability, difficulty, due_date)
- FloatingFeedback "+X days" animation shows for phrase reviews

**Session Building**
- Learn New sessions now include proportional mix of lemmas and phrases
- No more 20% threshold gate - phrases available as soon as chapter unlocks
- Review sessions combine due lemmas and due phrases, sorted by due_date

### New Dashboard Components

**ActivityHeatmap (Rewritten)**
- Fixed timezone issue (was showing Friday as Saturday)
- Colors scale based on user's `daily_goal_words` from `user_settings`
- Future dates shown with muted styling and dashed borders
- Added "X / 28 days" practiced stat
- Today cell has prominent ring + shadow highlight
- Uses local time consistently

**ReviewForecast (Rewritten)**
- Fixed bar rendering (was showing only numbers, no bars)
- Bars use pixel-based heights for reliable rendering
- Removed duplicate "Review X cards" button (use top Review button instead)
- Compact layout with no wasted whitespace
- Uses local time for day boundaries

**ChapterCarousel**
- Now shows combined lemma + phrase counts (e.g., "161/161" not "141/175")
- Chapter 1 correctly shows 100% when all lemmas and phrases reviewed
- Chapter 2 unlocks when Chapter 1 reaches 95%

### Files Modified

**Core Logic**
- `src/services/sessionBuilder.js` - Proportional phrase/lemma selection, `reps >= 1` fix
- `src/hooks/flashcard/useProgressTracking.js` - Phrase progress saving

**Dashboard**
- `src/pages/Dashboard.jsx` - All data fetching functions updated for phrases
- `src/components/dashboard/ActivityHeatmap.jsx` - Complete rewrite
- `src/components/dashboard/ReviewForecast.jsx` - Complete rewrite
- `src/components/dashboard/ChapterCarousel.jsx` - Updated to receive phrase-inclusive data

**Functions Updated in Dashboard.jsx**
- `fetchHeroStats()` - Includes phrase counts
- `fetchQuickActionStats()` - Includes phrase due counts
- `fetchChaptersProgress()` - Calculates lemma + phrase totals, excludes stop words
- `fetchActivityData()` - Queries both progress tables
- `fetchForecastData()` - Uses local time, includes phrases
- `fetchCategoryData()` - Includes phrase category
- `getUnlockedChapterNumbers()` - Uses `reps >= 1`, includes phrases in calculation
- `fetchUserSettings()` - New function for daily target

### Database Schema Notes

**No `introduced` column exists** in `user_lemma_progress` or `user_phrase_progress`.
Use `reps >= 1` as proxy for "card has been introduced/reviewed at least once".

**Key columns for progress tracking:**
- `reps` - Number of reviews (>= 1 means introduced)
- `stability` - FSRS stability value
- `due_date` - Next scheduled review
- `last_seen_at` - Timestamp of last review

### Lessons Learned

1. Always verify database schema before writing queries - the `introduced` column bug caused cascading failures
2. Use local time for user-facing date displays, UTC for database queries
3. Pixel-based heights more reliable than percentages in flex containers
4. When combining data from two tables (lemmas + phrases), update ALL related queries consistently

---

## [2025-12-13] - FSRS Algorithm Implementation & Phrases Integration

### 🚀 Major Features

#### FSRS Algorithm Implemented
Replaced custom mastery/health system with research-backed FSRS (Free Spaced Repetition Scheduler).

**Benefits:**
- 20-30% fewer reviews for same retention (research-proven)
- Uses ts-fsrs library with default FSRS-6 parameters
- 8 database columns instead of previous 14 (simplified architecture)
- Stability-based intervals (0.5 days to 365+ days)
- Difficulty adaptation (1-10 scale)
- Four FSRS states: New, Learning, Review, Relearning

**New FSRS Columns:**
- `stability` (REAL) - Days until 90% recall probability
- `difficulty` (REAL) - Item complexity 1-10
- `due_date` (TIMESTAMPTZ) - When card should be reviewed
- `fsrs_state` (SMALLINT) - 0=New, 1=Learning, 2=Review, 3=Relearning
- `reps` (INTEGER) - Total repetitions
- `lapses` (INTEGER) - Times failed
- `last_seen_at` (TIMESTAMPTZ) - Last exposure (review or oversampling)

#### Phrases Integration
Multi-word expressions now appear in flashcard sessions.

**Features:**
- Phrases introduced after 20% of chapter lemmas learned
- 80/20 lemma-to-phrase ratio in sessions (12 lemmas, 3 phrases per 15-card deck)
- Separate tracking in `user_phrase_progress` table
- Same FSRS scheduling as lemmas
- Purple "Phrase" badge for visual distinction
- Links: phrases → phrase_occurrences → sentences

#### Exposure Insurance
Oversampling prevents stable words from being forgotten.

**Logic:**
- High-activity users (100+ reviews/day): 10 exposure cards per session
- Medium-activity (50-99 reviews/day): 5 exposure cards
- Low-activity (<50 reviews/day): 2 exposure cards
- Stable cards (30+ day stability) resurface every 7-21 days
- Amber "Exposure" badge indicates oversampling

### 🐛 Bug Fixes
- Fixed word duplication in sentences ("el fracaso el fracaso" → "el fracaso")
- Fixed card counts not respecting user settings (was random 12-16, now respects setting)
- Fixed verb conjugations not bolding in sentences (now bolds actual form: "vivía" not "vivir")
- Fixed "Again" button incrementing progress incorrectly (now requeues without advancing)
- Fixed stop word filtering in session builder (was including stop words)

### 🎨 UI/UX Improvements
- Part of speech moved from front to back of card (full word instead of abbreviation)
- Spanish and English sentences both italic for consistency
- English word bolding removed (translations not always literal)
- Floating "+X days" animation replaces ugly yellow notification box
- "New Word" badge moved inside card (top-right corner)
- Badge styling matches header design (cleaner, more subtle)
- Mode toggle hidden during active session (prevents accidental exit)
- Sentence text increased to 18px (better readability)

### 🗄️ Database Changes
- Added 7 FSRS columns to `user_lemma_progress` and `user_phrase_progress`
- Created indexes for efficient due card queries and exposure filtering
- Added `get_chapter_progress()` SQL function for chapter unlocking
- Marked old columns as deprecated (`mastery_level`, `health`, `correct_reviews`)

### 📝 Migration
- Successfully migrated 73 existing user progress records to FSRS
- Preserved all user data (no loss of progress)
- Mapped mastery levels to stability values
- Calculated initial due dates from health values

### 🎯 Study Modes
- **Review Due:** FSRS-scheduled cards + exposure oversampling
- **Learn New:** Unintroduced lemmas + phrases (80/20 mix after 20% threshold)
- **Chapter Focus:** Planned for future (60% due + 20% exposure + 20% overflow)

### 📊 Session Composition
- Default: 25 cards per session (user-configurable in settings)
- Respects user preference from `user_settings` table
- Adapts based on available cards (won't show 25 if only 6 available)

### 🔧 Technical Improvements
- Installed framer-motion for smooth animations
- Created modular service architecture (`fsrsService.js`, `sessionBuilder.js`)
- Separated concerns: scheduling, session building, progress tracking
- Comprehensive error handling and edge case coverage

### 📚 New Documentation
- Created `FSRS_IMPLEMENTATION_SPEC.md` (comprehensive algorithm guide)
- Created `FLASHCARD_BUG_FIXES_SPEC.md` (detailed fix documentation)

### ⚠️ Breaking Changes
- Old `mastery_level` and `health` columns deprecated (will be removed in 30 days)
- Card selection algorithm completely replaced (FSRS-based)
- Progress tracking now uses FSRS state machine instead of custom logic

### 🔮 Future Improvements (Planned)
- Per-user FSRS parameter optimization (after 400+ reviews)
- Chapter Focus study mode implementation
- Homepage dashboard with comprehensive progress tracking
- Personalized difficulty estimation for new words

---

## [2025-12-12] - Database Schema Audit & Cleanup

### Schema Audit Complete

**Comprehensive audit of Supabase database comparing documentation vs actual state.**

**Audit Findings:**
- All 16 active tables verified and documented
- 4 deprecated tables identified from old vocabulary architecture
- All foreign key relationships verified (0 orphan records)
- `validation_reports` schema updated in docs to match actual columns

### Deprecated Tables Archived

**Old vocabulary tables renamed (data preserved for rollback if needed):**

| Old Name | New Name | Rows |
|----------|----------|------|
| `vocabulary` | `vocabulary_deprecated_20251212` | 1,526 |
| `vocabulary_forms` | `vocabulary_forms_deprecated_20251212` | 1,526 |
| `vocabulary_lemmas` | `vocabulary_lemmas_deprecated_20251212` | 1,171 |

**Empty table deleted:**
- `vocabulary_occurrences` (0 rows) - dropped

### Documentation Updated

- **02_DATABASE_SCHEMA.md:** Updated `validation_reports` schema to match actual columns:
  - Added `has_multiple_meanings` (BOOLEAN)
  - Added `alternative_meanings` (JSONB)
  - Added `reviewed_by_human` (BOOLEAN)
  - Changed `suggested_fixes` from array to object
  - Added `created_at` timestamp

### Code Verification

- Confirmed no active code in `src/` references deprecated tables
- Only backup files (`Flashcards.jsx.backup`) and migration scripts reference old tables
- App verified working after schema cleanup

### Migration SQL

SQL script created at `scripts/migration/archive_deprecated_tables.sql` for archiving.

---

## [2025-12-06] - Comprehensive AI Dictionary Form Validation

### Major Milestone: Complete Lemma Quality Assurance ✓

**AI-powered validation crawled all 1,800 lemmas to ensure every entry is the true dictionary form.**

**Final Database Statistics (After Complete Normalization):**
- Chapters: 27
- Sentences: ~700 (all translated)
- Lemmas: **1,658 unique** (reduced from 1,854 after normalization)
- Words: ~12,500 instances (after cleanup)
- Phrases: 844 (bulk approved)

### New AI Validation Tools Created

**1. Dictionary Form Validator (`scripts/validate_dictionary_forms.py`):**
- Processes all lemmas in batches of 30 using Claude AI
- Identifies non-dictionary forms: conjugations, variants, garbage, misspellings
- Outputs detailed JSON report with suggested fixes
- Generates fix scripts automatically

**2. Dictionary Fixes Applier (`scripts/apply_dictionary_fixes.py`):**
- Merges conjugated verbs into infinitives (compran→comprar)
- Deletes garbage lemmas (fake words from spaCy errors)
- Merges adjective/noun variants into canonical forms
- Fixes proper noun capitalization

### Fixes Applied (150 Total)

| Category | Count | Examples |
|----------|-------|----------|
| Conjugations merged | 45 | compran→comprar, comprendo→comprender, duermen→dormir |
| Garbage deleted | 78 | llevarter, trabajer, el administro, viesar |
| Variants merged | 19 | gran→grande, alguna→alguno, el cien→ciento |
| Capitalization | 8 | américa→América, marte→Marte, siberia→Siberia |

### Key Learnings for Future Imports

**spaCy Lemmatization Issues Identified:**
1. Sometimes returns conjugated forms as lemmas (compran instead of comprar)
2. Creates fake "-er" verbs (llevarter, trabajer, tendrar)
3. Treats verb+pronoun constructions as nouns (el hacerlo, la mirarla)
4. Misclassifies past participles as adjectives

**AI Validation is Essential:**
- 17% of initial lemmas had issues requiring correction
- Human review alone would miss many subtle errors
- Batch processing with Claude is cost-effective (~$2 for 1,800 lemmas)

---

## [2025-12-06] - All 27 Chapters Imported + Lemma Normalization Complete

### Major Milestone: El Principito Complete ✓

**All 27 chapters of El Principito have been imported and processed.**

**Database Statistics (Before Final Validation):**
- Chapters: 27
- Sentences: ~700 (all translated)
- Lemmas: 1,854 unique (after normalization)
- Words: ~15,000 instances
- Phrases: 844 (bulk approved)

### Admin Notes Cleanup (24 Lemmas Resolved)

**Category 1 - Garbage Lemmas Deleted (12):**
- siguer, reíster, estabar, respondier, dormirse, preguntier (spaCy conjugation errors)
- erais, hubierais (verb forms incorrectly treated as infinitives)
- creaturas, planetas (noun plurals treated as separate lemmas)
- Words reassigned to canonical forms before deletion

**Category 2 - POS Merges/Reclassifications (7):**
- baobabs (VERB→NOUN): merged into "el baobab"
- admirador (ADJ→NOUN): merged into "el admirador"
- añadiste (VERB form): merged into "añadir"
- amigo (ADJ→NOUN): merged into "el amigo"
- astrónomo (ADJ→NOUN): merged into "el astrónomo"
- buena (ADJ form): merged into "bueno"
- la vién (typo): merged into "venir"

**Category 3 - Lemma Normalizations (2):**
- mecir → mecer (corrected in place)
- tendrer → tender (corrected in place)

**Category 4 - Translation Fixes (2):**
- salir: "to go out" → "to leave"
- bridge (English word): given proper Spanish context

**Category 5 - Valid Items Cleared (3):**
- amanecer: valid as NOUN (el amanecer = the dawn)
- ya: valid as ADV (already/now)
- la boa: valid feminine noun

### Quality Verification

| Check | Result |
|-------|--------|
| Lemmas with admin_notes | 0 ✓ |
| Orphan words (no lemma) | 0 ✓ |
| Verbs missing "to " prefix | 0 ✓ |
| Nouns missing "the " prefix | 0 ✓ |

### Phrase Processing

- Total phrases detected: 844
- All phrases bulk approved (is_reviewed = true)
- Phrase types: idioms, collocations, compounds

### Status: Ready for Comprehensive Quality Review

Next phase: Chapter-by-chapter AI validation to ensure translation accuracy and lemma correctness across all content.

---

## [2025-12-05] - Chapters 3-27 Bulk Import

### Batch Import Complete

**Imported chapters:**
- Chapters 3-10 (batch 1)
- Chapters 11-20 (batch 2)
- Chapters 21-27 (batch 3)

**Process used:**
1. Split combined chapter files using `split_chapters.py`
2. Batch import using `batch_import_chapters.sh`
3. Phrase detection run for each chapter
4. Bulk phrase approval

### Automation Scripts Created

- `scripts/split_chapters.py` - Splits combined chapter files
- `scripts/batch_import_chapters.sh` - Imports multiple chapters sequentially

---

## [2025-12-04] - Chapter 2 Thorough Review & Pipeline Improvements

### Chapter 2: COMPLETE ✓

**Final Import Results:**
- Sentences: 47
- Words: 602
- Unique Lemmas: 244 (after cleanup)
- Phrases: 40 approved (18 rejected)

**Validation Issue Resolution:**
- Started: 66 flagged issues
- Fixed: All 66 resolved
  - Category A (False positives): 8 - ignored
  - Category B (Code fixes): 28 - fixed in import_chapter.py
  - Category C (SQL fixes): 22 - fixed via database updates
  - Category D (Optional): 8 - low priority improvements

**Quality Checks:**
- Verbs missing "to " prefix: 0 ✓
- Nouns missing "the " prefix: 0 ✓
- Data integrity: 100% ✓

### Pipeline Improvements Made

**Code fixes in import_chapter.py:**
1. **GENDER_CORRECTIONS expanded**: Added 13 new feminine nouns (cosa, sorpresa, sed, boa, balsa, etc.)
2. **FEMININE_WITH_EL set**: Added phonetic rule handling (el agua, el hambre)
3. **PRONOUNS_NOT_NOUNS set**: Filter pronouns from noun treatment (conmigo, mío, etc.)
4. **LEMMA_CORRECTIONS dict**: Fixed spaCy lemmatization errors (conocir→conocer, etc.)
5. **PRETERITE_TO_INFINITIVE dict**: Map conjugated forms to infinitives (viví→vivir, etc.)
6. **POS_CORRECTION section**: Fix misclassified verb forms, adverbs, nouns

**New SQL fix script:**
- Created `scripts/fix_chapter2_issues.sql` for reference

### Phrases Approved (40)
Notable idioms: por favor, cuestión de vida o muerte, ponerse en pie, de un salto,
muerto de cansancio, en absoluto, no importa, por fin, volver a, ser capaz de

### Status: Ready for Chapter 3 import

---

## [2025-12-04] - Pre-Chapter-2 Audit & Phrase Detection

### Pre-Import Audit Complete

**Documentation Verified:**
- 02_DATABASE_SCHEMA.md: Updated with correct column names (component_lemmas, start_position)
- 03_CONTENT_PIPELINE.md: All 9 steps documented including Step 8b (Phrase Detection)
- 04_LEARNING_ALGORITHM.md: Phrase flashcards section added (deferred to post-MVP)
- 99_LIVING_CHANGELOG.md: Current and accurate

**Chapter 1 Final State:**
- Sentences: 26
- Lemmas: 181 unique
- Words: 427
- Phrases: 36 detected, 20 approved
- Translation quality: 100% (0 missing prefixes)
- Data integrity: 100% (0 orphan records)

**New Documentation:**
- Created 30_CHAPTER_IMPORT_CHECKLIST.md with full import process

**Automation Status: READY FOR SCALE**
- All 9 pipeline steps automated
- Manual review required: AI validation issues, phrase approval, native speaker sample
- Estimated time per chapter: 30-60 minutes

---

## [2025-12-04] - Phrase Detection System

### Added
- **3 new database tables:**
  - `phrases`: Stores idiomatic expressions with definitions, type, component lemma IDs
  - `phrase_occurrences`: Links phrases to sentences with word positions
  - `user_phrase_progress`: Tracks user mastery of phrases (parallel to lemma progress)

- **Phrase detection via Claude API in content pipeline:**
  - `detect_phrases_in_sentence()`: AI-powered phrase identification
  - `detect_phrases_for_chapter()`: Batch processing for chapters
  - Confidence threshold >= 80 for inclusion
  - Phrase types: idiom, collocation, compound

- **CLI commands:**
  - `--detect-phrases --chapter N`: Run phrase detection on chapter
  - `--show-phrases --chapter N`: Display detected phrases with counts

- **Detection of idiomatic expressions:**
  - "personas mayores" (grown-ups) - compound
  - "dar miedo" (to scare) - idiom
  - "selva virgen" (primeval forest) - compound
  - "tener razón" (to be right) - collocation

### Updated
- **02_DATABASE_SCHEMA.md:** Added Phrase Tables section with full schema documentation
- **03_CONTENT_PIPELINE.md:** Added Step 8b - Detect Idiomatic Phrases
- **04_LEARNING_ALGORITHM.md:** Added Future: Phrase Flashcards section
- **AI validation prompt:** Updated to understand app's format conventions (article in Spanish lemma, "the" in English translation)

### Tested
- Chapter 1 phrase detection ready to run
- Expected phrases: "personas mayores" (grown-ups)

### Status
- Phrase detection functional
- Flashcard integration deferred to post-MVP

---

## Version History

### [0.1.0] - Foundation (Nov 2025)

**Status:** Pre-MVP, Documentation & Architecture Phase

#### Added
- **Documentation Tiers (28 documents total):**
  - Tier 1: Foundation (8 docs) - Overview, MVP, database, pipeline, algorithm, design, architecture, testing
  - Tier 2: Core Systems (5 docs) - Auth, reading, flashcards, progress, admin
  - Tier 3: UI/UX (4 docs) - Component library, design system, accessibility, responsive design
  - Tier 4: Operations (5 docs) - Testing, deployment, security, monitoring, error handling
  - Tier 5: Growth (4 docs) - Analytics, marketing, content roadmap, feature prioritization
  - Living Docs (2 docs) - Changelog, FAQ

- **Database Schema v2.0:**
  - Simplified architecture: lemmas (canonical) + words (instances)
  - Users master lemmas, not individual word forms
  - Prevents deck flooding with conjugations/inflections
  - Full migration plan documented

- **Learning Algorithm:**
  - 10 mastery levels (0-100 scale)
  - Health system (0-100, decays over time)
  - Time-gated mastery (prevents rapid-fire gaming)
  - Priority scoring (health + frequency + chapter + mastery)
  - Dual-path chapter unlocking (quality OR quantity)

- **Design System:**
  - Little Prince aesthetic (warm, storybook feel)
  - Mobile-first approach
  - Accessibility standards (WCAG 2.1 Level AA)
  - Component specifications

#### Changed
- Shifted from immediate implementation to foundation-first approach
- Prioritized documentation before code
- Redesigned database for scalability

#### Decisions Made
- Use lemmas as primary learning unit (not individual word forms)
- Health decay system for urgency prioritization
- Time gates prevent gaming the mastery system
- Dual-track metrics: mastery (quality) + exposure (quantity)
- 99%+ translation accuracy requirement

---

### [0.0.1] - Legacy System (Pre-Nov 2025)

**Status:** PHP-based predecessor (being modernized)

#### Existed
- PHP backend with MySQL
- Basic flashcard system
- "El Principito" content imported
- Simple progress tracking
- Working but not scalable

#### Why Rebuild
- Modern tech stack needed (React + Supabase)
- Better UX required
- Scalability issues
- Hard to maintain PHP codebase
- Opportunity to improve learning algorithm

---

## Future Releases (Planned)

### [0.2.0] - MVP Launch (Target: Q1 2026)

#### Planned Features
- User authentication (email/password)
- Reading mode (El Principito chapters)
- Flashcard study sessions
- Progress tracking (mastery, health, streaks)
- Chapter unlocking system
- Basic responsive design

#### Success Criteria
- 200+ users
- 40%+ day 1 retention
- 80%+ session completion rate
- No critical bugs

---

### [0.3.0] - Polish & Engagement (Target: Q2 2026)

#### Planned Features
- Word lookup in reading mode (click → see definition)
- Daily packages (50/100/150/250 word commitments)
- Basic badges (completion, streaks, milestones)
- Improved session summaries
- Share to social media

#### Success Criteria
- 500+ users
- 30%+ day 7 retention
- 4+ sessions per user per week

---

### [0.4.0] - Advanced Learning (Target: Q3 2026)

#### Planned Features
- Spaced repetition improvements
- Word notes & mnemonics
- Weak word focus mode
- Audio pronunciation (if budget allows)
- Book 2 (different difficulty level)

#### Success Criteria
- 1,000+ users
- 20+ words mastered per user per week
- <5% content quality complaints

---

### [1.0.0] - Full Release (Target: Q4 2026)

#### Planned Features
- Multiple books available
- Polished UX
- Community features (friends, optional leaderboards)
- Performance optimizations
- Mobile app consideration

#### Success Criteria
- 2,000+ users
- 20%+ day 30 retention
- 4.5/5 average rating
- Revenue model validated

---

## Migration History

### Database Migrations

#### Migration: New Schema (Planned Q4 2025)
**File:** `21_MIGRATION_PLAN.md`  
**Changes:**
- Add `lemmas` table (canonical forms)
- Add `words` table (instances, link to lemmas)
- Add `user_lemma_progress` (track mastery per lemma)
- Add `user_word_encounters` (track which forms seen)
- Migrate existing vocabulary data
- Update all queries to use new schema

**Impact:** Breaking change, requires data migration  
**Rollback:** Migration plan includes rollback script

---

## Known Issues

### Current (Pre-MVP)
- [ ] Old PHP system still running (legacy)
- [ ] Database schema not yet migrated
- [ ] Content pipeline not yet implemented
- [ ] No production deployment yet

### Planned Fixes
- Migrate database (Q4 2025)
- Implement new React app (Q4 2025)
- Deploy to Netlify + Supabase (Q1 2026)
- Sunset PHP system (Q1 2026)

---

## Breaking Changes

### Future Breaking Changes (Planned)

#### Database Schema v2.0
**When:** Q4 2025  
**Impact:** All old data must be migrated  
**Migration:** Automated migration script provided  
**Downtime:** ~30 minutes estimated

#### API Changes
**When:** MVP launch (Q1 2026)  
**Impact:** Old API endpoints deprecated  
**Migration:** New endpoints documented in 08_ARCHITECTURE.md

---

## Deprecations

### Currently Deprecated
- PHP backend (will be sunset after React migration complete)
- Old MySQL schema (will be migrated to new Supabase schema)

### Future Deprecations
- None planned yet

---

## Security Updates

### Planned Security Implementations

#### MVP Launch (Q1 2026)
- Supabase Auth with email verification
- Row Level Security (RLS) policies on all tables
- HTTPS enforcement (Netlify + Supabase)
- Secure headers (CSP, X-Frame-Options, etc.)
- Input validation on all user inputs

**See:** `18_SECURITY.md` for full details

---

## Performance Improvements

### Planned Optimizations

#### MVP Launch
- Code splitting (React lazy loading)
- Image optimization (WebP format)
- Lighthouse score >90
- Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)

#### Post-MVP
- Database query optimization
- CDN for static assets
- Service worker for offline support

**See:** `19_MONITORING.md` for metrics

---

## Documentation Updates

### Major Documentation Releases

#### 2025-11-30: Foundation Documentation Complete
**Tiers 1-5 + Living Docs:**
- 28 documents created (~250 pages)
- Complete system specification
- Ready for implementation phase

#### 2025-11-09: Algorithm Bible v1.0
- Complete learning algorithm specification
- 10 mastery levels defined
- Health system specified
- Priority scoring formulas
- Chapter unlocking logic

#### 2025-11-08: Database Schema Redesign
- New lemma-based architecture
- Migration plan created
- Scalability improvements

---

## Community & Contributions

### Planned Community Features

#### Post-MVP (Q2 2026)
- Discord server launch
- User feedback system
- Beta testing program
- Public roadmap

#### Future (Year 2)
- Open-source components
- API for third-party integrations
- User-generated content (curated)

---

## Analytics & Metrics

### Key Metrics (To Be Tracked Post-Launch)

**Growth:**
- Daily/Weekly/Monthly Active Users
- New signups per week
- Signup conversion rate

**Engagement:**
- Session completion rate
- Average session duration
- Streak maintenance rate

**Learning:**
- Words mastered per user
- Chapter completion rate
- Retention curves

**See:** `24_ANALYTICS_STRATEGY.md` for full details

---

## Related Documents

- **23_DECISION_LOG.md** - Major project decisions
- **27_FEATURE_PRIORITIZATION.md** - What's being built when
- **26_CONTENT_ROADMAP.md** - Content expansion plans
- **00_PROJECT_OVERVIEW.md** - Overall vision

---

## How to Update This Changelog

**When to update:**
- Before each release (summarize changes)
- After major features shipped
- When breaking changes made
- When security issues fixed

**Format:**
```markdown
### [Version] - Name (Date)

#### Added
- New feature 1
- New feature 2

#### Changed
- Modified feature

#### Fixed
- Bug fix

#### Security
- Security improvement
```

**Best practices:**
- Keep entries concise
- Link to relevant docs
- Note breaking changes
- Credit contributors (future)

---

## Changelog Archive

Older versions will be archived here as the project grows.

---

**END OF CHANGELOG**

*This is a living document. It will be updated as the project evolves.*
