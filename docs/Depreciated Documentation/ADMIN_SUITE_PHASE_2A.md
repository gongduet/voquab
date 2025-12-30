# Admin Suite Phase 2a: Lemmas Management

**Date:** December 24, 2025  
**For:** Claude Code Implementation  
**Priority:** HIGH

---

## Overview

This sub-phase transforms the existing "Common Words" page into a full "Lemmas" management system with a deep dive view for each lemma.

**Scope:**
1. Rename "Common Words" tab to "Lemmas"
2. Enhance Lemmas list with new filters and columns
3. Create Lemma Deep Dive page (`/admin/lemmas/:lemmaId`)
4. Add Create New Lemma functionality

**Database columns already added:**
- `lemmas.is_reviewed` (BOOLEAN DEFAULT FALSE)
- `lemmas.reviewed_at` (TIMESTAMPTZ)
- `sentences.is_reviewed` (BOOLEAN DEFAULT FALSE)
- `sentences.reviewed_at` (TIMESTAMPTZ)

**Supabase max rows increased to 20,000** - the 1000 limit issue should now be resolved.

---

## Part 1: Rename Tab and Route

**File:** `src/pages/Admin.jsx`

Change the tab label from "Common Words" to "Lemmas". Keep the same route for now.

```jsx
// Change tab label
<Tab>Lemmas</Tab>  // was "Common Words"
```

---

## Part 2: Enhance Lemmas List

**File:** `src/pages/AdminCommonWords.jsx` (consider renaming to `AdminLemmas.jsx`)

### 2.1 Add New State Variables

```javascript
const [filterPOS, setFilterPOS] = useState('all')
const [filterChapter, setFilterChapter] = useState('all')
const [filterReviewed, setFilterReviewed] = useState('all') // 'all' | 'reviewed' | 'unreviewed'
const [filterDefinition, setFilterDefinition] = useState('all') // 'all' | 'has' | 'missing'
const [chapters, setChapters] = useState([])
```

### 2.2 Fetch Chapters for Filter Dropdown

Add to `fetchWords()` or create separate fetch:

```javascript
// Fetch chapters for filter dropdown
const { data: chaptersData } = await supabase
  .from('chapters')
  .select('chapter_id, chapter_number, title')
  .order('chapter_number')

setChapters(chaptersData || [])
```

### 2.3 Update Lemma Fetch to Include is_reviewed

```javascript
const { data: lemmaData, error: lemmaError, count } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word, is_reviewed, gender', { count: 'exact' })
  .eq('language_code', 'es')
  .range(0, 19999)
  .order('lemma_text')
```

### 2.4 Fetch Chapter Information for Each Lemma

To enable chapter filtering, we need to know which chapters each lemma appears in. Add after fetching words:

```javascript
// Get chapter associations for lemmas (through words -> sentences -> chapters)
const { data: wordChapterData } = await supabase
  .from('words')
  .select(`
    lemma_id,
    sentences!inner (
      chapter_id
    )
  `)
  .range(0, 19999)

// Build map of lemma_id -> Set of chapter_ids
const lemmaChaptersMap = {}
wordChapterData?.forEach(w => {
  if (w.lemma_id && w.sentences?.chapter_id) {
    if (!lemmaChaptersMap[w.lemma_id]) {
      lemmaChaptersMap[w.lemma_id] = new Set()
    }
    lemmaChaptersMap[w.lemma_id].add(w.sentences.chapter_id)
  }
})

// Convert Sets to arrays and merge into lemma data
const wordsWithCounts = lemmaData.map(l => ({
  ...l,
  vocab_id: l.lemma_id,
  lemma: l.lemma_text,
  english_definition: Array.isArray(l.definitions) ? l.definitions[0] : l.definitions,
  word_count: countMap[l.lemma_id] || 0,
  chapter_ids: lemmaChaptersMap[l.lemma_id] ? Array.from(lemmaChaptersMap[l.lemma_id]) : []
}))
```

### 2.5 Add Filter Dropdowns to UI

Add after the existing filter dropdowns:

