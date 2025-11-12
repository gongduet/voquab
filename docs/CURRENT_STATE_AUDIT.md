# CURRENT STATE AUDIT: Spaced Repetition & Prioritization System

**Date:** November 2025
**File Analyzed:** `src/pages/Flashcards.jsx`

---

## 1. CARD SELECTION LOGIC

### Two Selection Modes

#### MODE A: "Due Today" Filter (`?filter=due`)
```javascript
// Lines 87-120
const { data, error: fetchError } = await supabase
  .from('user_vocabulary_progress')
  .select(/* ... full query with joins ... */)
  .eq('user_id', user.id)
  .eq('vocabulary.language_code', 'es')
  .gt('status_level', 0)              // Only reviewed words
  .lte('review_due', todayISO)        // Due today or earlier
```

**Selection Criteria:**
- ✅ Words user has reviewed before (`status_level > 0`)
- ✅ Words with `review_due` <= today
- ✅ Randomly shuffled from eligible words
- ✅ Limited to `sessionSize` cards (user configurable)

**Prioritization:** NONE
- No prioritization by urgency, mastery, or frequency
- Pure random selection from due words

#### MODE B: Default Random Selection (no filter)
```javascript
// Lines 194-217
const { data, error: fetchError } = await supabase
  .from('vocabulary')
  .select(/* ... full query ... */)
  .eq('language_code', 'es')
  .limit(200)  // Fetch more to account for filtering
```

**Selection Criteria:**
- ✅ Fetches 200 random words from entire vocabulary
- ✅ Filters out common words (STOP_WORDS + `is_common_word = true`)
- ✅ Randomly shuffled
- ✅ Limited to `sessionSize` cards

**Prioritization:** NONE
- No consideration of mastery level
- No consideration of previous reviews
- No consideration of word frequency or importance
- Pure random selection

### Randomization
```javascript
// Line 186 & 324
const shuffled = processedWords.sort(() => Math.random() - 0.5)
  .slice(0, Math.min(sessionSize, processedWords.length))
```
- ✅ Uses `Math.random() - 0.5` for shuffling
- ✅ No weighted randomization
- ✅ No intelligent ordering

---

## 2. MASTERY SYSTEM

### Current Implementation (Lines 573-598)

#### Mastery Points (0-100 scale)
```javascript
const masteryChanges = {
  'dont-know': -10,  // Decrease (but re-queued, so not saved)
  'hard': 3,         // Small increase
  'medium': 7,       // Moderate increase
  'easy': 15         // Large increase
}

const newMasteryLevel = Math.max(0, Math.min(100, currentMastery + masteryChange))
```

**Mastery Change Rules:**
- ❌ **Don't Know:** -10 points (NOT applied - card is re-queued instead)
- ✅ **Hard:** +3 points
- ✅ **Medium:** +7 points
- ✅ **Easy:** +15 points
- ✅ Clamped between 0-100

#### Mastery Thresholds
```javascript
// Lines 589-598
if (newMasteryLevel < 20) {
  daysToAdd = 0.5  // 12 hours - New words
} else if (newMasteryLevel < 50) {
  daysToAdd = 1    // 1 day - Learning
} else if (newMasteryLevel < 80) {
  daysToAdd = 3    // 3 days - Familiar
} else {
  daysToAdd = 7    // 7 days - Mastered
}
```

**Level Categories:**
- **0-19:** New (12 hour review interval)
- **20-49:** Learning (1 day review interval)
- **50-79:** Familiar (3 day review interval)
- **80-100:** Mastered (7 day review interval)

#### Time Gates / Restrictions
❌ **NONE** - No time gates or restrictions:
- No daily review limits
- No "too soon" checks
- No maximum reviews per word per day
- No cooldown periods

---

## 3. EXPOSURE TRACKING

### Current Implementation (Lines 658-705)

#### Tracked Metrics
```javascript
// TRACK 2: EXPOSURE (Quantity)
total_reviews: existing.total_reviews + 1,
correct_reviews: existing.correct_reviews + (isCorrect ? 1 : 0),
last_review_date: today,
review_history: reviewHistory,  // JSON array, last 20 reviews
```

