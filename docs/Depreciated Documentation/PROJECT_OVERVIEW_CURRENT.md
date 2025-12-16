# Voquab Project Overview
**Generated: November 26, 2025**

A Spanish vocabulary learning app focused on "El Principito" (The Little Prince) with spaced repetition, health-based review scheduling, and chapter-based progression.

---

## SECTION 1 - PROJECT STRUCTURE

### Directory Layout
```
/home/peter/voquab/
├── src/
│   ├── components/
│   │   ├── flashcard/          # NEW - Extracted flashcard components
│   │   │   ├── FlashcardDisplay.jsx    (138 lines)
│   │   │   ├── DifficultyButtons.jsx   (74 lines)
│   │   │   ├── SessionStats.jsx        (125 lines)
│   │   │   ├── WordStatusCard.jsx      (132 lines)
│   │   │   └── ChapterCompleteScreen.jsx (59 lines)
│   │   ├── ChapterCard.jsx
│   │   ├── ChapterUnlockModal.jsx
│   │   ├── CalendarView.jsx
│   │   ├── BadgeNotification.jsx
│   │   ├── LevelUpCelebration.jsx
│   │   └── ProtectedRoute.jsx
│   │
│   ├── hooks/
│   │   └── flashcard/          # NEW - Extracted flashcard hooks
│   │       ├── useFlashcardData.js     (216 lines)
│   │       ├── useFlashcardSession.js  (174 lines)
│   │       └── useProgressTracking.js  (195 lines)
│   │
│   ├── pages/
│   │   ├── Flashcards.jsx      (339 lines - DOWN FROM 2,522!)
│   │   ├── Book.jsx
│   │   ├── Home.jsx
│   │   ├── Progress.jsx
│   │   ├── ReadingMode.jsx
│   │   ├── Settings.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Admin.jsx
│   │   └── AdminCommonWords.jsx
│   │
│   ├── utils/
│   │   ├── healthCalculations.js       (92 lines)
│   │   ├── timeGateCalculations.js     (204 lines)
│   │   ├── priorityCalculations.js     (237 lines)
│   │   ├── masteryIntervals.js         (82 lines)
│   │   ├── badgeCalculations.js        (228 lines)
│   │   └── packageCalculations.js      (555 lines)
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx
│   │
│   ├── lib/
│   │   └── supabase.js
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── scripts/
│   ├── fix-noun-lemmas.js              # Adds el/la to noun lemmas
│   ├── translate-missing-lemmas.js     # DeepL batch translation
│   ├── lemmatize.py                    # Python lemmatization with spaCy
│   ├── migrate-to-lemma-architecture.js
│   ├── link-vocabulary-forms.js
│   ├── consolidate-vocabulary.js
│   ├── extract-vocabulary.js
│   ├── import-multiple-chapters.js
│   └── update-stop-words.js
│
├── docs/
│   └── PROJECT_OVERVIEW_CURRENT.md     # This file
│
└── public/
```

### Architecture Overview

**Component Pattern:**
- Pages handle routing and high-level state
- Components are presentational with props
- Hooks encapsulate business logic and data fetching
- Utils contain pure functions for calculations

**Data Flow (Flashcards):**
```
Flashcards.jsx (Page)
    ↓
useFlashcardData() → Supabase → vocabulary + progress
    ↓
useFlashcardSession() → Card queue, flip state, ratings
    ↓
useProgressTracking() → Database updates
    ↓
FlashcardDisplay, DifficultyButtons, SessionStats (Components)
```

---

## SECTION 2 - WHAT'S IMPLEMENTED

### Flashcard System

