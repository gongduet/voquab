# VOQUAB DOCUMENTATION ROADMAP & BUILD GUIDE

**Purpose:** Master checklist for creating all project documentation  
**Use Case:** Resume documentation work in any conversation  
**Status:** Living document - update as we complete each item  
**Created:** November 30, 2025

---

## HOW TO USE THIS GUIDE

### Starting New Conversation:
```
"Continuing Voquab documentation work. 

Status: [X] documents complete, working on [Y] next.

See DOCUMENTATION_ROADMAP.md for context.

Current priority: [Document name]"
```

### Completing a Document:
1. Write document
2. Get user approval
3. Update this roadmap (mark ✅ and add date)
4. Move to next priority

---

## DOCUMENTATION PRIORITY TIERS

### **TIER 1: FOUNDATION (Create First)**
These are essential before any implementation work begins.

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 00 | PROJECT_OVERVIEW.md | ⬜ | 5-7 | What is Voquab, vision, goals |
| 01 | MVP_DEFINITION.md | ⬜ | 6-8 | What's in/out, success criteria |
| 02 | DATABASE_SCHEMA.md | ✅ | 8-10 | Complete SQL, relationships |
| 03 | CONTENT_PIPELINE.md | ✅ | 10-12 | Text → production workflow |
| 07 | WORKING_WITH_CLAUDE_CODE.md | ⬜ | 4-6 | Collaboration protocols |
| 21 | MIGRATION_PLAN.md | ⬜ | 6-8 | Old → new schema transition |
| 22 | ADMIN_DASHBOARD.md | ⬜ | 5-7 | Manual editing requirements |
| 23 | DECISION_LOG.md | ⬜ | 3-5 | Why we chose this approach |

**Total Tier 1:** 8 documents (~50-65 pages total)

---

### **TIER 2: CORE SYSTEMS (Create After Foundation)**
These define the learning algorithm and user experience.

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 04 | LEARNING_ALGORITHM.md | ⬜ | 12-15 | Spaced repetition, health, mastery | x
| 05 | READING_EXPERIENCE.md | ⬜ | 8-10 | Interactive reading design | x
| 15 | API_DOCUMENTATION.md | ⬜ | 6-8 | Supabase query patterns | x
| 16 | CODE_STYLE_GUIDE.md | ⬜ | 5-7 | React patterns, naming | x
| 17 | STATE_MANAGEMENT.md | ⬜ | 4-6 | Context, hooks, state patterns | x

**Total Tier 2:** 5 documents (~35-46 pages)

---

### **TIER 3: UI/UX & POLISH (Create During Implementation)**
These guide visual design and user interaction.

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 06 | UI_DESIGN_SYSTEM.md | ⬜ | 10-12 | Colors, fonts, components | x
| 18 | COMPONENT_LIBRARY.md | ⬜ | 8-10 | Reusable components catalog | x
| 13 | ACCESSIBILITY.md | ⬜ | 5-7 | WCAG, keyboard nav, screen readers | x
| 12 | PERFORMANCE.md | ⬜ | 6-8 | Load times, optimization | x

**Total Tier 3:** 4 documents (~29-37 pages)

---

### **TIER 4: OPERATIONS (Create Before Launch)**
These enable deployment, monitoring, and maintenance.

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 08 | DEPLOYMENT.md | ⬜ | 5-7 | Netlify, Supabase, env vars | x
| 09 | SECURITY_AUTH.md | ⬜ | 6-8 | RLS policies, auth flow | x
| 11 | ERROR_HANDLING.md | ⬜ | 5-7 | Error boundaries, logging | x
| 19 | TESTING_STRATEGY.md | ⬜ | 6-8 | Manual checklist, automation | x
| 24 | TROUBLESHOOTING.md | ⬜ | 4-6 | Common issues, solutions | x

**Total Tier 4:** 5 documents (~26-36 pages)

---

### **TIER 5: GROWTH (Create Post-MVP)**
These support scaling and future expansion.

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 10 | ANALYTICS_METRICS.md | ⬜ | 5-7 | What we track, privacy | x
| 14 | SEO_MARKETING.md | ⬜ | 6-8 | Meta tags, launch plan | x
| 20 | CONTENT_ROADMAP.md | ⬜ | 7-9 | Which books to add; Which languages to expand to; Content selection criteria; Book evaluation process | x
| 26 | ONBOARDING.md | ⬜ | 4-6 | New contributor setup |

**Total Tier 5:** 4 documents (~22-30 pages)

---

### **LIVING DOCUMENTS (Update Continuously)**

