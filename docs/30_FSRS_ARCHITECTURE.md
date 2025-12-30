# 30_FSRS_ARCHITECTURE.md

**Last Updated:** December 29, 2025
**Status:** Active
**Owner:** Claude + Peter

> **MVP Note (Dec 29, 2025):** Exposure oversampling is temporarily disabled for MVP. Review sessions only include due cards. Exposure logic is commented out in `sessionBuilder.js` with TODO for post-MVP reintroduction.

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Why FSRS?](#why-fsrs)
3. [Architecture Diagram](#architecture-diagram)
4. [Core Components](#core-components)
5. [Database Schema](#database-schema)
6. [Service Layer](#service-layer)
7. [Session Building](#session-building)
8. [Progress Tracking](#progress-tracking)
9. [UI Integration](#ui-integration)
10. [Testing Checklist](#testing-checklist)
11. [Future Optimizations](#future-optimizations)

---

## OVERVIEW

Voquab uses FSRS (Free Spaced Repetition Scheduler) to optimize vocabulary review timing. This document describes the complete technical architecture of the FSRS implementation.

**Implementation Date:** December 13, 2025
**Library:** ts-fsrs (TypeScript FSRS implementation)
**Previous System:** Custom mastery/health dual-track system

---

## WHY FSRS?

### Problems with Previous System

1. **Dual complexity**: Tracking both mastery (0-100) and health (0-100) was confusing
2. **Custom tuning**: No research backing for our decay rates and time gates
3. **Gaming potential**: Users could manipulate time gates
4. **Review inefficiency**: Showed cards more often than necessary

### FSRS Benefits

1. **Research-backed**: Based on memory science and forgetting curves
2. **Single source of truth**: Stability + difficulty replaces mastery + health
3. **20-30% fewer reviews**: Same retention with less work
4. **Adaptive**: Personalizes to individual learning patterns
5. **Open source**: Active community, continuous improvements

### Key Metrics

| Metric | Old System | FSRS |
|--------|-----------|------|
| Database columns | 14 | 8 |
| Scheduling logic | Custom | Research-proven |
| Review efficiency | Baseline | +20-30% |
| State machine | None | 4 states |

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLASHCARDS PAGE                          │
│                     (src/pages/Flashcards.jsx)                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          HOOKS LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  useFlashcardSession.js    │    useProgressTracking.js          │
│  - Card queue management   │    - Database updates              │
│  - Flip state              │    - FSRS scheduling calls         │
│  - Again requeue logic     │    - Daily stats updates           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│    fsrsService.js          │    sessionBuilder.js               │
│    - scheduleCard()        │    - buildReviewSession()          │
│    - isCardDue()           │    - buildLearnSession()           │
│    - getActivityLevel()    │    - getUnlockedChapters()         │
│    - calculateRetrievability() │ - getChaptersReadyForPhrases() │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE (Supabase)                        │
├─────────────────────────────────────────────────────────────────┤
│  user_lemma_progress       │    user_phrase_progress            │
│  - stability, difficulty   │    - stability, difficulty         │
│  - due_date, fsrs_state    │    - due_date, fsrs_state          │
│  - reps, lapses            │    - reps, lapses                  │
│  - last_seen_at            │    - last_seen_at                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CORE COMPONENTS

### File Structure

```
src/
├── services/
│   ├── fsrsService.js       # FSRS scheduling logic
│   └── sessionBuilder.js    # Session composition
├── hooks/
│   └── flashcard/
│       ├── useFlashcardSession.js   # Session state
│       └── useProgressTracking.js   # Progress updates
├── components/
│   └── flashcard/
│       ├── FlashcardDisplay.jsx     # Card UI
│       ├── DifficultyButtons.jsx    # Button interface
│       └── FloatingFeedback.jsx     # Animation
└── pages/
    └── Flashcards.jsx               # Main page
```

### Data Flow

1. **Session Start**: `sessionBuilder.js` fetches cards from database
2. **Card Display**: `FlashcardDisplay.jsx` renders current card
3. **User Response**: `DifficultyButtons.jsx` captures button press
4. **FSRS Calculation**: `fsrsService.js` computes new scheduling
5. **Database Update**: `useProgressTracking.js` saves to Supabase
6. **Queue Update**: `useFlashcardSession.js` advances to next card

---

## DATABASE SCHEMA

### FSRS Columns (user_lemma_progress & user_phrase_progress)

```sql
-- Active FSRS columns
stability        REAL         -- Days until 90% recall probability
difficulty       REAL         -- Item complexity (1-10 scale)
due_date         TIMESTAMPTZ  -- When card should be reviewed
fsrs_state       SMALLINT     -- 0=New, 1=Learning, 2=Review, 3=Relearning
reps             INTEGER      -- Total repetitions
lapses           INTEGER      -- Times failed (Again pressed)
last_seen_at     TIMESTAMPTZ  -- Last exposure (review or oversampling)
```

### FSRS State Values

| State | Value | Description | Typical Intervals |
|-------|-------|-------------|-------------------|
| New | 0 | Never reviewed | N/A |
| Learning | 1 | Short intervals | Minutes to hours |
| Review | 2 | Regular review cycle | Days to months |
| Relearning | 3 | Failed, back to short intervals | Minutes to hours |

### Indexes

```sql
-- For efficient due card queries
CREATE INDEX idx_user_progress_due ON user_lemma_progress(user_id, due_date);

-- For exposure card selection
CREATE INDEX idx_user_progress_exposure ON user_lemma_progress(
  user_id, stability, fsrs_state, last_seen_at
);
```

---

## SERVICE LAYER

### fsrsService.js

**Purpose:** Core FSRS scheduling calculations

**Key Functions:**

```javascript
/**
 * Schedule card based on user response
 * @param {Object} card - Card with FSRS fields
 * @param {string} difficulty - 'again' | 'hard' | 'got-it'
 * @returns {Object} Updated card with new FSRS values
 */
export function scheduleCard(card, difficulty) {
  // Map button to FSRS rating (1-4)
  const rating = difficultyToRating(difficulty)

  // Use ts-fsrs library for calculations
  const fsrs = new FSRS()
  const now = new Date()

  if (card.fsrs_state === FSRSState.NEW) {
    // First review - initialize card
    return fsrs.repeat(createNewCard(), now)[rating]
  } else {
    // Subsequent review - update existing
    const existingCard = cardFromProgress(card)
    return fsrs.repeat(existingCard, now)[rating]
  }
}

/**
 * Check if card is due for review
 */
export function isCardDue(card) {
  if (!card.due_date) return false
  return new Date(card.due_date) <= new Date()
}

/**
 * Check if card is eligible for exposure oversampling
 */
export function shouldIncludeForExposure(card, daysBetween) {
  if (card.stability < 30) return false  // Not stable enough
  if (card.fsrs_state !== FSRSState.REVIEW) return false  // Must be in Review

  const daysSinceLastSeen = daysSince(card.last_seen_at)
  return daysSinceLastSeen >= daysBetween
}

/**
 * Calculate user's activity level for exposure settings
 */
export function getUserActivityLevel(dailyStats) {
  const avgReviews = calculateAverageReviews(dailyStats, 7)

  if (avgReviews >= 100) {
    return { level: 'high', daysBetween: 7, exposureCards: 10 }
  } else if (avgReviews >= 50) {
    return { level: 'medium', daysBetween: 14, exposureCards: 5 }
  } else {
    return { level: 'low', daysBetween: 21, exposureCards: 2 }
  }
}
```

### sessionBuilder.js

**Purpose:** Build card sessions for different modes

**Key Functions:**

```javascript
/**
 * Build review session (due cards + exposure)
 */
export async function buildReviewSession(userId, sessionSize = 25) {
  // 1. Get due cards (lemmas and phrases)
  const dueCards = await getDueCards(userId)

  // 2. Get exposure cards based on activity
  const activityLevel = await getUserActivityLevel(userId)
  const exposureCards = await getExposureCards(userId, activityLevel)

  // 3. Combine and shuffle
  const allCards = shuffle([...dueCards, ...exposureCards])

  // 4. Add sentences
  const cardsWithSentences = await addSentencesToCards(allCards)

  return {
    cards: cardsWithSentences.slice(0, sessionSize),
    stats: { dueCount: dueCards.length, exposureCount: exposureCards.length },
    mode: 'review'
  }
}

/**
 * Build learn session (new lemmas + phrases)
 */
export async function buildLearnSession(userId, sessionSize = 25) {
  // 1. Get unlocked chapters
  const unlockedChapters = await getUnlockedChapters(userId)

  // 2. Check if phrases are available (20% threshold)
  const phraseChapters = await getChaptersReadyForPhrases(userId)

  // 3. Calculate 80/20 split
  const hasPhrases = phraseChapters.length > 0
  const lemmaCount = hasPhrases ? Math.ceil(sessionSize * 0.8) : sessionSize
  const phraseCount = hasPhrases ? Math.floor(sessionSize * 0.2) : 0

  // 4. Fetch cards
  const lemmaCards = await getUnintroducedLemmas(userId, lemmaCount)
  const phraseCards = await getUnintroducedPhrases(userId, phraseCount)

  return {
    cards: shuffle([...lemmaCards, ...phraseCards]),
    stats: { lemmaCount, phraseCount },
    mode: 'learn'
  }
}
```

---

## SESSION BUILDING

### Review Session Composition

> **MVP Status:** Exposure oversampling is disabled. Review sessions contain only due cards.

```
┌─────────────────────────────────────────────┐
│        REVIEW SESSION (MVP - Current)        │
├─────────────────────────────────────────────┤
│                                             │
│   Due Cards (FSRS scheduled)                │
│   ├── Lemmas (due_date <= now)              │
│   └── Phrases (due_date <= now)             │
│                                             │
│   = Shuffled session (up to sessionSize)    │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        REVIEW SESSION (Post-MVP)             │
├─────────────────────────────────────────────┤
│                                             │
│   Due Cards (FSRS scheduled)                │
│   ├── Lemmas (due_date <= now)              │
│   └── Phrases (due_date <= now)             │
│                                             │
│   + Exposure Cards (oversampling)           │
│   ├── Lemmas (stability > 30 days)          │
│   └── Phrases (stability > 30 days)         │
│                                             │
│   = Shuffled session (up to sessionSize)    │
│                                             │
└─────────────────────────────────────────────┘
```

### Learn Session Composition

```
┌─────────────────────────────────────────────┐
│               LEARN SESSION                  │
├─────────────────────────────────────────────┤
│                                             │
│   Check: Are phrases available?             │
│   (20% of chapter lemmas introduced)        │
│                                             │
│   If YES (80/20 split):                     │
│   ├── 80% Unintroduced Lemmas               │
│   └── 20% Unintroduced Phrases              │
│                                             │
│   If NO (100% lemmas):                      │
│   └── 100% Unintroduced Lemmas              │
│                                             │
│   = Shuffled session (up to sessionSize)    │
│                                             │
└─────────────────────────────────────────────┘
```

### Exposure Insurance Logic

```javascript
// DISABLED FOR MVP - Exposure eligibility criteria
// Uncomment in sessionBuilder.js post-MVP
function isEligibleForExposure(card, daysBetween) {
  return (
    card.stability > 30 &&           // Well-learned
    card.fsrs_state === 2 &&         // In Review state
    daysSince(card.last_seen_at) >= daysBetween  // Not recently seen
  )
}

// DISABLED FOR MVP - Activity-based exposure settings
const EXPOSURE_SETTINGS = {
  high:   { reviews: 100, daysBetween: 7,  cards: 10 },
  medium: { reviews: 50,  daysBetween: 14, cards: 5 },
  low:    { reviews: 0,   daysBetween: 21, cards: 2 }
}
```

---

## PROGRESS TRACKING

### useProgressTracking.js

**Purpose:** Handle database updates after user responses

**Key Flow:**

```javascript
async function updateProgress(card, difficulty, isExposure = false) {
  // 1. Determine table (lemma vs phrase)
  const isPhrase = card.card_type === 'phrase'
  const tableName = isPhrase ? 'user_phrase_progress' : 'user_lemma_progress'
  const idField = isPhrase ? 'phrase_id' : 'lemma_id'

  // 2. Handle exposure cards (only update last_seen_at)
  if (isExposure) {
    await supabase.from(tableName).upsert({
      user_id: userId,
      [idField]: card[idField],
      last_seen_at: new Date().toISOString()
    })
    return { success: true, isExposure: true }
  }

  // 3. Calculate new FSRS values
  const scheduled = scheduleCard(card, difficulty)

  // 4. Update database
  await supabase.from(tableName).upsert({
    user_id: userId,
    [idField]: card[idField],
    stability: scheduled.stability,
    difficulty: scheduled.difficulty,
    due_date: scheduled.due_date,
    fsrs_state: scheduled.fsrs_state,
    reps: scheduled.reps,
    lapses: scheduled.lapses,
    last_seen_at: new Date().toISOString()
  })

  // 5. Update daily stats
  await updateDailyStats(userId)

  return { success: true, ...scheduled }
}
```

---

## UI INTEGRATION

### Button Mapping

```javascript
// DifficultyButtons.jsx
const BUTTONS = [
  { id: 'again',  label: 'Again',  icon: RotateCcw,   color: '#6d6875' },
  { id: 'hard',   label: 'Hard',   icon: AlertCircle, color: '#e5989b' },
  { id: 'got-it', label: 'Got It', icon: CheckCircle, color: '#ffcdb2' }
]

// Map to FSRS ratings
const difficultyToRating = {
  'again': 1,   // FSRS Rating.Again
  'hard': 2,    // FSRS Rating.Hard
  'got-it': 3   // FSRS Rating.Good
}
```

### Card Badges

| Badge | Color | Condition |
|-------|-------|-----------|
| "New Word" | Green (#15803d) | `card.isNew && card.card_type !== 'phrase'` |
| "New Phrase" | Green (#15803d) | `card.isNew && card.card_type === 'phrase'` |
| "Exposure" | Amber (#b45309) | `card.isExposure` |
| "Phrase" | Purple (#7c3aed) | `card.card_type === 'phrase' && !card.isNew` |

### Floating Feedback Animation

```javascript
// FloatingFeedback.jsx - Shows "+X days" after response
<motion.div
  initial={{ opacity: 0, y: 0 }}
  animate={{ opacity: 1, y: -80 }}
  exit={{ opacity: 0, y: -120 }}
  transition={{ duration: 1.5, ease: 'easeOut' }}
>
  {`+${dueFormatted}`}
</motion.div>
```

---

## TESTING CHECKLIST

### Database Tests
- [ ] FSRS columns exist in user_lemma_progress
- [ ] FSRS columns exist in user_phrase_progress
- [ ] Indexes created for due_date and exposure queries
- [ ] Migration preserves existing user data

### FSRS Service Tests
- [ ] scheduleCard() with Again rating resets stability
- [ ] scheduleCard() with Hard rating reduces stability
- [ ] scheduleCard() with Got It rating increases stability
- [ ] isCardDue() correctly identifies due cards
- [ ] shouldIncludeForExposure() filters by stability and state
- [ ] getUserActivityLevel() returns correct tier

### Session Builder Tests
- [ ] Review mode returns due + exposure cards
- [ ] Learn mode returns unintroduced lemmas
- [ ] Phrase 20% threshold works correctly
- [ ] 80/20 split applied when phrases available
- [ ] Session respects size limit
- [ ] Stop words filtered out

### Progress Tracking Tests
- [ ] updateProgress() updates FSRS fields
- [ ] Exposure cards only update last_seen_at
- [ ] Phrase progress uses correct table
- [ ] Daily stats incremented

### UI Tests
- [ ] Three buttons display correctly
- [ ] Keyboard shortcuts work (1, 2, 3, Space)
- [ ] Badges appear for correct card types
- [ ] Floating animation shows after response
- [ ] Again requeues card to end of session

---

## FUTURE OPTIMIZATIONS

### Per-User Parameter Optimization

After users complete 400+ reviews, we can optimize FSRS parameters to their learning patterns:

```javascript
// Future: Personalized FSRS parameters
const personalizedFSRS = new FSRS({
  w: userOptimizedWeights,  // Custom weights from review history
  requestRetention: 0.9     // Can also be personalized
})
```

### Difficulty Estimation for New Cards

Currently all new cards start with default difficulty. Future improvement:

```javascript
// Future: Estimate difficulty for new words
function estimateInitialDifficulty(lemma) {
  // Factors: word length, frequency, cognate similarity, etc.
  return calculateEstimatedDifficulty(lemma)
}
```

### Load Balancing

Spread reviews more evenly across days:

```javascript
// Future: Prevent review pile-ups
function balanceReviewLoad(dueDate, dailyCapacity) {
  // Shift some cards to adjacent days if too many due
  return adjustedDueDate
}
```

---

## RELATED DOCUMENTS

- **04_LEARNING_ALGORITHM.md** - User-facing algorithm documentation
- **02_DATABASE_SCHEMA.md** - Database column definitions
- **FSRS_IMPLEMENTATION_SPEC.md** - Original implementation specification
- **FLASHCARD_BUG_FIXES_SPEC.md** - Bug fix documentation

---

## REVISION HISTORY

- 2025-12-13: Initial creation documenting FSRS implementation (Claude)
- Status: Active

---

**END OF FSRS ARCHITECTURE**
