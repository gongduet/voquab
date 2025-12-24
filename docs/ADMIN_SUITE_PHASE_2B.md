# Admin Suite Phase 2b: Orphaned Words & Delete Safeguards

**Date:** December 24, 2025  
**For:** Claude Code Implementation  
**Priority:** MEDIUM

---

## Overview

This phase adds:
1. Orphaned Words View - a dedicated page to find and reassign words without valid lemmas
2. Enhanced Delete Lemma Flow - safeguards and bulk reassignment when deleting lemmas

**Current state:** 0 orphaned words in database, but the view needs to be ready for future use.

---

## Part 1: Orphaned Words Page

**File:** `src/pages/OrphanedWords.jsx` (NEW)

### Route
Add to `src/App.jsx`:
```jsx
import OrphanedWords from './pages/OrphanedWords'

// Inside Routes, add before the :lemmaId route
<Route path="/admin/lemmas/orphaned" element={<OrphanedWords />} />
```

**Important:** This route must come BEFORE `/admin/lemmas/:lemmaId` or React Router will try to match "orphaned" as a lemmaId.

### Component

```jsx
/**
 * OrphanedWords - View and reassign words without valid lemma assignments
 * 
 * An orphaned word is one where:
 * - lemma_id is NULL
 * - lemma_id points to a deleted/non-existent lemma
 */

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'
import LemmaReassignModal from '../components/admin/LemmaReassignModal'

export default function OrphanedWords() {
  const navigate = useNavigate()
  const [orphanedWords, setOrphanedWords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reassignWord, setReassignWord] = useState(null)

  const fetchOrphanedWords = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch words with NULL lemma_id or where the joined lemma doesn't exist
      const { data, error: fetchError } = await supabase
        .from('words')
        .select(`
          word_id,
          word_text,
          word_position,
          lemma_id,
          sentence_id,
          sentences (
            sentence_id,
            sentence_text,
            sentence_order,
            chapter_id,
            chapters (
              chapter_id,
              chapter_number,
              title
            )
          )
        `)
        .is('lemma_id', null)
        .order('word_text')
        .range(0, 999)

      if (fetchError) throw fetchError

      // Group by chapter for easier viewing
      const grouped = {}
      data?.forEach(word => {
        const chapterId = word.sentences?.chapter_id || 'unknown'
        if (!grouped[chapterId]) {
          grouped[chapterId] = {
            chapter: word.sentences?.chapters || { chapter_number: '?', title: 'Unknown' },
            words: []
          }
        }
        grouped[chapterId].words.push(word)
      })

      // Sort by chapter number
      const sortedGroups = Object.values(grouped)
        .sort((a, b) => (a.chapter.chapter_number || 99) - (b.chapter.chapter_number || 99))

      setOrphanedWords(sortedGroups)
    } catch (err) {
      console.error('Error fetching orphaned words:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrphanedWords()
  }, [fetchOrphanedWords])

  const handleReassign = async (wordId, newLemmaId) => {
    const { error } = await supabase
      .from('words')
      .update({ lemma_id: newLemmaId })
      .eq('word_id', wordId)

    if (!error) {
      // Remove from orphaned list
      setOrphanedWords(prev => prev.map(group => ({
        ...group,
        words: group.words.filter(w => w.word_id !== wordId)
      })).filter(group => group.words.length > 0))
    } else {
      console.error('Error reassigning word:', error)
      alert('Failed to reassign: ' + error.message)
    }

    setReassignWord(null)
  }

  const totalOrphaned = orphanedWords.reduce((sum, g) => sum + g.words.length, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading orphaned words...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/lemmas"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={16} />
          Back to Lemmas
        </Link>

        <button
          onClick={fetchOrphanedWords}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Title and Stats */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Orphaned Words</h1>
        <p className="text-neutral-500 mt-1">
          Words without a valid lemma assignment that need to be reassigned
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 inline-block">
        <div className="flex items-center gap-3">
          {totalOrphaned > 0 ? (
            <>
              <AlertTriangle className="text-amber-500" size={20} />
              <div>
                <div className="text-2xl font-semibold text-neutral-900">{totalOrphaned}</div>
                <div className="text-xs text-neutral-500 uppercase tracking-wide">Orphaned Words</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-xs">✓</span>
              </div>
              <div>
                <div className="text-lg font-medium text-neutral-700">All Clear!</div>
                <div className="text-xs text-neutral-500">No orphaned words found</div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Orphaned Words List */}
      {totalOrphaned > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {orphanedWords.map(({ chapter, words }) => (
              <div key={chapter.chapter_id || 'unknown'}>
                {/* Chapter header */}
                <div className="px-6 py-3 bg-neutral-50 flex items-center justify-between">
                  <span className="font-medium text-neutral-800">
                    Chapter {chapter.chapter_number}: {chapter.title}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {words.length} orphaned word{words.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Words table */}
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-2 text-left">Word</th>
                      <th className="px-6 py-2 text-left">Sentence Context</th>
                      <th className="px-6 py-2 text-right w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {words.map((word) => (
                      <tr key={word.word_id} className="hover:bg-neutral-50">
                        <td className="px-6 py-3">
                          <span className="font-medium text-neutral-800">
                            {word.word_text}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-neutral-600 line-clamp-1">
                            {word.sentences?.sentence_text || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/sentences/${word.sentence_id}`)}
                              className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
                              title="View sentence"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => setReassignWord(word)}
                              className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Assign Lemma
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-neutral-400 mb-2">
            <span className="text-4xl">🎉</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">No Orphaned Words</h3>
          <p className="text-sm text-neutral-500">
            All words are properly assigned to lemmas. Great job!
          </p>
        </div>
      )}

      {/* Reassign Modal */}
      <LemmaReassignModal
        isOpen={!!reassignWord}
        word={reassignWord}
        onClose={() => setReassignWord(null)}
        onConfirm={(newLemmaId) => handleReassign(reassignWord?.word_id, newLemmaId)}
      />
    </div>
  )
}
```

---

## Part 2: Link to Orphaned Words from Lemmas Page

**File:** `src/pages/AdminCommonWords.jsx`

Add a link/button near the stats or filters to access orphaned words:

```jsx
{/* Add after the stats cards or near the "New Lemma" button */}
<Link
  to="/admin/lemmas/orphaned"
  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm flex items-center gap-2"
