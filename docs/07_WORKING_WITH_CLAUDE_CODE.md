# 07_WORKING_WITH_CLAUDE_CODE.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Team Roles](#team-roles)
3. [Workflow Pattern](#workflow-pattern)
4. [Handoff Protocol](#handoff-protocol)
5. [Communication Guidelines](#communication-guidelines)
6. [File Management](#file-management)
7. [Living Changelog](#living-changelog)
8. [Common Scenarios](#common-scenarios)

---

## OVERVIEW

Voquab development involves collaboration between three parties:
- **Peter:** Product owner, strategic decision maker
- **Claude (web):** Strategic partner, documentation creator, architect
- **Claude Code (terminal):** Implementation specialist, coder, file manager

This document explains how we work together effectively.

---

## TEAM ROLES

### Peter (Product Owner)

**Responsibilities:**
- Final decision authority on features and scope
- Manual translation review with native speakers
- User testing and feedback
- Strategic direction
- Hands-on with Claude Code when needed

**Primary Interfaces:**
- Discussions with Claude (web) for strategy
- Direct commands to Claude Code for implementation
- Manual work in admin dashboard

**Communication Style:**
- Brief and direct
- Prefers action over lengthy discussion
- Values systematic approaches

---

### Claude (Web Interface)

**Responsibilities:**
- Strategic planning and architecture
- Documentation creation (these guides)
- Problem-solving and design decisions
- Review implementation results
- Guide Peter through complex decisions

**What Claude DOES:**
- Discuss strategy and trade-offs
- Create specification documents
- Propose solutions to problems
- Review code results with Peter
- Update documentation

**What Claude DOESN'T DO:**
- Write code directly to files (can't access file system)
- Make final product decisions (Peter's role)
- Implement features (Claude Code's role)

**Communication Style:**
- Concise (200-500 words typical)
- Actionable ("here's what to do")
- Ask 1-2 clarifying questions max
- Reference existing docs instead of re-explaining

---

### Claude Code (Terminal Interface)

**Responsibilities:**
- Implement specifications from documents
- Write Python scripts, SQL migrations, React components
- Execute database migrations
- Run tests and verify implementations
- Update living changelog after each session

**What Claude Code DOES:**
- Read specification documents
- Write and modify code files
- Execute scripts and commands
- Run database queries
- Test implementations
- Report results back to Peter

**What Claude Code DOESN'T DO:**
- Make strategic decisions (Peter + Claude web)
- Create documentation (Claude web)
- Decide what features to build (Peter)

**Communication Style:**
- Executes clear instructions
- Reports progress and results
- Asks clarifying questions when specs ambiguous
- Updates changelog systematically

---

## WORKFLOW PATTERN

### Standard Process Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. PETER: Describes task or problem                   │
│     "We need to migrate the database schema"           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. CLAUDE (WEB): Strategic discussion                 │
│     - Understand requirements                           │
│     - Discuss options and trade-offs                    │
│     - Propose approach                                  │
│     - Get Peter's approval                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. CLAUDE (WEB): Create specification                 │
│     - Write detailed implementation guide               │
│     - Include SQL, Python, or React code examples       │
│     - Define success criteria                           │
│     - Save as markdown document                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. PETER: Hand spec to Claude Code                    │
│     - Start Claude Code session                         │
│     - Paste specification document                      │
│     - Give clear instruction: "Implement this spec"     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  5. CLAUDE CODE: Implementation                         │
│     - Read spec carefully                               │
│     - Ask clarifying questions if needed                │
│     - Write code, create files, run scripts             │
│     - Test implementation                               │
│     - Report results                                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  6. PETER: Share results with Claude (web)             │
│     - Paste Claude Code's output                        │
│     - Share any errors or issues                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  7. CLAUDE (WEB): Review and iterate                   │
│     - Analyze results                                   │
│     - Identify issues if any                            │
│     - Propose fixes or next steps                       │
│     - Update documentation if needed                    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  8. REPEAT: Until task complete                         │
│     - Iterate through steps 4-7 as needed               │
│     - Mark complete when success criteria met           │
└─────────────────────────────────────────────────────────┘
```

---

## HANDOFF PROTOCOL

### When Handing Specs to Claude Code

**DO:**
- ✅ Give Claude Code the complete markdown file
- ✅ Clearly state: "Implement this specification"
- ✅ Mention which section to start with if document is long
- ✅ Specify any constraints (e.g., "test with Chapter 1 only")
- ✅ Ask Claude Code to confirm understanding before starting

**DON'T:**
- ❌ Paraphrase the spec (give the full document)
- ❌ Leave ambiguity about what to implement
- ❌ Skip testing instructions
- ❌ Forget to mention database backups if needed

**Example Handoff:**
```
Hi Claude Code,

Please implement the database migration from this specification:
[Paste 21_MIGRATION_PLAN.md]

Start with Step 1: Create New Tables
Then proceed through each step sequentially.

Before running migration on production, test with Chapter 1 data only.

Confirm you understand the plan before starting.
```

---

### When Sharing Results with Claude (Web)

**DO:**
- ✅ Share what was implemented
- ✅ Copy any errors or warnings
- ✅ Mention if tests passed/failed
- ✅ Note any decisions Claude Code made

**DON'T:**
- ❌ Just say "it worked" (give details)
- ❌ Hide errors (Claude needs to see them)
- ❌ Forget to mention partial completions

**Example Result Sharing:**
```
Claude Code completed Step 1-3 of the migration:
- Created new tables (lemmas, words, user_lemma_progress)
- Migrated 1,172 lemmas from vocabulary table
- Mapped all canonical relationships

Got this warning:
"15 verbs without canonical_vocab_id, created as standalone lemmas"

Test query for flashcards returned correct results.

What should we do about the 15 orphaned verbs?
```

---

## COMMUNICATION GUIDELINES

### For Claude (Web)

**When Creating Specs:**
- Be specific and actionable
- Include complete code examples
- Define success criteria clearly
- Anticipate edge cases
- Reference other docs when relevant

**When Reviewing Results:**
- Analyze what worked and what didn't
- Propose specific fixes (not vague suggestions)
- Update docs if we learned something new
- Celebrate successes ("Great, that worked perfectly")

---

### For Claude Code

**When Reading Specs:**
- Read the entire document before starting
- Ask clarifying questions if anything is ambiguous
- Confirm understanding of success criteria
- Note any sections that seem risky

**When Reporting Results:**
- State what was completed
- Share exact error messages if any
- Mention any decisions you made
- Update the living changelog
- Suggest next steps

---

### For Peter

**When Working with Both:**
- Keep conversations focused on current task
- Share context between both Claudes (paste relevant outputs)
- Make final decisions when trade-offs arise
- Trust the process (discuss strategy with web, implement with terminal)

---

## FILE MANAGEMENT

### Directory Structure

```
/home/peter/voquab/
├── docs/                    # All documentation (managed by Claude web)
│   ├── DOCUMENTATION_ROADMAP.md
│   ├── 00_PROJECT_OVERVIEW.md
│   ├── 02_DATABASE_SCHEMA.md
│   └── [other docs]
├── src/                     # React application (managed by Claude Code)
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── utils/
├── scripts/                 # Python scripts (managed by Claude Code)
│   ├── process_chapter.py
│   ├── migrate_schema.py
│   └── [other scripts]
├── migrations/              # SQL migrations (managed by Claude Code)
│   └── [timestamped files]
└── [config files]
```

### File Ownership

**Claude (Web) Creates:**
- Documentation files in `/docs`
- Specification files for Claude Code
- Architecture diagrams (if needed)

**Claude Code Creates:**
- Source code in `/src`
- Python scripts in `/scripts`
- SQL migrations in `/migrations`
- Test files
- Config files

**Both Can Update:**
- `99_LIVING_CHANGELOG.md` (Claude Code updates after each session)
- `25_TECHNICAL_DEBT.md` (Both can identify debt)

---

### File Naming Conventions

**Documentation:**
- Two-digit prefix for order: `02_DATABASE_SCHEMA.md`
- SCREAMING_SNAKE_CASE.md
- Descriptive names

**Code:**
- camelCase for JavaScript: `useFlashcardData.js`
- PascalCase for components: `FlashcardDisplay.jsx`
- snake_case for Python: `migrate_schema.py`

**Migrations:**
- Timestamp prefix: `20251130_add_lemmas_table.sql`
- Descriptive name
- Sequential numbering

---

## LIVING CHANGELOG

### Purpose

`99_LIVING_CHANGELOG.md` tracks every change Claude Code makes to the project. This helps:
- Peter know what changed when
- Claude (web) understand current state
- Future conversations resume with context
- Track debugging history

### Claude Code's Responsibilities

After EVERY implementation session, Claude Code must update the changelog:

```markdown
## 2025-11-30 - Database Schema Migration

**Session Type:** Implementation  
**Duration:** ~2 hours  
**Spec Implemented:** 21_MIGRATION_PLAN.md (Steps 1-5)

### Changes Made:
- Created new tables: lemmas, words, user_lemma_progress, user_word_encounters
- Migrated 1,172 lemmas from vocabulary table
- Migrated 8,432 word instances from vocabulary_occurrences
- Created vocab_to_lemma_mapping temp table
- Ran validation queries (all passed)

### Files Modified:
- Created: /migrations/20251130_create_new_schema.sql
- Created: /migrations/20251130_migrate_data.sql
- Updated: /docs/99_LIVING_CHANGELOG.md

### Issues Encountered:
- 15 verbs without canonical_vocab_id (created as standalone lemmas)
- Duplicate lemma found: "el libro" (merged)

### Next Steps:
- Complete Step 6: Create User Word Encounters
- Run validation queries on user progress
- Test flashcard queries with new schema

### Testing Results:
✅ New tables created successfully
✅ Row counts match (1,172 lemmas from ~1,200 vocabulary entries)
✅ Foreign key constraints working
✅ Test flashcard query returned correct results
⚠️  15 orphaned verbs need manual review
```

### Format Rules

- **Date heading:** YYYY-MM-DD format
- **Session info:** Type, duration, what spec was implemented
- **Changes:** Specific files and tables modified
- **Issues:** Any problems encountered
- **Next steps:** What to do next
- **Testing:** Results of verification

---

## COMMON SCENARIOS

### Scenario 1: Database Migration

**Claude (Web):**
- Creates `21_MIGRATION_PLAN.md` with complete SQL and validation queries
- Discusses risks and rollback plan with Peter
- Gets approval

**Peter:**
- Creates full database backup
- Hands spec to Claude Code
- Asks Claude Code to test on Chapter 1 first

**Claude Code:**
- Reads spec carefully
- Runs Step 1 (create tables)
- Tests with sample data
- Reports success
- Proceeds to Step 2
- Updates changelog

**Back to Claude (Web):**
- Peter shares results
- Claude reviews validation queries
- Confirms migration successful
- Updates docs if needed

---

### Scenario 2: New Feature Development

**Claude (Web):**
- Discusses feature with Peter (purpose, scope)
- Checks if MVP-appropriate
- Creates technical spec with React component code
- Defines props, state, hooks needed

**Peter:**
- Approves spec
- Hands to Claude Code

**Claude Code:**
- Creates component files
- Implements according to spec
- Tests in browser
- Screenshots for Peter
- Updates changelog

**Back to Claude (Web):**
- Peter shares screenshots
- Claude provides feedback on UX
- Suggests refinements if needed

---

### Scenario 3: Bug Fix

**Peter:**
- Describes bug to Claude (web)
- Shares error messages

**Claude (Web):**
- Analyzes issue
- Identifies root cause
- Proposes fix with specific code changes
- Writes mini-spec (can be in conversation, not full doc)

**Peter:**
- Hands fix instructions to Claude Code

**Claude Code:**
- Implements fix
- Tests to verify bug gone
- Updates changelog

**Back to Claude (Web):**
- Peter confirms fix works
- Claude updates technical debt doc if relevant

---

### Scenario 4: Documentation Update

**Claude (Web):**
- Creates or updates documentation
- Saves as markdown file
- Shares with Peter for review

**Peter:**
- Reviews, requests changes if needed
- Approves

**Claude (Web):**
- Makes revisions
- Finalizes document
- Adds to `/docs` folder (via Claude Code if needed)

**Claude Code:**
- If file management needed, moves doc to correct location
- Updates changelog

---

## QUICK REFERENCE

### Handoff Checklist

**Before Handing to Claude Code:**
- [ ] Spec is complete and clear
- [ ] Success criteria defined
- [ ] Edge cases considered
- [ ] Database backup if needed
- [ ] Testing instructions included

**When Receiving from Claude Code:**
- [ ] Review what was implemented
- [ ] Check for errors or warnings
- [ ] Verify tests passed
- [ ] Note any decisions made
- [ ] Share results with Claude (web)

### Communication Templates

**Good Handoff to Claude Code:**
```
Please implement [SPEC NAME].

Start with [SECTION].
Test with [TEST CRITERIA].
Report results when complete.
```

**Good Result Sharing with Claude (Web):**
```
Claude Code completed [TASK].

✅ What worked:
- [List successes]

⚠️  Issues encountered:
- [List problems with error messages]

Next steps needed: [Questions or decisions]
```

---

## RELATED DOCUMENTS

- See **00_PROJECT_OVERVIEW.md** for project context
- See **01_MVP_DEFINITION.md** for scope decisions
- See **DOCUMENTATION_ROADMAP.md** for all doc references

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF COLLABORATION GUIDE**
