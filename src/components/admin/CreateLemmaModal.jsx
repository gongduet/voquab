import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CreateLemmaModal({ isOpen, onClose, onSuccess }) {
  const [lemmaText, setLemmaText] = useState('')
  const [definitions, setDefinitions] = useState([''])
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [gender, setGender] = useState('')
  const [isStopWord, setIsStopWord] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleAddDefinition = () => {
    setDefinitions(prev => [...prev, ''])
  }

  const handleRemoveDefinition = (index) => {
    setDefinitions(prev => prev.filter((_, i) => i !== index))
  }

  const handleDefinitionChange = (index, value) => {
    setDefinitions(prev => prev.map((d, i) => i === index ? value : d))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!lemmaText.trim()) {
      setError('Lemma text is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const cleanedDefinitions = definitions.filter(d => d.trim() !== '')

      const { data, error: insertError } = await supabase
        .from('lemmas')
        .insert({
          lemma_text: lemmaText.trim(),
          definitions: cleanedDefinitions.length > 0 ? cleanedDefinitions : null,
          part_of_speech: partOfSpeech || null,
          gender: gender || null,
          is_stop_word: isStopWord,
          is_reviewed: false,
          language_code: 'es'
        })
        .select()
        .single()

      if (insertError) throw insertError

      onSuccess(data)
      handleClose()
    } catch (err) {
      console.error('Error creating lemma:', err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setLemmaText('')
    setDefinitions([''])
    setPartOfSpeech('')
    setGender('')
    setIsStopWord(false)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-800">Create New Lemma</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Lemma Text *
            </label>
            <input
              type="text"
              value={lemmaText}
              onChange={(e) => setLemmaText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., el libro"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Definitions
            </label>
            <div className="space-y-2">
              {definitions.map((def, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={def}
                    onChange={(e) => handleDefinitionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Definition ${index + 1}`}
                  />
                  {definitions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDefinition(index)}
                      className="p-2 text-neutral-400 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddDefinition}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={14} />
                Add definition
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Part of Speech
              </label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="NOUN">Noun</option>
                <option value="VERB">Verb</option>
                <option value="ADJ">Adjective</option>
                <option value="ADV">Adverb</option>
                <option value="PRON">Pronoun</option>
                <option value="DET">Determiner</option>
                <option value="ADP">Preposition</option>
                <option value="CONJ">Conjunction</option>
                <option value="NUM">Numeral</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">N/A</option>
                <option value="masculine">Masculine</option>
                <option value="feminine">Feminine</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isStopWord"
              checked={isStopWord}
              onChange={(e) => setIsStopWord(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="isStopWord" className="text-sm text-neutral-700">
              Mark as stop word
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Creating...' : 'Create Lemma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
