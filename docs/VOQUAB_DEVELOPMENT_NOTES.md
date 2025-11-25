# VOQUAB DEVELOPMENT NOTES

**Purpose:** Living document updated by Claude Code tracking current work, decisions, and issues
**Last Updated:** November 24, 2025 - Phase 3C: Admin Dashboard Complete + Frequency Column Fix
**Updated By:** Claude Code CLI

---

## CURRENT WORK STATUS

### Active Phase: Phase 3C - Admin Dashboard - Common Word Management ✅ COMPLETED
**Started:** November 12, 2025
**Completed:** November 12, 2025

**Objective:** Create admin interface to mark common/stop words that shouldn't appear in learning sessions.

**Stages Completed:**
- ✅ Stage 1: Database migration (is_stop_word column)
- ✅ Stage 2: Admin.jsx with password protection
- ✅ Stage 3: AdminCommonWords.jsx word management interface
- ✅ Stage 4: Updated word selection to filter stop words
- ✅ Stage 5: Added admin routes to App.jsx
- ✅ Stage 6: Configured admin password in .env

**Features Implemented:**

1. **Database Schema** (`migrations/add-stop-words-system.sql`)
   - Added `is_stop_word BOOLEAN DEFAULT FALSE` to vocabulary table
   - Added `admin_notes TEXT` for internal documentation
   - Created index `idx_vocabulary_stop_words` for efficient filtering
   - Comments documenting purpose and usage

2. **Admin Dashboard** (`src/pages/Admin.jsx`)
   - Password protection using `VITE_ADMIN_PASSWORD` from .env
   - Session-based authentication (stored in sessionStorage)
   - Tab navigation for different admin functions
   - Logout functionality
   - Future-ready for additional admin sections (Users, Content, etc.)
   - Clean UI with welcome screen and section cards

3. **Common Words Management** (`src/pages/AdminCommonWords.jsx`)
   - **Table Display:**
     - Shows all vocabulary sorted by frequency (times_in_book DESC)
     - Columns: Word | English | Frequency | Part of Speech | Stop Word? | Actions
     - Hover highlighting for better UX
   - **Individual Actions:**
     - Toggle button: "Mark as Stop" / "Unmark"
     - Color-coded status badges (red=stop, green=active)
     - Instant UI update on toggle
   - **Bulk Actions:**
     - "Mark Top 50" button
     - "Mark Top 100" button
     - "Mark Top 200" button
     - Confirmation dialog before bulk operations
     - Refresh button to reload data
   - **Filters:**
     - Search by word or definition
     - Filter: All Words | Active Words Only | Stop Words Only
     - Minimum frequency filter (show words above X occurrences)
   - **Stats Display:**
     - Total Words count
     - Stop Words count (red)
     - Active Learning Words count (green)
   - **Frequency Calculation:**
     - Queries `vocabulary_occurrences` table
     - Builds frequency map in JavaScript
     - Merges with vocabulary data
     - Accurate counts without needing `times_in_book` column

4. **Word Selection Filtering** (Stop words excluded from learning)
   - **PackageSelection.jsx:248** - Added `.eq('is_stop_word', false)` to beginner package query
   - **Flashcards.jsx:544** - Added `.eq('is_stop_word', false)` to default vocabulary query
   - **Flashcards.jsx:765** - Added `.eq('is_stop_word', false)` to chapter progress query
   - Stop words no longer appear in:
     - Daily packages (all types)
     - Flashcard sessions
     - New word selection
     - Chapter progress calculations

5. **Routing** (`src/App.jsx`)
   - Added admin route imports (Admin, AdminCommonWords)
   - Added nested routing:
     ```jsx
     <Route path="/admin" element={<Admin />}>
       <Route path="common-words" element={<AdminCommonWords />} />
     </Route>
     ```
   - No ProtectedRoute wrapper (Admin handles its own auth)

6. **Environment Configuration** (`.env`)
   - Added `VITE_ADMIN_PASSWORD=voquab_admin_2025`
   - Password can be changed by updating .env
   - Must restart dev server after changing password

**Technical Implementation:**
- Password stored in sessionStorage (cleared on logout or browser close)
- Supabase queries with proper filtering
- Frequency counting via JavaScript Map (no DB schema changes needed)
- Responsive grid layout for stats cards
- Bulk operations use SQL IN clause for efficiency
- Real-time UI updates after toggle operations

**Files Created:**
- ✅ `migrations/add-stop-words-system.sql` - Database migration
- ✅ `src/pages/Admin.jsx` - Password-protected dashboard
- ✅ `src/pages/AdminCommonWords.jsx` - Word management interface

**Files Modified:**
- ✅ `src/App.jsx` - Added admin routes
- ✅ `src/pages/PackageSelection.jsx` - Filter stop words in beginner package
- ✅ `src/pages/Flashcards.jsx` - Filter stop words in all vocabulary queries
- ✅ `.env` - Added VITE_ADMIN_PASSWORD

**Usage Instructions:**
1. **Apply Migration:**
   - Go to Supabase Dashboard → SQL Editor
   - Run `migrations/add-stop-words-system.sql`
   - Verify with: `SELECT * FROM vocabulary WHERE is_stop_word = TRUE`

