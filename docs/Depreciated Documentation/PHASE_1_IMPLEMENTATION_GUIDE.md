# PHASE 1 IMPLEMENTATION GUIDE
## Intelligent Card Selection with Priority Scoring & Health System

**Goal:** Replace random card selection with intelligent prioritization based on word health, mastery readiness, and frequency.

**Duration:** 2-3 days  
**Impact:** IMMEDIATE improvement to learning effectiveness

---

## OVERVIEW

### What We're Building
1. **Health System** - Words decay over time, creating urgency
2. **Priority Scoring** - Each word gets scored for selection priority
3. **Intelligent Selection** - Replace random shuffle with weighted selection
4. **Time Gate Tracking** - Prepare for Phase 2 (time-gated mastery)

### What We're NOT Changing
- ✅ Keep existing mastery point changes (+3/+7/+15)
- ✅ Keep existing chapter unlocking logic
- ✅ Keep existing re-queuing for "Don't Know"
- ✅ Keep existing review history tracking
- ✅ Keep existing spaced repetition intervals

---

## STEP 1: DATABASE MIGRATION

### Add Missing Columns

```sql
-- Migration: Add health and time gate tracking
-- File: migrations/add-health-system.sql

BEGIN;

-- Add health column (0-100, decays over time)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100
  CHECK (health >= 0 AND health <= 100);

-- Add time gate tracking (for future Phase 2)
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS last_correct_review_at TIMESTAMPTZ;

-- Add struggling word detection
ALTER TABLE user_vocabulary_progress
  ADD COLUMN IF NOT EXISTS failed_in_last_3_sessions BOOLEAN DEFAULT FALSE;

-- Add index for health-based queries
CREATE INDEX IF NOT EXISTS idx_user_vocab_health 
  ON user_vocabulary_progress(user_id, health);

-- Backfill health for existing words
UPDATE user_vocabulary_progress
SET health = 100
WHERE health IS NULL;

COMMIT;

COMMENT ON COLUMN user_vocabulary_progress.health IS 
  'Word health (0-100). Decays over time based on mastery level. Low health = needs review urgently.';

COMMENT ON COLUMN user_vocabulary_progress.last_correct_review_at IS 
  'Timestamp of last correct review (Hard/Medium/Easy). Used for time gate enforcement in Phase 2.';

COMMENT ON COLUMN user_vocabulary_progress.failed_in_last_3_sessions IS 
  'True if word was marked "Don''t Know" in any of the last 3 review sessions. Used for leech detection.';
```

**Test Migration:**
```sql
-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_vocabulary_progress' 
  AND column_name IN ('health', 'last_correct_review_at', 'failed_in_last_3_sessions');

-- Should return 3 rows
```

---

## STEP 2: CREATE UTILITY FUNCTIONS

### File: `src/utils/healthCalculations.js`

