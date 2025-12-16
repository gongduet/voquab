# PHASE 3 SYSTEM ARCHITECTURE & DATA FLOW
## Visual Reference Guide

**Date:** November 9, 2025  
**Purpose:** Visual overview of Phase 3 architecture and data flows

---

## SYSTEM OVERVIEW

```
┌──────────────────────────────────────────────────────────────┐
│                    VOQUAB PHASE 3 SYSTEM                     │
│                   Daily Package System                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              â"‚
        ┌─────────────────────┼─────────────────────┐
        â"‚                     â"‚                     â"‚
   ┌────â"´────┐           ┌────â"´────┐           ┌────â"´────┐
   │ Package │           │  Badge  │           │ Progress│
   │ System  │           │ System  │           │ Tracking│
   └─────────┘           └─────────┘           └─────────┘
```

---

## DATABASE SCHEMA DIAGRAM

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │
         â"‚ user_id (FK)
         â"‚
         ├──────────────────────────────────────┐
         â"‚                                      â"‚
         â"‚                                      â"‚
    ┌────â"´────────────┐                  ┌──────â"´──────────┐
    │ user_packages   │                  │  user_badges     │
    │                 │                  │                  │
    │ • package_id    │                  │ • badge_id       │
    │ • package_type  │                  │ • badge_name     │
    │ • total_words   │                  │ • badge_icon     │
    │ • status        │                  │ • badge_tier     │
    │ • expires_at    │                  │ • earned_at      │
    └────┬────────────┘                  └──────────────────┘
         â"‚
         â"‚ package_id (FK)
         â"‚
    ┌────â"´─────────────┐
    │ package_words    │
    │ (junction table) │
    │                  │
    │ • package_id     │───┐
    │ • vocab_id       │   │ vocab_id (FK)
    │ • word_order     │   │
    │ • category       │   │
    │ • reviewed       │   │
    └──────────────────┘   │
                           â"‚
                      ┌────â"´────────────┐
                      │   vocabulary    │
                      │                 │
                      │ • vocab_id      │
                      │ • lemma (word)  │
                      │ • definition    │
                      └─────────────────┘
```

---

## DATA FLOW: PACKAGE CREATION

```
User Opens App
      │
      â"‚
      â"¼
┌─────────────────┐
│  Home/Dashboard │
│                 │
│ [Start Package] │ ◄───── Check for active package
└────────┬────────┘
         â"‚
         â"‚ Click "Start Package"
         â"‚
         â"¼
┌───────────────────────┐
│ Package Selection     │
│                       │
│ 1. Load user words    │◄────── Query: user_vocabulary_progress
│ 2. Calculate health   │        + vocabulary
│ 3. Calculate priority │
│ 4. Get recommendation │
│                       │
│ [Foundation] [50]     │
│ [Standard]   [100]    │
│ [Immersion]  [150]    │◄────── User selects package type
│ [Mastery]    [250]    │
└───────────┬───────────┘
            â"‚
            â"‚ User clicks package type
            â"‚
            â"¼
┌────────────────────────────────┐
│ selectWordsForPackage()        │
│                                │
│ 1. Categorize words:           │
│    • Critical (health < 20)    │◄─── Uses Phase 1: Health System
│    • Mastery Ready (time gate) │◄─── Uses Phase 2: Time Gates
│    • Exposure (< 10 reviews)   │
│    • New (0 reviews)           │
│                                │
│ 2. Apply composition:          │
│    • 30% Critical              │
│    • 25% Mastery Ready         │
│    • 25% Exposure              │
│    • 20% New (max 5-20 words)  │
│                                │
│ 3. Sort by priority score      │◄─── Uses Phase 1: Priority Scoring
│ 4. Select top N words          │
│ 5. Shuffle for unpredictability│
│ 6. Assign word_order           │
└───────────┬────────────────────┘
            â"‚
            â"‚ Selected words array
            â"‚
            â"¼
