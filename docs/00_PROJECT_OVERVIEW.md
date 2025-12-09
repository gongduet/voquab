# VOQUAB PROJECT OVERVIEW

**Last Updated:** November 30, 2025  
**Status:** Foundation Phase - Database redesign in progress  
**Version:** 2.0 (Clean slate rebuild)

---

## TABLE OF CONTENTS

1. [What is Voquab](#what-is-voquab)
2. [Core Philosophy](#core-philosophy)
3. [Current Project State](#current-project-state)
4. [Architecture Overview](#architecture-overview)
5. [Technology Stack](#technology-stack)
6. [Documentation Structure](#documentation-structure)
7. [Immediate Next Steps](#immediate-next-steps)
8. [Team & Roles](#team--roles)

---

## WHAT IS VOQUAB

Voquab is a language learning web application that teaches Spanish vocabulary through Antoine de Saint-Exupéry's "El Principito" (The Little Prince). Every word is learned within the context of actual sentences from the story, creating meaningful and memorable learning experiences.

**The Vision:** A beautiful, mobile-first companion to The Little Prince that makes learning Spanish feel like exploring a beloved story rather than studying flashcards.

**Target Launch:** When El Principito is complete with 99% translation accuracy  
**Initial Audience:** Friends beta → Small testing group → Public launch

---

## CORE PHILOSOPHY

### 1. Contextual Learning Over Isolation
Every word is encountered within actual sentences from the book. Users see "vivía" in context: "Cuando yo tenía seis años..." not as an isolated vocabulary item.

### 2. Master Lemmas, Not Forms
Users learn "vivir" (to live) as a concept, not 50 separate conjugations. The system shows the canonical form with encountered form as context: **VIVIR** (vivía).

### 3. Quality Over Speed
99% translation accuracy is non-negotiable. Manual review by native speakers is required before launch. Every lemma assignment must be semantically correct.

### 4. Mobile-First Beauty
Primary use case: Studying while waiting in line, on the bus, lying in bed. The interface must be gorgeous and optimized for phones.

### 5. Dual Progression Tracking
- **Mastery (0-100):** How well you KNOW the word
- **Health (0-100):** How recently you've PRACTICED the word
- Both metrics guide spaced repetition

### 6. Sequential Chapter Progression
Users must encounter 100% of words in a chapter before unlocking the next. This ensures solid foundations before advancing.

### 7. Reading as Learning
The book isn't just source material - it's an interactive reading experience where users can click words, rate comprehension, and track progress through the narrative.

---

## CURRENT PROJECT STATE

### ✅ What's Working

**Existing Implementation:**
- React 19 + Vite frontend
- Supabase backend with authentication
- Basic flashcard system with 4 difficulty levels
- Chapter reading interface
- Daily stats tracking
- Calendar heat map
- Admin dashboard (basic)

**Refactored Recently (Nov 26):**
- Flashcard code reduced from 2,522 lines → 339 lines (87% reduction)
- Modular component architecture
- Custom hooks for data/session/progress
- Improved code maintainability

### 🚧 What's Being Redesigned

**Database Schema (In Progress):**
- OLD: Three competing vocabulary systems (confusing)
- NEW: Simple two-table design (lemmas + words)
- Migration plan documented, ready to implement

**Content Pipeline (Designed):**
- Workflow: Paste chapter → Split sentences → Lemmatize → Translate → Validate
- Tools: spaCy, DeepL Pro, Claude API for validation
- 9-step process with quality checkpoints

### ❌ What's Not Built Yet

**MVP Requirements Still Needed:**
- Complete El Principito import (all chapters)
- Admin dashboard for manual edits
- Interactive reading mode with click-for-definition
- Reading comprehension tracking
- Time-gated mastery enforcement
- Package system (Foundation/Standard/Immersion)
- Beautiful mobile-optimized UI redesign

---

## ARCHITECTURE OVERVIEW

### Three-Layer Data Model

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: CONTENT                                   │
│  books → chapters → sentences                       │
│  "El Principito" broken into 27 chapters            │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2: VOCABULARY                                │
│  lemmas (canonical forms with definitions)          │
│  words (instances in sentences)                     │
│  "vivir" is a lemma, "vivía" is a word              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3: USER PROGRESS                             │
│  user_lemma_progress (mastery + health)             │
│  user_word_encounters (which forms seen)            │
│  user_chapter_progress (unlock status)              │
└─────────────────────────────────────────────────────┘
```

### Key Design Principle

**"Words point to Lemmas. Lemmas have definitions. Users master Lemmas."**

This prevents flashcard deck flooding - user sees ONE card for "vivir" showing their most recently encountered form, not 50 separate cards for each conjugation.

---

## TECHNOLOGY STACK

### Frontend
- **React 19:** Modern hooks-based architecture
- **Vite:** Fast build tool
- **TailwindCSS:** Utility-first styling
- **React Router:** Client-side routing

### Backend
- **Supabase:** PostgreSQL database + authentication + RLS
- **Row Level Security:** User data isolation

### Development Tools
- **spaCy:** Spanish NLP (lemmatization, POS tagging)
- **DeepL Pro API:** High-quality translations
- **Claude API:** Semantic validation of lemma assignments
- **Python:** Content pipeline scripts

### Deployment
- **Netlify:** Frontend hosting
- **Supabase Cloud:** Database hosting
- **GitHub:** Version control (not yet updated with latest changes)

### Development Environment
- **WSL (Ubuntu):** Primary development environment
- **Claude (web):** Strategic planning, documentation, design
- **Claude Code (terminal):** Implementation, coding, testing

---

## DOCUMENTATION STRUCTURE

All project documentation lives in `/docs` folder and follows this hierarchy:

### Tier 1: Foundation (Creating Now)
- **DOCUMENTATION_ROADMAP.md** - Master guide for all documentation
- **00_PROJECT_OVERVIEW.md** - This file
- **01_MVP_DEFINITION.md** - What's in/out of MVP
- **02_DATABASE_SCHEMA.md** ✅ - Complete SQL definitions
- **03_CONTENT_PIPELINE.md** ✅ - Import workflow with code
- **07_WORKING_WITH_CLAUDE_CODE.md** - Collaboration protocols
- **21_MIGRATION_PLAN.md** - Old → new schema transition
- **22_ADMIN_DASHBOARD.md** - Manual editing requirements
- **23_DECISION_LOG.md** - Why we chose this approach

### Tier 2: Core Systems (After Foundation)
- Learning algorithm refinement
- Reading experience design
- API documentation
- Code style guide

### Tier 3: UI/UX (During Implementation)
- Design system (colors, fonts, components)
- Component library
- Accessibility guidelines
- Performance optimization

### Tier 4: Operations (Before Launch)
- Deployment procedures
- Security & authentication
- Error handling
- Testing strategy

### Living Documents (Updated Continuously)
- **99_LIVING_CHANGELOG.md** - Claude Code updates after every session
- **25_TECHNICAL_DEBT.md** - TODOs and known issues

**See DOCUMENTATION_ROADMAP.md for complete structure**

---

## IMMEDIATE NEXT STEPS

### This Week: Complete Foundation Documentation

**Priority Order:**
1. ✅ Database Schema (DONE)
2. ✅ Content Pipeline (DONE)
3. ⬜ Migration Plan (NEXT)
4. ⬜ Admin Dashboard Requirements
5. ⬜ Decision Log
6. ⬜ MVP Definition
7. ⬜ Working with Claude Code
8. ⬜ Update this overview document (00_PROJECT_OVERVIEW.md)

### Next Week: Schema Migration

**Tasks:**
1. Export existing data from old schema
2. Create new tables (02_DATABASE_SCHEMA.md)
3. Migrate data with validation
4. Test with Chapter 1 words
5. Verify flashcard system still works

### Week 3: Content Pipeline Implementation

**Tasks:**
1. Build Python scripts (03_CONTENT_PIPELINE.md)
2. Process all El Principito chapters
3. Manual review workflow (Peter + fiancée)
4. Fix flagged translations
5. Achieve 99% accuracy

### Week 4: Admin Dashboard

**Tasks:**
1. Build lemma search/edit interface
2. Validation issues review queue
3. Bulk operations
4. Test manual editing workflow

---

## TEAM & ROLES

### Peter (Product Owner)
- **Responsibilities:** 
  - Product vision and strategy
  - Final decisions on features/scope
  - Manual translation review
  - User testing
- **Involvement:** All phases, hands-on with Claude Code

### Claude (Web Interface)
- **Responsibilities:**
  - Strategic planning
  - Documentation creation
  - Architecture design
  - Problem-solving guidance
- **Strengths:** Big-picture thinking, documentation, design

### Claude Code (Terminal Interface)
- **Responsibilities:**
  - Implementation of specs
  - Database migrations
  - Python scripting
  - Bug fixing and testing
- **Strengths:** Coding, technical execution, file management

### Native Spanish Speakers
- **Responsibilities:**
  - Translation accuracy review
  - Cultural context validation
  - Final quality gate before launch
- **Team:** Peter's fiancée + additional reviewers

---

## PROJECT HISTORY

### Phase 1: Original PHP Version
- Earlier iteration built in PHP
- Proved the concept
- Identified key features that work

### Phase 2: React Migration (2024-2025)
- Rebuilt in modern stack
- React + Supabase
- Modular architecture
- Better user experience

### Phase 3: Algorithm Refinement (Nov 2025)
- Added health system
- Priority scoring algorithm
- Spaced repetition improvements
- Major code refactoring

### Phase 4: Foundation Rebuild (Nov 30, 2025) ← WE ARE HERE
- Database schema redesign
- Content pipeline formalization
- Comprehensive documentation
- Quality-first approach

### Phase 5: MVP Completion (Target: Early 2026)
- All chapters imported
- 99% translation accuracy
- Beautiful UI
- Mobile-optimized
- Beta testing complete

---

## SUCCESS METRICS

### Launch Readiness Criteria

**Must Have:**
- ✅ Beautiful, mobile-optimized interface
- ✅ All El Principito chapters (Spanish → English)
- ✅ 99% translation accuracy verified
- ✅ Flashcard system with spaced repetition
- ✅ Chapter unlocking (100% word exposure)
- ✅ Interactive reading mode
- ✅ Admin dashboard for manual edits
- ✅ No crashes or major bugs
- ✅ Positive feedback from beta testers

**Nice to Have (Post-MVP):**
- Badges, XP, gamification
- Multiple languages (French, Italian)
- Audio pronunciation
- Social features/leaderboards
- Mobile apps (React Native)

### Quality Standards

- **Translation Accuracy:** 99%+
- **Lemma Assignment:** 100% semantically correct
- **Uptime:** 99.9%
- **Mobile Load Time:** <2 seconds
- **User Satisfaction:** 4.5+ stars from beta testers

---

## RISKS & MITIGATION

### Risk: Translation Quality Below 99%
**Mitigation:** Multi-layer validation (spaCy + DeepL + Claude AI + Manual review)

### Risk: Database Migration Loses Data
**Mitigation:** Full backup before migration, rollback plan documented

### Risk: Timeline Slips
**Mitigation:** MVP scope clearly defined, deferred features documented

### Risk: Mobile Performance Poor
**Mitigation:** Mobile-first design from start, performance testing on actual devices

### Risk: User Confusion with Interface
**Mitigation:** Beta testing with friends, iterative feedback, onboarding tutorial

---

## DEVELOPMENT PRINCIPLES

### 1. Function Over Form (Currently)
Get the learning algorithm perfect before polishing aesthetics. But design matters for MVP - balance both.

### 2. Document First, Code Second
Write specification documents before implementation. Prevents rework.

### 3. Quality Over Speed
99% accuracy is non-negotiable. Take time to get it right.

### 4. Concise Communication
Brief, actionable communication between team members. No verbose walls of text.

### 5. Incremental Progress
Small, verifiable steps. Test each phase before moving forward.

### 6. User-Centric Design
Every decision evaluated through lens of "Does this help users learn better?"

---

## FREQUENTLY ASKED QUESTIONS

**Q: Why The Little Prince?**  
A: Beautiful, timeless story. Appropriate vocabulary. Emotionally engaging. Short enough to complete, long enough to teach.

**Q: Why Spanish first?**  
A: Peter's focus, strong demand, well-supported by NLP tools (spaCy). French and Italian planned for later.

**Q: Why not use existing flashcard apps?**  
A: Generic flashcards lack literary context. Voquab integrates reading and learning. The story is the curriculum.

**Q: When will it launch?**  
A: When it's ready. No fixed date. Quality is non-negotiable.

**Q: Will it be free?**  
A: MVP will be free. Future monetization TBD (premium features, additional books, other languages).

**Q: Can I contribute?**  
A: After MVP launch, open to contributions. For now, focused small team.

---

## FILE STRUCTURE

```
/home/peter/voquab/
├── docs/
│   ├── DOCUMENTATION_ROADMAP.md
│   ├── 02_DATABASE_SCHEMA.md
│   ├── 03_CONTENT_PIPELINE.md
│   └── [other documentation]
├── src/
│   ├── components/
│   │   ├── flashcard/
│   │   │   ├── FlashcardDisplay.jsx
│   │   │   ├── DifficultyButtons.jsx
│   │   │   └── [other flashcard components]
│   │   └── [other components]
│   ├── hooks/
│   │   └── flashcard/
│   │       ├── useFlashcardData.js
│   │       ├── useFlashcardSession.js
│   │       └── useProgressTracking.js
│   ├── pages/
│   │   ├── Flashcards.jsx
│   │   ├── Book.jsx
│   │   ├── Home.jsx
│   │   └── [other pages]
│   └── utils/
│       ├── healthCalculations.js
│       ├── priorityCalculations.js
│       └── [other utilities]
├── scripts/
│   └── [content pipeline scripts]
└── [config files]
```

---

## RELATED DOCUMENTS

**Essential Reading:**
- **DOCUMENTATION_ROADMAP.md** - Start here for full documentation map
- **02_DATABASE_SCHEMA.md** - Understand data structure
- **03_CONTENT_PIPELINE.md** - Understand content workflow
- **01_MVP_DEFINITION.md** - Understand scope (coming soon)

**For Development:**
- **21_MIGRATION_PLAN.md** - How to migrate database (coming soon)
- **22_ADMIN_DASHBOARD.md** - Admin interface requirements (coming soon)
- **07_WORKING_WITH_CLAUDE_CODE.md** - How we collaborate (coming soon)

**For Context:**
- **23_DECISION_LOG.md** - Why we made these choices (coming soon)
- **99_LIVING_CHANGELOG.md** - What changed and when (coming soon)

---

## CONTACT & SUPPORT

**Project Lead:** Peter  
**Development Environment:** WSL Ubuntu on Windows  
**Project Location:** `/home/peter/voquab/`  
**Access from Windows:** `\\wsl$\Ubuntu\home\peter\voquab\`

**For New Conversations:**
Include DOCUMENTATION_ROADMAP.md and this PROJECT_OVERVIEW.md for context.

---

## REVISION HISTORY

- 2025-11-30: Complete rewrite for v2.0 architecture (Claude)
- Status: Awaiting Peter's approval

---

**END OF PROJECT OVERVIEW**
