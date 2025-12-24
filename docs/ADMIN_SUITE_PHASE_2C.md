# Admin Suite Phase 2c: Phrases Management

**Date:** December 24, 2025  
**For:** Claude Code Implementation  
**Priority:** MEDIUM

---

## Overview

This phase adds Phrases management following the same patterns as Lemmas:
1. Phrases List page with search, filters, and CRUD
2. Phrase Deep Dive page for detailed editing and viewing occurrences
3. Navigation tab in admin

**Prerequisites completed:**
- RLS policies added for `phrases` and `phrase_occurrences` (INSERT, UPDATE, DELETE)
- Foreign key cascades set up for phrase deletion

---

## Part 1: Add Phrases Tab to Admin Navigation

**File:** `src/pages/Admin.jsx`

Add "Phrases" tab alongside Lemmas and Sentences:

```jsx
// Tab list
<Tab>Lemmas</Tab>
<Tab>Phrases</Tab>  {/* NEW */}
<Tab>Sentences</Tab>

// Tab panels - add corresponding panel
<TabPanel>
  <AdminPhrases />  {/* NEW */}
</TabPanel>
```

Also update the Admin Dashboard cards to include Phrases:

```jsx
<Link to="/admin/phrases" className="...">
  <h3>Phrases</h3>
  <p>Manage multi-word expressions, idioms, and collocations</p>
</Link>
```

Import the new component:
```javascript
import AdminPhrases from './AdminPhrases'
```

---

## Part 2: Phrases List Page

**File:** `src/pages/AdminPhrases.jsx` (NEW)

Create following the AdminCommonWords.jsx pattern:

