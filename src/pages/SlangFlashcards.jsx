/**
 * SlangFlashcards - Flashcard review for slang terms from a song
 *
 * Features:
 * - Review slang terms from a specific song
 * - Show term, definition, cultural context
 * - Simple flip card interaction
 * - Track progress through deck
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import {
  ArrowLeft,
  Music,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  CheckCircle,
  MapPin,
  MessageCircle
} from 'lucide-react'

export default function SlangFlashcards() {
  const { songId } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [slangTerms, setSlangTerms] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completed, setCompleted] = useState(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch song
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('song_id', songId)
        .single()

      if (songError) throw songError
      setSong(songData)

      // Fetch slang terms for this song
      const { data: slangData, error: slangError } = await supabase
        .from('song_slang')
        .select(`
          slang_id,
          slang_terms (
            slang_id,
            term,
            definition,
            region,
            formality,
            cultural_note,
            example_spanish,
            example_english
          )
        `)
        .eq('song_id', songId)

      if (slangError) throw slangError

      // Extract slang terms
      const terms = slangData
        ?.map(s => s.slang_terms)
        .filter(Boolean) || []

      setSlangTerms(terms)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [songId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleNext = () => {
    if (currentIndex < slangTerms.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsFlipped(false)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setIsFlipped(false)
    }
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleMarkComplete = () => {
    const term = slangTerms[currentIndex]
    setCompleted(prev => {
      const newSet = new Set(prev)
      if (newSet.has(term.slang_id)) {
        newSet.delete(term.slang_id)
      } else {
        newSet.add(term.slang_id)
      }
      return newSet
    })
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setCompleted(new Set())
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          if (isFlipped) {
            handleNext()
          } else {
            handleFlip()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrev()
          break
        case 'Enter':
          e.preventDefault()
          handleFlip()
          break
        case 'c':
          handleMarkComplete()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, currentIndex, slangTerms.length])

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-neutral-400">Loading flashcards...</div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="text-red-600">Error: {error}</div>
          <button
            onClick={() => navigate(`/song/${songId}`)}
            className="mt-4 text-blue-600 hover:underline"
          >
            ← Back to Song
          </button>
        </div>
      </Layout>
    )
  }

  if (slangTerms.length === 0) {
    return (
      <Layout>
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200">
          <Tag size={48} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 mb-4">No slang terms found for this song</p>
          <Link
            to={`/song/${songId}`}
            className="text-purple-600 hover:underline"
          >
            ← Back to Song
          </Link>
        </div>
      </Layout>
    )
  }

  const currentTerm = slangTerms[currentIndex]
  const isComplete = completed.has(currentTerm.slang_id)
  const progress = ((currentIndex + 1) / slangTerms.length) * 100

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/song/${songId}`)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
                <Tag className="text-purple-500" size={24} />
                Slang Flashcards
              </h1>
              {song && (
                <p className="text-sm text-neutral-500">
                  {song.title} - {song.artist}
                </p>
              )}
            </div>
          </div>
          <div className="text-sm text-neutral-500">
            {completed.size} / {slangTerms.length} learned
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-neutral-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-purple-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Flashcard */}
        <div
          onClick={handleFlip}
          className={`relative bg-white border-2 rounded-2xl min-h-[320px] cursor-pointer transition-all duration-300 ${
            isComplete ? 'border-green-300' : 'border-neutral-200'
          } hover:shadow-lg`}
        >
          {/* Card content */}
          <div className="p-8 flex flex-col items-center justify-center min-h-[320px]">
            {!isFlipped ? (
              // Front: Term
              <div className="text-center">
                <div className="text-4xl font-bold text-neutral-900 mb-4">
                  {currentTerm.term}
                </div>
                {currentTerm.region && (
                  <div className="flex items-center justify-center gap-1 text-sm text-neutral-500">
                    <MapPin size={14} />
                    {currentTerm.region}
                  </div>
                )}
                <p className="text-sm text-neutral-400 mt-6">
                  Tap to reveal definition
                </p>
              </div>
            ) : (
              // Back: Definition & Context
              <div className="text-center space-y-4 w-full">
                <div className="text-2xl font-semibold text-purple-600 mb-2">
                  {currentTerm.term}
                </div>
                <div className="text-lg text-neutral-800">
                  {currentTerm.definition}
                </div>
                {currentTerm.formality && (
                  <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                    currentTerm.formality === 'vulgar' ? 'bg-red-100 text-red-700' :
                    currentTerm.formality === 'informal' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {currentTerm.formality}
                  </span>
                )}
                {currentTerm.cultural_note && (
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg text-left">
                    <div className="flex items-center gap-2 text-sm font-medium text-purple-700 mb-2">
                      <MessageCircle size={14} />
                      Cultural Context
                    </div>
                    <p className="text-sm text-neutral-700">
                      {currentTerm.cultural_note}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Complete indicator */}
          {isComplete && (
            <div className="absolute top-4 right-4">
              <CheckCircle className="text-green-500" size={24} />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkComplete}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isComplete
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              <CheckCircle size={16} />
              {isComplete ? 'Learned' : 'Mark Learned'}
            </button>

            <button
              onClick={handleRestart}
              className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
              title="Restart deck"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === slangTerms.length - 1}
            className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Card counter */}
        <div className="text-center text-sm text-neutral-500">
          Card {currentIndex + 1} of {slangTerms.length}
        </div>

        {/* Keyboard hints */}
        <div className="text-center text-xs text-neutral-400 flex justify-center gap-6">
          <span><kbd className="px-1.5 py-0.5 bg-neutral-100 rounded">←/→</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-neutral-100 rounded">Space</kbd> Flip/Next</span>
          <span><kbd className="px-1.5 py-0.5 bg-neutral-100 rounded">C</kbd> Mark learned</span>
        </div>

        {/* Link to study mode */}
        <div className="text-center pt-4 border-t border-neutral-200">
          <Link
            to={`/song/${songId}/study`}
            className="text-purple-600 hover:text-purple-700 text-sm"
          >
            Study lyrics line by line →
          </Link>
        </div>
      </div>
    </Layout>
  )
}