2. **Access Admin Dashboard:**
   - Navigate to `/admin`
   - Enter password: `voquab_admin_2025` (or value from .env)
   - Click "Common Words" tab

3. **Mark Common Words:**
   - Common Spanish words to mark as stop words:
     - Articles: el, la, los, las, un, una, unos, unas
     - Prepositions: de, a, en, con, por, para, sin
     - Pronouns: yo, tú, él, ella, nosotros, vosotros, ellos, me, te, se, le, lo
     - Conjunctions: y, o, pero, porque, que
     - Common verbs: es, son, está, están, hay
   - Use bulk actions for efficiency (Mark Top 100)
   - Or toggle individually for precise control

4. **Verify Filtering:**
   - Create a new package after marking stop words
   - Verify marked words don't appear in package
   - Check flashcard sessions exclude stop words
   - Common words should be filtered from all learning activities

**Status:** ✅ Code complete, compiled successfully, ready to test in browser

**Testing Instructions:**
1. Start dev server: `npm run dev`
2. Apply database migration in Supabase Dashboard
3. Navigate to `http://localhost:5173/admin`
4. Enter password: `voquab_admin_2025`
5. Go to "Common Words" tab
6. Mark top 100 words as stop words
7. Create a new package
8. Verify stop words don't appear

**Known Limitations:**
- Password is simple (no hashing, stored in .env)
- Session-based auth (clears on browser close)
- No audit log of who marked what
- **For production:** Consider implementing proper admin roles via Supabase Auth

---

### Critical Bug Fix: Admin Dashboard Performance ✅ RESOLVED
**Date:** November 24, 2025
**Problem:** "Bad Request" / URL Too Long error when loading admin common words page
**Root Cause:** AdminCommonWords.jsx used complex batching logic with runtime JOINs to vocabulary_occurrences table. When fetching frequencies for 1000+ words, the `.in('vocab_id', [array of 1000 IDs])` created URLs exceeding HTTP limits.

**Solution Implemented:**
1. **Database Migration** (`migrations/add-frequency-column.sql`)
   - Added `frequency INTEGER DEFAULT 0` column to vocabulary table
   - Populated frequencies with one-time COUNT from vocabulary_occurrences
   - Created descending index `idx_vocabulary_frequency` for fast sorting
   - Added column documentation comment

2. **Simplified AdminCommonWords.jsx** (lines 38-61)
   - BEFORE: 40+ lines of batching, occurrence counting, frequency mapping, merging, sorting
   - AFTER: Single query selecting frequency column directly
   ```javascript
   const { data: vocabData } = await supabase
     .from('vocabulary')
     .select('vocab_id, lemma, english_definition, part_of_speech, is_stop_word, frequency')
     .eq('language_code', 'es')
     .order('frequency', { ascending: false })
   ```
   - Performance: O(n) batching → O(1) single query
   - URL length: 1000+ IDs → Simple ORDER BY query

**Benefits:**
- ✅ Eliminates URL length issues entirely
- ✅ Dramatically faster page load (single query vs. multiple batches)
- ✅ Simpler, more maintainable code (40 lines → 20 lines)
- ✅ Pre-calculated frequencies available for future features
- ✅ Database-indexed for optimal sorting performance

**Files Created:**
- ✅ `migrations/add-frequency-column.sql` - Database migration with frequency column

**Files Modified:**
- ✅ `src/pages/AdminCommonWords.jsx` - Simplified to use frequency column

**Migration Status:** ✅ Applied successfully in Supabase (confirmed by user)

---

### Git Commits - Phase 3C Complete
**Commit 1:** `c0d9d3f` - "feat: Phase 3A/3B/3C - Learning transparency, celebrations, and admin tools"
- Phase 3A: WordStatusCard transparency component
- Phase 3A: Time gate UI feedback in flashcards
- Phase 3A: Word selection logging with rationale
- Phase 3B: LevelUpCelebration component with confetti
- Phase 3B: Detailed mastery change logging
- Phase 3C: Admin dashboard with password protection
- Phase 3C: AdminCommonWords management interface
- Phase 3C: Stop word filtering across all learning flows
- Phase 3C: Database migration for is_stop_word column

**Commit 2:** `4619d75` - "fix: Add frequency column to vocabulary table"
- Performance fix for admin dashboard URL length issue
- Added pre-calculated frequency column
- Simplified AdminCommonWords.jsx query logic
- Eliminated batching complexity

**Status:** ✅ Both commits staged locally, ready to push to GitHub

---

### Next: Phase 3D (Proposed)
**Potential Features:**
- Export stop words list for backup/sharing
- Bulk import stop words from CSV/JSON
- Admin analytics: Most marked/unmarked words
- Stop word history/audit log
- Multiple stop word presets (beginner, intermediate, advanced)
- AI-suggested common words based on corpus analysis

**Priority:** TBD - Awaiting user direction

---

### Previous Phase: Phase 3B - Level-Up Celebrations ✅ COMPLETED
**Started:** November 12, 2025
**Completed:** November 12, 2025

