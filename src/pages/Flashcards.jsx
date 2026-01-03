import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Components
import FlashcardDisplay from '../components/flashcard/FlashcardDisplay'
import DifficultyButtons from '../components/flashcard/DifficultyButtons'
import ChapterCompleteScreen from '../components/flashcard/ChapterCompleteScreen'
import FloatingFeedback from '../components/flashcard/FloatingFeedback'
import SessionSummary from '../components/flashcard/SessionSummary'
import LoadingScreen from '../components/flashcard/LoadingScreen'

// Hooks
import useFlashcardSession from '../hooks/flashcard/useFlashcardSession'
import useProgressTracking from '../hooks/flashcard/useProgressTracking'

// Services
import { buildSession, SessionMode, addSentencesToCards, addSentencesToPhraseCards } from '../services/sessionBuilder'

export default function Flashcards() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Get mode, chapter, song, and book from URL params
  const urlMode = searchParams.get('mode') || SessionMode.REVIEW
  const urlChapter = searchParams.get('chapter') ? parseInt(searchParams.get('chapter')) : null
  const urlSongId = searchParams.get('songId') || null
  const urlBookId = searchParams.get('bookId') || searchParams.get('book') || null
  const urlLearnOnly = searchParams.get('learnOnly') === 'true'

  // Helper: Return to correct dashboard based on where user came from
  const getReturnPath = () => {
    if (urlBookId) return `/book/${urlBookId}`
    if (urlSongId) return `/song/${urlSongId}`
    return '/'
  }

  // Local state
  const [mode, setMode] = useState(urlMode)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(null)
  const [error, setError] = useState(null)
  const [sessionStats, setSessionStats] = useState(null)
  const [chapterInfo, setChapterInfo] = useState(null)
  const [songInfo, setSongInfo] = useState(null)

  // Floating feedback animation state
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 })
  const [feedbackColor, setFeedbackColor] = useState('#5aada4')

  // Track all reviewed cards with their ratings and due dates
  // Key: lemmaId or phraseId, Value: card review data
  const [reviewedCards, setReviewedCards] = useState(new Map())

  // Prevent duplicate loadSession calls from StrictMode
  const loadingRef = useRef(false)

  // Session management - pass cards to hook
  const {
    currentCard,
    currentIndex,
    totalCards,
    isFlipped,
    isComplete,
    sessionRatings,
    handleCardClick,
    handleDifficulty: handleDifficultySession,
    cardQueue,
    setCardQueue
  } = useFlashcardSession(cards, 20)

  // Progress tracking
  const { updateProgress } = useProgressTracking(user?.id)

  // Load session when mode changes or on mount
  useEffect(() => {
    if (user?.id) {
      loadSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, urlChapter, urlSongId])

  async function loadSession() {
    if (loadingRef.current) return  // Prevent duplicate calls from StrictMode
    loadingRef.current = true

    setReviewedCards(new Map())  // Reset reviewed cards for new session
    setLoading(true)
    setLoadingProgress(null)
    setError(null)
    setSongInfo(null)

    try {
      const options = {
        // sessionSize is now fetched from user_settings in sessionBuilder
        chapterNumber: urlChapter || undefined,
        songId: urlSongId || undefined,
        learnOnly: urlLearnOnly,
        onProgress: setLoadingProgress,
        skipSentences: true  // Start session immediately, load sentences in background
      }

      // Determine effective mode
      let effectiveMode = mode
      if (urlSongId) {
        effectiveMode = SessionMode.SONG
      } else if (urlChapter) {
        effectiveMode = SessionMode.CHAPTER
      }

      console.log('🎴 Loading session:', { mode: effectiveMode, options })

      const result = await buildSession(user.id, effectiveMode, options)

      console.log('📦 Session result:', {
        cardsCount: result.cards?.length,
        stats: result.stats,
        mode: result.mode
      })

      if (result.error) {
        setError(result.error)
      } else {
        // Set cards immediately (without sentences)
        setCards(result.cards || [])
        setSessionStats(result.stats)
        setChapterInfo(result.chapterInfo || null)
        setSongInfo(result.songInfo || null)

        // Load sentences in background (only for review mode with cards)
        if (effectiveMode === SessionMode.REVIEW && result.cards?.length > 0) {
          loadSentencesInBackground(result.cards)
        }

        if (result.message) {
          console.log('ℹ️ Session message:', result.message)
        }
      }
    } catch (err) {
      console.error('Error loading session:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  // Load sentences in background after session starts
  async function loadSentencesInBackground(initialCards) {
    console.log('🔄 Loading sentences in background...')

    try {
      const lemmaCards = initialCards.filter(c => c.card_type === 'lemma')
      const phraseCards = initialCards.filter(c => c.card_type === 'phrase')

      // Load both in parallel
      const [lemmasWithSentences, phrasesWithSentences] = await Promise.all([
        lemmaCards.length > 0 ? addSentencesToCards(lemmaCards) : [],
        phraseCards.length > 0 ? addSentencesToPhraseCards(phraseCards) : []
      ])

      // Build lookup map for quick updates
      const sentenceMap = new Map()
      for (const card of [...lemmasWithSentences, ...phrasesWithSentences]) {
        const id = card.lemma_id || card.phrase_id
        sentenceMap.set(id, {
          example_sentence: card.example_sentence,
          example_sentence_translation: card.example_sentence_translation,
          word_in_sentence: card.word_in_sentence
        })
      }

      // Update cards state with sentences
      setCards(prevCards => prevCards.map(card => {
        const id = card.lemma_id || card.phrase_id
        const sentenceData = sentenceMap.get(id)
        if (sentenceData) {
          return { ...card, ...sentenceData }
        }
        return card
      }))

      // Also update cardQueue so current session shows sentences
      setCardQueue(prevQueue => prevQueue.map(card => {
        const id = card.lemma_id || card.phrase_id
        const sentenceData = sentenceMap.get(id)
        if (sentenceData) {
          return { ...card, ...sentenceData }
        }
        return card
      }))

      console.log('✅ Sentences loaded for', sentenceMap.size, 'cards')
    } catch (err) {
      console.error('⚠️ Background sentence loading failed:', err)
      // Non-fatal - cards still work without sentences
    }
  }

  // Handle mode change
  function handleModeChange(newMode) {
    setMode(newMode)
    // Clear URL params when changing mode (except chapter focus)
    if (newMode !== SessionMode.CHAPTER) {
      navigate(`/flashcards?mode=${newMode}`, { replace: true })
    }
  }

  // Handle difficulty rating - uses optimistic updates for instant card transitions
  function handleDifficulty(difficulty, event) {
    console.log('🎯 Button clicked:', {
      difficulty,
      lemma: currentCard?.lemma,
      isExposure: currentCard?.isExposure
    })

    // Capture button position for feedback animation
    if (event?.target) {
      const rect = event.target.getBoundingClientRect()
      setFeedbackPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      })
    }

    if (!currentCard) {
      console.error('❌ No current card!')
      return
    }

    // Map button values to FSRS rating names
    const fsrsDifficulty = difficulty === 'again' ? 'again' :
                           difficulty === 'got-it' ? 'got-it' :
                           difficulty // 'hard' stays 'hard'

    // Capture current card reference before advancing (currentCard will change)
    const cardToUpdate = currentCard
    const isAgain = difficulty === 'again' || difficulty === 'dont-know'

    // 1. ADVANCE CARD IMMEDIATELY (optimistic UI)
    handleDifficultySession(difficulty)

    // 2. Fire database update in background (no await)
    console.log('📤 Calling updateProgress with:', fsrsDifficulty)

    updateProgress(cardToUpdate, fsrsDifficulty, cardToUpdate.isExposure)
      .then(result => {
        console.log('📥 FSRS result:', result)

        // Track reviewed card for session summary
        if (result?.success) {
          const cardId = cardToUpdate.slang_id || cardToUpdate.phrase_id || cardToUpdate.lemma_id

          setReviewedCards(prev => {
            const updated = new Map(prev)
            const existing = updated.get(cardId)

            updated.set(cardId, {
              lemma: cardToUpdate.lemma,
              cardId: cardId,
              cardType: cardToUpdate.card_type || 'lemma',
              partOfSpeech: cardToUpdate.part_of_speech || null,
              // Sticky flag: once marked "again", stays true even if later got it right
              wasMarkedAgain: existing?.wasMarkedAgain || isAgain,
              // Always update to latest rating
              finalRating: isAgain ? 'again' : difficulty === 'hard' ? 'hard' : 'gotIt',
              dueFormatted: result.dueFormatted || 'Now',
              dueTimestamp: result.dueDate ? new Date(result.dueDate).getTime() : Date.now()
            })

            return updated
          })

          // Show floating feedback animation (skip for "again" - card requeued immediately)
          if (result?.dueFormatted && !result.isExposure && !isAgain) {
            const feedbackColors = {
              'hard': '#e5989b',
              'got-it': '#5aada4',
              'easy': '#006d77'
            }
            setFeedbackColor(feedbackColors[fsrsDifficulty] || '#5aada4')
            setFeedbackMessage(`+${result.dueFormatted}`)
            setShowFeedback(true)
            setTimeout(() => setShowFeedback(false), 1500)
          }

          // Update requeued card with new FSRS values so second review uses correct state
          if (isAgain) {
            setCardQueue(prevQueue => prevQueue.map(card => {
              const thisCardId = card.slang_id || card.phrase_id || card.lemma_id
              if (thisCardId === cardId) {
                return {
                  ...card,
                  stability: result.newStability,
                  difficulty: result.newDifficulty,
                  due_date: result.dueDate,
                  fsrs_state: result.fsrsStateNumeric,
                  reps: result.reps,
                  lapses: result.lapses,
                  last_reviewed_at: result.lastReviewedAt
                }
              }
              return card
            }))
          }
        }
      })
      .catch(err => {
        console.error('❌ Progress update failed:', err)
        // Card stays due for next session - no user action needed
      })
  }

  // Loading state
  if (loading) {
    return <LoadingScreen mode={mode === SessionMode.LEARN ? 'learn' : 'review'} progress={loadingProgress} />
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
        <div className="max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Flashcards</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(getReturnPath())}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  // No cards available
  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="text-4xl mb-4">
            {mode === SessionMode.LEARN ? '📖' : '🎉'}
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {mode === SessionMode.LEARN ? 'No New Words' : 'No Cards to Review'}
          </h2>
          <p className="text-gray-600 mb-4">
            {mode === SessionMode.LEARN
              ? 'Unlock more chapters by reviewing existing words, or switch to Review mode.'
              : 'All your words are up to date! Come back later for more practice.'}
          </p>

          {/* Mode switcher for empty state */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleModeChange(SessionMode.REVIEW)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                mode === SessionMode.REVIEW
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => handleModeChange(SessionMode.LEARN)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                mode === SessionMode.LEARN
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Learn New
            </button>
          </div>

          <button
            onClick={() => navigate('/book')}
            className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Return to Book
          </button>
        </div>
      </div>
    )
  }

  // Chapter complete screen
  if (urlChapter && isComplete && cardQueue.length === 0) {
    return <ChapterCompleteScreen focusChapter={urlChapter} chapterInfo={chapterInfo} />
  }

  // Session complete - show summary
  if (isComplete) {
    return (
      <SessionSummary
        totalCards={totalCards}
        ratings={{
          again: sessionRatings['again'] || 0,
          hard: sessionRatings['hard'] || 0,
          gotIt: sessionRatings['got-it'] || 0,
          easy: sessionRatings['easy'] || 0
        }}
        reviewedCards={Array.from(reviewedCards.values())}
        dueCount={sessionStats?.dueRemaining || 0}
        newAvailable={sessionStats?.newRemaining || 0}
        onNewSession={() => window.location.reload()}
        onDashboard={() => navigate(getReturnPath())}
      />
    )
  }

  // Main flashcard interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with exit button, mode selector, and progress */}
        <div className="mb-6">
          {/* Top row: Exit and progress */}
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={() => navigate(getReturnPath())}
              className="text-slate-700 hover:text-slate-900 flex items-center gap-2"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span className="text-base font-medium">Exit</span>
            </button>

            <div className="text-lg font-semibold text-right" style={{ fontFamily: 'Inter, sans-serif' }}>
              <span style={{ color: '#b5838d' }}>{currentIndex + 1}</span>
              <span className="text-slate-700">/{totalCards}</span>
              <span className="text-slate-600 ml-1">Cards</span>
            </div>
          </div>

          {/* Mode selector - only show before session starts (not during active session) */}
          {/* Hidden during active session to prevent accidental mode changes */}

          {/* Chapter focus indicator */}
          {urlChapter && chapterInfo && (
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                Chapter {urlChapter}: {chapterInfo.title || 'Focus Mode'}
              </span>
            </div>
          )}

          {/* Song indicator */}
          {urlSongId && songInfo && (
            <div className="text-center">
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                {songInfo.title} - {songInfo.artist}
              </span>
            </div>
          )}
        </div>

        {/* Flashcard Display - badges now inside card component */}
        <FlashcardDisplay
          card={currentCard}
          isFlipped={isFlipped}
          onCardClick={handleCardClick}
        />

        {/* Difficulty Buttons */}
        <DifficultyButtons
          onDifficulty={handleDifficulty}
          disabled={false}
          showingAnswer={isFlipped}
        />

        {/* Floating feedback animation - shows "+5 days" etc */}
        <FloatingFeedback message={feedbackMessage} visible={showFeedback} position={feedbackPosition} color={feedbackColor} />

        {/* Hint text below buttons */}
        {!isFlipped && (
          <p
            className="text-center text-slate-400 text-sm mt-4"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Tap card to reveal translation
          </p>
        )}
      </div>
    </div>
  )
}
