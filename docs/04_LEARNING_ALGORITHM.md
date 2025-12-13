# 04_LEARNING_ALGORITHM.md

**Last Updated:** December 13, 2025
**Status:** Active
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [FSRS Algorithm](#fsrs-algorithm)
3. [Core Concepts](#core-concepts)
4. [Study Modes](#study-modes)
5. [Exposure Insurance](#exposure-insurance)
6. [Session Composition](#session-composition)
7. [Phrases Integration](#phrases-integration)
8. [Chapter Unlocking](#chapter-unlocking)
9. [Button Mapping](#button-mapping)
10. [Implementation Reference](#implementation-reference)

---

## OVERVIEW

Voquab uses **FSRS (Free Spaced Repetition Scheduler)**, a research-backed algorithm that optimizes review intervals based on your performance. FSRS replaces our previous custom mastery/health system.

**Key Benefits:**
- 20-30% fewer reviews for same retention (research-proven)
- Adapts to individual learning patterns
- Predicts optimal review times based on memory science
- Single source of truth (no dual-system complexity)

**Philosophy:** Trust the algorithm to guide users toward optimal learning paths without feeling stuck or overwhelmed.

---

## FSRS ALGORITHM

### What is FSRS?

FSRS (Free Spaced Repetition Scheduler) is an open-source algorithm developed by Jarrett Ye that uses a mathematical model of human memory to schedule reviews optimally.

**Core Papers:**
- "A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling" (2022)
- Based on the Ebbinghaus forgetting curve and modern memory research

### How It Works

FSRS models memory with two core parameters:

**1. Stability (S)** - How many days until recall probability drops to 90%
- New cards: Start with stability ~0.5-2 days
- As you review successfully: Stability increases (can reach 365+ days)
- If you fail: Stability resets to a low value

**2. Difficulty (D)** - How hard the item is for you (1-10 scale)
- Easy items: Difficulty decreases toward 1
- Hard items: Difficulty increases toward 10
- Affects how fast stability grows

### The FSRS Formula

```
Retrievability = 0.9^(t/S)

Where:
- t = days since last review
- S = current stability (days)
- 0.9 = target retention (90%)
```

**Example:**
- Word with stability = 10 days
- 5 days since last review
- Retrievability = 0.9^(5/10) = 0.9^0.5 = 95%
- After 10 days: 0.9^1 = 90% (optimal review time)
- After 20 days: 0.9^2 = 81% (overdue)

### FSRS States

Cards progress through these states:

| State | Value | Description |
|-------|-------|-------------|
| New | 0 | Never reviewed |
| Learning | 1 | Just started, short intervals |
| Review | 2 | In regular review cycle |
| Relearning | 3 | Failed, back to short intervals |

**State Transitions:**
```
New → Learning → Review ⟷ Relearning
           ↑_______________|
```

---

## CORE CONCEPTS

### Stability

**What it means:** Days until your recall probability drops to 90%

**Ranges:**
- 0.5-2 days: Learning phase
- 3-7 days: Early review
- 8-30 days: Getting comfortable
- 31-90 days: Solidly known
- 91-180 days: Strong retention
- 181-365+ days: Mastered

**How it changes:**
- Correct response: Stability × 1.5-3.0 (depending on button)
- Wrong response (Again): Stability resets to ~0.2-2 days

### Difficulty

**What it means:** How challenging this item is for you personally

**Scale:** 1-10
- 1-3: Easy (stability grows quickly)
- 4-6: Normal
- 7-10: Hard (stability grows slowly)

**How it changes:**
- Press "Got It" frequently: Difficulty decreases (-0.2 per review)
- Press "Hard" frequently: Difficulty increases (+0.5 per review)
- Press "Again": Difficulty increases (+1.0)

### Due Date

**What it means:** When you should review this card

**Calculation:**
```javascript
due_date = last_review_date + stability_days
```

**Example:**
- Reviewed on Dec 13, stability = 5 days
- Due date = Dec 18

### Retrievability (Derived)

**What it means:** Current probability you remember this word (0-100%)

**Not stored in database** - calculated on demand:
```javascript
const daysSince = (now - last_seen_at) / MS_PER_DAY
const retrievability = Math.pow(0.9, daysSince / stability) * 100
```

---

## STUDY MODES

### Mode 1: Review Due Cards

**Purpose:** Review cards scheduled by FSRS + exposure insurance

**Selection:**
1. All cards where `due_date <= NOW`
2. Plus exposure cards (see Exposure Insurance)
3. Shuffled together

**When to use:** Daily review sessions

### Mode 2: Learn New Words

**Purpose:** Introduce unlearned vocabulary

**Selection:**
1. Words from unlocked chapters with no `user_lemma_progress` record
2. Filtered by `is_stop_word = false`
3. Ordered by chapter, then frequency
4. Limited to session size

**Includes phrases:** After 20% of chapter lemmas introduced (see Phrases Integration)

**When to use:** When you want to expand vocabulary

### Mode 3: Chapter Focus (Future)

**Purpose:** Focus on specific chapter content

**Planned composition:**
- 60% due cards from target chapter
- 20% exposure cards from target chapter
- 20% due cards from other chapters

**Status:** Not yet implemented

---

## EXPOSURE INSURANCE

### The Problem

With pure FSRS, words you know well might not appear for months. This creates risk:
- Memory can fail unexpectedly
- Long gaps make forgetting feel worse
- No early warning before a word is forgotten

### The Solution: Oversampling

Periodically show stable cards as "exposure checks" to verify memory is intact.

### How It Works

**Eligibility criteria:**
- Stability > 30 days (well-learned)
- FSRS state = Review (not Learning)
- Not seen in X days (varies by activity level)

**Exposure frequency:**

| User Activity | Reviews/Day | Exposure Cards/Session | Days Between Checks |
|---------------|-------------|------------------------|---------------------|
| High | 100+ | 10 | 7 days |
| Medium | 50-99 | 5 | 14 days |
| Low | <50 | 2 | 21 days |

### Exposure Card Behavior

**UI indicator:** Amber "Exposure" badge on card

**What happens when reviewed:**
- All three buttons work normally
- FSRS updates as usual (stability, difficulty, due_date)
- Counts toward daily stats

**Why show buttons:** Even exposure cards benefit from FSRS feedback. If you struggle, the algorithm should know.

---

## SESSION COMPOSITION

### Default Session Size

**Setting:** `user_settings.cards_per_session` (default: 25)

### Review Mode Composition

```javascript
const sessionSize = userSettings.cards_per_session || 25

// 1. Get all due cards
const dueCards = await getDueCards(userId)

// 2. Get exposure cards based on activity
const activityLevel = getUserActivityLevel(dailyStats)
const exposureCards = await getExposureCards(userId, activityLevel)

// 3. Combine and limit
const allCards = shuffle([...dueCards, ...exposureCards])
return allCards.slice(0, sessionSize)
```

### Learn Mode Composition

With phrases integration (after 20% chapter threshold):

```javascript
const sessionSize = userSettings.cards_per_session || 25

// 80/20 split when phrases available
const lemmaCount = hasPhraseChapters ? Math.ceil(sessionSize * 0.8) : sessionSize
const phraseCount = hasPhraseChapters ? Math.floor(sessionSize * 0.2) : 0

// Fetch lemmas
const lemmaCards = await getUnintroducedLemmas(userId, lemmaCount)

// Fetch phrases (if eligible)
const phraseCards = await getUnintroducedPhrases(userId, phraseCount)

return shuffle([...lemmaCards, ...phraseCards])
```

---

## PHRASES INTEGRATION

### What Are Phrases?

Multi-word expressions where the combined meaning differs from individual words.

**Types:**
| Type | Description | Example |
|------|-------------|---------|
| Idiom | Non-literal meaning | "dar miedo" = "to scare" (not "to give fear") |
| Collocation | Frequently co-occurring | "tener razón" = "to be right" |
| Compound | Multi-word term | "personas mayores" = "grown-ups" |

### When Do Phrases Appear?

**Threshold:** 20% of chapter lemmas introduced

**Example:**
- Chapter 1 has 52 lemmas
- User has learned 11 lemmas (21%)
- Chapter 1 phrases now eligible for Learn sessions

### Phrase Card Format

**Same as lemma cards, with:**
- `card_type: 'phrase'`
- `part_of_speech: 'PHRASE'`
- Purple "Phrase" badge (or "New Phrase" if first time)
- Example sentence from `phrase_occurrences`

### Phrase Progress Tracking

**Table:** `user_phrase_progress`

Same FSRS columns as `user_lemma_progress`:
- `stability`, `difficulty`, `due_date`
- `fsrs_state`, `reps`, `lapses`
- `last_seen_at`

---

## CHAPTER UNLOCKING

### Unlock Criteria

**Requirement:** 95% of previous chapter words introduced

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION get_chapter_progress(p_user_id uuid)
RETURNS TABLE (
  chapter_number integer,
  total_words bigint,
  introduced_words bigint,
  introduced_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.chapter_number,
    COUNT(*) as total_words,
    COUNT(ulp.lemma_id) as introduced_words,
    ROUND((COUNT(ulp.lemma_id)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as introduced_pct
  FROM lemmas l
  LEFT JOIN user_lemma_progress ulp
    ON l.lemma_id = ulp.lemma_id AND ulp.user_id = p_user_id
  WHERE l.is_stop_word = false
  GROUP BY l.chapter_number
  ORDER BY l.chapter_number;
END;
$$ LANGUAGE plpgsql;
```

### Example Progression

| Chapter | Total Words | Introduced | Percentage | Status |
|---------|-------------|------------|------------|--------|
| 1 | 52 | 52 | 100% | Complete |
| 2 | 40 | 38 | 95% | Chapter 3 Unlocked |
| 3 | 35 | 30 | 86% | Chapter 4 Locked |

### UI Indicator

- Locked chapters show lock icon
- Progress bar shows introduction percentage
- "X more words to unlock" message

---

## BUTTON MAPPING

### Three-Button Interface

| Button | Label | FSRS Rating | Effect |
|--------|-------|-------------|--------|
| Again | "Again" | 1 | Stability reset (~0.2-2 days), lapses +1, difficulty +1.0 |
| Hard | "Hard" | 2 | Stability × 0.6, difficulty +0.5 |
| Got It | "Got It" | 3 (Good) | Stability × 1.5-3.0, difficulty -0.2 |

### Why No "Easy" Button?

- Simpler interface (3 buttons instead of 4)
- Research shows 4-button adds cognitive load without significant benefit
- "Got It" covers both Good and Easy use cases
- Future: May add Easy for power users

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Flip card |
| 1 | Again |
| 2 | Hard |
| 3 | Got It |

### "Again" Button Behavior

When pressed:
1. Card moves to end of current session queue
2. Progress counter stays same (e.g., stays at "2/15")
3. User sees card again before session ends
4. FSRS updates: stability reset, lapses +1

---

## IMPLEMENTATION REFERENCE

### Key Files

| File | Purpose |
|------|---------|
| `src/services/fsrsService.js` | FSRS scheduling logic |
| `src/services/sessionBuilder.js` | Session composition |
| `src/hooks/flashcard/useProgressTracking.js` | Database updates |
| `src/hooks/flashcard/useFlashcardSession.js` | Session state management |

### FSRS Service Functions

```javascript
// Schedule next review
scheduleCard(card, rating) → { stability, difficulty, due_date, fsrs_state, ... }

// Check if card is due
isCardDue(card) → boolean

// Check if eligible for exposure
shouldIncludeForExposure(card, daysBetween) → boolean

// Get user's review activity level
getUserActivityLevel(dailyStats) → { level, daysBetween, exposureCards }

// Convert stability to legacy mastery (0-100)
stabilityToMastery(stability) → number

// Calculate current retrievability
calculateRetrievability(card) → number (0-100)
```

### Session Builder Functions

```javascript
// Build review session (due + exposure)
buildReviewSession(userId, sessionSize) → { cards, stats, mode }

// Build learn session (new lemmas + phrases)
buildLearnSession(userId, sessionSize) → { cards, stats, mode }

// Get chapters ready for phrases (20%+ introduced)
getChaptersReadyForPhrases(userId, unlockedChapters) → number[]

// Get unlocked chapters
getUnlockedChapters(userId) → number[]
```

### Database Queries

**Get due cards:**
```sql
SELECT * FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
WHERE ulp.user_id = :user_id
  AND ulp.due_date <= NOW()
  AND l.is_stop_word = false
ORDER BY ulp.due_date ASC;
```

**Get exposure candidates:**
```sql
SELECT * FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
WHERE ulp.user_id = :user_id
  AND ulp.stability > 30
  AND ulp.fsrs_state = 2  -- Review state
  AND ulp.last_seen_at < NOW() - INTERVAL ':days days'
  AND l.is_stop_word = false;
```

**Update progress after review:**
```sql
UPDATE user_lemma_progress
SET
  stability = :new_stability,
  difficulty = :new_difficulty,
  due_date = :new_due_date,
  fsrs_state = :new_state,
  reps = reps + 1,
  lapses = CASE WHEN :rating = 1 THEN lapses + 1 ELSE lapses END,
  last_seen_at = NOW(),
  updated_at = NOW()
WHERE user_id = :user_id AND lemma_id = :lemma_id;
```

---

## RELATED DOCUMENTS

- See **02_DATABASE_SCHEMA.md** for FSRS column definitions
- See **03_CONTENT_PIPELINE.md** for phrase detection
- See **30_FSRS_ARCHITECTURE.md** for detailed implementation
- See **FSRS_IMPLEMENTATION_SPEC.md** for original specification

---

## REVISION HISTORY

- 2025-11-30: Initial draft with mastery/health system (Claude)
- 2025-12-13: **Major rewrite** - Replaced with FSRS algorithm, added phrases integration (Claude)
- Status: Active

---

**END OF LEARNING ALGORITHM**
