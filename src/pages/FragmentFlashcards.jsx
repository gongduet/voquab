/**
 * Fragment Flashcards Page
 *
 * Displays fragment flashcards in two modes:
 * - Read Mode: Sequential fragments through a chapter
 * - Review Mode: Due fragments from all unlocked chapters
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, BookOpen, RefreshCw } from 'lucide-react'

// Components
import FlashcardDisplay from '../components/flashcard/FlashcardDisplay'
import DifficultyButtons from '../components/flashcard/DifficultyButtons'
import FloatingFeedback from '../components/flashcard/FloatingFeedback'
import FeedbackPrompt from '../components/flashcard/FeedbackPrompt'
import SessionSummary from '../components/flashcard/SessionSummary'
import LoadingScreen from '../components/flashcard/LoadingScreen'

// Hooks
import useFragmentSession from '../hooks/flashcard/useFragmentSession'
import useFragmentProgressTracking from '../hooks/flashcard/useFragmentProgressTracking'

// Services
import {
  FragmentMode,
  buildFragmentReadSession,
  buildFragmentReviewSession
} from '../services/fragmentSessionBuilder'

export default function FragmentFlashcards({ mode: propMode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const params = useParams()

  // Get mode and IDs from props/params
  const mode = propMode || FragmentMode.READ
  const chapterId = params.chapterId
  const bookId = params.bookId

  // Local state
  const [fragments, setFragments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionInfo, setSessionInfo] = useState(null)

  // Floating feedback animation state
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 })
  const [feedbackColor, setFeedbackColor] = useState('#d97706')

  // Track all reviewed fragments with their ratings and due dates
  const [reviewedFragments, setReviewedFragments] = useState(new Map())

  // Track when chapter progress has been saved (for Read mode)
  const [progressSaved, setProgressSaved] = useState(false)
  const progressSaveRef = useRef(false)  // Prevent duplicate saves

  // Prevent duplicate loadSession calls from StrictMode
  const loadingRef = useRef(false)

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
    setCardQueue,
    getLastCardInfo
  } = useFragmentSession(fragments, mode)

  // Progress tracking
  const {
    updateFragmentProgress,
    updateChapterProgress,
    updateDailyStats
  } = useFragmentProgressTracking(user?.id)

  // Helper: Return to correct dashboard
  const getReturnPath = () => {
    if (bookId) return `/book/${bookId}`
    // For read mode, we need to find the bookId from the session
    if (sessionInfo?.chapterId) {
      // Default to home if we don't have bookId
      return '/'
    }
    return '/'
  }

  // Load session on mount
  useEffect(() => {
    if (user?.id) {
      loadSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, chapterId, bookId])

  async function loadSession() {
    if (loadingRef.current) return
    loadingRef.current = true

    setReviewedFragments(new Map())
    setLoading(true)
    setError(null)

    try {
      let result

      if (mode === FragmentMode.READ) {
        if (!chapterId) {
          throw new Error('Chapter ID required for Read Mode')
        }
        result = await buildFragmentReadSession(user.id, chapterId)
      } else {
        if (!bookId) {
          throw new Error('Book ID required for Review Mode')
        }
        result = await buildFragmentReviewSession(user.id, bookId)
      }

      console.log('📦 Fragment session result:', {
        fragmentsCount: result.fragments?.length,
        mode: result.mode,
        totalInChapter: result.totalInChapter,
        sectionInfo: result.sectionInfo
      })

      if (result.error) {
        setError(result.error)
      } else {
        setFragments(result.fragments || [])
        setSessionInfo(result)

        if (result.message) {
          console.log('ℹ️ Session message:', result.message)
        }
      }
    } catch (err) {
      console.error('Error loading fragment session:', err)
      setError(err.message)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  // Handle difficulty rating
  function handleDifficulty(difficulty, event) {
    if (!currentCard) return

    // Capture button position for floating feedback animation
    if (event?.target) {
      const rect = event.target.getBoundingClientRect()
      setFeedbackPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      })
    }

    const fragmentToUpdate = currentCard
    const isAgain = difficulty === 'again'

    // ADVANCE CARD IMMEDIATELY (optimistic UI)
    handleDifficultySession(difficulty)

    // Fire DB update in BACKGROUND (non-blocking)
    updateFragmentProgress(fragmentToUpdate, difficulty)
      .then(result => {
        if (result?.success) {
          // Track for session summary
          setReviewedFragments(prev => {
            const updated = new Map(prev)
            updated.set(fragmentToUpdate.fragment_id, {
              fragmentText: fragmentToUpdate.fragment_text,
              chapterNumber: fragmentToUpdate.chapter_number,
              wasMarkedAgain: isAgain,
              finalRating: isAgain ? 'again' : difficulty,
              dueFormatted: result.dueFormatted,
              dueTimestamp: result.dueDate ? new Date(result.dueDate).getTime() : null
            })
            return updated
          })

          // Update daily stats
          updateDailyStats()

          // Show floating feedback (skip for "again" - card requeued)
          if (result?.dueFormatted && !isAgain) {
            const colorMap = {
              'hard': '#e5989b',
              'got-it': '#5aada4',
              'easy': '#006d77'
            }
            setFeedbackColor(colorMap[difficulty] || '#d97706')
            setFeedbackMessage(`+${result.dueFormatted}`)
            setShowFeedback(true)
            setTimeout(() => setShowFeedback(false), 1500)
          }

          // Update requeued card's FSRS values for second review
          if (isAgain) {
            setCardQueue(prevQueue => prevQueue.map(card => {
              if (card.fragment_id === fragmentToUpdate.fragment_id) {
                return {
                  ...card,
                  stability: result.newStability,
                  difficulty: result.newDifficulty,
                  next_review_at: result.dueDate,
                  fsrs_state: result.fsrsState,
                  reps: result.reps,
                  lapses: result.lapses,
                  last_review_at: result.lastReviewAt
                }
              }
              return card
            }))
          }
        }
      })
      .catch(err => console.error('Fragment progress update failed:', err))
  }

  // Save chapter progress when session completes (Read Mode only)
  useEffect(() => {
    if (isComplete && mode === FragmentMode.READ && chapterId && !progressSaveRef.current) {
      progressSaveRef.current = true  // Prevent duplicate saves
      const lastCardInfo = getLastCardInfo()
      if (lastCardInfo) {
        console.log('💾 Saving chapter progress:', lastCardInfo)
        updateChapterProgress(
          chapterId,
          lastCardInfo.fragments_reviewed,
          lastCardInfo.sentence_order,
          lastCardInfo.fragment_order
        ).then(result => {
          console.log('✅ Chapter progress saved:', result)
          setProgressSaved(true)  // Mark save as complete
          if (result?.isReadComplete) {
            console.log('✅ Chapter fragment reading complete!')
          }
        }).catch(err => {
          console.error('❌ Failed to save chapter progress:', err)
          setProgressSaved(true)  // Still allow continue even on error
        })
      } else {
        setProgressSaved(true)  // No progress to save
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, mode, chapterId])

  // Loading state
  if (loading) {
    return (
      <LoadingScreen
        mode={mode === FragmentMode.READ ? 'read' : 'review'}
        progress={null}
      />
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(getReturnPath())}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!fragments || fragments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <BookOpen className="w-16 h-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            {mode === FragmentMode.READ
              ? 'No More Fragments'
              : 'No Fragments Due'
            }
          </h2>
          <p className="text-slate-600 mb-6">
            {sessionInfo?.message ||
              (mode === FragmentMode.READ
                ? 'You\'ve completed all fragments in this chapter!'
                : 'Great job! No fragments need review right now.')
            }
          </p>
          <button
            onClick={() => navigate(getReturnPath())}
            className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Session complete - show summary
  if (isComplete) {
    // Calculate if chapter is complete (all fragments reviewed)
    const fragmentsReviewedTotal = (sessionInfo?.currentPosition || 0) + totalCards
    const chapterComplete = mode === FragmentMode.READ &&
      sessionInfo?.totalInChapter > 0 &&
      fragmentsReviewedTotal >= sessionInfo.totalInChapter

    // Calculate remaining fragments AFTER this session
    // For Read mode: remaining in chapter = totalInChapter - fragmentsReviewedTotal
    // For Review mode: remaining due = originalDue - uniqueFragmentsReviewed
    const remainingCount = mode === FragmentMode.READ
      ? Math.max(0, (sessionInfo?.totalInChapter || 0) - fragmentsReviewedTotal)
      : Math.max(0, (sessionInfo?.totalDue || 0) - reviewedFragments.size)

    // Handler to load next section (only for Read mode, only if progress is saved)
    // Must wait for progress save to complete to avoid showing duplicate fragments
    const handleContinueReading = mode === FragmentMode.READ && progressSaved
      ? () => window.location.reload()  // Reload will fetch next batch from saved position
      : null

    return (
      <SessionSummary
        totalCards={totalCards}
        ratings={{
          again: sessionRatings['again'] || 0,
          hard: sessionRatings['hard'] || 0,
          gotIt: sessionRatings['got-it'] || 0,
          easy: sessionRatings['easy'] || 0
        }}
        reviewedCards={Array.from(reviewedFragments.values()).map(f => ({
          lemma: f.fragmentText,
          cardType: 'fragment',
          partOfSpeech: `Chapter ${f.chapterNumber}`,
          wasMarkedAgain: f.wasMarkedAgain,
          finalRating: f.finalRating,
          dueFormatted: f.dueFormatted,
          dueTimestamp: f.dueTimestamp
        }))}
        dueCount={remainingCount}
        newAvailable={0}
        onNewSession={() => window.location.reload()}
        onDashboard={() => navigate(getReturnPath())}
        // Fragment-specific props
        onContinueReading={handleContinueReading}
        isChapterComplete={chapterComplete}
        isSavingProgress={mode === FragmentMode.READ && !progressSaved}
      />
    )
  }

  // Active session
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Exit button */}
          <button
            onClick={() => navigate(getReturnPath())}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          {/* Mode indicator */}
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: mode === FragmentMode.READ ? '#fef3c7' : '#dbeafe',
                color: mode === FragmentMode.READ ? '#92400e' : '#1e40af'
              }}
            >
              {mode === FragmentMode.READ ? 'Read Mode' : 'Review Mode'}
            </span>
          </div>

          {/* Progress indicator */}
          <div className="text-slate-600 text-sm font-medium">
            {currentIndex + 1} / {totalCards}
          </div>
        </div>

        {/* Section info for Read Mode */}
        {mode === FragmentMode.READ && sessionInfo?.totalInChapter > 0 && (
          <div className="max-w-4xl mx-auto px-4 pb-2">
            <p className="text-xs text-slate-500">
              Fragments {(sessionInfo.currentPosition || 0) + 1}-{Math.min((sessionInfo.currentPosition || 0) + totalCards, sessionInfo.totalInChapter)} of {sessionInfo.totalInChapter}
              {sessionInfo.chapterProgress?.chapter_title &&
                ` • ${sessionInfo.chapterProgress.chapter_title}`
              }
            </p>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Flashcard */}
        <FlashcardDisplay
          card={currentCard}
          isFlipped={isFlipped}
          onCardClick={handleCardClick}
        />

        {/* Difficulty buttons - show on both sides */}
        <div className="mt-4">
          <DifficultyButtons onDifficulty={handleDifficulty} />
        </div>

        {/* Feedback prompt */}
        <div className="mt-6">
          <FeedbackPrompt
            fragmentId={currentCard?.fragment_id}
            userId={user?.id}
          />
        </div>

        {/* Floating feedback animation */}
        <FloatingFeedback
          message={feedbackMessage}
          isVisible={showFeedback}
          position={feedbackPosition}
          color={feedbackColor}
        />
      </main>
    </div>
  )
}
