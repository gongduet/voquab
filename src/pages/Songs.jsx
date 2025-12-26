/**
 * Songs - User-facing song browser for lyrics-based learning
 *
 * Features:
 * - Browse published songs
 * - Filter by difficulty
 * - Search by title/artist
 * - View song details and start learning
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  Search,
  Music,
  Play,
  BookOpen,
  Tag,
  ChevronRight
} from 'lucide-react'

export default function Songs() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('all')

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .eq('is_published', true)
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

    return true
  })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-neutral-400">Loading songs...</div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-3">
            <Music className="text-purple-500" size={28} />
            Learn with Songs
          </h1>
          <p className="text-neutral-500 mt-1">
            Master Spanish slang and expressions through music
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search songs or artists..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Difficulty filter */}
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        {/* Songs count */}
        <div className="text-sm text-neutral-500">
          {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} available
        </div>

        {/* Song Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSongs.map((song) => (
            <div
              key={song.song_id}
              className="bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Song Header */}
              <div className="p-5 border-b border-neutral-100">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Music className="text-white" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-900 truncate">
                      {song.title}
                    </h3>
                    <p className="text-sm text-neutral-500 truncate">
                      {song.artist}
                    </p>
                  </div>
                </div>
              </div>

              {/* Song Stats */}
              <div className="px-5 py-3 bg-neutral-50 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <BookOpen size={14} />
                  <span>{song.total_lines || 0} lines</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-600">
                  <Tag size={14} />
                  <span>{song.unique_slang_terms || 0} slang</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ml-auto ${
                  song.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                  song.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                  song.difficulty === 'advanced' ? 'bg-red-100 text-red-700' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {song.difficulty || 'N/A'}
                </span>
              </div>

              {/* Actions */}
              <div className="p-4 flex gap-2">
                <Link
                  to={`/songs/${song.song_id}/vocab`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                >
                  <Tag size={16} />
                  Flashcards
                </Link>
                <Link
                  to={`/songs/${song.song_id}/study`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Play size={16} />
                  Study
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredSongs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
            <Music size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500">No songs match your search</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
