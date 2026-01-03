/**
 * LineDeepDive - Complete song line breakdown view
 *
 * Features:
 * - Line text with editable translation
 * - Words table with lemma info
 * - Phrase occurrences section
 * - Slang occurrences section
 * - Keyboard navigation (←/→ for prev/next line)
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  ExternalLink,
  Edit2,
  Check,
  X,
  Music,
  MessageCircle,
  BookOpen
} from 'lucide-react'

export default function LineDeepDive() {
  const { lineId } = useParams()
  const navigate = useNavigate()

  // Data state
  const [line, setLine] = useState(null)
  const [words, setWords] = useState([])
  const [phraseOccurrences, setPhraseOccurrences] = useState([])
  const [slangOccurrences, setSlangOccurrences] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Navigation state
  const [prevLineId, setPrevLineId] = useState(null)
  const [nextLineId, setNextLineId] = useState(null)
  const [linePosition, setLinePosition] = useState({ current: 0, total: 0 })

  // Editing state
  const [editingField, setEditingField] = useState(null) // 'translation', 'grammar_note', 'cultural_note'
  const [editValue, setEditValue] = useState('')

  // Fetch line data
  const fetchLineData = useCallback(async () => {
    if (!lineId) return

    console.log('[LineDeepDive] fetchLineData called with lineId:', lineId)
    setIsLoading(true)
    setError(null)

    try {
      // Fetch line with section and song info
      const { data: lineData, error: lineError } = await supabase
        .from('song_lines')
        .select(`
          *,
          song_sections (
            section_id,
            section_label,
            section_type,
            section_order,
            song_id,
            songs (
              song_id,
              title,
              artist
            )
          )
        `)
        .eq('line_id', lineId)
        .single()

      if (lineError) throw lineError
      setLine(lineData)

      // Fetch words with lemmas (including is_stop_word for display)
      const { data: wordsData, error: wordsError } = await supabase
        .from('song_line_words')
        .select(`
          *,
          lemmas (
            lemma_id,
            lemma_text,
            definitions,
            part_of_speech,
            is_stop_word
          )
        `)
        .eq('line_id', lineId)
        .order('word_position')

      if (wordsError) throw wordsError
      setWords(wordsData || [])

      // Fetch phrase occurrences
      const { data: phrasesData, error: phrasesError } = await supabase
        .from('song_line_phrase_occurrences')
        .select(`
          *,
          phrases (
            phrase_id,
            phrase_text,
            definitions,
            phrase_type
          )
        `)
        .eq('line_id', lineId)
        .order('start_position')

      if (phrasesError) throw phrasesError
      console.log('[LineDeepDive] Phrase data for line', lineId, ':', phrasesData)
      setPhraseOccurrences(phrasesData || [])

      // Fetch slang occurrences
      const { data: slangData, error: slangError } = await supabase
        .from('song_line_slang_occurrences')
        .select(`
          *,
          slang_terms (
            slang_id,
            term,
            definition,
            formality,
            region
          )
        `)
        .eq('line_id', lineId)
        .order('start_position')

      if (slangError) throw slangError
      console.log('[LineDeepDive] Slang data for line', lineId, ':', slangData)
      setSlangOccurrences(slangData || [])

      // Fetch navigation info (prev/next lines in song)
      if (lineData?.song_sections?.song_id) {
        const songId = lineData.song_sections.song_id

        // Get all lines in song for navigation
        const { data: allLines } = await supabase
          .from('song_lines')
          .select(`
            line_id,
            line_order,
            song_sections!inner (
              section_order,
              song_id
            )
          `)
          .eq('song_sections.song_id', songId)
          .order('line_order')

        if (allLines) {
          // Sort by section_order then line_order
          const sortedLines = allLines.sort((a, b) => {
            const sectionDiff = a.song_sections.section_order - b.song_sections.section_order
            if (sectionDiff !== 0) return sectionDiff
            return a.line_order - b.line_order
          })

          const currentIndex = sortedLines.findIndex(l => l.line_id === lineId)
          setLinePosition({ current: currentIndex + 1, total: sortedLines.length })

          if (currentIndex > 0) {
            setPrevLineId(sortedLines[currentIndex - 1].line_id)
          } else {
            setPrevLineId(null)
          }

          if (currentIndex < sortedLines.length - 1) {
            setNextLineId(sortedLines[currentIndex + 1].line_id)
          } else {
            setNextLineId(null)
          }
        }
      }

    } catch (err) {
      console.error('Error fetching line data:', err)
      setError('Failed to load line data')
    } finally {
      setIsLoading(false)
    }
  }, [lineId])

  useEffect(() => {
    fetchLineData()
  }, [fetchLineData])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (prevLineId) {
            navigate(`/admin/song-lines/${prevLineId}`)
          }
          break
        case 'ArrowRight':
          if (nextLineId) {
            navigate(`/admin/song-lines/${nextLineId}`)
          }
          break
        case 'Escape':
          navigate(line?.song_sections?.songs?.song_id
            ? `/admin/song-lines?song=${line.song_sections.songs.song_id}`
            : '/admin/song-lines')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevLineId, nextLineId, navigate, line])

  // Handlers
  const handleToggleReviewed = useCallback(async () => {
    const newValue = !line.is_reviewed
    const { error } = await supabase
      .from('song_lines')
      .update({
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('line_id', lineId)

    if (!error) {
      setLine(prev => ({ ...prev, is_reviewed: newValue }))
    } else {
      console.error('Error toggling reviewed:', error)
    }
  }, [lineId, line?.is_reviewed])

  const handleStartEdit = (field, currentValue) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const handleSaveEdit = async () => {
    if (!editingField) return

    const { error } = await supabase
      .from('song_lines')
      .update({ [editingField]: editValue || null })
      .eq('line_id', lineId)

    if (!error) {
      setLine(prev => ({ ...prev, [editingField]: editValue || null }))
      setEditingField(null)
      setEditValue('')
    } else {
      console.error('Error saving:', error)
    }
  }

  const handleKeyDownEdit = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Get first definition from array or string
  const getFirstDefinition = (definitions) => {
    if (!definitions) return '—'
    if (Array.isArray(definitions)) return definitions[0] || '—'
    if (typeof definitions === 'string') {
      try {
        const parsed = JSON.parse(definitions)
        return Array.isArray(parsed) ? parsed[0] || '—' : definitions
      } catch {
        return definitions
      }
    }
    return '—'
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading line...</div>
      </div>
    )
  }

  // Error state
  if (error || !line) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Line not found'}</p>
        <Link
          to="/admin/song-lines"
          className="text-blue-600 hover:text-blue-700"
        >
          ← Back to Song Lines
        </Link>
      </div>
    )
  }

  const song = line.song_sections?.songs
  const section = line.song_sections

  return (
    <div className="space-y-6">
      {/* Back link and navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`/admin/song-lines?song=${song?.song_id}`}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={16} />
          Back to Song Lines
        </Link>

        <div className="flex items-center gap-4">
          {/* Reviewed toggle */}
          <button
            onClick={handleToggleReviewed}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              line.is_reviewed
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {line.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
            {line.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>

          {/* Line navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevLineId && navigate(`/admin/song-lines/${prevLineId}`)}
              disabled={!prevLineId}
              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous line"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-neutral-500">
              Line {linePosition.current} of {linePosition.total}
            </span>
            <button
              onClick={() => nextLineId && navigate(`/admin/song-lines/${nextLineId}`)}
              disabled={!nextLineId}
              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next line"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">←/→</kbd> Navigate lines</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Esc</kbd> Back to list</span>
      </div>

      {/* Line Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Song context */}
        <div className="px-6 py-3 bg-neutral-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music size={16} className="text-purple-500" />
            <Link
              to={`/admin/songs/${song?.song_id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              {song?.title}
            </Link>
            <span className="text-sm text-neutral-500">—</span>
            <span className="text-sm text-neutral-500">{song?.artist}</span>
          </div>
          <Link
            to={`/admin/songs/${song?.song_id}`}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View Song <ExternalLink size={12} />
          </Link>
        </div>

        {/* Section + Line info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
              {section?.section_label ||
               `Section ${section?.section_order}: ${section?.section_type}` || 'Unknown Section'}
            </span>
            <span className="text-sm text-neutral-500">
              Line {line.line_order}
            </span>
            {line.is_skippable && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                Skippable
              </span>
            )}
          </div>

          {/* Spanish text */}
          <p className="text-xl font-medium text-neutral-900 mb-3">
            {line.line_text}
          </p>

          {/* English translation (editable) */}
          <div className="mb-4">
            <label className="text-xs text-neutral-500 uppercase tracking-wide mb-1 block">
              Translation
            </label>
            {editingField === 'translation' ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDownEdit}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-neutral-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  autoFocus
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => handleStartEdit('translation', line.translation)}
                className="group cursor-pointer flex items-start gap-2"
              >
                <p className="text-neutral-600 flex-1">
                  {line.translation || <span className="text-neutral-400 italic">No translation</span>}
                </p>
                <Edit2 size={14} className="text-neutral-300 group-hover:text-neutral-500 mt-1" />
              </div>
            )}
          </div>

          {/* Grammar note (editable) */}
          <div className="mb-4">
            <label className="text-xs text-neutral-500 uppercase tracking-wide mb-1 block">
              Grammar Note
            </label>
            {editingField === 'grammar_note' ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDownEdit}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-neutral-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  autoFocus
                  placeholder="Add grammar explanation..."
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => handleStartEdit('grammar_note', line.grammar_note)}
                className="group cursor-pointer flex items-start gap-2"
              >
                <p className="text-sm text-neutral-600 flex-1">
                  {line.grammar_note || <span className="text-neutral-400 italic">No grammar note</span>}
                </p>
                <Edit2 size={14} className="text-neutral-300 group-hover:text-neutral-500 mt-0.5" />
              </div>
            )}
          </div>

          {/* Cultural note (editable) */}
          <div>
            <label className="text-xs text-neutral-500 uppercase tracking-wide mb-1 block">
              Cultural Note
            </label>
            {editingField === 'cultural_note' ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDownEdit}
                  className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-neutral-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  autoFocus
                  placeholder="Add cultural context..."
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => handleStartEdit('cultural_note', line.cultural_note)}
                className="group cursor-pointer flex items-start gap-2"
              >
                <p className="text-sm text-neutral-600 flex-1">
                  {line.cultural_note || <span className="text-neutral-400 italic">No cultural note</span>}
                </p>
                <Edit2 size={14} className="text-neutral-300 group-hover:text-neutral-500 mt-0.5" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Words Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Words ({words.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-12">#</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Word</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Lemma</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-20">POS</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Definition</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {words.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400 text-sm">
                    No words tokenized for this line
                  </td>
                </tr>
              ) : (
                words.map((word) => {
                  // Stop word = has lemma with is_stop_word=true OR has no lemma (function word)
                  const isStopWord = word.lemmas?.is_stop_word || !word.lemmas
                  return (
                    <tr
                      key={word.word_id}
                      className={`hover:bg-gray-50 ${isStopWord ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2 text-sm text-neutral-500">{word.word_position}</td>
                      <td className="px-4 py-2">
                        <span className={`font-medium ${isStopWord ? 'text-neutral-400' : 'text-neutral-800'}`}>
                          {word.word_text}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {word.lemmas ? (
                            <Link
                              to={`/admin/lemmas/${word.lemmas.lemma_id}`}
                              className={`hover:underline ${isStopWord ? 'text-neutral-400 hover:text-neutral-500' : 'text-blue-600 hover:text-blue-700'}`}
                            >
                              {word.lemmas.lemma_text}
                            </Link>
                          ) : (
                            <span className="text-neutral-400 italic">no lemma</span>
                          )}
                          {isStopWord && (
                            <span className="px-1.5 py-0.5 text-xs bg-neutral-200 text-neutral-500 rounded">
                              stop
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600 rounded">
                          {word.grammatical_info?.pos || word.lemmas?.part_of_speech || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-neutral-600">
                        {isStopWord ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          getFirstDefinition(word.lemmas?.definitions)
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {word.lemmas && !isStopWord && (
                          <Link
                            to={`/admin/lemmas/${word.lemmas.lemma_id}`}
                            className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex"
                            title="View lemma details"
                          >
                            <ExternalLink size={14} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phrases Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <BookOpen size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Phrases ({phraseOccurrences.length})
          </h2>
        </div>
        <div className="p-6">
          {phraseOccurrences.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">No phrases detected in this line</p>
          ) : (
            <div className="space-y-3">
              {phraseOccurrences.map((occ) => (
                <div
                  key={occ.occurrence_id}
                  className="flex items-start justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-neutral-800">
                        {occ.phrases?.phrase_text}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {occ.phrases?.phrase_type || 'phrase'}
                      </span>
                      <span className="text-xs text-neutral-400">
                        words {occ.start_position}–{occ.end_position}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">
                      {getFirstDefinition(occ.phrases?.definitions)}
                    </p>
                  </div>
                  <Link
                    to={`/admin/phrases/${occ.phrases?.phrase_id}`}
                    className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="View phrase details"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slang Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <MessageCircle size={16} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Slang ({slangOccurrences.length})
          </h2>
        </div>
        <div className="p-6">
          {slangOccurrences.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">No slang detected in this line</p>
          ) : (
            <div className="space-y-3">
              {slangOccurrences.map((occ) => (
                <div
                  key={occ.occurrence_id}
                  className="flex items-start justify-between p-3 bg-neutral-50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-neutral-800">
                        {occ.slang_terms?.term}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        occ.slang_terms?.formality === 'vulgar' ? 'bg-red-100 text-red-700' :
                        occ.slang_terms?.formality === 'informal' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {occ.slang_terms?.formality || 'informal'}
                      </span>
                      {occ.slang_terms?.region && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          {occ.slang_terms.region}
                        </span>
                      )}
                      <span className="text-xs text-neutral-400">
                        words {occ.start_position}–{occ.end_position}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">
                      {occ.slang_terms?.definition || '—'}
                    </p>
                  </div>
                  <Link
                    to={`/admin/slang/${occ.slang_terms?.slang_id}`}
                    className="p-1.5 rounded text-neutral-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    title="View slang details"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
