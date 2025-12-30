# Admin Suite: Final Fixes & Documentation Update

**Date:** December 23, 2025  
**For:** Claude Code Implementation  
**Priority:** HIGH - Final items before completion

---

## Overview

This is the final batch of fixes for the Admin Suite. After completion, update the changelog and documentation.

**Tasks:**
1. Fix AdminCommonWords 1000 word limit
2. Add sorting options (frequency, chapter, alphabetical)
3. Add chapter/sentence navigation from Common Words
4. Update 99_LIVING_CHANGELOG.md
5. Update 22_ADMIN_DASHBOARD.md

---

## Task 1: Fix 1000 Word Limit in AdminCommonWords

**File:** `src/pages/AdminCommonWords.jsx`

**Problem:** Supabase defaults to returning max 1000 rows. Currently showing "1000 words" when there are actually ~1,854 lemmas.

**Solution:** Fetch all lemmas with word counts using a more efficient query.

**Current code (lines 56-65):**
```javascript
const { data: lemmaData, error: lemmaError } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word')
  .eq('language_code', 'es')
```

**Replace with:**
```javascript
// Fetch all lemmas - override default 1000 limit
const { data: lemmaData, error: lemmaError, count } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word', { count: 'exact' })
  .eq('language_code', 'es')
  .range(0, 9999)  // Fetch up to 10,000 lemmas
  .order('lemma_text')

if (lemmaError) throw lemmaError

console.log(`Fetched ${lemmaData.length} lemmas (total: ${count})`)
```

**Alternative approach - Pagination:** If performance becomes an issue with large datasets, implement virtual scrolling or load-more pagination. For now, fetching all ~1,854 lemmas should be fine.

---

## Task 2: Add Word Frequency Count

**Problem:** Common Words page should show how often each lemma appears in the book to help Peter identify true "common" words.

**Solution:** Fetch word counts per lemma. This requires a separate query or RPC function.

**Option A - Client-side join (simpler but less efficient):**

Add a new fetch to get word counts:
```javascript
// After fetching lemmas, get word counts
const { data: wordCounts, error: countError } = await supabase
  .from('words')
  .select('lemma_id')

if (!countError && wordCounts) {
  // Count occurrences per lemma
  const countMap = wordCounts.reduce((acc, w) => {
    acc[w.lemma_id] = (acc[w.lemma_id] || 0) + 1
    return acc
  }, {})

  // Merge counts into lemma data
  const wordsWithCounts = lemmaData.map(l => ({
    ...l,
    word_count: countMap[l.lemma_id] || 0
  }))
  
  setWords(wordsWithCounts)
}
```

**Option B - Database view or RPC (more efficient):**

Create a database function in Supabase SQL Editor:
```sql
CREATE OR REPLACE FUNCTION get_lemmas_with_counts()
RETURNS TABLE (
  lemma_id UUID,
  lemma_text TEXT,
  definitions JSONB,
  part_of_speech TEXT,
  is_stop_word BOOLEAN,
  word_count BIGINT
) AS $$
  SELECT 
    l.lemma_id,
    l.lemma_text,
    l.definitions,
    l.part_of_speech,
    l.is_stop_word,
    COUNT(w.word_id) as word_count
  FROM lemmas l
  LEFT JOIN words w ON l.lemma_id = w.lemma_id
  WHERE l.language_code = 'es'
  GROUP BY l.lemma_id
  ORDER BY word_count DESC;
$$ LANGUAGE SQL;
```

Then call with:
```javascript
const { data, error } = await supabase.rpc('get_lemmas_with_counts')
```

**Recommendation:** Start with Option A for simplicity. If it's slow, implement Option B.

---

## Task 3: Add Sorting Options

**File:** `src/pages/AdminCommonWords.jsx`

**Add state for sort:**
```javascript
const [sortBy, setSortBy] = useState('frequency') // 'frequency' | 'alphabetical' | 'chapter'
const [sortOrder, setSortOrder] = useState('desc') // 'asc' | 'desc'
```

**Add sort dropdown to filters section (after the filter dropdown):**
```jsx
{/* Sort dropdown */}
<select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="frequency">Sort by Frequency</option>
  <option value="alphabetical">Sort Alphabetically</option>
  <option value="first_appearance">Sort by First Appearance</option>
</select>

{/* Sort order toggle */}
<button
  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm"
  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
>
  {sortOrder === 'asc' ? '↑' : '↓'}
</button>
```

**Apply sorting to filtered words:**
```javascript
// Sort filtered words
const sortedWords = [...filteredWords].sort((a, b) => {
  let comparison = 0
  
  switch (sortBy) {
    case 'frequency':
      comparison = (b.word_count || 0) - (a.word_count || 0)
      break
    case 'alphabetical':
      comparison = (a.lemma || '').localeCompare(b.lemma || '')
      break
    case 'first_appearance':
      comparison = (a.first_chapter || 99) - (b.first_chapter || 99)
      break
    default:
      comparison = 0
  }
  
  return sortOrder === 'asc' ? -comparison : comparison
})
```

**Update table to show frequency column:**
```jsx
<th>Frequency</th>
// ...
<td className="text-neutral-600 text-sm">
  {word.word_count ? `${word.word_count}×` : '—'}
</td>
```

---

