# Admin Suite Specification v1.0

**Date:** December 23, 2025  
**For:** Claude Code Implementation  
**Status:** Ready for Development

---

## Executive Summary

Extend Voquab's admin interface with comprehensive content curation tools. The core addition is the **Sentence Deep Dive** view showing complete sentence breakdown with editable words, lemmas, and phrases. Also includes Lemma Management, Phrase Management, and UI alignment for Common Words.

**Design Language:** Notion-like aesthetic (already established in AdminSentences). Clean, minimal, keyboard-friendly.

---

## Table of Contents

1. [Existing Patterns to Follow](#1-existing-patterns-to-follow)
2. [Phase 1: Sentence Deep Dive](#2-phase-1-sentence-deep-dive)
3. [Phase 2: Lemma Management](#3-phase-2-lemma-management)
4. [Phase 3: Phrase Management](#4-phase-3-phrase-management)
5. [Phase 4: Common Words UI Refresh](#5-phase-4-common-words-ui-refresh)
6. [Phase 5: QA Workflow](#6-phase-5-qa-workflow)
7. [Navigation Updates](#7-navigation-updates)
8. [Database Operations Reference](#8-database-operations-reference)

---

## 1. Existing Patterns to Follow

Review these files before implementing. They establish the Notion aesthetic:

```
src/pages/Admin.jsx                    # Layout, header, tab navigation
src/pages/AdminSentences.jsx           # Filters, keyboard shortcuts pattern
src/components/admin/SentenceTable.jsx # Table styling (.admin-table)
src/components/admin/SentenceEditModal.jsx # Modal structure
src/components/admin/FragmentEditor.jsx    # Inline editing pattern
```

**Key Patterns:**
- **Colors:** neutral-50 bg, neutral-200 borders, blue-500 focus, blue-600 primary buttons
- **Typography:** System sans-serif (NOT font-serif), text-sm for body, text-xs for labels
- **Tables:** .admin-table class with subtle borders, gray-50 header bg
- **Modals:** White bg, rounded-xl, shadow-2xl, gray-50 footer
- **Inline Editing:** Edit icon reveals inputs, green checkmark/X to save/cancel
- **Keyboard Shortcuts:** Display hint bar below filters

---

## 2. Phase 1: Sentence Deep Dive

### Route
`/admin/sentences/:sentenceId`

### Entry Point
Click sentence row in AdminSentences table (replace current Edit button behavior, or add "Deep Dive" link).

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Admin / Sentences / Sentence #1                                    Logout  │
│                                                                             │
│ Sentence Deep Dive                                                          │
│ Chapter 1, Sentence 1                                          [← Back]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ SENTENCE                                                          [status] │
│ ─────────────────────────────────────────────────────────────────────────── │
│ Spanish:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Cuando yo tenía seis años, vi en un libro sobre la selva virgen...     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Translation:                                                         [edit]│
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ When I was six years old, I saw in a book about the primeval forest... │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ☑ Paragraph Start                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ FRAGMENTS (4)                                                               │
│ ─────────────────────────────────────────────────────────────────────────── │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. "Cuando yo tenía seis años,"                                        │ │
│ │    When I was six years old,                                     [edit]│ │
│ │    Note: tenía = imperfect tense for age                               │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 2. "vi en un libro sobre la selva virgen"                              │ │
│ │    I saw in a book about the primeval forest                     [edit]│ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ WORDS (15)                                                                  │
│ ─────────────────────────────────────────────────────────────────────────── │
│ ┌──────────┬─────────────┬─────────────────┬──────────────────────────────┐ │
│ │ Position │ Word        │ Lemma           │ Definition          Actions  │ │
│ ├──────────┼─────────────┼─────────────────┼──────────────────────────────┤ │
│ │ 1        │ Cuando      │ cuando          │ when                         │ │
│ │ 2        │ yo          │ yo              │ I                 [stop]     │ │
│ │ 3        │ tenía       │ tener           │ to have           [edit] [↔] │ │
│ │ 4        │ seis        │ seis            │ six               [edit] [↔] │ │
│ │ 5        │ años        │ el año          │ the year          [edit] [↔] │ │
│ │ ...      │             │                 │                              │ │
│ └──────────┴─────────────┴─────────────────┴──────────────────────────────┘ │
│                                                                             │
│ Legend: [edit] = edit lemma definition  [↔] = reassign to different lemma  │
│         [stop] = word is stop word (grayed out, no actions)                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ PHRASES (2)                                                                 │
│ ─────────────────────────────────────────────────────────────────────────── │
│ ┌──────────────────┬──────────────────────┬─────────────────┬─────────────┐ │
│ │ Phrase           │ Definition           │ Type            │ Actions     │ │
│ ├──────────────────┼──────────────────────┼─────────────────┼─────────────┤ │
│ │ selva virgen     │ primeval forest      │ compound        │ [edit]      │ │
│ │ (positions 11-12)│                      │                 │             │ │
│ └──────────────────┴──────────────────────┴─────────────────┴─────────────┘ │
│                                                                             │
│ [+ Add Phrase]                                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Components to Create

**1. SentenceDeepDive.jsx** (page)
- Route: `/admin/sentences/:sentenceId`
- Fetches sentence with fragments, words (with lemmas), phrase occurrences
- Orchestrates all sections

**2. SentenceHeader.jsx** (component)
- Displays Spanish text (read-only gray box)
- Editable translation (inline edit pattern)
- Paragraph toggle
- QA status badge (future)

**3. WordsTable.jsx** (component)
- Table of all words in sentence
- Columns: Position, Word Text, Lemma, Definition, Actions
- Stop words shown grayed out with no actions
- Actions: Edit Definition, Reassign Lemma

**4. LemmaReassignModal.jsx** (component)
- Search input for finding lemmas
- Shows search results with lemma_text + definitions
- "Create New Lemma" option at bottom
- Confirm button updates word.lemma_id

**5. PhrasesSection.jsx** (component)
- Shows phrase_occurrences for this sentence
- Inline editing for phrase definitions
- Add Phrase button (links words to new/existing phrase)

### Data Fetching

```javascript
// Fetch sentence with all related data
const { data: sentence } = await supabase
  .from('sentences')
  .select(`
    *,
    sentence_fragments (*),
    chapters (chapter_number, title)
  `)
  .eq('sentence_id', sentenceId)
  .single()

// Fetch words with lemmas
const { data: words } = await supabase
  .from('words')
  .select(`
    *,
    lemmas (lemma_id, lemma_text, definitions, part_of_speech, is_stop_word)
  `)
  .eq('sentence_id', sentenceId)
  .order('word_position')

// Fetch phrase occurrences
const { data: phraseOccurrences } = await supabase
  .from('phrase_occurrences')
  .select(`
    *,
    phrases (phrase_id, phrase_text, definitions, phrase_type, is_reviewed)
  `)
  .eq('sentence_id', sentenceId)
  .order('start_position')
```

### Key Interactions

**Edit Lemma Definition:**
1. Click [edit] on word row
2. Inline input appears for definition (same pattern as FragmentEditor)
3. Save updates `lemmas.definitions`

**Reassign Lemma:**
1. Click [↔] on word row
2. Modal opens with search input
3. Type to search lemmas by lemma_text
4. Select existing lemma OR click "Create New"
5. If creating: mini-form for lemma_text, definitions, part_of_speech
6. Confirm updates `words.lemma_id`

**Add Phrase:**
1. Click [+ Add Phrase]
2. Modal: select word positions (start/end)
3. Search existing phrases OR create new
4. Creates `phrase_occurrences` record

---

## 3. Phase 2: Lemma Management

### Route
`/admin/lemmas`

### Features

**List View:**
- Search by lemma_text or definition
- Filter by: Part of Speech, is_stop_word, has definitions
- Table columns: Lemma, Definitions, POS, Word Count, Actions
- Click row to see all occurrences

**Occurrence View (expandable or modal):**
- Shows all words mapped to this lemma
- Grouped by chapter
- Each shows: sentence context, word form
- Allows verifying correct lemma assignment

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Admin / Lemmas                                                     Logout  │
│                                                                             │
│ Lemma Management                                                            │
│ Manage canonical word forms and definitions                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Search lemmas...]              [POS ▼] [Stop Words ▼]      1,172 lemmas   │
│                                                                             │
│ ┌─────────────┬─────────────────────┬──────┬───────┬────────┬─────────────┐ │
│ │ Lemma       │ Definitions         │ POS  │ Count │ Stop?  │ Actions     │ │
│ ├─────────────┼─────────────────────┼──────┼───────┼────────┼─────────────┤ │
│ │ el          │ the                 │ DET  │ 1050  │ ✓      │ [view]      │ │
│ │ ser         │ to be               │ AUX  │ 408   │        │ [edit][view]│ │
│ │ decir       │ to say              │ VERB │ 173   │        │ [edit][view]│ │
│ │ el libro    │ the book            │ NOUN │ 42    │        │ [edit][view]│ │
│ └─────────────┴─────────────────────┴──────┴───────┴────────┴─────────────┘ │
│                                                                             │
│ [← Prev] Page 1 of 47 [Next →]                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Lemma Edit Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Lemma                                                  [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Lemma Text:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ tener                                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Part of Speech:                                                 │
│ [VERB ▼]                                                        │
│                                                                 │
│ Gender (nouns only):                                            │
│ [N/A ▼]                                                         │
│                                                                 │
│ Definitions:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1. to have                                              [x] │ │
│ │ 2. to hold                                              [x] │ │
│ │ [+ Add definition]                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ☐ Mark as stop word                                             │
│                                                                 │
│ Admin Notes:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Appears in: 105 words across 27 chapters                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                        [Cancel] [Save Changes]  │
└─────────────────────────────────────────────────────────────────┘
```

### Lemma Occurrences View

```
┌─────────────────────────────────────────────────────────────────┐
│ Occurrences of "tener" (105 total)                          [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Chapter 1 (8 occurrences)                                       │
│ ─────────────────────────────────────────────────────────────── │
│ • S1: "tenía" - "Cuando yo tenía seis años..."           [→]   │
│ • S5: "tiene" - "...que tiene una serpiente boa..."      [→]   │
│ • S12: "tengo" - "No tengo tiempo para..."               [→]   │
│                                                                 │
│ Chapter 2 (5 occurrences)                                       │
│ ─────────────────────────────────────────────────────────────── │
│ • S3: "tenía" - "...tenía necesidad de un amigo..."      [→]   │
│                                                                 │
│ [→] = Link to Sentence Deep Dive                                │
└─────────────────────────────────────────────────────────────────┘
```

### Merge Lemmas Feature

For when spaCy created duplicates:

1. In Lemma list, checkbox select multiple lemmas
2. Click "Merge Selected"
3. Choose which lemma to keep (target)
4. All words from source lemmas get reassigned to target
5. Source lemmas deleted

---

## 4. Phase 3: Phrase Management

### Route
`/admin/phrases`

### Features

- List all phrases with definitions
- Filter by: phrase_type (idiom, compound, collocation), is_reviewed
- Edit phrase definitions
- View all occurrences (which sentences contain this phrase)
- Create new phrases

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Admin / Phrases                                                    Logout  │
│                                                                             │
│ Phrase Management                                                           │
│ Manage multi-word expressions and idioms                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Search phrases...]           [Type ▼] [Reviewed ▼]           42 phrases   │
│                                                                             │
│ ┌─────────────────┬─────────────────────────┬───────────┬────────┬────────┐ │
│ │ Phrase          │ Definition              │ Type      │ Uses   │Actions │ │
│ ├─────────────────┼─────────────────────────┼───────────┼────────┼────────┤ │
│ │ selva virgen    │ primeval forest         │ compound  │ 1      │[edit]  │ │
│ │ ya no           │ no longer, not anymore  │ idiom     │ 3      │[edit]  │ │
│ │ por qué         │ why (interrogative)     │ compound  │ 5      │[edit]  │ │
│ └─────────────────┴─────────────────────────┴───────────┴────────┴────────┘ │
│                                                                             │
│ [+ Create Phrase]                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Phase 4: Common Words UI Refresh

### Goal
Align AdminCommonWords.jsx with Notion aesthetic (currently uses font-serif and colorful buttons).

### Changes Required

**Typography:**
- Remove all `font-serif` classes
- Use system sans-serif (default)

**Stats Cards:**
- Match AdminSentences style
- Subtle borders instead of shadows
- Smaller, more compact

**Filters Section:**
- Match AdminSentences filter bar style
- Remove "Filters" header box
- Inline filters like Sentences page

**Bulk Actions:**
- Replace colorful buttons (yellow/orange/red) with neutral style
- Use subtle variants: `bg-neutral-100 hover:bg-neutral-200 text-neutral-700`
- Or single primary action with dropdown for variants

**Table:**
- Use .admin-table class from SentenceTable
- Remove serif font
- Simplify status badges

### Before/After

**Before:**
```jsx
<button className="px-4 py-2 bg-yellow-500 text-white rounded-lg">Mark Top 50</button>
<button className="px-4 py-2 bg-orange-500 text-white rounded-lg">Mark Top 100</button>
```

**After:**
```jsx
<button className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg">
  Mark Top 50
</button>
```

---

## 6. Phase 5: QA Workflow

### New Database Columns

```sql
-- Add to sentences table
ALTER TABLE sentences ADD COLUMN qa_status VARCHAR(20) DEFAULT 'pending';
-- Values: 'pending', 'reviewed', 'flagged'

ALTER TABLE sentences ADD COLUMN qa_reviewed_at TIMESTAMPTZ;
ALTER TABLE sentences ADD COLUMN qa_reviewed_by UUID REFERENCES auth.users(id);

-- Add to lemmas table  
ALTER TABLE lemmas ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE lemmas ADD COLUMN verified_at TIMESTAMPTZ;
```

### QA Dashboard Widget

Add to Admin home (`/admin`):

```
┌─────────────────────────────────────────────────────────────────┐
│ QA Status                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Sentences                          Lemmas                       │
│ ────────────────                   ────────────────              │
│ ○ 412 pending                      ○ 1,089 unverified           │
│ ● 48 reviewed                      ● 83 verified                │
│ ⚠ 3 flagged                                                     │
│                                                                 │
│ [Review Sentences →]               [Verify Lemmas →]            │
└─────────────────────────────────────────────────────────────────┘
```

### Sentence QA Status

In Sentence Deep Dive, add status selector:

```
Status: [○ Pending] [● Reviewed] [⚠ Flagged]
```

Clicking updates `sentences.qa_status`.

---

## 7. Navigation Updates

### Updated Tab Structure

```jsx
// In Admin.jsx, update navigation
<nav>
  <Link to="/admin/sentences">Sentences</Link>
  <Link to="/admin/lemmas">Lemmas</Link>        {/* NEW */}
  <Link to="/admin/phrases">Phrases</Link>      {/* NEW */}
  <Link to="/admin/common-words">Common Words</Link>
</nav>
```

### Updated Home Cards

```jsx
// Admin home grid
<Link to="/admin/sentences">
  <h3>Sentences</h3>
  <p>Edit sentences, fragments, translations</p>
</Link>

<Link to="/admin/lemmas">
  <h3>Lemmas</h3>
  <p>Manage canonical word forms and definitions</p>
</Link>

<Link to="/admin/phrases">
  <h3>Phrases</h3>
  <p>Multi-word expressions and idioms</p>
</Link>

<Link to="/admin/common-words">
  <h3>Common Words</h3>
  <p>Mark stop words excluded from learning</p>
</Link>
```

---

## 8. Database Operations Reference

### Reassign Word to Different Lemma

```javascript
// Update word's lemma_id
const { error } = await supabase
  .from('words')
  .update({ lemma_id: newLemmaId })
  .eq('word_id', wordId)
```

### Create New Lemma

```javascript
const { data: newLemma, error } = await supabase
  .from('lemmas')
  .insert({
    lemma_text: lemmaText,
    language_code: 'es',
    part_of_speech: pos,
    gender: gender,
    definitions: definitions, // JSONB array
    is_stop_word: false
  })
  .select()
  .single()
```

### Search Lemmas

```javascript
const { data: lemmas } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech')
  .ilike('lemma_text', `%${searchTerm}%`)
  .limit(20)
```

### Update Lemma Definitions

```javascript
const { error } = await supabase
  .from('lemmas')
  .update({ 
    definitions: newDefinitions,
    updated_at: new Date().toISOString()
  })
  .eq('lemma_id', lemmaId)
```

### Merge Lemmas

```javascript
// 1. Reassign all words from source to target
await supabase
  .from('words')
  .update({ lemma_id: targetLemmaId })
  .eq('lemma_id', sourceLemmaId)

// 2. Delete source lemma (cascade handles user_lemma_progress)
await supabase
  .from('lemmas')
  .delete()
  .eq('lemma_id', sourceLemmaId)
```

### Add Phrase Occurrence

```javascript
const { error } = await supabase
  .from('phrase_occurrences')
  .insert({
    phrase_id: phraseId,
    sentence_id: sentenceId,
    start_position: startPos,
    end_position: endPos
  })
```

---

## Implementation Order

### Phase 1: Sentence Deep Dive (Priority: HIGH)
1. Create route and SentenceDeepDive.jsx page
2. Build SentenceHeader component
3. Build WordsTable component
4. Build LemmaReassignModal component
5. Build PhrasesSection component
6. Update AdminSentences to link to deep dive

### Phase 2: Lemma Management (Priority: HIGH)
1. Create AdminLemmas.jsx page
2. Build LemmaTable component
3. Build LemmaEditModal component
4. Build LemmaOccurrencesModal component
5. Add merge functionality

### Phase 3: Phrase Management (Priority: MEDIUM)
1. Create AdminPhrases.jsx page
2. Build PhraseTable component
3. Build PhraseEditModal component

### Phase 4: Common Words Refresh (Priority: MEDIUM)
1. Update AdminCommonWords.jsx styling
2. Apply Notion aesthetic

### Phase 5: QA Workflow (Priority: LOW)
1. Add database columns
2. Build QA dashboard widget
3. Add status controls to Sentence Deep Dive

---

## File Structure

```
src/
├── pages/
│   ├── Admin.jsx                    # Update navigation
│   ├── AdminSentences.jsx           # Update to link to deep dive
│   ├── AdminCommonWords.jsx         # Restyle
│   ├── AdminLemmas.jsx              # NEW
│   ├── AdminPhrases.jsx             # NEW
│   └── SentenceDeepDive.jsx         # NEW
│
└── components/
    └── admin/
        ├── index.js                 # Update exports
        ├── SentenceTable.jsx        # Existing
        ├── SentenceRow.jsx          # Existing
        ├── SentenceEditModal.jsx    # Keep for quick edits
        ├── FragmentEditor.jsx       # Existing
        ├── ParagraphToggle.jsx      # Existing
        ├── SentenceHeader.jsx       # NEW
        ├── WordsTable.jsx           # NEW
        ├── LemmaReassignModal.jsx   # NEW
        ├── PhrasesSection.jsx       # NEW
        ├── LemmaTable.jsx           # NEW
        ├── LemmaEditModal.jsx       # NEW
        ├── LemmaOccurrencesModal.jsx# NEW
        ├── PhraseTable.jsx          # NEW
        └── PhraseEditModal.jsx      # NEW
```

---

## Notes for Claude Code

1. **Follow existing patterns** - Review SentenceTable.jsx and FragmentEditor.jsx before building new components

2. **Reuse the .admin-table CSS** - Already defined in SentenceTable, use same class

3. **Inline editing pattern** - Use the same edit icon → input fields → checkmark/X pattern from FragmentEditor

4. **Modal pattern** - Follow SentenceEditModal structure: header with X, scrollable content, gray footer with Cancel/Save

5. **Keyboard shortcuts** - Add to Sentence Deep Dive: arrow keys to navigate words table, Enter to edit, Escape to close modals

6. **Optimistic updates** - Update local state immediately, then sync to database (pattern already used in AdminSentences)

7. **Error handling** - Show toast/alert on save failures, revert optimistic updates

---

**END OF SPECIFICATION**