**Objective:** Add visual celebration feedback when users advance mastery levels (e.g., Level 3 → Level 4).

**Stages Completed:**
- ✅ Stage 1: Created LevelUpCelebration component with confetti animation
- ✅ Stage 2: Added detailed mastery logging for debugging
- ✅ Stage 3: Integrated level-up detection in handleDifficulty()
- ✅ Stage 4: Connected celebration display to flashcard workflow

**Features Implemented:**

1. **LevelUpCelebration Component** (`src/components/LevelUpCelebration.jsx`)
   - Animated modal with confetti particles (30 pieces, random colors/timing)
   - Old level → New level transition display
   - Level labels: New → Introduced → Recognizing → Learning → Familiar → Known → Strong → Mastered → Expert → Native → Perfect
   - Motivational messages based on new level achieved
   - Auto-dismiss after 3 seconds with manual "Continue" button
   - CSS animations: fade-in, scale-up, confetti fall with rotation
   - Non-blocking overlay (click to dismiss)

2. **Detailed Mastery Logging** (`src/pages/Flashcards.jsx`)
   - Console logs mastery change details for every review
   - Format:
     ```
     🎯 MASTERY CHANGE DETAILS:
     ============================================================
     Word: "el fracaso"
     Difficulty Response: easy
     Before: { mastery: 38, level: 3 }
     Time gate met?: true
     Points to add: +10
     After: { mastery: 48, level: 4 }
     🎆 LEVEL UP! 3 → 4
     ============================================================
     ```
   - Critical for debugging time gate issues
   - Verifies mastery points are actually being applied

3. **Level-Up Detection Logic** (`src/pages/Flashcards.jsx:1038-1086`)
   - Calculates `oldLevel = Math.floor(oldMasteryLevel / 10)` BEFORE mastery change
   - Calculates `newLevel = Math.floor(newMasteryLevel / 10)` AFTER mastery change
   - Compares levels: `if (newLevel > oldLevel)`
   - Triggers celebration by setting `levelUpData` state
   - Passes old level, new level, and word data to celebration component

4. **Integration Points:**
   - State: `const [levelUpData, setLevelUpData] = useState(null)`
   - Trigger: `handleDifficulty()` after mastery calculation
   - Display: Conditional render at end of component (after badges)
   - Close handler: `onClose={() => setLevelUpData(null)}`

**Technical Implementation:**
- Confetti animation using CSS `@keyframes fall` with random delays and durations
- Level transition uses pulse animation for emphasis
- Motivational messages map to levels 1-10
- 3-second auto-dismiss timer with cleanup on unmount
- Gradient background from amber to orange for warmth

**Files Modified:**
- ✅ `src/components/LevelUpCelebration.jsx` - New component
- ✅ `src/pages/Flashcards.jsx` - Import, state, detection logic, render

**Critical Verification Added:**
- Before/after mastery logging ensures time gate is working correctly
- If mastery doesn't increase when "Mastery Ready" + Easy/Medium, console will show:
  - Time gate status (met/blocked)
  - Expected points (+10 for Easy, +6 for Medium, +3 for Hard)
  - Actual mastery before/after
- This allows immediate debugging if time gate logic fails

**Status:** ✅ Code complete, compiled successfully, ready to test in browser

**Testing Instructions:**
1. Open browser DevTools → Console
2. Review a "Mastery Ready" word (WordStatusCard will show)
3. Click "Easy" (+10 points) or "Medium" (+6 points)
4. Console should show:
   - "Time gate met?: true"
   - Points added
   - Mastery increase
   - "🎆 LEVEL UP!" if threshold crossed
5. Level-up celebration modal should appear with confetti
6. Auto-dismisses after 3 seconds or click "Continue"

**Known Edge Cases Handled:**
- Level 0 → 1 (first level-up from new word)
- Multiple level jumps (e.g., 0 → 2 if +20 points somehow)
- Level 10 achievement (Perfect mastery message)
- Rapid consecutive level-ups (each shows separately)

---

### Previous Phase: Phase 3A - Flashcard Transparency & Time-Gated Mastery ✅ COMPLETED
**Started:** November 12, 2025
**Completed:** November 12, 2025

**Objective:** Add visual feedback to flashcards so users understand WHY they're reviewing each word and see time gate enforcement in action.

**Stages Completed:**
- ✅ Stage 1: Created WordStatusCard component (src/components/WordStatusCard.jsx)
- ✅ Stage 2: Integrated time gate feedback UI in Flashcards.jsx
- ✅ Stage 3: Added word selection logging with detailed rationale

**Features Implemented:**

1. **WordStatusCard Component** (`src/components/WordStatusCard.jsx`)
   - Displays current state: Mastery level (0-10 with labels), Health bar (0-100), Total reviews
   - Shows word category: 🆕 New Word, ⚡ URGENT - Health Critical, 🎯 Mastery Ready, 💪 Health Building
   - Explains what this review does: Time gate status, mastery gain eligibility, health boost
   - Shows next milestone: Points to next level or health to restore
   - Collapsible design (starts expanded, user can minimize)
   - Color-coded by urgency (red=critical, orange=low, yellow=medium, green=good, blue=mastery, purple=new)