## Task 4: Add First Appearance Data (Optional Enhancement)

To enable "Sort by First Appearance", we need to know which chapter each lemma first appears in.

**Fetch first appearance:**
```javascript
// Get first chapter appearance for each lemma
const { data: firstAppearances } = await supabase
  .from('words')
  .select(`
    lemma_id,
    sentences!inner (
      chapters!inner (
        chapter_number
      )
    )
  `)
  .order('sentences.chapters.chapter_number')

// Build map of lemma_id -> first chapter
const firstChapterMap = {}
firstAppearances?.forEach(w => {
  if (!firstChapterMap[w.lemma_id]) {
    firstChapterMap[w.lemma_id] = w.sentences?.chapters?.chapter_number
  }
})
```

**Note:** This query may be complex. If it doesn't work, skip "first appearance" sorting for now and just implement frequency + alphabetical.

---

## Task 5: Link to Sentence Deep Dive from Common Words

**Add a "View" action button** that shows where the lemma appears:

**Option A - Simple approach:** Link to Sentences page with search pre-filled
```jsx
<button
  onClick={() => navigate(`/admin/sentences?search=${encodeURIComponent(word.lemma)}`)}
  className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
  title="Find in sentences"
>
  <Search size={14} />
</button>
```

**Option B - Modal showing occurrences:** Create a modal that lists all sentences containing this lemma (similar to what Lemma Management page will have). This can wait for Phase 2.

**Recommendation:** Implement Option A for now.

---

## Task 6: Update Documentation

### 6a. Update 99_LIVING_CHANGELOG.md

Add entry for today's work:

```markdown
## [2025-12-23] Admin Suite Phase 1 Complete

### Added
- **Sentence Deep Dive** (`/admin/sentences/:id`)
  - Complete sentence breakdown with words, lemmas, phrases
  - Inline editable translations for sentences and fragments
  - Words table showing word → lemma → definition relationships
  - Lemma reassignment modal (fix spaCy mistakes)
  - Stop word toggle directly on word rows
  - Multiple definitions editing (add/remove individual definitions)
  - Phrase occurrences with edit/delete/reviewed toggle
  - Add phrase modal (link existing or create new)
  - Keyboard navigation (←/→ between sentences, Esc to list)

- **Common Words UI Refresh**
  - Notion-like aesthetic matching AdminSentences
  - Removed serif fonts, neutralized colors
  - Bulk actions dropdown
  - Keyboard navigation (↑/↓ and S to toggle)
  - Word frequency counts
  - Sorting options (frequency, alphabetical)

### Fixed
- RLS policies added for `words` and `lemmas` UPDATE operations
- Phrase reviewed toggle no longer causes page refresh
- Lemma reassignment now persists correctly
- Stop word toggle now persists correctly
- Common Words fetches all lemmas (was limited to 1000)

### Database Changes
- Added RLS policy: "Authenticated users can update words" on `words` table
- Added RLS policy: "Authenticated users can update lemmas" on `lemmas` table
```

### 6b. Update 22_ADMIN_DASHBOARD.md

Mark completed sections and update status:

**Update the header:**
```markdown
**Last Updated:** December 23, 2025
**Status:** Phase 1 Complete, Phase 2-3 Planned
```

**Add "Implementation Status" section after Overview:**
```markdown
## IMPLEMENTATION STATUS

### Completed (Phase 1)
- ✅ Sentence Management table (`/admin/sentences`)
- ✅ Sentence Deep Dive view (`/admin/sentences/:id`)
- ✅ Fragment editing
- ✅ Words table with lemma info
- ✅ Lemma definition editing (multiple definitions)
- ✅ Lemma reassignment
- ✅ Stop word toggle
- ✅ Phrase occurrences display
- ✅ Add phrase modal
- ✅ Common Words page (refreshed UI)
- ✅ Keyboard navigation throughout

### Planned (Phase 2)
- 🔲 Lemma Management page (`/admin/lemmas`)
- 🔲 Lemma occurrence view
- 🔲 Merge duplicate lemmas

### Planned (Phase 3)
- 🔲 Phrase Management page (`/admin/phrases`)
- 🔲 Phrase search and filter
- 🔲 Phrase occurrence management

### Future
- 🔲 QA workflow (status tracking)
- 🔲 QA dashboard widget
```

---

## Summary Checklist

**Code Changes:**
- [ ] Fix 1000 word limit in AdminCommonWords (use .range(0, 9999))
- [ ] Add word frequency counts to lemma data
- [ ] Add frequency column to Common Words table
- [ ] Add sort dropdown (frequency, alphabetical)
- [ ] Add sort order toggle (asc/desc)
- [ ] Add "Find in sentences" link from Common Words

**Documentation:**
- [ ] Update 99_LIVING_CHANGELOG.md with full Phase 1 summary
- [ ] Update 22_ADMIN_DASHBOARD.md with implementation status

---

## Testing After Implementation

1. **Common Words page:**
   - Shows all ~1,854 lemmas (not capped at 1000)
   - Frequency column shows word counts
   - Sort by frequency puts most common words first
   - Sort alphabetically works
   - Search still works
   - Stop word toggle still works

2. **Documentation:**
   - Changelog has complete entry for today
   - Admin Dashboard doc shows accurate status

---

**END OF SPECIFICATION**
