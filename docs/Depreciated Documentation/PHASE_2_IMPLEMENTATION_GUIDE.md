# PHASE 2 IMPLEMENTATION GUIDE
## Time-Gated Mastery System

**Goal:** Prevent gaming the system through rapid-fire reviewing. Enforce spaced repetition by requiring minimum time between mastery gains.

**Duration:** 1-2 days  
**Impact:** Ensures genuine learning, prevents artificial mastery inflation

---

## OVERVIEW

### What We're Building
Time gates that prevent users from gaining mastery points too quickly. Each mastery level requires a minimum waiting period since the last correct review.

### What Changes
- ✅ Mastery points only awarded if time gate is met
- ✅ Health always improves (even when mastery blocked)
- ✅ UI shows "wait X hours" message when time gate not met
- ✅ "Don't Know" bypasses time gates (forgetting happens)

### What Stays the Same
- ✅ Mastery point values (+3/+7/+15)
- ✅ Health system from Phase 1
- ✅ Priority scoring from Phase 1
- ✅ Chapter unlocking

---

## STEP 1: CREATE TIME GATE UTILITY

### File: `src/utils/timeGateCalculations.js`

```javascript
/**
 * Time gate requirements for each mastery level (in hours)
 * These enforce spaced repetition - higher levels = longer waits
 */
export const TIME_GATES = {
  0: 0,        // Level 0 (0-9 mastery): No gate (new word)
  1: 4,        // Level 1 (10-19 mastery): 4 hours
  2: 12,       // Level 2 (20-29 mastery): 12 hours
  3: 24,       // Level 3 (30-39 mastery): 1 day
  4: 72,       // Level 4 (40-49 mastery): 3 days
  5: 168,      // Level 5 (50-59 mastery): 7 days
  6: 336,      // Level 6 (60-69 mastery): 14 days
  7: 720,      // Level 7 (70-79 mastery): 30 days
  8: 1440,     // Level 8 (80-89 mastery): 60 days
  9: 2880,     // Level 9 (90-94 mastery): 120 days
  10: 4320     // Level 10 (95-100 mastery): 180 days
}

/**
 * Check if user can gain mastery points right now
 * 
 * @param {Object} word - Word with mastery_level and last_correct_review_at
 * @returns {Object} - { canGainMastery, hoursUntilEligible, timeGateHours, message }
 */
export function checkTimeGate(word) {
  // If never reviewed correctly, time gate is automatically met
  if (!word.last_correct_review_at) {
    return {
      canGainMastery: true,
      hoursUntilEligible: 0,
      timeGateHours: 0,
      message: null
    }
  }

  // Determine current mastery level (0-10)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)
  const requiredHours = TIME_GATES[currentLevel]
  
  // Calculate hours since last correct review
  const now = new Date()
  const lastCorrect = new Date(word.last_correct_review_at)
  const hoursSinceCorrect = (now - lastCorrect) / (1000 * 60 * 60)
  
  // Check if time gate is met
  const canGainMastery = hoursSinceCorrect >= requiredHours
  const hoursUntilEligible = canGainMastery 
    ? 0 
    : Math.ceil(requiredHours - hoursSinceCorrect)
  
  // Generate user-friendly message
  let message = null
  if (!canGainMastery) {
    if (hoursUntilEligible < 1) {
      message = `Wait ${Math.ceil(hoursUntilEligible * 60)} more minutes for mastery credit`
    } else if (hoursUntilEligible === 1) {
      message = `Wait 1 more hour for mastery credit`
    } else if (hoursUntilEligible < 24) {
      message = `Wait ${hoursUntilEligible} more hours for mastery credit`
    } else {
      const days = Math.ceil(hoursUntilEligible / 24)
      message = `Wait ${days} more day${days > 1 ? 's' : ''} for mastery credit`
    }
  }
  
  return {
    canGainMastery,
    hoursUntilEligible,
    timeGateHours: requiredHours,
    hoursSinceCorrect: Math.round(hoursSinceCorrect * 10) / 10,
    message
  }
}

/**
 * Calculate mastery change with time gate enforcement
 * 
 * @param {Object} word - Current word state
 * @param {string} difficulty - 'dont-know'|'hard'|'medium'|'easy'
 * @returns {Object} - { masteryChange, newMastery, timeGateInfo, healthBoost }
 */
export function calculateMasteryChange(word, difficulty) {
  const currentMastery = word.mastery_level || 0
  
  // Mastery point values
  const masteryPoints = {
    'dont-know': -5,
    'hard': 3,
    'medium': 6,
    'easy': 10
  }
  
  // "Don't Know" always applies (no time gate check)
  if (difficulty === 'dont-know') {
    const newMastery = Math.max(0, currentMastery - 5)
    return {
      masteryChange: -5,
      newMastery: newMastery,
      timeGateInfo: {
        canGainMastery: true,
        bypassed: true,
        reason: 'Forgetting has no time gate'
      },
      healthBoost: 10
    }
  }
  
  // Check time gate for correct responses
  const timeGateInfo = checkTimeGate(word)
  
  // If time gate met, apply mastery change
  if (timeGateInfo.canGainMastery) {
    const masteryChange = masteryPoints[difficulty] || 0
    const newMastery = Math.max(0, Math.min(100, currentMastery + masteryChange))
    
    return {
      masteryChange,
      newMastery,
      timeGateInfo: {
        ...timeGateInfo,
        applied: true
      },
      healthBoost: getHealthBoost(difficulty)
    }
  }
  
  // Time gate NOT met - no mastery change, but health still improves
  return {
    masteryChange: 0,
    newMastery: currentMastery, // No change
    timeGateInfo: {
      ...timeGateInfo,
      applied: false,
      blocked: true
    },
    healthBoost: getHealthBoost(difficulty)
  }
}

/**
 * Get health boost by difficulty
 * @param {string} difficulty 
 * @returns {number}
 */
function getHealthBoost(difficulty) {
  const boosts = {
    'dont-know': 10,
    'hard': 30,
    'medium': 60,
    'easy': 100
  }
  return boosts[difficulty] || 0
}

/**
 * Format time remaining for display
 * @param {number} hours - Hours until eligible
 * @returns {string} - "2 hours" or "3 days" or "45 minutes"
 */
export function formatTimeRemaining(hours) {
  if (hours < 1) {
    const minutes = Math.ceil(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  } else if (hours < 24) {
    const roundedHours = Math.ceil(hours)
    return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`
  } else {
    const days = Math.ceil(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''}`
  }
}
```

---

## STEP 2: UPDATE FLASHCARDS.JSX

### Changes to handleDifficulty Function

Replace the mastery calculation section (around lines 670-695):

```javascript
// Import new utility at top of file
import { calculateMasteryChange } from '../utils/timeGateCalculations'

// INSIDE handleDifficulty function:
// Replace the mastery calculation section with:

    // CALCULATE MASTERY CHANGE WITH TIME GATE ENFORCEMENT
    const masteryResult = calculateMasteryChange(existing || {
      mastery_level: 0,
      last_correct_review_at: null
    }, difficulty)

    const newMasteryLevel = masteryResult.newMastery
    const masteryChange = masteryResult.masteryChange
    const timeGateBlocked = masteryResult.timeGateInfo.blocked

    // Log time gate info for debugging
    if (masteryResult.timeGateInfo.message) {
      console.log('⏰ Time Gate:', masteryResult.timeGateInfo.message)
    }

    // HEALTH SYSTEM (unchanged from Phase 1)
    const healthBoost = masteryResult.healthBoost
    const newHealth = applyHealthBoost(currentHealthData.health, healthBoost)

    // Calculate new review due date (unchanged)
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
      mastery_change: masteryChange,
      new_mastery: newMasteryLevel,
      health_before: currentHealthData.health,
      health_after: newHealth,
      health_boost: healthBoost,
      time_gate_met: !timeGateBlocked,  // NEW!
      time_gate_message: masteryResult.timeGateInfo.message || null  // NEW!
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
      last_correct_review_at: (difficulty !== 'dont-know' && masteryChange > 0) 
        ? now 
        : existing?.last_correct_review_at,
      
      // TRACK 2: HEALTH
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

    // SHOW TIME GATE MESSAGE TO USER (if blocked)
    if (timeGateBlocked && masteryResult.timeGateInfo.message) {
      // Store message to show in UI
      setTimeGateMessage(masteryResult.timeGateInfo.message)
      // Clear message after 3 seconds
      setTimeout(() => setTimeGateMessage(null), 3000)
    }
```

---

## STEP 3: ADD UI FEEDBACK FOR TIME GATES

### Add State for Time Gate Message

Near the top of Flashcards component (around line 40):

```javascript
const [timeGateMessage, setTimeGateMessage] = useState(null)
```

### Add Visual Feedback in UI

Add this somewhere visible in your flashcard UI (after the card flip section):

```javascript
{/* Time Gate Feedback Message */}
{timeGateMessage && (
  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
    <div className="flex items-center gap-2">
      <span className="text-yellow-600">⏰</span>
      <p className="text-sm text-yellow-800">
        <strong>Health improved!</strong> {timeGateMessage}
      </p>
    </div>
  </div>
)}
```

**Or** if you prefer a toast notification, you can use a toast library.

---

## STEP 4: UPDATE PRIORITY CALCULATIONS (OPTIONAL ENHANCEMENT)

In `src/utils/priorityCalculations.js`, update the "Mastery Readiness" component:

```javascript
// Replace the mastery readiness section with:
import { checkTimeGate } from './timeGateCalculations'

// Inside calculatePriorityScore function:

  // COMPONENT 4: Mastery Readiness (0-10 points) - 10% weight
  // Can they gain mastery points right now?
  const timeGateInfo = checkTimeGate(word)
  const masteryReady = timeGateInfo.canGainMastery && (word.mastery_level || 0) < 100 ? 10 : 0
  score += masteryReady
  breakdown.masteryReady = masteryReady
```

This makes the priority system aware of time gates, prioritizing words that are actually eligible for mastery gains.

---

## STEP 5: TESTING CHECKLIST

### Test 1: Time Gate Blocks Rapid Review
1. Review a word at Level 3+ (mastery 30+)
2. Mark it as "Medium" (+6 mastery normally)
3. Immediately start a new session
4. Review the same word again within minutes
5. Mark as "Medium" again

**Expected:**
- ✅ Health improves both times
- ✅ Mastery increases first time
- ❌ Mastery does NOT increase second time
- ✅ UI shows: "Wait X hours for mastery credit"
- ✅ Console log shows: `⏰ Time Gate: Wait 23 more hours for mastery credit`

---

### Test 2: Don't Know Bypasses Time Gate
1. Review a word that was just reviewed
2. Mark as "Don't Know"

**Expected:**
- ✅ Mastery decreases by 5 (time gate ignored)
- ✅ Card re-queues in same session

---

### Test 3: Check Database
```sql
SELECT 
  vocab_id,
  mastery_level,
  last_correct_review_at,
  review_history->0 AS latest_review
FROM user_vocabulary_progress
WHERE user_id = 'your-user-id'
ORDER BY last_reviewed_at DESC
LIMIT 3;
```

**Look for in `latest_review` JSON:**
```json
{
  "time_gate_met": false,
  "time_gate_message": "Wait 23 more hours for mastery credit",
  "mastery_change": 0,
  ...
}
```

---

### Test 4: Level 0-1 Words (Short Gates)
1. Review a new word (Level 0, mastery 0-9)
2. Mark as "Easy" (+10 mastery → Level 1)
3. Wait 4+ hours (or change `last_correct_review_at` in database)
4. Review again

**Expected:**
- ✅ After 4 hours, can gain mastery again

---

### Test 5: High-Level Words (Long Gates)
1. Review a word at Level 7+ (mastery 70-79)
2. Mark as "Easy"
3. Try reviewing again within 30 days

**Expected:**
- ❌ Cannot gain mastery (need to wait 30 days)
- ✅ Health still improves
- ✅ Message shows: "Wait X days for mastery credit"

---

## STEP 6: SUCCESS CRITERIA

✅ **Phase 2 is complete when:**

1. **Time Gates Enforced**
   - Rapid reviews don't increase mastery
   - Console shows time gate messages
   - UI shows feedback to user

2. **Health Still Improves**
   - Even when mastery blocked, health increases
   - Review history tracks both

3. **Don't Know Works**
   - "Don't Know" decreases mastery regardless of time gate
   - Card still re-queues

4. **Database Tracking**
   - `review_history` includes `time_gate_met` and `time_gate_message`
   - `last_correct_review_at` only updates when mastery gained

5. **No Regressions**
   - Phase 1 features still work
   - Priority scoring still functions
   - Health system still active

---

## NOTES FOR IMPLEMENTATION

### Time Gate Strategy
- **Short gates** (4-12 hours): Prevents same-day cramming
- **Medium gates** (1-7 days): Enforces true spaced repetition
- **Long gates** (14-180 days): Maintains mastery over months/years

### User Experience
- Always show positive feedback ("Health improved!")
- Then explain time gate ("Wait X hours for mastery")
- Never block reviewing (they can still see the word)
- Just block the mastery gain (the "gaming" aspect)

### Edge Cases
- First correct review: Always allows mastery gain
- "Don't Know": Always bypasses time gate
- Mastery 100: No more mastery to gain (gate irrelevant)

---

## WHAT THIS ACHIEVES

### Before Phase 2:
```
9:00 AM: Review "el fracaso" → Mark "Easy" → Mastery 0 → 15 ✅
9:05 AM: Review "el fracaso" → Mark "Easy" → Mastery 15 → 30 ✅
9:10 AM: Review "el fracaso" → Mark "Easy" → Mastery 30 → 45 ✅
9:15 AM: Review "el fracaso" → Mark "Easy" → Mastery 45 → 60 ✅

Result: Mastery 60 in 15 minutes (not real learning!)
```

### After Phase 2:
```
9:00 AM: Review "el fracaso" → Mark "Easy" → Mastery 0 → 15 ✅
9:05 AM: Review "el fracaso" → Mark "Easy" → Mastery 15 → 15 ❌ (Wait 4 hours)
                                              Health 100 → 100 ✅ (Still improves)
1:05 PM: Review "el fracaso" → Mark "Easy" → Mastery 15 → 30 ✅ (4+ hours passed)

Result: True spaced repetition enforced!
```

---

**Ready to implement!** 🚀

This is simpler than Phase 1 since we're just adding time gate logic to existing mastery calculations.