┌──────────────────────────┐
│ Create Package Record    │
│                          │
│ INSERT INTO user_packages│
│ {                        │
│   user_id,               │
│   package_type,          │
│   total_words: 150,      │
│   expires_at: NOW()+24h  │
│ }                        │
└───────────┬──────────────┘
            â"‚
            â"‚ package_id created
            â"‚
            â"¼
┌─────────────────────────────┐
│ Insert Package Words        │
│                             │
│ INSERT INTO package_words   │
│ (package_id, vocab_id,      │
│  word_order, category)      │
│                             │
│ [Batch insert 150 records]  │
└───────────┬─────────────────┘
            â"‚
            â"‚ Success
            â"‚
            â"¼
┌────────────────────┐
│  Package View      │
│                    │
│ Package: Immersion │
│ Words: 0/150       │
│ Expires: 23h 59m   │
│                    │
│ [Begin Package]    │◄──── User ready to start
└────────────────────┘
```

---

## DATA FLOW: PACKAGE REVIEW

```
Package View
      │
      â"‚ User clicks "Begin Package"
      â"‚
      â"¼
┌──────────────────────────┐
│ Flashcards.jsx           │
│ (with packageId param)   │
│                          │
│ 1. Load package data     │◄──── Query: user_packages
│ 2. Load package words    │◄──── Query: package_words
│                          │      WHERE reviewed = false
│                          │      ORDER BY word_order
│                          │
│ 3. Display first card    │
└───────────┬──────────────┘
            â"‚
            â"‚ Show flashcard
            â"‚
            â"¼
┌──────────────────────┐
│  Flashcard Display   │
│                      │
│  Spanish: "el avión" │
│                      │
│  [Show Answer]       │
└──────────┬───────────┘
           â"‚
           â"‚ User clicks
           â"‚
           â"¼