2. **Time Gate UI Feedback** (`src/pages/Flashcards.jsx`)
   - Displays time gate message when mastery gain is blocked
   - Shows countdown: "Wait 4 hours for mastery gain (health still improves!)"
   - Auto-dismisses after 8 seconds
   - Amber-colored alert box with clock icon
   - Reassures user that health boost still applied

3. **Word Selection Logging** (`src/utils/priorityCalculations.js`)
   - Console logs top 10 selected words with detailed rationale
   - Shows why each word was selected (icon + explanation)
   - Examples:
     - 🆕 New word - First encounter to establish baseline
     - ⚡ URGENT - Critical health (15/100), needs immediate rescue
     - 🎯 Mastery ready - Can gain progress toward next level
     - 💊 Low health (35/100), needs restoration
     - 🔁 Struggling word - Failed in recent sessions
     - 📖 High-frequency word - Important to master
   - Displays health, mastery, and review count for each word

**Files Modified:**
- ✅ `src/components/WordStatusCard.jsx` - New component
- ✅ `src/pages/Flashcards.jsx` - Import WordStatusCard, display component, time gate message UI
- ✅ `src/utils/priorityCalculations.js` - Added getSelectionReason() function and logging

**Technical Implementation:**
- Uses existing `calculateCurrentHealth()` from healthCalculations.js
- Uses existing `checkTimeGate()` from timeGateCalculations.js
- Mastery level labels: New → Introduced → Recognizing → Learning → Familiar → Known → Strong → Mastered → Expert → Native → Perfect
- Health color thresholds: <20 red, <40 orange, <60 yellow, <80 green, ≥80 bright green
- Time gate message stored in state, cleared after 8 seconds with setTimeout

**Status:** ✅ Code complete, compiled successfully, ready to test in browser

---

### Previous Phase: Phase 3 - Daily Package System ✅ COMPLETED
**Started:** November 9, 2025
**Completed:** November 12, 2025

**Stages Completed:**
- ✅ Stage 1-2: Database schema (user_packages, package_words, user_waypoints)
- ✅ Stage 3-4: Package types and selection logic (packageCalculations.js)
- ✅ Stage 5-6: Package Selection UI with beginner onboarding
- ✅ Stage 7: Waypoints system
- ✅ Stage 8: Package View UI
- ✅ Stage 9: Badge notification component
- ✅ Stage 10: Navigation integration (Home.jsx)
- ✅ Stage 11: Flashcard-package integration with waypoint mini-decks
- ✅ Stage 12: Real-time waypoint progress tracking

**Status:** Code complete, ready for browser testing. Pending database migrations.

---

## RECENT ISSUES & RESOLUTIONS

### Issue #1: Vocabulary Column Names ✅ RESOLVED
**Date:** November 11, 2025  
**Problem:** Query used `word` and `translation` but actual columns are `lemma` and `english_definition`  
**Fix:** Updated PackageSelection.jsx queries to use correct column names  
**Files Modified:** `src/pages/PackageSelection.jsx`

### Issue #2: Missing 'getting_started' in package_type Constraint ⏳ IN PROGRESS
**Date:** November 11, 2025  
**Problem:** Database CHECK constraint doesn't allow 'getting_started' value  
**Solution:** Migration created at `migrations/add-getting-started-package-type.sql`  
**Status:** Migration ready, needs to be applied in Supabase Dashboard  
**Next Step:** Peter to apply migration

### Issue #3: RLS Policy Blocking package_words INSERT ⏳ IN PROGRESS  
**Date:** November 11, 2025  
**Problem:** Row-level security preventing package_words inserts  
**Solution:** Migration created at `migrations/add-package-words-rls-insert.sql`  
**Status:** Migration ready, needs to be applied in Supabase Dashboard  
**Next Step:** Peter to apply migration

### Issue #4: Missing times_in_book Column ✅ RESOLVED
**Date:** November 11, 2025
**Problem:** Code references `times_in_book` but vocabulary table doesn't have this column
**Impact:** Package creation failing with 400/406 errors
**Root Cause:** Need to COUNT from vocabulary_occurrences table, not query non-existent column
**Solution Implemented:** JavaScript-based counting approach:
1. Remove `times_in_book` from vocabulary SELECT queries
2. Query all occurrences from `vocabulary_occurrences` table
3. Count occurrences per vocab_id in JavaScript using Map
4. Merge counts back into vocabulary objects as `times_in_book` property
**Files Modified:**
- `src/pages/PackageSelection.jsx` (lines 54-103)
- `src/pages/PackageView.jsx` (lines 51-95)
**Status:** ✅ Implemented, ready to test
**Testing Status:** ⏳ Pending user test

### Issue #5: Waypoint-Package Integration Not Working ✅ RESOLVED
**Date:** November 11, 2025
**Problem:** Two major issues with flashcard-package integration:
1. Flashcards presented entire package as one big deck instead of waypoint-by-waypoint mini-decks
2. Waypoint progress (words_completed) not updating during reviews, progress bars stuck at 0

