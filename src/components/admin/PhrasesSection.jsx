/**
 * PhrasesSection - Display and manage phrase occurrences in a sentence
 *
 * Features:
 * - List phrase occurrences with phrase info
 * - Edit phrase definitions
 * - Toggle reviewed status
 * - Delete occurrences
 * - Add new phrase occurrences
 */

import { useState } from 'react'
import { Edit2, Check, X, Trash2, CheckCircle2, Circle, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AddPhraseModal from './AddPhraseModal'

export default function PhrasesSection({ phraseOccurrences, words, sentenceId, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPhraseId, setEditingPhraseId] = useState(null)
  const [editedDefinitions, setEditedDefinitions] = useState('')
  const [isDeleting, setIsDeleting] = useState(null)

  const handleStartEdit = (occurrence) => {
    setEditingPhraseId(occurrence.phrases?.phrase_id)
    setEditedDefinitions(occurrence.phrases?.definitions || '')
  }

  const handleSave = async (phraseId) => {
    const { error } = await supabase
      .from('phrases')
      .update({ definitions: editedDefinitions })
      .eq('phrase_id', phraseId)

    if (!error) {
      setEditingPhraseId(null)
      setEditedDefinitions('')
      onUpdate()
    } else {
      console.error('Error updating phrase:', error)
    }
  }

  const handleCancel = () => {
    setEditingPhraseId(null)
    setEditedDefinitions('')
  }

  const handleToggleReviewed = async (e, occurrence) => {
    e.preventDefault()
    e.stopPropagation()

    const newValue = !occurrence.phrases?.is_reviewed
    const { error } = await supabase
      .from('phrases')
      .update({ is_reviewed: newValue })
      .eq('phrase_id', occurrence.phrases.phrase_id)

    if (!error) {
      onUpdate()
    } else {
      console.error('Error toggling reviewed:', error)
    }
  }

  const handleDelete = async (occurrenceId) => {
    setIsDeleting(occurrenceId)
    const { error } = await supabase
      .from('phrase_occurrences')
      .delete()
      .eq('occurrence_id', occurrenceId)

    if (!error) {
      onUpdate()
    } else {
      console.error('Error deleting occurrence:', error)
    }
    setIsDeleting(null)
  }

  const handleKeyDown = (e, phraseId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave(phraseId)
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const getPhraseTypeLabel = (type) => {
    const labels = {
      idiom: 'Idiom',
      collocation: 'Colloc',
      compound: 'Compound',
      expression: 'Expr'
    }
    return labels[type] || type || '—'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Phrases ({phraseOccurrences.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
        >
          <Plus size={14} />
          Add Phrase
        </button>
      </div>

      {phraseOccurrences.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {phraseOccurrences.map((occurrence) => (
            <div
              key={occurrence.occurrence_id}
              className="px-6 py-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Phrase text and type */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-neutral-800">
                      {occurrence.phrases?.phrase_text}
                    </span>
                    {occurrence.phrases?.phrase_type && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                        {getPhraseTypeLabel(occurrence.phrases.phrase_type)}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">
                      pos {occurrence.start_position}–{occurrence.end_position}
                    </span>
                  </div>

                  {/* Definitions */}
                  {editingPhraseId === occurrence.phrases?.phrase_id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedDefinitions}
                        onChange={(e) => setEditedDefinitions(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, occurrence.phrases.phrase_id)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter definitions..."
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(occurrence.phrases.phrase_id)}
                        className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="p-1 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600">
                      {occurrence.phrases?.definitions || (
                        <span className="italic text-neutral-400">No definition</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* Reviewed toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleReviewed(e, occurrence)}
                    className={`p-1.5 rounded transition-colors ${
                      occurrence.phrases?.is_reviewed
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
                    }`}
                    title={occurrence.phrases?.is_reviewed ? 'Reviewed' : 'Mark as reviewed'}
                  >
                    {occurrence.phrases?.is_reviewed ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </button>

                  {/* Edit */}
                  {editingPhraseId !== occurrence.phrases?.phrase_id && (
                    <button
                      onClick={() => handleStartEdit(occurrence)}
                      className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                      title="Edit definition"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}

                  {/* Delete occurrence */}
                  <button
                    onClick={() => handleDelete(occurrence.occurrence_id)}
                    disabled={isDeleting === occurrence.occurrence_id}
                    className="p-1.5 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Remove occurrence"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-neutral-500 italic">
          No phrases found in this sentence
        </div>
      )}

      {/* Add Phrase Modal */}
      <AddPhraseModal
        isOpen={showAddModal}
        words={words || []}
        sentenceId={sentenceId}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false)
          onUpdate()
        }}
      />
    </div>
  )
}
