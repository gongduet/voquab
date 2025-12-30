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
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Circle,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight
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
  const [searchInput, setSearchInput] = useState(searchTerm)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Inline editing
  const [editingPhraseId, setEditingPhraseId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    reviewed: 0,
    unreviewed: 0
  })

  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    const defaults = {
      search: '',
      type: 'all',
      reviewed: 'all',
      chapter: 'all',
      sortBy: 'alphabetical',
      sortOrder: 'asc'
    }
    if (value === defaults[key]) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const fetchPhrases = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Use RPC for server-side filtering, sorting, and pagination
      const { data, error: rpcError } = await supabase.rpc('search_phrases', {
        p_search: searchTerm,
        p_type: filterType,
        p_reviewed: filterReviewed,
        p_chapter_id: filterChapter !== 'all' ? filterChapter : null,
        p_sort_by: sortBy,
        p_sort_order: sortOrder,
        p_page: page,
        p_page_size: pageSize
      })

      if (rpcError) throw rpcError

      setPhrases(data || [])
      if (data?.length > 0) {
        setTotalCount(data[0].total_count)
      } else {
        setTotalCount(0)
      }

      // Fetch chapters for filter dropdown (only once)
      if (chapters.length === 0) {
        const { data: chaptersData } = await supabase
          .from('chapters')
          .select('chapter_id, chapter_number, title')
          .order('chapter_number')

        setChapters(chaptersData || [])
      }

    } catch (err) {
      console.error('Error fetching phrases:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterType, filterReviewed, filterChapter, sortBy, sortOrder, page, pageSize, chapters.length])

  useEffect(() => {
    fetchPhrases()
  }, [fetchPhrases])

  useEffect(() => {
    const reviewed = phrases.filter(p => p.is_reviewed).length
    setStats({ total: totalCount, reviewed, unreviewed: phrases.length - reviewed })
  }, [phrases, totalCount])

  // Debounce search input - wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchTerm) {
        updateFilter('search', searchInput)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Sync searchInput when URL changes (e.g., clear filters button)
  useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [searchTerm, filterType, filterReviewed, filterChapter, sortBy, sortOrder])

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

  const handleCopyPhrase = useCallback((phrase) => {
    navigator.clipboard.writeText(phrase.phrase_text)
  }, [])

  const handleStartEdit = useCallback((phrase, e) => {
    e.stopPropagation()
    setEditingPhraseId(phrase.phrase_id)
    // Convert definitions array to comma-separated string for editing
    const defs = phrase.definitions
    if (Array.isArray(defs)) {
      setEditValue(defs.join(', '))
    } else if (typeof defs === 'string') {
      try {
        const parsed = JSON.parse(defs)
        setEditValue(Array.isArray(parsed) ? parsed.join(', ') : defs)
      } catch {
        setEditValue(defs || '')
      }
    } else {
      setEditValue('')
    }
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingPhraseId(null)
    setEditValue('')
  }, [])

  const handleSaveEdit = useCallback(async (phraseId) => {
    if (isSaving) return

    setIsSaving(true)
    try {
      // Convert comma-separated string back to array
      const definitionsArray = editValue
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)

      const { error } = await supabase
        .from('phrases')
        .update({ definitions: definitionsArray })
        .eq('phrase_id', phraseId)

      if (error) throw error

      // Update local state
      setPhrases(prev => prev.map(p =>
        p.phrase_id === phraseId
          ? { ...p, definitions: definitionsArray }
          : p
      ))

      setEditingPhraseId(null)
      setEditValue('')
    } catch (err) {
      console.error('Error saving definition:', err)
      alert(`Error saving: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }, [editValue, isSaving])

  const handleEditKeyDown = useCallback((e, phraseId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit(phraseId)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [handleSaveEdit, handleCancelEdit])

  // Server-side filtering/sorting via RPC - no client-side needed

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

      const currentIndex = phrases.findIndex(p => p.phrase_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < phrases.length - 1) {
            setSelectedId(phrases[currentIndex + 1].phrase_id)
          } else if (currentIndex === -1 && phrases.length > 0) {
            setSelectedId(phrases[0].phrase_id)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(phrases[currentIndex - 1].phrase_id)
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
  }, [phrases, selectedId, navigate])

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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
          <option value="reviewed">Reviewed</option>
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

        {/* Clear filters */}
        {(searchTerm || filterType !== 'all' || filterReviewed !== 'all' || filterChapter !== 'all') && (
          <button
            onClick={() => setSearchParams({})}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            Clear Filters
          </button>
        )}

        {/* New Phrase */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          New Phrase
        </button>
      </div>

      {/* Count + Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          {totalCount > 0
            ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalCount)} of ${totalCount.toLocaleString()} phrases`
            : '0 phrases'}
        </div>
        {totalCount > pageSize && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-neutral-600">
              Page {page + 1} of {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="p-1.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Open details / Save edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Esc</kbd> Cancel edit</span>
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
              {phrases.map((phrase) => (
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
                    {editingPhraseId === phrase.phrase_id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(phrase.phrase_id)}
                        onKeyDown={(e) => handleEditKeyDown(e, phrase.phrase_id)}
                        className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        disabled={isSaving}
                        placeholder="Enter definitions separated by commas"
                      />
                    ) : (
                      <span
                        onClick={(e) => handleStartEdit(phrase, e)}
                        className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded -mx-2 block"
                        title="Click to edit"
                      >
                        {Array.isArray(phrase.definitions) && phrase.definitions.length > 0
                          ? phrase.definitions.join(', ')
                          : <span className="text-neutral-300 italic">Click to add...</span>}
                      </span>
                    )}
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCopyPhrase(phrase)
                        }}
                        className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Copy phrase"
                      >
                        <Copy size={14} />
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {phrases.length === 0 && (
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
