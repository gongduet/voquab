import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Components
import FlashcardDisplay from '../components/flashcard/FlashcardDisplay'
import DifficultyButtons from '../components/flashcard/DifficultyButtons'
import ChapterCompleteScreen from '../components/flashcard/ChapterCompleteScreen'

// Hooks
import useFlashcardData from '../hooks/flashcard/useFlashcardData'
import useFlashcardSession from '../hooks/flashcard/useFlashcardSession'
import useProgressTracking from '../hooks/flashcard/useProgressTracking'

export default function Flashcards() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Local state
  const [timeGateMessage, setTimeGateMessage] = useState(null)

  // Data fetching
  const {
    cards,
    loading,
    error,
    chapterInfo,
    focusChapter
  } = useFlashcardData(user?.id)

  // Session management
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
  } = useFlashcardSession(cards, 15)

  // Progress tracking
  const { updateProgress } = useProgressTracking(user?.id)

  // Handle difficulty rating
  async function handleDifficulty(difficulty) {
    console.log('🎯 Button clicked:', { difficulty, currentCard: currentCard?.lemma })

    if (!currentCard) {
      console.error('❌ No current card!')
      return
    }

    // Map new button values to existing backend difficulty system
    const backendDifficulty = difficulty === 'again' ? 'dont-know' :
                              difficulty === 'got-it' ? 'easy' :
                              difficulty // 'hard' stays 'hard'

    console.log('📤 Calling updateProgress with:', backendDifficulty)

    // Update progress in database
    const result = await updateProgress(currentCard, backendDifficulty)

    console.log('📥 updateProgress result:', result)

    // Show time gate message if applicable
    if (result?.timeGateMessage) {
      setTimeGateMessage(result.timeGateMessage)
      setTimeout(() => setTimeGateMessage(null), 5000)
    }

    console.log('➡️ Calling handleDifficultySession...')

    // Update local session
    handleDifficultySession(difficulty)

    console.log('✅ handleDifficulty complete')
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <div className="text-xl text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>Loading flashcards...</div>
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
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Cards to Review</h2>
          <p className="text-gray-600 mb-4">
            All your words are up to date! Come back later for more practice.
          </p>
          <button
            onClick={() => navigate('/book')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Return to Book
          </button>
        </div>
      </div>
    )
  }

  // Chapter complete screen
  if (focusChapter && isComplete && cardQueue.length === 0) {
    return <ChapterCompleteScreen focusChapter={focusChapter} chapterInfo={chapterInfo} />
  }

  // Session complete
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="max-w-md p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Session Complete!</h2>
          <p className="text-gray-600 mb-6">
            Great work! You reviewed {totalCards} cards.
          </p>

          {/* Performance summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Again</div>
                <div className="text-xl font-bold" style={{ color: '#6d6875' }}>
                  {sessionRatings['dont-know'] || 0}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Hard</div>
                <div className="text-xl font-bold" style={{ color: '#e5989b' }}>
                  {sessionRatings.hard || 0}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Got It</div>
                <div className="text-xl font-bold" style={{ color: '#ffcdb2' }}>
                  {sessionRatings.easy || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Start New Session
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main flashcard interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with exit button and progress */}
        <div className="mb-6 flex justify-between items-center">
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

        {/* Flashcard Display */}
        <FlashcardDisplay
          card={currentCard}
          isFlipped={isFlipped}
          onCardClick={handleCardClick}
        />

        {/* Difficulty Buttons */}
        <DifficultyButtons
          onDifficulty={handleDifficulty}
          disabled={false}
          timeGateMessage={timeGateMessage}
          showingAnswer={isFlipped}
        />

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
