/**
 * SongDeepDive - Complete song detail view
 *
 * Features:
 * - Edit song metadata (title, artist, album, difficulty, dialect, themes)
 * - View sections with line counts
 * - Quick stats overview
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  Save,
  Music,
  ListMusic,
  MessageSquare,
  Tag,
  CheckCircle,
  Circle,
  ExternalLink
} from 'lucide-react'

export default function SongDeepDive() {
  const { songId } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [sections, setSections] = useState([])
  const [slangCount, setSlangCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Editable fields
  const [editedSong, setEditedSong] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchSong = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch song
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('song_id', songId)
        .single()

      if (songError) throw songError
      setSong(songData)
      setEditedSong(songData)

      // Fetch sections with line counts
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('song_sections')
        .select(`
          *,
          song_lines(line_id)
        `)
        .eq('song_id', songId)
        .order('section_order')

      if (sectionsError) throw sectionsError

      const sectionsWithCounts = sectionsData.map(s => ({
        ...s,
        line_count: s.song_lines?.length || 0
      }))
      setSections(sectionsWithCounts)

      // Fetch slang count
      const { count } = await supabase
        .from('song_slang')
        .select('*', { count: 'exact', head: true })
        .eq('song_id', songId)

      setSlangCount(count || 0)

    } catch (err) {
      console.error('Error fetching song:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [songId])

  useEffect(() => {
    fetchSong()
  }, [fetchSong])

  const handleFieldChange = (field, value) => {
    setEditedSong(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleThemesChange = (value) => {
    // Parse comma-separated themes
    const themes = value.split(',').map(t => t.trim()).filter(t => t)
    handleFieldChange('themes', themes)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('songs')
        .update({
          title: editedSong.title,
          artist: editedSong.artist,
          album: editedSong.album,
          release_year: editedSong.release_year,
          difficulty: editedSong.difficulty,
          dialect: editedSong.dialect,
          themes: editedSong.themes,
          is_published: editedSong.is_published,
          updated_at: new Date().toISOString()
        })
        .eq('song_id', songId)

      if (updateError) throw updateError

      setSong(editedSong)
      setHasChanges(false)
    } catch (err) {
      console.error('Error saving song:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async () => {
    const newValue = !editedSong.is_published
    handleFieldChange('is_published', newValue)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading song...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={() => navigate('/admin/songs')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Songs
        </button>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-neutral-500">Song not found</div>
        <button
          onClick={() => navigate('/admin/songs')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Songs
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/songs')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
              <Music className="text-purple-500" size={24} />
              {editedSong.title}
            </h1>
            <p className="text-sm text-neutral-500">{editedSong.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Published toggle */}
          <button
            onClick={togglePublished}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              editedSong.is_published
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {editedSong.is_published ? (
              <CheckCircle size={16} />
            ) : (
              <Circle size={16} />
            )}
            {editedSong.is_published ? 'Published' : 'Draft'}
          </button>

          {/* Save button */}
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide mb-1">
            <ListMusic size={14} />
            Sections
          </div>
          <div className="text-2xl font-semibold text-neutral-900">
            {sections.length}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide mb-1">
            <MessageSquare size={14} />
            Lines
          </div>
          <div className="text-2xl font-semibold text-neutral-900">
            {editedSong.total_lines || sections.reduce((acc, s) => acc + s.line_count, 0)}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide mb-1">
            <Tag size={14} />
            Slang Terms
          </div>
          <div className="text-2xl font-semibold text-purple-600">
            {slangCount}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
            Difficulty
          </div>
          <div className={`text-lg font-semibold capitalize ${
            editedSong.difficulty === 'beginner' ? 'text-green-600' :
            editedSong.difficulty === 'intermediate' ? 'text-yellow-600' :
            editedSong.difficulty === 'advanced' ? 'text-red-600' :
            'text-neutral-600'
          }`}>
            {editedSong.difficulty || 'Not set'}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-neutral-900 mb-4">Song Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editedSong.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Artist */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Artist
            </label>
            <input
              type="text"
              value={editedSong.artist || ''}
              onChange={(e) => handleFieldChange('artist', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Album */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Album
            </label>
            <input
              type="text"
              value={editedSong.album || ''}
              onChange={(e) => handleFieldChange('album', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Release Year */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Release Year
            </label>
            <input
              type="number"
              value={editedSong.release_year || ''}
              onChange={(e) => handleFieldChange('release_year', parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Difficulty
            </label>
            <select
              value={editedSong.difficulty || ''}
              onChange={(e) => handleFieldChange('difficulty', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select difficulty</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Dialect */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Dialect
            </label>
            <input
              type="text"
              value={editedSong.dialect || ''}
              onChange={(e) => handleFieldChange('dialect', e.target.value)}
              placeholder="e.g., Puerto Rican Spanish"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Themes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Themes (comma-separated)
            </label>
            <input
              type="text"
              value={(editedSong.themes || []).join(', ')}
              onChange={(e) => handleThemesChange(e.target.value)}
              placeholder="e.g., nostalgia, memory, home"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {editedSong.themes && editedSong.themes.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {editedSong.themes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-medium text-neutral-900">Sections</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {sections.map((section) => (
            <div
              key={section.section_id}
              className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 flex items-center justify-center bg-neutral-100 rounded-full text-sm font-medium text-neutral-600">
                  {section.section_order}
                </span>
                <div>
                  <div className="font-medium text-neutral-800">
                    {section.section_label || `Section ${section.section_order}`}
                  </div>
                  <div className="text-sm text-neutral-500 flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      section.section_type === 'chorus' ? 'bg-purple-100 text-purple-700' :
                      section.section_type === 'verse' ? 'bg-blue-100 text-blue-700' :
                      section.section_type === 'bridge' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {section.section_type}
                    </span>
                    {section.is_skippable && (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded text-xs">
                        skippable
                      </span>
                    )}
                    {section.repeat_of_section_id && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                        repeat
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-sm text-neutral-500">
                {section.line_count} lines
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/admin/slang')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
        >
          <Tag size={16} />
          Manage Slang Terms
        </button>
      </div>
    </div>
  )
}
