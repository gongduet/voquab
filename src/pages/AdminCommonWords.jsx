import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, ChevronDown, RefreshCw, ExternalLink, CheckCircle, Circle, Plus, AlertTriangle } from 'lucide-react'
import CreateLemmaModal from '../components/admin/CreateLemmaModal'

/**
 * AdminCommonWords - Manage stop words (common words that shouldn't appear in learning)
 *
 * Features:
 * - View all vocabulary with frequency counts
 * - Toggle stop word status for individual words
 * - Bulk mark top N words as stop words
 * - Filter and search functionality (persisted in URL)
 * - Sorting (frequency, alphabetical)
 * - Stats display
 * - Keyboard navigation
 */
export default function AdminCommonWords() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filter values from URL (with defaults)
  const searchTerm = searchParams.get('search') || ''
  const filterStopWords = searchParams.get('stopWords') || 'all'
  const filterPOS = searchParams.get('pos') || 'all'
  const filterChapter = searchParams.get('chapter') || 'all'
  const filterReviewed = searchParams.get('reviewed') || 'all'
  const filterDefinition = searchParams.get('definition') || 'all'
  const sortBy = searchParams.get('sortBy') || 'frequency'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  // Helper to update URL params
  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    // Remove default values from URL to keep it clean
    const defaults = {
      search: '',
      stopWords: 'all',
      pos: 'all',
      chapter: 'all',
      reviewed: 'all',
      definition: 'all',
      sortBy: 'frequency',
      sortOrder: 'desc'
    }
    if (value === defaults[key]) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [processing, setProcessing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const bulkMenuRef = useRef(null)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    stopWords: 0,
    activeWords: 0
  })

  useEffect(() => {
    fetchWords()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [words])

  // Close bulk menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target)) {
        setShowBulkMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchWords() {
    try {
      setLoading(true)
      setError(null)

      // Fetch all lemmas - override default 1000 limit
      const { data: lemmaData, error: lemmaError, count } = await supabase
        .from('lemmas')
        .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word, is_reviewed, gender', { count: 'exact' })
        .eq('language_code', 'es')
        .range(0, 19999)
        .order('lemma_text')

      if (lemmaError) throw lemmaError

      console.log(`Fetched ${lemmaData.length} lemmas (total: ${count})`)

      // Fetch chapters for filter dropdown
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('chapter_id, chapter_number, title')
        .order('chapter_number')

      setChapters(chaptersData || [])

      // Fetch word counts per lemma with chapter info
      const { data: allWords, error: wordsError } = await supabase
        .from('words')
        .select(`
          lemma_id,
          sentences!inner (
            chapter_id
          )
        `)
        .range(0, 99999)

      if (wordsError) {
        console.error('Error fetching word counts:', wordsError)
      }

      // Count occurrences per lemma and track chapter associations
      const countMap = {}
      const lemmaChaptersMap = {}
      if (allWords) {
        allWords.forEach(w => {
          if (w.lemma_id) {
            countMap[w.lemma_id] = (countMap[w.lemma_id] || 0) + 1

            // Track chapter associations
            if (w.sentences?.chapter_id) {
              if (!lemmaChaptersMap[w.lemma_id]) {
                lemmaChaptersMap[w.lemma_id] = new Set()
              }
              lemmaChaptersMap[w.lemma_id].add(w.sentences.chapter_id)
            }
          }
        })
      }

      console.log(`Word count map has ${Object.keys(countMap).length} entries`)

      // Merge counts into lemma data
      const wordsWithCounts = lemmaData.map(l => ({
        ...l,
        vocab_id: l.lemma_id,
        lemma: l.lemma_text,
        english_definition: Array.isArray(l.definitions) ? l.definitions.join(', ') : l.definitions,
        word_count: countMap[l.lemma_id] || 0,
        chapter_ids: lemmaChaptersMap[l.lemma_id] ? Array.from(lemmaChaptersMap[l.lemma_id]) : []
      }))

      setWords(wordsWithCounts)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching words:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  function calculateStats() {
    const total = words.length
    const stopWords = words.filter(w => w.is_stop_word).length
    const activeWords = total - stopWords

    setStats({ total, stopWords, activeWords })
  }

  const toggleStopWord = useCallback(async (word) => {
    try {
      const newStatus = !word.is_stop_word

      const { error } = await supabase
        .from('lemmas')
        .update({ is_stop_word: newStatus })
        .eq('lemma_id', word.lemma_id || word.vocab_id)

      if (error) throw error

      setWords(prev => prev.map(w =>
        (w.lemma_id || w.vocab_id) === (word.lemma_id || word.vocab_id)
          ? { ...w, is_stop_word: newStatus }
          : w
      ))
    } catch (err) {
      console.error('Error toggling stop word:', err)
      alert(`Error: ${err.message}`)
    }
  }, [])

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

  async function bulkMarkStopWords(topN) {
    if (!confirm(`Mark top ${topN} words by frequency as stop words?`)) {
      return
    }

    try {
      setProcessing(true)
      setShowBulkMenu(false)

      // Sort by frequency and get top N that aren't already stop words
      const topLemmas = [...words]
        .sort((a, b) => (b.word_count || 0) - (a.word_count || 0))
        .filter(w => !w.is_stop_word)
        .slice(0, topN)
        .map(w => w.lemma_id || w.vocab_id)

      if (topLemmas.length === 0) {
        alert('No words to mark (top words are already marked as stop words)')
        setProcessing(false)
        return
      }

      const { error } = await supabase
        .from('lemmas')
        .update({ is_stop_word: true })
        .in('lemma_id', topLemmas)

      if (error) throw error

      setWords(prev => prev.map(w =>
        topLemmas.includes(w.lemma_id || w.vocab_id)
          ? { ...w, is_stop_word: true }
          : w
      ))

      alert(`Successfully marked ${topLemmas.length} words as stop words`)
      setProcessing(false)
    } catch (err) {
      console.error('Error bulk marking:', err)
      alert(`Error: ${err.message}`)
      setProcessing(false)
    }
  }

  // Handler for new lemma creation
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

  // Filter words based on search and filters
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
      default:
        comparison = 0
    }

    return sortOrder === 'asc' ? -comparison : comparison
  })

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentIndex = sortedWords.findIndex(w => w.vocab_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < sortedWords.length - 1) {
            setSelectedId(sortedWords[currentIndex + 1].vocab_id)
          } else if (currentIndex === -1 && sortedWords.length > 0) {
            setSelectedId(sortedWords[0].vocab_id)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(sortedWords[currentIndex - 1].vocab_id)
          }
          break

        case 's':
        case 'S':
          e.preventDefault()
          if (selectedId) {
            const word = sortedWords.find(w => w.vocab_id === selectedId)
            if (word) {
              toggleStopWord(word)
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedWords, selectedId, toggleStopWord])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="animate-pulse text-neutral-400">Loading vocabulary...</div>
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
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Words</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Stop Words</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.stopWords.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Active Learning Words</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.activeWords.toLocaleString()}</div>
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
            placeholder="Search words..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Stop word filter */}
        <select
          value={filterStopWords}
          onChange={(e) => updateFilter('stopWords', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Words</option>
          <option value="active">Active Only</option>
          <option value="stop">Stop Words Only</option>
        </select>

        {/* POS filter */}
        <select
          value={filterPOS}
          onChange={(e) => updateFilter('pos', e.target.value)}
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

        {/* Definition filter */}
        <select
          value={filterDefinition}
          onChange={(e) => updateFilter('definition', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Definitions</option>
          <option value="has">Has Definition</option>
          <option value="missing">Missing Definition</option>
        </select>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="frequency">Sort by Frequency</option>
          <option value="alphabetical">Sort Alphabetically</option>
        </select>

        {/* Sort order toggle */}
        <button
          onClick={() => updateFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm"
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        {/* Clear filters button */}
        {(searchTerm || filterStopWords !== 'all' || filterPOS !== 'all' ||
          filterChapter !== 'all' || filterReviewed !== 'all' || filterDefinition !== 'all') && (
          <button
            onClick={() => setSearchParams({})}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            Clear Filters
          </button>
        )}

        {/* Bulk actions dropdown */}
        <div className="relative" ref={bulkMenuRef}>
          <button
            onClick={() => setShowBulkMenu(!showBulkMenu)}
            disabled={processing}
            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
          >
            Bulk Mark Stop Words
            <ChevronDown size={14} />
          </button>
          {showBulkMenu && (
            <div className="absolute mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              <button
                onClick={() => bulkMarkStopWords(50)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
              >
                Top 50 words
              </button>
              <button
                onClick={() => bulkMarkStopWords(100)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
              >
                Top 100 words
              </button>
              <button
                onClick={() => bulkMarkStopWords(200)}
                className="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50"
              >
                Top 200 words
              </button>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchWords()}
          disabled={processing}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Orphaned Words Link */}
        <Link
          to="/admin/lemmas/orphaned"
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm flex items-center gap-2"
        >
          <AlertTriangle size={14} />
          Orphaned Words
        </Link>

        {/* Create New Lemma */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          New Lemma
        </button>

        {/* Count */}
        <div className="text-sm text-neutral-500">
          {sortedWords.length} words
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">S</kbd> Toggle stop word</span>
      </div>

      {/* Words Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <style>{`
          .admin-table {
            border-collapse: collapse;
            width: 100%;
          }

          .admin-table th {
            text-align: left;
            padding: 12px 16px;
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }

          .admin-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: middle;
          }

          .admin-table tr:last-child td {
            border-bottom: none;
          }
        `}</style>

        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Definition</th>
                <th>POS</th>
                <th className="text-right">Frequency</th>
                <th className="text-center">Stop</th>
                <th className="text-center">Reviewed</th>
                <th className="w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedWords.map((word) => (
                <tr
                  key={word.vocab_id}
                  onClick={() => setSelectedId(word.vocab_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === word.vocab_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="font-medium text-neutral-800">{word.lemma}</td>
                  <td className="text-neutral-600 text-sm">{word.english_definition || '—'}</td>
                  <td className="text-neutral-500 text-sm">{word.part_of_speech || '—'}</td>
                  <td className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      word.word_count > 50 ? 'bg-blue-100 text-blue-700' :
                      word.word_count > 10 ? 'bg-blue-50 text-blue-600' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {word.word_count}×
                    </span>
                  </td>
                  <td className="text-center">
                    {word.is_stop_word ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-200 text-neutral-600">
                        stop
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedWords.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-neutral-500 text-sm">No words match your filters</p>
          </div>
        )}
      </div>

      {/* Create Lemma Modal */}
      <CreateLemmaModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleLemmaCreated}
      />
    </div>
  )
}
