/**
 * SentenceEditModal - Modal for editing sentence and fragment translations
 *
 * Features:
 * - Displays sentence text (read-only)
 * - Editable sentence translation
 * - List of fragments with inline editing
 * - Paragraph start toggle
 * - Save/Cancel buttons
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import FragmentEditor from './FragmentEditor'
import ParagraphToggle from './ParagraphToggle'

export default function SentenceEditModal({
  sentence,
  isOpen,
  onClose,
  onSaveSentence,
  onSaveFragment,
  onToggleParagraph
}) {
  const [translation, setTranslation] = useState('')
  const [isParagraphStart, setIsParagraphStart] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize state when sentence changes
  useEffect(() => {
    if (sentence) {
      setTranslation(sentence.sentence_translation || '')
      setIsParagraphStart(sentence.is_paragraph_start || false)
      setHasChanges(false)
    }
  }, [sentence])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen || !sentence) return null

  const fragments = sentence.sentence_fragments || []

  const handleTranslationChange = (e) => {
    setTranslation(e.target.value)
    setHasChanges(true)
  }

  const handleParagraphToggle = () => {
    setIsParagraphStart(!isParagraphStart)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save sentence translation if changed
      if (translation !== (sentence.sentence_translation || '')) {
        await onSaveSentence(sentence.sentence_id, translation)
      }

      // Save paragraph start if changed
      if (isParagraphStart !== (sentence.is_paragraph_start || false)) {
        await onToggleParagraph(sentence.sentence_id, isParagraphStart)
      }

      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleFragmentSave = async (fragmentId, fragmentTranslation, contextNote) => {
    await onSaveFragment(fragmentId, fragmentTranslation, contextNote)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Edit Sentence #{sentence.sentence_order}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            {/* Spanish text (read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spanish
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800">{sentence.sentence_text}</p>
              </div>
              <p className="text-xs text-gray-400 mt-1">(read-only for now)</p>
            </div>

            {/* Translation (editable) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Translation
              </label>
              <textarea
                value={translation}
                onChange={handleTranslationChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="English translation..."
              />
            </div>

            {/* Divider */}
            <hr className="my-6 border-gray-200" />

            {/* Fragments */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Fragments ({fragments.length})
              </h3>
              {fragments.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {fragments
                    .sort((a, b) => a.fragment_order - b.fragment_order)
                    .map((fragment, index) => (
                      <FragmentEditor
                        key={fragment.fragment_id}
                        fragment={fragment}
                        index={index}
                        onSave={handleFragmentSave}
                      />
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No fragments for this sentence</p>
              )}
            </div>

            {/* Divider */}
            <hr className="my-6 border-gray-200" />

            {/* Options */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Options</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <ParagraphToggle
                  isActive={isParagraphStart}
                  onToggle={handleParagraphToggle}
                />
                <span className="text-sm text-gray-700">Paragraph Start</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
