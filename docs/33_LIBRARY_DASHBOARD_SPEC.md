# 33_LIBRARY_DASHBOARD_SPEC.md

**Last Updated:** December 25, 2025
**Status:** Ready for Implementation
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Immediate Bug Fixes](#immediate-bug-fixes)
3. [Architecture Changes](#architecture-changes)
4. [Database Changes](#database-changes)
5. [Route Structure](#route-structure)
6. [Component Specifications](#component-specifications)
7. [Implementation Phases](#implementation-phases)

---

## OVERVIEW

This document specifies the restructuring of Voquab from a single-book app to a multi-content platform supporting books, songs, and future content types (articles).

### Core Principles

1. **Vocabulary is unified, content is contextual**
   - Lemmas learned from any source count toward overall progress
   - Users engage with CONTENT (books, songs), not vocabulary lists
   - Progress feels personal: "I understand 63% of El Principito"

2. **Slang is song-specific**
   - Slang terms are ONLY taught within song context
   - Never mixed into general vocabulary reviews
   - Explicit/vulgar slang requires opt-in via settings (default OFF)

3. **Active content concept**
   - Users have active book and active song
   - Header shows current selection with quick switcher
   - Default: El Principito (first-time users)

4. **Three levels of navigation**
   - Main Dashboard: Overall Spanish progress (all content)
   - Library: Browse and select content
   - Content Dashboard: Deep dive into specific book/song

---

## IMMEDIATE BUG FIXES

Before restructuring, fix these blocking bugs:

### Bug 1: SlangFlashcards.jsx

**Error:** `column slang_terms_1.cultural_context does not exist`

**Fix:** Change `cultural_context` to `cultural_note` in the Supabase query.

```javascript
// Find and replace in the select query
// FROM: cultural_context
// TO: cultural_note
```

### Bug 2: SlangDeepDive.jsx

**Error:** `column song_slang.appears_in_line does not exist`

**Fix:** Change `appears_in_line` to `first_line_id` in the Supabase query.

---

## ARCHITECTURE CHANGES

### Information Flow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  MAIN DASHBOARD (/dashboard)                                │
│  - Overall vocabulary stats (ALL content combined)          │
│  - Streak, daily goals, activity                            │
│  - Quick actions: Review ALL, Learn New ALL                 │
│  - Active Content cards (quick access to book/song)         │
│  - Does NOT include slang in stats                          │
│                                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│    LIBRARY    │ │BOOK DASHBOARD │ │SONG DASHBOARD │
│   /library    │ │ /book/:id     │ │ /song/:id     │
│               │ │               │ │               │
│ Browse all    │ │ Book-specific │ │ Song-specific │
│ Set active    │ │ vocabulary    │ │ vocab + slang │
│               │ │ Chapters      │ │ Sections      │
│               │ │ Reading Mode  │ │ Study Mode    │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Header with Content Switcher

The header shows active content with dropdown to switch:

```
┌─────────────────────────────────────────────────────────────────┐
│  Voquab    [📖 El Principito ▼]              🔥14    ⚙️    [P]  │
└─────────────────────────────────────────────────────────────────┘

Dropdown contents:
┌─────────────────────────┐
│ BOOKS                   │
│ ✓ El Principito         │  ← Currently active
│                         │
│ SONGS                   │
│   Debí Tirar Más Fotos  │
│                         │
│ ────────────────────    │
│ 📚 Browse Library       │
└─────────────────────────┘
```

**Behavior:**
- Clicking content name navigates to that content's dashboard
- Checkmark indicates "active" status
- Selecting new content sets it as active AND navigates to it
- "Browse Library" goes to /library

---

## DATABASE CHANGES

### Add to user_settings table

```sql
-- Add active content tracking
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS active_book_id UUID REFERENCES books(book_id),
ADD COLUMN IF NOT EXISTS active_song_id UUID REFERENCES songs(song_id);

-- Add explicit content preference (for vulgar slang)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS allow_explicit_content BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_settings.active_book_id IS 'Currently active book for learning';
COMMENT ON COLUMN user_settings.active_song_id IS 'Currently active song for learning';
COMMENT ON COLUMN user_settings.allow_explicit_content IS 'Allow vulgar slang terms (default false)';
```

### Default Active Content

When user has no active_book_id set, default to El Principito:

```javascript
// In queries, use COALESCE or application logic
const activeBookId = userSettings.active_book_id || EL_PRINCIPITO_BOOK_ID;
```

---

## ROUTE STRUCTURE

### New Routes

```javascript
// App.jsx - New route structure

// Main routes
/                       → Redirect to /dashboard
/dashboard              → Main Dashboard (unified stats)
/library                → Library browser (all content)

// Book routes
/book/:bookId           → Book Dashboard
/book/:bookId/read      → Reading Mode
/book/:bookId/read/:ch  → Reading Mode at specific chapter
/book/:bookId/flashcards → Book-specific flashcards

// Song routes  
/song/:songId           → Song Dashboard
/song/:songId/study     → Lyrics study mode
/song/:songId/vocab     → Slang flashcards (song-specific)

// General routes (unchanged)
/flashcards             → General flashcards (all content, NO slang)
/settings               → Settings (add explicit content toggle)
/progress               → Progress page
/admin/*                → Admin routes (unchanged)
```

### Routes to Remove/Redirect

```javascript
// Remove these routes (no backward compatibility needed):
/read                   → Remove (use /book/:id/read)
/read/:chapterNumber    → Remove (use /book/:id/read/:ch)
/book                   → Remove (was generic, now /book/:id)
/songs                  → Remove (use /library with songs tab)
/songs/:songId/vocab    → Move to /song/:songId/vocab
/songs/:songId/study    → Move to /song/:songId/study
```

---

## COMPONENT SPECIFICATIONS

### 1. Header Component Updates

**File:** `src/components/Header.jsx` (or create new)

**New Features:**
- Content switcher dropdown
- Shows active book/song
- Quick navigation to content dashboards

```jsx
// ContentSwitcher component structure
function ContentSwitcher({ activeBook, activeSong, onSelect }) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <span>{activeBook?.title || 'Select Content'} ▼</span>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownSection title="Books">
          {userBooks.map(book => (
            <DropdownItem 
              key={book.book_id}
              active={book.book_id === activeBook?.book_id}
              onClick={() => onSelect('book', book.book_id)}
            />
          ))}
        </DropdownSection>
        <DropdownSection title="Songs">
          {userSongs.map(song => (
            <DropdownItem 
              key={song.song_id}
              active={song.song_id === activeSong?.song_id}
              onClick={() => onSelect('song', song.song_id)}
            />
          ))}
        </DropdownSection>
        <DropdownDivider />
        <DropdownItem onClick={() => navigate('/library')}>
          📚 Browse Library
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
```

---

### 2. Main Dashboard (`/dashboard`)

**File:** `src/pages/Dashboard.jsx` (refactor existing)

**Purpose:** Unified Spanish learning home

**Stats to show (ALL content, NO slang):**
- Total lemmas: Mastered / Familiar / Learning / Not Seen
- Total phrases learned
- Streak
- Today's activity

**Quick Actions:**
- Review (all due cards from all content, excludes slang)
- Learn New (all available from all content, excludes slang)

**Active Content Cards:**
- Card for active book (progress, due count, "Continue Reading" button)
- Card for active song (progress, due count, "Study Lyrics" button)
- If no active song, show "Browse Songs →"

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Good morning, Peter!                        │
│                                                                 │
│                      ┌────────────┐                             │
│                      │    726     │                             │
│                      │   words    │                             │
│                      │  learning  │                             │
│                      └────────────┘                             │
│                                                                 │
│         64          391          271          1763              │
│       MASTERED    FAMILIAR    LEARNING     NOT SEEN             │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │       Review         │  │      Learn New       │             │
│  │       49 due         │  │    98 available      │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Currently Learning                          View Library →     │
│                                                                 │
│  ┌─────────────────────────────┐  ┌─────────────────────────┐   │
│  │ 📖 El Principito            │  │ 🎵 Debí Tirar Más Fotos │   │
│  │    Chapter 5 of 27          │  │    Bad Bunny            │   │
│  │    ████████████░░░░ 63%     │  │    ████░░░░░░░░░░ 12%   │   │
│  │    32 due · 45 new          │  │    5 due · 36 new       │   │
│  │   [Continue Reading →]      │  │   [Study Lyrics →]      │   │
│  └─────────────────────────────┘  └─────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Today                               [Calendar heatmap]         │
│  23 words · 5 new · 12 min                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Data Queries:**

```javascript
// Total vocabulary stats (all content, no slang)
const { data: lemmaStats } = await supabase
  .from('user_lemma_progress')
  .select('mastery_score, fsrs_state')
  .eq('user_id', userId);

// Due for review (all content, no slang)
const { data: dueCards } = await supabase
  .from('user_lemma_progress')
  .select('lemma_id')
  .eq('user_id', userId)
  .lte('due_date', new Date().toISOString());

// Active content progress (book)
const { data: bookProgress } = await supabase
  .from('user_chapter_reading_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('book_id', activeBookId);

// Active content progress (song)
const { data: songProgress } = await supabase
  .from('user_song_progress')
  .select('*')
  .eq('user_id', userId)
  .eq('song_id', activeSongId);
```

---

### 3. Library Page (`/library`)

**File:** `src/pages/Library.jsx` (new)

**Purpose:** Browse all available content, set active content

**Features:**
- Tabs: Books | Songs | Articles (future)
- Grid of content cards
- Shows progress per item
- "Active" badge on current selections
- Click card → go to that content's dashboard
- "Set as Active" action

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Dashboard              Library              [Search...]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Books]    [Songs]    [Articles]                               │
│  ───────                                                        │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  📖             │  │  📖             │  │  📖             │  │
│  │  El Principito  │  │  Cien Años...   │  │  Don Quijote    │  │
│  │  A2-B1 · 27 ch  │  │  B2 · 20 ch     │  │  C1 · 52 ch     │  │
│  │  ████████░░ 63% │  │  🔒 Coming Soon │  │  🔒 Coming Soon │  │
│  │  ✓ ACTIVE       │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Content Card Component:**

```jsx
function ContentCard({ type, item, isActive, progress, onSelect }) {
  const icon = type === 'book' ? '📖' : '🎵';
  
  return (
    <div 
      className="border rounded-xl p-4 hover:border-primary-300 cursor-pointer"
      onClick={() => navigate(`/${type}/${item.id}`)}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-medium">{item.title}</h3>
      {type === 'song' && <p className="text-sm text-neutral-500">{item.artist}</p>}
      <p className="text-sm text-neutral-400">{item.difficulty} · {item.units} {type === 'book' ? 'chapters' : 'sections'}</p>
      
      {progress > 0 ? (
        <div className="mt-3">
          <div className="h-2 bg-neutral-100 rounded-full">
            <div 
              className="h-2 bg-primary-500 rounded-full" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm">{progress}%</span>
        </div>
      ) : (
        <button className="mt-3 text-sm text-primary-500">Start Learning →</button>
      )}
      
      {isActive && (
        <span className="mt-2 inline-block text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
          ✓ ACTIVE
        </span>
      )}
    </div>
  );
}
```

---

### 4. Book Dashboard (`/book/:bookId`)

**File:** `src/pages/BookDashboard.jsx` (new)

**Purpose:** Deep dive into specific book progress

**Stats to show:**
- Book completion percentage
- Vocabulary from this book (mastered/familiar/learning/not seen)
- Phrases from this book
- Chapter progress cards

**Actions:**
- Review (this book's vocabulary only)
- Learn New (this book's vocabulary only)
- Continue Reading (resume position)

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Library              El Principito                     ⋮     │
│                    Antoine de Saint-Exupéry                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌────────────┐                             │
│                      │    63%     │                             │
│                      │  Complete  │                             │
│                      └────────────┘                             │
│                                                                 │
│         64          391          271          523               │
│       MASTERED    FAMILIAR    LEARNING     NOT SEEN             │
│                                                                 │
│         Phrases: 176 of 844                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │       Review         │  │      Learn New       │             │
│  │       32 due         │  │    45 available      │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              📖 Continue Reading                         │   │
│  │              Chapter 5 · Sentence 12                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Chapters                                                       │
│                                                                 │
│  [Chapter cards grid - same as current Dashboard]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Data Queries:**

```javascript
// Get book info
const { data: book } = await supabase
  .from('books')
  .select('*')
  .eq('book_id', bookId)
  .single();

// Get vocabulary stats for THIS book only
// Join through: lemmas → words → sentences → chapters → book
const { data: bookLemmas } = await supabase
  .from('lemmas')
  .select(`
    lemma_id,
    words!inner(
      sentences!inner(
        chapters!inner(book_id)
      )
    )
  `)
  .eq('words.sentences.chapters.book_id', bookId);

// Then cross-reference with user_lemma_progress
```

---

### 5. Song Dashboard (`/song/:songId`)

**File:** `src/pages/SongDashboard.jsx` (new, replaces current song detail)

**Purpose:** Deep dive into specific song progress

**Stats to show:**
- Song completion percentage
- Standard vocabulary from this song (via song_lemmas)
- Slang terms (via song_slang) - separate section
- Section progress cards

**Actions:**
- Learn Slang (this song's slang only, respects explicit setting)
- Review (this song's vocabulary, includes slang if learned)
- Study Lyrics (resume position)

**Explicit Content Handling:**

```javascript
// Filter slang based on user settings
const { data: slangTerms } = await supabase
  .from('song_slang')
  .select(`
    slang_terms(*)
  `)
  .eq('song_id', songId);

// If !userSettings.allow_explicit_content, filter out vulgar terms
const filteredSlang = userSettings.allow_explicit_content 
  ? slangTerms 
  : slangTerms.filter(s => s.slang_terms.formality !== 'vulgar');
```

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Library          Debí Tirar Más Fotos                  ⋮     │
│                Bad Bunny · Puerto Rican Spanish                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌────────────┐                             │
│                      │    12%     │                             │
│                      │  Complete  │                             │
│                      └────────────┘                             │
│                                                                 │
│        Standard Vocab              Slang Terms                  │
│       5/12/20/23 learned          2/8/10/18 learned             │
│                                                                 │
│    Themes: nostalgia · memory · home · friendship               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │     Learn Slang      │  │       Review         │             │
│  │     36 terms         │  │      5 due           │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               🎵 Study Lyrics                            │   │
│  │               Pre-Chorus · Line 3                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Sections                                                       │
│                                                                 │
│  [Section cards grid]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6. Settings Updates

**File:** `src/pages/Settings.jsx` (update existing)

**Add new section:**

```jsx
<section className="mt-8">
  <h2 className="text-lg font-medium mb-4">Content Preferences</h2>
  
  <div className="flex items-center justify-between py-3 border-b">
    <div>
      <p className="font-medium">Explicit Content</p>
      <p className="text-sm text-neutral-500">
        Allow vulgar slang terms in song vocabulary
      </p>
    </div>
    <Toggle 
      checked={settings.allow_explicit_content}
      onChange={(val) => updateSetting('allow_explicit_content', val)}
    />
  </div>
</section>
```

---

## IMPLEMENTATION PHASES

### Phase 0: Bug Fixes (Do First)

1. Fix `SlangFlashcards.jsx`: `cultural_context` → `cultural_note`
2. Fix `SlangDeepDive.jsx`: `appears_in_line` → `first_line_id`
3. Verify both pages work

**Estimated time:** 15 minutes

---

### Phase 1: Database + Settings

1. Run migration to add columns to user_settings
2. Update Settings.jsx with explicit content toggle
3. Create hook/context for user settings with defaults

**Files to modify:**
- Create migration SQL
- `src/pages/Settings.jsx`
- `src/hooks/useUserSettings.js` (create or update)

**Estimated time:** 1-2 hours

---

### Phase 2: Header Content Switcher

1. Create ContentSwitcher component
2. Integrate into existing header/layout
3. Wire up active content state
4. Navigation on selection

**Files to create/modify:**
- `src/components/ContentSwitcher.jsx` (new)
- `src/components/Header.jsx` or equivalent
- Update layout components

**Estimated time:** 3-4 hours

---

### Phase 3: Library Page

1. Create Library.jsx page
2. Content cards for books and songs
3. Tab switching (Books | Songs)
4. Active status indicators
5. Navigation to content dashboards

**Files to create:**
- `src/pages/Library.jsx`
- `src/components/library/ContentCard.jsx`

**Estimated time:** 3-4 hours

---

### Phase 4: Book Dashboard

1. Create BookDashboard.jsx
2. Move chapter grid from current Dashboard
3. Book-specific vocabulary stats
4. Book-specific Review/Learn New buttons
5. Continue Reading integration

**Files to create/modify:**
- `src/pages/BookDashboard.jsx` (new)
- Extract chapter components from Dashboard

**Estimated time:** 4-5 hours

---

### Phase 5: Song Dashboard

1. Create SongDashboard.jsx (replace current song detail view)
2. Song-specific vocabulary + slang stats
3. Explicit content filtering
4. Section progress cards
5. Study Lyrics / Learn Slang buttons

**Files to create/modify:**
- `src/pages/SongDashboard.jsx` (new)
- Update or replace Songs.jsx

**Estimated time:** 4-5 hours

---

### Phase 6: Main Dashboard Refactor

1. Refactor Dashboard.jsx for unified stats
2. Remove chapter grid (moved to BookDashboard)
3. Add Active Content cards
4. Update queries to exclude slang from main stats
5. "View Library" link

**Files to modify:**
- `src/pages/Dashboard.jsx`

**Estimated time:** 3-4 hours

---

### Phase 7: Route Restructure

1. Update App.jsx with new route structure
2. Create route for /book/:bookId/read
3. Update ReadingMode to accept bookId param
4. Remove old routes
5. Update all internal navigation links

**Files to modify:**
- `src/App.jsx`
- `src/pages/ReadingMode.jsx`
- Various components with navigation

**Estimated time:** 2-3 hours

---

### Phase 8: Polish

1. Mobile responsiveness check
2. Loading states
3. Empty states
4. Error handling
5. Animations/transitions

**Estimated time:** 2-3 hours

---

## TOTAL ESTIMATED TIME

| Phase | Time |
|-------|------|
| Phase 0: Bug Fixes | 15 min |
| Phase 1: Database + Settings | 1-2 hrs |
| Phase 2: Header Content Switcher | 3-4 hrs |
| Phase 3: Library Page | 3-4 hrs |
| Phase 4: Book Dashboard | 4-5 hrs |
| Phase 5: Song Dashboard | 4-5 hrs |
| Phase 6: Main Dashboard Refactor | 3-4 hrs |
| Phase 7: Route Restructure | 2-3 hrs |
| Phase 8: Polish | 2-3 hrs |
| **Total** | **23-31 hours** |

---

## RELATED DOCUMENTS

- **02_DATABASE_SCHEMA.md** - Base schema
- **32_LYRICS_DATABASE_SPEC.md** - Song tables
- **06_UI_DESIGN_SYSTEM.md** - Design patterns

---

## REVISION HISTORY

- 2025-12-25: Initial specification (Claude + Peter)
- Status: Ready for Implementation

---

**END OF LIBRARY DASHBOARD SPECIFICATION**
