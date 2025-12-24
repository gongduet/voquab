# Admin Suite: Bug Fixes, Enhancements & Common Words Refresh

**Date:** December 23, 2025  
**For:** Claude Code Implementation  
**Priority:** HIGH - Fixes blocking core functionality

---

## Overview

Phase 1 testing revealed two bugs and several enhancement needs. This document also includes the Common Words UI refresh (originally Phase 4).

**Order of implementation:**
1. Fix critical bugs (reassign, phrase toggle)
2. Add multiple definitions UI
3. Add stop word toggle to word rows
4. Add phrase creation
5. Common Words UI refresh

---

## Part 1: Bug Fixes

### Bug 1: Lemma Reassign Not Persisting (CRITICAL)

**Location:** `src/components/admin/LemmaReassignModal.jsx`

**Symptom:** User selects new lemma, clicks confirm, modal closes, but:
- WordsTable doesn't update to show new lemma
- Database `words.lemma_id` is not changed

**Debug steps:**
1. Check the Supabase update query - is it using correct column names?
2. Check if the word_id is being passed correctly
3. Add console.log to see the response/error from Supabase
4. Verify the parent component's callback is updating local state

**Expected behavior:**
```javascript
// Update should look like this:
const { data, error } = await supabase
  .from('words')
  .update({ lemma_id: newLemmaId })
  .eq('word_id', wordId)
  .select()

if (error) {
  console.error('Reassign error:', error)
  // Show error to user
} else {
  // Call parent callback to update local state
  onReassign(wordId, newLemmaId, newLemmaData)
}
```

**Verify fix:**
- Reassign a word to different lemma
- WordsTable immediately shows new lemma
- Refresh page - change persists
- Check database directly - `words.lemma_id` has new value

---

### Bug 2: Phrase Reviewed Toggle Causes Page Refresh

**Location:** `src/components/admin/PhrasesSection.jsx`

**Symptom:** Clicking the reviewed toggle (checkmark icon) refreshes the entire page instead of updating state.

**Likely cause:** 
- Button inside a form causing submit
- Missing `e.preventDefault()` 
- Or the onClick is triggering navigation

**Fix:**
```javascript
const handleToggleReviewed = async (e, phraseId, currentValue) => {
  e.preventDefault()
  e.stopPropagation()
  
  const { error } = await supabase
    .from('phrases')
    .update({ is_reviewed: !currentValue })
    .eq('phrase_id', phraseId)
  
  if (!error) {
    // Update local state optimistically
    setPhraseOccurrences(prev => prev.map(po => 
      po.phrase_id === phraseId 
        ? { ...po, phrases: { ...po.phrases, is_reviewed: !currentValue } }
        : po
    ))
  }
}
```

**Verify fix:**
- Click reviewed toggle
- Icon updates without page refresh
- Refresh page - change persists

---

## Part 2: Enhancements

### Enhancement 1: Multiple Definitions UI

**Location:** `src/components/admin/WordsTable.jsx` (edit mode)

**Current state:** Definitions stored as JSONB array `["to have", "to hold"]` but UI only shows first or comma-joined string.

**Required UI:** When editing a lemma's definitions, show:

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Definitions for "tener"                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Definitions:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ to have                                                 [x] │ │
│ │ to hold                                                 [x] │ │
│ │ to possess                                              [x] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Add new definition...                                   [+] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                      [Cancel] [Save]            │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation approach:**

Option A - Inline in table (simpler):
```jsx
// When editing, show each definition as removable chip
{isEditing ? (
  <div className="space-y-2">
    {definitions.map((def, i) => (
      <div key={i} className="flex items-center gap-2">
        <input
          value={def}
          onChange={(e) => updateDefinition(i, e.target.value)}
          className="flex-1 px-2 py-1 text-sm border rounded"
        />
        <button onClick={() => removeDefinition(i)} className="text-red-500">
          <X size={14} />
        </button>
      </div>
    ))}
    <button onClick={addDefinition} className="text-sm text-blue-600">
      + Add definition
    </button>
  </div>
) : (
  <span>{definitions.join(', ')}</span>
)}
```

Option B - Modal (more space, better for complex edits):
- Create `LemmaEditModal.jsx` 
- Opens when clicking edit on word row
- Full form for lemma_text, definitions array, POS, gender, is_stop_word

**Recommendation:** Start with Option A (inline) for speed. Can add modal later if needed.

**Save logic:**
```javascript
const { error } = await supabase
  .from('lemmas')
  .update({ 
    definitions: definitionsArray,  // Already JSONB array
    updated_at: new Date().toISOString()
  })
  .eq('lemma_id', lemmaId)
```

---

### Enhancement 2: Stop Word Toggle on Word Rows

**Location:** `src/components/admin/WordsTable.jsx`

**Current state:** Stop words show "stop" badge but can't be toggled from this view.

