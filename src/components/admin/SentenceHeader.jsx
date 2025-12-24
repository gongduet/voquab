/**
 * SentenceHeader - Displays sentence text with editable translation
 *
 * Features:
 * - Spanish sentence text (read-only)
 * - Inline editable translation
 * - Paragraph start toggle
 * - Chapter info display
 */

import { useState, useEffect } from 'react'
import { Edit2, Check, X, Pilcrow } from 'lucide-react'

export default function SentenceHeader({
  sentence,
  chapterNumber,
  chapterTitle,
  onSaveTranslation,
  onToggleParagraph
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranslation, setEditedTranslation] = useState('')

  useEffect(() => {
    setEditedTranslation(sentence?.sentence_translation || '')
  }, [sentence?.sentence_translation])

  const handleStartEdit = () => {
    setEditedTranslation(sentence?.sentence_translation || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    await onSaveTranslation(editedTranslation)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedTranslation(sentence?.sentence_translation || '')
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Chapter Info */}
      <div className="px-6 py-3 bg-neutral-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-neutral-500">
          Chapter {chapterNumber}: {chapterTitle}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleParagraph(!sentence?.is_paragraph_start)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
              sentence?.is_paragraph_start
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            }`}
            title={sentence?.is_paragraph_start ? 'Paragraph start' : 'Not a paragraph start'}
          >
            <Pilcrow size={14} />
            {sentence?.is_paragraph_start ? 'Paragraph Start' : 'No Break'}
          </button>
        </div>
      </div>

      {/* Sentence Text */}
      <div className="p-6 space-y-4">
        {/* Spanish Text */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
            Spanish
          </label>
          <p className="text-xl text-neutral-800 leading-relaxed font-serif">
            {sentence?.sentence_text}
          </p>
        </div>

        {/* Translation (Editable) */}
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
            Translation
          </label>
          {isEditing ? (
            <div className="flex items-start gap-2">
              <textarea
                value={editedTranslation}
                onChange={(e) => setEditedTranslation(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleSave}
                  className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                  title="Save (Enter)"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                  title="Cancel (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="group flex items-start gap-2">
              <p className="flex-1 text-lg text-neutral-600 leading-relaxed">
                {sentence?.sentence_translation || (
                  <span className="italic text-neutral-400">No translation</span>
                )}
              </p>
              <button
                onClick={handleStartEdit}
                className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 opacity-0 group-hover:opacity-100 transition-all"
                title="Edit translation"
              >
                <Edit2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
