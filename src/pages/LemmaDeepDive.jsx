/**
 * LemmaDeepDive - Complete lemma breakdown view
 *
 * Features:
 * - Edit lemma text, definitions, POS, gender
 * - Toggle stop word and reviewed status
 * - View all word occurrences grouped by chapter
 * - Reassign words to different lemma
 * - Delete lemma (with safeguards)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  RefreshCw,
  Plus,
  X,
  AlertTriangle
} from 'lucide-react'
import LemmaReassignModal from '../components/admin/LemmaReassignModal'

export default function LemmaDeepDive() {
  const { lemmaId } = useParams()
  const navigate = useNavigate()

  // Lemma data
  const [lemma, setLemma] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editedLemma, setEditedLemma] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Word occurrences
  const [wordOccurrences, setWordOccurrences] = useState([])
  const [expandedChapters, setExpandedChapters] = useState({})

  // Reassign modal
  const [reassignWord, setReassignWord] = useState(null)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteAction, setDeleteAction] = useState('orphan') // 'orphan' or 'reassign'
  const [targetLemma, setTargetLemma] = useState(null)
  const [showReassignAllModal, setShowReassignAllModal] = useState(false)

  // Fetch lemma data
  const fetchLemmaData = useCallback(async () => {
    if (!lemmaId) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch lemma
      const { data: lemmaData, error: lemmaError } = await supabase
        .from('lemmas')
        .select('*')
        .eq('lemma_id', lemmaId)
        .single()

      if (lemmaError) throw lemmaError
      setLemma(lemmaData)
      setEditedLemma(lemmaData)

      // Fetch word occurrences with sentence and chapter info
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select(`
          word_id,
          word_text,
          word_position,
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
        .eq('lemma_id', lemmaId)
        .order('word_text')

      if (wordsError) throw wordsError

      // Group by chapter
      const grouped = {}
      wordsData?.forEach(word => {
        const chapterId = word.sentences?.chapter_id
        if (!chapterId) return

        if (!grouped[chapterId]) {
          grouped[chapterId] = {
            chapter: word.sentences?.chapters,
            words: []
          }
        }
        grouped[chapterId].words.push(word)
      })

      // Sort chapters and words within chapters
      const sortedOccurrences = Object.values(grouped)
        .sort((a, b) => a.chapter.chapter_number - b.chapter.chapter_number)
        .map(group => ({
          ...group,
          words: group.words.sort((a, b) =>
            a.sentences.sentence_order - b.sentences.sentence_order
          )
        }))

      setWordOccurrences(sortedOccurrences)

      // Expand first chapter by default
      if (sortedOccurrences.length > 0) {
        setExpandedChapters({ [sortedOccurrences[0].chapter.chapter_id]: true })
      }

    } catch (err) {
      console.error('Error fetching lemma data:', err)
      setError('Failed to load lemma data')
    } finally {
      setIsLoading(false)
    }
  }, [lemmaId])

  useEffect(() => {
    fetchLemmaData()
  }, [fetchLemmaData])

  // Handlers
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('lemmas')
        .update({
          lemma_text: editedLemma.lemma_text,
          definitions: editedLemma.definitions,
          part_of_speech: editedLemma.part_of_speech,
          gender: editedLemma.gender,
          is_stop_word: editedLemma.is_stop_word
        })
        .eq('lemma_id', lemmaId)

      if (error) throw error

      setLemma(editedLemma)
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving lemma:', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleReviewed = async () => {
    const newValue = !lemma.is_reviewed
    const { error } = await supabase
      .from('lemmas')
      .update({
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('lemma_id', lemmaId)

    if (!error) {
      setLemma(prev => ({ ...prev, is_reviewed: newValue }))
      setEditedLemma(prev => ({ ...prev, is_reviewed: newValue }))
    }
  }

  const handleDelete = async () => {
    const totalWords = wordOccurrences.reduce((sum, ch) => sum + ch.words.length, 0)

    try {
      if (totalWords > 0) {
        if (deleteAction === 'orphan') {
          // Set lemma_id to NULL for all words
          const { error: orphanError } = await supabase
            .from('words')
            .update({ lemma_id: null })
            .eq('lemma_id', lemmaId)

          if (orphanError) throw orphanError
        } else if (deleteAction === 'reassign' && targetLemma) {
          // Reassign all words to target lemma
          const { error: reassignError } = await supabase
            .from('words')
            .update({ lemma_id: targetLemma.lemma_id })
            .eq('lemma_id', lemmaId)

          if (reassignError) throw reassignError
        } else {
          alert('Please select a target lemma for reassignment')
          return
        }
      }

      // Now delete the lemma
      const { error: deleteError } = await supabase
        .from('lemmas')
        .delete()
        .eq('lemma_id', lemmaId)

      if (deleteError) throw deleteError

      navigate('/admin/common-words')
    } catch (err) {
      console.error('Error deleting lemma:', err)
      alert('Failed to delete: ' + err.message)
    }
  }

  const handleReassignWord = async (wordId, newLemmaId) => {
    const { error } = await supabase
      .from('words')
      .update({ lemma_id: newLemmaId })
      .eq('word_id', wordId)

    if (!error) {
      // Remove word from current view
      setWordOccurrences(prev => prev.map(chapter => ({
        ...chapter,
        words: chapter.words.filter(w => w.word_id !== wordId)
      })).filter(chapter => chapter.words.length > 0))
    } else {
      console.error('Error reassigning word:', error)
      alert('Failed to reassign: ' + error.message)
    }

    setReassignWord(null)
  }

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }))
  }

  // Definition helpers
  const getDefinitionsArray = () => {
    if (!editedLemma.definitions) return ['']
    if (Array.isArray(editedLemma.definitions)) return editedLemma.definitions
    return [editedLemma.definitions]
  }

  const handleDefinitionChange = (index, value) => {
    const defs = getDefinitionsArray()
    const newDefs = [...defs]
    newDefs[index] = value
    setEditedLemma(prev => ({ ...prev, definitions: newDefs }))
  }

  const handleAddDefinition = () => {
    const defs = getDefinitionsArray()
    setEditedLemma(prev => ({ ...prev, definitions: [...defs, ''] }))
  }

  const handleRemoveDefinition = (index) => {
    const defs = getDefinitionsArray()
    setEditedLemma(prev => ({
      ...prev,
      definitions: defs.filter((_, i) => i !== index)
    }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading lemma...</div>
      </div>
    )
  }

  // Error state
  if (error || !lemma) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Lemma not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:text-blue-700"
        >
          ← Back to Lemmas
        </button>
      </div>
    )
  }

  const totalOccurrences = wordOccurrences.reduce((sum, ch) => sum + ch.words.length, 0)
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
          Back to Lemmas
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleReviewed}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              lemma.is_reviewed
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {lemma.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
            {lemma.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>
        </div>
      </div>

      {/* Lemma Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">
            Lemma Details
          </h2>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setEditedLemma(lemma)
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
          {/* Lemma Text */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Lemma Text
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedLemma.lemma_text || ''}
                onChange={(e) => setEditedLemma(prev => ({ ...prev, lemma_text: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-xl font-medium text-neutral-900">{lemma.lemma_text}</p>
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
                {lemma.definitions && Array.isArray(lemma.definitions)
                  ? lemma.definitions.join(', ')
                  : lemma.definitions || <span className="italic text-neutral-400">No definition</span>
                }
              </p>
            )}
          </div>

          {/* POS and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
                Part of Speech
              </label>
              {isEditing ? (
                <select
                  value={editedLemma.part_of_speech || ''}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, part_of_speech: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="NOUN">Noun</option>
                  <option value="VERB">Verb</option>
                  <option value="ADJ">Adjective</option>
                  <option value="ADV">Adverb</option>
                  <option value="PRON">Pronoun</option>
                  <option value="DET">Determiner</option>
                  <option value="ADP">Preposition</option>
                  <option value="CONJ">Conjunction</option>
                  <option value="NUM">Numeral</option>
                </select>
              ) : (
                <p className="text-neutral-700">{lemma.part_of_speech || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
                Gender
              </label>
              {isEditing ? (
                <select
                  value={editedLemma.gender || ''}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">N/A</option>
                  <option value="masculine">Masculine</option>
                  <option value="feminine">Feminine</option>
                </select>
              ) : (
                <p className="text-neutral-700">{lemma.gender || '—'}</p>
              )}
            </div>
          </div>

          {/* Stop Word Toggle */}
          <div>
            <label className="block text-xs text-neutral-500 uppercase tracking-wide mb-1">
              Stop Word
            </label>
            {isEditing ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editedLemma.is_stop_word || false}
                  onChange={(e) => setEditedLemma(prev => ({ ...prev, is_stop_word: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-neutral-700">
                  Exclude from learning sessions
                </span>
              </label>
            ) : (
              <p className="text-neutral-700">
                {lemma.is_stop_word ? (
                  <span className="px-2 py-1 bg-neutral-200 text-neutral-600 rounded text-sm">Stop word</span>
                ) : (
                  'Active (included in learning)'
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Word Occurrences */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Word Occurrences ({totalOccurrences} across {wordOccurrences.length} chapters)
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {wordOccurrences.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-sm italic">
              No word occurrences found for this lemma
            </div>
          ) : (
            wordOccurrences.map(({ chapter, words }) => (
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
                    {words.length} occurrence{words.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {/* Words list */}
                {expandedChapters[chapter.chapter_id] && (
                  <div className="border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-neutral-50 text-xs text-neutral-500 uppercase tracking-wide">
                          <th className="px-6 py-2 text-left">Word</th>
                          <th className="px-6 py-2 text-left">Sentence Context</th>
                          <th className="px-6 py-2 text-right w-32">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {words.map((word) => (
                          <tr key={word.word_id} className="hover:bg-neutral-50">
                            <td className="px-6 py-3">
                              <span className="font-medium text-neutral-800">
                                {word.word_text}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <p className="text-sm text-neutral-600 line-clamp-1">
                                {word.sentences?.sentence_text}
                              </p>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => navigate(`/admin/sentences/${word.sentence_id}`)}
                                  className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
                                  title="View sentence"
                                >
                                  <ExternalLink size={14} />
                                </button>
                                <button
                                  onClick={() => setReassignWord(word)}
                                  className="p-1.5 rounded text-neutral-400 hover:text-orange-600 hover:bg-orange-50"
                                  title="Reassign to different lemma"
                                >
                                  <RefreshCw size={14} />
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

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-neutral-800">Delete Lemma?</h3>
            </div>

            <div className="p-6">
              <p className="text-neutral-600 mb-4">
                You are about to delete the lemma "<strong>{lemma.lemma_text}</strong>".
              </p>

              {totalOccurrences > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-amber-800">
                        {totalOccurrences} word{totalOccurrences !== 1 ? 's are' : ' is'} assigned to this lemma
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        Choose how to handle these words:
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteAction"
                        value="orphan"
                        checked={deleteAction === 'orphan'}
                        onChange={(e) => setDeleteAction(e.target.value)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-neutral-700">
                        Make words orphaned (reassign later)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="deleteAction"
                        value="reassign"
                        checked={deleteAction === 'reassign'}
                        onChange={(e) => setDeleteAction(e.target.value)}
                        className="text-blue-600"
                      />
                      <span className="text-sm text-neutral-700">
                        Reassign all words to another lemma
                      </span>
                    </label>

                    {deleteAction === 'reassign' && (
                      <div className="ml-6 mt-2">
                        <button
                          onClick={() => setShowReassignAllModal(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          Select target lemma...
                        </button>
                        {targetLemma && (
                          <span className="ml-2 text-sm text-neutral-600">
                            → {targetLemma.lemma_text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-green-600 mb-4">
                  ✓ No words are assigned to this lemma. Safe to delete.
                </p>
              )}

              <p className="text-sm text-neutral-500">
                This action cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-neutral-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteAction('orphan')
                  setTargetLemma(null)
                }}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteAction === 'reassign' && !targetLemma}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Lemma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign All Modal */}
      {showReassignAllModal && (
        <LemmaReassignModal
          isOpen={true}
          word={{ word_text: `all ${totalOccurrences} words` }}
          currentLemmaId={lemmaId}
          onClose={() => setShowReassignAllModal(false)}
          onConfirm={(newLemmaId, newLemmaData) => {
            setTargetLemma(newLemmaData)
            setShowReassignAllModal(false)
          }}
        />
      )}

      {/* Lemma Reassign Modal (reuse existing) */}
      <LemmaReassignModal
        isOpen={!!reassignWord}
        word={reassignWord}
        onClose={() => setReassignWord(null)}
        onConfirm={(newLemmaId) => handleReassignWord(reassignWord?.word_id, newLemmaId)}
      />
    </div>
  )
}
