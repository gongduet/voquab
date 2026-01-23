# Voquab Documentation Index

This is the navigation guide for all Voquab project documentation. Use this to quickly find the right document for your task. For a comprehensive list of what to update and when, see [00_DOCUMENTATION_ROADMAP.md](00_DOCUMENTATION_ROADMAP.md).

> **Note:** Some document numbers are duplicated (30, 32) due to organic growth. This doesn't affect functionality.

---

## Quick Reference

| Document | Status | Purpose |
|----------|--------|---------|
| [02_DATABASE_SCHEMA.md](02_DATABASE_SCHEMA.md) | Active | Complete database structure |
| [30_FSRS_ARCHITECTURE.md](30_FSRS_ARCHITECTURE.md) | Active | FSRS scheduling implementation |
| [31_SENTENCE_COMPREHENSION.md](31_SENTENCE_COMPREHENSION.md) | Implemented | Reading mode & fragments |
| [32_FRAGMENT_FLASHCARDS.md](32_FRAGMENT_FLASHCARDS.md) | Implemented | Fragment flashcard system |
| [22_ADMIN_DASHBOARD.md](22_ADMIN_DASHBOARD.md) | Complete | Admin tools spec |
| [99_LIVING_CHANGELOG.md](99_LIVING_CHANGELOG.md) | Living | Development diary |

---

## Foundation

Core documents that define what Voquab is and how it's structured.

### [00_DOCUMENTATION_ROADMAP.md](00_DOCUMENTATION_ROADMAP.md)
**Status:** Living | **Updated:** Nov 30, 2025

Master checklist for all project documentation.
- Documentation priority tiers
- Document templates
- Update protocols
- Completion tracking

### [00_PROJECT_OVERVIEW.md](00_PROJECT_OVERVIEW.md)
**Status:** Active | **Updated:** Dec 24, 2025

What Voquab is, its vision, and current state.
- Core philosophy (contextual learning, lemma mastery)
- Architecture overview
- Technology stack
- Team roles

### [01_MVP_DEFINITION.md](01_MVP_DEFINITION.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Defines the Minimum Viable Product scope.
- What's in/out of MVP
- Launch criteria
- Success metrics
- Beta testing plan

### [02_DATABASE_SCHEMA.md](02_DATABASE_SCHEMA.md)
**Status:** Active | **Updated:** Jan 22, 2026

Complete database structure with SQL definitions.
- 25+ tables (content, vocabulary, progress, user)
- Complete SQL with indexes and RLS policies
- Design rationale
- Schema philosophy

### [03_CONTENT_PIPELINE.md](03_CONTENT_PIPELINE.md)
**Status:** Active | **Updated:** Jan 2, 2026

Workflow for transforming Spanish text into production vocabulary.
- 11-step import process
- spaCy lemmatization, DeepL translation
- AI semantic validation
- Quality metrics

---

## Core Systems

Documents about the learning algorithm and main user experiences.

### [04_LEARNING_ALGORITHM.md](04_LEARNING_ALGORITHM.md)
**Status:** Active | **Updated:** Dec 30, 2025

FSRS-based spaced repetition system.
- FSRS algorithm explanation
- Session composition
- Exposure insurance
- 4-button rating system

### [05_READING_EXPERIENCE.md](05_READING_EXPERIENCE.md)
**Status:** Partially Implemented | **Updated:** Dec 23, 2025

Reading mode design and implementation.
- Fragment-by-fragment comprehension (implemented)
- Word-level tap-for-definition (future)
- Chapter navigation
- Mobile optimization

### [30_FSRS_ARCHITECTURE.md](30_FSRS_ARCHITECTURE.md)
**Status:** Active | **Updated:** Jan 22, 2026

Technical FSRS implementation details.
- Core components and service layer
- Database schema for FSRS state
- Fragment-specific FSRS scheduling
- Session building logic

### [31_SENTENCE_COMPREHENSION.md](31_SENTENCE_COMPREHENSION.md)
**Status:** Implemented | **Updated:** Dec 23, 2025

Bridge between vocabulary and reading comprehension.
- Fragment design philosophy
- Reading Mode vs Sentence Review
- Unlock logic
- FSRS integration

### [32_FRAGMENT_FLASHCARDS.md](32_FRAGMENT_FLASHCARDS.md)
**Status:** Implemented | **Updated:** Jan 22, 2026

Fragment flashcard system specification.
- Two modes: Read and Review
- 95% vocabulary unlock threshold
- Lower retention FSRS scheduling (0.80)
- Database tables and routes

---

## UI/UX

Visual design system and component specifications.

### [06_UI_DESIGN_SYSTEM.md](06_UI_DESIGN_SYSTEM.md)
**Status:** Draft | **Updated:** Dec 15, 2025

Visual design language for Voquab.
- Color palette and typography
- Spacing and layout system
- Shadows, iconography, animation
- Little Prince aesthetic

### [18_COMPONENT_LIBRARY.md](18_COMPONENT_LIBRARY.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Catalog of reusable UI components.
- Button, card, modal components
- Form and feedback components
- Layout patterns
- Accessibility defaults

---

## Operations

Deployment, security, testing, and troubleshooting.

### [07_WORKING_WITH_CLAUDE_CODE.md](07_WORKING_WITH_CLAUDE_CODE.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Team collaboration protocols.
- Roles (Peter, Claude web, Claude Code)
- Workflow patterns
- Handoff protocols
- Living changelog practice

### [08_DEPLOYMENT.md](08_DEPLOYMENT.md)
**Status:** Draft | **Updated:** Dec 15, 2025

Deployment procedures and environments.
- Netlify frontend hosting
- Supabase database
- CI/CD pipeline
- Rollback procedures

