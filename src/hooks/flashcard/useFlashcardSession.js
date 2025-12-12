import { useState, useEffect } from 'react'
import { calculateCurrentHealth } from '../../utils/healthCalculations'
import { selectCardsForSession } from '../../utils/priorityCalculations'

export default function useFlashcardSession(allCards, cardsPerSession = 15) {
  const [cardQueue, setCardQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [sessionRatings, setSessionRatings] = useState({
    'dont-know': 0,
    'hard': 0,
    'medium': 0,
    'easy': 0
  })
  const [reviewedCardIds, setReviewedCardIds] = useState(new Set())
  const [sessionStartTime] = useState(Date.now())

  // Initialize card queue when cards load
  useEffect(() => {
    if (allCards.length > 0 && cardQueue.length === 0) {
      initializeSession(allCards)
    }
  }, [allCards])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e) {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        handleCardClick()
      }
      // Allow keyboard shortcuts regardless of flip state
      if (e.key === '1') handleDifficulty('again')
      else if (e.key === '2') handleDifficulty('hard')
      else if (e.key === '3') handleDifficulty('got-it')
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isFlipped, currentIndex])

  function initializeSession(cards) {
    // Calculate current health for all cards
    const cardsWithHealth = cards.map(card => ({
      ...card,
      current_health: calculateCurrentHealth(card)
    }))

    console.log('🎴 Before selection:', {
      totalCards: cards.length,
      cardsWithHealthCount: cardsWithHealth.length,
      sampleCardWithHealth: cardsWithHealth[0]
    })

    // Select cards using priority algorithm
    // selectCardsForSession returns { cards, stats } object
    const selectionResult = selectCardsForSession(
      cardsWithHealth,
      cardsPerSession,
      { shuffle: true }
    )

    // Extract cards array from result, fallback to first N cards if selection fails
    const selectedCards = selectionResult?.cards || cardsWithHealth.slice(0, cardsPerSession)

    console.log('🔧 Selection result:', {
      hasSelectionResult: !!selectionResult,
      hasCards: !!selectionResult?.cards,
      stats: selectionResult?.stats,
      selectedCount: selectedCards?.length
    })

    console.log('🎴 After selection:', {
      selectedCount: selectedCards.length,
      requestedCount: cardsPerSession,
      sampleSelected: selectedCards[0]
    })

    setCardQueue(selectedCards)
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  function handleCardClick() {
    setIsFlipped(!isFlipped)
  }

  function handleDifficulty(difficulty) {
    console.log('🎴 Session handleDifficulty:', { difficulty, isFlipped, currentIndex })

    // Map new button values to session tracking
    const trackingKey = difficulty === 'again' ? 'dont-know' :
                        difficulty === 'got-it' ? 'easy' :
                        difficulty // 'hard' stays 'hard'

    // Update session ratings
    setSessionRatings(prev => ({
      ...prev,
      [trackingKey]: (prev[trackingKey] || 0) + 1
    }))

    // Mark card as reviewed
    const currentCard = cardQueue[currentIndex]
    if (currentCard) {
      setReviewedCardIds(prev => new Set([...prev, currentCard.vocab_id]))
    }

    // Handle "Again" - requeue card
    if (difficulty === 'again') {
      requeueCard()
    } else {
      // Move to next card
      advanceToNextCard()
    }
  }

  function requeueCard() {
    // Move current card to end of queue
    const currentCard = cardQueue[currentIndex]

    const newQueue = [...cardQueue]
    newQueue.splice(currentIndex, 1)  // Remove from current position
    newQueue.push(currentCard)  // Add to end of queue

    setCardQueue(newQueue)
    setIsFlipped(false)
    // DON'T increment currentIndex - next card slides into current position
    // Progress counter stays the same (e.g., stays at 2/15)
  }

  function advanceToNextCard() {
    setIsFlipped(false)
    setCurrentIndex(currentIndex + 1)
  }

  function resetSession() {
    setCardQueue([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionRatings({
      'dont-know': 0,
      'hard': 0,
      'medium': 0,
      'easy': 0
    })
    setReviewedCardIds(new Set())
  }

  const currentCard = cardQueue[currentIndex] || null
  const isComplete = currentIndex >= cardQueue.length
  const totalCards = cardQueue.length

  return {
    // Card state
    currentCard,
    currentIndex,
    totalCards,
    isFlipped,
    isComplete,

    // Session stats
    sessionRatings,
    reviewedCardIds,
    sessionStartTime,

    // Actions
    handleCardClick,
    handleDifficulty,
    resetSession,

    // For external updates
    cardQueue,
    setCardQueue
  }
}
