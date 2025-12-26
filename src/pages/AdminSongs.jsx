/**
 * AdminSongs - Manage songs for lyrics-based learning
 *
 * Features:
 * - View all songs with stats (sections, lines, slang count)
 * - Filter by difficulty, publication status
 * - Toggle published status
 * - Link to Song Deep Dive
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
  Music,
  Plus
} from 'lucide-react'

export default function AdminSongs() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL
  const searchTerm = searchParams.get('search') || ''
  const filterDifficulty = searchParams.get('difficulty') || 'all'
  const filterPublished = searchParams.get('published') || 'all'
  const sortBy = searchParams.get('sortBy') || 'title'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // State
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    unpublished: 0
  })

  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    const defaults = {
      search: '',
      difficulty: 'all',
      published: 'all',
      sortBy: 'title',
      sortOrder: 'asc'
    }
    if (value === defaults[key]) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .order('title')

      if (fetchError) throw fetchError

      setSongs(data || [])
    } catch (err) {
      console.error('Error fetching songs:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  useEffect(() => {
    const total = songs.length
    const published = songs.filter(s => s.is_published).length
    setStats({ total, published, unpublished: total - published })
  }, [songs])

  const togglePublished = useCallback(async (song) => {
    const newValue = !song.is_published
    const { error } = await supabase
      .from('songs')
      .update({ is_published: newValue })
      .eq('song_id', song.song_id)

    if (!error) {
      setSongs(prev => prev.map(s =>
        s.song_id === song.song_id
          ? { ...s, is_published: newValue }
          : s
      ))
    }
  }, [])

  // Filter songs
  const filteredSongs = songs.filter(song => {
    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesTitle = song.title?.toLowerCase().includes(search)
      const matchesArtist = song.artist?.toLowerCase().includes(search)
      if (!matchesTitle && !matchesArtist) return false
    }

    // Difficulty filter
    if (filterDifficulty !== 'all' && song.difficulty !== filterDifficulty) return false

    // Published status
    if (filterPublished === 'published' && !song.is_published) return false
    if (filterPublished === 'unpublished' && song.is_published) return false

    return true
  })

  // Sort songs
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '')
        break
      case 'artist':
        comparison = (a.artist || '').localeCompare(b.artist || '')
        break
      case 'lines':
        comparison = (b.total_lines || 0) - (a.total_lines || 0)
        break
      case 'slang':
        comparison = (b.unique_slang_terms || 0) - (a.unique_slang_terms || 0)
        break
      default:
        comparison = 0
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const currentIndex = sortedSongs.findIndex(s => s.song_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < sortedSongs.length - 1) {
            setSelectedId(sortedSongs[currentIndex + 1].song_id)
          } else if (currentIndex === -1 && sortedSongs.length > 0) {
            setSelectedId(sortedSongs[0].song_id)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(sortedSongs[currentIndex - 1].song_id)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (selectedId) {
            navigate(`/admin/songs/${selectedId}`)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedSongs, selectedId, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading songs...</div>
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
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Songs</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Published</div>
          <div className="text-2xl font-semibold text-green-600">{stats.published}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Draft</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.unpublished}</div>
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
            placeholder="Search songs..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Difficulty filter */}
        <select
          value={filterDifficulty}
          onChange={(e) => updateFilter('difficulty', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Difficulties</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>

        {/* Published filter */}
        <select
          value={filterPublished}
          onChange={(e) => updateFilter('published', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="unpublished">Draft</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="title">Sort by Title</option>
          <option value="artist">Sort by Artist</option>
          <option value="lines">Sort by Lines</option>
          <option value="slang">Sort by Slang Count</option>
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
          onClick={fetchSongs}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Clear filters */}
        {(searchTerm || filterDifficulty !== 'all' || filterPublished !== 'all') && (
          <button
            onClick={() => setSearchParams({})}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Count */}
      <div className="text-sm text-neutral-500">
        {sortedSongs.length} songs
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Open details</span>
      </div>

      {/* Songs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Song
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Artist
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-28">
                  Difficulty
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Sections
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-20">
                  Lines
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-20">
                  Slang
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Published
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSongs.map((song) => (
                <tr
                  key={song.song_id}
                  onClick={() => setSelectedId(song.song_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === song.song_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Music size={16} className="text-purple-500" />
                      <span className="font-medium text-neutral-800">
                        {song.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {song.artist}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      song.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                      song.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                      song.difficulty === 'advanced' ? 'bg-red-100 text-red-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {song.difficulty || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-neutral-600">
                    {song.total_sections || 0}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-neutral-600">
                    {song.total_lines || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      (song.unique_slang_terms || 0) > 20 ? 'bg-purple-100 text-purple-700' :
                      (song.unique_slang_terms || 0) > 0 ? 'bg-purple-50 text-purple-600' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {song.unique_slang_terms || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePublished(song)
                      }}
                      className={`p-1 rounded transition-colors ${
                        song.is_published
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
                      }`}
                    >
                      {song.is_published ? (
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
                        navigate(`/admin/songs/${song.song_id}`)
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="View song details"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedSongs.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Music size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500 text-sm">No songs match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