### [09_SECURITY_AUTH.md](09_SECURITY_AUTH.md)
**Status:** Active | **Updated:** Dec 30, 2025

Security practices and authentication.
- Supabase Auth (JWT)
- Row Level Security policies
- Data protection
- API security checklist

### [11_ERROR_HANDLING.md](11_ERROR_HANDLING.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Error handling patterns and user messaging.
- Error categories (network, auth, data)
- User-friendly messages
- Error recovery strategies
- Logging and reporting

### [19_TESTING_STRATEGY.md](19_TESTING_STRATEGY.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Testing philosophy and practices.
- Vitest + React Testing Library
- What to test vs not test
- Manual testing checklist
- Coverage goals

### [24_TROUBLESHOOTING.md](24_TROUBLESHOOTING.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Monitoring and debugging guide.
- Error tracking (Sentry)
- Performance monitoring
- Database monitoring
- Alerting setup

---

## Technical Standards

Code style, API patterns, and state management.

### [15_API_DOCUMENTATION.md](15_API_DOCUMENTATION.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Supabase API usage patterns.
- Database connection setup
- Common query patterns
- Row Level Security
- Stored functions

### [16_CODE_STYLE_GUIDE.md](16_CODE_STYLE_GUIDE.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Coding standards and conventions.
- File organization
- Naming conventions
- React patterns (hooks, components)
- CSS styling approach

### [17_STATE_MANAGEMENT.md](17_STATE_MANAGEMENT.md)
**Status:** Draft | **Updated:** Nov 30, 2025

React state management approach.
- Local vs global state
- Context providers
- Custom hooks patterns
- Data fetching strategies

---

## Performance & Quality

Performance optimization and accessibility.

### [12_PERFORMANCE.md](12_PERFORMANCE.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Mobile optimization and performance.
- Mobile-first design principles
- Responsive breakpoints
- Touch interactions
- Load time targets

### [13_ACCESSIBILITY.md](13_ACCESSIBILITY.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Accessibility standards and implementation.
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast requirements

---

## Growth & Analytics

Analytics, marketing, and growth strategy.

### [10_ANALYTICS_METRICS.md](10_ANALYTICS_METRICS.md)
**Status:** Draft | **Updated:** Dec 15, 2025

Analytics strategy and key metrics.
- North star metric (words mastered/week)
- User behavior tracking
- Privacy-first approach (Plausible)
- Retention analysis

### [14_SEO_MARKETING.md](14_SEO_MARKETING.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Marketing and growth plan.
- Target audience personas
- Launch strategy
- Growth channels
- Community building

---

## Planning & Strategy

Roadmaps, migrations, and decision records.

### [20_CONTENT_ROADMAP.md](20_CONTENT_ROADMAP.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Content expansion strategy.
- Current content (El Principito)
- Book selection criteria
- Language expansion plans
- Quality standards

### [21_MIGRATION_PLAN.md](21_MIGRATION_PLAN.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Database migration procedures.
- Migration philosophy
- Data transformation logic
- Validation and testing
- Rollback plan

### [22_ADMIN_DASHBOARD.md](22_ADMIN_DASHBOARD.md)
**Status:** Complete | **Updated:** Dec 30, 2025

Admin tools implementation spec.
- Lemmas management (create, edit, delete, reassign)
- Phrases management
- Sentences management with fragment editing
- Server-side pagination

### [23_DECISION_LOG.md](23_DECISION_LOG.md)
**Status:** Living | **Updated:** Nov 30, 2025

Record of major architectural decisions.
- Database architecture choices
- Content pipeline decisions
- Learning algorithm rationale
- Technology selections

### [27_FEATURE_PRIORITIZATION.md](27_FEATURE_PRIORITIZATION.md)
**Status:** Draft | **Updated:** Nov 30, 2025

Feature backlog and prioritization framework.
- RICE scoring methodology
- MVP vs post-MVP scope
- Anti-features (what NOT to build)
- Decision log

---

## Feature Specs

Detailed specifications for specific features.

### [30_CHAPTER_IMPORT_CHECKLIST.md](30_CHAPTER_IMPORT_CHECKLIST.md)
**Status:** Active | **Updated:** Dec 4, 2025

Step-by-step chapter import process.
- Pre-import checklist
- Import validation
- Post-import verification
- Error handling

### [32_LYRICS_DATABASE_SPEC.md](32_LYRICS_DATABASE_SPEC.md)
**Status:** Complete (Phase 6) | **Updated:** Jan 2, 2026

Database schema for lyrics/music learning.
- Song and album tables
- Slang vocabulary handling
- User progress tracking
- Word-level vocabulary linking

### [33_LIBRARY_DASHBOARD_SPEC.md](33_LIBRARY_DASHBOARD_SPEC.md)
**Status:** Ready for Implementation | **Updated:** Dec 25, 2025

Multi-content platform architecture.
- Unified vocabulary across content types
- Active book/song concept
- Three-level navigation
- Slang opt-in settings

### [34_LYRICS_IMPORT_PIPELINE.md](34_LYRICS_IMPORT_PIPELINE.md)
**Status:** Active | **Updated:** Jan 2, 2026

9-phase lyrics import workflow.
- Parse, translate, flag skippable
- Slang detection and vocabulary linking
- Word position tracking
- AI translation correction

---

## Reference

Living documents and FAQs.

### [29_FAQ.md](29_FAQ.md)
**Status:** Living | **Updated:** Dec 13, 2025

Frequently asked questions.
- General (what is Voquab, who is it for)
- Learning methodology
- Technical questions
- Troubleshooting

### [99_LIVING_CHANGELOG.md](99_LIVING_CHANGELOG.md)
**Status:** Living | **Updated:** Jan 22, 2026

Development diary tracking all changes.
- Added/Changed/Removed features
- Bug fixes
- Implementation notes
- Decision context