```jsx
/**
 * AdminPhrases - Manage phrases (multi-word expressions, idioms, collocations)
 *
 * Features:
 * - View all phrases with occurrence counts
 * - Filter by type, review status, chapter
 * - Toggle reviewed status
 * - Search by phrase text or definition
 * - Link to Phrase Deep Dive
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  Circle, 
  Plus 
} from 'lucide-react'
import CreatePhraseModal from '../components/admin/CreatePhraseModal'

export default function AdminPhrases() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL
  const searchTerm = searchParams.get('search') || ''
  const filterType = searchParams.get('type') || 'all'
  const filterReviewed = searchParams.get('reviewed') || 'all'
  const filterChapter = searchParams.get('chapter') || 'all'
  const sortBy = searchParams.get('sortBy') || 'alphabetical'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // State
  const [phrases, setPhrases] = useState([])
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    reviewed: 0,
    unreviewed: 0
  })

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams)
    if (value === 'all' || value === '' || value === 'alphabetical' || value === 'asc') {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }

  const fetchPhrases = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all phrases
      const { data: phraseData, error: phraseError } = await supabase
        .from('phrases')
        .select('*')
        .range(0, 9999)
        .order('phrase_text')

      if (phraseError) throw phraseError

      // Fetch occurrence counts
      const { data: occurrenceData, error: occError } = await supabase
        .from('phrase_occurrences')
        .select('phrase_id, sentence_id, sentences(chapter_id)')
        .range(0, 99999)

      if (occError) console.error('Error fetching occurrences:', occError)

      // Count occurrences and chapters per phrase
      const occurrenceMap = {}
      const chapterMap = {}
      occurrenceData?.forEach(occ => {
        if (occ.phrase_id) {
          occurrenceMap[occ.phrase_id] = (occurrenceMap[occ.phrase_id] || 0) + 1
          if (occ.sentences?.chapter_id) {
            if (!chapterMap[occ.phrase_id]) {
              chapterMap[occ.phrase_id] = new Set()
            }
            chapterMap[occ.phrase_id].add(occ.sentences.chapter_id)
          }
        }
      })

      // Merge data
      const phrasesWithCounts = phraseData.map(p => ({
        ...p,
        occurrence_count: occurrenceMap[p.phrase_id] || 0,
        chapter_ids: chapterMap[p.phrase_id] ? Array.from(chapterMap[p.phrase_id]) : []
      }))

      setPhrases(phrasesWithCounts)

      // Fetch chapters for filter
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('chapter_id, chapter_number, title')
        .order('chapter_number')

      setChapters(chaptersData || [])

    } catch (err) {
      console.error('Error fetching phrases:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPhrases()
  }, [fetchPhrases])

  useEffect(() => {
    const total = phrases.length
    const reviewed = phrases.filter(p => p.is_reviewed).length
    setStats({ total, reviewed, unreviewed: total - reviewed })
  }, [phrases])

  const toggleReviewed = useCallback(async (phrase) => {
    const newValue = !phrase.is_reviewed
    const { error } = await supabase
      .from('phrases')
      .update({ 
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('phrase_id', phrase.phrase_id)

    if (!error) {
      setPhrases(prev => prev.map(p =>
        p.phrase_id === phrase.phrase_id
          ? { ...p, is_reviewed: newValue }
          : p
      ))
    }
  }, [])

  // Filter phrases
  const filteredPhrases = phrases.filter(phrase => {
    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesText = phrase.phrase_text?.toLowerCase().includes(search)
      const matchesDef = phrase.definitions?.some(d => 
        d.toLowerCase().includes(search)
      )
      if (!matchesText && !matchesDef) return false
    }

    // Type filter
    if (filterType !== 'all' && phrase.phrase_type !== filterType) return false

    // Review status
    if (filterReviewed === 'reviewed' && !phrase.is_reviewed) return false
    if (filterReviewed === 'unreviewed' && phrase.is_reviewed) return false

    // Chapter filter
    if (filterChapter !== 'all' && !phrase.chapter_ids?.includes(filterChapter)) return false

    return true
  })

  // Sort phrases
  const sortedPhrases = [...filteredPhrases].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'alphabetical':
        comparison = (a.phrase_text || '').localeCompare(b.phrase_text || '')
        break
      case 'occurrences':
        comparison = (b.occurrence_count || 0) - (a.occurrence_count || 0)
        break
      default:
        comparison = 0
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const handlePhraseCreated = (newPhrase) => {
    setPhrases(prev => [{
      ...newPhrase,
      occurrence_count: 0,
      chapter_ids: []
    }, ...prev])
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const currentIndex = sortedPhrases.findIndex(p => p.phrase_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < sortedPhrases.length - 1) {
            setSelectedId(sortedPhrases[currentIndex + 1].phrase_id)
          } else if (currentIndex === -1 && sortedPhrases.length > 0) {
            setSelectedId(sortedPhrases[0].phrase_id)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(sortedPhrases[currentIndex - 1].phrase_id)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (selectedId) {
            navigate(`/admin/phrases/${selectedId}`)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedPhrases, selectedId, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading phrases...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Phrases</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Reviewed</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.reviewed.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Needs Review</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.unreviewed.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search phrases..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => updateFilter('type', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="idiom">Idioms</option>
          <option value="compound">Compounds</option>
          <option value="collocation">Collocations</option>
          <option value="expression">Expressions</option>
        </select>

        {/* Chapter filter */}
        <select
          value={filterChapter}
          onChange={(e) => updateFilter('chapter', e.target.value)}
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
          onChange={(e) => updateFilter('reviewed', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Review Status</option>
          <option value="reviewed">Reviewed ✓</option>
          <option value="unreviewed">Needs Review</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="alphabetical">Sort Alphabetically</option>
          <option value="occurrences">Sort by Occurrences</option>
        </select>

        {/* Sort order */}
        <button
          onClick={() => updateFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        {/* Refresh */}
        <button
          onClick={fetchPhrases}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* New Phrase */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          New Phrase
        </button>

        {/* Clear filters */}
        {(searchTerm || filterType !== 'all' || filterReviewed !== 'all' || filterChapter !== 'all') && (
          <button
            onClick={() => setSearchParams({})}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Clear Filters
          </button>
        )}

        {/* Count */}
        <div className="text-sm text-neutral-500">
          {sortedPhrases.length} phrases
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Open details</span>
      </div>

      {/* Phrases Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Phrase
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Definition
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-28">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Occurrences
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Reviewed
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPhrases.map((phrase) => (
                <tr
                  key={phrase.phrase_id}
                  onClick={() => setSelectedId(phrase.phrase_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === phrase.phrase_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-neutral-800">
                      {phrase.phrase_text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {phrase.definitions?.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {phrase.phrase_type && (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        {phrase.phrase_type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      phrase.occurrence_count > 5 ? 'bg-blue-100 text-blue-700' :
                      phrase.occurrence_count > 0 ? 'bg-blue-50 text-blue-600' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {phrase.occurrence_count}×
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleReviewed(phrase)
                      }}
                      className={`p-1 rounded transition-colors ${
                        phrase.is_reviewed
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
                      }`}
                    >
                      {phrase.is_reviewed ? (
                        <CheckCircle size={18} className="fill-green-100" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/phrases/${phrase.phrase_id}`)
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="View phrase details"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedPhrases.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-neutral-500 text-sm">No phrases match your filters</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreatePhraseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handlePhraseCreated}
      />
    </div>
  )
}
```

---

## Part 3: Create Phrase Modal

**File:** `src/components/admin/CreatePhraseModal.jsx` (NEW)

```jsx
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CreatePhraseModal({ isOpen, onClose, onSuccess }) {
  const [phraseText, setPhraseText] = useState('')
  const [definitions, setDefinitions] = useState([''])
  const [phraseType, setPhraseType] = useState('compound')
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
    
    if (!phraseText.trim()) {
      setError('Phrase text is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const cleanedDefinitions = definitions.filter(d => d.trim() !== '')
      
      const { data, error: insertError } = await supabase
        .from('phrases')
        .insert({
          phrase_text: phraseText.trim(),
          definitions: cleanedDefinitions.length > 0 ? cleanedDefinitions : [],
          phrase_type: phraseType,
          is_reviewed: false,
          component_lemmas: []  // Empty array, can be populated later
        })
        .select()
        .single()

      if (insertError) throw insertError

      onSuccess(data)
      handleClose()
    } catch (err) {
      console.error('Error creating phrase:', err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setPhraseText('')
    setDefinitions([''])
    setPhraseType('compound')
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
          <h2 className="text-lg font-semibold text-neutral-800">Create New Phrase</h2>
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
              Phrase Text *
            </label>
            <input
              type="text"
              value={phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., a menudo"
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

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Type
            </label>
            <select
              value={phraseType}
              onChange={(e) => setPhraseType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="compound">Compound</option>
              <option value="idiom">Idiom</option>
              <option value="collocation">Collocation</option>
              <option value="expression">Expression</option>
            </select>
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
              {isSaving ? 'Creating...' : 'Create Phrase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

---

## Part 4: Phrase Deep Dive Page

**File:** `src/pages/PhraseDeepDive.jsx` (NEW)

```jsx
/**
 * PhraseDeepDive - Complete phrase breakdown view
 *
 * Features:
 * - Edit phrase text, definitions, type
 * - Toggle reviewed status
 * - View all occurrences across sentences
 * - Link to sentence deep dive
 * - Delete phrase
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
  Plus,
  X
} from 'lucide-react'

export default function PhraseDeepDive() {
  const { phraseId } = useParams()
  const navigate = useNavigate()

  // Phrase data
  const [phrase, setPhrase] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editedPhrase, setEditedPhrase] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Occurrences
  const [occurrences, setOccurrences] = useState([])
  const [expandedChapters, setExpandedChapters] = useState({})

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch phrase data
  const fetchPhraseData = useCallback(async () => {
    if (!phraseId) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch phrase
      const { data: phraseData, error: phraseError } = await supabase
        .from('phrases')
        .select('*')
        .eq('phrase_id', phraseId)
        .single()

      if (phraseError) throw phraseError
      setPhrase(phraseData)
      setEditedPhrase(phraseData)

      // Fetch occurrences with sentence and chapter info
      const { data: occData, error: occError } = await supabase
        .from('phrase_occurrences')
        .select(`
          occurrence_id,
          start_position,
          end_position,
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
        .eq('phrase_id', phraseId)
        .order('created_at')

      if (occError) throw occError

      // Group by chapter
      const grouped = {}
      occData?.forEach(occ => {
        const chapterId = occ.sentences?.chapter_id
        if (!chapterId) return

        if (!grouped[chapterId]) {
          grouped[chapterId] = {
            chapter: occ.sentences?.chapters,
            occurrences: []
          }
        }
        grouped[chapterId].occurrences.push(occ)
      })

      // Sort by chapter number
      const sortedOccurrences = Object.values(grouped)
        .sort((a, b) => a.chapter.chapter_number - b.chapter.chapter_number)
        .map(group => ({
          ...group,
          occurrences: group.occurrences.sort((a, b) => 
            a.sentences.sentence_order - b.sentences.sentence_order
          )
        }))

      setOccurrences(sortedOccurrences)

      // Expand first chapter
      if (sortedOccurrences.length > 0) {
        setExpandedChapters({ [sortedOccurrences[0].chapter.chapter_id]: true })
      }

    } catch (err) {
      console.error('Error fetching phrase data:', err)
      setError('Failed to load phrase data')
    } finally {
      setIsLoading(false)
    }
  }, [phraseId])

  useEffect(() => {
    fetchPhraseData()
  }, [fetchPhraseData])

  // Handlers
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('phrases')
        .update({
          phrase_text: editedPhrase.phrase_text,
          definitions: editedPhrase.definitions,
          phrase_type: editedPhrase.phrase_type
        })
        .eq('phrase_id', phraseId)

      if (error) throw error

      setPhrase(editedPhrase)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving phrase:', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleReviewed = async () => {
    const newValue = !phrase.is_reviewed
    const { error } = await supabase
      .from('phrases')
      .update({ 
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('phrase_id', phraseId)

    if (!error) {
      setPhrase(prev => ({ ...prev, is_reviewed: newValue }))
      setEditedPhrase(prev => ({ ...prev, is_reviewed: newValue }))
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('phrases')
        .delete()
        .eq('phrase_id', phraseId)

      if (error) throw error

      navigate('/admin/phrases')
    } catch (err) {
      console.error('Error deleting phrase:', err)
      alert('Failed to delete: ' + err.message)
    }
  }

  const handleDeleteOccurrence = async (occurrenceId) => {
    const { error } = await supabase
      .from('phrase_occurrences')
      .delete()
      .eq('occurrence_id', occurrenceId)

    if (!error) {
      setOccurrences(prev => prev.map(group => ({
        ...group,
        occurrences: group.occurrences.filter(o => o.occurrence_id !== occurrenceId)
      })).filter(group => group.occurrences.length > 0))
    } else {
      alert('Failed to delete occurrence: ' + error.message)
    }
  }

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }))
  }

  // Definition helpers
  const getDefinitionsArray = () => {
    if (!editedPhrase.definitions) return ['']
    if (Array.isArray(editedPhrase.definitions)) return editedPhrase.definitions
    return [editedPhrase.definitions]
  }

  const handleDefinitionChange = (index, value) => {
    const defs = getDefinitionsArray()
    const newDefs = [...defs]
    newDefs[index] = value
    setEditedPhrase(prev => ({ ...prev, definitions: newDefs }))
  }

  const handleAddDefinition = () => {
    const defs = getDefinitionsArray()
    setEditedPhrase(prev => ({ ...prev, definitions: [...defs, ''] }))
  }

  const handleRemoveDefinition = (index) => {
    const defs = getDefinitionsArray()
    setEditedPhrase(prev => ({ 
      ...prev, 
      definitions: defs.filter((_, i) => i !== index) 
    }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading phrase...</div>
      </div>
    )
  }

  // Error state
  if (error || !phrase) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Phrase not found'}</p>
        <Link to="/admin/phrases" className="text-blue-600 hover:text-blue-700">
          ← Back to Phrases
        </Link>
      </div>
    )
  }

  const totalOccurrences = occurrences.reduce((sum, g) => sum + g.occurrences.length, 0)
  const definitions = getDefinitionsArray()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={16} />
          Back to Phrases
        </button>

        <button
          onClick={handleToggleReviewed}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
            phrase.is_reviewed
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          {phrase.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
          {phrase.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
        </button>
      </div>

      {/* Phrase Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">
            Phrase Details
          </h2>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditedPhrase(phrase)
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
          {/* Phrase Text */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Phrase Text
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedPhrase.phrase_text || ''}
                onChange={(e) => setEditedPhrase(prev => ({ ...prev, phrase_text: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-xl font-medium text-neutral-900">{phrase.phrase_text}</p>
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
                {phrase.definitions?.join(', ') || <span className="italic text-neutral-400">No definition</span>}
              </p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Type
            </label>
            {isEditing ? (
              <select
                value={editedPhrase.phrase_type || ''}
                onChange={(e) => setEditedPhrase(prev => ({ ...prev, phrase_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="compound">Compound</option>
                <option value="idiom">Idiom</option>
                <option value="collocation">Collocation</option>
                <option value="expression">Expression</option>
              </select>
            ) : (
              <span className="px-2 py-1 text-sm font-medium bg-purple-100 text-purple-700 rounded">
                {phrase.phrase_type || 'Unknown'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Occurrences */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Occurrences ({totalOccurrences} across {occurrences.length} chapters)
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {occurrences.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-sm italic">
              No occurrences found for this phrase
            </div>
          ) : (
            occurrences.map(({ chapter, occurrences: chapterOccurrences }) => (
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
                    {chapterOccurrences.length} occurrence{chapterOccurrences.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Occurrences list */}
                {expandedChapters[chapter.chapter_id] && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 text-xs text-neutral-500 uppercase tracking-wide">
                          <th className="px-6 py-2 text-left">Sentence</th>
                          <th className="px-6 py-2 text-left">Position</th>
                          <th className="px-6 py-2 text-right w-32">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {chapterOccurrences.map((occ) => (
                          <tr key={occ.occurrence_id} className="hover:bg-neutral-50">
                            <td className="px-6 py-3">
                              <p className="text-sm text-neutral-600 line-clamp-2">
                                {occ.sentences?.sentence_text}
                              </p>
                            </td>
                            <td className="px-6 py-3 text-sm text-neutral-500">
                              {occ.start_position}–{occ.end_position}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => navigate(`/admin/sentences/${occ.sentence_id}`)}
                                  className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
                                  title="View sentence"
                                >
                                  <ExternalLink size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOccurrence(occ.occurrence_id)}
                                  className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50"
                                  title="Remove occurrence"
                                >
                                  <Trash2 size={14} />
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
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">Delete Phrase?</h3>
            <p className="text-neutral-600 mb-4">
              This will permanently delete the phrase "{phrase.phrase_text}" and all its occurrences.
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
    </div>
  )
}
```

---

## Part 5: Add Routes

**File:** `src/App.jsx`

Add the new routes:

```jsx
import AdminPhrases from './pages/AdminPhrases'
import PhraseDeepDive from './pages/PhraseDeepDive'

// Inside Routes
<Route path="/admin/phrases" element={<AdminPhrases />} />
<Route path="/admin/phrases/:phraseId" element={<PhraseDeepDive />} />
```

---

## Part 6: Update Documentation

### 99_LIVING_CHANGELOG.md

Add entry:

```markdown
## [2025-12-24] Admin Suite Phase 2c: Phrases Management

### Added
- **Phrases List Page** (`/admin/phrases`)
  - View all phrases with occurrence counts
  - Filter by type (idiom, compound, collocation, expression)
  - Filter by chapter, review status
  - Search by phrase text or definition
  - Toggle reviewed status
  - Create new phrase modal
  - Keyboard navigation

- **Phrase Deep Dive** (`/admin/phrases/:phraseId`)
  - Edit phrase text, definitions, type
  - Toggle reviewed status
  - View all occurrences grouped by chapter
  - Link to sentence deep dive from occurrences
  - Delete individual occurrences
  - Delete phrase (cascades to occurrences)

- **Phrases Tab** in Admin navigation
```

### 22_ADMIN_DASHBOARD.md

Update status:

```markdown
### Completed (Phase 1 + 2a + 2b + 2c)
- ✅ All previous items
- ✅ Phrases List page
- ✅ Phrase Deep Dive page
- ✅ Create Phrase modal
- ✅ Phrases navigation tab

### Planned (Phase 2d)
- 🔲 Sentences `is_reviewed` enhancement
```

---

## Summary Checklist

**Code Changes:**
- [ ] Create `src/pages/AdminPhrases.jsx`
- [ ] Create `src/components/admin/CreatePhraseModal.jsx`
- [ ] Create `src/pages/PhraseDeepDive.jsx`
- [ ] Add Phrases tab to Admin.jsx
- [ ] Add routes in App.jsx
- [ ] Update documentation

**Testing:**
1. Phrases tab appears in admin navigation
2. Phrases list shows all phrases with occurrence counts
3. Filters work (type, chapter, reviewed)
4. Search works
5. Can toggle reviewed status
6. Can create new phrase
7. Deep dive link works
8. Can edit phrase details
9. Can view occurrences by chapter
10. Can delete individual occurrence
11. Can delete phrase

---

**END OF SPECIFICATION**