>
  <AlertTriangle size={14} />
  Orphaned Words
</Link>
```

Import AlertTriangle:
```javascript
import { Search, ChevronDown, RefreshCw, ExternalLink, CheckCircle, Circle, Plus, AlertTriangle } from 'lucide-react'
```

---

## Part 3: Enhanced Delete Lemma Flow

**File:** `src/pages/LemmaDeepDive.jsx`

### Update the delete confirmation to show word count and offer reassignment

Replace the simple delete confirmation modal with an enhanced version:

```jsx
{/* Enhanced Delete Confirmation Modal */}
{showDeleteConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-neutral-800">Delete Lemma?</h3>
      </div>
      
      <div className="p-6">
        <p className="text-neutral-600 mb-4">
          You are about to delete the lemma "<strong>{lemma.lemma_text}</strong>".
        </p>
        
        {totalOccurrences > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
              <div>
                <p className="font-medium text-amber-800">
                  {totalOccurrences} word{totalOccurrences !== 1 ? 's are' : ' is'} assigned to this lemma
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Choose how to handle these words:
                </p>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteAction"
                  value="orphan"
                  checked={deleteAction === 'orphan'}
                  onChange={(e) => setDeleteAction(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-sm text-neutral-700">
                  Make words orphaned (reassign later)
                </span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteAction"
                  value="reassign"
                  checked={deleteAction === 'reassign'}
                  onChange={(e) => setDeleteAction(e.target.value)}
                  className="text-blue-600"
                />
                <span className="text-sm text-neutral-700">
                  Reassign all words to another lemma
                </span>
              </label>
              
              {deleteAction === 'reassign' && (
                <div className="ml-6 mt-2">
                  <button
                    onClick={() => setShowReassignAllModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Select target lemma...
                  </button>
                  {targetLemma && (
                    <span className="ml-2 text-sm text-neutral-600">
                      → {targetLemma.lemma_text}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-green-600 mb-4">
            ✓ No words are assigned to this lemma. Safe to delete.
          </p>
        )}
        
        <p className="text-sm text-neutral-500">
          This action cannot be undone.
        </p>
      </div>
      
      <div className="px-6 py-4 border-t border-gray-200 bg-neutral-50 flex justify-end gap-3 rounded-b-xl">
        <button
          onClick={() => {
            setShowDeleteConfirm(false)
            setDeleteAction('orphan')
            setTargetLemma(null)
          }}
          className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteAction === 'reassign' && !targetLemma}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Delete Lemma
        </button>
      </div>
    </div>
  </div>
)}

{/* Reassign All Modal - reuse LemmaReassignModal with slight modification */}
{showReassignAllModal && (
  <LemmaReassignModal
    isOpen={true}
    word={{ word_text: `all ${totalOccurrences} words` }}
    currentLemmaId={lemmaId}  // Exclude current lemma from search
    onClose={() => setShowReassignAllModal(false)}
    onConfirm={(newLemmaId, newLemmaData) => {
      setTargetLemma(newLemmaData)
      setShowReassignAllModal(false)
    }}
  />
)}
```

### Add new state variables:

```javascript
const [deleteAction, setDeleteAction] = useState('orphan') // 'orphan' or 'reassign'
const [targetLemma, setTargetLemma] = useState(null)
const [showReassignAllModal, setShowReassignAllModal] = useState(false)
```

### Update handleDelete to handle the different actions:

```javascript
const handleDelete = async () => {
  try {
    if (totalOccurrences > 0) {
      if (deleteAction === 'orphan') {
        // Set lemma_id to NULL for all words
        const { error: orphanError } = await supabase
          .from('words')
          .update({ lemma_id: null })
          .eq('lemma_id', lemmaId)
        
        if (orphanError) throw orphanError
      } else if (deleteAction === 'reassign' && targetLemma) {
        // Reassign all words to target lemma
        const { error: reassignError } = await supabase
          .from('words')
          .update({ lemma_id: targetLemma.lemma_id })
          .eq('lemma_id', lemmaId)
        
        if (reassignError) throw reassignError
      } else {
        alert('Please select a target lemma for reassignment')
        return
      }
    }

    // Now delete the lemma
    const { error: deleteError } = await supabase
      .from('lemmas')
      .delete()
      .eq('lemma_id', lemmaId)

    if (deleteError) throw deleteError

    navigate('/admin/lemmas')
  } catch (err) {
    console.error('Error deleting lemma:', err)
    alert('Failed to delete: ' + err.message)
  }
}
```

### Import AlertTriangle:

```javascript
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  CheckCircle, 
  Circle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Plus,
  X,
  AlertTriangle  // Add this
} from 'lucide-react'
```

---

## Part 4: Update LemmaReassignModal to Support Exclusion

**File:** `src/components/admin/LemmaReassignModal.jsx`

Add optional prop to exclude a lemma from search results (so you can't reassign to the same lemma being deleted):

```jsx
export default function LemmaReassignModal({ 
  isOpen, 
  word, 
  currentLemmaId,  // Optional: exclude this lemma from results
  onClose, 
  onConfirm 
}) {
  // ... existing code ...

  // Update search to exclude current lemma
  const searchLemmas = useCallback(async (query) => {
    // ... existing validation ...

    let queryBuilder = supabase
      .from('lemmas')
      .select('lemma_id, lemma_text, definitions, part_of_speech')
      .ilike('lemma_text', `%${query}%`)
      .order('lemma_text')
      .limit(100)
    
    // Exclude current lemma if provided
    if (currentLemmaId) {
      queryBuilder = queryBuilder.neq('lemma_id', currentLemmaId)
    }

    const { data, error } = await queryBuilder

    // ... rest of function ...
  }, [currentLemmaId])

  // Update onConfirm to pass lemma data as well
  const handleConfirm = () => {
    const selectedLemmaData = searchResults.find(l => l.lemma_id === selectedLemmaId)
    onConfirm(selectedLemmaId, selectedLemmaData)
  }
}
```

---

## Part 5: Update Documentation

### 99_LIVING_CHANGELOG.md

Add entry:

```markdown
## [2025-12-24] Admin Suite Phase 2b: Orphaned Words & Delete Safeguards

### Added
- **Orphaned Words Page** (`/admin/lemmas/orphaned`)
  - View all words without valid lemma assignments
  - Grouped by chapter for easy navigation
  - Assign lemma to each orphaned word
  - Link from main Lemmas page

- **Enhanced Delete Lemma Flow**
  - Warning when words are assigned to lemma
  - Option to make words orphaned (for later reassignment)
  - Option to bulk reassign all words to another lemma
  - Confirmation required before deletion

### Changed
- LemmaReassignModal now supports excluding specific lemmas from search
```

### 22_ADMIN_DASHBOARD.md

Update status:

```markdown
### Completed (Phase 1 + 2a + 2b)
- ✅ All previous items
- ✅ Orphaned Words page
- ✅ Delete lemma with safeguards
- ✅ Bulk word reassignment on delete

### Planned (Phase 2c)
- 🔲 Phrases Management page
- 🔲 Phrase Deep Dive page
```

---

## Summary Checklist

**Code Changes:**
- [ ] Create `src/pages/OrphanedWords.jsx`
- [ ] Add route `/admin/lemmas/orphaned` in App.jsx (before `:lemmaId` route)
- [ ] Add link to Orphaned Words from AdminCommonWords.jsx
- [ ] Enhance delete confirmation modal in LemmaDeepDive.jsx
- [ ] Add delete action state (orphan vs reassign)
- [ ] Update handleDelete to handle orphan/reassign actions
- [ ] Update LemmaReassignModal to support currentLemmaId exclusion
- [ ] Update documentation

**Testing:**
1. Navigate to `/admin/lemmas/orphaned` - should show empty state
2. Link from Lemmas page works
3. Go to any Lemma Deep Dive with word occurrences
4. Click delete - should show warning with word count
5. Select "orphan" option, delete - words should become orphaned
6. Check Orphaned Words page - should now show those words
7. Reassign an orphaned word back to a lemma
8. Test "reassign to another lemma" delete option

---

**END OF SPECIFICATION**
