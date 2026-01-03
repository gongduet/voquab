import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, ExternalLink, CheckCircle, Circle, Plus, AlertTriangle, Copy, BookOpen, Music } from 'lucide-react'
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
  const contentSource = searchParams.get('source') || 'all'
  const filterSong = searchParams.get('song') || 'all'
  const filterStopWords = searchParams.get('stopWords') || 'all'
  const filterPOS = searchParams.get('pos') || 'all'
  const filterChapter = searchParams.get('chapter') || 'all'
  const filterReviewed = searchParams.get('reviewed') || 'all'
  const filterDefinition = searchParams.get('definition') || 'all'
  const sortBy = searchParams.get('sortBy') || 'frequency'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const currentPage = parseInt(searchParams.get('page') || '0', 10)
  const pageSize = 50

  // Helper to update URL params
  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    // Remove default values from URL to keep it clean
    const defaults = {
      search: '',
      source: 'all',
      song: 'all',
      stopWords: 'all',
      pos: 'all',
      chapter: 'all',
      reviewed: 'all',
      definition: 'all',
      sortBy: 'frequency',
      sortOrder: 'desc',
      page: '0'
    }
    if (value === defaults[key] || (key === 'page' && value === 0)) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    // Reset to page 0 when changing filters (except when changing page itself)
    if (key !== 'page') {
      newParams.delete('page')
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(searchTerm)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [songs, setSongs] = useState([])
  const [songLemmaIds, setSongLemmaIds] = useState(null) // null = no filter, array = filter to these IDs
  const [processing, setProcessing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [editingLemmaId, setEditingLemmaId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const bulkMenuRef = useRef(null)

  // Stats (fetched separately since we're paginating)
  const [stats, setStats] = useState({
    total: 0,
    stopWords: 0,
    activeWords: 0
  })

  // Fetch chapters and songs on mount
  useEffect(() => {
    fetchChapters()
    fetchSongs()
    fetchStats()
  }, [])

  // Fetch song lemma IDs when song filter changes
  useEffect(() => {
    async function fetchSongLemmaIds() {
      if (contentSource !== 'songs' || filterSong === 'all') {
        setSongLemmaIds(null)
        return
      }

      try {
        const { data, error } = await supabase
          .from('song_line_words')
          .select('lemma_id')
          .eq('song_id', filterSong)
          .not('lemma_id', 'is', null)

        if (error) throw error

        // Get unique lemma IDs
        const uniqueIds = [...new Set(data.map(d => d.lemma_id))]
        setSongLemmaIds(uniqueIds)
      } catch (err) {
        console.error('Error fetching song lemma IDs:', err)
        setSongLemmaIds([])
      }
    }

    fetchSongLemmaIds()
  }, [contentSource, filterSong])

  // Fetch words when filters/pagination change
  useEffect(() => {
    fetchWords()
  }, [searchTerm, filterStopWords, filterPOS, filterChapter, filterReviewed, filterDefinition, sortBy, sortOrder, currentPage, contentSource, filterSong, songLemmaIds])

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

  async function fetchChapters() {
    const { data } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number, title')
      .order('chapter_number')
    setChapters(data || [])
  }

  async function fetchSongs() {
    const { data } = await supabase
      .from('songs')
      .select('song_id, title, artist')
      .order('title')
    setSongs(data || [])
  }

  async function fetchStats() {
    // Get total counts for stats cards
    const { count: total } = await supabase
      .from('lemmas')
      .select('*', { count: 'exact', head: true })
      .eq('language_code', 'es')

    const { count: stopWords } = await supabase
      .from('lemmas')
      .select('*', { count: 'exact', head: true })
      .eq('language_code', 'es')
      .eq('is_stop_word', true)

    setStats({
      total: total || 0,
      stopWords: stopWords || 0,
      activeWords: (total || 0) - (stopWords || 0)
    })
  }

  async function fetchWords() {
    try {
      setLoading(true)
      setError(null)

      // If filtering by song, wait for songLemmaIds to be populated
      if (contentSource === 'songs' && filterSong !== 'all' && songLemmaIds === null) {
        // Still loading song lemma IDs
        return
      }

      // If filtering by song and no lemmas found, show empty result
      if (contentSource === 'songs' && filterSong !== 'all' && songLemmaIds?.length === 0) {
        setWords([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      // For song filtering, use a direct query approach
      if (contentSource === 'songs' && filterSong !== 'all' && songLemmaIds?.length > 0) {
        let query = supabase
          .from('lemmas')
          .select('*', { count: 'exact' })
          .eq('language_code', 'es')
          .in('lemma_id', songLemmaIds)

        // Apply other filters
        if (searchTerm) {
          query = query.or(`lemma_text.ilike.%${searchTerm}%,definitions.cs.{${searchTerm}}`)
        }
        if (filterStopWords === 'active') {
          query = query.eq('is_stop_word', false)
        } else if (filterStopWords === 'stop') {
          query = query.eq('is_stop_word', true)
        }
        if (filterPOS !== 'all') {
          query = query.eq('part_of_speech', filterPOS)
        }
        if (filterReviewed === 'reviewed') {
          query = query.eq('is_reviewed', true)
        } else if (filterReviewed === 'unreviewed') {
          query = query.eq('is_reviewed', false)
        }
        if (filterDefinition === 'has') {
          query = query.not('definitions', 'is', null)
        } else if (filterDefinition === 'missing') {
          query = query.or('definitions.is.null,definitions.eq.{}')
        }

        // Sorting
        const orderColumn = sortBy === 'alphabetical' ? 'lemma_text' : 'lemma_text' // No frequency available in direct query
        query = query.order(orderColumn, { ascending: sortOrder === 'asc' })

        // Pagination
        const from = currentPage * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)

        const { data, error: queryError, count } = await query

        if (queryError) throw queryError

        const transformedWords = (data || []).map(l => ({
          ...l,
          vocab_id: l.lemma_id,
          lemma: l.lemma_text,
          english_definition: Array.isArray(l.definitions) ? l.definitions.join(', ') : l.definitions,
          word_count: 0 // Not available in this query
        }))

        setWords(transformedWords)
        setTotalCount(count || 0)
        setLoading(false)
        return
      }

      // Default: use RPC for book/chapter filtering
      // Map sortBy to RPC parameter format
      const rpcSortBy = sortBy === 'alphabetical' ? 'alpha' : 'frequency'

      // Only use chapter filter when content source is 'books' or 'all'
      const effectiveChapter = (contentSource === 'books' || contentSource === 'all') && filterChapter !== 'all'
        ? filterChapter
        : null

      const { data, error: rpcError } = await supabase.rpc('search_lemmas', {
        p_search: searchTerm,
        p_pos: filterPOS,
        p_stop_words: filterStopWords,
        p_reviewed: filterReviewed,
        p_definition: filterDefinition,
        p_chapter_id: effectiveChapter,
        p_sort_by: rpcSortBy,
        p_sort_order: sortOrder,
        p_page: currentPage,
        p_page_size: pageSize
      })

      if (rpcError) throw rpcError

      // Transform data for component use
      const transformedWords = (data || []).map(l => ({
        ...l,
        vocab_id: l.lemma_id,
        lemma: l.lemma_text,
        english_definition: Array.isArray(l.definitions) ? l.definitions.join(', ') : l.definitions
      }))

      setWords(transformedWords)
      setTotalCount(data?.[0]?.total_count || 0)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching words:', err)
      setError(err.message)
      setLoading(false)
    }
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

      // Update stats
      setStats(prev => ({
        ...prev,
        stopWords: prev.stopWords + (newStatus ? 1 : -1),
        activeWords: prev.activeWords + (newStatus ? -1 : 1)
      }))
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

  // Strip Spanish articles for dictionary lookup
  function stripArticle(lemma) {
    if (!lemma) return ''
    const articles = ['el ', 'la ', 'los ', 'las ', 'un ', 'una ', 'unos ', 'unas ']
    const lower = lemma.toLowerCase()
    for (const article of articles) {
      if (lower.startsWith(article)) {
        return lemma.slice(article.length)
      }
    }
    return lemma
  }

  const handleCopyLemma = useCallback(async (lemma, e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(lemma)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  const handleOpenCollins = useCallback((lemma, e) => {
    e.stopPropagation()
    const word = stripArticle(lemma)
    window.open(`https://www.collinsdictionary.com/dictionary/spanish-english/${encodeURIComponent(word)}`, '_blank')
  }, [])

  const handleStartEdit = useCallback((word, e) => {
    e.stopPropagation()
    setEditingLemmaId(word.lemma_id || word.vocab_id)
    // Convert definitions array to comma-separated string for editing
    const defs = word.definitions
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
    setEditingLemmaId(null)
    setEditValue('')
  }, [])

  const handleSaveEdit = useCallback(async (lemmaId) => {
    if (isSaving) return

    setIsSaving(true)
    try {
      // Convert comma-separated string back to array
      const definitionsArray = editValue
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)

      const { error } = await supabase
        .from('lemmas')
        .update({ definitions: definitionsArray })
        .eq('lemma_id', lemmaId)

      if (error) throw error

      // Update local state
      setWords(prev => prev.map(w =>
        (w.lemma_id || w.vocab_id) === lemmaId
          ? { ...w, definitions: definitionsArray, english_definition: definitionsArray.join(', ') }
          : w
      ))

      setEditingLemmaId(null)
      setEditValue('')
    } catch (err) {
      console.error('Error saving definition:', err)
      alert(`Error saving: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }, [editValue, isSaving])

  const handleEditKeyDown = useCallback((e, lemmaId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit(lemmaId)
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }, [handleSaveEdit, handleCancelEdit])

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

      // Update stats
      setStats(prev => ({
        ...prev,
        stopWords: prev.stopWords + topLemmas.length,
        activeWords: prev.activeWords - topLemmas.length
      }))

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

  // Keyboard navigation (using server-filtered words directly)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentIndex = words.findIndex(w => w.vocab_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < words.length - 1) {
            setSelectedId(words[currentIndex + 1].vocab_id)
          } else if (currentIndex === -1 && words.length > 0) {
            setSelectedId(words[0].vocab_id)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(words[currentIndex - 1].vocab_id)
          }
          break

        case 's':
        case 'S':
          e.preventDefault()
          if (selectedId) {
            const word = words.find(w => w.vocab_id === selectedId)
            if (word) {
              toggleStopWord(word)
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [words, selectedId, toggleStopWord])

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / pageSize)
  const canGoPrev = currentPage > 0
  const canGoNext = currentPage < totalPages - 1

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
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search words..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Content source filter */}
        <select
          value={contentSource}
          onChange={(e) => {
            // Must update all params in single call to avoid race condition
            const newParams = new URLSearchParams(searchParams)
            const newSource = e.target.value

            // Set or clear source param
            if (newSource === 'all') {
              newParams.delete('source')
            } else {
              newParams.set('source', newSource)
            }

            // Clear chapter filter when not in books mode
            if (newSource !== 'books' && newSource !== 'all') {
              newParams.delete('chapter')
            }

            // Clear song filter when not in songs mode
            if (newSource !== 'songs') {
              newParams.delete('song')
            }

            // Reset to page 0
            newParams.delete('page')

            setSearchParams(newParams, { replace: true })
          }}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Content</option>
          <option value="books">Books</option>
          <option value="songs">Songs</option>
        </select>

        {/* Song filter (shown when content source is 'songs') */}
        {contentSource === 'songs' && (
          <select
            value={filterSong}
            onChange={(e) => updateFilter('song', e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Songs</option>
            {songs.map(song => (
              <option key={song.song_id} value={song.song_id}>
                {song.title} – {song.artist}
              </option>
            ))}
          </select>
        )}

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

        {/* Chapter filter (shown when content source is 'books' or 'all') */}
        {(contentSource === 'books' || contentSource === 'all') && (
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
        )}

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
        {(searchTerm || contentSource !== 'all' || filterSong !== 'all' ||
          filterStopWords !== 'all' || filterPOS !== 'all' ||
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
          {totalCount.toLocaleString()} words
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilter('page', currentPage - 1)}
              disabled={!canGoPrev}
              className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-neutral-600 min-w-[80px] text-center">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => updateFilter('page', currentPage + 1)}
              disabled={!canGoNext}
              className="p-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">S</kbd> Toggle stop word</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Save edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Esc</kbd> Cancel edit</span>
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
              {words.map((word) => (
                <tr
                  key={word.vocab_id}
                  onClick={() => setSelectedId(word.vocab_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === word.vocab_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="font-medium text-neutral-800">{word.lemma}</td>
                  <td className="text-neutral-600 text-sm">
                    {editingLemmaId === (word.lemma_id || word.vocab_id) ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(word.lemma_id || word.vocab_id)}
                        onKeyDown={(e) => handleEditKeyDown(e, word.lemma_id || word.vocab_id)}
                        className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        disabled={isSaving}
                        placeholder="Enter definitions separated by commas"
                      />
                    ) : (
                      <span
                        onClick={(e) => handleStartEdit(word, e)}
                        className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-2 py-1 rounded -mx-2 block"
                        title="Click to edit"
                      >
                        {word.english_definition || <span className="text-neutral-300 italic">Click to add...</span>}
                      </span>
                    )}
                  </td>
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
                      {/* Copy lemma */}
                      <button
                        onClick={(e) => handleCopyLemma(word.lemma, e)}
                        className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Copy lemma"
                      >
                        <Copy size={14} />
                      </button>

                      {/* Collins Dictionary */}
                      <button
                        onClick={(e) => handleOpenCollins(word.lemma, e)}
                        className="p-1.5 rounded text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Open in Collins Dictionary"
                      >
                        <BookOpen size={14} />
                      </button>

                      {/* Stop word toggle */}
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

                      {/* View details */}
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

        {words.length === 0 && !loading && (
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