┌─────────────────────────────┐
│ Answer + Response Buttons   │
│                             │
│ English: "the airplane"     │
│                             │
│ How well did you know this? │
│                             │
│ [Don't Know] [Hard]         │◄──── User selects
│ [Medium]     [Easy]         │
└──────────┬──────────────────┘
           â"‚
           â"‚ Response: "Medium"
           â"‚
           â"¼
┌────────────────────────────────────┐
│ handleCardResponse("medium")       │
│                                    │
│ 1. Update word progress:           │
│    • mastery_level += 6            │◄──── Phase 2: Check time gate
│    • health = min(100, health+60)  │◄──── Phase 1: Health boost
│    • total_reviews++               │
│    • review_history.push(...)      │
│                                    │
│ 2. Update package word:            │
│    UPDATE package_words            │
│    SET reviewed = true,            │
│        review_response = "medium", │
│        reviewed_at = NOW()         │
│                                    │
│ 3. Update package stats:           │
│    UPDATE user_packages            │
│    SET words_completed++,          │
│        medium_count++              │
│                                    │
│ 4. Check if package complete       │
│    IF words_completed >= total:    │
│       completePackage()            │
└────────────┬───────────────────────┘
             â"‚
             â"‚ Updated
             â"‚
             â"¼
┌──────────────────────┐
│ Next Card or Done    │
│                      │
│ • If more words:     │
│   Show next card     │
│                      │
│ • If all done:       │
│   Complete package   │
└──────────────────────┘
```

---

## DATA FLOW: PACKAGE COMPLETION

```
Last Card Reviewed
      │
      â"‚ words_completed >= total_words
      â"‚
      â"¼
┌─────────────────────────────────┐
│ completePackage()               │
│                                 │
│ 1. Calculate metrics:           │
│    • actual_minutes             │
│    • accuracy %                 │
│    • performance breakdown      │
│                                 │
│ 2. Update package:              │
│    UPDATE user_packages         │
│    SET status = 'completed',    │
│        completed_at = NOW(),    │
│        actual_minutes = X       │
└────────────┬────────────────────┘
             â"‚
             â"‚
             â"¼
┌──────────────────────────────────┐
│ checkBadgesOnPackageComplete()  │
│                                 │
│ Check for earned badges:        │
│                                 │
│ • Completion badge:             │
│   [Foundation/Standard/         │
│    Immersion/Mastery]           │
│                                 │
│ • Achievement badges:           │
│   - Perfectionist (>95% acc)    │
│   - Night Owl (after 10 PM)     │
│   - Early Bird (before 7 AM)    │
│   - Speed Demon (<45 min)       │
│                                 │
│ • Milestone badges:             │
│   - 1,000 / 5,000 / 10,000      │
│     total words reviewed        │
└────────────┬─────────────────────┘
             â"‚
             â"‚ badges: Array<Badge>
             â"‚
             â"¼
┌──────────────────────────────┐
│ Award Badges (if any)        │
│                              │
│ FOR EACH badge:              │
│   INSERT INTO user_badges    │
│   {                          │
│     user_id,                 │
│     badge_id,                │
│     badge_name,              │
│     earned_at: NOW()         │
│   }                          │
│   ON CONFLICT DO NOTHING     │◄─── Prevent duplicates
└────────────┬─────────────────┘
             â"‚
             â"‚ If new badges
             â"‚
             â"¼
┌────────────────────────────┐
│ Show Badge Notification    │
│                            │
│      ðŸŽ‰ ðŸŽŠ ðŸŽ‰               │
│                            │
│   Badge Earned!            │
│   ðŸ¥‡ Language Champion      │
│                            │
│ Complete 150-word Immersion│
│                            │
│   [Awesome! →]             │◄─── Animation + celebration
└────────────┬───────────────┘
             â"‚
             â"‚
             â"¼
┌──────────────────────────┐
│ Update Daily Stats       │
│                          │
│ UPDATE user_daily_stats  │
│ SET                      │
│   words_reviewed += 150, │
│   package_completed=true,│
│   streak_maintained=true │
│                          │
│ Check & update streak    │
└────────────┬─────────────┘
             â"‚
             â"‚
             â"¼
┌──────────────────────────────┐
│ Completion Screen            │
│                              │
│ ðŸŽ‰ Package Complete!         │
│                              │
│ ðŸ"• Immersion (150 words)     │
│ â±ï¸  52 minutes                │
│ ðŸ… Language Champion earned!  │
│                              │
│ Performance:                 │
│ ðŸŸ¢ Easy: 57 (38%)            │
│ ðŸŸ¡ Medium: 58 (39%)          │
│ ðŸŸ  Hard: 23 (15%)            │
│ ðŸ"´ Don't Know: 12 (8%)       │
│                              │
│ ðŸ"¥ Streak: 13 days!          │
│ â­ +150 XP earned             │
│                              │
│ [View Stats] [Done]          │
└──────────────────────────────┘
```

---

## BADGE SYSTEM ARCHITECTURE

```
Package Completed
      │
      â"‚
      â"¼
┌─────────────────────────────────────┐
│ Badge Checking System               │
└─────────────────────────────────────┘
      │
      ├──────────────┬──────────────┬──────────────┬──────────────┐
      â"‚              â"‚              â"‚              â"‚              â"‚
      â"¼              â"¼              â"¼              â"¼              â"¼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│Completion│  │ Streak  │  │Achievement│ │Milestone│  │ Social  │
│ Badges   │  │ Badges  │  │  Badges  │  │ Badges  │  │ (Future)│
└─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
     â"‚              â"‚              â"‚              â"‚
     â"‚              â"‚              â"‚              â"‚
     â"¼              â"¼              â"¼              â"¼

ðŸ¥‰ Foundation   ðŸ"¥ Week        ðŸŽ¯ Perfectionist ðŸ"– 1K Words
ðŸ¥ˆ Standard      (7 days)       (95% accuracy)  ðŸ"š 5K Words
ðŸ¥‡ Immersion    ðŸ"¥ Month       ðŸŒ™ Night Owl     ðŸ"– 10K Words
ðŸ'Ž Mastery       (30 days)      (after 10 PM)   ðŸ† 50K Words
                ðŸ"¥ Century      ðŸŒ… Early Bird
                (100 days)     (before 7 AM)
                              âš¡ Speed Demon
                              (<45 min)
```

---

## USER JOURNEY MAP

```
Day 1: First Package
┌──────────────────────────────────────────────────────────────┐
│ 1. Login → Dashboard                                         │
│    "Start Today's Package" CTA                               │
│                                                              │
│ 2. Package Selection                                         │
│    Recommendation: "Standard (100 words)"                    │
│    User selects: Standard                                    │
│                                                              │
│ 3. Package Created                                           │
│    • 30 critical words                                       │
│    • 25 mastery-ready words                                  │
│    • 25 exposure words                                       │
│    • 20 new words                                            │
│    Expires: in 24 hours                                      │
│                                                              │
│ 4. Review Session (Morning)                                  │
│    Reviewed: 50/100 words                                    │
│    Time: 18 minutes                                          │
│    Status: "In Progress"                                     │
│                                                              │
│ 5. Break (User leaves)                                       │
│    Package remains active                                    │
│                                                              │
│ 6. Resume (Evening)                                          │
│    Reviewed: 50 more words                                   │
│    Time: 16 minutes                                          │
│    Total: 100/100 complete                                   │
│                                                              │
│ 7. Package Complete!                                         │
│    ðŸ… Badge Earned: Dedicated Student                        │
│    ðŸ"¥ Streak: Day 1                                          │
│    â­ +100 XP                                                 │
└──────────────────────────────────────────────────────────────┘

Day 2-6: Building Streak
┌──────────────────────────────────────────────────────────────┐
│ Each day:                                                    │
│ • Login → Dashboard shows streak                             │
│ • Create new package                                         │
│ • Complete package                                           │
│ • Maintain streak                                            │
│ • Earn completion badges                                     │
└──────────────────────────────────────────────────────────────┘

Day 7: First Milestone
┌──────────────────────────────────────────────────────────────┐
│ Package Complete!                                            │
│ ðŸ… Badge Earned: Week Warrior                                │
│    "Maintain a 7-day learning streak"                        │
│ ðŸ"¥ Streak: 7 days                                            │
│                                                              │
│ User feels accomplished and motivated to continue!           │
└──────────────────────────────────────────────────────────────┘
```

---

## INTEGRATION WITH EXISTING SYSTEMS

```
┌────────────────────────────────────────────────────────┐
│                  VOQUAB COMPLETE SYSTEM                │
└────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼──────────────────┐
        â"‚                 â"‚                  â"‚
   ┌────â"´─────┐      ┌────â"´─────┐      ┌─────â"´────┐
   │ Phase 1  │      │ Phase 2  │      │ Phase 3  │
   │  Health  │──────│   Time   │──────│ Packages │
   │ & Priority│     │  Gates   │      │ & Badges │
   └──────────┘      └──────────┘      └──────────┘
        │                  │                  │
        â"‚                  â"‚                  â"‚
        â""──────────────────┴──────────────────┘
                          │
                          â"‚
        ┌─────────────────┼──────────────────┐
        â"‚                 â"‚                  â"‚
   ┌────â"´─────┐      ┌────â"´─────┐      ┌─────â"´────┐
   │Flashcards│      │ Chapter  │      │ Progress │
   │  System  │      │Unlocking │      │ Tracking │
   └──────────┘      └──────────┘      └──────────┘

Data Flows:
• Phase 1 → Phase 3: Health & Priority scores
• Phase 2 → Phase 3: time_gate_met flag
• Phase 3 → Flashcards: Package word lists
• Phase 3 → Progress: Daily stats, streaks
• Phase 3 → Chapter: Word reviews count
```

---

## COMPONENT HIERARCHY

```
App.jsx
│
├── Router
│   │
│   ├── /package-selection
│   │   └── <PackageSelection />
│   │       ├── Package Cards (4 types)
│   │       ├── User Stats Summary
│   │       └── Active Package Warning
│   │
│   ├── /package/:packageId
│   │   └── <PackageView />
│   │       ├── Package Header
│   │       ├── Progress Bar
│   │       ├── Performance Stats
│   │       ├── Time Remaining
│   │       └── Action Buttons
│   │
│   ├── /flashcards?package=:id
│   │   └── <Flashcards /> (enhanced)
│   │       ├── Card Display
│   │       ├── Response Buttons
│   │       ├── Package Progress (if packageId)
│   │       └── Completion Flow
│   │
│   └── /dashboard or /
│       └── <Home />
│           ├── Package CTA
│           ├── Active Package Status
│           ├── Recent Badges
│           └── Stats Summary
│
├── <BadgeNotification />
│   └── Modal overlay (shown on badge earn)
│
└── <BadgeShowcase />
    └── Badge collection display
```

---

## STATE MANAGEMENT FLOW

```
Supabase Database (Single Source of Truth)
              │
              â"‚ Query/Update
              â"‚
┌─────────────â"´─────────────┐
│   React Components        │
│   (Local State)           │
│                           │
│   useState, useEffect     │
│   No global state needed  │
└─────────────┬─────────────┘
              │
              â"‚ User Actions
              â"‚
┌─────────────â"´─────────────┐
│   Event Handlers          │
│                           │
│   createPackage()         │
│   handleCardResponse()    │
│   completePackage()       │
└─────────────┬─────────────┘
              │
              â"‚ Database Updates
              â"‚
Supabase Database
```

**State Flow Example:**
```
User clicks "Medium" button
     â†"
handleCardResponse("medium")
     â†"
Update Supabase:
  - user_vocabulary_progress
  - package_words
  - user_packages
     â†"
Re-fetch package data
     â†"
Update local state (setPackage)
     â†"
React re-renders UI
     â†"
Progress bar updates
```

---

## ERROR HANDLING FLOW

```
User Action
    │
    â"‚ try
    â"¼
Database Operation
    │
    ├── Success ──────────â"ðŸŽ‰ Update UI
    │
    └── Error
        │
        ├── Network Error
        │   └─→ Show: "Connection issue. Please try again."
        │
        ├── Validation Error
        │   └─→ Show: "Invalid data. Please check your input."
        │
        ├── RLS Policy Error
        │   └─→ Show: "Permission denied. Please log in again."
        │
        ├── Duplicate Key Error
        │   └─→ Handle gracefully (e.g., badge already earned)
        │
        └── Unknown Error
            └─→ Show: "Something went wrong. Please try again."
                Log error for debugging
```

---

## PERFORMANCE OPTIMIZATION POINTS

```
Package Creation:
┌─────────────────────────────────┐
│ 1. Load user words (1 query)   │ ◄─── Optimized with indexes
│    ~100ms                       │
│                                 │
│ 2. Calculate priorities (JS)   │ ◄─── Client-side calculation
│    ~50ms                        │
│                                 │
│ 3. Select words (JS)            │ ◄─── Efficient sorting
│    ~20ms                        │
│                                 │
│ 4. Insert package (1 query)    │ ◄─── Single transaction
│    ~30ms                        │
│                                 │
│ 5. Insert words (batch)        │ ◄─── Batch insert
│    ~100ms                       │
│                                 │
│ Total: ~300ms                   │ ✓ Under 500ms target
└─────────────────────────────────┘

Card Review:
┌─────────────────────────────────┐
│ 1. User clicks response         │
│    ~0ms                         │
│                                 │
│ 2. Update progress (3 queries) │ ◄─── Could optimize
│    ~150ms                       │      (batch update)
│                                 │
│ 3. Re-fetch data (optional)    │ ◄─── Optimistic UI
│    ~50ms                        │      can skip this
│                                 │
│ 4. Show next card              │
│    ~0ms                         │
│                                 │
│ Total: ~200ms                   │ ✓ Acceptable
└─────────────────────────────────┘
```

---

## SECURITY & PERMISSIONS

```
Row Level Security (RLS) Policies:

user_packages:
┌────────────────────────────────────────┐
│ SELECT: WHERE user_id = auth.uid()     │
│ INSERT: WHERE user_id = auth.uid()     │
│ UPDATE: WHERE user_id = auth.uid()     │
│ DELETE: WHERE user_id = auth.uid()     │
└────────────────────────────────────────┘
        â†"
    Ensures users can only access
    their own packages

package_words:
┌────────────────────────────────────────┐
│ SELECT: WHERE package.user_id = auth.uid() │
│ UPDATE: WHERE package.user_id = auth.uid() │
└────────────────────────────────────────┘
        â†"
    Ensures users can only access
    words from their own packages

user_badges:
┌────────────────────────────────────────┐
│ SELECT: WHERE user_id = auth.uid()     │
│ INSERT: WHERE user_id = auth.uid()     │
└────────────────────────────────────────┘
        â†"
    Ensures users can only view/earn
    their own badges
```

---

## TESTING ARCHITECTURE

```
Unit Tests (Jest)
├── packageCalculations.test.js
│   ├── PACKAGE_TYPES constant
│   ├── selectWordsForPackage()
│   ├── isPackageExpired()
│   ├── calculatePackageProgress()
│   └── getRecommendedPackage()
│
└── badgeCalculations.test.js
    ├── BADGE_DEFINITIONS constant
    ├── checkBadgesOnPackageComplete()
    └── checkStreakBadges()

Integration Tests (Cypress)
├── package-creation.spec.js
│   └── End-to-end package creation flow
│
├── package-review.spec.js
│   └── Complete review session flow
│
├── package-completion.spec.js
│   └── Package completion and badges
│
└── package-expiration.spec.js
    └── Expiration handling

Manual Testing
├── Browser compatibility
├── Mobile responsiveness
├── Accessibility (screen readers)
└── User acceptance testing
```

---

## DEPLOYMENT ARCHITECTURE

```
Development Environment
       │
       â"‚ Test migrations
       â"‚ Test features
       â"‚ Run test suite
       â"‚
       â"¼
Staging Environment
       │
       â"‚ Deploy code
       â"‚ Run migrations
       â"‚ UAT testing
       â"‚ Performance testing
       â"‚
       â"¼
Production Environment
       │
       â"‚ Backup database
       â"‚ Run migrations
       â"‚ Deploy code
       â"‚ Monitor closely
       â"‚
       â"¼
Post-Deployment
       │
       â"‚ 24-hour monitoring
       â"‚ Error tracking
       â"‚ Performance metrics
       â"‚ User feedback
       â"‚
       â"¼
   ðŸŽ‰ Success!
```

---

## FUTURE ENHANCEMENTS (Post-Phase 3)

```
Phase 4: Waypoint System
       │
       â"‚ Break packages into themed chunks
       â"‚ Learning trail visualization
       â"‚ Pause/resume between waypoints
       â"‚
       â"¼
Beyond Phase 4:
       │
       ├── XP & Leveling System
       │   └── Points-based progression
       │
       ├── Social Features
       │   └── Leaderboards, challenges
       │
       ├── Advanced Analytics
       │   └── Learning insights, trends
       │
       └── Content Expansion
           └── More books, languages
```

---

## CONCLUSION

This visual reference provides a high-level overview of Phase 3's architecture and data flows. Use it alongside the detailed implementation guide to understand how all the pieces fit together.

**Key Takeaways:**
- Package system builds on Phase 1 & 2 foundations
- Clear data flows from selection → review → completion
- Badge system rewards achievement
- All data secured with RLS policies
- Optimized for performance
- Well-tested at every level

---

**END OF SYSTEM ARCHITECTURE DIAGRAM**

*For detailed implementation, refer to PHASE_3_IMPLEMENTATION_GUIDE.md*