**Working:**
- Card display with Spanish front / English back
- Flip on click or spacebar
- Four difficulty buttons (Don't Know, Hard, Medium, Easy)
- Keyboard shortcuts (1, 2, 3, 4, Space)
- Session progress tracking (cards reviewed, ratings count)
- Chapter focus mode (study only one chapter's words)
- Priority-based card selection algorithm
- Health decay over time
- Mastery progression with time gates

**Partially Working:**
- Canonical lemma display (works when data exists, fallback for missing)
- Example sentences (query fixed, need to verify data exists)
- Health calculation (fixed NaN bug, now working)
- Card advancement (fixed isFlipped check, now working)

**Not Working:**
- Canonical relationships in database (most verbs missing canonical_vocab_id)
- Some translations missing or showing Spanish word
- form_metadata not populated for verb conjugations

### Database Schema

**vocabulary table:**
```sql
vocab_id (uuid, PK)
lemma (text) - The word form as encountered
english_definition (text)
part_of_speech (text) - NOUN, VERB, ADJ, etc.
language_code (text) - 'es'
frequency (integer) - Rank in book
is_stop_word (boolean)
is_canonical (boolean) - TRUE if this is the dictionary form
canonical_vocab_id (uuid, FK) - Points to canonical form if this is a conjugation
form_metadata (jsonb) - Grammatical info: {Tense, Person, Number, Gender}
created_at, updated_at
```

**user_vocabulary_progress table:**
```sql
user_id (uuid, FK)
vocab_id (uuid, FK)
health (integer) - 0-100
mastery_level (integer) - 0-100
total_reviews (integer)
correct_reviews (integer)
last_reviewed_at (timestamp)
last_correct_review_at (timestamp)
created_at, updated_at
PRIMARY KEY (user_id, vocab_id)
```

**user_daily_stats table:**
```sql
user_id (uuid, FK)
review_date (date)
words_reviewed (integer) - Note: NOT total_reviews!
current_streak (integer)
PRIMARY KEY (user_id, review_date)
```

**chapters table:**
```sql
chapter_id (uuid, PK)
chapter_number (integer)
title (text)
```

**sentences table:**
```sql
sentence_id (uuid, PK)
chapter_id (uuid, FK)
sentence_text (text)
sentence_translation (text)
```

**vocabulary_occurrences table:**
```sql
vocab_id (uuid, FK)
sentence_id (uuid, FK)
```

### Lemma Architecture Status

**Design Intent:**
- Verb forms (contestaban) link to infinitive (contestar) via canonical_vocab_id
- Nouns have article prefix (el libro, la casa)
- Flashcards show canonical form large, encountered form small
- Translations come from canonical entry

**Current State:**
- Architecture columns exist (is_canonical, canonical_vocab_id, form_metadata)
- ~347 nouns have el/la articles added
- ~340 lemmas translated via DeepL
- MOST VERB FORMS MISSING canonical_vocab_id links
- form_metadata mostly empty

### Health System

**Implemented:**
- Health decays over time based on mastery level
- Higher mastery = slower decay
- Health boosts on review: Easy=100, Medium=60, Hard=30, Don't Know=10
- Health status: CRITICAL (<20), LOW (<40), MEDIUM (<60), GOOD (<80), EXCELLENT

**Decay Rates (points per day):**
- Level 0: 25/day (critical in 4 days)
- Level 5: 3/day (critical in 26 days)
- Level 10: 0.5/day (critical in 160 days)

### Mastery System

**Implemented:**
- Mastery increases on correct reviews (Easy = +10)
- Mastery decreases on "Don't Know" (-15)
- Time gates prevent mastery grinding
- Checkpoint regression on "Hard"

**Time Gates (hours between mastery gains):**
- Level 0: No gate
- Level 1: 4 hours
- Level 5: 168 hours (7 days)
- Level 10: 4320 hours (180 days)

### Chapter Unlocking (Partially Implemented)

**Design:**
- Chapters unlock when previous chapter's words reach threshold
- Progress shown as percentage

**Status:**
- UI exists for chapter cards
- Unlock logic in updateChapterProgress() is placeholder
- Chapter focus mode works for already-unlocked chapters

---

## SECTION 3 - RECENT CHANGES (Nov 26, 2025)

### Files Created (Refactoring)

| File | Lines | Purpose |
|------|-------|---------|
| src/components/flashcard/FlashcardDisplay.jsx | 138 | Card front/back with canonical support |
| src/components/flashcard/DifficultyButtons.jsx | 74 | Four rating buttons with keyboard hints |
| src/components/flashcard/SessionStats.jsx | 125 | Progress bar, timer, chapter focus banner |
| src/components/flashcard/WordStatusCard.jsx | 132 | Health/mastery display |
| src/components/flashcard/ChapterCompleteScreen.jsx | 59 | Chapter completion celebration |
| src/hooks/flashcard/useFlashcardData.js | 216 | Data fetching with lemma architecture |
| src/hooks/flashcard/useFlashcardSession.js | 174 | Session state, card queue, keyboard |
| src/hooks/flashcard/useProgressTracking.js | 195 | Database updates for progress |

### Files Modified

| File | Change |
|------|--------|
| src/pages/Flashcards.jsx | Reduced from 2,522 to 339 lines (87% reduction) |
| src/components/ChapterCard.jsx | Updated to pass chapter number in URL |
| scripts/lemmatize.py | Added el/la article prefixes for nouns |
| scripts/fix-noun-lemmas.js | Created to fix existing noun lemmas |
| scripts/translate-missing-lemmas.js | Created for DeepL batch translation |

### Bugs Fixed Today

1. **selectCardsForSession return type** - Was returning object, expected array. Fixed by extracting `.cards` property.

2. **canGainMastery undefined** - Variable referenced but not defined. Fixed by using `masteryResult.timeGateInfo.canGainMastery`.

3. **NaN health calculation** - `card.current_health` was object not number. Fixed with type checking.

4. **Card not advancing** - Hook still had `if (!isFlipped) return` check. Removed.

5. **total_reviews column** - Database uses `words_reviewed`. Fixed column name.

6. **updated_at column** - Doesn't exist in user_daily_stats. Removed from update.

7. **Verb translations missing "to"** - Added prefix for VERB part_of_speech.

8. **Sentence query .limit(1)** - Was limiting to 1 total. Removed limit, added !inner join.

### Known Issues Introduced

1. Many debug console.log statements added (temporary)
2. Removed showingAnswer requirement from buttons (intentional per user request)

---

## SECTION 4 - DATABASE STATE

### vocabulary table

**Total rows:** ~1000+ (estimated)

**Data Quality Issues:**
- Many verbs have `is_canonical: true` but should be `false`
- Most verbs missing `canonical_vocab_id` (should point to infinitive)
- `form_metadata` mostly empty for verb conjugations
- Some `english_definition` values are the Spanish word (no translation)
- ~347 nouns have el/la articles (fixed)
- ~340 lemmas translated via DeepL

### vocabulary_lemmas table

**Status:** May exist but unused in current code

### user_vocabulary_progress table

**Columns verified working:**
- health, mastery_level, total_reviews, correct_reviews
- last_reviewed_at, last_correct_review_at

### user_daily_stats table

**Columns verified:**
- words_reviewed (NOT total_reviews!)
- current_streak
- review_date

**Missing columns (code tried to use):**
- total_reviews (doesn't exist)
- updated_at (doesn't exist)

---

## SECTION 5 - KNOWN BUGS & ISSUES

### Critical (Blocking Functionality)

1. **Canonical relationships missing** - Verb forms don't link to infinitives
   - Impact: Cards show "DESILUSIONADO" instead of "DESILUSIONAR (desilusionado)"
   - Fix: Database migration script needed

### Non-Critical (Affecting UX)

1. **Example sentences may not display** - Query fixed, need to verify data
2. **Grammatical context empty** - form_metadata not populated
3. **Some translations are Spanish words** - Translation coverage incomplete

### Data Quality Issues

1. ~60% of verbs have incorrect is_canonical=true
2. canonical_vocab_id mostly NULL for verb forms
3. form_metadata ({Tense, Person, Number}) not populated
4. Some vocabulary entries are duplicates

### Missing Features (From Algorithm Bible)

1. Chapter unlock progress tracking
2. Leech detection (words failed repeatedly)
3. Badge system (UI exists, logic incomplete)
4. Reading mode integration with flashcards
5. Streak bonus multipliers

---

## SECTION 6 - CODE QUALITY

### Debug Logging (Temporary - Remove Before Production)

| Location | Log Prefix | Purpose |
|----------|------------|---------|
| useFlashcardData.js | 📊 Debug Info | Vocab/progress counts |
| useFlashcardData.js | 📝 Sentence fetch | Sentence query results |
| useFlashcardSession.js | 🎴 Before/After selection | Card selection debugging |
| useFlashcardSession.js | 🔧 Selection result | Verify selection works |
| useProgressTracking.js | 🏥 Health calculation | Health value extraction |
| FlashcardDisplay.jsx | 🎴 Display logic | Canonical form debugging |
| Flashcards.jsx | 🎯 Button clicked | Button handler debugging |
| priorityCalculations.js | 📊 WORD SELECTION RATIONALE | Top 10 card selection |

### Error Handling

**Good:**
- useProgressTracking has try/catch with console.error
- updateDailyStats has individual error handling per operation
- Supabase errors logged

**Needs Improvement:**
- No user-facing error messages (only console)
- No retry logic for failed database operations
- No offline handling

### Performance Concerns

1. Sentence query fetches ALL occurrences, should limit per vocab_id
2. No pagination for large vocabulary sets
3. Priority calculation runs on every card (O(n log n) sort)
4. Multiple sequential Supabase calls in useFlashcardData

### Technical Debt

1. Duplicate components (WordStatusCard in both /components and /components/flashcard)
2. Some utility functions duplicated between files
3. Flashcards.jsx.backup should be removed after verification
4. Console.log statements need removal

---

## SECTION 7 - TESTING STATUS

### Manually Tested (Nov 26)

- [x] Card display (Spanish side)
- [x] Card flip (click and spacebar)
- [x] Button clicks trigger handlers
- [x] Card advances after rating
- [x] Health calculates correctly (no NaN)
- [x] Daily stats update (words_reviewed column)
- [x] Chapter focus mode loads chapter cards
- [x] Priority selection returns cards

### Needs Testing

- [ ] Full session completion flow
- [ ] "Don't Know" requeue behavior
- [ ] Time gate messages display
- [ ] Mastery increases correctly
- [ ] Health decay over time
- [ ] Session ratings summary accuracy
- [ ] Chapter complete screen triggers
- [ ] Streak calculation
- [ ] Multiple users (isolation)

### Edge Cases Identified

1. What happens with 0 cards in chapter?
2. What if all cards at 100% health?
3. What if user has no progress records?
4. What if Supabase connection fails mid-session?
5. What if user rapidly clicks multiple buttons?
6. What if session times out?

---

## Quick Reference

### Key File Locations

| Functionality | File |
|--------------|------|
| Flashcard page | src/pages/Flashcards.jsx |
| Card display | src/components/flashcard/FlashcardDisplay.jsx |
| Data fetching | src/hooks/flashcard/useFlashcardData.js |
| Session logic | src/hooks/flashcard/useFlashcardSession.js |
| Progress updates | src/hooks/flashcard/useProgressTracking.js |
| Health calculations | src/utils/healthCalculations.js |
| Mastery/time gates | src/utils/timeGateCalculations.js |
| Priority scoring | src/utils/priorityCalculations.js |

### Database Tables

| Table | Purpose |
|-------|---------|
| vocabulary | Words with lemma, translation, POS |
| user_vocabulary_progress | Per-user health/mastery tracking |
| user_daily_stats | Daily review counts, streaks |
| chapters | Book chapters |
| sentences | Example sentences |
| vocabulary_occurrences | Word-to-sentence mapping |

---

*Document generated by Claude Code assistant*
*Last updated: November 26, 2025*
