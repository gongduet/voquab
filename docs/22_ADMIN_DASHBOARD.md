# 22_ADMIN_DASHBOARD.md

**Last Updated:** December 30, 2025
**Status:** Phase 1 + Phase 2 + Admin Optimizations Complete
**Owner:** Claude + Peter

---

## IMPLEMENTATION STATUS

### Completed (Phase 1 + Phase 2 + Optimizations)

**Sentences Management:**
- ✅ Sentence Management table (`/admin/sentences`)
- ✅ Sentence Deep Dive view (`/admin/sentences/:id`)
- ✅ Fragment editing (inline translations + context notes)
- ✅ Words table with lemma info
- ✅ Phrase occurrences display
- ✅ Add phrase modal (link existing or create new)
- ✅ Sentences review workflow (`is_reviewed` toggle)

**Lemmas Management:**
- ✅ Lemmas page (`/admin/common-words`)
- ✅ Lemma Deep Dive page (`/admin/lemmas/:id`)
- ✅ Create New Lemma modal
- ✅ Lemma definition editing (multiple definitions)
- ✅ Lemma reassignment modal
- ✅ Lemma review workflow (`is_reviewed` toggle)
- ✅ Stop word toggle (on word rows)
- ✅ Advanced filters (POS, chapter, reviewed status, definition)
- ✅ Orphaned Words page (`/admin/lemmas/orphaned`)
- ✅ Delete lemma with safeguards (orphan/reassign options)
- ✅ Bulk word reassignment on lemma delete
- ✅ **Copy button** - One-click copy lemma to clipboard
- ✅ **Collins dictionary link** - Opens Spanish-English dictionary
- ✅ **Server-side pagination** - 50 lemmas per page via `search_lemmas` RPC
- ✅ **Debounced search** - 300ms delay for better performance
- ✅ **Inline definition editing** - Click to edit, Enter to save, Esc to cancel

**Phrases Management:**
- ✅ Phrases List page (`/admin/phrases`)
- ✅ Phrase Deep Dive page (`/admin/phrases/:id`)
- ✅ Create Phrase modal
- ✅ Phrases navigation tab
- ✅ **Copy button** - One-click copy phrase to clipboard
- ✅ **Server-side pagination** - 50 phrases per page via `search_phrases` RPC
- ✅ **Debounced search** - 300ms delay for better performance
- ✅ **Inline definition editing** - Click to edit, Enter to save, Esc to cancel

**Admin Access Control:**
- ✅ **is_admin flag** - Column in `user_settings` table
- ✅ **AdminRoute component** - Route protection via `src/components/AdminRoute.jsx`
- ✅ **Admin header link** - Amber shield icon in dashboard header (admins only)
- ✅ **Dashboard link** - "← Dashboard" link in admin header

**General:**
- ✅ Keyboard navigation throughout
- ✅ URL-based filter persistence

### Future (Phase 3+)
- 🔲 QA workflow (status tracking)
- 🔲 QA dashboard widget
- 🔲 Validation Queue (AI suggestions)

---

## ROUTES

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | `Admin.jsx` | Dashboard home with navigation |
| `/admin/common-words` | `AdminCommonWords.jsx` | Lemmas list with filters |
| `/admin/lemmas/orphaned` | `OrphanedWords.jsx` | Words without lemma assignments |
| `/admin/lemmas/:lemmaId` | `LemmaDeepDive.jsx` | Individual lemma management |
| `/admin/phrases` | `AdminPhrases.jsx` | Phrases list with filters |
| `/admin/phrases/:phraseId` | `PhraseDeepDive.jsx` | Individual phrase management |
| `/admin/sentences` | `AdminSentences.jsx` | Sentences list by chapter |
| `/admin/sentences/:sentenceId` | `SentenceDeepDive.jsx` | Individual sentence management |