**Add:** Toggle button or clickable badge to mark/unmark lemma as stop word.

**UI option - clickable badge:**
```jsx
<button
  onClick={() => handleToggleStopWord(word.lemmas.lemma_id, word.lemmas.is_stop_word)}
  className={`px-2 py-0.5 text-xs rounded ${
    word.lemmas.is_stop_word 
      ? 'bg-neutral-200 text-neutral-600 hover:bg-red-100 hover:text-red-700' 
      : 'bg-neutral-100 text-neutral-400 hover:bg-green-100 hover:text-green-700'
  }`}
  title={word.lemmas.is_stop_word ? 'Click to unmark as stop word' : 'Click to mark as stop word'}
>
  {word.lemmas.is_stop_word ? 'stop' : 'mark stop'}
</button>
```

**Handler:**
```javascript
const handleToggleStopWord = async (lemmaId, currentValue) => {
  const { error } = await supabase
    .from('lemmas')
    .update({ is_stop_word: !currentValue })
    .eq('lemma_id', lemmaId)
  
  if (!error) {
    // Update local state
    setWords(prev => prev.map(w => 
      w.lemma_id === lemmaId 
        ? { ...w, lemmas: { ...w.lemmas, is_stop_word: !currentValue } }
        : w
    ))
  }
}
```

**Note:** Toggling stop word affects the LEMMA, which affects ALL words using that lemma. Consider showing a confirmation: "This will mark 'el' as a stop word across all 1,050 occurrences."

---

### Enhancement 3: Add Phrase to Sentence

**Location:** `src/components/admin/PhrasesSection.jsx`

**Current state:** Can view/edit/delete phrase occurrences but cannot add new ones.

**Add:** Button to create new phrase occurrence from this sentence.

**UI Flow:**

1. Click [+ Add Phrase] button
2. Modal opens:

```
┌─────────────────────────────────────────────────────────────────┐
│ Add Phrase to Sentence                                      [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Select words from sentence:                                     │
│                                                                 │
│ Start position: [11 ▼]  End position: [12 ▼]                   │
│                                                                 │
│ Preview: "selva virgen"                                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ○ Link to existing phrase                                       │
│   [Search phrases...                                    ]       │
│   Results:                                                      │
│   • selva virgen - primeval forest (compound)                   │
│                                                                 │
│ ○ Create new phrase                                             │
│   Phrase text: [selva virgen                            ]       │
│   Definition:  [                                        ]       │
│   Type:        [compound ▼]                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                         [Cancel] [Add Phrase]   │
└─────────────────────────────────────────────────────────────────┘
```

3. On confirm:
   - If linking existing: Create `phrase_occurrences` record
   - If creating new: Create `phrases` record, then `phrase_occurrences`

**Component:** Create `AddPhraseModal.jsx`

**Data needed:**
- `words` array (to populate position dropdowns and preview)
- `sentenceId` (for the occurrence)

**Database operations:**

```javascript
// Link to existing phrase
const { error } = await supabase
  .from('phrase_occurrences')
  .insert({
    phrase_id: selectedPhraseId,
    sentence_id: sentenceId,
    start_position: startPos,
    end_position: endPos
  })

// Create new phrase + occurrence
const { data: newPhrase, error: phraseError } = await supabase
  .from('phrases')
  .insert({
    phrase_text: phraseText,
    definitions: [definition],
    phrase_type: phraseType,
    is_reviewed: false
  })
  .select()
  .single()

if (!phraseError) {
  await supabase
    .from('phrase_occurrences')
    .insert({
      phrase_id: newPhrase.phrase_id,
      sentence_id: sentenceId,
      start_position: startPos,
      end_position: endPos
    })
}
```

---

## Part 3: Common Words UI Refresh

**Location:** `src/pages/AdminCommonWords.jsx`

**Goal:** Align with Notion aesthetic established in AdminSentences.

### Changes Required

**1. Remove all `font-serif` classes**

Find and replace throughout the file:
- `font-serif` → remove entirely
- Let system sans-serif (default) apply

**2. Simplify Stats Cards**

Before:
```jsx
<div className="bg-white rounded-lg shadow p-6">
  <div className="text-sm font-serif text-gray-600 mb-1">Total Words</div>
  <div className="text-3xl font-serif font-bold text-gray-800">{stats.total}</div>
</div>
```

After:
```jsx
<div className="bg-white border border-neutral-200 rounded-lg p-4">
  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Words</div>
  <div className="text-2xl font-semibold text-neutral-900">{stats.total}</div>
</div>
```

**3. Flatten Filters Section**

Before: Card with "Filters" header, nested inputs

