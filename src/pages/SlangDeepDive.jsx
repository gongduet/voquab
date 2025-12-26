/**
 * SlangDeepDive - Complete slang term detail view
 *
 * Features:
 * - Edit slang metadata (term, definition, region, formality)
 * - View/edit cultural context and examples
 * - Toggle approval status
 * - View linked songs
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  Save,
  MessageCircle,
  Music,
  CheckCircle,
  Circle,
  ExternalLink
} from 'lucide-react'

export default function SlangDeepDive() {
  const { slangId } = useParams()
  const navigate = useNavigate()

  const [slang, setSlang] = useState(null)
  const [linkedSongs, setLinkedSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Editable fields
  const [editedSlang, setEditedSlang] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchSlang = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch slang term
      const { data: slangData, error: slangError } = await supabase
        .from('slang_terms')
        .select('*')
        .eq('slang_id', slangId)
        .single()

      if (slangError) throw slangError
      setSlang(slangData)
      setEditedSlang(slangData)

      // Fetch linked songs
      const { data: songsData, error: songsError } = await supabase
        .from('song_slang')
        .select(`
          song_id,
          first_line_id,
          songs (
            song_id,
            title,
            artist,
            is_published
          )
        `)
        .eq('slang_id', slangId)

      if (songsError) throw songsError
      setLinkedSongs(songsData || [])

    } catch (err) {
      console.error('Error fetching slang:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [slangId])

  useEffect(() => {
    fetchSlang()
  }, [fetchSlang])

  const handleFieldChange = (field, value) => {
    setEditedSlang(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('slang_terms')
        .update({
          term: editedSlang.term,
          definition: editedSlang.definition,
          region: editedSlang.region,
          formality: editedSlang.formality,
          cultural_note: editedSlang.cultural_note,
          examples: editedSlang.examples,
          is_approved: editedSlang.is_approved,
          updated_at: new Date().toISOString()
        })
        .eq('slang_id', slangId)

      if (updateError) throw updateError

      setSlang(editedSlang)
      setHasChanges(false)
    } catch (err) {
      console.error('Error saving slang:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleApproved = async () => {
    const newValue = !editedSlang.is_approved
    handleFieldChange('is_approved', newValue)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading slang term...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-red-600">Error: {error}</div>
        <button
          onClick={() => navigate('/admin/slang')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Slang Terms
        </button>
      </div>
    )
  }

  if (!slang) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-neutral-500">Slang term not found</div>
        <button
          onClick={() => navigate('/admin/slang')}
          className="mt-4 text-blue-600 hover:underline"
        >
          ← Back to Slang Terms
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
            onClick={() => navigate('/admin/slang')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
              <MessageCircle className="text-purple-500" size={24} />
              {editedSlang.term}
            </h1>
            <p className="text-sm text-neutral-500">{editedSlang.definition}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Approved toggle */}
          <button
            onClick={toggleApproved}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              editedSlang.is_approved
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {editedSlang.is_approved ? (
              <CheckCircle size={16} />
            ) : (
              <Circle size={16} />
            )}
            {editedSlang.is_approved ? 'Approved' : 'Pending'}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Region</div>
          <div className="text-lg font-semibold text-neutral-900">
            {editedSlang.region || 'Not specified'}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Formality</div>
          <div className={`text-lg font-semibold capitalize ${
            editedSlang.formality === 'vulgar' ? 'text-red-600' :
            editedSlang.formality === 'informal' ? 'text-yellow-600' :
            editedSlang.formality === 'neutral' ? 'text-green-600' :
            'text-neutral-600'
          }`}>
            {editedSlang.formality || 'Not specified'}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wide mb-1">
            <Music size={14} />
            Linked Songs
          </div>
          <div className="text-2xl font-semibold text-purple-600">
            {linkedSongs.length}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-neutral-900 mb-4">Slang Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Term */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Term
            </label>
            <input
              type="text"
              value={editedSlang.term || ''}
              onChange={(e) => handleFieldChange('term', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Region
            </label>
            <input
              type="text"
              value={editedSlang.region || ''}
              onChange={(e) => handleFieldChange('region', e.target.value)}
              placeholder="e.g., Puerto Rico, Mexico, Spain"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Definition */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Definition
            </label>
            <textarea
              value={editedSlang.definition || ''}
              onChange={(e) => handleFieldChange('definition', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Formality */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Formality
            </label>
            <select
              value={editedSlang.formality || ''}
              onChange={(e) => handleFieldChange('formality', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select formality</option>
              <option value="neutral">Neutral</option>
              <option value="informal">Informal</option>
              <option value="vulgar">Vulgar</option>
            </select>
          </div>

          {/* Cultural Note */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Cultural Note
            </label>
            <textarea
              value={editedSlang.cultural_note || ''}
              onChange={(e) => handleFieldChange('cultural_note', e.target.value)}
              rows={3}
              placeholder="Explain the cultural background and usage context..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Examples */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Examples (JSON array)
            </label>
            <textarea
              value={JSON.stringify(editedSlang.examples || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  handleFieldChange('examples', parsed)
                } catch {
                  // Allow invalid JSON while typing
                }
              }}
              rows={4}
              placeholder='["Example sentence 1", "Example sentence 2"]'
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Linked Songs */}
      {linkedSongs.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-medium text-neutral-900">Appears In Songs</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {linkedSongs.map((link) => (
              <div
                key={link.song_id}
                className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50"
              >
                <div className="flex items-center gap-4">
                  <Music size={20} className="text-purple-500" />
                  <div>
                    <div className="font-medium text-neutral-800">
                      {link.songs?.title}
                    </div>
                    <div className="text-sm text-neutral-500">
                      {link.songs?.artist}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {link.songs?.is_published ? (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-neutral-100 text-neutral-600 rounded">
                      Draft
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/admin/songs/${link.song_id}`)}
                    className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="View song"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
