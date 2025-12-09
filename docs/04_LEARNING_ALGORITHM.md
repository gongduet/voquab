# 04_LEARNING_ALGORITHM.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Mastery System](#mastery-system)
4. [Health System](#health-system)
5. [Priority Scoring](#priority-scoring)
6. [Card Selection](#card-selection)
7. [Time Gates](#time-gates)
8. [Chapter Unlocking](#chapter-unlocking)
9. [Implementation Reference](#implementation-reference)

---

## OVERVIEW

Voquab's learning algorithm is designed to maximize vocabulary retention through contextual spaced repetition. The system balances quality (deep mastery) with quantity (consistent practice) to create effective, engaging learning experiences.

**Core Innovation:** Dual-track progression (mastery + health) combined with lemma-based learning prevents deck flooding while ensuring comprehensive practice.

**Philosophy:** Trust the algorithm to guide users toward optimal learning paths without feeling stuck or overwhelmed.

---

## CORE PRINCIPLES

### 1. Contextual Learning Over Isolation

Every vocabulary review happens within the context of actual sentences from El Principito.

**Why:**
- Context aids retention (words have meaning, not just translations)
- Literary immersion creates emotional connections
- Seeing words in use teaches nuance

**Implementation:**
- Flashcards display sentence where word was encountered
- Multiple example sentences available for high-frequency words
- Click word in sentence to see full context

---

### 2. Lemma-Based Mastery

Users master canonical forms (lemmas), not individual conjugations.

**Example:**
- Lemma: **vivir** (to live)
- Forms encountered: vivía, viví, vivo, vivir
- **One flashcard** shows "vivir" with most recent form as context

**Why:**
- Prevents deck flooding (50 verb forms → 1 concept)
- Focuses on understanding, not memorization
- Aligns with dictionary learning

**Implementation:**
- `user_lemma_progress` tracks mastery of lemmas
- `user_word_encounters` tracks which forms seen
- Flashcard queries join both tables

---

### 3. Dual-Track Progression

**Track 1: Mastery (Quality)**
- Scale: 0-100 points
- Measures: How well you KNOW the word
- Affects: Spaced repetition intervals, chapter unlock

**Track 2: Health (Quantity)**
- Scale: 0-100 points
- Measures: How recently you've PRACTICED
- Affects: Card selection priority, urgency

**Why Both Matter:**
- Quality without quantity = quick learning but forgetting
- Quantity without quality = repetition without understanding
- Together = true fluency

---

### 4. Time-Gated Mastery

Mastery gains are time-gated to prevent rapid-fire gaming.

**Rule:** Cannot gain mastery points (Hard/Medium/Easy) unless sufficient time has passed since last correct review.

**Example:**
- Word at mastery level 3 (Learning)
- Time gate: 24 hours
- Last correct review: 18 hours ago
- User marks "Medium" → Health +60, Mastery +0 (time gate not met)

**Why:**
- Prevents cramming
- Enforces spaced repetition
- Ensures real learning, not gaming
- Health still rewards effort

---

## MASTERY SYSTEM

### Mastery Levels (10 Levels)

| Level | Score | Label | Time Gate | Next Interval | Description |
|-------|-------|-------|-----------|---------------|-------------|
| 0 | 0-9 | New | 0 hrs | Immediate | Brand new word |
| 1 | 10-19 | Introduced | 4 hrs | 12 hrs | Just met |
| 2 | 20-29 | Recognizing | 12 hrs | 1 day | Starting to recall |
| 3 | 30-39 | Learning | 1 day | 3 days | Active learning |
| 4 | 40-49 | Familiar | 3 days | 7 days | Getting comfortable |
| 5 | 50-59 | Known | 7 days | 14 days | Solidly known |
| 6 | 60-69 | Strong | 14 days | 30 days | Strong retention |
| 7 | 70-79 | Mastered | 30 days | 60 days | True mastery |
| 8 | 80-89 | Expert | 60 days | 120 days | Expert level |
| 9 | 90-94 | Native | 120 days | 180 days | Near-native |
| 10 | 95-100 | Perfect | 180 days | 365 days | Perfect mastery |

---

### Mastery Point Changes

When user reviews a word:

| Response | Mastery Change | Time Gate Check? | Requeue in Session? |
|----------|----------------|------------------|---------------------|
| **Don't Know** | -5 points | NO (always applies) | YES (3-7 cards later) |
| **Hard** | +3 points | YES (blocked if not met) | NO |
| **Medium** | +6 points | YES (blocked if not met) | NO |
| **Easy** | +10 points | YES (blocked if not met) | NO |

**Boundaries:**
- Minimum mastery: 0 (cannot go below)
- Maximum mastery: 100 (cannot exceed)

**Level-Up Celebrations:**
- Triggered when crossing 10-point threshold (e.g., 39 → 41)
- Show animation and new level label
- Encourage continued practice

---

### Mastery Point Change Logic

```javascript
function calculateMasteryChange(word, difficulty) {
  const MASTERY_POINTS = {
    'dont-know': -5,
    'hard': +3,
    'medium': +6,
    'easy': +10
  };
  
  // Don't Know always applies (no time gate)
  if (difficulty === 'dont-know') {
    return MASTERY_POINTS['dont-know'];
  }
  
  // Check time gate for gains
  const currentLevel = Math.floor(word.mastery_level / 10);
  const timeGateHours = TIME_GATES[currentLevel];
  const hoursSinceLastCorrect = calculateHoursSince(word.last_correct_review_at);
  
  if (hoursSinceLastCorrect >= timeGateHours) {
    return MASTERY_POINTS[difficulty];
  } else {
    // Time gate not met
    const hoursRemaining = timeGateHours - hoursSinceLastCorrect;
    return {
      masteryChange: 0,
      message: `Wait ${hoursRemaining.toFixed(1)} hours for mastery credit`
    };
  }
}
```

---

## HEALTH SYSTEM

### Health as Urgency Metric

Health represents how recently a word has been practiced. It decays daily based on mastery level.

**Health Scale:**

| Health Range | Status | Color | Priority |
|-------------|--------|-------|----------|
| 0-19 | CRITICAL | Red | HIGHEST |
| 20-39 | LOW | Orange | HIGH |
| 40-59 | MEDIUM | Yellow | MEDIUM |
| 60-79 | GOOD | Light Green | LOW |
| 80-100 | EXCELLENT | Bright Green | LOWEST |

---

### Health Decay Rates

Health decays daily when word is not reviewed:

| Mastery Level | Decay Rate (pts/day) | Days Until Critical |
|--------------|---------------------|---------------------|
| 0 (New) | 25 | 4 days |
| 1 (Introduced) | 20 | 5 days |
| 2 (Recognizing) | 12 | 8 days |
| 3 (Learning) | 8 | 12 days |
| 4 (Familiar) | 5 | 16 days |
| 5 (Known) | 3 | 26 days |
| 6 (Strong) | 2 | 40 days |
| 7 (Mastered) | 1.5 | 53 days |
| 8 (Expert) | 1 | 80 days |
| 9 (Native) | 0.7 | 114 days |
| 10 (Perfect) | 0.5 | 160 days |

**Formula:**
```javascript
const decayRates = {
  0: 25, 1: 20, 2: 12, 3: 8, 4: 5,
  5: 3, 6: 2, 7: 1.5, 8: 1, 9: 0.7, 10: 0.5
};

const masteryLevel = Math.floor(word.mastery_level / 10);
const decayRate = decayRates[masteryLevel];
const daysSinceReview = calculateDaysSince(word.last_reviewed_at);

const currentHealth = Math.max(0, word.health - (daysSinceReview * decayRate));
```

**Rationale:**
- Higher mastery = slower decay (well-learned words stay fresh longer)
- Lower mastery = faster decay (struggling words need frequent practice)

---

### Health Restoration

When user reviews a word, health is restored:

| Response | Health Boost |
|----------|-------------|
| **Don't Know** | +10 |
| **Hard** | +30 |
| **Medium** | +60 |
| **Easy** | +100 (full restoration) |

**Formula:**
```javascript
const healthBoosts = {
  'dont-know': 10,
  'hard': 30,
  'medium': 60,
  'easy': 100
};

const newHealth = Math.min(100, currentHealth + healthBoosts[difficulty]);
```

**Rationale:**
- "Easy" fully restores (word is solid, give it time)
- "Medium" mostly restores (word is okay, will need review soon)
- "Hard" partially restores (word needs more practice)
- "Don't Know" minimal restoration (urgent attention needed)

---

### Health Lifecycle Example

**Day 1:** New word "el fracaso" created
- Health: 100 (fresh)
- Mastery: 0 (Level 0)

**Day 2-4:** Not reviewed
- Health: 100 → 75 → 50 → 25 (decay: 25pts/day)
- Status: Excellent → Good → Medium → Low

**Day 5:** CRITICAL! (Health: 0)
- Appears in review session (high priority)
- User marks "Medium"
- Health: 0 → 60 (boost)
- Mastery: 0 → 6 (first correct review)

**Day 6-7:** Not reviewed
- Health: 60 → 48 → 36 (decay: 12pts/day at Level 0)
- Mastery: 6 (unchanged)

**Day 8:** Reviewed again
- User marks "Easy"
- Health: 36 → 100 (full restore)
- Mastery: 6 → 16 (Level 1)
- Decay rate now: 20pts/day (improved)

This cycle continues, with decay slowing as mastery increases.

---

## PRIORITY SCORING

### Purpose

Every word gets a priority score (0-200+) that determines selection order for review sessions. Higher score = more likely to appear.

**Goal:** Show users the most important words at the right time.

---

### Priority Formula

```
PRIORITY SCORE = 
  (Health Urgency × 35%) +
  (Frequency in Book × 30%) +
  (Chapter Position × 15%) +
  (Mastery Readiness × 10%) +
  (Chapter Focus Bonus × 10%)
  
  × Critical Health Multiplier (1.5 if health < 20)
  × Leech Multiplier (1.3 if failed recently)
  × New Word Penalty (0.8 if never reviewed)
```

---

### Component Breakdown

#### 1. Health Urgency (0-50 points, 35% weight)

```javascript
const healthScore = (100 - currentHealth) * 0.5;
```

**Examples:**
- Health 0: 50 points (critical)
- Health 20: 40 points (low)
- Health 50: 25 points (medium)
- Health 100: 0 points (excellent)

**Rationale:** Lower health = higher urgency

---

#### 2. Frequency in Book (0-30 points, 30% weight)

```javascript
const frequencyScore = Math.min(30, word.times_in_book * 0.6);
```

**Examples:**
- Appears 2 times: 1.2 points
- Appears 10 times: 6 points
- Appears 50+ times: 30 points (capped)

**Rationale:** High-frequency words are more important to learn

---

#### 3. Chapter Position (0-15 points, 15% weight)

```javascript
const chapterScore = word.chapter_number <= 3 ? 15 :
                     word.chapter_number <= 5 ? 10 : 5;
```

**Examples:**
- Chapter 1-3: 15 points
- Chapter 4-5: 10 points
- Chapter 6+: 5 points

**Rationale:** Earlier chapters = foundational vocabulary

---

#### 4. Mastery Readiness (0-10 points, 10% weight)

```javascript
const masteryReadyScore = (timeGateMet && currentLevel < 10) ? 10 : 0;
```

**Rationale:** Prioritize words that can gain mastery now (encourage level-ups)

---

#### 5. Chapter Focus Bonus (0-10 points, 10% weight)

```javascript
const focusBonus = (chapterFocusMode && word.chapter_id === currentChapter) ? 10 : 0;
```

**Rationale:** When focusing on specific chapter, boost those words

---

### Multipliers

#### Critical Health Multiplier (×1.5)

```javascript
if (currentHealth < 20) {
  totalScore *= 1.5;
}
```

**Rationale:** Critical words need immediate attention

---

#### Leech Multiplier (×1.3)

```javascript
if (word.failed_in_last_3_sessions) {
  totalScore *= 1.3;
}
```

**Rationale:** Struggling words need extra focus

---

#### New Word Penalty (×0.8)

```javascript
if (word.total_reviews === 0) {
  totalScore *= 0.8;
}
```

**Rationale:** Review existing words before introducing new ones

---

### Priority Score Examples

**Example 1: Critical High-Frequency Word**
```
Word: "de" (of)
- Health: 10 (critical)
- Times in book: 80
- Chapter: 1
- Time gate: Met
- Mastery: 15

Calculation:
  Health: (100-10) * 0.5 = 45
  Frequency: min(30, 80 * 0.6) = 30
  Chapter: 15
  Mastery Ready: 10
  Focus: 0
  
  Base: 45+30+15+10 = 100
  
  Multipliers:
    Critical: ×1.5 = 150
  
FINAL SCORE: 150 (VERY HIGH)
```

**Example 2: New Rare Word**
```
Word: "asteroide" (asteroid)
- Health: 100 (fresh)
- Times in book: 3
- Chapter: 6
- Never reviewed

Calculation:
  Health: (100-100) * 0.5 = 0
  Frequency: 3 * 0.6 = 1.8
  Chapter: 5
  Mastery Ready: 0
  Focus: 0
  
  Base: 0+1.8+5 = 6.8
  
  Multipliers:
    New Word: ×0.8 = 5.4
  
FINAL SCORE: 5 (LOW)
```

---

## CARD SELECTION

### Deck Composition Strategy

Don't just select top-priority words blindly. Instead, create balanced mix:

**Target Mix (for 25-card deck):**

| Category | Target % | Cards | Purpose |
|----------|---------|-------|---------|
| Critical Health | 30% | 7-8 | Save dying words |
| Mastery Ready | 25% | 6-7 | Earn level-ups |
| Exposure Building | 25% | 6-7 | Consistent practice |
| New Words | 20% | 5 | Vocabulary expansion |

**Maximum New Words:** 5 per session (prevents overwhelm)

---

### Selection Algorithm

```javascript
function selectCardsForSession(allWords, deckSize = 25) {
  // Step 1: Calculate priority for all words
  const wordsWithPriority = allWords.map(word => ({
    ...word,
    priority: calculatePriorityScore(word)
  }));
  
  // Step 2: Categorize
  const critical = wordsWithPriority.filter(w => w.health < 20);
  const masteryReady = wordsWithPriority.filter(w => 
    w.timeGateMet && w.health >= 20
  );
  const exposure = wordsWithPriority.filter(w => 
    w.total_reviews < 10 && w.health >= 20 && !w.timeGateMet
  );
  const newWords = wordsWithPriority.filter(w => w.total_reviews === 0);
  
  // Step 3: Sort each category by priority
  critical.sort((a, b) => b.priority - a.priority);
  masteryReady.sort((a, b) => b.priority - a.priority);
  exposure.sort((a, b) => b.priority - a.priority);
  newWords.sort((a, b) => b.priority - a.priority);
  
  // Step 4: Fill deck by category
  const deck = [];
  const targets = {
    critical: Math.round(deckSize * 0.30),
    mastery: Math.round(deckSize * 0.25),
    exposure: Math.round(deckSize * 0.25),
    new: Math.min(5, Math.round(deckSize * 0.20))
  };
  
  deck.push(...critical.slice(0, targets.critical));
  deck.push(...masteryReady.slice(0, targets.mastery));
  deck.push(...exposure.slice(0, targets.exposure));
  deck.push(...newWords.slice(0, targets.new));
  
  // Step 5: Fill remaining with highest priority
  if (deck.length < deckSize) {
    const remaining = wordsWithPriority
      .filter(w => !deck.includes(w))
      .slice(0, deckSize - deck.length);
    deck.push(...remaining);
  }
  
  // Step 6: Shuffle to avoid predictability
  return shuffleArray(deck);
}
```

---

## TIME GATES

### Time Gate Values

| Mastery Level | Time Gate (hours) | Human-Readable |
|--------------|------------------|----------------|
| 0 (New) | 0 | Immediate |
| 1 (Introduced) | 4 | 4 hours |
| 2 (Recognizing) | 12 | 12 hours |
| 3 (Learning) | 24 | 1 day |
| 4 (Familiar) | 72 | 3 days |
| 5 (Known) | 168 | 7 days |
| 6 (Strong) | 336 | 14 days |
| 7 (Mastered) | 720 | 30 days |
| 8 (Expert) | 1440 | 60 days |
| 9 (Native) | 2880 | 120 days |
| 10 (Perfect) | 4320 | 180 days |

---

### Time Gate Check Logic

```javascript
function checkTimeGate(word) {
  // Don't Know always allowed
  if (!word.last_correct_review_at) {
    return { met: true, hoursRemaining: 0 };
  }
  
  const currentLevel = Math.floor(word.mastery_level / 10);
  const timeGateHours = TIME_GATES[currentLevel];
  const hoursSinceCorrect = calculateHoursSince(word.last_correct_review_at);
  
  if (hoursSinceCorrect >= timeGateHours) {
    return { met: true, hoursRemaining: 0 };
  } else {
    const hoursRemaining = timeGateHours - hoursSinceCorrect;
    return { met: false, hoursRemaining };
  }
}
```

---

### User Feedback for Time Gates

When time gate not met:

```
┌─────────────────────────────────────────────────────┐
│  ⏰ Time Gate Not Met                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  You reviewed this word too recently for mastery    │
│  credit. Your health still improved!                │
│                                                     │
│  Health: 40 → 60 (+20) ✓                            │
│  Mastery: 35 → 35 (wait 5.2 hours)                  │
│                                                     │
│  This encourages spaced repetition for better       │
│  long-term retention.                               │
│                                                     │
│  [Continue] [Learn More]                            │
└─────────────────────────────────────────────────────┘
```

---

## CHAPTER UNLOCKING

### Unlock Requirements

**Baseline (Required):**
- Must encounter 100% of unique lemmas in chapter

**PLUS one of three paths:**

**Path A: Quality (Mastery)**
- 40 average mastery across chapter lemmas

**Path B: Quantity (Exposure)**
- 50 total reviews across chapter lemmas

**Path C: Balanced**
- 30 average mastery AND 30 total reviews

---

### Calculation Logic

```javascript
function calculateChapterUnlock(userId, chapterId) {
  // Get all lemmas in chapter
  const chapterLemmas = getChapterLemmas(chapterId);
  const totalLemmas = chapterLemmas.length;
  
  // Get user's progress on these lemmas
  const userProgress = getUserLemmaProgress(userId, chapterLemmas);
  const encounteredLemmas = userProgress.length;
  
  // Calculate metrics
  const encounterRate = encounteredLemmas / totalLemmas;
  const avgMastery = average(userProgress.map(p => p.mastery_level));
  const totalReviews = sum(userProgress.map(p => p.total_reviews));
  
  // Check baseline
  const meetsBaseline = (encounterRate >= 1.0);
  
  // Check paths
  const pathA = (avgMastery >= 40);
  const pathB = (totalReviews >= 50);
  const pathC = (avgMastery >= 30 && totalReviews >= 30);
  
  const canUnlock = meetsBaseline && (pathA || pathB || pathC);
  
  return {
    canUnlock,
    encounterRate,
    encounteredLemmas,
    totalLemmas,
    avgMastery,
    totalReviews,
    pathsMet: { pathA, pathB, pathC }
  };
}
```

---

### Progress Display

```
┌─────────────────────────────────────────────────────┐
│  Chapter 2 Progress                                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 85% toward unlock            │
│                                                     │
│  Requirements (any one):                            │
│  ✅ Encounter: 289/289 lemmas (100%)                │
│  ⬜ Quality: 32/40 avg mastery (80%)                │
│  ✅ Quantity: 135/50 total reviews (270%)           │
│  ✅ Balanced: 32≥30 mastery + 135≥30 reviews        │
│                                                     │
│  You've met the quantity requirement!               │
│  Just 8 more mastery points to unlock via quality.  │
│                                                     │
│  [Study Chapter 2 →]                                │
└─────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION REFERENCE

### Key Database Queries

**Get User's Due Words:**
```sql
SELECT 
  l.lemma_id,
  l.lemma_text,
  l.definitions,
  ulp.mastery_level,
  ulp.health,
  ulp.last_reviewed_at,
  ulp.last_correct_review_at,
  ulp.total_reviews,
  COUNT(w.word_id) as times_in_book
FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
LEFT JOIN words w ON l.lemma_id = w.lemma_id
WHERE ulp.user_id = :user_id
  AND (
    ulp.health < 60  -- Due for review
    OR ulp.total_reviews = 0  -- New words
    OR ulp.review_due <= CURRENT_DATE  -- Scheduled
  )
GROUP BY l.lemma_id, ulp.user_id
ORDER BY ulp.health ASC, ulp.mastery_level ASC
LIMIT 100;
```

**Update Progress After Review:**
```sql
UPDATE user_lemma_progress
SET 
  mastery_level = GREATEST(0, LEAST(100, mastery_level + :mastery_change)),
  health = GREATEST(0, LEAST(100, health + :health_boost)),
  total_reviews = total_reviews + 1,
  correct_reviews = CASE WHEN :difficulty != 'dont-know' 
                         THEN correct_reviews + 1 
                         ELSE correct_reviews END,
  last_reviewed_at = NOW(),
  last_correct_review_at = CASE WHEN :difficulty != 'dont-know'
                                THEN NOW()
                                ELSE last_correct_review_at END,
  failed_in_last_3_sessions = :difficulty = 'dont-know',
  review_history = jsonb_insert(
    review_history,
    '{0}',
    jsonb_build_object(
      'timestamp', NOW(),
      'difficulty', :difficulty,
      'mastery_before', mastery_level,
      'health_before', health
    ),
    true
  ),
  review_due = CURRENT_DATE + INTERVAL '1 day' * :next_interval_days
WHERE user_id = :user_id AND lemma_id = :lemma_id;
```

---

### Constants Reference

```javascript
// Mastery point changes
const MASTERY_POINTS = {
  'dont-know': -5,
  'hard': +3,
  'medium': +6,
  'easy': +10
};

// Health boosts
const HEALTH_BOOSTS = {
  'dont-know': 10,
  'hard': 30,
  'medium': 60,
  'easy': 100
};

// Health decay rates (points per day)
const DECAY_RATES = {
  0: 25, 1: 20, 2: 12, 3: 8, 4: 5,
  5: 3, 6: 2, 7: 1.5, 8: 1, 9: 0.7, 10: 0.5
};

// Time gates (hours)
const TIME_GATES = {
  0: 0, 1: 4, 2: 12, 3: 24, 4: 72,
  5: 168, 6: 336, 7: 720, 8: 1440, 9: 2880, 10: 4320
};

// Priority weights
const PRIORITY_WEIGHTS = {
  healthUrgency: 0.5,
  frequency: 0.6,
  chapterBonus: { early: 15, mid: 10, late: 5 },
  masteryReady: 10,
  chapterFocus: 10,
  criticalMultiplier: 1.5,
  leechMultiplier: 1.3,
  newWordPenalty: 0.8
};

// Chapter unlock thresholds
const CHAPTER_UNLOCK = {
  encounterRate: 1.0,  // 100%
  pathA_mastery: 40,
  pathB_reviews: 50,
  pathC_mastery: 30,
  pathC_reviews: 30
};
```

---

## FUTURE: PHRASE FLASHCARDS

### Overview

In addition to individual lemmas, users will study idiomatic phrases as flashcards. Phrases are multi-word expressions where the combined meaning differs from the sum of individual word meanings.

**Example Phrase Learning:**

For the sentence "Las personas mayores nunca comprenden nada":
- User sees 3 flashcards:
  1. **persona** (the person)
  2. **mayor** (older, larger)
  3. **personas mayores** (grown-ups, adults) ← phrase flashcard

### Phrase Types

| Type | Description | Example |
|------|-------------|---------|
| Idiom | Non-literal meaning | "dar miedo" = "to scare" |
| Collocation | Frequently co-occurring | "tener razón" = "to be right" |
| Compound | Multi-word term | "selva virgen" = "primeval forest" |

### Priority Scoring for Phrases

Phrases use the same priority scoring system as lemmas:

```
PHRASE PRIORITY =
  (Health Urgency × 35%) +
  (Frequency in Book × 30%) +
  (Chapter Position × 15%) +
  (Mastery Readiness × 10%) +
  (Chapter Focus Bonus × 10%)
```

**Additional Phrase Considerations:**
- Phrases with component lemmas at low health get boosted priority
- If user knows "dar" and "miedo" but not "dar miedo", phrase gets priority
- Phrases marked as `is_reviewed = true` (admin-approved) get slight boost

### Phrase Mastery Tracking

Same as lemmas:

```sql
-- user_phrase_progress table
mastery_level: 0-100 (10 levels)
health: 0-100 (decays over time)
total_reviews: integer
last_reviewed_at: timestamp
```

### Implementation Status

**Current:** Phrase detection functional (Step 8B in pipeline)
**Deferred:** Flashcard integration (post-MVP)

Phrase flashcards will be integrated after MVP launch. Current focus is on:
1. Detecting phrases during chapter import
2. Storing phrases in database
3. Manual review of detected phrases

---

## RELATED DOCUMENTS

- See **02_DATABASE_SCHEMA.md** for data structure (includes phrase tables)
- See **03_CONTENT_PIPELINE.md** for phrase detection (Step 8B)
- See **01_MVP_DEFINITION.md** for scope
- See **VOQUAB_ALGORITHM_BIBLE_v1_0.md** for original specification (legacy)

---

## REVISION HISTORY

- 2025-11-30: Initial draft based on implemented Phase 1 + planned Phase 2 (Claude)
- Status: Awaiting Peter's approval

---

**END OF LEARNING ALGORITHM**