**Exposure Data Tracked:**
- ✅ `total_reviews` - Total number of times reviewed
- ✅ `correct_reviews` - Number of correct responses (medium/easy)
- ✅ `last_review_date` - Last review date (YYYY-MM-DD)
- ✅ `review_history` - JSON array of last 20 reviews with:
  - `date` (YYYY-MM-DD)
  - `difficulty` (dont-know/hard/medium/easy)
  - `mastery_change` (points changed)
  - `new_mastery` (resulting mastery level)

#### How Exposure is Used
✅ **Chapter Unlocking** (calculated in `updateChapterProgress()`)
✅ **Progress Dashboard** (displayed in Learning Metrics)
❌ **NOT used for card selection/prioritization**
❌ **NOT used for review scheduling**

---

## 4. SPACED REPETITION INTERVALS

### Current Implementation

#### Interval Calculation (Lines 589-601)
```javascript
// Based on NEW mastery level after review
let daysToAdd
if (newMasteryLevel < 20) daysToAdd = 0.5   // 12 hours
else if (newMasteryLevel < 50) daysToAdd = 1     // 1 day
else if (newMasteryLevel < 80) daysToAdd = 3     // 3 days
else daysToAdd = 7                               // 7 days

const reviewDue = new Date()
reviewDue.setDate(reviewDue.getDate() + daysToAdd)
```

**Fixed Intervals (not exponential):**
- **Mastery 0-19:** 12 hours
- **Mastery 20-49:** 1 day
- **Mastery 50-79:** 3 days
- **Mastery 80-100:** 7 days

#### When Word is "Due"
```javascript
// Line 119
.lte('review_due', todayISO)  // Due today or earlier
```
- ✅ Simple date comparison
- ✅ No grace period
- ❌ No urgency scoring (overdue by 1 day = overdue by 30 days)

#### Interval Progression Example
```
Review 1: Answer "Easy" (+15) → Mastery 15 → Due in 12 hours
Review 2: Answer "Easy" (+15) → Mastery 30 → Due in 1 day
Review 3: Answer "Easy" (+15) → Mastery 45 → Due in 1 day
Review 4: Answer "Easy" (+15) → Mastery 60 → Due in 3 days
Review 5: Answer "Easy" (+15) → Mastery 75 → Due in 3 days
Review 6: Answer "Easy" (+15) → Mastery 90 → Due in 7 days
Review 7+: Answer "Easy" (+15) → Mastery 100 → Due in 7 days (max)
```

**Issues:**
- ❌ No exponential growth (SuperMemo/Anki use 1→2→4→8→16 days)
- ❌ Very slow progression (6 reviews to reach 7-day interval)
- ❌ Hard answers (+3) would take ~27 reviews to reach mastery

---

## 5. CHAPTER UNLOCKING

### Current Implementation (Lines 418-519)

#### Called After Session Completion
```javascript
// Line 718
await updateChapterProgress()
```

#### Unlock Formula (Lines 467-482)
```javascript
// Calculate unlock progress
const encounterRate = totalChapterWords > 0
  ? wordsEncountered / totalChapterWords
  : 0

let unlockProgress = 0
if (encounterRate < 0.8) {
  // Must encounter 80% first (BASELINE)
  unlockProgress = encounterRate * 50
} else {
  // Calculate via three paths, take maximum
  const masteryProgress = (avgMastery / 40) * 100
  const exposureProgress = (totalReviews / 50) * 100
  const balancedProgress = ((avgMastery / 30) * 50) + ((totalReviews / 30) * 50)
  unlockProgress = Math.min(100, Math.max(
    masteryProgress,
    exposureProgress,
    balancedProgress
  ))
}

// Check if should unlock
const shouldUnlock = (
  encounterRate >= 0.8 &&
  (avgMastery >= 40 || totalReviews >= 50 ||
   (avgMastery >= 30 && totalReviews >= 30))
)
```

#### Unlock Requirements (ANY ONE PATH)
**BASELINE:** Must encounter 80% of chapter's words

**PATH A (Quality):**
- Average mastery >= 40 across chapter words

**PATH B (Quantity):**
- Total reviews >= 50 across chapter words

**PATH C (Balanced):**
- Average mastery >= 30 AND total reviews >= 30

#### Auto-Unlock
```javascript
// Lines 491-506
const { error: upsertError } = await supabase
  .from('user_chapter_progress')
  .upsert({
    user_id: user.id,
    chapter_id: chapterId,
    words_encountered: wordsEncountered,
    total_chapter_words: totalChapterWords,
    total_reviews: totalReviews,
    average_mastery: avgMastery,
    unlock_progress: unlockProgress,
    is_unlocked: shouldUnlock,  // ← Auto-unlocks when requirements met
    unlocked_at: shouldUnlock ? new Date().toISOString() : undefined,
  })
```

