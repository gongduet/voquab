import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * SessionSummary - Notion-inspired session completion screen
 *
 * Shows performance stats, trouble words with due dates, and expandable card list
 */
export default function SessionSummary({
  totalCards = 0,
  ratings = { again: 0, hard: 0, gotIt: 0, easy: 0 },
  reviewedCards = [],
  dueCount = 0,
  newAvailable = 0,
  onNewSession,
  onDashboard
}) {
  const navigate = useNavigate()
  const [showAllCards, setShowAllCards] = useState(false)

  // Calculate success rate: (gotIt + easy) / total
  // Note: Hard is not counted as success since it means the user struggled
  const successRate = totalCards > 0
    ? Math.round(((ratings.gotIt + ratings.easy) / totalCards) * 100)
    : 0

  // Filter and sort cards - include "again" OR "hard" ratings
  const needsFocusCards = reviewedCards
    .filter(card => card.wasMarkedAgain || card.finalRating === 'hard')
    .sort(sortCards)

  const allCardsSorted = [...reviewedCards].sort(sortCards)

  const hasTroubleWords = needsFocusCards.length > 0
  const hasMoreToReview = dueCount > 0
  const hasNewToLearn = newAvailable > 0

  // Format today's date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const handleNewSession = () => {
    if (onNewSession) {
      onNewSession()
    } else {
      window.location.reload()
    }
  }

  const handleDashboard = () => {
    if (onDashboard) {
      onDashboard()
    } else {
      navigate('/')
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        backgroundColor: '#fafaf9',
        color: '#171717'
      }}
    >
      <div
        className="max-w-lg mx-auto bg-white rounded-xl shadow-sm p-6"
        style={{ border: '1px solid #e7e5e4' }}
      >
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#0ea5e9' }}
            />
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: '#737373' }}
            >
              Session Complete
            </p>
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight mb-2"
            style={{ color: '#171717' }}
          >
            Summary
          </h1>
          <p
            className="text-sm font-medium"
            style={{ color: '#737373' }}
          >
            {today}
          </p>
        </header>

        {/* Metrics */}
        <section className="flex justify-around items-center mb-8 py-4">
          <div className="flex flex-col items-center px-4">
            <span className="text-2xl font-semibold" style={{ color: '#171717' }}>
              {successRate}%
            </span>
            <span className="text-xs font-medium mt-1 uppercase tracking-wide" style={{ color: '#a3a3a3' }}>
              Success
            </span>
          </div>
          <div style={{ width: '1px', height: '40px', backgroundColor: '#e7e5e4' }} />
          <div className="flex flex-col items-center px-4">
            <span className="text-2xl font-semibold" style={{ color: '#171717' }}>
              {totalCards}
            </span>
            <span className="text-xs font-medium mt-1 uppercase tracking-wide" style={{ color: '#a3a3a3' }}>
              Cards
            </span>
          </div>
          <div style={{ width: '1px', height: '40px', backgroundColor: '#e7e5e4' }} />
          <div className="flex flex-col items-center px-4">
            <span className="text-2xl font-semibold" style={{ color: '#98c1a3' }}>
              {ratings.gotIt}
            </span>
            <span className="text-xs font-medium mt-1 uppercase tracking-wide" style={{ color: '#a3a3a3' }}>
              Got It
            </span>
          </div>
        </section>

        {/* Rating Breakdown */}
        <section className="mb-8">
          <h2
            className="text-sm font-semibold mb-4 pb-2"
            style={{ color: '#171717', borderBottom: '1px solid #e7e5e4' }}
          >
            Responses
          </h2>
          <div className="flex justify-around">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold" style={{ color: '#d4806a' }}>
                {ratings.again}
              </span>
              <span className="text-xs mt-1" style={{ color: '#737373' }}>Again</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold" style={{ color: '#e5989b' }}>
                {ratings.hard}
              </span>
              <span className="text-xs mt-1" style={{ color: '#737373' }}>Hard</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold" style={{ color: '#5aada4' }}>
                {ratings.gotIt}
              </span>
              <span className="text-xs mt-1" style={{ color: '#737373' }}>Got It</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold" style={{ color: '#006d77' }}>
                {ratings.easy}
              </span>
              <span className="text-xs mt-1" style={{ color: '#737373' }}>Easy</span>
            </div>
          </div>
        </section>

        {/* Needs Attention OR Perfect Session */}
        {hasTroubleWords ? (
          <section className="mb-6">
            <div
              className="flex items-center justify-between mb-4 pb-2"
              style={{ borderBottom: '1px solid #e7e5e4' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: '#171717' }}>
                Needs Attention
              </h2>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#fef3c7', color: '#f59e0b' }}
              >
                {needsFocusCards.length} {needsFocusCards.length === 1 ? 'Word' : 'Words'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {needsFocusCards.map((card, idx) => (
                <CardRow key={card.cardId || idx} card={card} />
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-6 text-center py-6">
            <CheckCircle
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: '#f59e0b' }}
            />
            <p
              className="font-semibold text-lg"
              style={{ color: '#171717' }}
            >
              Perfect session!
            </p>
            <p
              className="mt-1"
              style={{ color: '#a3a3a3', fontSize: '14px' }}
            >
              Every card answered correctly
            </p>
          </section>
        )}

        {/* Expandable All Cards Section */}
        {allCardsSorted.length > 0 && (
          <section className="mb-6">
            <button
              onClick={() => setShowAllCards(!showAllCards)}
              className="w-full flex items-center justify-between py-2 text-sm font-semibold"
              style={{ color: '#171717', borderBottom: '1px solid #e7e5e4' }}
            >
              <span>All {allCardsSorted.length} cards</span>
              {showAllCards ? (
                <ChevronUp className="w-4 h-4" style={{ color: '#737373' }} />
              ) : (
                <ChevronDown className="w-4 h-4" style={{ color: '#737373' }} />
              )}
            </button>

            {showAllCards && (
              <div className="flex flex-col gap-2 mt-3">
                {allCardsSorted.map((card, idx) => (
                  <CardRow key={card.cardId || idx} card={card} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Action Buttons */}
        <div
          className="mt-auto pt-6 space-y-3"
          style={{ borderTop: '1px solid #e7e5e4' }}
        >
          {(hasMoreToReview || hasNewToLearn) && (
            <button
              onClick={handleNewSession}
              className="w-full text-white font-medium py-3.5 rounded-xl shadow-sm transition-all active:scale-[0.99]"
              style={{ backgroundColor: '#0ea5e9', fontSize: '14px' }}
            >
              {hasMoreToReview
                ? `Review More (${dueCount} due)`
                : `Learn New Words (${newAvailable})`
              }
            </button>
          )}

          <button
            onClick={handleDashboard}
            className="w-full font-medium py-3.5 rounded-xl transition-all active:scale-[0.99]"
            style={{
              backgroundColor: (hasMoreToReview || hasNewToLearn) ? 'transparent' : '#0ea5e9',
              color: (hasMoreToReview || hasNewToLearn) ? '#525252' : 'white',
              border: (hasMoreToReview || hasNewToLearn) ? '1px solid #d6d3d1' : 'none',
              fontSize: '14px'
            }}
          >
            {(hasMoreToReview || hasNewToLearn) ? 'Back to Dashboard' : 'Return to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Individual card row with color dot, word, part of speech, and due time
 */
function CardRow({ card }) {
  const dotColor = getDotColor(card.finalRating)

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <span
          className="font-medium truncate"
          style={{ color: '#171717', fontSize: '14px' }}
        >
          {card.lemma}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {card.partOfSpeech && (
          <span
            className="italic"
            style={{ color: '#a3a3a3', fontSize: '11px' }}
          >
            {card.partOfSpeech.toLowerCase()}
          </span>
        )}
        <span
          className="font-medium"
          style={{ color: '#737373', fontSize: '12px', minWidth: '50px', textAlign: 'right' }}
        >
          {card.dueFormatted}
        </span>
      </div>
    </div>
  )
}

/**
 * Get dot color based on final rating
 */
function getDotColor(rating) {
  switch (rating) {
    case 'again':
      return '#d4806a'  // Coral
    case 'hard':
      return '#e5989b'  // Dusty rose
    case 'easy':
      return '#006d77'  // Dark teal
    case 'gotIt':
    default:
      return '#5aada4'  // Teal
  }
}

/**
 * Sort cards: by rating (again → hard → gotIt) then by due date (soonest first)
 */
function sortCards(a, b) {
  const ratingOrder = { again: 0, hard: 1, gotIt: 2 }
  const ratingA = ratingOrder[a.finalRating] ?? 2
  const ratingB = ratingOrder[b.finalRating] ?? 2

  if (ratingA !== ratingB) {
    return ratingA - ratingB
  }

  // Same rating, sort by due date (soonest first)
  return (a.dueTimestamp || 0) - (b.dueTimestamp || 0)
}