After: Inline filters matching AdminSentences pattern:
```jsx
<div className="flex flex-wrap gap-4 items-end">
  {/* Search */}
  <div className="relative flex-1 max-w-xs">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search words..."
      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>

  {/* Filter dropdown */}
  <select
    value={filterStopWords}
    onChange={(e) => setFilterStopWords(e.target.value)}
    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
  >
    <option value="all">All Words</option>
    <option value="active">Active Only</option>
    <option value="stop">Stop Words Only</option>
  </select>

  {/* Count */}
  <div className="text-sm text-neutral-500">
    {filteredWords.length} words
  </div>
</div>
```

**4. Neutralize Bulk Action Buttons**

Before:
```jsx
<button className="px-4 py-2 bg-yellow-500 text-white rounded-lg">Mark Top 50</button>
<button className="px-4 py-2 bg-orange-500 text-white rounded-lg">Mark Top 100</button>
<button className="px-4 py-2 bg-red-500 text-white rounded-lg">Mark Top 200</button>
```

After - Option A (dropdown):
```jsx
<div className="relative">
  <button className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm flex items-center gap-2">
    Bulk Mark Stop Words
    <ChevronDown size={14} />
  </button>
  {/* Dropdown menu */}
  <div className="absolute mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10">
    <button onClick={() => bulkMarkStopWords(50)} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50">
      Top 50 words
    </button>
    <button onClick={() => bulkMarkStopWords(100)} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50">
      Top 100 words
    </button>
    <button onClick={() => bulkMarkStopWords(200)} className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50">
      Top 200 words
    </button>
  </div>
</div>
```

After - Option B (subtle inline buttons):
```jsx
<div className="flex items-center gap-2">
  <span className="text-xs text-neutral-500">Bulk mark:</span>
  <button 
    onClick={() => bulkMarkStopWords(50)}
    className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded"
  >
    Top 50
  </button>
  <button 
    onClick={() => bulkMarkStopWords(100)}
    className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded"
  >
    Top 100
  </button>
  <button 
    onClick={() => bulkMarkStopWords(200)}
    className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded"
  >
    Top 200
  </button>
</div>
```

**5. Use .admin-table Class for Table**

Import or copy the CSS from SentenceTable.jsx, or extract to shared styles.

Replace current table styling with:
```jsx
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
  <table className="admin-table">
    <thead>
      <tr>
        <th>Word</th>
        <th>Definition</th>
        <th>POS</th>
        <th className="text-center">Stop?</th>
        <th className="w-24">Actions</th>
      </tr>
    </thead>
    <tbody>
      {filteredWords.map((word) => (
        <tr key={word.lemma_id} className="hover:bg-gray-50">
          <td className="font-medium text-neutral-800">{word.lemma}</td>
          <td className="text-neutral-600 text-sm">{word.english_definition}</td>
          <td className="text-neutral-500 text-sm">{word.part_of_speech || '—'}</td>
          <td className="text-center">
            {word.is_stop_word ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-200 text-neutral-600">
                stop
              </span>
            ) : (
              <span className="text-neutral-300">—</span>
            )}
          </td>
          <td>
            <button
              onClick={() => toggleStopWord(word)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                word.is_stop_word
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {word.is_stop_word ? 'Unmark' : 'Mark Stop'}
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**6. Add Keyboard Shortcut Hints**

Match AdminSentences pattern:
```jsx
<div className="text-xs text-gray-400 flex gap-4">
  <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
  <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">S</kbd> Toggle stop word</span>
</div>
```

(Optional: implement keyboard navigation to match)

---

## Summary Checklist

**Bugs:**
- [ ] Fix lemma reassign not persisting
- [ ] Fix phrase toggle causing page refresh

**Enhancements:**
- [ ] Multiple definitions UI (add/edit/remove individual definitions)
- [ ] Stop word toggle on word rows in Sentence Deep Dive
- [ ] Add phrase modal (create new phrase or link existing)

**Common Words Refresh:**
- [ ] Remove all font-serif
- [ ] Simplify stats cards (border instead of shadow)
- [ ] Flatten filters section
- [ ] Neutralize bulk action buttons
- [ ] Apply .admin-table styling
- [ ] Optional: keyboard shortcuts

---

## Testing After Implementation

**Bug fixes:**
1. Reassign word "un" to a new lemma - verify it persists after refresh
2. Toggle phrase reviewed status - verify no page refresh

**Multiple definitions:**
1. Edit lemma "de" - add definition "from" alongside "of"
2. Save and verify both appear

**Stop word toggle:**
1. Mark a lemma as stop word from Sentence Deep Dive
2. Verify it updates immediately and persists

**Add phrase:**
1. Select positions for "Historias vividas" in sentence 1
2. Create new phrase with definition
3. Verify it appears in Phrases section

**Common Words:**
1. Visual inspection - should match Notion aesthetic
2. All functionality still works (search, filter, toggle, bulk mark)

---

**END OF SPECIFICATION**
