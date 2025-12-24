/**
 * LemmaReassignModal - Search and reassign word to different lemma
 *
 * Features:
 * - Search lemmas by text
 * - Display search results with definitions
 * - Confirm reassignment
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function LemmaReassignModal({ isOpen, word, currentLemmaId, onClose, onConfirm }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedLemmaId, setSelectedLemmaId] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setSelectedLemmaId(null)
    }
  }, [isOpen])

  // Debounced search
  const searchLemmas = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      let queryBuilder = supabase
        .from('lemmas')
        .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word')
        .ilike('lemma_text', `%${query}%`)
        .order('lemma_text')
        .limit(100)

      // Exclude current lemma if provided
      if (currentLemmaId) {
        queryBuilder = queryBuilder.neq('lemma_id', currentLemmaId)
      }

      const { data, error } = await queryBuilder

      if (error) throw error
      setSearchResults(data || [])
    } catch (err) {
      console.error('Error searching lemmas:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [currentLemmaId])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLemmas(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchLemmas])

  const handleConfirm = async () => {
    if (!selectedLemmaId) return

    setIsConfirming(true)
    try {
      const selectedLemmaData = searchResults.find(l => l.lemma_id === selectedLemmaId)
      await onConfirm(selectedLemmaId, selectedLemmaData)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-800">
              Reassign Lemma
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Word: <span className="font-medium text-neutral-700">{word?.word_text}</span>
              {word?.lemmas && (
                <span className="ml-2">
                  (currently: <span className="text-neutral-600">{word.lemmas.lemma_text}</span>)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lemmas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="text-center py-8 text-neutral-400">
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((lemma) => (
                <button
                  key={lemma.lemma_id}
                  onClick={() => setSelectedLemmaId(lemma.lemma_id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedLemmaId === lemma.lemma_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-800">
                        {lemma.lemma_text}
                      </span>
                      {lemma.part_of_speech && (
                        <span className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-500 rounded">
                          {lemma.part_of_speech}
                        </span>
                      )}
                      {lemma.is_stop_word && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-600 rounded">
                          stop
                        </span>
                      )}
                    </div>
                    {selectedLemmaId === lemma.lemma_id && (
                      <Check size={18} className="text-blue-600" />
                    )}
                  </div>
                  {lemma.definitions && (
                    <p className="text-sm text-neutral-500 mt-1 truncate">
                      {lemma.definitions}
                    </p>
                  )}
                </button>
              ))}
              {searchResults.length >= 100 && (
                <div className="text-xs text-neutral-500 text-center py-2 border-t border-gray-100 mt-2">
                  Showing first 100 results. Type more characters to narrow search.
                </div>
              )}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="text-center py-8 text-neutral-400">
              No lemmas found matching "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-400">
              Type at least 2 characters to search
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
            onClick={handleConfirm}
            disabled={!selectedLemmaId || isConfirming}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConfirming ? 'Reassigning...' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  )
}
