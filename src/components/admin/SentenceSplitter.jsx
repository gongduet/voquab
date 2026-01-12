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
import { X, Scissors, AlertTriangle, Check, Pilcrow, Copy, CheckCircle, Terminal } from 'lucide-react'
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

  // Success state - shows IDs and CLI command after split
  const [splitResult, setSplitResult] = useState(null)
  const [copiedField, setCopiedField] = useState(null)

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

      const result = await splitSentence(sentence.sentence_id, newSentencesData, sentence.chapter_id)

      if (result.success) {
        // Store result and show success screen
        // Note: onSplitComplete is called when user clicks "Done", not here
        setSplitResult(result)
      } else {
        setError(result.error || 'Split operation failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSplitting(false)
    }
  }

  // Copy text to clipboard
  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get CLI command for fragment generation
  const getCliCommand = () => {
    if (!splitResult?.newSentenceIds) return ''
    return `python scripts/content_pipeline/generate_fragments.py --sentence-ids ${splitResult.newSentenceIds.join(' ')}`
  }

  // Reset state when modal closes
  const handleClose = () => {
    // If split was successful, notify parent before closing
    if (splitResult?.success) {
      onSplitComplete?.(splitResult.newSentenceIds)
    }
    setSplitPoints([])
    setTranslations({})
    setParagraphStarts({})
    setError(null)
    setSplitResult(null)
    setCopiedField(null)
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
            {/* Success screen - shown after split completes */}
            {splitResult ? (
              <div className="space-y-6">
                {/* Success header */}
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800">Split Successful!</h3>
                    <p className="text-sm text-green-700">{splitResult.message}</p>
                    {splitResult.wordsMigrated > 0 && (
                      <p className="text-sm text-green-600 mt-1">
                        {splitResult.wordsMigrated} words migrated (lemma associations preserved)
                      </p>
                    )}
                  </div>
                </div>

                {/* New sentence IDs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Sentence IDs
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 break-all">
                      {splitResult.newSentenceIds?.join(' ')}
                    </code>
                    <button
                      onClick={() => copyToClipboard(splitResult.newSentenceIds?.join(' '), 'ids')}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      title="Copy IDs"
                    >
                      {copiedField === 'ids' ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* CLI command for fragment generation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Terminal size={14} className="inline mr-1" />
                    Generate Fragments (run in terminal)
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 p-3 bg-gray-800 rounded-lg text-sm font-mono text-green-400 break-all">
                      {getCliCommand()}
                    </code>
                    <button
                      onClick={() => copyToClipboard(getCliCommand(), 'cli')}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Copy command"
                    >
                      {copiedField === 'cli' ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-gray-300" />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    This will generate AI-powered sentence fragments for each new sentence.
                  </p>
                </div>

                {/* Next steps */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">Next Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-amber-700">
                        <li>Copy the CLI command above</li>
                        <li>Run it in your terminal to generate fragments</li>
                        <li>Verify the sentences display correctly in the app</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
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

            {/* Info about what will happen */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li><strong>Migrate words</strong> to new sentences (preserves lemma associations!)</li>
                    <li>Create {resultingSentences.length} new sentences with proper ordering</li>
                    <li>Delete fragments (regenerate via CLI after split)</li>
                    <li>Delete user progress on original sentence</li>
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
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            {splitResult ? (
              // Success footer
              <>
                <div className="text-sm text-green-600 font-medium">
                  Split into {splitResult.newSentenceIds?.length} sentences
                </div>
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check size={16} />
                  <span>Done</span>
                </button>
              </>
            ) : (
              // Normal footer
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
