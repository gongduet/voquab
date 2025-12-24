/**
 * WordsTable - Displays words in a sentence with lemma information
 *
 * Features:
 * - Table of words with position, text, lemma
 * - Inline editable definitions (supports array of definitions)
 * - Reassign lemma action
 * - Stop word indicator with toggle
 */

import { useState } from 'react'
import { Edit2, Check, X, RefreshCw, Plus } from 'lucide-react'

export default function WordsTable({ words, onEditLemma, onReassignLemma, onToggleStopWord }) {
  const [editingLemmaId, setEditingLemmaId] = useState(null)
  const [editedDefinitions, setEditedDefinitions] = useState([])

  // Parse definitions - handles both array and string formats
  const parseDefinitions = (definitions) => {
    if (!definitions) return []
    if (Array.isArray(definitions)) return definitions
    // If it's a string, try to parse as JSON or treat as single definition
    try {
      const parsed = JSON.parse(definitions)
      return Array.isArray(parsed) ? parsed : [definitions]
    } catch {
      return [definitions]
    }
  }

  // Format definitions for display
  const formatDefinitions = (definitions) => {
    const defs = parseDefinitions(definitions)
    return defs.length > 0 ? defs.join(', ') : null
  }

  const handleStartEdit = (word) => {
    setEditingLemmaId(word.lemmas?.lemma_id)
    setEditedDefinitions(parseDefinitions(word.lemmas?.definitions))
  }

  const handleSave = async (lemmaId) => {
    // Filter out empty definitions and save as array
    const cleanedDefinitions = editedDefinitions.filter(d => d.trim() !== '')
    await onEditLemma(lemmaId, cleanedDefinitions)
    setEditingLemmaId(null)
    setEditedDefinitions([])
  }

  const handleCancel = () => {
    setEditingLemmaId(null)
    setEditedDefinitions([])
  }

  const handleDefinitionChange = (index, value) => {
    setEditedDefinitions(prev => prev.map((d, i) => i === index ? value : d))
  }

  const handleAddDefinition = () => {
    setEditedDefinitions(prev => [...prev, ''])
  }

  const handleRemoveDefinition = (index) => {
    setEditedDefinitions(prev => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e, lemmaId, index) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If it's the last input and not empty, add a new one
      if (index === editedDefinitions.length - 1 && editedDefinitions[index].trim()) {
        handleAddDefinition()
      } else {
        handleSave(lemmaId)
      }
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const getPosLabel = (pos) => {
    const labels = {
      noun: 'N',
      verb: 'V',
      adjective: 'Adj',
      adverb: 'Adv',
      preposition: 'Prep',
      conjunction: 'Conj',
      pronoun: 'Pron',
      determiner: 'Det',
      interjection: 'Int',
      numeral: 'Num'
    }
    return labels[pos] || pos || '—'
  }

  const getGenderLabel = (gender) => {
    if (!gender) return null
    return gender === 'masculine' ? 'm' : gender === 'feminine' ? 'f' : gender
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Words ({words.length})
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="admin-table w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Word
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Lemma
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-16">
                POS
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Definitions
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {words.map((word) => (
              <tr
                key={word.word_id}
                className={`hover:bg-neutral-50 transition-colors ${
                  word.lemmas?.is_stop_word ? 'opacity-50' : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-neutral-400">
                  {word.word_position}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-neutral-800">
                    {word.word_text}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700">
                      {word.lemmas?.lemma_text || '—'}
                    </span>
                    {word.lemmas && onToggleStopWord && (
                      <button
                        type="button"
                        onClick={() => onToggleStopWord(word.lemmas.lemma_id, word.lemmas.is_stop_word)}
                        className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                          word.lemmas.is_stop_word
                            ? 'bg-neutral-200 text-neutral-600 hover:bg-red-100 hover:text-red-700'
                            : 'bg-neutral-100 text-neutral-400 hover:bg-green-100 hover:text-green-700'
                        }`}
                        title={word.lemmas.is_stop_word ? 'Click to unmark as stop word' : 'Click to mark as stop word'}
                      >
                        {word.lemmas.is_stop_word ? 'stop' : 'mark stop'}
                      </button>
                    )}
                    {getGenderLabel(word.lemmas?.gender) && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                        {getGenderLabel(word.lemmas?.gender)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
                    {getPosLabel(word.lemmas?.part_of_speech)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {editingLemmaId === word.lemmas?.lemma_id ? (
                    <div className="space-y-2">
                      {editedDefinitions.map((def, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={def}
                            onChange={(e) => handleDefinitionChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, word.lemmas.lemma_id, index)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Definition ${index + 1}...`}
                            autoFocus={index === 0}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDefinition(index)}
                            className="p-1 rounded text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove definition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddDefinition}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          Add definition
                        </button>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-2 py-1 text-xs rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(word.lemmas.lemma_id)}
                          className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-neutral-600">
                      {formatDefinitions(word.lemmas?.definitions) || (
                        <span className="italic text-neutral-400">No definition</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editingLemmaId !== word.lemmas?.lemma_id && word.lemmas && (
                      <button
                        onClick={() => handleStartEdit(word)}
                        className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="Edit definition"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => onReassignLemma(word)}
                      className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Reassign lemma"
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

      {words.length === 0 && (
        <div className="p-6 text-center text-sm text-neutral-500 italic">
          No words found for this sentence
        </div>
      )}
    </div>
  )
}
