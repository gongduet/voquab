# 28_CHANGELOG.md

**Document Type:** LIVING DOCUMENT (Updated Continuously)
**Last Updated:** December 12, 2025
**Maintainer:** Peter + Claude

---

## ABOUT THIS DOCUMENT

This changelog tracks all significant changes to Voquab. It follows [Keep a Changelog](https://keepachangelog.com/) format.

**Categories:**
- **Added:** New features
- **Changed:** Changes to existing features
- **Deprecated:** Features being phased out
- **Removed:** Features that were removed
- **Fixed:** Bug fixes
- **Security:** Security improvements

---

## [Unreleased]

### Foundation Phase (Current)
Working on final polish and testing before MVP launch.

#### In Progress
- Component library build-out
- End-to-end testing

---

## [2025-12-13] - Dashboard Overhaul & Phrase Integration

### Summary

Major dashboard rebuild with complete phrase integration into the learning system. Fixed critical data bugs, implemented new UI components, and established consistent patterns for lemma+phrase handling throughout the app.

### Critical Fixes

**Database Query Fixes**
- Replaced non-existent `introduced` column references with `reps >= 1` throughout codebase
- Fixed chapter progress to include phrases in both total and user progress counts
- Fixed chapter progress to exclude stop words from totals (was showing 175, now correctly shows 161 for Chapter 1)
- Chapter unlock now triggers correctly when previous chapter reaches 95%

**Phrase Progress Tracking**
- Phrase reviews now save correctly to `user_phrase_progress` table
- FSRS scheduling works for phrases (stability, difficulty, due_date)
- FloatingFeedback "+X days" animation shows for phrase reviews

**Session Building**
- Learn New sessions now include proportional mix of lemmas and phrases
- No more 20% threshold gate - phrases available as soon as chapter unlocks
- Review sessions combine due lemmas and due phrases, sorted by due_date

### New Dashboard Components

**ActivityHeatmap (Rewritten)**
- Fixed timezone issue (was showing Friday as Saturday)
- Colors scale based on user's `daily_goal_words` from `user_settings`
- Future dates shown with muted styling and dashed borders
- Added "X / 28 days" practiced stat
- Today cell has prominent ring + shadow highlight
- Uses local time consistently

**ReviewForecast (Rewritten)**
- Fixed bar rendering (was showing only numbers, no bars)
- Bars use pixel-based heights for reliable rendering
- Removed duplicate "Review X cards" button (use top Review button instead)
- Compact layout with no wasted whitespace
- Uses local time for day boundaries

**ChapterCarousel**
- Now shows combined lemma + phrase counts (e.g., "161/161" not "141/175")
- Chapter 1 correctly shows 100% when all lemmas and phrases reviewed
- Chapter 2 unlocks when Chapter 1 reaches 95%

### Files Modified

**Core Logic**
- `src/services/sessionBuilder.js` - Proportional phrase/lemma selection, `reps >= 1` fix
- `src/hooks/flashcard/useProgressTracking.js` - Phrase progress saving

**Dashboard**
- `src/pages/Dashboard.jsx` - All data fetching functions updated for phrases
- `src/components/dashboard/ActivityHeatmap.jsx` - Complete rewrite
- `src/components/dashboard/ReviewForecast.jsx` - Complete rewrite
- `src/components/dashboard/ChapterCarousel.jsx` - Updated to receive phrase-inclusive data

**Functions Updated in Dashboard.jsx**
- `fetchHeroStats()` - Includes phrase counts
- `fetchQuickActionStats()` - Includes phrase due counts
- `fetchChaptersProgress()` - Calculates lemma + phrase totals, excludes stop words
- `fetchActivityData()` - Queries both progress tables
- `fetchForecastData()` - Uses local time, includes phrases
- `fetchCategoryData()` - Includes phrase category
- `getUnlockedChapterNumbers()` - Uses `reps >= 1`, includes phrases in calculation
- `fetchUserSettings()` - New function for daily target

### Database Schema Notes

**No `introduced` column exists** in `user_lemma_progress` or `user_phrase_progress`.
Use `reps >= 1` as proxy for "card has been introduced/reviewed at least once".

**Key columns for progress tracking:**
- `reps` - Number of reviews (>= 1 means introduced)
- `stability` - FSRS stability value
- `due_date` - Next scheduled review
- `last_seen_at` - Timestamp of last review

### Lessons Learned

1. Always verify database schema before writing queries - the `introduced` column bug caused cascading failures
2. Use local time for user-facing date displays, UTC for database queries
3. Pixel-based heights more reliable than percentages in flex containers
4. When combining data from two tables (lemmas + phrases), update ALL related queries consistently

---

## [2025-12-13] - FSRS Algorithm Implementation & Phrases Integration

### 🚀 Major Features

#### FSRS Algorithm Implemented
Replaced custom mastery/health system with research-backed FSRS (Free Spaced Repetition Scheduler).

**Benefits:**
- 20-30% fewer reviews for same retention (research-proven)
- Uses ts-fsrs library with default FSRS-6 parameters
- 8 database columns instead of previous 14 (simplified architecture)
- Stability-based intervals (0.5 days to 365+ days)
- Difficulty adaptation (1-10 scale)
- Four FSRS states: New, Learning, Review, Relearning

**New FSRS Columns:**
- `stability` (REAL) - Days until 90% recall probability
- `difficulty` (REAL) - Item complexity 1-10
- `due_date` (TIMESTAMPTZ) - When card should be reviewed
- `fsrs_state` (SMALLINT) - 0=New, 1=Learning, 2=Review, 3=Relearning
- `reps` (INTEGER) - Total repetitions
- `lapses` (INTEGER) - Times failed
- `last_seen_at` (TIMESTAMPTZ) - Last exposure (review or oversampling)

#### Phrases Integration
Multi-word expressions now appear in flashcard sessions.

**Features:**
- Phrases introduced after 20% of chapter lemmas learned
- 80/20 lemma-to-phrase ratio in sessions (12 lemmas, 3 phrases per 15-card deck)
- Separate tracking in `user_phrase_progress` table
- Same FSRS scheduling as lemmas
- Purple "Phrase" badge for visual distinction
- Links: phrases → phrase_occurrences → sentences

#### Exposure Insurance
Oversampling prevents stable words from being forgotten.

**Logic:**
- High-activity users (100+ reviews/day): 10 exposure cards per session
- Medium-activity (50-99 reviews/day): 5 exposure cards
- Low-activity (<50 reviews/day): 2 exposure cards
- Stable cards (30+ day stability) resurface every 7-21 days
- Amber "Exposure" badge indicates oversampling

### 🐛 Bug Fixes
- Fixed word duplication in sentences ("el fracaso el fracaso" → "el fracaso")
- Fixed card counts not respecting user settings (was random 12-16, now respects setting)
- Fixed verb conjugations not bolding in sentences (now bolds actual form: "vivía" not "vivir")
- Fixed "Again" button incrementing progress incorrectly (now requeues without advancing)
- Fixed stop word filtering in session builder (was including stop words)

### 🎨 UI/UX Improvements
- Part of speech moved from front to back of card (full word instead of abbreviation)
- Spanish and English sentences both italic for consistency
- English word bolding removed (translations not always literal)
- Floating "+X days" animation replaces ugly yellow notification box
- "New Word" badge moved inside card (top-right corner)
- Badge styling matches header design (cleaner, more subtle)
- Mode toggle hidden during active session (prevents accidental exit)
- Sentence text increased to 18px (better readability)

### 🗄️ Database Changes
- Added 7 FSRS columns to `user_lemma_progress` and `user_phrase_progress`
- Created indexes for efficient due card queries and exposure filtering
- Added `get_chapter_progress()` SQL function for chapter unlocking
- Marked old columns as deprecated (`mastery_level`, `health`, `correct_reviews`)

### 📝 Migration
- Successfully migrated 73 existing user progress records to FSRS
- Preserved all user data (no loss of progress)
- Mapped mastery levels to stability values
- Calculated initial due dates from health values

### 🎯 Study Modes
- **Review Due:** FSRS-scheduled cards + exposure oversampling
- **Learn New:** Unintroduced lemmas + phrases (80/20 mix after 20% threshold)
- **Chapter Focus:** Planned for future (60% due + 20% exposure + 20% overflow)

### 📊 Session Composition
- Default: 25 cards per session (user-configurable in settings)
- Respects user preference from `user_settings` table
- Adapts based on available cards (won't show 25 if only 6 available)

### 🔧 Technical Improvements
- Installed framer-motion for smooth animations
- Created modular service architecture (`fsrsService.js`, `sessionBuilder.js`)
- Separated concerns: scheduling, session building, progress tracking
- Comprehensive error handling and edge case coverage

### 📚 New Documentation
- Created `FSRS_IMPLEMENTATION_SPEC.md` (comprehensive algorithm guide)
- Created `FLASHCARD_BUG_FIXES_SPEC.md` (detailed fix documentation)

### ⚠️ Breaking Changes
- Old `mastery_level` and `health` columns deprecated (will be removed in 30 days)
- Card selection algorithm completely replaced (FSRS-based)
- Progress tracking now uses FSRS state machine instead of custom logic

### 🔮 Future Improvements (Planned)
- Per-user FSRS parameter optimization (after 400+ reviews)
- Chapter Focus study mode implementation
- Homepage dashboard with comprehensive progress tracking
- Personalized difficulty estimation for new words

---

## [2025-12-12] - Database Schema Audit & Cleanup

### Schema Audit Complete

**Comprehensive audit of Supabase database comparing documentation vs actual state.**

**Audit Findings:**
- All 16 active tables verified and documented
- 4 deprecated tables identified from old vocabulary architecture
- All foreign key relationships verified (0 orphan records)
- `validation_reports` schema updated in docs to match actual columns

### Deprecated Tables Archived

**Old vocabulary tables renamed (data preserved for rollback if needed):**

| Old Name | New Name | Rows |
|----------|----------|------|
| `vocabulary` | `vocabulary_deprecated_20251212` | 1,526 |
| `vocabulary_forms` | `vocabulary_forms_deprecated_20251212` | 1,526 |
| `vocabulary_lemmas` | `vocabulary_lemmas_deprecated_20251212` | 1,171 |

**Empty table deleted:**
- `vocabulary_occurrences` (0 rows) - dropped

### Documentation Updated

- **02_DATABASE_SCHEMA.md:** Updated `validation_reports` schema to match actual columns:
  - Added `has_multiple_meanings` (BOOLEAN)
  - Added `alternative_meanings` (JSONB)
  - Added `reviewed_by_human` (BOOLEAN)
  - Changed `suggested_fixes` from array to object
  - Added `created_at` timestamp

### Code Verification

- Confirmed no active code in `src/` references deprecated tables
- Only backup files (`Flashcards.jsx.backup`) and migration scripts reference old tables
- App verified working after schema cleanup

### Migration SQL

SQL script created at `scripts/migration/archive_deprecated_tables.sql` for archiving.

---

## [2025-12-06] - Comprehensive AI Dictionary Form Validation

### Major Milestone: Complete Lemma Quality Assurance ✓

**AI-powered validation crawled all 1,800 lemmas to ensure every entry is the true dictionary form.**

**Final Database Statistics (After Complete Normalization):**
- Chapters: 27
- Sentences: ~700 (all translated)
- Lemmas: **1,658 unique** (reduced from 1,854 after normalization)
- Words: ~12,500 instances (after cleanup)
- Phrases: 844 (bulk approved)

### New AI Validation Tools Created

**1. Dictionary Form Validator (`scripts/validate_dictionary_forms.py`):**
- Processes all lemmas in batches of 30 using Claude AI
- Identifies non-dictionary forms: conjugations, variants, garbage, misspellings
- Outputs detailed JSON report with suggested fixes
- Generates fix scripts automatically

**2. Dictionary Fixes Applier (`scripts/apply_dictionary_fixes.py`):**
- Merges conjugated verbs into infinitives (compran→comprar)
- Deletes garbage lemmas (fake words from spaCy errors)
- Merges adjective/noun variants into canonical forms
- Fixes proper noun capitalization

### Fixes Applied (150 Total)

| Category | Count | Examples |
|----------|-------|----------|
| Conjugations merged | 45 | compran→comprar, comprendo→comprender, duermen→dormir |
| Garbage deleted | 78 | llevarter, trabajer, el administro, viesar |
| Variants merged | 19 | gran→grande, alguna→alguno, el cien→ciento |
| Capitalization | 8 | américa→América, marte→Marte, siberia→Siberia |

### Key Learnings for Future Imports

**spaCy Lemmatization Issues Identified:**
1. Sometimes returns conjugated forms as lemmas (compran instead of comprar)
2. Creates fake "-er" verbs (llevarter, trabajer, tendrar)
3. Treats verb+pronoun constructions as nouns (el hacerlo, la mirarla)
4. Misclassifies past participles as adjectives

**AI Validation is Essential:**
- 17% of initial lemmas had issues requiring correction
- Human review alone would miss many subtle errors
- Batch processing with Claude is cost-effective (~$2 for 1,800 lemmas)

---

## [2025-12-06] - All 27 Chapters Imported + Lemma Normalization Complete

### Major Milestone: El Principito Complete ✓

**All 27 chapters of El Principito have been imported and processed.**

**Database Statistics (Before Final Validation):**
- Chapters: 27
- Sentences: ~700 (all translated)
- Lemmas: 1,854 unique (after normalization)
- Words: ~15,000 instances
- Phrases: 844 (bulk approved)

### Admin Notes Cleanup (24 Lemmas Resolved)

**Category 1 - Garbage Lemmas Deleted (12):**
- siguer, reíster, estabar, respondier, dormirse, preguntier (spaCy conjugation errors)
- erais, hubierais (verb forms incorrectly treated as infinitives)
- creaturas, planetas (noun plurals treated as separate lemmas)
- Words reassigned to canonical forms before deletion

**Category 2 - POS Merges/Reclassifications (7):**
- baobabs (VERB→NOUN): merged into "el baobab"
- admirador (ADJ→NOUN): merged into "el admirador"
- añadiste (VERB form): merged into "añadir"
- amigo (ADJ→NOUN): merged into "el amigo"
- astrónomo (ADJ→NOUN): merged into "el astrónomo"
- buena (ADJ form): merged into "bueno"
- la vién (typo): merged into "venir"

**Category 3 - Lemma Normalizations (2):**
- mecir → mecer (corrected in place)
- tendrer → tender (corrected in place)

**Category 4 - Translation Fixes (2):**
- salir: "to go out" → "to leave"
- bridge (English word): given proper Spanish context

**Category 5 - Valid Items Cleared (3):**
- amanecer: valid as NOUN (el amanecer = the dawn)
- ya: valid as ADV (already/now)
- la boa: valid feminine noun

### Quality Verification

| Check | Result |
|-------|--------|
| Lemmas with admin_notes | 0 ✓ |
| Orphan words (no lemma) | 0 ✓ |
| Verbs missing "to " prefix | 0 ✓ |
| Nouns missing "the " prefix | 0 ✓ |

### Phrase Processing

- Total phrases detected: 844
- All phrases bulk approved (is_reviewed = true)
- Phrase types: idioms, collocations, compounds

### Status: Ready for Comprehensive Quality Review

Next phase: Chapter-by-chapter AI validation to ensure translation accuracy and lemma correctness across all content.

---

## [2025-12-05] - Chapters 3-27 Bulk Import

### Batch Import Complete

**Imported chapters:**
- Chapters 3-10 (batch 1)
- Chapters 11-20 (batch 2)
- Chapters 21-27 (batch 3)

**Process used:**
1. Split combined chapter files using `split_chapters.py`
2. Batch import using `batch_import_chapters.sh`
3. Phrase detection run for each chapter
4. Bulk phrase approval

### Automation Scripts Created

- `scripts/split_chapters.py` - Splits combined chapter files
- `scripts/batch_import_chapters.sh` - Imports multiple chapters sequentially

---

## [2025-12-04] - Chapter 2 Thorough Review & Pipeline Improvements

### Chapter 2: COMPLETE ✓

**Final Import Results:**
- Sentences: 47
- Words: 602
- Unique Lemmas: 244 (after cleanup)
- Phrases: 40 approved (18 rejected)

**Validation Issue Resolution:**
- Started: 66 flagged issues
- Fixed: All 66 resolved
  - Category A (False positives): 8 - ignored
  - Category B (Code fixes): 28 - fixed in import_chapter.py
  - Category C (SQL fixes): 22 - fixed via database updates
  - Category D (Optional): 8 - low priority improvements

**Quality Checks:**
- Verbs missing "to " prefix: 0 ✓
- Nouns missing "the " prefix: 0 ✓
- Data integrity: 100% ✓

### Pipeline Improvements Made

**Code fixes in import_chapter.py:**
1. **GENDER_CORRECTIONS expanded**: Added 13 new feminine nouns (cosa, sorpresa, sed, boa, balsa, etc.)
2. **FEMININE_WITH_EL set**: Added phonetic rule handling (el agua, el hambre)
3. **PRONOUNS_NOT_NOUNS set**: Filter pronouns from noun treatment (conmigo, mío, etc.)
4. **LEMMA_CORRECTIONS dict**: Fixed spaCy lemmatization errors (conocir→conocer, etc.)
5. **PRETERITE_TO_INFINITIVE dict**: Map conjugated forms to infinitives (viví→vivir, etc.)
6. **POS_CORRECTION section**: Fix misclassified verb forms, adverbs, nouns

**New SQL fix script:**
- Created `scripts/fix_chapter2_issues.sql` for reference

### Phrases Approved (40)
Notable idioms: por favor, cuestión de vida o muerte, ponerse en pie, de un salto,
muerto de cansancio, en absoluto, no importa, por fin, volver a, ser capaz de

### Status: Ready for Chapter 3 import

---

## [2025-12-04] - Pre-Chapter-2 Audit & Phrase Detection

### Pre-Import Audit Complete

**Documentation Verified:**
- 02_DATABASE_SCHEMA.md: Updated with correct column names (component_lemmas, start_position)
- 03_CONTENT_PIPELINE.md: All 9 steps documented including Step 8b (Phrase Detection)
- 04_LEARNING_ALGORITHM.md: Phrase flashcards section added (deferred to post-MVP)
- 99_LIVING_CHANGELOG.md: Current and accurate

**Chapter 1 Final State:**
- Sentences: 26
- Lemmas: 181 unique
- Words: 427
- Phrases: 36 detected, 20 approved
- Translation quality: 100% (0 missing prefixes)
- Data integrity: 100% (0 orphan records)

**New Documentation:**
- Created 30_CHAPTER_IMPORT_CHECKLIST.md with full import process

**Automation Status: READY FOR SCALE**
- All 9 pipeline steps automated
- Manual review required: AI validation issues, phrase approval, native speaker sample
- Estimated time per chapter: 30-60 minutes

---

## [2025-12-04] - Phrase Detection System

### Added
- **3 new database tables:**
  - `phrases`: Stores idiomatic expressions with definitions, type, component lemma IDs
  - `phrase_occurrences`: Links phrases to sentences with word positions
  - `user_phrase_progress`: Tracks user mastery of phrases (parallel to lemma progress)

- **Phrase detection via Claude API in content pipeline:**
  - `detect_phrases_in_sentence()`: AI-powered phrase identification
  - `detect_phrases_for_chapter()`: Batch processing for chapters
  - Confidence threshold >= 80 for inclusion
  - Phrase types: idiom, collocation, compound

- **CLI commands:**
  - `--detect-phrases --chapter N`: Run phrase detection on chapter
  - `--show-phrases --chapter N`: Display detected phrases with counts

- **Detection of idiomatic expressions:**
  - "personas mayores" (grown-ups) - compound
  - "dar miedo" (to scare) - idiom
  - "selva virgen" (primeval forest) - compound
  - "tener razón" (to be right) - collocation

### Updated
- **02_DATABASE_SCHEMA.md:** Added Phrase Tables section with full schema documentation
- **03_CONTENT_PIPELINE.md:** Added Step 8b - Detect Idiomatic Phrases
- **04_LEARNING_ALGORITHM.md:** Added Future: Phrase Flashcards section
- **AI validation prompt:** Updated to understand app's format conventions (article in Spanish lemma, "the" in English translation)

### Tested
- Chapter 1 phrase detection ready to run
- Expected phrases: "personas mayores" (grown-ups)

### Status
- Phrase detection functional
- Flashcard integration deferred to post-MVP

---

## Version History

### [0.1.0] - Foundation (Nov 2025)

**Status:** Pre-MVP, Documentation & Architecture Phase

#### Added
- **Documentation Tiers (28 documents total):**
  - Tier 1: Foundation (8 docs) - Overview, MVP, database, pipeline, algorithm, design, architecture, testing
  - Tier 2: Core Systems (5 docs) - Auth, reading, flashcards, progress, admin
  - Tier 3: UI/UX (4 docs) - Component library, design system, accessibility, responsive design
  - Tier 4: Operations (5 docs) - Testing, deployment, security, monitoring, error handling
  - Tier 5: Growth (4 docs) - Analytics, marketing, content roadmap, feature prioritization
  - Living Docs (2 docs) - Changelog, FAQ

- **Database Schema v2.0:**
  - Simplified architecture: lemmas (canonical) + words (instances)
  - Users master lemmas, not individual word forms
  - Prevents deck flooding with conjugations/inflections
  - Full migration plan documented

- **Learning Algorithm:**
  - 10 mastery levels (0-100 scale)
  - Health system (0-100, decays over time)
  - Time-gated mastery (prevents rapid-fire gaming)
  - Priority scoring (health + frequency + chapter + mastery)
  - Dual-path chapter unlocking (quality OR quantity)

- **Design System:**
  - Little Prince aesthetic (warm, storybook feel)
  - Mobile-first approach
  - Accessibility standards (WCAG 2.1 Level AA)
  - Component specifications

#### Changed
- Shifted from immediate implementation to foundation-first approach
- Prioritized documentation before code
- Redesigned database for scalability

#### Decisions Made
- Use lemmas as primary learning unit (not individual word forms)
- Health decay system for urgency prioritization
- Time gates prevent gaming the mastery system
- Dual-track metrics: mastery (quality) + exposure (quantity)
- 99%+ translation accuracy requirement

---

### [0.0.1] - Legacy System (Pre-Nov 2025)

**Status:** PHP-based predecessor (being modernized)

#### Existed
- PHP backend with MySQL
- Basic flashcard system
- "El Principito" content imported
- Simple progress tracking
- Working but not scalable

#### Why Rebuild
- Modern tech stack needed (React + Supabase)
- Better UX required
- Scalability issues
- Hard to maintain PHP codebase
- Opportunity to improve learning algorithm

---

## Future Releases (Planned)

### [0.2.0] - MVP Launch (Target: Q1 2026)

#### Planned Features
- User authentication (email/password)
- Reading mode (El Principito chapters)
- Flashcard study sessions
- Progress tracking (mastery, health, streaks)
- Chapter unlocking system
- Basic responsive design

#### Success Criteria
- 200+ users
- 40%+ day 1 retention
- 80%+ session completion rate
- No critical bugs

---

### [0.3.0] - Polish & Engagement (Target: Q2 2026)

#### Planned Features
- Word lookup in reading mode (click → see definition)
- Daily packages (50/100/150/250 word commitments)
- Basic badges (completion, streaks, milestones)
- Improved session summaries
- Share to social media

#### Success Criteria
- 500+ users
- 30%+ day 7 retention
- 4+ sessions per user per week

---

### [0.4.0] - Advanced Learning (Target: Q3 2026)

#### Planned Features
- Spaced repetition improvements
- Word notes & mnemonics
- Weak word focus mode
- Audio pronunciation (if budget allows)
- Book 2 (different difficulty level)

#### Success Criteria
- 1,000+ users
- 20+ words mastered per user per week
- <5% content quality complaints

---

### [1.0.0] - Full Release (Target: Q4 2026)

#### Planned Features
- Multiple books available
- Polished UX
- Community features (friends, optional leaderboards)
- Performance optimizations
- Mobile app consideration

#### Success Criteria
- 2,000+ users
- 20%+ day 30 retention
- 4.5/5 average rating
- Revenue model validated

---

## Migration History

### Database Migrations

#### Migration: New Schema (Planned Q4 2025)
**File:** `21_MIGRATION_PLAN.md`  
**Changes:**
- Add `lemmas` table (canonical forms)
- Add `words` table (instances, link to lemmas)
- Add `user_lemma_progress` (track mastery per lemma)
- Add `user_word_encounters` (track which forms seen)
- Migrate existing vocabulary data
- Update all queries to use new schema

**Impact:** Breaking change, requires data migration  
**Rollback:** Migration plan includes rollback script

---

## Known Issues

### Current (Pre-MVP)
- [ ] Old PHP system still running (legacy)
- [ ] Database schema not yet migrated
- [ ] Content pipeline not yet implemented
- [ ] No production deployment yet

### Planned Fixes
- Migrate database (Q4 2025)
- Implement new React app (Q4 2025)
- Deploy to Netlify + Supabase (Q1 2026)
- Sunset PHP system (Q1 2026)

---

## Breaking Changes

### Future Breaking Changes (Planned)

#### Database Schema v2.0
**When:** Q4 2025  
**Impact:** All old data must be migrated  
**Migration:** Automated migration script provided  
**Downtime:** ~30 minutes estimated

#### API Changes
**When:** MVP launch (Q1 2026)  
**Impact:** Old API endpoints deprecated  
**Migration:** New endpoints documented in 08_ARCHITECTURE.md

---

## Deprecations

### Currently Deprecated
- PHP backend (will be sunset after React migration complete)
- Old MySQL schema (will be migrated to new Supabase schema)

### Future Deprecations
- None planned yet

---

## Security Updates

### Planned Security Implementations

#### MVP Launch (Q1 2026)
- Supabase Auth with email verification
- Row Level Security (RLS) policies on all tables
- HTTPS enforcement (Netlify + Supabase)
- Secure headers (CSP, X-Frame-Options, etc.)
- Input validation on all user inputs

**See:** `18_SECURITY.md` for full details

---

## Performance Improvements

### Planned Optimizations

#### MVP Launch
- Code splitting (React lazy loading)
- Image optimization (WebP format)
- Lighthouse score >90
- Core Web Vitals (LCP <2.5s, FID <100ms, CLS <0.1)

#### Post-MVP
- Database query optimization
- CDN for static assets
- Service worker for offline support

**See:** `19_MONITORING.md` for metrics

---

## Documentation Updates

### Major Documentation Releases

#### 2025-11-30: Foundation Documentation Complete
**Tiers 1-5 + Living Docs:**
- 28 documents created (~250 pages)
- Complete system specification
- Ready for implementation phase

#### 2025-11-09: Algorithm Bible v1.0
- Complete learning algorithm specification
- 10 mastery levels defined
- Health system specified
- Priority scoring formulas
- Chapter unlocking logic

#### 2025-11-08: Database Schema Redesign
- New lemma-based architecture
- Migration plan created
- Scalability improvements

---

## Community & Contributions

### Planned Community Features

#### Post-MVP (Q2 2026)
- Discord server launch
- User feedback system
- Beta testing program
- Public roadmap

#### Future (Year 2)
- Open-source components
- API for third-party integrations
- User-generated content (curated)

---

## Analytics & Metrics

### Key Metrics (To Be Tracked Post-Launch)

**Growth:**
- Daily/Weekly/Monthly Active Users
- New signups per week
- Signup conversion rate

**Engagement:**
- Session completion rate
- Average session duration
- Streak maintenance rate

**Learning:**
- Words mastered per user
- Chapter completion rate
- Retention curves

**See:** `24_ANALYTICS_STRATEGY.md` for full details

---

## Related Documents

- **23_DECISION_LOG.md** - Major project decisions
- **27_FEATURE_PRIORITIZATION.md** - What's being built when
- **26_CONTENT_ROADMAP.md** - Content expansion plans
- **00_PROJECT_OVERVIEW.md** - Overall vision

---

## How to Update This Changelog

**When to update:**
- Before each release (summarize changes)
- After major features shipped
- When breaking changes made
- When security issues fixed

**Format:**
```markdown
### [Version] - Name (Date)

#### Added
- New feature 1
- New feature 2

#### Changed
- Modified feature

#### Fixed
- Bug fix

#### Security
- Security improvement
```

**Best practices:**
- Keep entries concise
- Link to relevant docs
- Note breaking changes
- Credit contributors (future)

---

## Changelog Archive

Older versions will be archived here as the project grows.

---

**END OF CHANGELOG**

*This is a living document. It will be updated as the project evolves.*
