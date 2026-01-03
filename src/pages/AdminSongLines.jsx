/**
 * AdminSongLines - Admin page for managing song lines
 *
 * Features:
 * - Song dropdown filter
 * - Section dropdown filter (within selected song)
 * - Search by Spanish or English text
 * - Review status filter
 * - Table with line details, word counts, slang counts
 * - Inline review toggle
 * - Keyboard navigation
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Search,
  ChevronDown,
  CheckCircle,
  Circle,
  ExternalLink,
  RefreshCw,
  Music
} from 'lucide-react'

export default function AdminSongLines() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL
  const selectedSongId = searchParams.get('song') || null
  const selectedSectionId = searchParams.get('section') || 'all'
  const searchQuery = searchParams.get('search') || ''
  const filterReviewed = searchParams.get('reviewed') || 'all'

  // State
  const [songs, setSongs] = useState([])
  const [sections, setSections] = useState([])
  const [lines, setLines] = useState([])
  const [filteredLines, setFilteredLines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLineId, setSelectedLineId] = useState(null)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // Stats - derived from filteredLines so they update when filters change
  const stats = {
    total: filteredLines.length,
    reviewed: filteredLines.filter(l => l.is_reviewed).length,
    needsReview: filteredLines.filter(l => !l.is_reviewed).length
  }

  // Update URL params
  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    const defaults = {
      song: null,
      section: 'all',
      search: '',
      reviewed: 'all'
    }
    if (value === defaults[key] || value === null) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  // Fetch songs on mount
  useEffect(() => {
    async function fetchSongs() {
      const { data, error } = await supabase
        .from('songs')
        .select('song_id, title, artist')
        .order('title')

      if (!error && data) {
        setSongs(data)
        // Select first song by default if none selected
        if (!selectedSongId && data.length > 0) {
          updateFilter('song', data[0].song_id)
        }
      }
      setIsLoading(false)
    }
    fetchSongs()
  }, [])

  // Fetch sections when song changes
  useEffect(() => {
    if (!selectedSongId) {
      setSections([])
      return
    }

    async function fetchSections() {
      const { data, error } = await supabase
        .from('song_sections')
        .select('section_id, section_label, section_type, section_order')
        .eq('song_id', selectedSongId)
        .order('section_order')

      if (!error && data) {
        setSections(data)
      }
    }
    fetchSections()
  }, [selectedSongId])

  // Fetch lines when song or section changes
  useEffect(() => {
    if (!selectedSongId) {
      setLines([])
      setFilteredLines([])
      return
    }

    async function fetchLines() {
      setIsLoading(true)

      let query = supabase
        .from('song_lines')
        .select(`
          *,
          song_sections!inner (
            section_id,
            section_label,
            section_type,
            section_order,
            song_id
          )
        `)
        .eq('song_sections.song_id', selectedSongId)

      // Filter by section if specified
      if (selectedSectionId !== 'all') {
        query = query.eq('section_id', selectedSectionId)
      }

      query = query.order('line_order')

      const { data, error } = await query

      if (!error && data) {
        // Fetch word counts for these lines
        const lineIds = data.map(l => l.line_id)

        // Get word counts
        const { data: wordCounts } = await supabase
          .from('song_line_words')
          .select('line_id')
          .in('line_id', lineIds)

        // Get slang occurrence counts
        const { data: slangCounts } = await supabase
          .from('song_line_slang_occurrences')
          .select('line_id')
          .in('line_id', lineIds)

        // Count per line
        const wordCountMap = {}
        const slangCountMap = {}

        wordCounts?.forEach(w => {
          wordCountMap[w.line_id] = (wordCountMap[w.line_id] || 0) + 1
        })

        slangCounts?.forEach(s => {
          slangCountMap[s.line_id] = (slangCountMap[s.line_id] || 0) + 1
        })

        // Merge counts into lines
        const linesWithCounts = data.map(line => ({
          ...line,
          word_count: wordCountMap[line.line_id] || 0,
          slang_count: slangCountMap[line.line_id] || 0
        }))

        // Sort by section_order then line_order
        linesWithCounts.sort((a, b) => {
          const sectionDiff = a.song_sections.section_order - b.song_sections.section_order
          if (sectionDiff !== 0) return sectionDiff
          return a.line_order - b.line_order
        })

        setLines(linesWithCounts)
        setFilteredLines(linesWithCounts)
        // Stats are derived from filteredLines automatically
      }
      setIsLoading(false)
    }
    fetchLines()
  }, [selectedSongId, selectedSectionId])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        updateFilter('search', searchInput)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, searchQuery, updateFilter])

  // Sync searchInput when URL changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Filter lines when search query or review filter changes
  useEffect(() => {
    let filtered = lines

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(l =>
        l.line_text?.toLowerCase().includes(query) ||
        l.translation?.toLowerCase().includes(query)
      )
    }

    // Review status filter
    if (filterReviewed === 'reviewed') {
      filtered = filtered.filter(l => l.is_reviewed)
    } else if (filterReviewed === 'unreviewed') {
      filtered = filtered.filter(l => !l.is_reviewed)
    }

    setFilteredLines(filtered)
  }, [searchQuery, filterReviewed, lines])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentIndex = filteredLines.findIndex(l => l.line_id === selectedLineId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < filteredLines.length - 1) {
            setSelectedLineId(filteredLines[currentIndex + 1].line_id)
          } else if (currentIndex === -1 && filteredLines.length > 0) {
            setSelectedLineId(filteredLines[0].line_id)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedLineId(filteredLines[currentIndex - 1].line_id)
          }
          break

        case 'Enter':
          e.preventDefault()
          if (selectedLineId) {
            navigate(`/admin/song-lines/${selectedLineId}`)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredLines, selectedLineId, navigate])

  // Handlers
  const handleSongChange = (songId) => {
    // Must update both params in single call to avoid race condition
    // where second updateFilter overwrites the first with stale searchParams
    const newParams = new URLSearchParams(searchParams)
    newParams.set('song', songId)
    newParams.delete('section') // Reset to 'all' (default)
    setSearchParams(newParams, { replace: true })
    setSelectedLineId(null)
  }

  const handleToggleReviewed = useCallback(async (line) => {
    const newValue = !line.is_reviewed

    // Optimistic update
    setLines(prev => prev.map(l =>
      l.line_id === line.line_id
        ? { ...l, is_reviewed: newValue, reviewed_at: newValue ? new Date().toISOString() : null }
        : l
    ))

    const { error } = await supabase
      .from('song_lines')
      .update({
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('line_id', line.line_id)

    if (error) {
      console.error('Error toggling reviewed:', error)
      // Revert on error
      setLines(prev => prev.map(l =>
        l.line_id === line.line_id
          ? { ...l, is_reviewed: !newValue }
          : l
      ))
    }
  }, [])

  // Truncate text for display
  const truncate = (text, maxLength = 50) => {
    if (!text) return '—'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Get selected song info
  const selectedSong = songs.find(s => s.song_id === selectedSongId)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Lines</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Reviewed</div>
          <div className="text-2xl font-semibold text-green-600">{stats.reviewed}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Needs Review</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.needsReview}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Song dropdown */}
        <div className="relative">
          <select
            value={selectedSongId || ''}
            onChange={(e) => handleSongChange(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[200px]"
          >
            <option value="" disabled>Select a song...</option>
            {songs.map(song => (
              <option key={song.song_id} value={song.song_id}>
                {song.title} – {song.artist}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Section dropdown */}
        <div className="relative">
          <select
            value={selectedSectionId}
            onChange={(e) => updateFilter('section', e.target.value)}
            disabled={!selectedSongId || sections.length === 0}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="all">All Sections</option>
            {sections.map(section => (
              <option key={section.section_id} value={section.section_id}>
                {section.section_label || section.section_type} (#{section.section_order})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search lines..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Review status filter */}
        <select
          value={filterReviewed}
          onChange={(e) => updateFilter('reviewed', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="reviewed">Reviewed</option>
          <option value="unreviewed">Needs Review</option>
        </select>

        {/* Refresh */}
        <button
          onClick={() => {
            // Re-trigger fetch by updating state
            const songId = selectedSongId
            updateFilter('song', null)
            setTimeout(() => updateFilter('song', songId), 0)
          }}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Count */}
      <div className="text-sm text-neutral-500">
        {filteredLines.length} lines
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Open details</span>
      </div>

      {/* No song selected state */}
      {!selectedSongId && songs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Music size={48} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 text-sm">Select a song to view its lines</p>
        </div>
      )}

      {/* Lines Table */}
      {selectedSongId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="admin-table w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-32">
                    Section
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Spanish
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    English
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-20">
                    Words
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-20">
                    Slang
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
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-neutral-400">
                      Loading lines...
                    </td>
                  </tr>
                ) : filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-neutral-400">
                      {lines.length === 0
                        ? 'No lines found for this song'
                        : 'No lines match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line) => (
                    <tr
                      key={line.line_id}
                      onClick={() => setSelectedLineId(line.line_id)}
                      className={`cursor-pointer transition-colors ${
                        selectedLineId === line.line_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                      } ${line.is_skippable ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {line.line_order}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
                          {line.song_sections?.section_label ||
                           `Section ${line.song_sections?.section_order}: ${line.song_sections?.section_type}` || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-800">
                        {truncate(line.line_text, 40)}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600">
                        {truncate(line.translation, 40)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-neutral-600">
                        {line.word_count || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {line.slang_count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {line.slang_count}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleReviewed(line)
                          }}
                          className={`p-1 rounded transition-colors ${
                            line.is_reviewed
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
                          }`}
                        >
                          {line.is_reviewed ? (
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
                            navigate(`/admin/song-lines/${line.line_id}`)
                          }}
                          className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View line details"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
