import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CreatePhraseModal({ isOpen, onClose, onSuccess }) {
  const [phraseText, setPhraseText] = useState('')
  const [definitions, setDefinitions] = useState([''])
  const [phraseType, setPhraseType] = useState('compound')
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

    if (!phraseText.trim()) {
      setError('Phrase text is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const cleanedDefinitions = definitions.filter(d => d.trim() !== '')

      const { data, error: insertError } = await supabase
        .from('phrases')
        .insert({
          phrase_text: phraseText.trim(),
          definitions: cleanedDefinitions.length > 0 ? cleanedDefinitions : [],
          phrase_type: phraseType,
          is_reviewed: false,
          component_lemmas: []
        })
        .select()
        .single()

      if (insertError) throw insertError

      onSuccess(data)
      handleClose()
    } catch (err) {
      console.error('Error creating phrase:', err)
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setPhraseText('')
    setDefinitions([''])
    setPhraseType('compound')
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
          <h2 className="text-lg font-semibold text-neutral-800">Create New Phrase</h2>
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
              Phrase Text *
            </label>
            <input
              type="text"
              value={phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., a menudo"
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

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Type
            </label>
            <select
              value={phraseType}
              onChange={(e) => setPhraseType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="compound">Compound</option>
              <option value="idiom">Idiom</option>
              <option value="collocation">Collocation</option>
              <option value="expression">Expression</option>
            </select>
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
              {isSaving ? 'Creating...' : 'Create Phrase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
