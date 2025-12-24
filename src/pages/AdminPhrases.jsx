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

      {/* Count */}
      <div className="text-sm text-neutral-500">
        {sortedPhrases.length} phrases
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