| # | Document Name | Status | Pages | Purpose |
|---|--------------|--------|-------|---------|
| 25 | TECHNICAL_DEBT.md | ⬜ | Growing | TODOs, shortcuts, refactoring |
| 30 | CHAPTER_IMPORT_CHECKLIST.md | ✅ | 10-12 | Step-by-step import process |
| 99 | LIVING_CHANGELOG.md | ✅ | Growing | Claude Code updates log |

---

## GRAND TOTAL

**All Documentation:** 28 documents  
**Estimated Total Pages:** ~200-250 pages  
**Critical Path (Tier 1):** 8 documents, ~60 pages

---

## DOCUMENT TEMPLATES

### Each document should include:

```markdown
# [DOCUMENT TITLE]

**Last Updated:** [Date]  
**Status:** [Draft/Review/Approved/Living]  
**Owner:** [Claude/Peter/Shared]

---

## TABLE OF CONTENTS
1. [Section 1]
2. [Section 2]
...

---

## OVERVIEW
[2-3 sentences: What this document covers and why it matters]

---

## [SECTION 1]
[Content]

---

## QUICK REFERENCE
[Key facts, formulas, or commands for quick lookup]

---

## RELATED DOCUMENTS
- See [Document X] for [related topic]
- Depends on [Document Y]
- Updates [Document Z]

---

## REVISION HISTORY
- 2025-11-30: Initial draft (Claude)
- 2025-12-01: Approved (Peter)
```

---

## DETAILED OUTLINES FOR TIER 1 DOCUMENTS

### 00_PROJECT_OVERVIEW.md

**Sections:**
1. What is Voquab
2. Core Philosophy (contextual learning through literature)
3. Target Users
4. Success Metrics
5. Project Timeline
6. Team & Roles

**Key Content:**
- "Companion to The Little Prince"
- Mobile-first, beautiful design
- 99% translation accuracy required
- Launch when El Principito complete

---

### 01_MVP_DEFINITION.md

**Sections:**
1. MVP Scope
2. What's IN MVP
3. What's NOT in MVP (deferred to v2)
4. Launch Criteria
5. Beta Testing Plan

**Key Content:**

**IN MVP:**
- Full El Principito (Spanish → English)
- Flashcard system with spaced repetition
- Interactive reading (click words)
- Chapter unlock (100% word exposure)
- Admin dashboard for edits
- Mobile-optimized UI
- Beautiful design

**NOT in MVP:**
- Badges, XP, waypoints
- Multiple languages
- Leaderboards
- Audio pronunciation

**Launch Criteria:**
- No crashes
- 99% translation accuracy
- Beautiful UI
- Works on mobile

---

### 02_DATABASE_SCHEMA.md

**Sections:**
1. Schema Philosophy
2. Content Tables (books, chapters, sentences)
3. Vocabulary Tables (lemmas, words)
4. User Progress Tables
5. Complete SQL Definitions
6. Indexes & Performance
7. Design Rationale

**Key Content:**
- Full CREATE TABLE statements
- Foreign key relationships
- Why we chose this structure over old schema
- How it prevents verb form flooding

---

### 03_CONTENT_PIPELINE.md

**Sections:**
1. Pipeline Overview (visual flowchart)
2. Step 1: Paste Chapter Text
3. Step 2: Split Sentences
4. Step 3: Tokenize + Lemmatize (spaCy)
5. Step 4: Get/Create Lemmas
6. Step 5: Insert Words
7. Step 6: Translate Lemmas (DeepL)
8. Step 7: Translate Sentences (DeepL)
9. Step 8: AI Semantic Validation (Claude)
10. Step 9: Manual Review
11. Code Examples
12. Error Handling

**Key Content:**
- Complete Python scripts
- spaCy configuration
- DeepL API usage
- Claude API validation prompt
- Edge cases (what if lemma exists, what if spaCy fails)

---

### 07_WORKING_WITH_CLAUDE_CODE.md

**Sections:**
1. Team Roles
2. Workflow Pattern
3. Handoff Protocol
4. File Management
5. Communication Style
6. Living Changelog Updates

**Key Content:**
- Claude (web): Strategy, design, documentation
- Claude Code: Implementation, testing
- Peter: Product decisions, manual review
- How to give Claude Code instructions
- How Claude Code updates changelog

---

### 21_MIGRATION_PLAN.md

**Sections:**
1. Current State (old schema)
2. Target State (new schema)
3. Data Export Scripts
4. Data Transformation Logic
5. Migration SQL
6. Validation Checklist
7. Rollback Plan

**Key Content:**
- Export queries for current data
- Mapping: vocabulary → lemmas + words
- SQL scripts to insert into new tables
- How to verify migration success
- What if migration fails (rollback steps)

