/**
 * FragmentEditor - Inline editor for fragment translations
 *
 * Shows fragment text with editable translation and context note fields.
 * Supports inline editing mode with save/cancel.
 */

import { useState } from 'react'
import { Check, X, Edit2 } from 'lucide-react'

export default function FragmentEditor({
  fragment,
  index,
  onSave,
  disabled = false
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [translation, setTranslation] = useState(fragment.fragment_translation || '')
  const [contextNote, setContextNote] = useState(fragment.context_note || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleEdit = () => {
    setTranslation(fragment.fragment_translation || '')
    setContextNote(fragment.context_note || '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setTranslation(fragment.fragment_translation || '')
    setContextNote(fragment.context_note || '')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(fragment.fragment_id, translation, contextNote)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="text-sm text-gray-400 font-mono w-6 flex-shrink-0">
          {index + 1}.
        </span>

        <div className="flex-1 min-w-0">
          {/* Fragment text (Spanish) */}
          <p className="text-sm font-medium text-gray-800 mb-1">
            "{fragment.fragment_text}"
          </p>

          {isEditing ? (
            /* Editing mode */
            <div className="space-y-2 mt-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Translation</label>
                <input
                  type="text"
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="English translation..."
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Context Note (optional)</label>
                <input
                  type="text"
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Grammar note or context..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                  aria-label="Save"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  aria-label="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* Display mode */
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm text-gray-600 italic">
                  {fragment.fragment_translation || 'No translation'}
                </p>
                {fragment.context_note && (
                  <p className="text-xs text-gray-400 mt-1">
                    Note: {fragment.context_note}
                  </p>
                )}
              </div>
              <button
                onClick={handleEdit}
                disabled={disabled}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                aria-label="Edit fragment"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
