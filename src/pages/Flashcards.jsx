import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Components
import FlashcardDisplay from '../components/flashcard/FlashcardDisplay'
import DifficultyButtons from '../components/flashcard/DifficultyButtons'
import ChapterCompleteScreen from '../components/flashcard/ChapterCompleteScreen'
import FloatingFeedback from '../components/flashcard/FloatingFeedback'
import SessionSummary from '../components/flashcard/SessionSummary'

// Hooks
import useFlashcardSession from '../hooks/flashcard/useFlashcardSession'
import useProgressTracking from '../hooks/flashcard/useProgressTracking'

// Services
import { buildSession, SessionMode } from '../services/sessionBuilder'

export default function Flashcards() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Get mode and chapter from URL params
  const urlMode = searchParams.get('mode') || SessionMode.REVIEW
  const urlChapter = searchParams.get('chapter') ? parseInt(searchParams.get('chapter')) : null

  // Local state
  const [mode, setMode] = useState(urlMode)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionStats, setSessionStats] = useState(null)
  const [chapterInfo, setChapterInfo] = useState(null)

  // Floating feedback animation state
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 })

  // Track all reviewed cards with their ratings and due dates
  // Key: lemmaId or phraseId, Value: card review data
  const [reviewedCards, setReviewedCards] = useState(new Map())

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
    cardQueue
  } = useFlashcardSession(cards, 20)

  // Progress tracking
  const { updateProgress } = useProgressTracking(user?.id)

  // Load session when mode changes or on mount
  useEffect(() => {
    if (user?.id) {
      loadSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, urlChapter])

  async function loadSession() {
    setReviewedCards(new Map())  // Reset reviewed cards for new session
    setLoading(true)
    setError(null)

    try {
      const options = {
        // sessionSize is now fetched from user_settings in sessionBuilder
        chapterNumber: urlChapter || undefined
      }

      // Determine effective mode
      const effectiveMode = urlChapter ? SessionMode.CHAPTER : mode

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
        setCards(result.cards || [])
        setSessionStats(result.stats)
        setChapterInfo(result.chapterInfo || null)

        if (result.message) {
          console.log('ℹ️ Session message:', result.message)
        }
      }
    } catch (err) {
      console.error('Error loading session:', err)
      setError(err.message)
    } finally {
      setLoading(false)
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

  // Handle difficulty rating
  async function handleDifficulty(difficulty, event) {
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

    console.log('📤 Calling updateProgress with:', fsrsDifficulty)

    // Update progress in database (handles exposure cards differently)
    const result = await updateProgress(currentCard, fsrsDifficulty, currentCard.isExposure)

    console.log('📥 FSRS result:', result)

    // Track all reviewed cards for session summary
    if (result?.success) {
      const cardId = currentCard.phrase_id || currentCard.lemma_id
      const isAgain = difficulty === 'again' || difficulty === 'dont-know'

      setReviewedCards(prev => {
        const updated = new Map(prev)
        const existing = updated.get(cardId)

        updated.set(cardId, {
          lemma: currentCard.lemma,
          cardId: cardId,
          cardType: currentCard.card_type || 'lemma',
          partOfSpeech: currentCard.part_of_speech || null,
          // Sticky flag: once marked "again", stays true even if later got it right
          wasMarkedAgain: existing?.wasMarkedAgain || isAgain,
          // Always update to latest rating
          finalRating: isAgain ? 'again' : difficulty === 'hard' ? 'hard' : 'gotIt',
          dueFormatted: result.dueFormatted || 'Now',
          dueTimestamp: result.dueDate ? new Date(result.dueDate).getTime() : Date.now()
        })

        return updated
      })
    }

    // Show floating feedback animation (replaces old yellow notification)
    if (result?.dueFormatted && !result.isExposure) {
      setFeedbackMessage(`+${result.dueFormatted}`)
      setShowFeedback(true)
      setTimeout(() => setShowFeedback(false), 1500)
    }

    // Update local session
    handleDifficultySession(difficulty)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <div className="text-xl text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
            Loading {mode === SessionMode.LEARN ? 'new words' : 'flashcards'}...
          </div>
        </div>
      </div>
    )
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
            onClick={() => navigate('/')}
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
          again: sessionRatings['dont-know'] || 0,
          hard: sessionRatings['hard'] || 0,
          gotIt: sessionRatings['easy'] || 0
        }}
        reviewedCards={Array.from(reviewedCards.values())}
        dueCount={sessionStats?.dueRemaining || 0}
        newAvailable={sessionStats?.newRemaining || 0}
        onNewSession={() => window.location.reload()}
        onDashboard={() => navigate('/')}
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
              onClick={() => navigate('/')}
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
        <FloatingFeedback message={feedbackMessage} visible={showFeedback} position={feedbackPosition} />

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