---

### 22_ADMIN_DASHBOARD.md

**Sections:**
1. Requirements Overview
2. Lemma Search & Edit
3. Word Form Management
4. Validation Issues Queue
5. Bulk Operations
6. UI Mockups

**Key Content:**
- Search interface ("Find lemma: vivir")
- Edit form (definitions array, POS, gender)
- Validation issues list (flagged by AI)
- Approve/Edit/Reject buttons
- Bulk fix operations (e.g., "Mark all VERB lemmas as reviewed")

---

### 23_DECISION_LOG.md

**Sections:**
1. Schema Design Decisions
2. Content Pipeline Decisions
3. UI/UX Decisions
4. Technical Stack Decisions
5. Deferred Decisions

**Key Content:**
- **Why single lemmas table instead of three separate tables?** (Simplicity, clarity)
- **Why spaCy + DeepL?** (Accuracy + affordability)
- **Why AI validation?** (Can't manually review 1000+ words)
- **Why mobile-first?** (Primary use case)
- **Why defer badges/XP?** (Focus on core learning first)

---

## DEPENDENCIES MAP

```
00_PROJECT_OVERVIEW → (foundation for all others)
01_MVP_DEFINITION → (defines scope for all others)

02_DATABASE_SCHEMA ← depends on → 03_CONTENT_PIPELINE
    ↓                                ↓
21_MIGRATION_PLAN              22_ADMIN_DASHBOARD
                                     ↓
                              04_LEARNING_ALGORITHM

07_WORKING_WITH_CLAUDE_CODE → (guides all implementation)
23_DECISION_LOG → (explains rationale for everything)
99_LIVING_CHANGELOG → (updated by Claude Code after every session)
```

---

## IMPLEMENTATION SEQUENCE

### Week 1: Foundation Docs
- Create all Tier 1 documents (8 docs)
- Get Peter's approval on each
- Store in `/docs` folder

### Week 2: Schema Migration
- Claude Code implements 02_DATABASE_SCHEMA.md
- Claude Code runs 21_MIGRATION_PLAN.md
- Test with Chapter 1 data

### Week 3: Content Pipeline
- Claude Code implements 03_CONTENT_PIPELINE.md
- Process all El Principito chapters
- Manual review with Peter + fiancée

### Week 4: Admin Dashboard
- Claude Code implements 22_ADMIN_DASHBOARD.md
- Peter tests editing workflow
- Fix validation issues

### Week 5-8: Core Systems
- Create Tier 2 documents
- Implement learning algorithm
- Build reading experience

### Week 9-10: UI/UX
- Create Tier 3 documents
- Design system implementation
- Mobile optimization

### Week 11-12: Pre-Launch
- Create Tier 4 documents
- Testing, deployment, security
- Beta testing with friends

---

## QUALITY STANDARDS

### Each document must:
- ✅ Be 5-12 pages (not 50)
- ✅ Have clear sections with TOC
- ✅ Include code examples (where relevant)
- ✅ Cross-reference related docs
- ✅ Be actionable (Claude Code can implement from it)
- ✅ Be maintainable (easy to update)

### Each document must NOT:
- ❌ Be overly theoretical
- ❌ Duplicate content from other docs
- ❌ Be vague or ambiguous
- ❌ Include outdated information

---

## CURRENT STATUS

**Completed:** 5/29 documents (17%)
- 02_DATABASE_SCHEMA.md ✅
- 03_CONTENT_PIPELINE.md ✅
- 30_CHAPTER_IMPORT_CHECKLIST.md ✅
- 99_LIVING_CHANGELOG.md ✅

**In Progress:** Tier 1 Foundation docs
**Next Up:** 00_PROJECT_OVERVIEW.md

**Last Updated:** December 6, 2025
**Next Review:** After completing Tier 1 documents

### Major Milestone: El Principito Content Pipeline Complete
- All 27 chapters imported
- 1,658 unique lemmas (after AI validation cleanup)
- 844 phrases detected
- AI dictionary form validation process documented

---

## CONVERSATION HANDOFF TEMPLATE

**Copy/paste this to start new conversation:**

```
Continuing Voquab documentation work.

CURRENT STATUS:
- Tier 1: [X/8] complete
- Currently working on: [Document name]
- Last completed: [Document name, date]

IMMEDIATE TASK:
[Write/Review/Approve] [Document name]

See /docs/DOCUMENTATION_ROADMAP.md for full context.

Attached files:
- DOCUMENTATION_ROADMAP.md
- [Any completed documents]
- [Current document draft if in progress]
```

---

**END OF ROADMAP**
