# Admin Suite Phase 2d: Sentences Review Status

**Date:** December 24, 2025  
**For:** Claude Code Implementation  
**Priority:** LOW (Final phase)

---

## Overview

Add `is_reviewed` functionality to Sentences, matching the pattern already implemented for Lemmas and Phrases.

**Database columns already exist:**
- `sentences.is_reviewed` (BOOLEAN DEFAULT FALSE)
- `sentences.reviewed_at` (TIMESTAMPTZ)

---

## Part 1: Add Review Filter to AdminSentences

**File:** `src/pages/AdminSentences.jsx`

### 1.1 Add filter state (or URL param if using useSearchParams)

```javascript
const [filterReviewed, setFilterReviewed] = useState('all') // 'all' | 'reviewed' | 'unreviewed'
```

Or if using URL params:
```javascript
const filterReviewed = searchParams.get('reviewed') || 'all'
```

### 1.2 Add filter dropdown to the filters section

```jsx
<select
  value={filterReviewed}
  onChange={(e) => setFilterReviewed(e.target.value)}  // or updateFilter('reviewed', e.target.value)
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="all">All Review Status</option>
  <option value="reviewed">Reviewed ✓</option>
  <option value="unreviewed">Needs Review</option>
</select>
```

### 1.3 Add filter logic

In the filtering section:
```javascript
// Review status filter
if (filterReviewed === 'reviewed' && !sentence.is_reviewed) return false
if (filterReviewed === 'unreviewed' && sentence.is_reviewed) return false
```

### 1.4 Add Reviewed column to table

Update table header:
```jsx
<th className="text-center">Reviewed</th>
```

Add cell in table body:
```jsx
<td className="px-4 py-3 text-center">
  <button
    onClick={(e) => {
      e.stopPropagation()
      toggleReviewed(sentence)
    }}
    className={`p-1 rounded transition-colors ${
      sentence.is_reviewed
        ? 'text-green-600 hover:bg-green-50'
        : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
    }`}
    title={sentence.is_reviewed ? 'Reviewed' : 'Mark as reviewed'}
  >
    {sentence.is_reviewed ? (
      <CheckCircle size={18} className="fill-green-100" />
    ) : (
      <Circle size={18} />
    )}
  </button>
</td>
```

### 1.5 Add toggle handler

```javascript
const toggleReviewed = useCallback(async (sentence) => {
  const newValue = !sentence.is_reviewed
  const { error } = await supabase
    .from('sentences')
    .update({ 
      is_reviewed: newValue,
      reviewed_at: newValue ? new Date().toISOString() : null
    })
    .eq('sentence_id', sentence.sentence_id)

  if (!error) {
    setSentences(prev => prev.map(s =>
      s.sentence_id === sentence.sentence_id
        ? { ...s, is_reviewed: newValue }
        : s
    ))
  } else {
    console.error('Error toggling reviewed:', error)
  }
}, [])
```

### 1.6 Import icons

Make sure CheckCircle and Circle are imported:
```javascript
import { CheckCircle, Circle } from 'lucide-react'
```

---

## Part 2: Add Review Toggle to SentenceDeepDive

**File:** `src/pages/SentenceDeepDive.jsx`

### 2.1 Add reviewed toggle button in header

Add next to the paragraph toggle or in a similar location:

```jsx
<button
  onClick={handleToggleReviewed}
  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
    sentence.is_reviewed
      ? 'bg-green-100 text-green-700 hover:bg-green-200'
      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
  }`}
>
  {sentence.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
  {sentence.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
</button>
```

### 2.2 Add toggle handler

```javascript
const handleToggleReviewed = async () => {
  const newValue = !sentence.is_reviewed
  const { error } = await supabase
    .from('sentences')
    .update({ 
      is_reviewed: newValue,
      reviewed_at: newValue ? new Date().toISOString() : null
    })
    .eq('sentence_id', sentenceId)

  if (!error) {
    setSentence(prev => ({ ...prev, is_reviewed: newValue }))
  } else {
    console.error('Error toggling reviewed:', error)
  }
}
```

### 2.3 Import icons

```javascript
import { CheckCircle, Circle } from 'lucide-react'
```

---

## Part 3: Update Documentation

### 99_LIVING_CHANGELOG.md

Add entry:

```markdown
## [2025-12-24] Admin Suite Phase 2d: Sentences Review Status

### Added
- Review status filter on Sentences list (All/Reviewed/Needs Review)
- Reviewed toggle column in Sentences table
- Reviewed toggle button in Sentence Deep Dive header

### Completed
- Admin Suite Phase 2 is now complete!
```

### 22_ADMIN_DASHBOARD.md

Update status:

```markdown
### Completed (Phase 1 + Phase 2)
- ✅ Sentence Management table
- ✅ Sentence Deep Dive view
- ✅ Fragment editing
- ✅ Words table with lemma info
- ✅ Lemma definition editing
- ✅ Lemma reassignment
- ✅ Stop word toggle
- ✅ Phrase occurrences display
- ✅ Add phrase modal
- ✅ Lemmas page with filters
- ✅ Lemma Deep Dive page
- ✅ Create New Lemma
- ✅ Lemma review workflow
- ✅ Orphaned Words view
- ✅ Delete lemma with safeguards
- ✅ Phrases List page
- ✅ Phrase Deep Dive page
- ✅ Create Phrase modal
- ✅ Sentences review workflow
```

---

## Summary Checklist

**Code Changes:**
- [ ] Add review filter dropdown to AdminSentences.jsx
- [ ] Add filter logic for reviewed status
- [ ] Add Reviewed column to sentences table
- [ ] Add toggleReviewed handler
- [ ] Add reviewed toggle to SentenceDeepDive.jsx header
- [ ] Update documentation

**Testing:**
1. Sentences list shows Reviewed column with toggle icons
2. Can toggle reviewed status from list
3. Filter by "Needs Review" works
4. Filter by "Reviewed" works
5. Sentence Deep Dive shows reviewed toggle in header
6. Can toggle reviewed from deep dive

---

**END OF SPECIFICATION**

This completes Admin Suite Phase 2! 🎉