```javascript
/**
 * Health decay rates by mastery level (points per day)
 * Higher mastery = slower decay = less frequent reviews needed
 */
export const HEALTH_DECAY_RATES = {
  0: 25,   // Level 0 (0-9 mastery): Decays 25 points/day = critical in 4 days
  1: 20,   // Level 1 (10-19 mastery): Decays 20 points/day = critical in 5 days
  2: 12,   // Level 2 (20-29 mastery): Decays 12 points/day = critical in 8 days
  3: 8,    // Level 3 (30-39 mastery): Decays 8 points/day = critical in 12 days
  4: 5,    // Level 4 (40-49 mastery): Decays 5 points/day = critical in 16 days
  5: 3,    // Level 5 (50-59 mastery): Decays 3 points/day = critical in 26 days
  6: 2,    // Level 6 (60-69 mastery): Decays 2 points/day = critical in 40 days
  7: 1.5,  // Level 7 (70-79 mastery): Decays 1.5 points/day = critical in 53 days
  8: 1,    // Level 8 (80-89 mastery): Decays 1 point/day = critical in 80 days
  9: 0.7,  // Level 9 (90-94 mastery): Decays 0.7 points/day = critical in 114 days
  10: 0.5  // Level 10 (95-100 mastery): Decays 0.5 points/day = critical in 160 days
}

/**
 * Calculate current health based on time since last review
 * Health decays over time - the longer since review, the lower the health
 * 
 * @param {Object} word - Word object with mastery_level, health, last_reviewed_at
 * @returns {Object} - { health, status, daysSinceReview, decayRate }
 */
export function calculateCurrentHealth(word) {
  if (!word.last_reviewed_at) {
    // Never reviewed - return stored health (should be 100)
    return {
      health: word.health || 100,
      status: getHealthStatus(word.health || 100),
      daysSinceReview: 0,
      decayRate: 0
    }
  }

  const now = new Date()
  const lastReview = new Date(word.last_reviewed_at)
  const daysSinceReview = (now - lastReview) / (1000 * 60 * 60 * 24)
  
  // Determine mastery level (0-10)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)
  const decayRate = HEALTH_DECAY_RATES[currentLevel]
  
  // Calculate decayed health
  const health = Math.max(0, (word.health || 100) - (daysSinceReview * decayRate))
  
  return {
    health: Math.round(health),
    status: getHealthStatus(health),
    daysSinceReview: Math.round(daysSinceReview * 10) / 10, // Round to 1 decimal
    decayRate: decayRate
  }
}

/**
 * Get health status category
 * @param {number} health - Current health (0-100)
 * @returns {string} - CRITICAL/LOW/MEDIUM/GOOD/EXCELLENT
 */
export function getHealthStatus(health) {
  if (health < 20) return 'CRITICAL'
  if (health < 40) return 'LOW'
  if (health < 60) return 'MEDIUM'
  if (health < 80) return 'GOOD'
  return 'EXCELLENT'
}

/**
 * Calculate health boost based on user response
 * @param {string} difficulty - 'dont-know'|'hard'|'medium'|'easy'
 * @returns {number} - Health points to add
 */
export function getHealthBoost(difficulty) {
  const boosts = {
    'dont-know': 10,   // Small boost - they're struggling
    'hard': 30,        // Moderate boost
    'medium': 60,      // Good boost
    'easy': 100        // Full restoration
  }
  return boosts[difficulty] || 0
}

/**
 * Apply health boost and clamp to 0-100
 * @param {number} currentHealth - Current health value
 * @param {number} boost - Health boost amount
 * @returns {number} - New health value (0-100)
 */
export function applyHealthBoost(currentHealth, boost) {
  return Math.min(100, Math.max(0, currentHealth + boost))
}
```

---

### File: `src/utils/priorityCalculations.js`