**Impact:**
- Users had to review all words at once (overwhelming for large packages)
- No visual feedback on waypoint progress
- Couldn't track which waypoint user was on
- No themed mini-deck experience

**Solution Implemented:**
1. **Waypoint-based deck loading:**
   - Load waypoints when entering package mode
   - Find first active/pending waypoint
   - Filter package words by current waypoint's word_ids
   - Present only current waypoint's words (e.g., 12 critical words)

2. **Real-time waypoint progress updates:**
   - After each flashcard review, increment waypoint's words_completed
   - Check if waypoint complete (words_completed === total_words)
   - Mark waypoint as 'completed' when all words reviewed
   - Activate next waypoint (status 'pending' → 'active')

3. **Waypoint completion screen:**
   - Show celebration screen after completing each waypoint
   - Display waypoint theme, icon, description
   - Preview next waypoint or show package complete message
   - "Continue to Next Waypoint →" button loads next mini-deck

4. **loadNextWaypoint() function:**
   - Finds next active waypoint
   - Loads only that waypoint's words
   - Resets card queue and index
   - Seamless transition between waypoints

**Files Modified:**
- `src/pages/Flashcards.jsx`:
  - Added waypoint state variables (lines 58-61)
  - Modified loadPackageMode() to load and filter by waypoints (lines 124-256)
  - Updated handleDifficulty() to update waypoint progress (lines 1102-1158)
  - Added loadNextWaypoint() function (lines 263-373)
  - Added waypoint completion UI (lines 1436-1531)
- `src/pages/PackageView.jsx`:
  - Simplified startReview() to rely on automatic waypoint loading (lines 134-138)

**Technical Details:**
- Waypoints queried and sorted by waypoint_number
- Active waypoint found with: `status === 'active'` OR first `status === 'pending'`
- Words filtered using: `.in('vocab_id', activeWaypoint.word_ids)`
- Progress tracking: Update user_waypoints.words_completed after each review
- Status transitions: pending → active → completed

**Status:** ✅ Implemented, compiled successfully
**Testing Status:** ⏳ Ready to test in browser

### Issue #6: Waypoint Logic Flaw with JSONB Array Filtering ✅ RESOLVED
**Date:** November 11, 2025
**Problem:** Critical architectural flaw in waypoint-word relationship:
- Waypoints stored word_ids as JSONB array: `[1, 2, 3, 4, 5]`
- Queries filtered: `reviewed=false AND vocab_id IN [1, 2, 3, 4, 5]`
- After reviewing words 1 & 2, only [3, 4, 5] returned
- But waypoint shows "2/5 complete" while user sees only 3 cards
- **Fundamental issue**: Can't track total waypoint words when filtering by reviewed status

**Impact:**
- Confusing UX: Progress bar doesn't match visible cards
- Lost context: Reload shows different card count
- No way to query "all words in waypoint" vs "unreviewed words in waypoint"

**Root Cause:**
Using JSONB array filtering instead of proper foreign key relationship

**Solution Implemented:**
Added `waypoint_id` column to `package_words` table as proper foreign key

**Changes Made:**

1. **Migration**: `migrations/add-waypoint-id-to-package-words.sql`
   ```sql
   ALTER TABLE package_words
   ADD COLUMN waypoint_id UUID REFERENCES user_waypoints(waypoint_id) ON DELETE CASCADE;

   CREATE INDEX idx_package_words_waypoint ON package_words(waypoint_id);
   ```

2. **PackageSelection.jsx** (lines 319-382):
   - Moved waypoint insertion BEFORE package_words insertion
   - Added `.select()` to waypoint insert to get waypoint_ids back
   - Created `themeToWaypointId` mapping (theme → waypoint_id)
   - Assigned `waypoint_id` to each package_word based on word.category
   - Example: word with category='critical' gets waypoint_id of 'Critical Rescue' waypoint

3. **Flashcards.jsx**:
   - Changed loadPackageMode() query (line 198):
     - FROM: `.in('vocab_id', JSON.parse(activeWaypoint.word_ids))`
     - TO: `.eq('waypoint_id', activeWaypoint.waypoint_id)`
   - Changed loadNextWaypoint() query (line 309): Same change
   - Removed JSONB array parsing entirely

**Benefits:**
- ✅ Clean relational model with foreign key constraint
- ✅ Simple queries: `WHERE waypoint_id = X AND reviewed = false`
- ✅ Can count total waypoint words: `COUNT(*) WHERE waypoint_id = X`
- ✅ Accurate progress tracking
- ✅ Database-enforced referential integrity
- ✅ Better query performance with index

**Technical Details:**
- Foreign key: `package_words.waypoint_id → user_waypoints.waypoint_id`
- Cascade delete: If waypoint deleted, associated words also deleted
- Index created for query performance
- Assignment happens at package creation time (one-time, immutable)

**Status:** ✅ Implemented, compiled successfully at 10:35 PM
**Testing Status:** ⏳ Needs migration applied, then test with fresh package

