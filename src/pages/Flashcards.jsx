import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Components
import FlashcardDisplay from '../components/flashcard/FlashcardDisplay'
import DifficultyButtons from '../components/flashcard/DifficultyButtons'
import SessionStats from '../components/flashcard/SessionStats'
import WordStatusCard from '../components/flashcard/WordStatusCard'
import ChapterCompleteScreen from '../components/flashcard/ChapterCompleteScreen'

// Hooks
import useFlashcardData from '../hooks/flashcard/useFlashcardData'
import useFlashcardSession from '../hooks/flashcard/useFlashcardSession'
import useProgressTracking from '../hooks/flashcard/useProgressTracking'

export default function Flashcards() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Local state
  const [showDetailedReview, setShowDetailedReview] = useState(false)
  const [timeGateMessage, setTimeGateMessage] = useState(null)

  // Data fetching
  const {
    cards,
    loading,
    error,
    chapterInfo,
    focusChapter,
    refetch
  } = useFlashcardData(user?.id)

  // Session management
  const {
    currentCard,
    currentIndex,
    totalCards,
    isFlipped,
    isComplete,
    sessionRatings,
    sessionStartTime,
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

    console.log('📤 Calling updateProgress...')

    // Update progress in database
    const result = await updateProgress(currentCard, difficulty)

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

  // Helper functions (kept from original)
  function formatGrammaticalContext(formMetadata) {
    if (!formMetadata || Object.keys(formMetadata).length === 0) {
      return ''
    }

    const parts = []

    // Tense
    if (formMetadata.Tense) {
      const tenseMap = {
        'Pres': 'Present',
        'Past': 'Past',
        'Fut': 'Future',
        'Imp': 'Imperfect',
        'Cond': 'Conditional'
      }
      parts.push(tenseMap[formMetadata.Tense] || formMetadata.Tense)
    }

    // Person
    if (formMetadata.Person) {
      const personMap = {
        '1': 'yo (I)',
        '2': 'tú (you)',
        '3': 'él/ella (he/she)'
      }
      parts.push(personMap[formMetadata.Person] || formMetadata.Person)
    }

    // Number
    if (formMetadata.Number) {
      const numberMap = {
        'Sing': 'Singular',
        'Plur': 'Plural'
      }
      parts.push(numberMap[formMetadata.Number] || formMetadata.Number)
    }

    // Gender
    if (formMetadata.Gender) {
      const genderMap = {
        'Masc': 'Masculine',
        'Fem': 'Feminine'
      }
      parts.push(genderMap[formMetadata.Gender] || formMetadata.Gender)
    }

    return parts.join(' · ')
  }

  function highlightWordInSentence(sentence, word) {
    if (!sentence || !word) return sentence

    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    const parts = sentence.split(regex)
    const matches = sentence.match(regex) || []

    return parts.map((part, index) => (
      <span key={index}>
        {part}
        {matches[index] && (
          <span className="font-bold text-blue-600">
            {matches[index]}
          </span>
        )}
      </span>
    ))
  }

  function getMasteryPercentage(masteryLevel) {
    return Math.min(100, (masteryLevel / 100) * 100)
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never'

    const now = Date.now()
    const then = new Date(timestamp).getTime()
    const diffMs = now - then
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📚</div>
          <div className="text-xl font-serif text-gray-700">Loading flashcards...</div>
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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Don't Know</div>
                <div className="text-xl font-bold text-red-600">{sessionRatings['dont-know']}</div>
              </div>
              <div>
                <div className="text-gray-600">Hard</div>
                <div className="text-xl font-bold text-orange-600">{sessionRatings.hard}</div>
              </div>
              <div>
                <div className="text-gray-600">Medium</div>
                <div className="text-xl font-bold text-yellow-600">{sessionRatings.medium}</div>
              </div>
              <div>
                <div className="text-gray-600">Easy</div>
                <div className="text-xl font-bold text-green-600">{sessionRatings.easy}</div>
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with back button */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="text-amber-800 hover:text-amber-900 font-serif flex items-center gap-2"
          >
            ← Home
          </button>
          <h1 className="text-2xl font-serif font-bold text-amber-700">Flashcard Review</h1>
          <div className="w-16"></div>
        </div>

        {/* Session Stats */}
        <SessionStats
          currentIndex={currentIndex}
          totalCards={totalCards}
          sessionRatings={sessionRatings}
          sessionStartTime={sessionStartTime}
          focusChapter={focusChapter}
          chapterInfo={chapterInfo}
          onExitChapterFocus={() => navigate('/flashcards')}
        />

        {/* Flashcard Display */}
        <FlashcardDisplay
          card={currentCard}
          isFlipped={isFlipped}
          onCardClick={handleCardClick}
          chapterInfo={chapterInfo}
          formatGrammaticalContext={formatGrammaticalContext}
          highlightWordInSentence={highlightWordInSentence}
        />

        {/* Difficulty Buttons */}
        <DifficultyButtons
          onDifficulty={handleDifficulty}
          disabled={false}
          timeGateMessage={timeGateMessage}
          showingAnswer={isFlipped}
        />

        {/* Word Status Card */}
        {currentCard && (
          <WordStatusCard
            card={currentCard}
            showDetailedReview={showDetailedReview}
            onToggleDetail={() => setShowDetailedReview(!showDetailedReview)}
            getMasteryPercentage={getMasteryPercentage}
            formatTimeAgo={formatTimeAgo}
          />
        )}
      </div>
    </div>
  )
}
