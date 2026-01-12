/**
 * SentenceSplitter - Modal for splitting a sentence into multiple sentences
 *
 * Features:
 * - Click between words to insert split markers
 * - Preview of resulting sentences
 * - Paragraph start toggle for each new sentence
 * - Translation input for each new sentence
 * - Executes split operation with loading state
 */

import { useState, useMemo, useCallback } from 'react'
import { X, Scissors, AlertTriangle, Check, Pilcrow } from 'lucide-react'
import { splitSentence } from '../../services/sentenceSplitService'

export default function SentenceSplitter({
  sentence,
  isOpen,
  onClose,
  onSplitComplete
}) {
  // Split points are stored as word indices (after which word to split)
  const [splitPoints, setSplitPoints] = useState([])
  const [translations, setTranslations] = useState({})
  const [paragraphStarts, setParagraphStarts] = useState({})
  const [isSplitting, setIsSplitting] = useState(false)
  const [error, setError] = useState(null)

  // Tokenize sentence into words for display
  const words = useMemo(() => {
    if (!sentence?.sentence_text) return []
    // Split on whitespace but keep track of original spacing
    return sentence.sentence_text.split(/(\s+)/).filter(w => w.trim())
  }, [sentence?.sentence_text])

  // Calculate resulting sentences based on split points
  const resultingSentences = useMemo(() => {
    if (words.length === 0) return []

    const sortedSplits = [...splitPoints].sort((a, b) => a - b)
    const sentences = []
    let startIndex = 0

    for (const splitAfter of sortedSplits) {
      const sentenceWords = words.slice(startIndex, splitAfter + 1)
      sentences.push({
        index: sentences.length,
        text: sentenceWords.join(' '),
        startWordIndex: startIndex,
        endWordIndex: splitAfter
      })
      startIndex = splitAfter + 1
    }

    // Add remaining words as final sentence
    if (startIndex < words.length) {
      sentences.push({
        index: sentences.length,
        text: words.slice(startIndex).join(' '),
        startWordIndex: startIndex,
        endWordIndex: words.length - 1
      })
    }

    return sentences
  }, [words, splitPoints])

  // Toggle split point at a word boundary
  const toggleSplitPoint = useCallback((afterWordIndex) => {
    setSplitPoints(prev => {
      if (prev.includes(afterWordIndex)) {
        return prev.filter(p => p !== afterWordIndex)
      } else {
        return [...prev, afterWordIndex]
      }
    })
  }, [])

  // Update translation for a resulting sentence
  const updateTranslation = useCallback((index, translation) => {
    setTranslations(prev => ({ ...prev, [index]: translation }))
  }, [])

  // Toggle paragraph start for a resulting sentence
  const toggleParagraphStart = useCallback((index) => {
    setParagraphStarts(prev => ({ ...prev, [index]: !prev[index] }))
  }, [])

  // Execute the split
  const handleSplit = async () => {
    if (resultingSentences.length < 2) {
      setError('Please add at least one split point')
      return
    }

    setIsSplitting(true)
    setError(null)

    try {
      const newSentencesData = resultingSentences.map((s, index) => ({
        text: s.text,
        translation: translations[index] || '',
        isParagraphStart: index > 0 ? (paragraphStarts[index] || false) : false
      }))

      const result = await splitSentence(sentence.sentence_id, newSentencesData)

      if (result.success) {
        onSplitComplete?.(result.newSentenceIds)
        onClose()
      } else {
        setError(result.error || 'Split operation failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSplitting(false)
    }
  }

  // Reset state when modal opens
  const handleClose = () => {
    setSplitPoints([])
    setTranslations({})
    setParagraphStarts({})
    setError(null)
    onClose()
  }

  if (!isOpen || !sentence) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                Split Sentence #{sentence.sentence_order}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-amber-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Instructions */}
            <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Click between words to add split points. Each split point creates a new sentence.
              </p>
            </div>

            {/* Interactive sentence display */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Click to Split
              </label>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap items-center gap-y-2">
                  {words.map((word, index) => (
                    <span key={index} className="flex items-center">
                      {/* Word */}
                      <span className="text-gray-800 text-lg">{word}</span>

                      {/* Split point button (after each word except last) */}
                      {index < words.length - 1 && (
                        <button
                          onClick={() => toggleSplitPoint(index)}
                          className={`
                            mx-1 w-6 h-6 flex items-center justify-center rounded-full
                            transition-all duration-200 text-xs font-bold
                            ${splitPoints.includes(index)
                              ? 'bg-amber-500 text-white shadow-md scale-110'
                              : 'bg-gray-200 text-gray-400 hover:bg-amber-200 hover:text-amber-600'
                            }
                          `}
                          title={splitPoints.includes(index) ? 'Remove split' : 'Add split here'}
                        >
                          {splitPoints.includes(index) ? '|' : '+'}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview of resulting sentences */}
            {resultingSentences.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Resulting Sentences ({resultingSentences.length})
                </label>
                <div className="space-y-4">
                  {resultingSentences.map((s, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                    >
                      {/* Sentence header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Sentence {index + 1}
                        </span>
                        {index > 0 && (
                          <button
                            onClick={() => toggleParagraphStart(index)}
                            className={`
                              flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                              transition-colors
                              ${paragraphStarts[index]
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }
                            `}
                          >
                            <Pilcrow size={12} />
                            <span>New Paragraph</span>
                          </button>
                        )}
                      </div>

                      {/* Spanish text */}
                      <p className="text-gray-800 mb-3">{s.text}</p>

                      {/* Translation input */}
                      <input
                        type="text"
                        value={translations[index] || ''}
                        onChange={(e) => updateTranslation(index, e.target.value)}
                        placeholder="English translation (optional, will be generated if empty)"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                   focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning about data loss */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-700">
                    <li>Delete the original sentence and all its fragments</li>
                    <li>Delete any user progress on this sentence</li>
                    <li>Create {resultingSentences.length} new sentences</li>
                    <li>Regenerate words for each new sentence</li>
                    <li>Fragments will need to be generated separately</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              {splitPoints.length === 0
                ? 'No split points added'
                : `${splitPoints.length} split point${splitPoints.length > 1 ? 's' : ''} = ${resultingSentences.length} sentences`
              }
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSplit}
                disabled={isSplitting || splitPoints.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSplitting ? (
                  <>
                    <span className="animate-spin">...</span>
                    <span>Splitting...</span>
                  </>
                ) : (
                  <>
                    <Scissors size={16} />
                    <span>Split Sentence</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