```javascript
import { calculateCurrentHealth } from './healthCalculations'

/**
 * Calculate priority score for a word
 * Higher score = more likely to be selected for review
 * 
 * @param {Object} word - Word with progress data and vocabulary metadata
 * @param {Object} options - { chapterFocus: boolean, focusChapterId: uuid }
 * @returns {Object} - { totalScore, breakdown, currentHealth, status }
 */
export function calculatePriorityScore(word, options = {}) {
  const currentHealth = calculateCurrentHealth(word)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)
  
  let score = 0
  const breakdown = {}
  
  // COMPONENT 1: Health Urgency (0-50 points) - 35% weight
  // Lower health = higher urgency = higher score
  const healthScore = (100 - currentHealth.health) * 0.5
  score += healthScore
  breakdown.health = Math.round(healthScore)
  
  // COMPONENT 2: Frequency in Book (0-30 points) - 30% weight
  // More frequent words are more important to learn
  const timesInBook = word.vocabulary?.times_in_book || word.times_in_book || 1
  const frequencyScore = Math.min(30, timesInBook * 0.6)
  score += frequencyScore
  breakdown.frequency = Math.round(frequencyScore)
  
  // COMPONENT 3: Chapter Position (0-15 points) - 15% weight
  // Earlier chapters = foundational vocabulary = higher priority
  const chapterNumber = word.vocabulary?.chapters?.chapter_number || 
                        word.chapter_number || 
                        999
  let chapterScore = 5 // Default for unknown chapters
  if (chapterNumber <= 3) chapterScore = 15
  else if (chapterNumber <= 5) chapterScore = 10
  score += chapterScore
  breakdown.chapter = chapterScore
  
  // COMPONENT 4: Mastery Readiness (0-10 points) - 10% weight
  // Can they gain mastery points right now? (Phase 2 will enforce time gates)
  // For now, just check if they have mastery < 100
  const masteryReady = (word.mastery_level || 0) < 100 ? 10 : 0
  score += masteryReady
  breakdown.masteryReady = masteryReady
  
  // COMPONENT 5: Chapter Focus Bonus (0-10 points) - 10% weight
  // If user has chapter focus mode enabled, boost current chapter words
  if (options.chapterFocus && word.chapter_id === options.focusChapterId) {
    score += 10
    breakdown.chapterFocus = 10
  } else {
    breakdown.chapterFocus = 0
  }
  
  // MULTIPLIER 1: Critical Health (×1.5)
  // Critical words get 50% priority boost
  if (currentHealth.health < 20) {
    score *= 1.5
    breakdown.criticalMultiplier = 1.5
  } else {
    breakdown.criticalMultiplier = 1.0
  }
  
  // MULTIPLIER 2: Leech/Struggling Word (×1.3)
  // Words marked "Don't Know" recently get attention boost
  if (word.failed_in_last_3_sessions) {
    score *= 1.3
    breakdown.leechMultiplier = 1.3
  } else {
    breakdown.leechMultiplier = 1.0
  }
  
  // MULTIPLIER 3: New Word Penalty (×0.8)
  // Brand new words are slightly deprioritized
  // (Review existing knowledge > learning new words)
  if ((word.total_reviews || 0) === 0) {
    score *= 0.8
    breakdown.newWordPenalty = 0.8
  } else {
    breakdown.newWordPenalty = 1.0
  }
  
  return {
    totalScore: Math.round(score),
    breakdown: breakdown,
    currentHealth: currentHealth.health,
    status: currentHealth.status,
    healthInfo: currentHealth
  }
}

/**
 * Select cards for review session using priority scoring
 * Replaces random selection with intelligent prioritization
 * 
 * @param {Array} words - Array of word objects with progress data
 * @param {number} count - Number of cards to select
 * @param {Object} options - { chapterFocus, focusChapterId }
 * @returns {Object} - { cards, stats }
 */
export function selectCardsForSession(words, count = 25, options = {}) {
  // Calculate priority scores for all words
  const scoredWords = words.map(word => ({
    ...word,
    priority: calculatePriorityScore(word, options)
  }))
  
  // Sort by priority score (highest first)
  scoredWords.sort((a, b) => b.priority.totalScore - a.priority.totalScore)
  
  // Select top N cards
  const selectedCards = scoredWords.slice(0, count)
  
  // Shuffle to avoid predictability in card order
  // (User shouldn't know "first 7 cards are always critical")
  const shuffled = shuffleArray(selectedCards)
  
  // Calculate session statistics
  const stats = {
    totalAvailable: words.length,
    selected: shuffled.length,
    critical: shuffled.filter(c => c.priority.currentHealth < 20).length,
    low: shuffled.filter(c => c.priority.currentHealth >= 20 && c.priority.currentHealth < 40).length,
    medium: shuffled.filter(c => c.priority.currentHealth >= 40 && c.priority.currentHealth < 60).length,
    good: shuffled.filter(c => c.priority.currentHealth >= 60).length,
    new: shuffled.filter(c => (c.total_reviews || 0) === 0).length,
    avgPriority: Math.round(shuffled.reduce((sum, c) => sum + c.priority.totalScore, 0) / shuffled.length)
  }
  
  return {
    cards: shuffled,
    stats: stats
  }
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle (modifies in place)
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
```

---

## STEP 3: UPDATE FLASHCARDS.JSX

### Changes to Card Selection (Lines 87-217)

Replace the existing `fetchVocabulary` function:

