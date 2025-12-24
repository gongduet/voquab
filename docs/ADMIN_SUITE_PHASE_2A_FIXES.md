# Admin Suite Phase 2a: Quick Fixes

**Date:** December 24, 2025  
**For:** Claude Code Implementation  
**Priority:** HIGH - Usability fixes

---

## Fix 1: Filter State Persistence via URL Query Params

**File:** `src/pages/AdminCommonWords.jsx` (or `AdminLemmas.jsx` if renamed)

### Problem
When user navigates to Lemma Deep Dive and returns, all filters reset to defaults.

### Solution
Store filter state in URL query parameters. This also enables bookmarking filtered views.

### Implementation

**1. Import useSearchParams:**
```javascript
import { useNavigate, useSearchParams } from 'react-router-dom'
```

**2. Replace useState with useSearchParams for filters:**
```javascript
const [searchParams, setSearchParams] = useSearchParams()

// Read initial values from URL or use defaults
const searchTerm = searchParams.get('search') || ''
const filterStopWords = searchParams.get('stopWords') || 'all'
const filterPOS = searchParams.get('pos') || 'all'
const filterChapter = searchParams.get('chapter') || 'all'
const filterReviewed = searchParams.get('reviewed') || 'all'
const filterDefinition = searchParams.get('definition') || 'all'
const sortBy = searchParams.get('sortBy') || 'frequency'
const sortOrder = searchParams.get('sortOrder') || 'desc'
```

**3. Create helper function to update URL params:**
```javascript
const updateFilter = (key, value) => {
  const newParams = new URLSearchParams(searchParams)
  if (value === 'all' || value === '' || value === 'frequency' || value === 'desc') {
    // Remove default values from URL to keep it clean
    newParams.delete(key)
  } else {
    newParams.set(key, value)
  }
  setSearchParams(newParams, { replace: true })
}
```

**4. Update filter controls to use updateFilter:**
```jsx
{/* Search */}
<input
  type="text"
  value={searchTerm}
  onChange={(e) => updateFilter('search', e.target.value)}
  placeholder="Search words..."
  // ... rest of props
/>

{/* Stop Words filter */}
<select
  value={filterStopWords}
  onChange={(e) => updateFilter('stopWords', e.target.value)}
  // ... rest of props
>
  <option value="all">All Words</option>
  <option value="active">Active Only</option>
  <option value="stop">Stop Words Only</option>
</select>

{/* POS filter */}
<select
  value={filterPOS}
  onChange={(e) => updateFilter('pos', e.target.value)}
  // ... rest of props
>
  // ... options
</select>

{/* Chapter filter */}
<select
  value={filterChapter}
  onChange={(e) => updateFilter('chapter', e.target.value)}
  // ... rest of props
>
  // ... options
</select>

{/* Review status filter */}
<select
  value={filterReviewed}
  onChange={(e) => updateFilter('reviewed', e.target.value)}
  // ... rest of props
>
  // ... options
</select>

{/* Definition filter */}
<select
  value={filterDefinition}
  onChange={(e) => updateFilter('definition', e.target.value)}
  // ... rest of props
>
  // ... options
</select>

{/* Sort dropdown */}
<select
  value={sortBy}
  onChange={(e) => updateFilter('sortBy', e.target.value)}
  // ... rest of props
>
  // ... options
</select>

{/* Sort order toggle */}
<button
  onClick={() => updateFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
  // ... rest of props
>
  {sortOrder === 'asc' ? '↑' : '↓'}
</button>
```

**5. Remove the useState calls for these filters** (they're now derived from URL)

**6. Keep other useState calls** that aren't filters (like `words`, `loading`, `error`, `selectedId`, `showBulkMenu`, `showCreateModal`, `chapters`, `stats`)

---

## Fix 2: Increase Lemma Search Results in Reassign Modal

**File:** `src/components/admin/LemmaReassignModal.jsx`

### Problem
Search results are truncated (stops at ~20 results), so user can't find lemmas later in the alphabet.

### Solution
Increase the limit and/or add a note about refining search.

### Find the search query (likely looks like this):
```javascript
const { data, error } = await supabase
  .from('lemmas')
  .select('...')
  .ilike('lemma_text', `%${query}%`)
  .limit(20)  // <-- This is the problem
```

### Replace with:
```javascript
const { data, error } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech')
  .ilike('lemma_text', `%${query}%`)
  .order('lemma_text')
  .limit(100)  // Increase to 100
```

### Also add a helpful message when results are truncated:
```jsx
{searchResults.length >= 100 && (
  <div className="text-xs text-neutral-500 text-center py-2 border-t border-gray-100">
    Showing first 100 results. Type more characters to narrow search.
  </div>
)}
```

---

## Fix 3: Clear Filter Button (Optional Enhancement)

Add a "Clear Filters" button to quickly reset all filters:

```jsx
{/* Add near the filter controls */}
{(searchTerm || filterStopWords !== 'all' || filterPOS !== 'all' || 
  filterChapter !== 'all' || filterReviewed !== 'all' || filterDefinition !== 'all') && (
  <button
    onClick={() => setSearchParams({})}
    className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700"
  >
    Clear Filters
  </button>
)}
```

---

## Testing

**Filter persistence:**
1. Go to Lemmas page
2. Set some filters (e.g., POS = Verbs, Chapter = 1)
3. Click deep dive on a lemma
4. Click "Back to Lemmas"
5. Filters should still be applied
6. URL should show something like `/admin/lemmas?pos=VERB&chapter=xxx`

**Reassign modal:**
1. Go to any Lemma Deep Dive
2. Click reassign on a word
3. Type "a" in search
4. Should see up to 100 results
5. Scroll to confirm more results are available

---

## Note on the "sí" vs "si" Issue

This is NOT a bug - it's correct database behavior.

In Spanish:
- "si" = "if" (conjunction)
- "sí" = "yes" (adverb/interjection)

These are different words with different meanings. The database correctly has both as separate lemmas.

**What the user should do:**
1. Check both lemma entries to ensure definitions are correct
2. Review word occurrences in each to verify words are assigned correctly
3. If a word like "si" is in the wrong lemma (should be "sí"), reassign it

**Do NOT try to merge these or change one to the other.**

---

**END OF SPECIFICATION**