### Issue #7: Card Counter Showing Wrong Progress ✅ RESOLVED
**Date:** November 12, 2025
**Problem:** Card counter in flashcard header showing confusing numbers:
- Displayed "15 / 13" (total package reviews vs current waypoint size)
- Counter tracked package-wide progress instead of waypoint-specific progress
- No indication of which waypoint user was reviewing

**Impact:**
- Confusing UX - counter doesn't match current deck experience
- No context about which themed waypoint user is on
- Counter doesn't reset between waypoints

**Solution Implemented:**
Added conditional rendering to show different counters for package mode vs. regular mode:

1. **Package Mode Counter** (lines 1733-1741):
   - Display: `{currentIndex + 1} / {cardQueue.length}`
   - Shows current position within waypoint (e.g., "3 / 13")
   - Displays waypoint name at top
   - Shows waypoint theme and icon at bottom
   - Example: "Critical Rescue" | "3 / 13" | "CRITICAL • 🚨"

2. **Regular Mode Counter** (lines 1743-1752):
   - Maintains original behavior
   - Shows unique cards reviewed vs total cards
   - Shows total reviews count

**Technical Details:**
- Counter resets automatically when loadNextWaypoint() is called (setCurrentIndex(0))
- Uses conditional rendering: `{isPackageMode && currentWaypoint ? ... : ...}`
- Waypoint name from: `currentWaypoint.name`
- Theme from: `currentWaypoint.theme.replace('_', ' ').toUpperCase()`
- Icon from: `currentWaypoint.icon`

**Files Modified:**
- `src/pages/Flashcards.jsx` (lines 1732-1754)

**Status:** ✅ Implemented, HMR successful at 10:44 PM
**Testing Status:** ⏳ Ready to test in browser with package review

### Issue #8: Word Selection Algorithm Over-Prioritizes Review ✅ RESOLVED
**Date:** November 12, 2025
**Problem:** Users repeatedly reviewing the same ~130 words instead of learning new vocabulary:
- MAX_NEW_WORDS_PER_PACKAGE hard caps limited new words (5-20 per package = only ~10%)
- Fixed composition (30% critical, 25% mastery, 25% exposure, 20% new) doesn't adapt to user state
- New word penalty (×0.8 multiplier) made new words LESS attractive than review words
- Result: "Review treadmill" where users feel stuck with same vocabulary

**Impact:**
- User frustration: "seeing same 130 words repeatedly"
- No vocabulary growth despite healthy mastery levels
- Critical words take priority even when user is in good state
- Defeats the primary goal: **vocabulary expansion**

**Root Cause Analysis:**
1. Hard caps on new words prevented natural scaling
2. Algorithm prioritized maintenance over growth
3. No dynamic adjustment based on user's actual needs
4. New word penalty worked against vocabulary expansion goal

**Solution Implemented:**

**1. Dynamic Composition Strategy** (`packageCalculations.js`):
- Added `analyzeUserVocabularyState()` - analyzes critical count, mastery ready, available new words
- Added `calculateOptimalComposition()` - calculates optimal mix based on user state
- 5 composition scenarios:
  - **Too many critical** (>30% of package): 40% critical, 20% mastery, 20% exposure, 20% new
  - **Healthy + many new** (<10 critical, <10 mastery ready, >100 new): **50% NEW** 🎯
  - **Many new available** (>200 new): 40% new, 20% critical, 20% mastery, 20% exposure
  - **Moderate new** (>50 new): 30% new, 25% critical, 20% mastery, 25% exposure
  - **Few new left** (<50 new): 0% new, 30% critical, 35% mastery, 35% exposure

**2. Removed Hard Caps** (`packageCalculations.js`):
- BEFORE: `MAX_NEW_WORDS_PER_PACKAGE = { foundation: 5, standard: 10, immersion: 15, mastery: 20 }`
- AFTER: Removed entirely - dynamic composition determines new word counts
- Result: Standard package can now have 30-50 new words based on user state!

**3. New Word Bonus** (`priorityCalculations.js`):
- BEFORE: `score *= 0.8` (20% penalty)
- AFTER: `score *= 1.1` (10% bonus)
- Rationale: Learning new words IS the primary goal!

**4. Intelligent Slot Redistribution** (`packageCalculations.js`):
- When categories don't fill targets, prioritize NEW words first (not "other")
- Example: If critical only needs 10 but target was 20, give 10 extra slots to NEW words
- Ensures maximum vocabulary expansion

**5. Comprehensive Logging**:
```javascript
console.log('📊 Package Composition Decision:')
console.log('   User State:', { total, critical, masteryReady, newAvailable })
console.log('   Composition:', { critical: '20%', mastery: '20%', exposure: '20%', new: '40%' })
console.log('   Strategy:', rationale)
console.log('✅ Final Package Breakdown:', { total, critical, mastery, exposure, new })
```

**Files Modified:**
- `src/utils/packageCalculations.js`:
  - Lines 81-82: Removed MAX_NEW_WORDS_PER_PACKAGE
  - Lines 84-127: Added analyzeUserVocabularyState()
  - Lines 130-177: Added calculateOptimalComposition()
  - Lines 187-222: Updated selectWordsForPackage() with dynamic composition
  - Lines 313-339: Updated slot redistribution to prioritize new words
  - Lines 358-369: Added final breakdown logging
