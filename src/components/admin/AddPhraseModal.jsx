/**
 * AddPhraseModal - Add a new phrase occurrence to a sentence
 *
 * Features:
 * - Select word range (start/end positions)
 * - Preview selected phrase text
 * - Link to existing phrase or create new
 * - Search existing phrases
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AddPhraseModal({ isOpen, words, sentenceId, chapterId, onClose, onSuccess }) {
  const [mode, setMode] = useState('existing') // 'existing' or 'new'
  const [startPosition, setStartPosition] = useState('')
  const [endPosition, setEndPosition] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedPhraseId, setSelectedPhraseId] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // New phrase fields
  const [newPhraseText, setNewPhraseText] = useState('')
  const [newDefinition, setNewDefinition] = useState('')
  const [newPhraseType, setNewPhraseType] = useState('compound')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('existing')
      setStartPosition('')
      setEndPosition('')
      setSearchQuery('')
      setSearchResults([])
      setSelectedPhraseId(null)
      setNewPhraseText('')
      setNewDefinition('')
      setNewPhraseType('compound')
    }
  }, [isOpen])

  // Get preview text from selected word range
  const getPreviewText = () => {
    if (!startPosition || !endPosition) return ''
    const start = parseInt(startPosition)
    const end = parseInt(endPosition)
    if (isNaN(start) || isNaN(end) || start > end) return ''

    const selectedWords = words
      .filter(w => w.word_position >= start && w.word_position <= end)
      .sort((a, b) => a.word_position - b.word_position)
      .map(w => w.word_text)
      .join(' ')

    return selectedWords
  }

  // Update new phrase text when word selection changes
  useEffect(() => {
    if (mode === 'new') {
      const preview = getPreviewText()
      if (preview) {
        setNewPhraseText(preview)
      }
    }
  }, [startPosition, endPosition, mode])

  // Debounced search
  const searchPhrases = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('phrases')
        .select('phrase_id, phrase_text, definitions, phrase_type, is_reviewed')
        .ilike('phrase_text', `%${query}%`)
        .order('phrase_text')
        .limit(20)

      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('Error searching phrases:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPhrases(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchPhrases])

  const handleSave = async () => {
    const start = parseInt(startPosition)
    const end = parseInt(endPosition)

    if (isNaN(start) || isNaN(end) || start > end) {
      alert('Please select valid start and end positions')
      return
    }

    setIsSaving(true)

    try {
      if (mode === 'existing') {
        if (!selectedPhraseId) {
          alert('Please select a phrase')
          return
        }

        // Create phrase occurrence
        const { error } = await supabase
          .from('phrase_occurrences')
          .insert({
            phrase_id: selectedPhraseId,
            sentence_id: sentenceId,
            chapter_id: chapterId,
            start_position: start,
            end_position: end
          })

        if (error) throw error

        // Refresh chapter vocabulary stats (non-blocking)
        try {
          await supabase.rpc('refresh_chapter_vocabulary_stats', { p_chapter_id: chapterId })
        } catch (e) {
          console.warn('Could not refresh chapter stats:', e)
        }
      } else {
        // Create new phrase
        if (!newPhraseText.trim()) {
          alert('Please enter phrase text')
          return
        }

        // Get selected words and extract unique lemma IDs
        const selectedWords = words
          .filter(w => w.word_position >= start && w.word_position <= end)
          .sort((a, b) => a.word_position - b.word_position)

        const componentLemmas = [...new Set(
          selectedWords
            .map(w => w.lemmas?.lemma_id || w.lemma_id)
            .filter(Boolean)
        )]

        const { data: newPhrase, error: phraseError } = await supabase
          .from('phrases')
          .insert({
            phrase_text: newPhraseText.trim(),
            definitions: newDefinition.trim() ? [newDefinition.trim()] : [],
            phrase_type: newPhraseType,
            is_reviewed: false,
            component_lemmas: componentLemmas
          })
          .select()
          .single()

        if (phraseError) throw phraseError

        // Create phrase occurrence
        const { error: occError } = await supabase
          .from('phrase_occurrences')
          .insert({
            phrase_id: newPhrase.phrase_id,
            sentence_id: sentenceId,
            chapter_id: chapterId,
            start_position: start,
            end_position: end
          })

        if (occError) throw occError

        // Refresh chapter vocabulary stats (non-blocking)
        try {
          await supabase.rpc('refresh_chapter_vocabulary_stats', { p_chapter_id: chapterId })
        } catch (e) {
          console.warn('Could not refresh chapter stats:', e)
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving phrase:', err)
      alert('Failed to save phrase: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  const previewText = getPreviewText()

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">
            Add Phrase to Sentence
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Position Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Select word positions
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">Start</label>
                <select
                  value={startPosition}
                  onChange={(e) => setStartPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {words.map(w => (
                    <option key={w.word_id} value={w.word_position}>
                      {w.word_position}: {w.word_text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-neutral-500 mb-1">End</label>
                <select
                  value={endPosition}
                  onChange={(e) => setEndPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {words.map(w => (
                    <option key={w.word_id} value={w.word_position}>
                      {w.word_position}: {w.word_text}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {previewText && (
              <div className="mt-2 px-3 py-2 bg-blue-50 rounded-lg">
                <span className="text-xs text-blue-600">Preview: </span>
                <span className="text-sm font-medium text-blue-800">{previewText}</span>
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                  className="text-blue-600"
                />
                <span className="text-sm text-neutral-700">Link to existing phrase</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                  className="text-blue-600"
                />
                <span className="text-sm text-neutral-700">Create new phrase</span>
              </label>
            </div>
          </div>

          {/* Existing Phrase Search */}
          {mode === 'existing' && (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search existing phrases..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {isSearching ? (
                  <div className="text-center py-4 text-neutral-400 text-sm">
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((phrase) => (
                    <button
                      key={phrase.phrase_id}
                      onClick={() => setSelectedPhraseId(phrase.phrase_id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selectedPhraseId === phrase.phrase_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-800 text-sm">
                            {phrase.phrase_text}
                          </span>
                          {phrase.phrase_type && (
                            <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">
                              {phrase.phrase_type}
                            </span>
                          )}
                        </div>
                        {selectedPhraseId === phrase.phrase_id && (
                          <Check size={16} className="text-blue-600" />
                        )}
                      </div>
                      {phrase.definitions && (
                        <p className="text-xs text-neutral-500 mt-1 truncate">
                          {Array.isArray(phrase.definitions)
                            ? phrase.definitions.join(', ')
                            : phrase.definitions}
                        </p>
                      )}
                    </button>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center py-4 text-neutral-400 text-sm">
                    No phrases found
                  </div>
                ) : (
                  <div className="text-center py-4 text-neutral-400 text-sm">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            </div>
          )}

          {/* New Phrase Form */}
          {mode === 'new' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Phrase text
                </label>
                <input
                  type="text"
                  value={newPhraseText}
                  onChange={(e) => setNewPhraseText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phrase text..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Definition
                </label>
                <input
                  type="text"
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter definition..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Type
                </label>
                <select
                  value={newPhraseType}
                  onChange={(e) => setNewPhraseType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="compound">Compound</option>
                  <option value="idiom">Idiom</option>
                  <option value="collocation">Collocation</option>
                  <option value="expression">Expression</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-neutral-50 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !startPosition || !endPosition ||
              (mode === 'existing' && !selectedPhraseId) ||
              (mode === 'new' && !newPhraseText.trim())}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            {isSaving ? 'Adding...' : 'Add Phrase'}
          </button>
        </div>
      </div>
    </div>
  )
}
