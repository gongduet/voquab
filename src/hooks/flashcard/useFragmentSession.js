/**
 * useFragmentSession - Fragment flashcard session state management
 *
 * Similar to useFlashcardSession but optimized for fragment cards.
 * Handles both Read Mode (sequential) and Review Mode (spaced repetition).
 */

import { useState, useEffect, useCallback } from 'react'

export default function useFragmentSession(fragments, mode = 'read') {
  const [cardQueue, setCardQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionRatings, setSessionRatings] = useState({
    'again': 0,
    'hard': 0,
    'got-it': 0,
    'easy': 0
  })
  const [reviewedCardIds, setReviewedCardIds] = useState(new Set())
  const [sessionStartTime] = useState(Date.now())

  // Initialize card queue when fragments load
  useEffect(() => {
    if (fragments && fragments.length > 0 && cardQueue.length === 0) {
      initializeSession(fragments)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragments])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e) {
      // Skip hotkeys when user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        handleCardClick()
      }
      // Allow keyboard shortcuts regardless of flip state
      if (e.key === '1') handleDifficulty('again')
      else if (e.key === '2') handleDifficulty('hard')
      else if (e.key === '3') handleDifficulty('got-it')
      else if (e.key === '4') handleDifficulty('easy')
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped, currentIndex, cardQueue])

  function initializeSession(fragmentCards) {
    console.log('🎴 Fragment session initializing:', {
      totalFragments: fragmentCards.length,
      mode,
      sampleFragment: fragmentCards[0]
    })

    // For Read Mode, fragments are already in order
    // For Review Mode, they're already sorted by due date (most overdue first)
    setCardQueue(fragmentCards)
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const handleCardClick = useCallback(() => {
    setIsFlipped(prev => !prev)
  }, [])

  const handleDifficulty = useCallback((difficulty) => {
    console.log('🎴 Fragment handleDifficulty:', { difficulty, isFlipped, currentIndex })

    // Update session ratings
    setSessionRatings(prev => ({
      ...prev,
      [difficulty]: (prev[difficulty] || 0) + 1
    }))

    // Mark fragment as reviewed
    const currentCard = cardQueue[currentIndex]
    if (currentCard) {
      setReviewedCardIds(prev => new Set([...prev, currentCard.fragment_id]))
    }

    // Handle "Again" - requeue card
    if (difficulty === 'again') {
      requeueCard()
    } else {
      // Move to next card
      advanceToNextCard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, cardQueue])

  function requeueCard() {
    // Move current card to end of queue
    const currentCard = cardQueue[currentIndex]

    const newQueue = [...cardQueue]
    newQueue.splice(currentIndex, 1)  // Remove from current position
    newQueue.push(currentCard)  // Add to end of queue

    setCardQueue(newQueue)
    setIsFlipped(false)
    // DON'T increment currentIndex - next card slides into current position
    // Progress counter stays the same (e.g., stays at 12/45)
  }

  function advanceToNextCard() {
    setIsFlipped(false)
    setCurrentIndex(prev => prev + 1)
  }

  function resetSession() {
    setCardQueue([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionRatings({
      'again': 0,
      'hard': 0,
      'got-it': 0,
      'easy': 0
    })
    setReviewedCardIds(new Set())
  }

  // Derived state
  const currentCard = cardQueue[currentIndex] || null
  const totalCards = cardQueue.length
  const isComplete = currentIndex >= cardQueue.length && cardQueue.length > 0

  // Get last card info for saving progress (Read Mode)
  // NOTE: Must find the MAXIMUM position, not just the last card in queue order.
  // When cards are requeued via "Again", they move to the end of the queue,
  // so queue order doesn't reflect reading progress order.
  const getLastCardInfo = useCallback(() => {
    if (cardQueue.length === 0) return null

    // Find the maximum sentence_order and fragment_order among ALL reviewed cards
    // This represents how far the user has progressed in the chapter
    let maxSentenceOrder = 0
    let maxFragmentOrderInMaxSentence = 0

    for (const card of cardQueue) {
      const sentenceOrder = card.sentence_order || 0
      const fragmentOrder = card.fragment_order || 0

      if (sentenceOrder > maxSentenceOrder) {
        // New highest sentence - reset fragment tracking
        maxSentenceOrder = sentenceOrder
        maxFragmentOrderInMaxSentence = fragmentOrder
      } else if (sentenceOrder === maxSentenceOrder && fragmentOrder > maxFragmentOrderInMaxSentence) {
        // Same sentence, higher fragment
        maxFragmentOrderInMaxSentence = fragmentOrder
      }
    }

    return {
      sentence_order: maxSentenceOrder,
      fragment_order: maxFragmentOrderInMaxSentence,
      fragments_reviewed: Math.min(currentIndex, cardQueue.length)
    }
  }, [cardQueue, currentIndex])

  return {
    // Current state
    currentCard,
    currentIndex,
    totalCards,
    isFlipped,
    isComplete,
    sessionRatings,
    reviewedCardIds,
    sessionStartTime,
    cardQueue,

    // Actions
    handleCardClick,
    handleDifficulty,
    resetSession,
    setCardQueue,  // For external updates (e.g., updating FSRS values after rating)

    // Helpers
    getLastCardInfo,
    mode
  }
}