**Note:** The `/admin/lemmas/orphaned` route must be defined BEFORE `/admin/lemmas/:lemmaId` in App.jsx to prevent "orphaned" from being matched as a lemmaId.

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Core Features](#core-features)
4. [Lemma Management](#lemma-management)
5. [Validation Queue](#validation-queue)
6. [Content Review](#content-review)
7. [✅ Sentence Management](#sentence-management) (Implemented)
8. [✅ Common Words](#common-words) (Implemented)
9. [Bulk Operations](#bulk-operations)
10. [UI/UX Requirements](#uiux-requirements)
11. [Database Operations](#database-operations)
12. [Implementation Notes](#implementation-notes)

---

## OVERVIEW

The Admin Dashboard is a critical MVP component that enables manual content curation, translation review, and quality control. It's the interface Peter and native speakers use to achieve 99% translation accuracy.

**Primary Users:** Peter, native Spanish speakers (fiancée + reviewers)  
**Primary Purpose:** Manual editing and quality control  
**Access Level:** Admin-only (RLS policy based on user role)

---

## USER ROLES

### Admin User

**Who:** Peter  
**Permissions:** Full access to all features  
**Can:**
- Edit lemmas (text, definitions, POS, gender)
- Approve/reject AI validation suggestions
- Manage stop words
- Bulk operations
- Delete entries (with confirmation)
- View all statistics

---

### Reviewer User

**Who:** Native Spanish speakers
**Permissions:** Limited to translation review
**Can:**
- View lemmas and definitions
- Suggest definition changes
- Flag incorrect lemmas
- Comment on translations

**Cannot:**
- Delete entries
- Change database structure
- Bulk operations

---

### Access Control Implementation

**Client-Side Route Protection:**

Admin routes are protected by the `AdminRoute` component (`src/components/AdminRoute.jsx`):

```jsx
// App.jsx
<Route path="/admin/*" element={
  <AdminRoute>
    <AdminLayout />
  </AdminRoute>
} />
```

**How AdminRoute works:**
1. Checks if user is authenticated (via `useAuth` context)
2. Queries `user_settings.is_admin` from database
3. Shows loading spinner while checking
4. Redirects to `/login` if not authenticated
5. Redirects to `/dashboard` if not admin
6. Renders children if `is_admin = true`

**Related Components:**
| Component | Location | Purpose |
|-----------|----------|---------|
| `ProtectedRoute` | `src/components/ProtectedRoute.jsx` | Auth check only (any logged-in user) |
| `AdminRoute` | `src/components/AdminRoute.jsx` | Auth + admin flag check |

**Database:**
- `user_settings.is_admin` (boolean) - Set manually in database for admin users

---

## CORE FEATURES

### 1. Dashboard Home

**Display:**
- Quality metrics summary
- Pending validation issues count
- Translation coverage statistics
- Recent activity log

**Metrics Widget:**
```
┌─────────────────────────────────────────────────────┐
│  Quality Overview                                   │
├─────────────────────────────────────────────────────┤
│  📊 Total Lemmas: 1,172                             │
│  ✅ With Definitions: 1,165 (99.4%)                  │
│  ⚠️  Pending Issues: 23                              │
│  📖 Sentences Translated: 463/463 (100%)            │
│  🎯 Quality Score: 98.8%                             │
│                                                     │
│  [View Pending Issues →]                            │
└─────────────────────────────────────────────────────┘
```

**Recent Activity:**
```
┌─────────────────────────────────────────────────────┐
│  Recent Changes                                     │
├─────────────────────────────────────────────────────┤
│  • 2 hours ago: Peter approved AI suggestion for    │
│    "desilusionado" → link to "desilusionar"        │
│  • 5 hours ago: Maria flagged "el asteroide" def    │
│  • Yesterday: Peter added definition for "cordero"  │
│  • 2 days ago: Batch update: 15 verbs marked        │
└─────────────────────────────────────────────────────┘
```

---

### 2. Navigation

**Main Menu:**
- 🏠 Dashboard (home)
- 📚 Lemma Manager
- ⚠️ Validation Queue (with badge showing count)
- 📖 Sentence Review
- 🔧 Bulk Operations
- 📊 Statistics
- ⚙️ Settings

---

## LEMMA MANAGEMENT

### Search & Filter Interface

**Search Bar:**
- Search by lemma text (Spanish)
- Search by definition (English)
- Search by chapter
- Autocomplete suggestions

**Filters:**
- Part of Speech (NOUN, VERB, ADJ, ADV, etc.)
- Gender (M, F, N/A)
- Has Definition (Yes/No)
- Is Stop Word (Yes/No)
- Chapter (1-27)
- Times in Book (range slider: 1-100+)

**Example UI:**
```
┌─────────────────────────────────────────────────────┐
│  Lemma Manager                                      │
├─────────────────────────────────────────────────────┤
│  Search: [vivir____________] 🔍                     │
│                                                     │
│  Filters:                                           │
│  POS: [All ▼] Gender: [All ▼] Chapter: [All ▼]    │
│  □ Has Definition  □ Stop Words Only                │
│                                                     │
│  [Apply Filters] [Clear]                            │
└─────────────────────────────────────────────────────┘
```

---

### Lemma List View

**Table Columns:**
- Lemma Text (Spanish)
- Definitions (first definition shown, +2 more indicator)
- Part of Speech
- Gender (if noun)
- Times in Book
- Actions (Edit, Delete)

**Example:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Results: 1 lemma                                                 │
├──────────────┬─────────────┬─────┬────────┬───────┬──────────────┤
│ Lemma        │ Definition  │ POS │ Gender │ Count │ Actions      │
├──────────────┼─────────────┼─────┼────────┼───────┼──────────────┤
│ vivir        │ to live,    │VERB │  -     │  42   │ [Edit] [Del] │
│              │ to reside   │     │        │       │              │
└──────────────┴─────────────┴─────┴────────┴───────┴──────────────┘
```

**Sorting:**
- Click column headers to sort
- Default: Alphabetical by lemma text

**Pagination:**
- 25 results per page
- Page navigation at bottom

---

### Lemma Edit Modal

**Triggered By:** Click "Edit" button  
**Modal Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Edit Lemma                                    [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Lemma Text (Spanish):                              │
│  [vivir_____________________]                       │
│                                                     │
│  Part of Speech:                                    │
│  [VERB ▼]                                           │
│                                                     │
│  Gender (for nouns):                                │
│  [Not Applicable ▼]                                 │
│                                                     │
│  Definitions (max 5):                               │
│  1. [to live___________________] [Remove]           │
│  2. [to reside_________________] [Remove]           │
│  [+ Add Definition]                                 │
│                                                     │
│  □ Mark as stop word                                │
│                                                     │
│  Admin Notes:                                       │
│  [Optional notes for future reference_________]     │
│  [_____________________________________________]    │
│                                                     │
│  Times in Book: 42 (read-only)                      │
│  Last Modified: 2025-11-28 (read-only)              │
│                                                     │
│  [Cancel]  [Save Changes]                           │
└─────────────────────────────────────────────────────┘
```

**Validation:**
- Lemma text required
- At least one definition required
- Gender required for nouns
- Definitions max 5 items
- Show character count (max 200 per definition)

**Save Behavior:**
- Update lemmas table
- Timestamp updated_at field
- Log change to audit log
- Show success message

---

### View Word Instances

**Feature:** Click lemma to see all word instances  
**Purpose:** Understand how word appears in context

**Modal:**
```
┌─────────────────────────────────────────────────────┐
│  Word Instances for: vivir                     [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Found in 42 sentences across 8 chapters            │
│                                                     │
│  Chapter 1, Sentence 3:                             │
│  "Cuando yo tenía seis años, vi una vez una        │
│   magnífica lámina en un libro sobre el bosque     │
│   virgen que se llamaba Historias vividas."        │
│                                                     │
│   Form: vividas (past participle, feminine plural)  │
│   Position: Word 23 of 25                           │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Chapter 2, Sentence 5:                             │
│  "Viví solo, sin nadie con quien poder hablar      │
│   verdaderamente..."                                │
│                                                     │
│   Form: Viví (preterite, first person singular)    │
│   Position: Word 1 of 10                            │
│                                                     │
│  [Showing 2 of 42] [Load More]                      │
│                                                     │
│  [Close]                                            │
└─────────────────────────────────────────────────────┘
```

---

## VALIDATION QUEUE

### Purpose

Review AI-flagged translation issues from content pipeline (Step 8 of 03_CONTENT_PIPELINE.md).

**Issue Types:**
- `wrong_lemma`: spaCy assigned incorrect canonical form
- `wrong_definition`: DeepL translation inaccurate for context
- `wrong_pos`: Part of speech tag incorrect

---

### Queue View

**Filter Options:**
- All Issues
- Wrong Lemma
- Wrong Definition
- Wrong POS
- High Confidence Only (≥80%)
- By Chapter

**List Display:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Validation Queue (23 pending)                                    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Issue #1 - Wrong Definition (Confidence: 85%)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                   │
│  Spanish Sentence:                                                │
│  "El cordero se comió la flor."                                   │
│                                                                   │
│  English Translation:                                             │
│  "The lamb ate the flower."                                       │
│                                                                   │
│  Word in Question: el cordero                                     │
│  Current Definition: "the rope"                                   │
│  AI Suggestion: "the lamb"                                        │
│                                                                   │
│  AI Explanation:                                                  │
│  "In this context, 'cordero' refers to a young sheep (lamb),      │
│   not a rope (cuerda). The sentence talks about an animal eating  │
│   a flower, confirming this is the animal meaning."               │
│                                                                   │
│  [Approve AI Suggestion] [Reject] [Edit Manually]                │
│  ───────────────────────────────────────────────────────────────  │
└───────────────────────────────────────────────────────────────────┘
```

---

### Actions

**Approve AI Suggestion:**
- Updates definition in lemmas table
- Marks issue as `approved` in validation_issues
- Shows success message
- Moves to next issue

**Reject:**
- Keeps current definition
- Marks issue as `rejected` in validation_issues
- Requires reason (text field)
- Moves to next issue

**Edit Manually:**
- Opens lemma edit modal
- Pre-fills with AI suggestion (editable)
- Save updates lemma and marks issue as `fixed`
- Moves to next issue

---

### Statistics

**Display at top:**
```
Total Issues: 23
  ✅ Approved: 0
  ❌ Rejected: 0
  ✏️  Manually Fixed: 0
  ⏳ Pending: 23

Progress: ▓▓▓░░░░░░░ 0% complete
```

---

## CONTENT REVIEW

### Sentence Review Table

**Purpose:** Review all sentences and translations  
**Filter:** By chapter, by translation status

**Display:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Sentence Review - Chapter 1                                      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sentence 1:                                                      │
│  ES: "Cuando yo tenía seis años, vi una vez una magnífica        │
│       lámina en un libro sobre el bosque virgen..."               │
│                                                                   │
│  EN: "When I was six years old, I once saw a magnificent         │
│       picture in a book about the virgin forest..."               │
│                                                                   │
│  [Edit Translation] [Flag Issue] ✓ Verified                      │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  Sentence 2:                                                      │
│  ...                                                              │
└───────────────────────────────────────────────────────────────────┘
```

**Edit Translation Button:**
- Opens modal with editable text area
- Save updates sentences table
- Logs change

**Flag Issue:**
- Creates validation issue manually
- Requires description
- Appears in validation queue

**Verified Checkmark:**
- Manually mark sentence as reviewed
- Updates sentence metadata

---

## ✅ SENTENCE MANAGEMENT

### Overview (Implemented)

**Route:** `/admin/sentences`
**Purpose:** Manage sentence content, paragraph breaks, and fragment translations for Reading Mode

### Components

```
src/pages/AdminSentences.jsx
src/components/admin/
├── SentenceTable.jsx       # Main Notion-style table
├── ParagraphToggle.jsx     # Inline toggle for is_paragraph_start
├── SentenceEditModal.jsx   # Edit modal for translations
└── FragmentEditor.jsx      # Fragment translation editor
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Admin                  Sentence Management                     ⚙️     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Chapter: [All Chapters ▼]  Search: [________________] 🔍               │
│                                                                         │
│  ┌──────┬────┬────────────────────────────────────┬──────────────┬────┐│
│  │  #   │ ¶  │ Spanish                            │ English      │ Fr ││
│  ├──────┼────┼────────────────────────────────────┼──────────────┼────┤│
│  │  1   │ ●  │ Cuando yo tenía seis años...      │ When I was...│  4 ││
│  │  2   │    │ Se veía en la lámina...           │ You could... │  3 ││
│  │  3   │ ●  │ Meditaba luego mucho...           │ I thought... │  2 ││
│  └──────┴────┴────────────────────────────────────┴──────────────┴────┘│
│                                                                         │
│  Showing 1-50 of 815 sentences                   [< Prev] [Next >]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Table Columns

| Column | Description |
|--------|-------------|
| **#** | Sentence order within chapter |
| **¶** | Paragraph toggle (● = starts paragraph) |
| **Spanish** | Sentence text (truncated, full on hover) |
| **English** | Translation (truncated, full on hover) |
| **Fr** | Fragment count |

### Paragraph Toggle

**Component:** `ParagraphToggle`
**Behavior:**
- Single click toggles `is_paragraph_start` boolean
- Optimistic update (UI changes immediately)
- Visual: `○` empty = false, `●` filled = true
- Background save to Supabase

```javascript
// Optimistic update pattern
setSentences(prev => prev.map(s =>
  s.sentence_id === sentenceId
    ? { ...s, is_paragraph_start: newValue }
    : s
))

// Then persist
await supabase
  .from('sentences')
  .update({ is_paragraph_start: newValue })
  .eq('sentence_id', sentenceId)
```

### Sentence Edit Modal

**Triggered by:** Click row or press Enter on selected row

```
┌─────────────────────────────────────────────────────────────┐
│  Edit Sentence #7                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Spanish (read-only):                                       │
│  ┌────────────────────────────────────────────────────────┐│
│  │ Cuando yo tenía seis años, vi una magnífica lámina    ││
│  │ en un libro sobre la selva virgen que se titulaba     ││
│  │ Historias Vividas.                                     ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  English Translation:                                       │
│  ┌────────────────────────────────────────────────────────┐│
│  │ When I was six years old, I saw a magnificent         ││
│  │ illustration in a book about the virgin forest        ││
│  │ called "True Stories."                                 ││
│  └────────────────────────────────────────────────────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Fragments:                                                 │
│                                                             │
│  1. "Cuando yo tenía seis años,"                           │
│     → When I was six years old,                            │
│     [Edit Fragment]                                         │
│                                                             │
│  2. "vi una magnífica lámina"                              │
│     → I saw a magnificent illustration                      │
│     [Edit Fragment]                                         │
│                                                             │
│  [Cancel]  [Save Changes]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between rows |
| `Enter` | Open edit modal for selected row |
| `P` | Toggle paragraph start for selected row |
| `Escape` | Close modal / Deselect row |

### Database Updates

**Toggle paragraph start:**
```sql
UPDATE sentences
SET is_paragraph_start = :value
WHERE sentence_id = :sentence_id;
```

**Update translation:**
```sql
UPDATE sentences
SET sentence_translation = :translation
WHERE sentence_id = :sentence_id;
```

**Update fragment:**
```sql
UPDATE sentence_fragments
SET
  fragment_translation = :translation,
  context_note = :note
WHERE fragment_id = :fragment_id;
```

### RLS Policy

```sql
-- Admins can update sentences
CREATE POLICY "Admins can update sentences" ON sentences
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
```

---

## ✅ COMMON WORDS

### Overview (Implemented)

**Route:** `/admin/common-words`
**Purpose:** Manage stop words (common words that shouldn't appear in learning sessions)

### Components

```
src/pages/AdminCommonWords.jsx
```

### Features

**Stats Cards:**
- Total Words count
- Stop Words count
- Active Learning Words count

**Filters:**
- Search by lemma or definition
- Filter: All / Active Only / Stop Words Only
- Sort: by Frequency / Alphabetically
- Sort order toggle (↑/↓)

**Bulk Actions Dropdown:**
- Mark Top 50 (by frequency)
- Mark Top 100 (by frequency)
- Mark Top 200 (by frequency)

**Table Columns:**
| Column | Description |
|--------|-------------|
| Word | Lemma text (Spanish) |
| Definition | First definition |
| POS | Part of speech |
| Frequency | Word count in book (color-coded) |
| Status | "stop" badge or dash |
| Actions | Mark/Unmark button + Find in sentences link |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between rows |
| `S` | Toggle stop word for selected row |

### Database Queries

**Fetch all lemmas (with count):**
```javascript
// Fetch lemmas (up to 10,000)
const { data } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word', { count: 'exact' })
  .eq('language_code', 'es')
  .range(0, 9999)

// Fetch word counts
const { data: allWords } = await supabase
  .from('words')
  .select('lemma_id')
  .range(0, 99999)

// Count per lemma
const countMap = allWords.reduce((acc, w) => {
  acc[w.lemma_id] = (acc[w.lemma_id] || 0) + 1
  return acc
}, {})
```

**Toggle stop word:**
```javascript
await supabase
  .from('lemmas')
  .update({ is_stop_word: newValue })
  .eq('lemma_id', lemmaId)
```

---

## BULK OPERATIONS

### Purpose

Efficient mass updates for specific scenarios.

**Available Operations:**

---

### 1. Bulk Mark Stop Words

**Use Case:** Mark common Spanish words as stop words

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  Bulk Mark Stop Words                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Enter lemmas (one per line):                       │
│  ┌──────────────────────────────────────────────┐  │
│  │ de                                           │  │
│  │ la                                           │  │
│  │ el                                           │  │
│  │ que                                          │  │
│  │ y                                            │  │
│  │ en                                           │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Preview: 6 lemmas will be updated                  │
│                                                     │
│  [Cancel]  [Mark as Stop Words]                     │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Finds each lemma by text
- Sets `is_stop_word = true`
- Shows confirmation
- Logs action

---

### 2. Bulk Update Definitions

**Use Case:** Add "the" or "to" prefix to many definitions

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  Bulk Update Definitions                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Filter lemmas:                                     │
│  POS: [VERB ▼]                                      │
│  Missing prefix: [to]                               │
│                                                     │
│  Found: 42 verbs with definitions missing "to"      │
│                                                     │
│  Action: Prepend "to " to first definition          │
│                                                     │
│  Preview:                                           │
│  • "live" → "to live"                               │
│  • "eat" → "to eat"                                 │
│  • "see" → "to see"                                 │
│  [Show all 42]                                      │
│                                                     │
│  [Cancel]  [Update All]                             │
└─────────────────────────────────────────────────────┘
```

---

### 3. Bulk Delete Lemmas

**Use Case:** Remove entries created by mistake

**Caution:** Destructive operation
**Requires:** Type confirmation (e.g., "DELETE") to proceed

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Bulk Delete Lemmas                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  WARNING: This will permanently delete lemmas       │
│  and all associated user progress.                  │
│                                                     │
│  Enter lemma IDs or texts (one per line):           │
│  ┌──────────────────────────────────────────────┐  │
│  │ [UUID or text]                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Preview: 0 lemmas will be deleted                  │
│                                                     │
│  Type DELETE to confirm:                            │
│  [________]                                         │
│                                                     │
│  [Cancel]  [Delete Permanently]                     │
└─────────────────────────────────────────────────────┘
```

---

## UI/UX REQUIREMENTS

### Design Principles

**1. Mobile-Responsive**
- Admin dashboard should work on tablet/desktop
- Mobile not primary use case (complex operations)
- Minimum width: 768px (tablet)

**2. Clear Visual Hierarchy**
- Important actions prominent (Approve/Reject)
- Destructive actions require confirmation
- Success/error states obvious

**3. Efficient Workflow**
- Keyboard shortcuts for common actions
- Batch operations accessible
- Minimal clicks to complete tasks

**4. Data Preservation**
- Auto-save drafts
- Confirm before destructive actions
- Undo capability for recent changes

---

### Visual Design

**Color Scheme:**
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)
- Info: Blue (#3b82f6)
- Neutral: Gray (#6b7280)

**Typography:**
- Spanish text: Clear, readable font (Inter or similar)
- Definitions: Slightly smaller, gray
- Actions: Bold, colored

**Spacing:**
- Generous padding for readability
- Clear separation between issues
- Grouped related fields

---

### Accessibility

**Requirements:**
- Keyboard navigation throughout
- Focus indicators visible
- Screen reader compatible (ARIA labels)
- Sufficient color contrast (WCAG AA)

---

## DATABASE OPERATIONS

### Read Operations

**Lemma Search:**
```sql
SELECT 
  l.lemma_id,
  l.lemma_text,
  l.definitions,
  l.part_of_speech,
  l.gender,
  l.is_stop_word,
  COUNT(w.word_id) as times_in_book
FROM lemmas l
LEFT JOIN words w ON l.lemma_id = w.lemma_id
WHERE 
  l.lemma_text ILIKE '%' || :search || '%'
  AND (:pos IS NULL OR l.part_of_speech = :pos)
  AND (:gender IS NULL OR l.gender = :gender)
GROUP BY l.lemma_id
ORDER BY l.lemma_text ASC
LIMIT 25 OFFSET :offset;
```

**Validation Queue:**
```sql
SELECT 
  vi.issue_id,
  vi.sentence_id,
  vi.word_text,
  vi.issue_type,
  vi.current_value,
  vi.suggested_value,
  vi.explanation,
  vi.confidence,
  s.sentence_text,
  s.sentence_translation
FROM validation_issues vi
JOIN sentences s ON vi.sentence_id = s.sentence_id
WHERE vi.status = 'pending'
ORDER BY vi.confidence DESC, vi.created_at ASC;
```

---

### Write Operations

**Update Lemma:**
```sql
UPDATE lemmas
SET 
  lemma_text = :lemma_text,
  definitions = :definitions,
  part_of_speech = :pos,
  gender = :gender,
  is_stop_word = :is_stop_word,
  admin_notes = :admin_notes,
  updated_at = NOW()
WHERE lemma_id = :lemma_id;
```

**Approve AI Suggestion:**
```sql
-- Update lemma
UPDATE lemmas
SET definitions = jsonb_set(
  definitions,
  '{0}',  -- Update first definition
  to_jsonb(:suggested_value)
)
WHERE lemma_id = (
  SELECT w.lemma_id FROM words w WHERE w.word_text = :word_text LIMIT 1
);

-- Mark issue as approved
UPDATE validation_issues
SET status = 'approved', resolved_at = NOW()
WHERE issue_id = :issue_id;
```

---

## IMPLEMENTATION NOTES

### Technology

**Frontend:**
- React component in `/src/pages/Admin.jsx`
- Sub-components in `/src/components/admin/`
- State management with React hooks

**Backend:**
- Supabase RLS policies (admin role required)
- SQL functions for complex operations
- Audit logging

---

### Security

**RLS Policies:**
```sql
-- Only admins can access admin tables
CREATE POLICY "Admins only" ON lemmas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
```

**Admin Role:**
- Stored in `user_roles` table
- Peter's user_id has role='admin'
- Reviewers have role='reviewer' (limited permissions)

---

### Audit Logging

**Track All Changes:**
```sql
CREATE TABLE admin_audit_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50),  -- 'update_lemma', 'approve_issue', etc.
  table_name VARCHAR(50),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- Track who changed what and when
- Rollback capability
- Debugging data issues

---

### Performance

**Optimizations:**
- Index on lemma_text for search
- Pagination (25 results per page)
- Lazy load word instances
- Cache frequent queries

**Expected Load:**
- 1-2 concurrent admin users
- Not high-traffic
- Can tolerate some latency (<500ms)

---

## QUICK REFERENCE

### Admin Dashboard Checklist

**Core Features:**
- [ ] Lemma search and filter
- [ ] Lemma edit modal
- [ ] View word instances
- [ ] Validation queue interface
- [ ] Approve/reject AI suggestions
- [ ] Sentence review table
- [ ] Bulk stop word marking
- [ ] Bulk definition updates

**Quality Metrics:**
- [ ] Translation coverage
- [ ] Definition coverage
- [ ] Pending issues count
- [ ] Quality score calculation

**Security:**
- [ ] Admin RLS policies
- [ ] Role-based access
- [ ] Audit logging
- [ ] Confirmation for destructive actions

---

## RELATED DOCUMENTS

- See **03_CONTENT_PIPELINE.md** for validation issue generation
- See **02_DATABASE_SCHEMA.md** for database structure
- See **01_MVP_DEFINITION.md** for MVP scope

---

## REVISION HISTORY

- 2025-12-24: Phase 2 complete - Added Phrases management (2c), Sentences review toggle (2d), Orphaned Words (2b), Lemma Deep Dive enhancements (2a), Routes section
- 2025-12-24: Added Implementation Status section, Common Words section, marked Phase 1 complete
- 2025-12-23: Added Sentence Management section (implemented)
- 2025-11-30: Initial draft (Claude)

---

**END OF ADMIN DASHBOARD SPECIFICATION**