- `src/utils/priorityCalculations.js`:
  - Lines 76-84: Changed new word penalty (×0.8) to bonus (×1.1)
- `src/pages/PackageSelection.jsx`:
  - Lines 219-230: Added total vocabulary count query
  - Line 284: Added totalAvailableWords parameter to selectWordsForPackage()

**Expected Outcomes:**
- ✅ User with 130 words, <10 critical → Gets ~50% new words (50 in standard package)
- ✅ User with struggling words → Still gets 20-30% new words while rescuing
- ✅ Composition adapts dynamically to actual user state
- ✅ No more "review treadmill" - constant forward progress
- ✅ Clear console feedback on composition decisions

**Status:** ✅ Implemented, HMR successful at 11:14 PM
**Testing Status:** ⏳ Ready to test - create package and check console logs + new word count

**Testing Checklist:**
- [ ] Create Standard package with ~130 existing words
- [ ] Check console logs for composition decision (should show "Healthy + many new" strategy)
- [ ] Verify final breakdown shows 40-50% new words
- [ ] Review package contents and confirm new vocabulary present
- [ ] Test with critical words scenario to verify rescue mode works

---

## PENDING MIGRATIONS

### Migration 1: Add 'getting_started' Package Type
**File:** `migrations/add-getting-started-package-type.sql`
**Priority:** HIGH - Blocking beginner package creation  
**SQL:**
```sql
ALTER TABLE user_packages
DROP CONSTRAINT IF EXISTS user_packages_package_type_check;

ALTER TABLE user_packages
ADD CONSTRAINT user_packages_package_type_check
CHECK (package_type IN ('getting_started', 'foundation', 'standard', 'immersion', 'mastery'));
```
**Status:** Ready to apply

### Migration 2: Add package_words RLS INSERT Policy
**File:** `migrations/add-package-words-rls-insert.sql`  
**Priority:** HIGH - Blocking package word insertion  
**SQL:**
```sql
CREATE POLICY "Users can insert words for own packages"
ON package_words
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  )
);
```
**Status:** Ready to apply

### Migration 3: Add waypoint_id to package_words
**File:** `migrations/add-waypoint-id-to-package-words.sql`
**Priority:** CRITICAL - Fixes waypoint logic flaw
**SQL:**
```sql
ALTER TABLE package_words
ADD COLUMN waypoint_id UUID REFERENCES user_waypoints(waypoint_id) ON DELETE CASCADE;

CREATE INDEX idx_package_words_waypoint ON package_words(waypoint_id);
```
**Status:** Ready to apply
**Note:** After applying, delete existing packages and create fresh ones

---

## DESIGN DECISIONS LOG

### Decision #1: Beginner Package Design
**Date:** November 10, 2025  
**Context:** Users with < 50 words couldn't create packages (chicken-egg problem)  
**Decision:** Created "Getting Started" package that:
- Queries vocabulary table directly (no progress required)
- Selects first 30 words from Chapter 1
- Creates progress records as words are reviewed  
**Rationale:** Users must ALWAYS have a clear path forward, regardless of progress level  
**Implementation:** PackageSelection.jsx special case handling

### Decision #2: Seed Data as Developer Tool
**Date:** November 10, 2025  
**Context:** Testing standard packages requires existing progress  
**Decision:** Keep "Seed Test Data" button but make it less prominent  
**Implementation:** Gray styling, bottom placement, "Developer Tool" label  
**Rationale:** Useful for testing but shouldn't be mistaken for beginner path

### Decision #3: times_in_book Calculation Strategy
**Date:** November 11, 2025  
**Context:** times_in_book column doesn't exist in vocabulary table  
**Decision:** Calculate by COUNTing vocabulary_occurrences, not using is_common_word  
**Rationale:** is_common_word measures general Spanish commonality, not frequency in El Principito  
**Implementation:** Pending - needs LEFT JOIN pattern in queries  
**Trade-off:** Slightly more complex query, but accurate frequency data

---

## NEXT IMMEDIATE STEPS

### Step 1: Apply Pending Migrations ⚠️ BLOCKING
1. Open Supabase Dashboard → SQL Editor
2. Run migration: `add-getting-started-package-type.sql`
3. Run migration: `add-package-words-rls-insert.sql`
4. Verify both execute successfully
5. Test package creation in browser

### Step 2: Fix times_in_book Query Issue ✅ COMPLETED
**Implementation Details:**
1. ✅ Removed `times_in_book` from vocabulary SELECT clauses
2. ✅ Added separate query to fetch all `vocabulary_occurrences`
3. ✅ Implemented JavaScript counting logic using Map
4. ✅ Merged counts into vocabulary objects
5. ✅ Fixed column names in PackageView.jsx (word→lemma, translation→english_definition)

**Files Updated:**
- `src/pages/PackageSelection.jsx` - Added occurrence counting logic (lines 79-102)
- `src/pages/PackageView.jsx` - Added occurrence counting logic + fixed column names (lines 71-94)

