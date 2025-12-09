# 23_DECISION_LOG.md

**Last Updated:** November 30, 2025  
**Status:** Living Document  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Content Pipeline](#content-pipeline)
4. [Learning Algorithm](#learning-algorithm)
5. [User Experience](#user-experience)
6. [Development Process](#development-process)
7. [Technology Choices](#technology-choices)
8. [Scope Decisions](#scope-decisions)

---

## OVERVIEW

This document records major decisions made during Voquab development. Each decision includes:
- **Context:** What problem we were solving
- **Options Considered:** Alternative approaches
- **Decision:** What we chose
- **Rationale:** Why we chose it
- **Trade-offs:** What we gave up

**Purpose:** Future reference, onboarding new contributors, understanding the "why" behind the "what"

---

## DATABASE ARCHITECTURE

### Decision 1: Clean Slate Schema Redesign (Nov 30, 2025)

**Context:**
- Current database had three competing vocabulary systems (vocabulary, vocabulary_forms, vocabulary_lemmas)
- Confusion about canonical relationships
- ~60% of verb forms missing canonical links
- Complex queries required for simple operations

**Options Considered:**

**Option A: Incremental Cleanup**
- Fix canonical relationships in existing schema
- Merge vocabulary_forms into vocabulary
- Keep basic structure
- Estimated: 1-2 weeks of data cleanup

**Option B: Clean Slate Redesign** ✅ CHOSEN
- Design simple two-table system (lemmas + words)
- Migrate data with validation
- Clear, understandable architecture
- Estimated: 3-5 days migration + testing

**Decision:** Clean slate redesign

**Rationale:**
- Simpler is better - two tables vs five
- Easier to understand and maintain
- Forces us to fix data quality issues properly
- Future developers won't inherit confusion
- Migration risk mitigated by thorough testing and backups

**Trade-offs:**
- Upfront migration effort (3-5 days)
- Risk of data loss (mitigated by backups)
- Need to update all queries

**Outcome:** New schema documented in 02_DATABASE_SCHEMA.md

---

### Decision 2: Lemmas vs Words Architecture (Nov 30, 2025)

**Context:**
- Spanish has extensive conjugations and declensions
- Original system: separate flashcard for every verb form
- Result: Deck flooding (50+ cards for one verb concept)

**Options Considered:**

**Option A: Track Every Form Separately**
- Each conjugation is a separate entry
- User masters "vivir", "vivo", "vivía", "vivió" individually
- Comprehensive but overwhelming

**Option B: Lemmas Only (No Form Tracking)** 
- Only store canonical forms
- Lose context of which forms user has seen
- Overly simplified

**Option C: Lemmas + Words (Two-Table System)** ✅ CHOSEN
- `lemmas` = canonical dictionary entries (vivir)
- `words` = instances in sentences (vivía in sentence X)
- Users master lemmas, flashcards show encountered forms
- Best of both worlds

**Decision:** Lemmas + Words architecture

**Rationale:**
- Prevents deck flooding (one card per lemma)
- Preserves context (shows form user encountered)
- Scalable (new forms don't create new flashcards)
- Linguistically sound (how dictionaries work)
- User focuses on concepts, not memorizing tables

**Trade-offs:**
- More complex database structure than lemmas-only
- Need to query words table for context

**Outcome:** Forms the foundation of new schema

---

### Decision 3: Users Track Lemma Progress, Not Word Progress (Nov 30, 2025)

**Context:**
- With lemma architecture, how do we track user mastery?
- Do users have separate progress for "vivir" vs "vivía"?

**Options Considered:**

**Option A: Progress Per Word Form**
- Track mastery for each encountered form
- More granular tracking
- Leads back to deck flooding problem

**Option B: Progress Per Lemma** ✅ CHOSEN
- `user_lemma_progress` tracks mastery of canonical forms
- `user_word_encounters` tracks which forms seen
- One mastery number per concept

**Decision:** Progress per lemma

**Rationale:**
- Aligns with anti-deck-flooding goal
- Simpler mental model for users
- Learning "vivir" means understanding all its forms
- Still track which forms encountered for sentence selection

**Trade-offs:**
- Can't measure mastery of specific conjugations
- Some granularity lost

**Outcome:** Reflected in database schema and flashcard logic

---

### Decision 4: Multiple Definitions as JSONB Array (Nov 30, 2025)

**Context:**
- Some Spanish words have multiple English meanings
- "banco" = "bank" (financial) or "bench" (seat)
- How to store in database?

**Options Considered:**

**Option A: Single Definition String with Delimiters**
- Store as "bank; bench" with semicolon separator
- Simple but requires parsing

**Option B: Separate Rows for Each Definition**
- Create multiple lemma rows
- Normalized but causes duplicates

**Option C: JSONB Array** ✅ CHOSEN
- Store as `["bank (financial)", "bench (seat)"]`
- Max 5 definitions per lemma
- Ordered by importance/frequency

**Decision:** JSONB array (max 5 definitions)

**Rationale:**
- PostgreSQL has excellent JSONB support
- Easy to query and update
- Maintains order (most common definition first)
- Prevents overwhelming users (5 max)
- Can store metadata in future if needed

**Trade-offs:**
- Slightly more complex queries
- Can't index individual definitions easily

**Outcome:** `lemmas.definitions JSONB` column

---

## CONTENT PIPELINE

### Decision 5: Multi-Layer Validation (Nov 30, 2025)

**Context:**
- Need 99% translation accuracy for MVP
- Single tool (spaCy or DeepL) not enough
- How to catch errors?

**Options Considered:**

**Option A: Automated Only**
- spaCy + DeepL, no human review
- Fast but risky
- Accuracy unknown

**Option B: Manual Only**
- Human review every word
- Accurate but slow (weeks)

**Option C: Multi-Layer Hybrid** ✅ CHOSEN
- Layer 1: spaCy (lemmatization, POS)
- Layer 2: DeepL (translation)
- Layer 3: Claude AI (semantic validation)
- Layer 4: Human review (final check)

**Decision:** Multi-layer hybrid approach

**Rationale:**
- Automated tools catch 95% of issues
- AI catches semantic problems automation misses
- Humans catch edge cases and cultural context
- Efficient: focus human time on flagged issues
- Measurable: track quality metrics at each layer

**Trade-offs:**
- More complex pipeline
- Slower than pure automation
- API costs (DeepL Pro, Claude API)

**Outcome:** 9-step pipeline in 03_CONTENT_PIPELINE.md

---

### Decision 6: Claude API for Semantic Validation (Nov 30, 2025)

**Context:**
- spaCy lemmatizes, but sometimes wrong for context
- "desilusionado" lemmatized as itself, should be "desilusionar"
- Need semantic understanding

**Options Considered:**

**Option A: Manual Review Only**
- Peter checks every lemma
- Time-intensive

**Option B: Rule-Based Validation**
- Write rules for common errors
- Brittle, misses edge cases

**Option C: Claude API Validation** ✅ CHOSEN
- Send sentence + lemmas + definitions to Claude
- Get semantic analysis
- Flag mismatches with confidence scores

**Decision:** Claude API for validation

**Rationale:**
- Claude understands context and semantics
- Scales to entire book
- Provides explanations (helpful for manual review)
- Confidence scores let us prioritize
- We're already using Claude anyway

**Trade-offs:**
- API costs (~$0.50 per book chapter)
- Requires internet connection
- Not deterministic (responses vary slightly)

**Outcome:** Step 8 in content pipeline

---

### Decision 7: Process Entire Book Before Launch (Nov 30, 2025)

**Context:**
- Could launch with partial content
- Or wait until all chapters ready

**Options Considered:**

**Option A: Rolling Launch**
- Launch with Chapter 1-5
- Add chapters weekly
- Get users faster

**Option B: Complete Book First** ✅ CHOSEN
- Process all 27 chapters
- Launch when 100% ready
- Complete experience from day 1

**Decision:** Complete book first

**Rationale:**
- Users want complete story
- Prevents mid-story abandonment
- Quality bar applies to entire book
- Can test full chapter unlock progression
- Better first impression

**Trade-offs:**
- Longer time to launch
- No early user feedback on later chapters

**Outcome:** All 27 chapters required for MVP

---

## LEARNING ALGORITHM

### Decision 8: Dual-Track Progression (Mastery + Health) (Nov 2025)

**Context:**
- How to measure learning progress?
- Single number insufficient

**Options Considered:**

**Option A: Mastery Only**
- 0-100 scale
- Represents knowledge depth
- Doesn't capture recency

**Option B: Dual-Track** ✅ CHOSEN
- Mastery (0-100): how well you know it
- Health (0-100): how recently practiced
- Both guide card selection

**Decision:** Dual-track system

**Rationale:**
- Quality (mastery) + Quantity (practice) both matter
- Health creates urgency (words decay)
- Mastery shows true understanding
- Separating metrics clearer than single number
- Enables time-gated mastery

**Trade-offs:**
- More complex to explain
- Two numbers instead of one

**Outcome:** Implemented in Phase 1

---

### Decision 9: Time-Gated Mastery (Nov 2025)

**Context:**
- Users could review same word 100 times in 5 minutes
- Gaming the system
- Not real learning

**Options Considered:**

**Option A: No Time Gates**
- Allow rapid reviewing
- Fast progression but artificial

**Option B: Fixed Intervals**
- Review only every 24 hours
- Too rigid

**Option C: Exponential Time Gates** ✅ CHOSEN
- Level 0: 0 hours (immediate)
- Level 1: 4 hours
- Level 3: 24 hours
- Level 7: 30 days
- Level 10: 180 days
- Mastery gain blocked until time passes
- Health still improves

**Decision:** Exponential time gates

**Rationale:**
- Aligns with spaced repetition research
- Prevents gaming while allowing practice
- Health rewards effort even when mastery blocked
- Transparent (show "wait 5 hours")
- Encourages daily practice not cramming

**Trade-offs:**
- Slower perceived progress
- Users might get frustrated early on

**Outcome:** Phase 2 implementation

---

### Decision 10: 100% Word Exposure for Chapter Unlock (Nov 2025)

**Context:**
- When should next chapter unlock?
- Balance progression vs mastery

**Options Considered:**

**Option A: High Mastery Threshold**
- Require 60+ mastery on all words
- Ensures deep understanding
- Very slow progression

**Option B: Encounter-Based** ✅ CHOSEN
- Must see 100% of words in chapter
- Plus: 40 avg mastery OR 50 reviews OR balanced
- Emphasizes exposure over perfection

**Decision:** 100% encounter + flexible mastery/review thresholds

**Rationale:**
- Prevents skipping foundational vocabulary
- Dual path rewards both fast learners and persistent practicers
- Seeing words in context is primary goal
- Users won't feel stuck (multiple unlock paths)
- Balances rigor with accessibility

**Trade-offs:**
- Slower than pure encounter-based
- Some users may struggle with high mastery path

**Outcome:** Documented in algorithm spec

---

## USER EXPERIENCE

### Decision 11: Mobile-First Design (Nov 2025)

**Context:**
- Target devices and use cases?
- Limited development resources

**Options Considered:**

**Option A: Desktop-First**
- Design for large screens
- Add mobile later
- Richer features possible

**Option B: Mobile-First** ✅ CHOSEN
- Design for phone screens
- Ensure works on desktop too
- Primary use case: studying on the go

**Decision:** Mobile-first approach

**Rationale:**
- Users study during downtime (waiting, commuting, bed)
- Phones are always available
- Simpler UI forces focus on essentials
- Responsive design scales up to desktop naturally
- 70%+ of language learning app usage is mobile

**Trade-offs:**
- Some advanced features harder on small screens
- Desktop experience may feel sparse

**Outcome:** All UI designed for 375px width minimum

---

### Decision 12: Beautiful Design is MVP-Critical (Nov 30, 2025)

**Context:**
- Should we polish UI before launch or after?
- Classic "function vs form" question

**Options Considered:**

**Option A: Function First, Polish Later**
- Launch with basic UI
- Add design after validation

**Option B: Beautiful Design is MVP** ✅ CHOSEN
- Professional visual design required
- Polish before launch
- Design is feature, not afterthought

**Decision:** Beautiful design required for MVP

**Rationale:**
- First impressions matter (users judge in 5 seconds)
- Design drives engagement (people want to use beautiful apps)
- Voquab's value prop includes delightful experience
- Competing with Duolingo-level polish
- Peter cares about aesthetics
- The Little Prince deserves beautiful presentation

**Trade-offs:**
- Longer development time
- Design skills required
- More iteration needed

**Outcome:** Included in MVP definition

---

### Decision 13: Click-for-Definition Reading Mode (Nov 30, 2025)

**Context:**
- How should users interact with book text?
- Passive reading or interactive?

**Options Considered:**

**Option A: Static Text Only**
- Read like normal book
- No interaction

**Option B: Hover Tooltips**
- Hover for definition
- Desktop-focused

**Option C: Click/Tap for Definition** ✅ CHOSEN
- Tap word, see definition modal
- Add to study queue
- Works on mobile and desktop

**Decision:** Click/tap interaction

**Rationale:**
- Mobile-friendly (no hover on touch screens)
- Clear interaction (intentional, not accidental)
- Can show more info in modal (conjugations, examples)
- Natural UX (click = action)
- Enables "add to study" feature

**Trade-offs:**
- Requires extra click vs hover
- Modal interrupts reading flow

**Outcome:** Reading mode spec in MVP

---

## DEVELOPMENT PROCESS

### Decision 14: Document First, Code Second (Nov 30, 2025)

**Context:**
- How to approach implementation?
- Ad-hoc coding vs planned approach

**Options Considered:**

**Option A: Code Directly**
- Start coding features
- Figure out details as we go
- Faster initially

**Option B: Document Then Code** ✅ CHOSEN
- Write specification documents first
- Get approval on approach
- Then implement from spec
- Slower initially, faster overall

**Decision:** Documentation-first approach

**Rationale:**
- Prevents rework (get buy-in before coding)
- Specs guide Claude Code implementation
- Documentation serves as reference later
- Thinking through details catches issues early
- Easier to hand off work
- Peter prefers systematic approach

**Trade-offs:**
- Upfront time investment
- Risk of over-documentation

**Outcome:** Created 28-document roadmap

---

### Decision 15: Claude (Web) + Claude Code Separation (Nov 2025)

**Context:**
- Peter uses two AI assistants
- How to divide responsibilities?

**Options Considered:**

**Option A: One AI for Everything**
- Claude handles strategy and implementation
- Simpler coordination

**Option B: Specialized Roles** ✅ CHOSEN
- Claude (web): Strategy, docs, architecture
- Claude Code: Implementation, coding, files
- Clear separation of concerns

**Decision:** Specialized roles

**Rationale:**
- Web Claude can't access file system (technical limitation)
- Code Claude better at implementation
- Web Claude better at big-picture thinking
- Clear handoff protocol prevents confusion
- Peter can discuss strategy without coding
- Living changelog tracks what Code Claude did

**Trade-offs:**
- Coordination overhead
- Context sharing between assistants
- Peter acts as intermediary

**Outcome:** Workflow documented in 07_WORKING_WITH_CLAUDE_CODE.md

---

### Decision 16: Tier-Based Documentation (Nov 30, 2025)

**Context:**
- How to structure 28 documents?
- Reading order matters

**Options Considered:**

**Option A: Alphabetical**
- Alphabetical by name
- Easy to find

**Option B: Tiered Priority** ✅ CHOSEN
- Tier 1: Foundation (create first)
- Tier 2: Core systems (after foundation)
- Tier 3: UI/UX (during implementation)
- Tier 4: Operations (before launch)
- Tier 5: Growth (post-launch)

**Decision:** Tier-based structure

**Rationale:**
- Logical creation order (foundation first)
- Progressive depth (basic to advanced)
- Clear dependencies (Tier 1 before Tier 2)
- Can launch with Tier 1-4 complete
- Easy to see what's next

**Trade-offs:**
- Not alphabetical (need roadmap to navigate)

**Outcome:** DOCUMENTATION_ROADMAP.md structure

---

## TECHNOLOGY CHOICES

### Decision 17: React 19 + Vite (2024)

**Context:**
- Modernizing from PHP version
- Choose frontend framework

**Options Considered:**

**Option A: Vanilla JavaScript**
- No framework overhead
- More manual work

**Option B: Vue.js**
- Popular, approachable

**Option C: React + Vite** ✅ CHOSEN
- Industry standard
- Rich ecosystem
- Fast development server

**Decision:** React 19 with Vite

**Rationale:**
- Peter already knows React
- Most AI tools understand React best
- Component architecture matches UI needs
- Vite is fast (hot module reload)
- Easy to hire for if needed

**Trade-offs:**
- Build step required
- Framework overhead

**Outcome:** Current tech stack

---

### Decision 18: Supabase vs Custom Backend (2024)

**Context:**
- Need database, auth, hosting
- Build custom or use BaaS?

**Options Considered:**

**Option A: Custom Backend (Node.js + PostgreSQL)**
- Full control
- More work

**Option B: Firebase**
- Google platform
- NoSQL (not ideal for relational data)

**Option C: Supabase** ✅ CHOSEN
- PostgreSQL (relational)
- Built-in auth
- Row Level Security
- Hosted

**Decision:** Supabase

**Rationale:**
- PostgreSQL better for relational data
- RLS policies enforce security
- Auth included (social login, magic links)
- Generous free tier
- Real-time capabilities for future
- Less maintenance than custom backend

**Trade-offs:**
- Vendor lock-in (mitigated by PostgreSQL standard)
- Less control than custom backend

**Outcome:** Using Supabase Cloud

---

### Decision 19: spaCy for Spanish NLP (Nov 2025)

**Context:**
- Need to lemmatize Spanish text
- Extract POS tags
- Multiple NLP libraries available

**Options Considered:**

**Option A: Rule-Based Lemmatization**
- Write own rules
- Full control but brittle

**Option B: NLTK**
- Popular Python library
- Less accurate for Spanish

**Option C: spaCy** ✅ CHOSEN
- Modern NLP library
- Excellent Spanish model (es_core_news_sm)
- Fast, accurate

**Decision:** spaCy with es_core_news_sm model

**Rationale:**
- State-of-the-art Spanish NLP
- Fast (can process book in seconds)
- Accurate lemmatization (85-90%)
- POS tagging included
- Well-documented
- Active development

**Trade-offs:**
- Python dependency
- Model download required (40MB)
- Not 100% accurate (need human review)

**Outcome:** Core of content pipeline

---

### Decision 20: DeepL Pro for Translation (Nov 2025)

**Context:**
- Need Spanish → English translations
- Quality critical for learning

**Options Considered:**

**Option A: Google Translate**
- Free
- Adequate quality

**Option B: DeepL Pro** ✅ CHOSEN
- Higher quality translations
- Better context handling
- $5-10/month

**Option C: Human Translation Only**
- Highest quality
- Very expensive

**Decision:** DeepL Pro API

**Rationale:**
- Consistently better than Google Translate
- Handles literary language well
- Natural-sounding English
- Affordable ($5-10 for entire book)
- Fast (API)
- Peter already has account

**Trade-offs:**
- Not free
- API rate limits (50/min)
- Not 100% accurate (need review)

**Outcome:** Translation provider in pipeline

---

## SCOPE DECISIONS

### Decision 21: One Book for MVP (Nov 30, 2025)

**Context:**
- Could launch with multiple books
- Or focus on one

**Options Considered:**

**Option A: Multiple Books**
- El Principito + 2-3 others
- More content
- Longer development

**Option B: One Book Only** ✅ CHOSEN
- El Principito
- Complete, polished experience
- Faster launch

**Decision:** Single book (El Principito)

**Rationale:**
- Prove concept with one book first
- 99% accuracy easier with focused scope
- Users can complete the book
- Foundation for multi-book platform
- Can add books post-launch

**Trade-offs:**
- Limited content variety
- Users finish book quickly

**Outcome:** MVP definition

---

### Decision 22: Defer Gamification to v2.0 (Nov 30, 2025)

**Context:**
- Original algorithm spec had badges, XP, waypoints, packages
- Should this be in MVP?

**Options Considered:**

**Option A: Full Gamification in MVP**
- All features from algorithm spec
- Richer experience
- 2-3 months additional work

**Option B: Basic Features Only** ✅ CHOSEN
- Core learning loop
- Simple streak tracking
- No badges, XP, packages
- Defer to v2.0

**Decision:** Defer advanced gamification

**Rationale:**
- Core learning must work first
- Gamification is enhancement not foundation
- Can validate learning effectiveness without it
- Faster path to launch
- Can add based on user feedback
- Risk of over-engineering

**Trade-offs:**
- Less engaging initially
- May affect retention
- Algorithm spec work not wasted (future roadmap)

**Outcome:** MVP focused on learning mechanics

---

### Decision 23: No Audio in MVP (Nov 30, 2025)

**Context:**
- Audio pronunciation valuable for learning
- Record or synthesize?

**Options Considered:**

**Option A: TTS (Text-to-Speech)**
- Automated
- Acceptable quality
- Quick implementation

**Option B: Native Speaker Recordings**
- Highest quality
- Very time-intensive

**Option C: No Audio in MVP** ✅ CHOSEN
- Text-only
- Add audio post-launch

**Decision:** No audio in MVP

**Rationale:**
- Text-based learning is core value prop
- Audio is enhancement
- Recording 1,500+ words time-intensive
- TTS quality varies
- Can validate app without audio
- Post-launch feature based on demand

**Trade-offs:**
- Missing pronunciation help
- Less multi-modal learning

**Outcome:** Audio deferred to v4.0

---

## LESSONS LEARNED

### What Worked Well

1. **Documentation-first approach** saved rework
2. **Clean slate redesign** better than incremental fixes
3. **Multi-layer validation** catches errors automation misses
4. **Mobile-first** forces focus on essentials
5. **Clear role separation** (Claude web vs Code) efficient

### What We'd Do Differently

1. **Start with docs earlier** - wish we had full spec from day 1
2. **Test migration on subset first** - before full data
3. **More conservative estimates** - add buffer time

### Principles Going Forward

1. **Quality over speed** - 99% accuracy non-negotiable
2. **Simplicity beats cleverness** - two tables better than five
3. **User experience matters** - beautiful design is feature
4. **Document decisions** - this log valuable for future
5. **Iterate systematically** - spec → implement → test → review

---

## QUICK REFERENCE

### Key Decisions Summary

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Database | Lemmas + Words | Prevents deck flooding |
| Progress | Track lemmas not forms | Simpler mental model |
| Validation | Multi-layer (auto + AI + human) | 99% accuracy |
| Design | Mobile-first, beautiful | Primary use case |
| Scope | One book, core features | Faster to quality |
| Process | Document first | Prevents rework |

---

## RELATED DOCUMENTS

- See **00_PROJECT_OVERVIEW.md** for project vision
- See **02_DATABASE_SCHEMA.md** for schema decisions
- See **03_CONTENT_PIPELINE.md** for validation decisions
- See **01_MVP_DEFINITION.md** for scope decisions

---

## REVISION HISTORY

- 2025-11-30: Initial version with 23 major decisions (Claude)
- Status: Living document, will update as we make new decisions

---

**END OF DECISION LOG**