```jsx
{/* POS filter */}
<select
  value={filterPOS}
  onChange={(e) => setFilterPOS(e.target.value)}
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="all">All POS</option>
  <option value="NOUN">Nouns</option>
  <option value="VERB">Verbs</option>
  <option value="ADJ">Adjectives</option>
  <option value="ADV">Adverbs</option>
  <option value="PRON">Pronouns</option>
  <option value="DET">Determiners</option>
  <option value="ADP">Prepositions</option>
  <option value="CONJ">Conjunctions</option>
  <option value="NUM">Numerals</option>
</select>

{/* Chapter filter */}
<select
  value={filterChapter}
  onChange={(e) => setFilterChapter(e.target.value)}
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="all">All Chapters</option>
  {chapters.map(ch => (
    <option key={ch.chapter_id} value={ch.chapter_id}>
      Ch. {ch.chapter_number}: {ch.title}
    </option>
  ))}
</select>

{/* Review status filter */}
<select
  value={filterReviewed}
  onChange={(e) => setFilterReviewed(e.target.value)}
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="all">All Review Status</option>
  <option value="reviewed">Reviewed ✓</option>
  <option value="unreviewed">Needs Review</option>
</select>

{/* Definition filter */}
<select
  value={filterDefinition}
  onChange={(e) => setFilterDefinition(e.target.value)}
  className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
>
  <option value="all">All Definitions</option>
  <option value="has">Has Definition</option>
  <option value="missing">Missing Definition</option>
</select>
```

### 2.6 Update Filter Logic

```javascript
const filteredWords = words.filter(word => {
  // Search filter
  if (searchTerm) {
    const search = searchTerm.toLowerCase()
    if (!word.lemma?.toLowerCase().includes(search) &&
        !word.english_definition?.toLowerCase().includes(search)) {
      return false
    }
  }

  // Stop word filter
  if (filterStopWords === 'stop' && !word.is_stop_word) return false
  if (filterStopWords === 'active' && word.is_stop_word) return false

  // POS filter
  if (filterPOS !== 'all' && word.part_of_speech !== filterPOS) return false

  // Chapter filter
  if (filterChapter !== 'all' && !word.chapter_ids?.includes(filterChapter)) return false

  // Review status filter
  if (filterReviewed === 'reviewed' && !word.is_reviewed) return false
  if (filterReviewed === 'unreviewed' && word.is_reviewed) return false

  // Definition filter
  const hasDefinition = word.definitions && 
    (Array.isArray(word.definitions) ? word.definitions.length > 0 : !!word.definitions)
  if (filterDefinition === 'has' && !hasDefinition) return false
  if (filterDefinition === 'missing' && hasDefinition) return false

  return true
})
```

### 2.7 Add Reviewed Column to Table

Update table header:
```jsx
<th>Word</th>
<th>Definition</th>
<th>POS</th>
<th className="text-right">Frequency</th>
<th className="text-center">Stop</th>
<th className="text-center">Reviewed</th>  {/* NEW */}
<th className="w-32">Actions</th>
```

Add reviewed cell in table body:
```jsx
<td className="text-center">
  <button
    onClick={(e) => {
      e.stopPropagation()
      toggleReviewed(word)
    }}
    className={`p-1 rounded transition-colors ${
      word.is_reviewed
        ? 'text-green-600 hover:bg-green-50'
        : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
    }`}
    title={word.is_reviewed ? 'Reviewed' : 'Mark as reviewed'}
  >
    {word.is_reviewed ? (
      <CheckCircle size={18} className="fill-green-100" />
    ) : (
      <Circle size={18} />
    )}
  </button>
</td>
```

Add the toggle handler:
```javascript
const toggleReviewed = useCallback(async (word) => {
  const newValue = !word.is_reviewed
  const { error } = await supabase
    .from('lemmas')
    .update({ 
      is_reviewed: newValue,
      reviewed_at: newValue ? new Date().toISOString() : null
    })
    .eq('lemma_id', word.lemma_id || word.vocab_id)

  if (!error) {
    setWords(prev => prev.map(w =>
      (w.lemma_id || w.vocab_id) === (word.lemma_id || word.vocab_id)
        ? { ...w, is_reviewed: newValue }
        : w
    ))
  } else {
    console.error('Error toggling reviewed:', error)
  }
}, [])
```