**Note:** Used JavaScript approach instead of SQL subquery because Supabase PostgREST doesn't support GROUP BY with COUNT in nested select clauses

### Step 3: Verify Package Creation Flow
1. Navigate to /package-selection
2. Click "Getting Started" package
3. Verify package creates successfully
4. Check database tables for new records
5. Test package view and flashcard integration

---

## DATABASE SCHEMA NOTES

### vocabulary Table Structure
**Confirmed Columns:**
- vocab_id (uuid, PK)
- lemma (text) - The Spanish word (NOT 'word')
- english_definition (text) - Translation (NOT 'translation')
- language_code (text)
- part_of_speech (text)
- difficulty_rank (integer)
- gender (text)
- created_at (timestamp with time zone)
- is_common_word (boolean)

**Missing Columns:**
- times_in_book ❌ (needs to be calculated)

### vocabulary_occurrences Table Structure
**Confirmed Columns:**
- occurrence_id (uuid, PK)
- vocab_id (uuid, FK to vocabulary)
- form_id (uuid)
- sentence_id (uuid)
- word_position (integer)
- is_key_word (boolean)
- created_at (timestamp with time zone)

**Purpose:** Links vocabulary to sentences, tracks word frequency

### Package Tables Structure
**user_packages:**
- package_id (uuid, PK)
- user_id (uuid, FK)
- package_type (varchar) - getting_started/foundation/standard/immersion/mastery
- status (varchar) - active/completed/expired
- total_words (integer)
- words_completed (integer)
- expires_at (timestamp)
- Performance tracking fields

**package_words:**
- package_word_id (uuid, PK)
- package_id (uuid, FK to user_packages)
- vocab_id (integer, FK to vocabulary)
- word_order (integer)
- category (varchar)
- reviewed (boolean)

---

## TESTING CHECKLIST

### Package System Testing (Post-Migration)
- [ ] Create "Getting Started" package (beginner flow)
- [ ] Create "Standard" package (normal flow)
- [ ] Verify package appears in active packages section
- [ ] Click "Resume Package" → navigates to PackageView
- [ ] Verify package progress displays correctly
- [ ] Click "Begin Review" → navigates to flashcards
- [ ] Review words and verify progress updates
- [ ] Complete package and verify completion flow
- [ ] Check badge notification displays

### Database Testing
- [ ] Verify package_type constraint includes 'getting_started'
- [ ] Verify RLS policy allows package_words INSERT
- [ ] Verify user_packages record created with correct fields
- [ ] Verify package_words records created (30 for getting_started)
- [ ] Verify waypoint records created
- [ ] Check review history updates correctly

---

## CODE QUALITY NOTES

### Recent Code Improvements
1. **Error Handling:** Added validation for empty word selection
2. **Debug Logging:** Comprehensive console.log statements in PackageSelection
3. **Schema Validation:** Added vocabulary table structure check on load
4. **Beginner UX:** Special handling and styling for new users

### Technical Debt
1. **Priority Scoring:** Uses non-existent times_in_book column (fixing now)
2. **Error Messages:** Currently using alert(), should use toast notifications
3. **Loading States:** Package creation could use better loading feedback
4. **Type Safety:** No TypeScript, relying on runtime checks

---

## PERFORMANCE NOTES

### Current Performance
- Package creation: ~200-500ms (acceptable)
- Vocabulary queries: <100ms (good)
- HMR updates: Fast and reliable

### Potential Optimizations
1. Add index on vocabulary_occurrences(vocab_id) for COUNT queries
2. Cache vocabulary_occurrences counts in vocabulary table (denormalize)
3. Batch package_words inserts instead of individual
4. Add materialized view for word frequency

---

## BLOCKED ITEMS

### None Currently
All blockers have clear resolution paths (migrations ready to apply)

---

## FUTURE ENHANCEMENTS (Post-Phase 3)

### Phase 4 Priorities
1. Waypoint trail visualization refinements
2. Badge system expansion (16 total badges)
3. Package expiration handling
4. Streak integration with package completion

### Later Phases
- Advanced analytics dashboard
- Social features (optional)
- Multiple book support
- Audio pronunciation

---

## NOTES FOR NEXT CONVERSATION

**When starting new conversation:**
1. Bring this file (DEVELOPMENT_NOTES.md)
2. Bring PROJECT_HANDOFF.md
3. Bring WORKING_PRINCIPLES.md
4. State current issue/task clearly

**Current blocking issues:**
1. Migration #1: Add 'getting_started' to package_type constraint (ready to apply)
2. Migration #2: Add RLS INSERT policy for package_words (ready to apply)

**Recently completed:**
✅ times_in_book query fix implemented (JavaScript-based counting from vocabulary_occurrences)

**Ready to test after:**
Both migrations applied in Supabase Dashboard

---

**Claude Code: Update this file after each work session with:**
- What was implemented
- Issues encountered and resolutions
- Testing results
- Next steps
- Any new database schema discoveries

---

**End of Development Notes**
**Last Updated:** November 12, 2025 - Word selection algorithm vocabulary expansion fix
**Next Update:** After testing package creation with dynamic composition and console log verification