```javascript
// Import new utilities at top of file
import { calculateCurrentHealth, getHealthBoost, applyHealthBoost } from '../utils/healthCalculations'
import { calculatePriorityScore, selectCardsForSession } from '../utils/priorityCalculations'

// REPLACE fetchVocabulary function (lines ~87-217)
const fetchVocabulary = async () => {
  try {
    setLoading(true)
    setError(null)

    // Get user settings (session size)
    const { data: settings } = await supabase
      .from('user_settings')
      .select('cards_per_session')
      .eq('user_id', user.id)
      .maybeSingle()

    const sessionSize = settings?.cards_per_session || 25

    // MODE A: Due Today Filter
    if (filterMode === 'due') {
      // Fetch words that are due for review
      const todayISO = new Date().toISOString().split('T')[0]
      
      const { data, error: fetchError } = await supabase
        .from('user_vocabulary_progress')
        .select(`
          *,
          vocabulary!inner (
            vocab_id,
            lemma,
            language_code,
            english_definition,
            part_of_speech,
            difficulty_rank,
            gender,
            times_in_book:vocabulary_occurrences(count),
            first_occurrence:vocabulary_occurrences!inner(
              sentences!inner(
                sentence_id,
                sentence_text,
                sentence_translation,
                chapters!inner(
                  chapter_id,
                  chapter_number,
                  chapter_title
                )
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('vocabulary.language_code', 'es')
        .gt('mastery_level', 0)  // Only reviewed words
        .lte('review_due', todayISO)
        .limit(200)  // Fetch more candidates

      if (fetchError) throw fetchError
      if (!data || data.length === 0) {
        setVocabulary([])
        setLoading(false)
        return
      }

      // Process and flatten data
      const processedWords = data.map(item => ({
        ...item,
        ...item.vocabulary,
        spanish: item.vocabulary.lemma,
        english: item.vocabulary.english_definition,
        times_in_book: item.vocabulary.times_in_book?.[0]?.count || 1,
        chapter_id: item.vocabulary.first_occurrence?.[0]?.sentences?.chapters?.chapter_id,
        chapter_number: item.vocabulary.first_occurrence?.[0]?.sentences?.chapters?.chapter_number,
        sentence: item.vocabulary.first_occurrence?.[0]?.sentences
      }))

      // USE PRIORITY-BASED SELECTION (not random!)
      const { cards, stats } = selectCardsForSession(
        processedWords, 
        sessionSize,
        { chapterFocus: false } // TODO: Get from user settings in future
      )

      console.log('📊 Session Stats:', stats)
      setVocabulary(cards)
      setLoading(false)
      return
    }

    // MODE B: Default Random Selection (for new words)
    // Keep existing logic but could be improved in future
    const { data, error: fetchError } = await supabase
      .from('vocabulary')
      .select(`
        vocab_id,
        lemma,
        language_code,
        english_definition,
        part_of_speech,
        difficulty_rank,
        gender,
        times_in_book:vocabulary_occurrences(count),
        first_occurrence:vocabulary_occurrences!inner(
          sentences!inner(
            sentence_id,
            sentence_text,
            sentence_translation,
            chapters!inner(chapter_id, chapter_number, chapter_title)
          )
        ),
        user_progress:user_vocabulary_progress!left(
          user_id,
          mastery_level,
          health,
          total_reviews,
          last_reviewed_at
        )
      `)
      .eq('language_code', 'es')
      .limit(200)

    if (fetchError) throw fetchError
    if (!data || data.length === 0) {
      setVocabulary([])
      setLoading(false)
      return
    }

    // Process, filter, and prioritize
    let processedWords = data
      .filter(item => !STOP_WORDS.includes(item.lemma.toLowerCase()))
      .map(item => ({
        ...item,
        spanish: item.lemma,
        english: item.english_definition,
        times_in_book: item.times_in_book?.[0]?.count || 1,
        chapter_id: item.first_occurrence?.[0]?.sentences?.chapters?.chapter_id,
        chapter_number: item.first_occurrence?.[0]?.sentences?.chapters?.chapter_number,
        sentence: item.first_occurrence?.[0]?.sentences,
        // Include user progress if exists
        mastery_level: item.user_progress?.[0]?.mastery_level || 0,
        health: item.user_progress?.[0]?.health || 100,
        total_reviews: item.user_progress?.[0]?.total_reviews || 0,
        last_reviewed_at: item.user_progress?.[0]?.last_reviewed_at
      }))

    // For new words mode, just shuffle (priority selection less critical)
    const shuffled = processedWords
      .sort(() => Math.random() - 0.5)
      .slice(0, sessionSize)

    setVocabulary(shuffled)
    setLoading(false)

  } catch (error) {
    console.error('Error fetching vocabulary:', error)
    setError('Failed to load vocabulary')
    setLoading(false)
  }
}
```

---

### Changes to Review Submission (Lines 573-720)

Update the `handleSubmitReview` function to:
1. Calculate current health before update
2. Apply health boost based on response
3. Update `last_correct_review_at` for correct responses
4. Track `failed_in_last_3_sessions`

```javascript
// REPLACE handleSubmitReview function (lines ~573-720)
const handleSubmitReview = async (difficulty) => {
  const currentCard = cardQueue[currentIndex]
  if (!currentCard) return

  try {
    const isCorrect = ['hard', 'medium', 'easy'].includes(difficulty)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Get existing progress
    const { data: existing } = await supabase
      .from('user_vocabulary_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('vocab_id', currentCard.vocab_id)
      .maybeSingle()

    // CALCULATE CURRENT HEALTH (before update)
    const currentHealthData = calculateCurrentHealth(existing || {
      mastery_level: 0,
      health: 100,
      last_reviewed_at: null
    })

    // MASTERY SYSTEM (keep existing logic)
    const masteryChanges = {
      'dont-know': -10,  // Not applied (re-queued instead)
      'hard': 3,
      'medium': 7,
      'easy': 15
    }

    const currentMastery = existing?.mastery_level || 0
    const masteryChange = masteryChanges[difficulty] || 0
    
    // For "dont-know", we re-queue (don't update mastery)
    const shouldUpdateMastery = difficulty !== 'dont-know'
    const newMasteryLevel = shouldUpdateMastery 
      ? Math.max(0, Math.min(100, currentMastery + masteryChange))
      : currentMastery

    // HEALTH SYSTEM (new!)
    const healthBoost = getHealthBoost(difficulty)
    const newHealth = applyHealthBoost(currentHealthData.health, healthBoost)

    // Calculate new review due date (keep existing logic)
    let daysToAdd
    if (newMasteryLevel < 20) daysToAdd = 0.5
    else if (newMasteryLevel < 50) daysToAdd = 1
    else if (newMasteryLevel < 80) daysToAdd = 3
    else daysToAdd = 7

    const reviewDue = new Date()
    reviewDue.setDate(reviewDue.getDate() + daysToAdd)

    // Update review history
    const reviewHistory = existing?.review_history || []
    reviewHistory.unshift({
      date: today,
      difficulty: difficulty,
      mastery_change: shouldUpdateMastery ? masteryChange : 0,
      new_mastery: newMasteryLevel,
      health_before: currentHealthData.health,
      health_after: newHealth,
      health_boost: healthBoost
    })
    const trimmedHistory = reviewHistory.slice(0, 20)

    // Track struggling words
    const recentFailures = trimmedHistory
      .slice(0, 3)
      .filter(r => r.difficulty === 'dont-know')
      .length
    const failedInLast3 = recentFailures > 0

    // Prepare update data
    const updateData = {
      user_id: user.id,
      vocab_id: currentCard.vocab_id,
      
      // TRACK 1: MASTERY
      mastery_level: newMasteryLevel,
      review_due: reviewDue.toISOString().split('T')[0],
      last_correct_review_at: isCorrect ? now : existing?.last_correct_review_at,
      
      // TRACK 2: HEALTH (new!)
      health: newHealth,
      
      // TRACK 3: EXPOSURE
      total_reviews: (existing?.total_reviews || 0) + 1,
      correct_reviews: (existing?.correct_reviews || 0) + (isCorrect ? 1 : 0),
      last_review_date: today,
      last_reviewed_at: now,
      review_history: trimmedHistory,
      
      // STRUGGLING WORD DETECTION
      failed_in_last_3_sessions: failedInLast3,
      
      // Keep existing fields
      times_reviewed: (existing?.times_reviewed || 0) + 1,
      times_correct: (existing?.times_correct || 0) + (isCorrect ? 1 : 0),
      times_incorrect: (existing?.times_incorrect || 0) + (isCorrect ? 0 : 1),
      updated_at: now
    }

    // Upsert to database
    const { error: upsertError } = await supabase
      .from('user_vocabulary_progress')
      .upsert(updateData)

    if (upsertError) throw upsertError

    // RE-QUEUE LOGIC (keep existing)
    if (difficulty === 'dont-know') {
      const reappearPosition = Math.min(
        cardQueue.length,
        currentIndex + Math.floor(Math.random() * 5) + 3
      )
      const updatedQueue = [...cardQueue]
      updatedQueue.splice(reappearPosition, 0, {
        ...currentCard,
        isRetry: true
      })
      setCardQueue(updatedQueue)
    }

    // Move to next card or complete session
    if (currentIndex < cardQueue.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    } else {
      // Session complete
      await updateDailyStats()
      await updateChapterProgress()
      setIsComplete(true)
    }

  } catch (error) {
    console.error('Error submitting review:', error)
    alert('Failed to save review. Please try again.')
  }
}
```

---

## STEP 4: TESTING CHECKLIST

### Database Tests
```sql
-- 1. Verify new columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_vocabulary_progress' 
  AND column_name IN ('health', 'last_correct_review_at', 'failed_in_last_3_sessions');
-- Should return 3 rows

-- 2. Verify health is backfilled
SELECT COUNT(*) as total_words,
       COUNT(*) FILTER (WHERE health = 100) as with_health_100,
       COUNT(*) FILTER (WHERE health IS NULL) as null_health
FROM user_vocabulary_progress;
-- null_health should be 0

-- 3. Verify index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'user_vocabulary_progress' 
  AND indexname = 'idx_user_vocab_health';
-- Should return 1 row
```

### Functional Tests

**Test 1: Priority Scoring Works**
- Open browser console
- Start flashcard session with `?filter=due`
- Look for log: `📊 Session Stats:`
- Verify stats show breakdown by health status

**Test 2: Health Decays Over Time**
- Review a word, mark as "Easy"
- Check database: `SELECT health, last_reviewed_at FROM user_vocabulary_progress WHERE vocab_id = '...'`
- Wait 1 day (or manually change `last_reviewed_at` to yesterday)
- Start new session
- Word should appear with lower health

**Test 3: Critical Words Appear More**
- Manually set some words to health < 20 in database
- Start session
- Verify critical words appear in first ~30% of deck

**Test 4: Health Restoration Works**
- Find word with low health
- Review it, mark as "Easy"
- Check database: health should be 100

**Test 5: Struggling Word Detection**
- Review a word, mark "Don't Know" 3 times
- Check database: `failed_in_last_3_sessions` should be TRUE

**Test 6: Existing Features Still Work**
- Mastery still increases with correct answers
- "Don't Know" re-queues in same session
- Review history still tracks last 20 reviews
- Chapter unlocking still works

---

## STEP 5: SUCCESS CRITERIA

✅ **Phase 1 is complete when:**

1. **Database Migration Successful**
   - All 3 new columns exist
   - Health backfilled to 100
   - Index created

2. **Priority Selection Works**
   - Console shows session stats
   - Critical words appear more frequently
   - No more purely random selection

3. **Health System Functional**
   - Health decays over time (can verify in database)
   - Health restored on review
   - Low health = higher priority

4. **No Regressions**
   - Existing features work as before
   - Mastery progression unchanged
   - Chapter unlocking unchanged
   - Re-queuing still works

5. **Code Quality**
   - New utility files created
   - Functions documented
   - Console logs for debugging
   - No errors in browser console

---

## NOTES FOR IMPLEMENTATION

### Order Matters
1. Run migration FIRST
2. Create utility files SECOND
3. Update Flashcards.jsx LAST
4. Test incrementally

### Backwards Compatibility
- All new columns have defaults
- Existing code will work even if new columns don't exist yet
- Health calculation handles missing data gracefully

### Future Phases
This lays groundwork for:
- **Phase 2:** Time-gated mastery (uses `last_correct_review_at`)
- **Phase 3:** Package system (uses priority scoring)
- **Phase 4:** Waypoints (uses priority scoring)

### Debug Logging
Keep console.log statements for debugging:
- Priority scores
- Session stats
- Health calculations

Remove in production once stable.

---

## ROLLBACK PLAN

If something breaks:

```sql
-- Remove new columns
ALTER TABLE user_vocabulary_progress
  DROP COLUMN IF EXISTS health,
  DROP COLUMN IF EXISTS last_correct_review_at,
  DROP COLUMN IF EXISTS failed_in_last_3_sessions;

-- Remove index
DROP INDEX IF EXISTS idx_user_vocab_health;
```

Then revert code changes.

---

**Ready to implement!** 🚀

Start with Step 1 (migration), test, then proceed to Step 2.