Import icons:
```javascript
import { Search, ChevronDown, RefreshCw, ExternalLink, CheckCircle, Circle, Plus } from 'lucide-react'
```

### 2.8 Add Deep Dive Link

Update the Actions column to include a deep dive link:

```jsx
<td>
  <div className="flex items-center gap-1">
    <button
      onClick={(e) => {
        e.stopPropagation()
        toggleStopWord(word)
      }}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        word.is_stop_word
          ? 'bg-green-50 text-green-700 hover:bg-green-100'
          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      }`}
    >
      {word.is_stop_word ? 'Unmark' : 'Stop'}
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/admin/lemmas/${word.lemma_id || word.vocab_id}`)
      }}
      className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      title="View lemma details"
    >
      <ExternalLink size={14} />
    </button>
  </div>
</td>
```

### 2.9 Add Create New Lemma Button

Add button near the filters:

```jsx
<button
  onClick={() => setShowCreateModal(true)}
  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
>
  <Plus size={16} />
  New Lemma
</button>
```

We'll create the modal in the next section.

---

## Part 3: Create New Lemma Modal

**File:** `src/components/admin/CreateLemmaModal.jsx` (NEW)

```jsx
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CreateLemmaModal({ isOpen, onClose, onSuccess }) {
  const [lemmaText, setLemmaText] = useState('')
  const [definitions, setDefinitions] = useState([''])
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [gender, setGender] = useState('')
  const [isStopWord, setIsStopWord] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleAddDefinition = () => {
    setDefinitions(prev => [...prev, ''])
  }

  const handleRemoveDefinition = (index) => {
    setDefinitions(prev => prev.filter((_, i) => i !== index))
  }

  const handleDefinitionChange = (index, value) => {
    setDefinitions(prev => prev.map((d, i) => i === index ? value : d))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!lemmaText.trim()) {
      setError('Lemma text is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const cleanedDefinitions = definitions.filter(d => d.trim() !== '')
      
      const { data, error: insertError } = await supabase
        .from('lemmas')
        .insert({
          lemma_text: lemmaText.trim(),
          definitions: cleanedDefinitions.length > 0 ? cleanedDefinitions : null,
          part_of_speech: partOfSpeech || null,
          gender: gender || null,
          is_stop_word: isStopWord,
          is_reviewed: false,
          language_code: 'es'
        })
        .select()
        .single()

      if (insertError) throw insertError

      onSuccess(data)
      handleClose()
    } catch (err) {
      console.error('Error creating lemma:', err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setLemmaText('')
    setDefinitions([''])
    setPartOfSpeech('')
    setGender('')
    setIsStopWord(false)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">Create New Lemma</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Lemma Text *
            </label>
            <input
              type="text"
              value={lemmaText}
              onChange={(e) => setLemmaText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., el libro"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Definitions
            </label>
            <div className="space-y-2">
              {definitions.map((def, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={def}
                    onChange={(e) => handleDefinitionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Definition ${index + 1}`}
                  />
                  {definitions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDefinition(index)}
                      className="p-2 text-neutral-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddDefinition}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={14} />
                Add definition
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Part of Speech
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="NOUN">Noun</option>
                <option value="VERB">Verb</option>
                <option value="ADJ">Adjective</option>
                <option value="ADV">Adverb</option>
                <option value="PRON">Pronoun</option>
                <option value="DET">Determiner</option>
                <option value="ADP">Preposition</option>
                <option value="CONJ">Conjunction</option>
                <option value="NUM">Numeral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">N/A</option>
                <option value="masculine">Masculine</option>
                <option value="feminine">Feminine</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isStopWord"
              checked={isStopWord}
              onChange={(e) => setIsStopWord(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="isStopWord" className="text-sm text-neutral-700">
              Mark as stop word
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create Lemma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Add to AdminCommonWords.jsx:**

```javascript
import CreateLemmaModal from '../components/admin/CreateLemmaModal'

// Add state
const [showCreateModal, setShowCreateModal] = useState(false)

// Add handler
const handleLemmaCreated = (newLemma) => {
  setWords(prev => [{
    ...newLemma,
    vocab_id: newLemma.lemma_id,
    lemma: newLemma.lemma_text,
    english_definition: Array.isArray(newLemma.definitions) ? newLemma.definitions[0] : newLemma.definitions,
    word_count: 0,
    chapter_ids: []
  }, ...prev])
}

// Add modal at end of component
<CreateLemmaModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onSuccess={handleLemmaCreated}
/>
```

---

## Part 4: Lemma Deep Dive Page

**File:** `src/pages/LemmaDeepDive.jsx` (NEW)

```jsx
/**
 * LemmaDeepDive - Complete lemma breakdown view
 *
 * Features:
 * - Edit lemma text, definitions, POS, gender
 * - Toggle stop word and reviewed status
 * - View all word occurrences grouped by chapter
 * - Reassign words to different lemma
 * - Delete lemma (with safeguards)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  X
} from 'lucide-react'
import LemmaReassignModal from '../components/admin/LemmaReassignModal'

export default function LemmaDeepDive() {
  const { lemmaId } = useParams()
  const navigate = useNavigate()

  // Lemma data
  const [lemma, setLemma] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editedLemma, setEditedLemma] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Word occurrences
  const [wordOccurrences, setWordOccurrences] = useState([])
  const [expandedChapters, setExpandedChapters] = useState({})

  // Reassign modal
  const [reassignWord, setReassignWord] = useState(null)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch lemma data
  const fetchLemmaData = useCallback(async () => {
    if (!lemmaId) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch lemma
      const { data: lemmaData, error: lemmaError } = await supabase
        .from('lemmas')
        .select('*')
        .eq('lemma_id', lemmaId)
        .single()

      if (lemmaError) throw lemmaError
      setLemma(lemmaData)
      setEditedLemma(lemmaData)

      // Fetch word occurrences with sentence and chapter info
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select(`
          word_id,
          word_text,
          word_position,
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
        .eq('lemma_id', lemmaId)
        .order('word_text')

      if (wordsError) throw wordsError

      // Group by chapter
      const grouped = {}
      wordsData?.forEach(word => {
        const chapterId = word.sentences?.chapter_id
        if (!chapterId) return

        if (!grouped[chapterId]) {
          grouped[chapterId] = {
            chapter: word.sentences?.chapters,
            words: []
          }
        }
        grouped[chapterId].words.push(word)
      })

      // Sort chapters and words within chapters
      const sortedOccurrences = Object.values(grouped)
        .sort((a, b) => a.chapter.chapter_number - b.chapter.chapter_number)
        .map(group => ({
          ...group,
          words: group.words.sort((a, b) => 
            a.sentences.sentence_order - b.sentences.sentence_order
          )
        }))

      setWordOccurrences(sortedOccurrences)

      // Expand first chapter by default
      if (sortedOccurrences.length > 0) {
        setExpandedChapters({ [sortedOccurrences[0].chapter.chapter_id]: true })
      }

    } catch (err) {
      console.error('Error fetching lemma data:', err)
      setError('Failed to load lemma data')
    } finally {
      setIsLoading(false)
    }
  }, [lemmaId])

  useEffect(() => {
    fetchLemmaData()
  }, [fetchLemmaData])

  // Handlers
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('lemmas')
        .update({
          lemma_text: editedLemma.lemma_text,
          definitions: editedLemma.definitions,
          part_of_speech: editedLemma.part_of_speech,
          gender: editedLemma.gender,
          is_stop_word: editedLemma.is_stop_word
        })
        .eq('lemma_id', lemmaId)

      if (error) throw error

      setLemma(editedLemma)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving lemma:', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleReviewed = async () => {
    const newValue = !lemma.is_reviewed
    const { error } = await supabase
      .from('lemmas')
      .update({ 
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('lemma_id', lemmaId)

    if (!error) {
      setLemma(prev => ({ ...prev, is_reviewed: newValue }))
      setEditedLemma(prev => ({ ...prev, is_reviewed: newValue }))
    }
  }

  const handleDelete = async () => {
    // Check if words are attached
    const totalWords = wordOccurrences.reduce((sum, ch) => sum + ch.words.length, 0)
    
    if (totalWords > 0) {
      alert(`Cannot delete: ${totalWords} words are still assigned to this lemma. Reassign them first.`)
      setShowDeleteConfirm(false)
      return
    }

    try {
      const { error } = await supabase
        .from('lemmas')
        .delete()
        .eq('lemma_id', lemmaId)

      if (error) throw error

      navigate('/admin/lemmas')
    } catch (err) {
      console.error('Error deleting lemma:', err)
      alert('Failed to delete: ' + err.message)
    }
  }

  const handleReassignWord = async (wordId, newLemmaId) => {
    const { error } = await supabase
      .from('words')
      .update({ lemma_id: newLemmaId })
      .eq('word_id', wordId)

    if (!error) {
      // Remove word from current view
      setWordOccurrences(prev => prev.map(chapter => ({
        ...chapter,
        words: chapter.words.filter(w => w.word_id !== wordId)
      })).filter(chapter => chapter.words.length > 0))
    } else {
      console.error('Error reassigning word:', error)
      alert('Failed to reassign: ' + error.message)
    }

    setReassignWord(null)
  }

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }))
  }

  // Definition helpers
  const getDefinitionsArray = () => {
    if (!editedLemma.definitions) return ['']
    if (Array.isArray(editedLemma.definitions)) return editedLemma.definitions
    return [editedLemma.definitions]
  }

  const handleDefinitionChange = (index, value) => {
    const defs = getDefinitionsArray()
    const newDefs = [...defs]
    newDefs[index] = value
    setEditedLemma(prev => ({ ...prev, definitions: newDefs }))
  }

  const handleAddDefinition = () => {
    const defs = getDefinitionsArray()
    setEditedLemma(prev => ({ ...prev, definitions: [...defs, ''] }))
  }

  const handleRemoveDefinition = (index) => {
    const defs = getDefinitionsArray()
    setEditedLemma(prev => ({ 
      ...prev, 
      definitions: defs.filter((_, i) => i !== index) 
    }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading lemma...</div>
      </div>
    )
  }

  // Error state
  if (error || !lemma) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Lemma not found'}</p>
        <Link to="/admin/lemmas" className="text-blue-600 hover:text-blue-700">
          ← Back to Lemmas
        </Link>
      </div>
    )
  }

  const totalOccurrences = wordOccurrences.reduce((sum, ch) => sum + ch.words.length, 0)
  const definitions = getDefinitionsArray()

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

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleReviewed}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              lemma.is_reviewed
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {lemma.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
            {lemma.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>
        </div>
      </div>

      {/* Lemma Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">
            Lemma Details
          </h2>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditedLemma(lemma)
                    setIsEditing(false)
                  }}
                  className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={14} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-lg text-sm hover:bg-neutral-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Lemma Text */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Lemma Text
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedLemma.lemma_text || ''}
                onChange={(e) => setEditedLemma(prev => ({ ...prev, lemma_text: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-xl font-medium text-neutral-900">{lemma.lemma_text}</p>
            )}
          </div>

          {/* Definitions */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Definitions
            </label>
            {isEditing ? (
              <div className="space-y-2">
                {definitions.map((def, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={def || ''}
                      onChange={(e) => handleDefinitionChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Definition ${index + 1}`}
                    />
                    {definitions.length > 1 && (
                      <button
                        onClick={() => handleRemoveDefinition(index)}
                        className="p-2 text-neutral-400 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddDefinition}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus size={14} />
                  Add definition
                </button>
              </div>
            ) : (
              <p className="text-neutral-700">
                {lemma.definitions && Array.isArray(lemma.definitions) 
                  ? lemma.definitions.join(', ') 
                  : lemma.definitions || <span className="italic text-neutral-400">No definition</span>
                }
              </p>
            )}
          </div>

          {/* POS and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
                Part of Speech
              </label>
              {isEditing ? (
                <select
                  value={editedLemma.part_of_speech || ''}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, part_of_speech: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="NOUN">Noun</option>
                  <option value="VERB">Verb</option>
                  <option value="ADJ">Adjective</option>
                  <option value="ADV">Adverb</option>
                  <option value="PRON">Pronoun</option>
                  <option value="DET">Determiner</option>
                  <option value="ADP">Preposition</option>
                  <option value="CONJ">Conjunction</option>
                  <option value="NUM">Numeral</option>
                </select>
              ) : (
                <p className="text-neutral-700">{lemma.part_of_speech || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
                Gender
              </label>
              {isEditing ? (
                <select
                  value={editedLemma.gender || ''}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">N/A</option>
                  <option value="masculine">Masculine</option>
                  <option value="feminine">Feminine</option>
                </select>
              ) : (
                <p className="text-neutral-700">{lemma.gender || '—'}</p>
              )}
            </div>
          </div>

          {/* Stop Word Toggle */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Stop Word
            </label>
            {isEditing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editedLemma.is_stop_word || false}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, is_stop_word: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-neutral-700">
                  Exclude from learning sessions
                </span>
              </label>
            ) : (
              <p className="text-neutral-700">
                {lemma.is_stop_word ? (
                  <span className="px-2 py-1 bg-neutral-200 text-neutral-600 rounded text-sm">Stop word</span>
                ) : (
                  'Active (included in learning)'
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Word Occurrences */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Word Occurrences ({totalOccurrences} across {wordOccurrences.length} chapters)
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {wordOccurrences.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-sm italic">
              No word occurrences found for this lemma
            </div>
          ) : (
            wordOccurrences.map(({ chapter, words }) => (
              <div key={chapter.chapter_id}>
                {/* Chapter header */}
                <button
                  onClick={() => toggleChapter(chapter.chapter_id)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedChapters[chapter.chapter_id] ? (
                      <ChevronDown size={16} className="text-neutral-400" />
                    ) : (
                      <ChevronRight size={16} className="text-neutral-400" />
                    )}
                    <span className="font-medium text-neutral-800">
                      Chapter {chapter.chapter_number}: {chapter.title}
                    </span>
                  </div>
                  <span className="text-sm text-neutral-500">
                    {words.length} occurrence{words.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Words list */}
                {expandedChapters[chapter.chapter_id] && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 text-xs text-neutral-500 uppercase tracking-wide">
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
                                {word.sentences?.sentence_text}
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
                                  className="p-1.5 rounded text-neutral-400 hover:text-orange-600 hover:bg-orange-50"
                                  title="Reassign to different lemma"
                                >
                                  <RefreshCw size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">Delete Lemma?</h3>
            <p className="text-neutral-600 mb-4">
              This will permanently delete the lemma "{lemma.lemma_text}".
              {totalOccurrences > 0 && (
                <span className="block mt-2 text-red-600">
                  Warning: {totalOccurrences} words are still assigned to this lemma.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lemma Reassign Modal (reuse existing) */}
      <LemmaReassignModal
        isOpen={!!reassignWord}
        word={reassignWord}
        onClose={() => setReassignWord(null)}
        onConfirm={(newLemmaId) => handleReassignWord(reassignWord?.word_id, newLemmaId)}
      />
    </div>
  )
}
```

---

## Part 5: Add Route

**File:** `src/App.jsx`

Add the new route:

```jsx
import LemmaDeepDive from './pages/LemmaDeepDive'

// Inside Routes
<Route path="/admin/lemmas/:lemmaId" element={<LemmaDeepDive />} />
```

---

## Part 6: Fix AddPhraseModal Bug

**File:** `src/components/admin/AddPhraseModal.jsx`

The modal fails to save new phrases because `component_lemmas` is required.

Find the insert statement (around line 126) and update:

```javascript
// Get selected words for component_lemmas
const selectedWords = words
  .filter(w => w.word_position >= start && w.word_position <= end)
  .sort((a, b) => a.word_position - b.word_position)

// Extract unique lemma IDs
const componentLemmas = [...new Set(
  selectedWords
    .map(w => w.lemmas?.lemma_id || w.lemma_id)
    .filter(Boolean)
)]

// Create new phrase
const { data: newPhrase, error: phraseError } = await supabase
  .from('phrases')
  .insert({
    phrase_text: newPhraseText.trim(),
    definitions: newDefinition.trim() ? [newDefinition.trim()] : [],
    phrase_type: newPhraseType,
    is_reviewed: false,
    component_lemmas: componentLemmas  // ADD THIS
  })
  .select()
  .single()
```

Also change `definitions: null` to `definitions: []` to avoid null constraint issues.

---

## Part 7: Update Documentation

### 99_LIVING_CHANGELOG.md

Add entry:

```markdown
## [2025-12-24] Admin Suite Phase 2a: Lemmas Management

### Added
- **Enhanced Lemmas List** (renamed from Common Words)
  - `is_reviewed` toggle column with visual indicator
  - POS filter dropdown
  - Chapter filter dropdown  
  - Review status filter (reviewed/unreviewed)
  - Definition filter (has/missing)
  - Deep dive link for each lemma
  - Create New Lemma button and modal

- **Lemma Deep Dive** (`/admin/lemmas/:lemmaId`)
  - Edit lemma text, definitions, POS, gender
  - Toggle stop word and reviewed status
  - Word occurrences grouped by chapter
  - Sentence context for each occurrence
  - Reassign words to different lemma
  - Delete lemma (with safeguards)
  - Link to Sentence Deep Dive from occurrences

- **Create Lemma Modal**
  - Full form for new lemma creation
  - Multiple definitions support

### Fixed
- AddPhraseModal now includes `component_lemmas` when creating new phrases
- Supabase max rows increased to 20,000 (project settings)

### Database Changes
- Added `is_reviewed` (BOOLEAN) to `lemmas` table
- Added `reviewed_at` (TIMESTAMPTZ) to `lemmas` table
- Added `is_reviewed` (BOOLEAN) to `sentences` table
- Added `reviewed_at` (TIMESTAMPTZ) to `sentences` table
```

### 22_ADMIN_DASHBOARD.md

Update Implementation Status:

```markdown
### Completed (Phase 1 + 2a)
- ✅ Sentence Management table
- ✅ Sentence Deep Dive view
- ✅ Fragment editing
- ✅ Words table with lemma info
- ✅ Lemma definition editing
- ✅ Lemma reassignment
- ✅ Stop word toggle
- ✅ Phrase occurrences display
- ✅ Add phrase modal
- ✅ Lemmas page (enhanced)
- ✅ Lemma Deep Dive page
- ✅ Create New Lemma
- ✅ Lemma review workflow

### Planned (Phase 2b)
- 🔲 Orphaned Words view
- 🔲 Delete lemma with word reassignment

### Planned (Phase 2c)
- 🔲 Phrases Management page
- 🔲 Phrase Deep Dive page

### Planned (Phase 2d)
- 🔲 Sentences `is_reviewed` enhancement
```

---

## Summary Checklist

**Code Changes:**
- [ ] Rename "Common Words" tab to "Lemmas" in Admin.jsx
- [ ] Add new filters to AdminCommonWords.jsx (POS, chapter, reviewed, definition)
- [ ] Add `is_reviewed` column and toggle to lemmas table
- [ ] Add deep dive link button to lemmas table
- [ ] Add Create New Lemma button and modal
- [ ] Create LemmaDeepDive.jsx page
- [ ] Add route for `/admin/lemmas/:lemmaId`
- [ ] Fix AddPhraseModal component_lemmas bug
- [ ] Update documentation

**Testing:**
1. Lemmas list shows all ~1,658 lemmas (not capped at 1000)
2. All filters work (POS, chapter, reviewed, definition)
3. Can toggle `is_reviewed` status
4. Deep dive link navigates to detail page
5. Can create new lemma
6. Lemma Deep Dive shows all occurrences grouped by chapter
7. Can edit lemma details
8. Can reassign word from lemma view
9. Can delete empty lemma (no words attached)
10. AddPhraseModal successfully creates new phrases

---

**END OF SPECIFICATION**
