# VOQUAB ALGORITHM BIBLE v1.0
## **The Complete Learning System Specification**

**Document Purpose:** This is the authoritative reference for Voquab's learning algorithm. Every implementation decision must align with the principles and specifications outlined in this document.

**Last Updated:** November 9, 2025  
**Status:** MASTER REFERENCE - Production Specification

---

# TABLE OF CONTENTS

1. [Philosophy & Core Principles](#philosophy--core-principles)
2. [The Dual-Track System](#the-dual-track-system)
3. [Mastery System](#mastery-system)
4. [Exposure System (Word Health)](#exposure-system-word-health)
5. [Priority Scoring Algorithm](#priority-scoring-algorithm)
6. [Card Selection for Decks](#card-selection-for-decks)
7. [Daily Package System](#daily-package-system)
8. [Waypoint System](#waypoint-system)
9. [Chapter Unlocking Algorithm](#chapter-unlocking-algorithm)
10. [Gamification & Motivation](#gamification--motivation)
11. [User Experience Flow](#user-experience-flow)
12. [Database Schema](#database-schema)
13. [Implementation Formulas](#implementation-formulas)
14. [Edge Cases & Special Scenarios](#edge-cases--special-scenarios)

---

# PHILOSOPHY & CORE PRINCIPLES

## The Voquab Learning Philosophy

**Core Belief:** Language learning is most effective when vocabulary is encountered within meaningful literary context, with consistent exposure over time, balanced between quality (deep mastery) and quantity (repeated practice).

### Key Principles

1. **Contextual Learning Over Rote Memorization**
   - Every word is learned through actual sentences from "El Principito"
   - Context aids retention and makes learning more engaging
   - Literary immersion creates emotional connections to vocabulary

2. **Dual Progression: Quality + Quantity**
   - **Mastery** measures how well you KNOW a word (0-100 scale, 10 levels)
   - **Exposure** measures how much you've PRACTICED a word (health/decay system)
   - Both are required for true fluency

3. **Time-Gated Mastery (Anti-Gaming)**
   - True mastery requires time between reviews
   - Rapid-fire reviewing doesn't equal learning
   - Each mastery level has a minimum time gate to prevent cramming

4. **Word Health as Urgency Metric**
   - Words "decay" over time if not reviewed
   - Low health = urgent need for review
   - Creates natural prioritization of struggling words

5. **Frequency-Weighted Importance**
   - Words appearing 50 times in the book are more important than words appearing 2 times
   - High-frequency words get priority in selection
   - Learn the most useful vocabulary first

6. **Chapter-Sequential Progression**
   - Complete one chapter before moving to the next
   - Requires 80% word encounter rate + mastery/exposure thresholds
   - Prevents skipping foundational vocabulary

7. **User Agency with Guardrails**
   - Users choose their daily commitment (50/100/150/250 words)
   - Users can focus on specific chapters
   - System guides but doesn't force

8. **Gamification Serves Learning**
   - Badges, streaks, and XP motivate consistent practice
   - But pedagogically sound principles are never sacrificed for engagement
   - Progress is measured by real learning, not just activity

---

# THE DUAL-TRACK SYSTEM

Voquab tracks two parallel but interconnected progression systems for every word:

## Track 1: MASTERY (Quality - "How Well You Know It")

- **Scale:** 0-100 points
- **10 Levels:** Each level represents a stage of learning (New → Perfect)
- **Time-Gated:** Each level requires minimum time between correct reviews
- **Purpose:** Measures deep understanding and long-term retention
- **Affects:** Spaced repetition intervals, chapter unlocking (mastery path)

## Track 2: EXPOSURE (Quantity - "How Much You've Practiced")

- **Tracked Via:** Word health (0-100), total reviews count
- **Decay System:** Health decreases daily based on mastery level
- **Purpose:** Ensures consistent practice, rewards effort even when struggling
- **Affects:** Priority in card selection, chapter unlocking (exposure path)

### Why Both Matter

**Scenario:** User reviews "jamás" (never)

- **High Mastery, Low Exposure:** 
  - User gets it right quickly (80 mastery)
  - But only reviewed it 3 times total
  - Might forget without more practice
  
- **High Exposure, Low Mastery:**
  - User has reviewed it 50 times
  - But still struggling (25 mastery)
  - Needs different approach, but effort counts

- **Ideal State:**
  - High mastery (70+) AND high exposure (30+ reviews)
  - Deep knowledge + reinforced through practice
  - This is true fluency

**Chapter Unlocking Requires EITHER:**
- 40 average mastery (quality) OR
- 50 total reviews (quantity) OR  
- 30 mastery + 30 reviews (balanced)

This rewards both fast learners AND persistent learners.

---

# MASTERY SYSTEM

## The 10 Mastery Levels

| Level | Score Range | Label | Time Gate | Next Interval | Description |
|-------|-------------|-------|-----------|---------------|-------------|
| **0** | 0-9 | New | None | Immediate | Brand new word, never seen correctly |
| **1** | 10-19 | Introduced | 4 hours | 12 hours | Just met, starting to recognize |
| **2** | 20-29 | Recognizing | 12 hours | 1 day | Beginning to recall with effort |
| **3** | 30-39 | Learning | 1 day | 3 days | Actively learning, needs practice |
| **4** | 40-49 | Familiar | 3 days | 7 days | Getting comfortable, recognition solid |
| **5** | 50-59 | Known | 7 days | 14 days | Solidly known, can recall reliably |
| **6** | 60-69 | Strong | 14 days | 30 days | Strong retention, minimal effort |
| **7** | 70-79 | Mastered | 30 days | 60 days | True mastery, automatic recall |
| **8** | 80-89 | Expert | 60 days | 120 days | Expert level, effortless |
| **9** | 90-94 | Native | 120 days | 180 days | Near-native fluency |
| **10** | 95-100 | Perfect | 180 days | 365 days | Perfect mastery, permanent |

### Mastery Point Changes

When user reviews a word:

| User Response | Mastery Change | Time Gate Required? | Requeue in Session? |
|--------------|----------------|---------------------|---------------------|
| **Don't Know** | -15 points | NO (always applies) | YES (reappear 3-5 cards later) |
| **Hard** | Checkpoint regression* | YES | NO |
| **Medium** | +0 points | YES | NO |
| **Easy** | +10 points | YES | NO |

*Hard checkpoint regression:
- Level 5-10 (50-100 mastery) → Drop to Level 3 (mastery = 30)
- Level 3-4 (30-49 mastery) → Drop to Level 2 (mastery = 20)
- Level 1-2 (10-29 mastery) → Drop to Level 0 (mastery = 0)

### Time Gate Logic

**The Rule:** You cannot gain mastery points (Hard/Medium/Easy) unless enough time has passed since your last CORRECT review.

```
Time since last correct review >= Time gate for current level
```

**Example:**

- Word "el fracaso" is at 32 mastery (Level 3 - Learning)
- Level 3 time gate = 1 day (24 hours)
- Last correct review: Yesterday at 2:00 PM
- Current time: Today at 9:00 AM (19 hours later)

**Result:** Time gate NOT met (need 24 hours)

- User marks "Medium" (normally +6 points)
- **Mastery change: 0 points** (time gate not met)
- **Health boost: +60** (health still improves!)
- **Message shown:** "Need to wait 5 more hours for mastery credit"

**Why This Matters:** Prevents gaming the system by reviewing rapidly. True mastery requires spaced repetition.

### Special Cases

**1. Don't Know Always Works**
- "Don't Know" ALWAYS applies (-5 mastery)
- No time gate check
- Recognizes that forgetting happens
- Word is re-queued in same session

**2. Mastery Cannot Go Below 0 or Above 100**
- Minimum: 0 (completely new)
- Maximum: 100 (perfect mastery)

**3. Level-Up Celebrations**
- When mastery crosses 10-point threshold (e.g., 39 → 41)
- User levels up (Level 3 → Level 4)
- Show celebration animation
- Display: "Level Up! Word is now Familiar (Level 4)"

**4. First Correct Review**
- If `last_correct_review_at` is NULL (never correct)
- Time gate is automatically met
- First correct review establishes baseline

### Mastery Affects

**1. Spaced Repetition Intervals**

Intervals are determined by mastery level and difficulty response:

**Easy Response - Optimal SRS (Mastery-Based):**
Based on current mastery level AFTER the +10 increase:
- Level 0 (0-9): 1 day
- Level 1 (10-19): 2 days
- Level 2 (20-29): 4 days
- Level 3 (30-39): 7 days
- Level 4 (40-49): 14 days
- Level 5 (50-59): 30 days
- Level 6 (60-69): 60 days
- Level 7 (70-79): 90 days
- Level 8 (80-89): 120 days
- Level 9-10 (90-100): 180 days

**Medium Response - Reinforcement Intervals (Mastery-Based):**
Shorter intervals than Easy to reinforce without mastery gain:
- Mastery 0-19: 1 day
- Mastery 20-39: 1-2 days (randomized)
- Mastery 40-59: 2-4 days (randomized)
- Mastery 60-79: 5-7 days (randomized)
- Mastery 80-100: 7-10 days (randomized)

**Hard Response - Practice Interval (Fixed):**
- Always 1 day regardless of mastery level
- Forces frequent practice after struggle
- Combined with checkpoint regression creates effective remediation

**Don't Know - Reset (Fixed):**
- Re-queued immediately in current session
- After session: uses Medium intervals based on new (reduced) mastery level

**2. Chapter Unlocking**
- Average mastery across chapter words
- Need 40 avg mastery to unlock via quality path

**3. Health Decay Rate**  
- Higher mastery = slower decay
- Level 0-1: Decays fast (20-25 points/day)
- Level 9-10: Decays slow (0.5-0.7 points/day)

**4. Priority Scoring**
- Words ready for mastery gain (time gate met) get priority boost
- Encourages level-ups

### Philosophy of Difficulty Ratings

**The Four Responses Represent Different Learning States:**

**Easy** = "I knew this instantly"
- Mastery: +10 (confident progression)
- Interval: Optimal SRS based on mastery level
- Philosophy: Reward strong recall with proper spaced repetition

**Medium** = "I got it right, but it took effort"
- Mastery: +0 (maintenance, no inflation)
- Interval: Shorter than Easy (reinforce without mastery gain)
- Philosophy: Acknowledge adequate recall while maintaining realistic mastery

**Hard** = "I struggled and barely got it"
- Mastery: Checkpoint regression (significant setback)
- Interval: 1 day (immediate practice)
- Philosophy: Honest assessment that mastery wasn't as high as thought

**Don't Know** = "I failed to recall"
- Mastery: -15 (severe penalty)
- Immediate: Must retry in current session
- Philosophy: Cannot proceed without demonstrating recall

This system prioritizes **honest self-assessment** over gaming. Medium acknowledges "I got it right" without inflating mastery unrealistically. Hard acknowledges genuine struggle with appropriate consequences.

---

# EXPOSURE SYSTEM (WORD HEALTH)

## Concept: Words Need Regular "Power-Ups"

Think of each word as having a **health bar** that depletes over time. Words with low health need urgent attention (like a plant that needs watering).

### Health Scale: 0-100

| Health Range | Status | Color | Priority |
|-------------|--------|-------|----------|
| 0-19 | **CRITICAL** | Red ⚠️ | HIGHEST |
| 20-39 | **LOW** | Orange | HIGH |
| 40-59 | **MEDIUM** | Yellow | MEDIUM |
| 60-79 | **GOOD** | Light Green | LOW |
| 80-100 | **EXCELLENT** | Bright Green | LOWEST |

### Health Decay Rates (Points per Day)

Decay is tied to mastery level:

| Mastery Level | Decay Rate (per day) | Days Until Critical |
|--------------|---------------------|---------------------|
| **0** (New) | 25 | 4 days |
| **1** (Introduced) | 20 | 5 days |
| **2** (Recognizing) | 12 | 8 days |
| **3** (Learning) | 8 | 12 days |
| **4** (Familiar) | 5 | 16 days |
| **5** (Known) | 3 | 26 days |
| **6** (Strong) | 2 | 40 days |
| **7** (Mastered) | 1.5 | 53 days |
| **8** (Expert) | 1 | 80 days |
| **9** (Native) | 0.7 | 114 days |
| **10** (Perfect) | 0.5 | 160 days |

**Formula:**
```
current_health = stored_health - (days_since_last_review × decay_rate)
current_health = max(0, current_health)
```

### Health Restoration (Boosts)

When user reviews a word, health is restored:

| User Response | Health Boost |
|--------------|-------------|
| **Don't Know** | +10 |
| **Hard** | +30 |
| **Medium** | +60 |
| **Easy** | +100 (full restoration) |

**Formula:**
```
new_health = min(100, current_health + health_boost)
```

### Why Health Matters

**1. Creates Urgency**
- Words with critical health (<20) MUST be reviewed soon
- User sees red warning: "42 words need urgent attention!"
- Motivates daily practice to keep words "alive"

**2. Prioritizes Selection**
- Critical health words appear first in review sessions
- Prevents words from being forgotten
- System is self-balancing (struggling words get more attention)

**3. Tracks Exposure for Chapter Unlocking**
- `total_reviews` counter = every review (even Don't Know)
- Need 50 total reviews to unlock chapter via exposure path
- Rewards consistent practice even if struggling

**4. Identifies "Leeches"**
- Words that keep falling to critical health repeatedly
- Needs intervention (better mnemonic, context, etc.)
- Tracked via `failed_in_last_3_sessions` flag

### Example: Word Lifecycle via Health

**Day 1:** New word "el fracaso" created
- Health: 100 (fresh)
- Mastery: 0 (Level 0)

**Day 2:** Not reviewed
- Health: 75 (100 - 25)
- Mastery: 0

**Day 3:** Not reviewed  
- Health: 50 (75 - 25)
- Mastery: 0

**Day 4:** Not reviewed
- Health: 25 (50 - 25)
- Mastery: 0

**Day 5:** CRITICAL! Appears in review
- Health: 0 (25 - 25)
- User marks "Medium" → Health restored to 60
- Mastery: 0 → 6 (gained points)

**Day 6:** Not reviewed
- Health: 48 (60 - 12, now Level 0 decay rate)
- Mastery: 6

This cycle continues, with health creating natural review schedules.

---

# PRIORITY SCORING ALGORITHM

## Purpose

Every word gets a **priority score** (0-200+) that determines selection order for review decks. Higher score = more likely to appear.

## The Priority Formula

```
PRIORITY SCORE = 
  (Health Urgency × 35) +
  (Frequency in Book × 30) +
  (Chapter Position × 15) +
  (Mastery Readiness × 10) +
  (Chapter Focus Bonus × 10)
  
  × Critical Health Multiplier (1.5 if health < 20)
  × Leech Multiplier (1.3 if failed recently)
  × New Word Penalty (0.8 if never reviewed)
```

### Component Breakdown

#### 1. Health Urgency (0-50 points) - Weight: 35%

**Formula:**
```
health_score = (100 - current_health) × 0.5
```

**Logic:** Lower health = higher urgency = higher score

**Examples:**
- Health 0 (critical): 50 points
- Health 20 (low): 40 points
- Health 50 (medium): 25 points
- Health 80 (good): 10 points
- Health 100 (excellent): 0 points

**Why:** Ensures struggling words get attention before they're forgotten.

---

#### 2. Frequency in Book (0-30 points) - Weight: 30%

**Formula:**
```
frequency_score = min(30, times_in_book × 0.6)
```

**Logic:** Words appearing more often in the book are more important

**Examples:**
- Appears 2 times: 1.2 points
- Appears 10 times: 6 points
- Appears 20 times: 12 points
- Appears 50+ times: 30 points (capped)

**Why:** Learn the most useful, high-frequency vocabulary first. "el" (the) appearing 100 times is more important than "boa" appearing twice.

---

#### 3. Chapter Position (0-15 points) - Weight: 15%

**Formula:**
```
if chapter_number <= 3: chapter_score = 15
else if chapter_number <= 5: chapter_score = 10
else: chapter_score = 5
```

**Logic:** Earlier chapters = foundational vocabulary = higher priority

**Examples:**
- Chapter 1-3: 15 points
- Chapter 4-5: 10 points
- Chapter 6-10: 5 points

**Why:** Master foundation before advancing. Early words are typically more common.

---

#### 4. Mastery Readiness (0-10 points) - Weight: 10%

**Formula:**
```
if time_gate_met AND current_level < 10:
  mastery_ready_score = 10
else:
  mastery_ready_score = 0
```

**Logic:** If user CAN gain mastery points right now, prioritize it

**Why:** Encourages level-ups, creates achievement moments, rewards progress.

---

#### 5. Chapter Focus Bonus (0-10 points) - Weight: 10%

**Formula:**
```
if chapter_focus_mode AND word.chapter_id == user.current_chapter:
  focus_bonus = 10
else:
  focus_bonus = 0
```

**Logic:** When user enables "Chapter Focus Mode", current chapter words get boosted

**Why:** Allows users to deep-dive into specific chapters to unlock faster.

---

### Multipliers (Applied AFTER Base Score)

#### Critical Health Multiplier (×1.5)

**Formula:**
```
if current_health < 20:
  total_score × 1.5
```

**Why:** Critical words get 50% priority boost. These need IMMEDIATE attention.

---

#### Leech Multiplier (×1.3)

**Formula:**
```
if failed_in_last_3_sessions:
  total_score × 1.3
```

**Logic:** Words marked "Don't Know" in recent sessions (within last 3) get boosted

**Why:** Identifies struggling words that need intervention. Don't let them slip through.

---

#### New Word Penalty (×0.8)

**Formula:**
```
if total_reviews == 0:
  total_score × 0.8
```

**Logic:** Brand new words are slightly deprioritized

**Why:** Review > Learning new words. Solidify existing knowledge before expanding.

---

## Priority Score Examples

### Example 1: Critical, High-Frequency Word
```
Word: "de" (of)
- Mastery: 15 (Level 1)
- Health: 10 (CRITICAL)
- Times in book: 80
- Chapter: 1
- Time gate met: Yes

Calculation:
  Health Urgency: (100-10) × 0.5 = 45
  Frequency: min(30, 80 × 0.6) = 30
  Chapter: 15 (Chapter 1)
  Mastery Ready: 10 (time gate met)
  Focus Bonus: 0 (not in focus mode)
  
  Base Score: 45+30+15+10+0 = 100
  
  Multipliers:
    Critical (health<20): ×1.5 = 150
  
  FINAL SCORE: 150 (VERY HIGH PRIORITY)
```

### Example 2: Mastery-Ready Mid-Level Word
```
Word: "jamás" (never)
- Mastery: 35 (Level 3)
- Health: 60 (MEDIUM)
- Times in book: 12
- Chapter: 3
- Time gate met: Yes

Calculation:
  Health: (100-60) × 0.5 = 20
  Frequency: 12 × 0.6 = 7.2
  Chapter: 15 (Chapter 3)
  Mastery Ready: 10
  Focus Bonus: 10 (in Chapter 3 focus mode)
  
  Base Score: 20+7.2+15+10+10 = 62.2
  
  Multipliers: None
  
  FINAL SCORE: 62 (MEDIUM PRIORITY)
```

### Example 3: New Rare Word
```
Word: "asteroide" (asteroid)
- Mastery: 0 (never reviewed)
- Health: 100 (fresh)
- Times in book: 3
- Chapter: 6
- Time gate met: N/A (never reviewed)

Calculation:
  Health: (100-100) × 0.5 = 0
  Frequency: 3 × 0.6 = 1.8
  Chapter: 5 (Chapter 6)
  Mastery Ready: 0
  Focus Bonus: 0
  
  Base Score: 0+1.8+5+0+0 = 6.8
  
  Multipliers:
    New Word: ×0.8 = 5.4
  
  FINAL SCORE: 5 (LOW PRIORITY)
```

---

## Priority Sorting Logic

**For card selection:**

1. Calculate priority score for ALL user words
2. Sort by priority score (highest to lowest)
3. Select top N cards based on deck size
4. Apply category balancing (see Card Selection section)
5. Shuffle selected cards to avoid predictability

**Result:** Users see the most important words first, balanced across categories.

---

# CARD SELECTION FOR DECKS

## Deck Building Philosophy

Don't just select top-priority words blindly. Instead, create a **balanced mix** that serves multiple learning goals:

1. **Fix problems** (critical health words)
2. **Build mastery** (time-gated level-ups)
3. **Increase exposure** (consistent practice)
4. **Learn new words** (vocabulary expansion)

## Target Mix Percentages

For a 25-card deck (adjusts proportionally for other sizes):

| Category | Target % | Cards (25) | Purpose |
|----------|---------|-----------|---------|
| **Critical Health** | 30% | 7-8 cards | Save dying words |
| **Mastery Ready** | 25% | 6-7 cards | Earn level-ups |
| **Exposure Building** | 25% | 6-7 cards | Practice makes permanent |
| **New Words** | 20% | 5 cards | Expand vocabulary |

**Maximum New Words Per Deck:** 5 (even in large decks)
- Prevents overwhelm
- Ensures review > learning
- New words sprinkled in, not dumped

## Card Selection Algorithm

### Step 1: Calculate Priority Scores
```
For each word in user's vocabulary:
  Calculate priority_score (see Priority Scoring section)
  
Store all words with their scores
```

### Step 2: Categorize Words
```
critical_words = words where current_health < 20
mastery_ready_words = words where time_gate_met AND current_health >= 20
exposure_words = words where total_reviews < 10 AND current_health >= 20
new_words = words where total_reviews == 0

Sort each category by priority_score (highest first)
```

### Step 3: Fill Deck by Category
```
deck = []
targets = {
  critical: round(deck_size × 0.30),
  mastery: round(deck_size × 0.25),
  exposure: round(deck_size × 0.25),
  new: min(5, round(deck_size × 0.20))
}

For each category:
  Add top N words from that category to deck
  Skip if already added
  
If deck not full:
  Fill remaining slots with highest-priority remaining words
```

### Step 4: Shuffle
```
Shuffle deck to avoid predictability
(User shouldn't know "first 7 cards are always critical")
```

### Step 5: Return Deck
```
Return deck + statistics:
  - Total cards
  - Breakdown by category
  - Average priority score
  - Estimated difficulty
```

## Deck Size Variations

### Small Deck (15 cards)
```
Critical: 5 (33%)
Mastery: 4 (27%)
Exposure: 4 (27%)
New: 2 (13%)
```

### Standard Deck (25 cards)
```
Critical: 8 (32%)
Mastery: 6 (24%)
Exposure: 6 (24%)
New: 5 (20%)
```

### Large Deck (30 cards)
```
Critical: 9 (30%)
Mastery: 8 (27%)
Exposure: 8 (27%)
New: 5 (17%) [capped at 5]
```

## Special Deck Modes

### 1. Chapter Focus Mode
When enabled:
- 80% of deck from current chapter
- 20% from other chapters (only critical health)
- Accelerates chapter completion

**Selection:**
```
chapter_words = words where chapter_id == user.current_chapter
other_words = words where chapter_id != user.current_chapter AND health < 20

Fill 80% of deck with chapter_words (by priority)
Fill 20% with other_words (critical only)
```

### 2. Freestyle "Easy" Mode (Future)
- Only words with mastery 40+
- Quick review session
- Confidence building

### 3. Mastery Sprint Mode (Future)
- Only words where time_gate_met
- Focus on leveling up
- Achievement hunting

---

# DAILY PACKAGE SYSTEM

## Concept: Choose Your Daily Commitment

Users don't just "review cards." They select a **daily package** that defines their learning journey for the day.

## Package Levels

| Package | Words/Day | Estimated Time | Decks | Badge | Description |
|---------|-----------|---------------|-------|-------|-------------|
| **Foundation** | 50 | 15-20 min | 3-4 × 15 | 🥉 Consistent | Busy days, maintain progress |
| **Standard** | 100 | 30-40 min | 5-7 × 15-20 | 🥈 Dedicated | Balanced learning |
| **Immersion** | 150 | 45-60 min | 7-10 × 15-20 | 🥇 Champion | Rapid advancement |
| **Mastery** | 250 | 75-100 min | 12-17 × 15-20 | 💎 Elite | Elite learner |

**User Selects Package:**
- Each morning/login
- Based on available time
- Based on ambition
- Can adjust mid-day if needed

## Package Composition

Each package is broken into **waypoints** (mini-decks) with themes:

### Foundation 50 Package (4 waypoints)
```
Waypoint 1: Critical Rescue (15 words)
  - All critical health words
  - "Save your struggling words!"
  
Waypoint 2: Chapter Progress (20 words)
  - Current chapter words
  - "Build toward unlock!"
  
Waypoint 3: Quick Wins (10 words)
  - Mastery-ready words
  - "Level up rewards!"
  
Waypoint 4: New Horizons (5 words)
  - New words
  - "Expand vocabulary!"
```

### Standard 100 Package (6 waypoints)
```
Waypoint 1: Critical Triage (20 words)
Waypoint 2: Chapter Core (25 words)
Waypoint 3: High-Frequency Focus (20 words)
Waypoint 4: Mastery Zone (15 words)
Waypoint 5: Reinforcement (15 words)
Waypoint 6: New Territory (5 words)
```

### Immersion 150 Package (7 waypoints)
```
Waypoint 1: Critical Rescue (20 words)
Waypoint 2: Chapter Core (25 words)
Waypoint 3: Level-Up Zone (20 words)
Waypoint 4: New Territory (15 words)
Waypoint 5: High-Frequency Review (25 words)
Waypoint 6: Reinforcement (20 words)
Waypoint 7: Final Push (25 words)
```

### Mastery 250 Package (10-12 waypoints)
```
Similar structure, more waypoints
Heavy emphasis on chapter completion
```

## Package Selection Screen

When user logs in:
```
┌─────────────────────────────────────────────────────────┐
│  🌅 Good Morning, Peter!                                │
│  Choose Your Learning Journey Today                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📘 FOUNDATION (50 words)                               │
│     ⏱️  15-20 minutes                                   │
│     🎴 4 waypoint decks                                 │
│     🏅 Badge: Consistent Learner                        │
│     Perfect for: Busy days, maintenance                │
│     [Select Foundation →]                               │
│                                                         │
│  📗 STANDARD (100 words) ⭐ RECOMMENDED                 │
│     ⏱️  30-40 minutes                                   │
│     🎴 6 waypoint decks                                 │
│     🏅 Badge: Dedicated Student                         │
│     Perfect for: Balanced progress                     │
│     [Select Standard →]                                 │
│                                                         │
│  📕 IMMERSION (150 words)                               │
│     ⏱️  45-60 minutes                                   │
│     🎴 7 waypoint decks                                 │
│     🏅 Badge: Language Champion                         │
│     Perfect for: Rapid advancement                     │
│     [Select Immersion →]                                │
│                                                         │
│  📚 MASTERY (250 words)                                 │
│     ⏱️  75-100 minutes                                  │
│     🎴 12 waypoint decks                                │
│     🏅 Badge: Elite Polyglot                            │
│     Perfect for: Maximum progress                      │
│     [Select Mastery →]                                  │
│                                                         │
│  Your Current Streak: 🔥 12 days                       │
│  Yesterday: 150 words (Immersion)                      │
└─────────────────────────────────────────────────────────┘
```

## Package Lifecycle

### 1. Package Creation
```
User selects: Immersion (150 words)

System:
  1. Calculates priority scores for all words
  2. Selects 150 highest-priority words (with category balancing)
  3. Divides into 7 waypoints
  4. Assigns theme to each waypoint
  5. Creates package record in database
  6. Shows learning trail visualization
```

### 2. Package Progress
```
User completes waypoints one by one:
  ✅ Waypoint 1: Critical Rescue (20/20) +20 XP
  ✅ Waypoint 2: Chapter Core (25/25) +25 XP
  🔵 Waypoint 3: Level-Up Zone (12/20) IN PROGRESS
  ⚪ Waypoint 4-7: Not started

Progress: 57/150 words (38%)
Time invested: 22 minutes
Estimated remaining: 35 minutes
```

### 3. Package Completion
```
All waypoints done!

Results:
  ✅ 150 words reviewed
  ✅ +150 XP earned
  ✅ 7/7 waypoints completed
  ✅ 52 minutes total time
  ✅ Immersion badge earned!
  ✅ Streak maintained (13 days)
  
  Performance:
    Don't Know: 12 (8%)
    Hard: 23 (15%)
    Medium: 58 (39%)
    Easy: 57 (38%)
    
  Chapter Progress: 78% → 85% complete!
```

### 4. Pause & Resume
```
Life happens! User needs to leave after Waypoint 3.

Options:
  1. Resume Later Today
     - Package stays active for 24 hours
     - Progress saved
     - Continue from Waypoint 4
     
  2. Switch to Smaller Package
     - Mark current package incomplete
     - Start Foundation 50 instead
     - Keep XP already earned
     
  3. Mark Complete (Partial Credit)
     - Count 57 words as today's review
     - Maintains streak (partial completion allowed)
     - Package marked incomplete
```

## 24-Hour Timer

**Rule:** Package must be completed within 24 hours of creation.

**After 24 Hours:**
- Package is "expired"
- Grayed out in history
- Can view but not resume
- Words are released back to pool
- No penalty to streak if user did at least Foundation 50 worth

**Why:** Creates urgency, prevents stale packages, ensures fresh prioritization each day.

---

# WAYPOINT SYSTEM

## Concept: Break Journey into Chunks

A 150-word package can feel overwhelming. Waypoints make it manageable by creating sub-goals.

## Waypoint Structure

Each waypoint has:
- **Theme:** What this waypoint focuses on (Critical/Chapter/Level-Up/New)
- **Word Count:** 10-25 words typically
- **Cards:** The actual vocabulary words selected
- **Description:** User-facing explanation of purpose
- **XP Reward:** Points earned on completion

## Dynamic Waypoint Generation

**Algorithm:**

```
function generateWaypoints(package_words, package_size) {
  // Categorize words
  critical = words.filter(w => w.health < 20)
  chapter_focus = words.filter(w => w.chapter == current_chapter)
  mastery_ready = words.filter(w => w.time_gate_met)
  new_words = words.filter(w => w.total_reviews == 0)
  high_freq = words.filter(w => w.times_in_book >= 15)
  
  waypoints = []
  
  // Waypoint 1: Always start with Critical (if any exist)
  if (critical.length >= 10) {
    waypoints.push({
      theme: "Critical Rescue",
      description: "Save your struggling words!",
      words: critical.slice(0, min(25, critical.length)),
      icon: "⚡",
      color: "red"
    })
  }
  
  // Waypoint 2: Chapter Focus (if in chapter focus mode)
  if (chapter_focus_mode && chapter_focus.length >= 10) {
    waypoints.push({
      theme: "Chapter Core",
      description: "Essential vocabulary for your current chapter",
      words: chapter_focus.slice(0, 25),
      icon: "📚",
      color: "blue"
    })
  }
  
  // Waypoint 3: Mastery-Ready Words
  if (mastery_ready.length >= 10) {
    waypoints.push({
      theme: "Level-Up Zone",
      description: "Earn mastery gains!",
      words: mastery_ready.slice(0, 20),
      icon: "⭐",
      color: "yellow"
    })
  }
  
  // Waypoint N-1: High-Frequency Review
  if (high_freq.length >= 10) {
    waypoints.push({
      theme: "High-Frequency Review",
      description: "Master the most common words",
      words: high_freq.slice(0, 25),
      icon: "📖",
      color: "green"
    })
  }
  
  // Waypoint N: New Words (always last)
  if (new_words.length >= 5) {
    waypoints.push({
      theme: "New Territory",
      description: "Expand your vocabulary!",
      words: new_words.slice(0, min(15, new_words.length)),
      icon: "🆕",
      color: "purple"
    })
  }
  
  // Fill remaining words into "Reinforcement" waypoints
  remaining = words not yet assigned
  while (remaining.length > 0) {
    waypoints.push({
      theme: "Reinforcement",
      description: "Strengthen your foundation",
      words: remaining.slice(0, 20),
      icon: "🔄",
      color: "gray"
    })
    remaining = remaining.slice(20)
  }
  
  return waypoints
}
```

## Waypoint Visualization (Learning Trail)

```
Your Journey Today: 150 words across 7 waypoints

┌─────────────────────────────────────────────────────────┐
│                                                         │
│  START 🚩                                               │
│    ↓                                                    │
│  ⚡ WAYPOINT 1: Critical Rescue (20 words)             │
│    "Save your struggling words"                        │
│    ✅ COMPLETED • 14 min • +20 XP                      │
│    ↓                                                    │
│  📚 WAYPOINT 2: Chapter Core (25 words)                │
│    "Essential Chapter 3 vocabulary"                    │
│    ✅ COMPLETED • 18 min • +25 XP                      │
│    ↓                                                    │
│  ⭐ WAYPOINT 3: Level-Up Zone (20 words)               │
│    "Earn mastery gains"                                │
│    🔵 IN PROGRESS (12/20)                              │
│    💬 "Almost there! 8 words to go"                    │
│    ↓                                                    │
│  🆕 WAYPOINT 4: New Territory (15 words)               │
│    "Expand your vocabulary"                            │
│    ⚪ NOT STARTED                                       │
│    ↓                                                    │
│  📖 WAYPOINT 5: High-Frequency (25 words)              │
│    "Master common words"                               │
│    ⚪ NOT STARTED                                       │
│    ↓                                                    │
│  🔄 WAYPOINT 6: Reinforcement (20 words)               │
│    "Strengthen foundation"                             │
│    ⚪ NOT STARTED                                       │
│    ↓                                                    │
│  🔄 WAYPOINT 7: Final Push (25 words)                  │
│    "Complete your journey!"                            │
│    ⚪ NOT STARTED                                       │
│    ↓                                                    │
│  FINISH 🎯                                              │
│                                                         │
│  Overall Progress: 57/150 words (38%)                  │
│  Time Invested: 32 minutes                             │
│  Estimated Remaining: ~35 minutes                      │
│                                                         │
│  [Continue to Waypoint 3 →]  [Take a Break]           │
└─────────────────────────────────────────────────────────┘
```

## Waypoint Completion

When user finishes all cards in a waypoint:

```
🎉 Waypoint Complete!

✅ Critical Rescue
   20/20 words reviewed
   +20 XP earned
   
Performance:
  🔴 Don't Know: 5 (25%)
  🟠 Hard: 8 (40%)
  🟡 Medium: 4 (20%)
  🟢 Easy: 3 (15%)
  
Health Restored:
  12 words moved from critical to low
  
[Next: Chapter Core (25 words) →]
```

---

# CHAPTER UNLOCKING ALGORITHM

## Philosophy: Dual-Path Unlocking

Users can unlock the next chapter through EITHER quality (mastery) OR quantity (exposure). This rewards both types of learners:

- **Fast learners:** Master words quickly → unlock via mastery
- **Persistent learners:** Practice consistently → unlock via exposure
- **Balanced learners:** Both mastery + exposure → unlock faster

## Unlock Requirements

**Baseline (REQUIRED):**
- Must encounter **80% of current chapter's unique words**
- Ensures user has seen most vocabulary before advancing

**PLUS one of three paths:**

### Path A: Mastery (Quality)
- **40 average mastery** across chapter words
- Rewards deep understanding

### Path B: Exposure (Quantity)
- **50 total reviews** across chapter words
- Rewards consistent practice

### Path C: Balanced
- **30 average mastery** AND **30 total reviews**
- Balanced approach

## Calculation

```
function calculateChapterUnlock(userId, chapterId) {
  // Get all vocabulary from this chapter
  chapter_words = getChapterVocabulary(chapterId)
  total_words = chapter_words.length
  
  // Get user progress for these words
  user_progress = getUserVocabularyProgress(userId, chapter_words)
  
  // Calculate metrics
  words_encountered = user_progress.length
  encounter_rate = words_encountered / total_words
  
  if (words_encountered == 0) {
    return {
      can_unlock: false,
      encounter_progress: 0,
      message: "Start reviewing Chapter X words!"
    }
  }
  
  total_reviews = sum(user_progress.total_reviews)
  avg_mastery = average(user_progress.mastery_level)
  
  // Check baseline requirement
  meets_baseline = (encounter_rate >= 0.80)
  
  // Check paths
  path_a_met = (avg_mastery >= 40)
  path_b_met = (total_reviews >= 50)
  path_c_met = (avg_mastery >= 30 AND total_reviews >= 30)
  
  can_unlock = meets_baseline AND (path_a_met OR path_b_met OR path_c_met)
  
  // Calculate unlock progress (0-100%)
  if (!meets_baseline) {
    // Baseline progress (0-50% of unlock)
    unlock_progress = encounter_rate * 50
  } else {
    // Path progress (50-100% of unlock)
    path_a_progress = (avg_mastery / 40) * 100
    path_b_progress = (total_reviews / 50) * 100
    path_c_progress = ((avg_mastery/30) * 50) + ((total_reviews/30) * 50)
    
    unlock_progress = max(path_a_progress, path_b_progress, path_c_progress)
    unlock_progress = min(100, unlock_progress)
  }
  
  return {
    can_unlock: can_unlock,
    meets_baseline: meets_baseline,
    encounter_rate: encounter_rate,
    words_encountered: words_encountered,
    total_words: total_words,
    avg_mastery: avg_mastery,
    total_reviews: total_reviews,
    unlock_progress: unlock_progress,
    paths: {
      mastery: { met: path_a_met, progress: (avg_mastery/40)*100 },
      exposure: { met: path_b_met, progress: (total_reviews/50)*100 },
      balanced: { met: path_c_met, progress: path_c_progress }
    }
  }
}
```

## Auto-Unlock

After each review session:

```
function afterSessionComplete(userId) {
  // Update all chapter progress
  chapters = getUserChapters(userId)
  
  for each chapter:
    unlock_status = calculateChapterUnlock(userId, chapter.id)
    
    // Save progress
    saveChapterProgress(userId, chapter.id, unlock_status)
    
    // Auto-unlock if requirements met
    if (unlock_status.can_unlock AND !chapter.is_unlocked) {
      unlockChapter(userId, chapter.id)
      showCelebration(chapter)
      awardBadge(userId, "chapter_" + chapter.number + "_complete")
    }
}
```

## Chapter Progress Display

On Book page:

```
┌─────────────────────────────────────────────────────────┐
│  ✅ Chapter 1: Capitulo 1                               │
│     109/212 words encountered (51%)                     │
│     [Read Chapter] [Study Words]                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🔒 Chapter 2: Capitulo 2                               │
│     LOCKED • 72% toward unlock                          │
│                                                         │
│  Progress:                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 72%            │
│                                                         │
│  Requirements (any one):                                │
│  📖 Encounter Rate: 232/289 (80%) ✅                    │
│  ⭐ Avg Mastery: 32/40 (80%) 🔸                         │
│  📚 Total Reviews: 135/50 (270%) ✅                     │
│  ⚖️  Balanced: 32/30 + 135/30 ✅                        │
│                                                         │
│  💡 You've met the exposure requirement!               │
│     Just encounter 57 more words to unlock Chapter 2!  │
│                                                         │
│  [Study to Unlock →]                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  🔒 Chapter 3: Capitulo 3                               │
│     Complete Chapter 2 to unlock                        │
└─────────────────────────────────────────────────────────┘
```

## Unlock Celebration

When chapter unlocks:

```
┌─────────────────────────────────────────────────────────┐
│                    🎊 🎉 🎊                             │
│                                                         │
│            Chapter Unlocked!                            │
│                                                         │
│       📖 Chapter 2: El Principito                       │
│                                                         │
│  You've mastered Chapter 1 through dedication and      │
│  consistent practice. Chapter 2 awaits!                │
│                                                         │
│  Stats:                                                │
│  • 232/289 words encountered (80%)                     │
│  • 32 average mastery                                  │
│  • 135 total reviews                                   │
│                                                         │
│  🏅 Badge Earned: Chapter 1 Complete                   │
│  ⭐ +100 XP Bonus                                      │
│                                                         │
│  [Start Reading Chapter 2 →]                           │
└─────────────────────────────────────────────────────────┘
```

---

# GAMIFICATION & MOTIVATION

## Core Elements

### 1. Daily Streaks

**Definition:** Consecutive days completing at least Foundation 50 package

**Levels:**
- 🔥 7-day streak: "Week Warrior"
- 🔥 30-day streak: "Month Master"
- 🔥 100-day streak: "Century Scholar"
- 🔥 365-day streak: "Year Legend"

**Display:**
```
Current Streak: 🔥 12 days
Longest Streak: 🏆 28 days (Oct 1-28)
```

**Streak Protection:**
- Partial credit: Complete 50+ words = maintains streak
- Visible warning at 8 PM if no review done
- Can't "make up" missed days

### 2. XP System

**Earning XP:**
- +1 XP per word reviewed
- +25 XP per waypoint completed
- +100 XP per package completed
- +100 XP per chapter unlocked
- +50 XP per badge earned

**Levels:**
- Level calculation: `level = floor(sqrt(total_xp / 100))`
- Display level on profile
- New title every 5 levels

**Titles:**
- Level 1-4: Novice
- Level 5-9: Apprentice
- Level 10-14: Student
- Level 15-19: Scholar
- Level 20-24: Expert
- Level 25+: Master

### 3. Badges

**Completion Badges:**
- 🥉 Consistent Learner (Complete Foundation 50)
- 🥈 Dedicated Student (Complete Standard 100)
- 🥇 Language Champion (Complete Immersion 150)
- 💎 Elite Polyglot (Complete Mastery 250)

**Streak Badges:**
- 🔥 Week Warrior (7-day streak)
- 🔥 Month Master (30-day streak)
- 🔥 Century Scholar (100-day streak)

**Achievement Badges:**
- 📚 Chapter Complete (unlock each chapter)
- ⭐ Level 5 Master (100 words at Level 5+)
- 🎯 Perfectionist (95%+ accuracy in session)
- 🌙 Night Owl (complete package after 10 PM)
- 🌅 Early Bird (complete package before 7 AM)
- ⚡ Speed Demon (complete 150 words in <45 min)

**Milestone Badges:**
- 1,000 words reviewed
- 5,000 words reviewed
- 10,000 words reviewed
- 50,000 words reviewed

### 4. Progress Visualization

**Health Bars:**
- Word health shown as colored bar (red/orange/yellow/green)
- Filling up health feels rewarding

**Mastery Bars:**
- 0-100 scale shown as progress bar
- Level-up animations on threshold cross

**Chapter Progress:**
- Percentage complete toward unlock
- Visual progress bar

**Calendar Heat Map:**
- 35-day calendar showing daily activity
- Color intensity = words reviewed that day
- See patterns, build consistency

### 5. Leaderboards (Optional)

**Weekly Leaderboard:**
- Users in same city/region
- Ranked by words reviewed this week
- Friendly competition

**Friends Leaderboard:**
- Compare with friends
- See who's maintaining streak

**Opt-Out:** Users can hide from leaderboards

---

# USER EXPERIENCE FLOW

## Daily Flow: Typical User Journey

### 1. User Logs In (Morning)

```
┌─────────────────────────────────────────────────────────┐
│  🌅 Good Morning, Peter!                                │
│  Tuesday, November 9, 2025                              │
│                                                         │
│  🔥 Current Streak: 12 days                            │
│  ⚠️  42 words need urgent attention                     │
│  📚 Chapter 3: 78% complete                            │
│  ⭐ 18 words ready for level-up                        │
│                                                         │
│  Choose Your Learning Journey Today:                   │
│  [Select Package →]                                     │
└─────────────────────────────────────────────────────────┘
```

### 2. Package Selection

User clicks "Select Package" →

```
Package Selection Screen (see Daily Package System section)

User selects: Immersion (150 words)
```

### 3. Package Created

```
✅ Package Created!

Your Learning Journey Today:
  📕 Immersion (150 words)
  ⏱️  Estimated: 45-60 minutes
  🎴 7 waypoints
  🏅 Badge: Language Champion
  
Breakdown:
  ⚡ 20 critical words
  📚 45 Chapter 3 words
  ⭐ 18 mastery-ready words
  🆕 15 new words
  🔄 52 reinforcement words
  
[Begin Journey →]
```

### 4. Waypoint 1: Critical Rescue

User starts first waypoint:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Waypoint 1: Critical Rescue                         │
│  Save your struggling words!                           │
│  Progress: 1/20 cards                                  │
└─────────────────────────────────────────────────────────┘

[Flashcard appears with word "el fracaso"]
```

User reviews 20 cards, marking Don't Know/Hard/Medium/Easy

```
✅ Waypoint 1 Complete!
   +20 XP earned
   14 minutes
   
   12 words rescued from critical health!
   
[Next: Chapter Core (25 words) →]
```

### 5. Waypoints 2-6

User continues through waypoints, taking breaks as needed

### 6. Waypoint 7: Final Push

```
🏁 Final Waypoint!
   25 cards remaining
   You're almost there!
   
[Complete Journey →]
```

### 7. Package Complete

```
┌─────────────────────────────────────────────────────────┐
│                    🎉 🎊 🎉                             │
│                                                         │
│            Package Complete!                            │
│                                                         │
│  📕 Immersion (150 words)                              │
│  ⏱️  52 minutes                                         │
│  🏅 Language Champion Badge Earned!                    │
│                                                         │
│  Performance:                                          │
│  🟢 Easy: 57 (38%)                                     │
│  🟡 Medium: 58 (39%)                                   │
│  🟠 Hard: 23 (15%)                                     │
│  🔴 Don't Know: 12 (8%)                                │
│                                                         │
│  Progress:                                             │
│  ⭐ 12 words leveled up!                               │
│  💪 42 critical words rescued                          │
│  📚 Chapter 3: 78% → 85% complete!                     │
│                                                         │
│  🔥 Streak: 13 days (maintained!)                      │
│  ⭐ +150 XP earned                                     │
│  🏆 Total XP: 12,600 (Level 24)                        │
│                                                         │
│  [View Detailed Stats] [Done]                          │
└─────────────────────────────────────────────────────────┘
```

### 8. Dashboard Updated

User returns to dashboard:

```
Progress updated everywhere:
  - Streak incremented
  - XP added
  - Chapter progress updated
  - Calendar heat map filled
  - Badge showcase updated
```

---

# DATABASE SCHEMA

## Tables & Columns

### `user_vocabulary_progress`

Primary table tracking user progress for each word:

```sql
CREATE TABLE user_vocabulary_progress (
  user_id UUID REFERENCES auth.users(id),
  vocab_id UUID REFERENCES vocabulary(vocab_id),
  
  -- MASTERY SYSTEM
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  last_correct_review_at TIMESTAMPTZ,
  
  -- EXPOSURE SYSTEM
  health INTEGER DEFAULT 100 CHECK (health >= 0 AND health <= 100),
  total_reviews INTEGER DEFAULT 0,
  correct_reviews INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  last_7_days_reviews INTEGER DEFAULT 0,
  
  -- STRUGGLING WORD DETECTION
  failed_in_last_3_sessions BOOLEAN DEFAULT FALSE,
  consecutive_failures INTEGER DEFAULT 0,
  
  -- REVIEW HISTORY
  review_history JSONB DEFAULT '[]'::jsonb,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, vocab_id)
);

CREATE INDEX idx_user_vocab_health ON user_vocabulary_progress(user_id, health);
CREATE INDEX idx_user_vocab_mastery ON user_vocabulary_progress(user_id, mastery_level);
CREATE INDEX idx_user_vocab_last_review ON user_vocabulary_progress(user_id, last_reviewed_at);
```

**Key Columns Explained:**

- `mastery_level`: 0-100 score, represents true learning depth
- `last_correct_review_at`: Timestamp of last Hard/Medium/Easy review (for time gates)
- `health`: 0-100, decays over time, restored on review
- `total_reviews`: ALL reviews including Don't Know
- `correct_reviews`: Only Hard/Medium/Easy reviews
- `failed_in_last_3_sessions`: Flag for leech detection
- `review_history`: JSONB array storing last 20 reviews with details

---

### `user_daily_stats`

Tracks daily activity:

```sql
CREATE TABLE user_daily_stats (
  user_id UUID REFERENCES auth.users(id),
  review_date DATE,
  
  -- REVIEW COUNTS
  words_reviewed INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  
  -- PERFORMANCE
  dont_know_count INTEGER DEFAULT 0,
  hard_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  easy_count INTEGER DEFAULT 0,
  
  -- STREAKS
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  longest_streak_start DATE,
  longest_streak_end DATE,
  total_active_days INTEGER DEFAULT 0,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, review_date)
);
```

---

### `user_chapter_progress`

Tracks chapter unlock status:

```sql
CREATE TABLE user_chapter_progress (
  user_id UUID REFERENCES auth.users(id),
  chapter_id UUID REFERENCES chapters(chapter_id),
  
  -- UNLOCK STATUS
  is_unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  
  -- PROGRESS METRICS
  words_encountered INTEGER DEFAULT 0,
  total_chapter_words INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  average_mastery DECIMAL(5,2) DEFAULT 0,
  unlock_progress DECIMAL(5,2) DEFAULT 0,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, chapter_id)
);
```

---

### `user_packages` (New)

Tracks daily packages:

```sql
CREATE TABLE user_packages (
  package_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  
  -- PACKAGE DETAILS
  package_type VARCHAR(20) CHECK (package_type IN ('foundation', 'standard', 'immersion', 'mastery')),
  total_words INTEGER,
  words_completed INTEGER DEFAULT 0,
  
  -- STATUS
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  
  -- PERFORMANCE
  dont_know_count INTEGER DEFAULT 0,
  hard_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  easy_count INTEGER DEFAULT 0,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_packages_user ON user_packages(user_id, status);
CREATE INDEX idx_user_packages_expires ON user_packages(user_id, expires_at);
```

---

### `user_waypoints` (New)

Tracks waypoint progress within packages:

```sql
CREATE TABLE user_waypoints (
  waypoint_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID REFERENCES user_packages(package_id) ON DELETE CASCADE,
  
  -- WAYPOINT DETAILS
  waypoint_number INTEGER,
  theme VARCHAR(50),
  description TEXT,
  icon VARCHAR(10),
  total_words INTEGER,
  
  -- STATUS
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- WORDS
  word_ids JSONB, -- Array of vocab_ids
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_waypoints_package ON user_waypoints(package_id, waypoint_number);
```

---

### `user_badges` (New)

Tracks earned badges:

```sql
CREATE TABLE user_badges (
  user_id UUID REFERENCES auth.users(id),
  badge_id VARCHAR(50),
  
  -- BADGE INFO
  badge_name VARCHAR(100),
  badge_description TEXT,
  badge_icon VARCHAR(10),
  badge_tier VARCHAR(20), -- bronze/silver/gold/diamond
  
  -- METADATA
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id, earned_at DESC);
```

---

### `user_settings`

User preferences:

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  
  -- DAILY GOALS
  daily_goal_words INTEGER DEFAULT 100,
  default_package VARCHAR(20) DEFAULT 'standard',
  
  -- SESSION SETTINGS
  cards_per_deck INTEGER DEFAULT 20 CHECK (cards_per_deck BETWEEN 15 AND 30),
  
  -- LEARNING MODES
  chapter_focus_mode BOOLEAN DEFAULT FALSE,
  current_focus_chapter UUID REFERENCES chapters(chapter_id),
  
  -- NOTIFICATIONS
  daily_reminder_enabled BOOLEAN DEFAULT TRUE,
  daily_reminder_time TIME DEFAULT '09:00',
  streak_warning_enabled BOOLEAN DEFAULT TRUE,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# IMPLEMENTATION FORMULAS

Quick reference for key calculations:

## Priority Score
```javascript
priority = (
  ((100 - health) × 0.5) +                    // Health urgency (0-50)
  (min(30, times_in_book × 0.6)) +            // Frequency (0-30)
  (chapter_position_score) +                  // Chapter (0-15)
  (time_gate_met ? 10 : 0) +                  // Mastery ready (0-10)
  (chapter_focus ? 10 : 0)                    // Focus bonus (0-10)
) × (health < 20 ? 1.5 : 1.0)                 // Critical multiplier
  × (failed_recently ? 1.3 : 1.0)             // Leech multiplier
  × (new_word ? 0.8 : 1.0)                    // New penalty
```

## Current Health
```javascript
health = max(0, stored_health - (days_since_review × decay_rate))

decay_rate = DECAY_RATES[floor(mastery_level / 10)]
```

## Mastery Gain
```javascript
if (response == 'dont_know'):
  mastery_change = -5
  requires_time_gate = false
  
else:
  time_since_correct = now - last_correct_review_at
  time_gate = TIME_GATES[floor(mastery_level / 10)]
  
  if (time_since_correct >= time_gate):
    mastery_change = POINTS[response]  // +3, +6, or +10
  else:
    mastery_change = 0  // Time gate not met
    show_message = "Wait " + (time_gate - time_since_correct) + " for mastery"
```

## Chapter Unlock Progress
```javascript
encounter_rate = words_encountered / total_chapter_words

if (encounter_rate < 0.80):
  // Still need baseline
  unlock_progress = encounter_rate × 50  // 0-50%
else:
  // Baseline met, check paths
  path_a = (avg_mastery / 40) × 100
  path_b = (total_reviews / 50) × 100
  path_c = ((avg_mastery/30) × 50) + ((total_reviews/30) × 50)
  
  unlock_progress = min(100, max(path_a, path_b, path_c))
  
can_unlock = (encounter_rate >= 0.80) AND (
  (avg_mastery >= 40) OR
  (total_reviews >= 50) OR
  (avg_mastery >= 30 AND total_reviews >= 30)
)
```

## XP & Level
```javascript
xp_earned = (
  (words_reviewed × 1) +
  (waypoints_completed × 25) +
  (packages_completed × 100) +
  (chapters_unlocked × 100) +
  (badges_earned × 50)
)

level = floor(sqrt(total_xp / 100))
```

---

# EDGE CASES & SPECIAL SCENARIOS

## 1. User Takes Multi-Day Break

**Problem:** All words decay to critical health

**Solution:**
- On return, show "Welcome Back!" screen
- First package prioritizes highest-frequency critical words
- Gradually reintroduce other words
- Don't overwhelm with 200 critical words

**Implementation:**
```
If user hasn't reviewed in 5+ days:
  First session: Only top 50 critical words by frequency
  Subsequent sessions: Normal prioritization resumes
```

## 2. User Completes All Due Words

**Problem:** No words meet selection criteria

**Solution:**
- Select words with lowest health (even if not critical)
- Include words ready for mastery gain
- Introduce new words from next chapter (preview)
- Show "You're ahead! Great work!" message

## 3. Don't Know Loop (Same Word 3x in Session)

**Problem:** User keeps failing same word

**Solution:**
- After 3rd "Don't Know" in same session, remove from queue
- Flag as "leech" (failed_in_last_3_sessions = true)
- Don't punish user with endless failures
- Show helpful tip: "This word needs extra attention. Try creating a mnemonic!"

## 4. Mastery Level 10 Words

**Problem:** Word has perfect mastery (95-100), what now?

**Solution:**
- Still subject to health decay (very slow: 0.5/day)
- Only appears if health drops below 40
- Otherwise, considered "permanently learned"
- Can manually review via search if user wants

## 5. Chapter 1 Not Completed, Wants Chapter 3

**Problem:** User tries to skip chapters

**Solution:**
- Chapters are locked in sequence
- Can't unlock Chapter 3 until Chapter 2 is unlocked
- Can't unlock Chapter 2 until Chapter 1 requirements met
- Show: "Complete previous chapters to unlock"

## 6. Package Expires (24 Hours)

**Problem:** User started package but didn't finish in 24 hours

**Solution:**
- Package marked "expired"
- Words released back to general pool
- No penalty if user completed at least Foundation 50 equivalent
- Can view expired packages in history (read-only)

## 7. User Changes Package Mid-Stream

**Problem:** Selected Immersion 150, wants to switch to Foundation 50

**Solution:**
- Allow downgrade (not upgrade)
- Keep progress already made
- Mark original package "abandoned"
- Create new Foundation 50 package
- XP already earned is retained

## 8. Critical Health Overload (100+ Words)

**Problem:** Too many critical words after break

**Solution:**
- Cap critical words at 40% of deck (not 100%)
- Prioritize by frequency × chapter position
- Spread recovery across multiple days
- Show: "42 critical words today, more tomorrow"

## 9. New Word Introduction Rate

**Problem:** Running out of review words, all high mastery

**Solution:**
- Automatically increase new word rate
- If avg deck mastery > 60, increase new words to 30%
- Keeps learning engaging
- Prevents boredom from only reviewing known words

## 10. Simultaneous Level-Ups

**Problem:** Multiple words level up in one session (10+)

**Solution:**
- Show level-up celebration for first word
- Show summary at end: "12 words leveled up today!"
- Don't interrupt flow with 12 separate celebrations
- Batch achievements

---

# CONCLUSION

This algorithm represents the heart of Voquab's learning system. Every feature, every decision, every line of code should align with these principles:

**Quality + Quantity**
**Context Over Isolation**  
**Time-Gated Mastery**
**Health-Based Urgency**
**Sequential Progression**
**Gamification With Purpose**

The goal is not just vocabulary acquisition, but true fluency through meaningful, engaging, scientifically-sound practice.

---

**Document Version:** 1.0  
**Last Updated:** November 9, 2025  
**Status:** MASTER REFERENCE  
**Next Review:** After Phase 1 Implementation

---

# APPENDIX: CONSTANTS REFERENCE

```javascript
// Mastery Levels
const MASTERY_LEVELS = [
  { level: 0, range: [0,9],     label: "New",        timeGate: 0,         interval: "immediate" },
  { level: 1, range: [10,19],   label: "Introduced", timeGate: 4*HOUR,    interval: 12*HOUR },
  { level: 2, range: [20,29],   label: "Recognizing", timeGate: 12*HOUR,  interval: 1*DAY },
  { level: 3, range: [30,39],   label: "Learning",   timeGate: 1*DAY,     interval: 3*DAY },
  { level: 4, range: [40,49],   label: "Familiar",   timeGate: 3*DAY,     interval: 7*DAY },
  { level: 5, range: [50,59],   label: "Known",      timeGate: 7*DAY,     interval: 14*DAY },
  { level: 6, range: [60,69],   label: "Strong",     timeGate: 14*DAY,    interval: 30*DAY },
  { level: 7, range: [70,79],   label: "Mastered",   timeGate: 30*DAY,    interval: 60*DAY },
  { level: 8, range: [80,89],   label: "Expert",     timeGate: 60*DAY,    interval: 120*DAY },
  { level: 9, range: [90,94],   label: "Native",     timeGate: 120*DAY,   interval: 180*DAY },
  { level: 10, range: [95,100], label: "Perfect",    timeGate: 180*DAY,   interval: 365*DAY }
]

// Mastery Point Changes
const MASTERY_POINTS = {
  'dont_know': -5,
  'hard': +3,
  'medium': +6,
  'easy': +10
}

// Health Boosts
const HEALTH_BOOSTS = {
  'dont_know': 10,
  'hard': 30,
  'medium': 60,
  'easy': 100
}

// Health Decay Rates (points per day)
const DECAY_RATES = {
  0: 25,  1: 20,  2: 12,  3: 8,   4: 5,
  5: 3,   6: 2,   7: 1.5, 8: 1,   9: 0.7,  10: 0.5
}

// Priority Weights
const PRIORITY_WEIGHTS = {
  health_urgency: 0.5,      // (100-health) × 0.5 = 0-50 points
  frequency: 0.6,           // times_in_book × 0.6, max 30
  chapter_early: 15,        // Chapters 1-3
  chapter_mid: 10,          // Chapters 4-5
  chapter_late: 5,          // Chapters 6-10
  mastery_ready: 10,
  chapter_focus: 10
}

// Priority Multipliers
const PRIORITY_MULTIPLIERS = {
  critical_health: 1.5,     // health < 20
  leech: 1.3,               // failed_in_last_3_sessions
  new_word: 0.8             // total_reviews == 0
}

// Package Sizes
const PACKAGES = {
  foundation: { words: 50,  time: "15-20 min", waypoints: 4,  badge: "🥉" },
  standard:   { words: 100, time: "30-40 min", waypoints: 6,  badge: "🥈" },
  immersion:  { words: 150, time: "45-60 min", waypoints: 7,  badge: "🥇" },
  mastery:    { words: 250, time: "75-100 min", waypoints: 12, badge: "💎" }
}

// Deck Composition Targets
const DECK_COMPOSITION = {
  critical: 0.30,    // 30%
  mastery_ready: 0.25,   // 25%
  exposure: 0.25,    // 25%
  new: 0.20          // 20%
}

const MAX_NEW_WORDS_PER_DECK = 5

// Chapter Unlock Thresholds
const CHAPTER_UNLOCK = {
  encounter_rate: 0.80,    // 80% of words must be encountered
  path_a_mastery: 40,      // 40 avg mastery
  path_b_exposure: 50,     // 50 total reviews
  path_c_mastery: 30,      // 30 mastery AND
  path_c_exposure: 30      // 30 reviews
}

// Time Constants
const HOUR = 60 * 60 * 1000  // milliseconds
const DAY = 24 * HOUR
```
