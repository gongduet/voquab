# CLAUDE.md

## Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **Scheduling**: FSRS algorithm for spaced repetition
- **Styling**: CSS Modules

## Project Overview

Voquab is a Spanish language learning app. Users learn vocabulary by reading "El Principito" (The Little Prince) with fragment-by-fragment comprehension and FSRS-based flashcard review.

## Key Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build
npm run lint         # Run ESLint
npx eslint <file>    # Lint specific file
```

## Code Patterns

### File Locations
- `src/hooks/reading/` - Reading mode hooks
- `src/hooks/flashcard/` - Flashcard session hooks
- `src/components/reading/` - Reading mode UI
- `src/components/flashcard/` - Flashcard UI
- `src/components/dashboard/` - Dashboard widgets
- `src/components/admin/` - Admin tools

### Database Operations
- Use `supabase` client from `src/lib/supabase.js`
- Progress hooks handle all DB operations (don't call supabase directly from components)

## Common Gotchas

1. **Stale Closures**: Use `useRef` pattern when callbacks need latest state
2. **Chapter Boundaries**: `nextSentencePreview` is null at chapter end, check `nextChapterPreview`
3. **FSRS State**: Use `reps >= 1` to check if a card has been introduced (no `introduced` column)
4. **Local Dates**: Use `formatLocalDate()` for user-facing dates, not `toISOString()`
5. **Card Queue State**: `cardQueue` in `useFlashcardSession` is separate from `cards` state. Updates to one don't automatically reflect in the other.
6. **FSRS for Phrases**: Both lemmas AND phrases need `last_reviewed_at` saved for proper interval calculation. FSRS uses this to compute `elapsed_days`.

## Verification

Before marking work complete:
1. Check browser console for errors
2. Verify Vite HMR shows no errors
3. Run `npx eslint [modified files]` for lint errors
4. Test the feature in the browser
5. Test edge cases (empty states, chapter boundaries, etc.)

## Mistakes to Avoid

*(Add patterns here as we discover them)*

## Key Documentation

| Document | Purpose | Update When |
|----------|---------|-------------|
| `docs/99_LIVING_CHANGELOG.md` | Development diary | After significant work |
| `docs/02_DATABASE_SCHEMA.md` | Database structure | Adding/changing tables |
| `docs/31_SENTENCE_COMPREHENSION.md` | Reading Mode spec | Changing reading behavior |
| `docs/30_FSRS_ARCHITECTURE.md` | FSRS algorithm | Changing flashcard scheduling |
| `docs/22_ADMIN_DASHBOARD.md` | Admin tools spec | Adding admin features |

## Documentation Protocol

After completing work, check:
- **Behavior change?** → Update relevant spec doc
- **Database change?** → Update `02_DATABASE_SCHEMA.md`
- **Significant change?** → Add to `99_LIVING_CHANGELOG.md`
- **Feature complete?** → Mark "Implemented" in spec doc

## File Naming Conventions

- React components: `PascalCase.jsx`
- Hooks: `useCamelCase.js`
- Services: `camelCase.js`
- Documentation: `##_SCREAMING_SNAKE.md`