✅ **Automatically unlocks** when any path requirement is met
✅ **Updates after every flashcard session**
✅ **Tracks progress toward unlock**

---

## 6. SESSION STRUCTURE

### Session Size Configuration

#### User Settings (Lines 52-70)
```javascript
async function fetchUserSettings() {
  const { data } = await supabase
    .from('user_settings')
    .select('cards_per_session')
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.cards_per_session || 25  // Default: 25 cards
}
```

✅ **User Configurable:** Via Settings page
✅ **Default:** 25 cards per session
✅ **Stored in:** `user_settings.cards_per_session`

#### Card Grouping
❌ **NO "PACKAGE" CONCEPT**
- Cards are not grouped into themed packages
- No concept of "today's lesson" or "daily package"
- Just random selection up to session size

#### Session Progression
```javascript
// Lines 708-720
if (currentIndex < cardQueue.length - 1) {
  // Move to next card
  setCurrentIndex(currentIndex + 1)
  setIsFlipped(false)
} else {
  // Session complete
  await updateDailyStats()
  await updateChapterProgress()
  setIsComplete(true)
}
```

✅ Linear progression through card queue
✅ Session completes when all cards reviewed
✅ Stats updated at end of session

---

## 7. HEALTH/DECAY SYSTEM

### Current Implementation

❌ **NO HEALTH TRACKING**
❌ **NO DECAY MECHANISM**
❌ **NO URGENCY PRIORITIZATION**

**What's Missing:**
- No concept of word "health" degrading over time
- No penalty for skipping reviews
- No prioritization of overdue words
- No "critical" status for words that need immediate attention
- Overdue by 1 day = overdue by 100 days (no urgency)

**Example Issue:**
```
Word A: Due 1 day ago, mastery 90
Word B: Due 30 days ago, mastery 40
→ Both have equal selection probability (random)
→ No urgency-based prioritization
```

---

## SUMMARY: What Exists vs What's Missing

### ✅ What's Working
1. **Dual Progression Tracking** - Mastery (quality) + Exposure (quantity)
2. **Basic Spaced Repetition** - Review intervals based on mastery
3. **Re-queuing** - "Don't Know" cards get re-queued in same session
4. **Chapter Unlocking** - Dual-path system working correctly
5. **User Settings** - Session size configurable
6. **Review History** - Last 20 reviews tracked per word

### ❌ Critical Missing Features
1. **NO INTELLIGENT PRIORITIZATION**
   - Random selection from due words
   - No urgency scoring for overdue words
   - No consideration of mastery level
   - No word frequency/importance weighting

2. **NO HEALTH/DECAY SYSTEM**
   - No health degradation over time
   - No penalties for missed reviews
   - No "critical" status for struggling words

3. **WEAK SPACED REPETITION**
   - Fixed intervals (not exponential)
   - Very slow progression to mastery
   - No ease factor or individual word adjustment

4. **NO PACKAGE/LESSON CONCEPT**
   - No themed daily packages
   - No intelligent word grouping
   - No curated learning progression

5. **NO REVIEW SCHEDULING INTELLIGENCE**
   - No lookahead to balance daily load
   - No "review ahead" option for vacations
   - No daily limit enforcement

---

## RECOMMENDATIONS FOR NEXT PHASE

### Priority 1: Intelligent Card Selection
- Implement priority scoring algorithm
- Weight by: urgency (days overdue) + mastery level + word importance
- Replace random shuffle with weighted selection

### Priority 2: Health/Decay System
- Add `health` field (0-100, decays over time)
- Calculate decay rate based on mastery level
- Prioritize words with low health

### Priority 3: Improved Spaced Repetition
- Implement exponential intervals (1→2→4→8→16 days)
- Add ease factor per word (adjusts intervals)
- Faster progression to mastery

### Priority 4: Daily Packages
- Create intelligent "today's package" concept
- Group related words thematically
- Balance new words + reviews

### Priority 5: Review Load Balancing
- Implement daily review limits
- Allow "review ahead" for busy days
- Smooth out review spikes

---

**End of Audit**
