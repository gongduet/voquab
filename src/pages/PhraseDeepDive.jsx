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
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700"
        >
          ← Back to Phrases
        </button>
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
            Occurrences ({totalOccurrences} across {occurrences.length} chapter{occurrences.length !== 1 ? 's' : ''})
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
