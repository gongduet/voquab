/**
 * SentenceDeepDive - Complete sentence breakdown view
 *
 * Features:
 * - Sentence text with editable translation
 * - Fragment list with translations
 * - Words table with lemma info
 * - Phrase occurrences section
 * - Keyboard navigation
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Circle } from 'lucide-react'
import SentenceHeader from '../components/admin/SentenceHeader'
import WordsTable from '../components/admin/WordsTable'
import PhrasesSection from '../components/admin/PhrasesSection'
import FragmentEditor from '../components/admin/FragmentEditor'
import LemmaReassignModal from '../components/admin/LemmaReassignModal'

export default function SentenceDeepDive() {
  const { sentenceId } = useParams()
  const navigate = useNavigate()

  // Data state
  const [sentence, setSentence] = useState(null)
  const [words, setWords] = useState([])
  const [phraseOccurrences, setPhraseOccurrences] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Navigation state
  const [prevSentenceId, setPrevSentenceId] = useState(null)
  const [nextSentenceId, setNextSentenceId] = useState(null)

  // Modal state
  const [reassignWord, setReassignWord] = useState(null)

  // Build URL for back navigation with book/chapter params
  // Defined early so it can be used in useEffects
  const buildBackUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (sentence?.chapters?.book_id) {
      params.set('book', sentence.chapters.book_id)
    }
    if (sentence?.chapter_id) {
      params.set('chapter', sentence.chapter_id)
    }
    const queryString = params.toString()
    return `/admin/sentences${queryString ? `?${queryString}` : ''}`
  }, [sentence])

  // Fetch sentence data
  const fetchSentenceData = useCallback(async () => {
    if (!sentenceId) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch sentence with fragments and chapter info (including book_id for navigation)
      const { data: sentenceData, error: sentenceError } = await supabase
        .from('sentences')
        .select(`
          *,
          sentence_fragments (*),
          chapters (chapter_id, chapter_number, title, book_id)
        `)
        .eq('sentence_id', sentenceId)
        .single()

      if (sentenceError) throw sentenceError
      setSentence(sentenceData)

      // Fetch words with lemmas
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select(`
          *,
          lemmas (lemma_id, lemma_text, definitions, part_of_speech, is_stop_word, gender)
        `)
        .eq('sentence_id', sentenceId)
        .order('word_position')

      if (wordsError) throw wordsError
      setWords(wordsData || [])

      // Fetch phrase occurrences
      const { data: phrasesData, error: phrasesError } = await supabase
        .from('phrase_occurrences')
        .select(`
          *,
          phrases (phrase_id, phrase_text, definitions, phrase_type, is_reviewed)
        `)
        .eq('sentence_id', sentenceId)
        .order('start_position')

      if (phrasesError) throw phrasesError
      setPhraseOccurrences(phrasesData || [])

      // Fetch prev/next sentence IDs for navigation
      if (sentenceData?.chapter_id && sentenceData?.sentence_order) {
        // Previous sentence
        const { data: prevData } = await supabase
          .from('sentences')
          .select('sentence_id')
          .eq('chapter_id', sentenceData.chapter_id)
          .lt('sentence_order', sentenceData.sentence_order)
          .order('sentence_order', { ascending: false })
          .limit(1)
          .single()

        setPrevSentenceId(prevData?.sentence_id || null)

        // Next sentence
        const { data: nextData } = await supabase
          .from('sentences')
          .select('sentence_id')
          .eq('chapter_id', sentenceData.chapter_id)
          .gt('sentence_order', sentenceData.sentence_order)
          .order('sentence_order')
          .limit(1)
          .single()

        setNextSentenceId(nextData?.sentence_id || null)
      }

    } catch (err) {
      console.error('Error fetching sentence data:', err)
      setError('Failed to load sentence data')
    } finally {
      setIsLoading(false)
    }
  }, [sentenceId])

  useEffect(() => {
    fetchSentenceData()
  }, [fetchSentenceData])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (prevSentenceId) {
            navigate(`/admin/sentences/${prevSentenceId}`)
          }
          break
        case 'ArrowRight':
          if (nextSentenceId) {
            navigate(`/admin/sentences/${nextSentenceId}`)
          }
          break
        case 'Escape':
          // Navigate back with book/chapter params preserved
          navigate(buildBackUrl())
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevSentenceId, nextSentenceId, navigate, buildBackUrl])

  // Handlers
  const handleSaveTranslation = useCallback(async (translation) => {
    const { error } = await supabase
      .from('sentences')
      .update({ sentence_translation: translation })
      .eq('sentence_id', sentenceId)

    if (!error) {
      setSentence(prev => ({ ...prev, sentence_translation: translation }))
    } else {
      console.error('Error saving translation:', error)
    }
  }, [sentenceId])

  const handleToggleParagraph = useCallback(async (newValue) => {
    const { error } = await supabase
      .from('sentences')
      .update({ is_paragraph_start: newValue })
      .eq('sentence_id', sentenceId)

    if (!error) {
      setSentence(prev => ({ ...prev, is_paragraph_start: newValue }))
    } else {
      console.error('Error toggling paragraph:', error)
    }
  }, [sentenceId])

  const handleToggleReviewed = useCallback(async () => {
    const newValue = !sentence.is_reviewed
    const { error } = await supabase
      .from('sentences')
      .update({
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('sentence_id', sentenceId)

    if (!error) {
      setSentence(prev => ({ ...prev, is_reviewed: newValue }))
    } else {
      console.error('Error toggling reviewed:', error)
    }
  }, [sentenceId, sentence?.is_reviewed])

  const handleSaveFragment = useCallback(async (fragmentId, translation, contextNote) => {
    const { error } = await supabase
      .from('sentence_fragments')
      .update({
        fragment_translation: translation,
        context_note: contextNote
      })
      .eq('fragment_id', fragmentId)

    if (!error) {
      setSentence(prev => ({
        ...prev,
        sentence_fragments: prev.sentence_fragments?.map(f =>
          f.fragment_id === fragmentId
            ? { ...f, fragment_translation: translation, context_note: contextNote }
            : f
        )
      }))
    } else {
      console.error('Error saving fragment:', error)
    }
  }, [])

  const handleEditLemma = useCallback(async (lemmaId, definitions) => {
    const { error } = await supabase
      .from('lemmas')
      .update({ definitions })
      .eq('lemma_id', lemmaId)

    if (!error) {
      // Update local state
      setWords(prev => prev.map(w =>
        w.lemmas?.lemma_id === lemmaId
          ? { ...w, lemmas: { ...w.lemmas, definitions } }
          : w
      ))
    } else {
      console.error('Error updating lemma:', error)
    }
  }, [])

  const handleReassignLemma = useCallback((word) => {
    setReassignWord(word)
  }, [])

  const handleToggleStopWord = useCallback(async (lemmaId, currentValue) => {
    const newValue = !currentValue
    const { error } = await supabase
      .from('lemmas')
      .update({ is_stop_word: newValue })
      .eq('lemma_id', lemmaId)

    if (!error) {
      // Update local state
      setWords(prev => prev.map(w =>
        w.lemmas?.lemma_id === lemmaId
          ? { ...w, lemmas: { ...w.lemmas, is_stop_word: newValue } }
          : w
      ))
    } else {
      console.error('Error toggling stop word:', error)
    }
  }, [])

  const handleConfirmReassign = useCallback(async (newLemmaId) => {
    if (!reassignWord) return

    console.log('Reassigning word:', reassignWord.word_id, 'to lemma:', newLemmaId)

    const { data, error } = await supabase
      .from('words')
      .update({ lemma_id: newLemmaId })
      .eq('word_id', reassignWord.word_id)
      .select()

    console.log('Reassign result:', { data, error })

    if (!error) {
      // Refetch to get updated lemma data
      await fetchSentenceData()
    } else {
      console.error('Error reassigning lemma:', error)
    }

    setReassignWord(null)
  }, [reassignWord, fetchSentenceData])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading sentence...</div>
      </div>
    )
  }

  // Error state
  if (error || !sentence) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error || 'Sentence not found'}</p>
        <Link
          to="/admin/sentences"
          className="text-blue-600 hover:text-blue-700"
        >
          &larr; Back to Sentences
        </Link>
      </div>
    )
  }

  const fragments = sentence.sentence_fragments || []

  return (
    <div className="space-y-6">
      {/* Back link and navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={buildBackUrl()}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={16} />
          Back to Sentences
        </Link>

        <div className="flex items-center gap-4">
          {/* Reviewed toggle */}
          <button
            onClick={handleToggleReviewed}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              sentence.is_reviewed
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {sentence.is_reviewed ? <CheckCircle size={16} /> : <Circle size={16} />}
            {sentence.is_reviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>

          {/* Sentence navigation */}
          <div className="flex items-center gap-2">
          <button
            onClick={() => prevSentenceId && navigate(`/admin/sentences/${prevSentenceId}`)}
            disabled={!prevSentenceId}
            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous sentence"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-neutral-500">
            Sentence {sentence.sentence_order}
          </span>
          <button
            onClick={() => nextSentenceId && navigate(`/admin/sentences/${nextSentenceId}`)}
            disabled={!nextSentenceId}
            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next sentence"
          >
            <ChevronRight size={18} />
          </button>
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">←/→</kbd> Navigate sentences</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Esc</kbd> Back to list</span>
      </div>

      {/* Sentence Header Section */}
      <SentenceHeader
        sentence={sentence}
        chapterNumber={sentence.chapters?.chapter_number}
        chapterTitle={sentence.chapters?.title}
        onSaveTranslation={handleSaveTranslation}
        onToggleParagraph={handleToggleParagraph}
      />

      {/* Fragments Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Fragments ({fragments.length})
          </h2>
        </div>
        <div className="p-6">
          {fragments.length > 0 ? (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {fragments
                .sort((a, b) => a.fragment_order - b.fragment_order)
                .map((fragment, index) => (
                  <FragmentEditor
                    key={fragment.fragment_id}
                    fragment={fragment}
                    index={index}
                    onSave={handleSaveFragment}
                  />
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No fragments for this sentence</p>
          )}
        </div>
      </div>

      {/* Words Section */}
      <WordsTable
        words={words}
        onEditLemma={handleEditLemma}
        onReassignLemma={handleReassignLemma}
        onToggleStopWord={handleToggleStopWord}
      />

      {/* Phrases Section */}
      <PhrasesSection
        phraseOccurrences={phraseOccurrences}
        words={words}
        sentenceId={sentenceId}
        chapterId={sentence?.chapter_id}
        onUpdate={fetchSentenceData}
      />

      {/* Lemma Reassign Modal */}
      <LemmaReassignModal
        isOpen={!!reassignWord}
        word={reassignWord}
        onClose={() => setReassignWord(null)}
        onConfirm={handleConfirmReassign}
      />
    </div>
  )
}
