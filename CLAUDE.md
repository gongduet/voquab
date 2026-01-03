# CLAUDE.md - Project Instructions for Claude Code

This file contains project-specific instructions that Claude Code should follow when working on this codebase.

## Project Overview

Voquab is a Spanish language learning app built with React + Vite + Supabase. Users learn vocabulary by reading "El Principito" (The Little Prince) with fragment-by-fragment comprehension and FSRS-based flashcard review.

## Key Documentation

**Keep these docs updated when making related changes:**

| Document | Purpose | Update When |
|----------|---------|-------------|
| `docs/99_LIVING_CHANGELOG.md` | Development diary | After any significant work |
| `docs/02_DATABASE_SCHEMA.md` | Database structure | Adding/changing tables or columns |
| `docs/31_SENTENCE_COMPREHENSION.md` | Reading Mode spec | Changing reading mode behavior |
| `docs/05_READING_EXPERIENCE.md` | Reading UX overview | Changing reading UI/UX |
| `docs/22_ADMIN_DASHBOARD.md` | Admin tools spec | Adding admin features |
| `docs/30_FSRS_ARCHITECTURE.md` | FSRS algorithm details | Changing flashcard scheduling |
| `CHANGELOG.md` | Release notes | At version milestones only |

## Documentation Update Protocol

**IMPORTANT: Keep documentation in sync with code changes.**

### After Completing Work, Check:

1. **Does this change behavior?** → Update the relevant spec doc
2. **Does this add/change database?** → Update `02_DATABASE_SCHEMA.md`
3. **Is this a significant change?** → Add entry to `99_LIVING_CHANGELOG.md`
4. **Does this complete a feature?** → Mark as "Implemented" in spec docs

### Documentation Update Checklist

When modifying these areas, update the corresponding docs:

- **Reading Mode changes** → `31_SENTENCE_COMPREHENSION.md`, `05_READING_EXPERIENCE.md`
- **Flashcard changes** → `30_FSRS_ARCHITECTURE.md`, `04_LEARNING_ALGORITHM.md`
- **Dashboard changes** → `22_ADMIN_DASHBOARD.md` (admin) or dashboard docs
- **Database changes** → `02_DATABASE_SCHEMA.md`
- **New hooks/services** → Add to architecture section of relevant doc
- **Bug fixes** → `99_LIVING_CHANGELOG.md`

### Spec Doc Update Format

When a feature is implemented, update the spec:
1. Change status from "Planned" to "Implemented"
2. Add implementation notes if behavior differs from spec
3. Update revision history at bottom of doc

## Changelog Protocol

**IMPORTANT: Update the changelog after completing significant work.**

### When to Update `docs/99_LIVING_CHANGELOG.md`

Update the living changelog after:
1. Completing a feature or bug fix
2. Making database schema changes
3. Adding new components or hooks
4. Fixing significant bugs
5. At the end of a work session with multiple changes

### Changelog Entry Format

```markdown
## YYYY-MM-DD - Brief Description

### Feature Name (if applicable)
- Bullet points describing what was added/changed/fixed
- Include file paths for significant changes
- Note any breaking changes

### Bug Fixes
- Description of bug and fix

### Technical Details (optional)
- Implementation notes for complex changes
```

### What to Include

- Feature descriptions (user-facing behavior)
- File paths for new/modified files
- Database changes (new columns, tables, migrations)
- Bug fixes with root cause
- Breaking changes or deprecations

### What NOT to Include

- Minor refactoring without behavior change
- Comment/documentation-only changes
- Temporary debugging code

### Root CHANGELOG.md

Only update the root `CHANGELOG.md` at version milestones (e.g., v0.2.0 release). The living changelog in docs/ is the primary development record.

## Code Patterns

### React Hooks Location
- `src/hooks/reading/` - Reading mode hooks
- `src/hooks/flashcard/` - Flashcard session hooks

### Component Location
- `src/components/reading/` - Reading mode UI
- `src/components/flashcard/` - Flashcard UI
- `src/components/dashboard/` - Dashboard widgets
- `src/components/admin/` - Admin tools

### Database Operations
- Use `supabase` client from `src/lib/supabase.js`
- Progress hooks handle all DB operations (don't call supabase directly from components)

## Testing Checklist

Before marking work complete:
1. Check browser console for errors
2. Verify Vite HMR shows no errors
3. Run `npx eslint [modified files]` for lint errors
4. Test the feature in the browser

## Common Gotchas

1. **Stale Closures**: Use `useRef` pattern when callbacks need latest state
2. **Chapter Boundaries**: `nextSentencePreview` is null at chapter end, check `nextChapterPreview`
3. **FSRS State**: Use `reps >= 1` to check if a card has been introduced (no `introduced` column)
4. **Local Dates**: Use `formatLocalDate()` for user-facing dates, not `toISOString()`
5. **Card Queue State**: When modifying flashcard behavior, remember that `cardQueue` in `useFlashcardSession` is separate from `cards` state. Updates to one don't automatically reflect in the other.
6. **FSRS for Phrases**: Both lemmas AND phrases need `last_reviewed_at` saved for proper interval calculation. FSRS uses this to compute `elapsed_days`.

## Active Development Areas

Currently working on:
- Reading Mode (sentence comprehension with fragments)
- Chapter gate (vocab readiness check before advancing)
- Admin sentence management

## File Naming Conventions

- React components: `PascalCase.jsx`
- Hooks: `useCamelCase.js`
- Services: `camelCase.js`
- Documentation: `##_SCREAMING_SNAKE.md`
