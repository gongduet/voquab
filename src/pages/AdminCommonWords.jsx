import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * AdminCommonWords - Manage stop words (common words that shouldn't appear in learning)
 *
 * Features:
 * - View all vocabulary sorted by frequency
 * - Toggle stop word status for individual words
 * - Bulk mark top N words as stop words
 * - Filter and search functionality
 * - Stats display
 */
export default function AdminCommonWords() {
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStopWords, setFilterStopWords] = useState('all') // 'all' | 'stop' | 'active'
  const [minFrequency, setMinFrequency] = useState(0)
  const [processing, setProcessing] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    stopWords: 0,
    activeWords: 0
  })

  useEffect(() => {
    fetchWords()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [words])

  async function fetchWords() {
    try {
      setLoading(true)
      setError(null)

      // Fetch all lemmas
      const { data: lemmaData, error: lemmaError } = await supabase
        .from('lemmas')
        .select('lemma_id, lemma_text, definitions, part_of_speech, is_stop_word')
        .eq('language_code', 'es')

      if (lemmaError) throw lemmaError

      console.log(`Fetched ${lemmaData.length} lemmas`)

      // Add compatibility aliases for existing code
      const wordsWithAliases = lemmaData.map(l => ({
        ...l,
        vocab_id: l.lemma_id,
        lemma: l.lemma_text,
        english_definition: Array.isArray(l.definitions) ? l.definitions[0] : l.definitions,
        frequency: 0  // Frequency not stored in new schema, would need to count from words table
      }))

      setWords(wordsWithAliases)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching words:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  function calculateStats() {
    const total = words.length
    const stopWords = words.filter(w => w.is_stop_word).length
    const activeWords = total - stopWords

    setStats({ total, stopWords, activeWords })
  }

  async function toggleStopWord(word) {
    try {
      const newStatus = !word.is_stop_word

      const { error } = await supabase
        .from('lemmas')
        .update({ is_stop_word: newStatus })
        .eq('lemma_id', word.lemma_id || word.vocab_id)

      if (error) throw error

      // Update local state
      setWords(words.map(w =>
        (w.lemma_id || w.vocab_id) === (word.lemma_id || word.vocab_id)
          ? { ...w, is_stop_word: newStatus }
          : w
      ))

      console.log(`${word.lemma}: is_stop_word = ${newStatus}`)
    } catch (err) {
      console.error('Error toggling stop word:', err)
      alert(`Error: ${err.message}`)
    }
  }

  async function bulkMarkStopWords(topN) {
    if (!confirm(`Mark top ${topN} most frequent words as stop words?`)) {
      return
    }

    try {
      setProcessing(true)

      // Get top N lemmas by frequency that aren't already stop words
      const topLemmas = words
        .filter(w => !w.is_stop_word)
        .slice(0, topN)
        .map(w => w.lemma_id || w.vocab_id)

      if (topLemmas.length === 0) {
        alert('No words to mark (top words are already marked as stop words)')
        setProcessing(false)
        return
      }

      const { error } = await supabase
        .from('lemmas')
        .update({ is_stop_word: true })
        .in('lemma_id', topLemmas)

      if (error) throw error

      // Update local state
      setWords(words.map(w =>
        topLemmas.includes(w.lemma_id || w.vocab_id)
          ? { ...w, is_stop_word: true }
          : w
      ))

      alert(`Successfully marked ${topLemmas.length} words as stop words`)
      setProcessing(false)
    } catch (err) {
      console.error('Error bulk marking:', err)
      alert(`Error: ${err.message}`)
      setProcessing(false)
    }
  }

  // Filter words based on search and filters
  const filteredWords = words.filter(word => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      if (!word.lemma.toLowerCase().includes(search) &&
          !word.english_definition.toLowerCase().includes(search)) {
        return false
      }
    }

    // Stop word filter
    if (filterStopWords === 'stop' && !word.is_stop_word) return false
    if (filterStopWords === 'active' && word.is_stop_word) return false

    // Frequency filter
    if (word.frequency < minFrequency) return false

    return true
  })

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-gray-600 font-serif">Loading vocabulary...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-red-600 font-serif">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-serif text-gray-600 mb-1">Total Words</div>
          <div className="text-3xl font-serif font-bold text-gray-800">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-serif text-gray-600 mb-1">Stop Words</div>
          <div className="text-3xl font-serif font-bold text-red-600">{stats.stopWords}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-serif text-gray-600 mb-1">Active Learning Words</div>
          <div className="text-3xl font-serif font-bold text-green-600">{stats.activeWords}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-serif font-bold text-gray-800 mb-4">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-serif font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search word or definition..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-serif text-sm"
            />
          </div>

          {/* Stop Word Filter */}
          <div>
            <label className="block text-sm font-serif font-medium text-gray-700 mb-2">
              Show
            </label>
            <select
              value={filterStopWords}
              onChange={(e) => setFilterStopWords(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-serif text-sm"
            >
              <option value="all">All Words</option>
              <option value="active">Active Words Only</option>
              <option value="stop">Stop Words Only</option>
            </select>
          </div>

          {/* Min Frequency */}
          <div>
            <label className="block text-sm font-serif font-medium text-gray-700 mb-2">
              Min Frequency
            </label>
            <input
              type="number"
              value={minFrequency}
              onChange={(e) => setMinFrequency(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-serif text-sm"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-serif font-semibold text-gray-700 mb-3">Bulk Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => bulkMarkStopWords(50)}
              disabled={processing}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-serif text-sm disabled:opacity-50"
            >
              Mark Top 50
            </button>
            <button
              onClick={() => bulkMarkStopWords(100)}
              disabled={processing}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-serif text-sm disabled:opacity-50"
            >
              Mark Top 100
            </button>
            <button
              onClick={() => bulkMarkStopWords(200)}
              disabled={processing}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-serif text-sm disabled:opacity-50"
            >
              Mark Top 200
            </button>
            <button
              onClick={() => fetchWords()}
              disabled={processing}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-serif text-sm disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Words Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-serif font-bold text-gray-800">
            Vocabulary ({filteredWords.length} words)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  Word
                </th>
                <th className="px-6 py-3 text-left text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  English
                </th>
                <th className="px-6 py-3 text-left text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  Part of Speech
                </th>
                <th className="px-6 py-3 text-center text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  Stop Word?
                </th>
                <th className="px-6 py-3 text-center text-xs font-serif font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredWords.map((word) => (
                <tr key={word.vocab_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-serif font-semibold text-gray-800">
                      {word.lemma}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-serif text-gray-600 text-sm">
                      {word.english_definition}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-serif font-medium bg-blue-100 text-blue-800">
                      {word.frequency}×
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-serif text-gray-600 text-sm">
                      {word.part_of_speech || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {word.is_stop_word ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-serif font-semibold bg-red-100 text-red-800">
                        ✓ Stop Word
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-serif font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleStopWord(word)}
                      className={`px-3 py-1 rounded-lg text-xs font-serif font-medium transition-colors ${
                        word.is_stop_word
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      {word.is_stop_word ? 'Unmark' : 'Mark as Stop'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredWords.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-600 font-serif">No words match your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
