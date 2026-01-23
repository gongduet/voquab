# 32_FRAGMENT_FLASHCARDS.md

**Last Updated:** January 22, 2026
**Status:** Implemented
**Owner:** Claude + Peter

> **Update (Jan 22, 2026 - PM):** Fixed critical bugs with position tracking and session counts. Added FeedbackPrompt support for fragments. See [Recent Bug Fixes](#recent-bug-fixes) section.

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Learning Philosophy](#learning-philosophy)
3. [Two Modes](#two-modes)
4. [Unlock Logic](#unlock-logic)
5. [FSRS Scheduling](#fsrs-scheduling)
6. [UI/UX Patterns](#uiux-patterns)
7. [Database Tables](#database-tables)
8. [Routes & Navigation](#routes--navigation)
9. [Technical Architecture](#technical-architecture)
10. [Recent Bug Fixes](#recent-bug-fixes)

---

## OVERVIEW

Fragment flashcards are a bridge between vocabulary learning and full reading comprehension. Instead of jumping from individual word meanings directly to full sentences, users practice with **sentence fragments** - meaningful chunks of 2-5 words that build up reading fluency.

**Example Fragment:**
- Fragment: "el hombre se alejaba"
- Translation: "the man was walking away"
- Full sentence context: "El hombrecito miró cómo el hombre se alejaba lentamente."

---

## LEARNING PHILOSOPHY

### Why Fragments?

1. **Gradual progression**: Vocabulary → Fragments → Full reading
2. **Chunk recognition**: Train brain to recognize common word patterns
3. **Reduced cognitive load**: Smaller units are easier to process
4. **Context building**: Fragments appear in full sentence context

### Design Principles

- **Stepping stone, not destination**: Fragments shouldn't dominate study time
- **Lower retention = longer intervals**: Less frequent review than vocabulary
- **One pass + spaced review**: Complete chapter sequentially, then occasional review
- **Unlock with vocabulary**: Fragments available only after 95% vocab mastery

---

## TWO MODES

### Read Mode

**Route:** `/fragments/read/:chapterId`

**Purpose:** Sequential progression through all chapter fragments

**Features:**
- Progress from where user left off
- Session chunks extend to paragraph boundaries
- Track fragments_seen / total_fragments
- "Read Chapter" button when complete

**Session Building:**
1. Get user's last position in chapter
2. Fetch next ~15 fragments from that position
3. Extend to paragraph boundary (don't cut mid-paragraph)
4. Return fragments with full sentence context

### Review Mode

**Route:** `/fragments/review/:bookId`

**Purpose:** FSRS-based spaced repetition for challenging fragments

**Features:**
- Pull due fragments across all unlocked chapters
- Sort by most overdue first
- Same 4-button rating (Again/Hard/Got It/Easy)
- Shows in "Fragments Due (N)" button when available

**Session Building:**
1. Query user_fragment_progress where next_review_at <= now
2. Filter to unlocked chapters only
3. Sort by overdue amount
4. Return up to session size (default 15)

---

## UNLOCK LOGIC

### Chapter Fragments Unlock When:

**Two conditions must be met:**

1. **Vocabulary >= 95%:** `(mastered + familiar + learning) / total_vocab >= 0.95`
2. **Previous chapter fragments complete:** `prevChapter.is_read_complete === true`

Exception: Chapter 1 only requires condition 1 (no previous chapter).

### Sequential Progression

Fragments follow a sequential unlock pattern:
- Chapter 1: Vocab >= 95%
- Chapter 2: Vocab >= 95% AND Chapter 1 fragments complete
- Chapter 3: Vocab >= 95% AND Chapter 2 fragments complete
- etc.

This ensures users build comprehension skills progressively.

### UI States in Chapter Cards:

| Vocab Progress | Prev Ch. Frags | Fragment State | Button Display |
|----------------|----------------|---------------|----------------|
| < 95% | - | Locked | No fragment button |
| >= 95% | Incomplete | Blocked | "Complete Ch. N first" |
| >= 95% | Complete/N/A | Unlocked | "Start Fragments" |
| >= 95% | Complete | In Progress | "Resume (N/M)" |
| >= 95% | Complete | Complete | "Read Chapter" |

---

## FSRS SCHEDULING

### Lower Retention Target

| Setting | Words/Phrases | Fragments |
|---------|--------------|-----------|
| `request_retention` | 0.94 | 0.80 |
| Got It (first) | ~7 days | **14 days** |
| Got It (later) | ~28 days | ~45-60 days |

### Skip Learning Phase for New Fragments

**Key Design Decision:** New fragments bypass the FSRS Learning state entirely.

Standard FSRS has a Learning phase with short intervals (1 min, 10 min) before graduating to Review state. This makes sense for rote vocabulary memorization, but fragments are **comprehension-focused** - once a user understands a fragment, they don't need short-interval reinforcement.

**Custom intervals for NEW fragments:**

| Rating | Interval | State |
|--------|----------|-------|
| Again | 10 min | Learning (requeue) |
| Hard | 3 days | Review |
| Got It | **14 days** | Review |
| Easy | 30 days | Review |

After the first review, fragments use standard FSRS scheduling with 0.80 retention.

### Rationale

Fragments are meant to be a stepping stone:
- User understands meaning once → occasional reinforcement
- Not designed for intensive memorization
- Lower retention = longer intervals = less time on fragments
- Skip Learning phase = immediate long-term scheduling

### Implementation

```javascript
// src/config/fsrsConfig.js
export const FSRS_CONFIG = {
  REQUEST_RETENTION: 0.94,           // Words/phrases
  FRAGMENT_REQUEST_RETENTION: 0.80,  // Fragments
}

// src/services/fsrsService.js
export function scheduleFragmentCard(card, rating) {
  // NEW fragments: Skip Learning, go directly to Review with custom intervals
  if (isNewCard) {
    // Hard=3d, Got It=14d, Easy=30d
  }
  // Reviewed fragments: Use normal FSRS with 0.80 retention
}
```

---

## UI/UX PATTERNS

### Flashcard Display

Fragment cards use the same FlashcardDisplay component as words/phrases:

**Front:**
- Large fragment text (Spanish)
- Divider line
- Full sentence with fragment portion **bolded**
- "Fragment" badge (top-left)
- "New" badge (top-right) if first time seeing fragment

**Back:**
- Large fragment translation (English)
- Divider line
- Full sentence translation (only on last fragment of sentence to avoid spoilers)

**Both Sides:**
- 4 rating buttons (Again/Hard/Got It/Easy) - visible on front and back
- FeedbackPrompt ("Something wrong? Let us know.")

### Sentence Translation Display

**Important:** Full sentence translation only appears on the **last fragment of each sentence**. This prevents revealing translations prematurely when a sentence has multiple fragments.

```javascript
// isLastFragmentInSentence is calculated by finding max fragment_order per sentence
{card.sentence_translation && card.isLastFragmentInSentence && (
  <p>{card.sentence_translation}</p>
)}
```

### Session Header

**Read Mode Header:**
- "Exit" button (left) - returns to dashboard
- "Read Mode" badge (center, amber background)
- Progress counter "X / Y" (right)
- Section indicator below: "Fragments X-Y of Z" showing position within chapter

### Session Summary

After completing a fragment session:
- Success rate, card count, rating breakdown
- "Needs Attention" section for fragments rated Again or Hard
- **Continue Reading** button (amber) - loads next batch of fragments
- **"Chapter Complete!"** message when all fragments in chapter reviewed
- **"Saving progress..."** loading state prevents clicking Continue before DB save completes

### Progress Bar in Chapter Cards

Two progress bars in chapter carousel:
1. **Vocabulary bar** (blue tones) - existing
2. **Fragment bar** (amber/gold tones) - new

Colors:
- Seen: `#d97706` (amber-600)
- Complete: `#92400e` (amber-800)
- Background: `#fef3c7` (amber-100)

### Dashboard Buttons

**Fragments Due Button:**
- Orange background (#f97316)
- Shows when fragmentsDueCount > 0
- Navigates to `/fragments/review/:bookId`

---

## DATABASE TABLES

### user_fragment_progress

Individual fragment FSRS tracking.

```sql
CREATE TABLE user_fragment_progress (
  progress_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  fragment_id UUID REFERENCES sentence_fragments(fragment_id),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  fsrs_state SMALLINT DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  UNIQUE(user_id, fragment_id)
);
```

### user_chapter_fragment_progress

Chapter-level read mode progress.

```sql
CREATE TABLE user_chapter_fragment_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  chapter_id UUID REFERENCES chapters(chapter_id),
  fragments_seen INTEGER DEFAULT 0,
  total_fragments INTEGER NOT NULL,
  last_fragment_order INTEGER DEFAULT 0,
  last_sentence_order INTEGER DEFAULT 0,
  is_read_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, chapter_id)
);
```

---

## ROUTES & NAVIGATION

### Routes

| Route | Component | Mode |
|-------|-----------|------|
| `/fragments/read/:chapterId` | FragmentFlashcards | READ |
| `/fragments/review/:bookId` | FragmentFlashcards | REVIEW |

### Navigation Flow

```
BookDashboard
├── "Fragments Due (N)" → /fragments/review/:bookId
│
└── ChapterCarousel
    └── Chapter Card
        ├── "Start Fragments" → /fragments/read/:chapterId
        ├── "Resume (N/M)" → /fragments/read/:chapterId
        └── "Read Chapter" → /read/:chapterNumber
```

---

## TECHNICAL ARCHITECTURE

### Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260122_fragment_progress.sql` | Database tables + RLS |
| `src/pages/FragmentFlashcards.jsx` | Main fragment flashcard page |
| `src/hooks/flashcard/useFragmentSession.js` | Session state management |
| `src/hooks/flashcard/useFragmentProgressTracking.js` | Progress updates |
| `src/services/fragmentSessionBuilder.js` | Session building logic |

### Files Modified

| File | Changes |
|------|---------|
| `src/App.jsx` | Added fragment routes |
| `src/config/fsrsConfig.js` | Added FRAGMENT_REQUEST_RETENTION |
| `src/services/fsrsService.js` | Added scheduleFragmentCard() |
| `src/components/flashcard/FlashcardDisplay.jsx` | Fragment card type |
| `src/pages/BookDashboard.jsx` | Fragments due button |
| `src/components/dashboard/ChapterCarousel.jsx` | Fragment progress bar |

### Data Flow

```
FragmentFlashcards.jsx
    │
    ├── useFragmentSession() ← Manages card queue, flip state
    │       │
    │       └── Session initialized from fragmentSessionBuilder
    │
    └── useFragmentProgressTracking() ← Updates DB on rating
            │
            ├── updateFragmentProgress() → user_fragment_progress
            ├── updateChapterProgress() → user_chapter_fragment_progress
            └── updateDailyStats() → user_daily_stats
```

---

## RECENT BUG FIXES

### January 22, 2026 (Evening)

#### 1. FSRS Scheduling: 10 Minutes → 14 Days

**Problem:** "Got It" on a new fragment showed "10 min" interval instead of 14-21 days.

**Root Cause:** FSRS Learning state. Standard FSRS puts new cards through a Learning phase with short intervals (1 min, 10 min) before graduating to Review state.

**Fix:** New fragments now skip Learning entirely and go directly to Review state:
```javascript
// src/services/fsrsService.js - scheduleFragmentCard()
if (isNewCard) {
  switch (rating) {
    case 'again': intervalDays = 1/144; state = LEARNING; break;  // 10 min
    case 'hard':  intervalDays = 3;     state = REVIEW; break;
    case 'got-it': intervalDays = 14;   state = REVIEW; break;
    case 'easy':  intervalDays = 30;    state = REVIEW; break;
  }
}
```

#### 2. "Continue Reading" Shows Duplicate Fragments

**Problem:** Clicking "Continue Reading" showed some fragments from the previous session.

**Root Cause:** `getLastCardInfo()` returned the last card in queue order, not the maximum position. When cards are requeued via "Again", they move to the end - so queue order doesn't match chapter order.

**Fix:** Now finds maximum `sentence_order` and `fragment_order` across all cards:
```javascript
// src/hooks/flashcard/useFragmentSession.js
for (const card of cardQueue) {
  if (sentenceOrder > maxSentenceOrder) {
    maxSentenceOrder = sentenceOrder;
    maxFragmentOrderInMaxSentence = fragmentOrder;
  }
}
```

#### 3. Race Condition on "Continue Reading"

**Problem:** User could click "Continue Reading" before progress save completed.

**Fix:** Added `progressSaved` state tracking. Button shows "Saving progress..." with spinner until DB save completes, then enables "Continue Reading".

#### 4. Wrong Remaining Count in Summary

**Problem:** Summary showed original count (e.g., "20 more") instead of remaining after session.

**Fix:** Calculate remaining by subtracting session progress:
```javascript
const remainingCount = mode === READ
  ? totalInChapter - (currentPosition + totalCards)
  : totalDue - reviewedFragments.size
```

#### 5. Rating Buttons Only on Back

**Problem:** Users had to flip card before rating buttons appeared.

**Fix:** Removed conditional rendering - buttons now visible on both sides.

#### 6. Sentence Translation Spoilers

**Problem:** Full sentence translation appeared on every fragment, spoiling meaning.

**Fix:** Calculate `isLastFragmentInSentence` flag - only show translation on final fragment of each sentence.

#### 7. Sequential Chapter Unlock

**Problem:** All chapters with 95% vocab showed "Start Fragments" simultaneously.

**Fix:** Chapter N fragments require Chapter N-1 fragments to be complete:
```javascript
const prevChapterFragmentsComplete = idx === 0 ? true : prevChapterFragStats?.is_read_complete
const fragmentsUnlocked = isVocabComplete && prevChapterFragmentsComplete
```

#### 8. FeedbackPrompt for Fragments

**Problem:** Users couldn't report fragment translation errors.

**Fix:**
- Added `fragment_id` column to `user_feedback` table
- Updated `FeedbackPrompt.jsx` to accept `fragmentId` prop
- Added FeedbackPrompt to FragmentFlashcards page

---

## RELATED DOCUMENTATION

- `02_DATABASE_SCHEMA.md` - Table definitions
- `30_FSRS_ARCHITECTURE.md` - FSRS scheduling details
- `31_SENTENCE_COMPREHENSION.md` - Reading mode (unlocked after fragments)
- `99_LIVING_CHANGELOG.md` - Feature changelog entry
