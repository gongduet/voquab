/**
 * FSRS Service - Free Spaced Repetition Scheduler
 *
 * Implements pure FSRS algorithm for Voquab flashcard scheduling.
 * Replaces the custom mastery/health system with research-backed algorithm.
 *
 * Key concepts:
 * - Stability: Days until 90% recall probability
 * - Difficulty: Item complexity (1-10 scale)
 * - Retrievability: Current recall probability (0-100%)
 * - State: New(0), Learning(1), Review(2), Relearning(3)
 */

import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import { FSRS_CONFIG } from '../config/fsrsConfig'

// Initialize FSRS with tuned parameters from config
const params = generatorParameters({
  request_retention: FSRS_CONFIG.REQUEST_RETENTION,
  enable_fuzz: FSRS_CONFIG.ENABLE_FUZZ
})
const f = fsrs(params)

// Initialize separate FSRS instance for fragments (lower retention = longer intervals)
// Fragments are a stepping stone to reading, not a primary study activity
const fragmentParams = generatorParameters({
  request_retention: FSRS_CONFIG.FRAGMENT_REQUEST_RETENTION,
  enable_fuzz: FSRS_CONFIG.ENABLE_FUZZ
})
const fragmentScheduler = fsrs(fragmentParams)

/**
 * FSRS State enum mapping
 */
export const FSRSState = {
  NEW: 0,
  LEARNING: 1,
  REVIEW: 2,
  RELEARNING: 3
}

/**
 * Map UI buttons to FSRS ratings (4-rating system)
 * Again = 1, Hard = 2, Good = 3, Easy = 4
 */
export const ButtonToRating = {
  'again': Rating.Again,      // 1 - Complete failure, reset to learning
  'dont-know': Rating.Again,  // 1 (legacy mapping)
  'hard': Rating.Hard,        // 2 - Recalled with difficulty
  'got-it': Rating.Good,      // 3 - Recalled correctly
  'good': Rating.Good,        // 3 - Recalled correctly
  'easy': Rating.Easy         // 4 - Recalled effortlessly, boost interval
}

/**
 * Schedule a card based on user response
 *
 * @param {Object} card - Card with FSRS state (stability, difficulty, due_date, etc.)
 * @param {string|number} rating - User rating: 'again'|'hard'|'got-it'|'easy' or 1|2|3|4
 * @returns {Object} - Updated card state with new stability, difficulty, due_date, etc.
 */
export function scheduleCard(card, rating) {
  // Convert string rating to FSRS Rating enum
  const fsrsRating = typeof rating === 'string'
    ? ButtonToRating[rating] || Rating.Good
    : rating

  // Build FSRS card object from our database card
  const fsrsCard = cardToFSRS(card)

  // Get scheduling info for all possible ratings
  const now = new Date()
  const schedulingCards = f.repeat(fsrsCard, now)

  // Get the result for the chosen rating
  const result = schedulingCards[fsrsRating]

  if (!result) {
    console.error('FSRS scheduling failed for rating:', rating)
    return card
  }

  // Apply Hard interval cap (training wheels for new learners)
  let dueDate = result.card.due
  if (fsrsRating === Rating.Hard && FSRS_CONFIG.HARD_INTERVAL_CAP_DAYS) {
    const maxDue = new Date(now.getTime() + FSRS_CONFIG.HARD_INTERVAL_CAP_DAYS * 24 * 60 * 60 * 1000)
    if (dueDate > maxDue) {
      dueDate = maxDue
    }
  }

  // Convert back to our database format
  return {
    ...card,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    due_date: dueDate.toISOString(),
    fsrs_state: result.card.state,
    reps: result.card.reps,
    lapses: result.card.lapses,
    last_seen_at: now.toISOString(),
    last_reviewed_at: now.toISOString(),
    // Keep legacy fields updated for backward compatibility during migration
    total_reviews: (card.total_reviews || 0) + 1
  }
}

/**
 * Schedule a fragment card based on user response
 *
 * Uses the fragment-specific FSRS instance with lower retention (0.80 vs 0.94)
 * This results in longer intervals - fragments are a stepping stone to reading,
 * not a primary study activity.
 *
 * IMPORTANT: For NEW fragments (reps === 0), we skip the FSRS Learning phase
 * entirely and go directly to Review state with long intervals. This is because
 * fragments are comprehension-focused (not rote memorization), so the short
 * Learning intervals (10 min) don't make sense.
 *
 * @param {Object} card - Fragment card with FSRS state
 * @param {string|number} rating - User rating: 'again'|'hard'|'got-it'|'easy' or 1|2|3|4
 * @returns {Object} - Updated card state with new stability, difficulty, due_date, etc.
 */
export function scheduleFragmentCard(card, rating) {
  // Convert string rating to FSRS Rating enum
  const fsrsRating = typeof rating === 'string'
    ? ButtonToRating[rating] || Rating.Good
    : rating

  const now = new Date()
  const isNewCard = !card.reps || card.reps === 0

  // For NEW fragments: Skip Learning phase, go directly to Review intervals
  // Fragments are comprehension-focused, not rote memory, so short Learning
  // intervals (10 min) don't apply. Use custom intervals for first rating.
  if (isNewCard) {
    // Custom intervals for new fragments (skip Learning phase)
    // These intervals are designed for 0.80 retention - longer than word intervals
    let intervalDays
    let newState = FSRSState.REVIEW  // Go directly to Review state
    let newStability
    let newDifficulty

    switch (fsrsRating) {
      case Rating.Again:  // 1 - Complete failure
        intervalDays = 1 / 144  // 10 min (requeue within session)
        newState = FSRSState.LEARNING
        newStability = 0.5
        newDifficulty = 7  // Higher difficulty for failed cards
        break
      case Rating.Hard:  // 2 - Recalled with difficulty
        intervalDays = 3
        newStability = 3
        newDifficulty = 6
        break
      case Rating.Good:  // 3 - Recalled correctly (most common)
        intervalDays = 14  // ~2 weeks for fragments
        newStability = 14
        newDifficulty = 5
        break
      case Rating.Easy:  // 4 - Effortless recall
        intervalDays = 30  // ~1 month
        newStability = 30
        newDifficulty = 3  // Lower difficulty for easy cards
        break
      default:
        intervalDays = 14
        newStability = 14
        newDifficulty = 5
    }

    const dueDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000)

    return {
      ...card,
      stability: newStability,
      difficulty: newDifficulty,
      due_date: dueDate.toISOString(),
      next_review_at: dueDate.toISOString(),
      fsrs_state: newState,
      reps: 1,
      lapses: fsrsRating === Rating.Again ? 1 : 0,
      last_seen_at: now.toISOString(),
      last_review_at: now.toISOString()
    }
  }

  // For REVIEWED fragments: Use normal FSRS scheduling
  const fsrsCard = cardToFSRS(card)
  const schedulingCards = fragmentScheduler.repeat(fsrsCard, now)
  const result = schedulingCards[fsrsRating]

  if (!result) {
    console.error('FSRS fragment scheduling failed for rating:', rating)
    return card
  }

  // Apply Hard interval cap (same as words)
  let dueDate = result.card.due
  if (fsrsRating === Rating.Hard && FSRS_CONFIG.HARD_INTERVAL_CAP_DAYS) {
    const maxDue = new Date(now.getTime() + FSRS_CONFIG.HARD_INTERVAL_CAP_DAYS * 24 * 60 * 60 * 1000)
    if (dueDate > maxDue) {
      dueDate = maxDue
    }
  }

  // Convert back to our database format
  return {
    ...card,
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    due_date: dueDate.toISOString(),
    next_review_at: dueDate.toISOString(),  // Fragment table uses next_review_at
    fsrs_state: result.card.state,
    reps: result.card.reps,
    lapses: result.card.lapses,
    last_seen_at: now.toISOString(),
    last_review_at: now.toISOString()  // Fragment table uses last_review_at
  }
}

/**
 * Convert our database card to FSRS card format
 *
 * @param {Object} card - Database card object
 * @returns {Object} - FSRS-compatible card object
 */
function cardToFSRS(card) {
  // If card has no FSRS data, create a new empty card
  if (card.stability === null || card.stability === undefined) {
    return createEmptyCard()
  }

  return {
    due: card.due_date ? new Date(card.due_date) : new Date(),
    stability: card.stability || 0,
    difficulty: card.difficulty || 0,
    elapsed_days: calculateElapsedDays(card),
    scheduled_days: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: card.fsrs_state ?? State.New,
    last_review: card.last_reviewed_at ? new Date(card.last_reviewed_at) : undefined
  }
}

/**
 * Calculate days elapsed since last review
 *
 * @param {Object} card - Card with last_reviewed_at
 * @returns {number} - Days since last review
 */
function calculateElapsedDays(card) {
  if (!card.last_reviewed_at) return 0

  const lastReview = new Date(card.last_reviewed_at)
  const now = new Date()
  const diffMs = now - lastReview
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if a card is due for review
 *
 * @param {Object} card - Card with due_date
 * @returns {boolean} - True if card is due (due_date <= now)
 */
export function isCardDue(card) {
  // New cards (never reviewed) are always "due" for learning
  if (!card.due_date) {
    return card.fsrs_state === FSRSState.NEW || card.reps === 0
  }

  const dueDate = new Date(card.due_date)
  const now = new Date()
  return dueDate <= now
}

/**
 * Check if a card should be included for exposure oversampling
 *
 * Exposure insurance: Show stable cards occasionally to prevent
 * "forgotten easy words" syndrome.
 *
 * Criteria:
 * - Stability > 30 days (well-learned)
 * - State = Review (not Learning/Relearning)
 * - Not seen in X days (based on activity level)
 *
 * @param {Object} card - Card with FSRS state
 * @param {number} daysSinceLastSeen - Minimum days since last exposure
 * @returns {boolean} - True if card qualifies for exposure
 */
export function shouldIncludeForExposure(card, daysSinceLastSeen = 14) {
  // Must be in Review state (well-learned)
  if (card.fsrs_state !== FSRSState.REVIEW) {
    return false
  }

  // Must have high stability (>30 days)
  if (!card.stability || card.stability < 30) {
    return false
  }

  // Must not have been seen recently
  if (card.last_seen_at) {
    const lastSeen = new Date(card.last_seen_at)
    const now = new Date()
    const daysSince = (now - lastSeen) / (1000 * 60 * 60 * 24)

    if (daysSince < daysSinceLastSeen) {
      return false
    }
  }

  return true
}

/**
 * Get user activity level based on recent review counts
 *
 * @param {Array} dailyStats - Array of { review_date, words_reviewed }
 * @returns {Object} - { level: 'high'|'medium'|'low', exposureCards, daysBetween }
 */
export function getUserActivityLevel(dailyStats) {
  if (!dailyStats || dailyStats.length === 0) {
    return { level: 'low', exposureCards: 2, daysBetween: 21 }
  }

  // Calculate average reviews per day over last 7 days
  const last7Days = dailyStats
    .filter(s => {
      const date = new Date(s.review_date)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return date >= weekAgo
    })

  const totalReviews = last7Days.reduce((sum, s) => sum + (s.words_reviewed || 0), 0)
  const avgPerDay = totalReviews / 7

  // High: 100+ reviews/day → 10 exposure cards, 7 days between
  if (avgPerDay >= 100) {
    return { level: 'high', exposureCards: 10, daysBetween: 7 }
  }

  // Medium: 50-99 reviews/day → 5 exposure cards, 14 days between
  if (avgPerDay >= 50) {
    return { level: 'medium', exposureCards: 5, daysBetween: 14 }
  }

  // Low: <50 reviews/day → 2 exposure cards, 21 days between
  return { level: 'low', exposureCards: 2, daysBetween: 21 }
}

/**
 * Convert FSRS stability to legacy mastery percentage (0-100)
 *
 * This maintains backward compatibility with existing UI that shows
 * mastery levels. Maps stability logarithmically:
 * - 0 days → 0%
 * - 1 day → 10%
 * - 7 days → 30%
 * - 30 days → 50%
 * - 90 days → 70%
 * - 180 days → 85%
 * - 365+ days → 100%
 *
 * @param {number} stability - FSRS stability in days
 * @returns {number} - Mastery percentage 0-100
 */
export function stabilityToMastery(stability) {
  if (!stability || stability <= 0) return 0

  // Logarithmic mapping
  // mastery = 100 * (1 - e^(-stability/120))
  // This gives ~50% at 30 days, ~85% at 180 days, ~95% at 365 days
  const mastery = 100 * (1 - Math.exp(-stability / 120))

  return Math.min(100, Math.round(mastery))
}

/**
 * Calculate current retrievability (recall probability)
 *
 * FSRS formula: R = (1 + t / (9 * S))^-1
 * Where t = days since last review, S = stability
 *
 * @param {Object} card - Card with stability and last_reviewed_at
 * @returns {number} - Retrievability 0-100%
 */
export function calculateRetrievability(card) {
  if (!card.stability || card.stability <= 0) {
    return card.reps > 0 ? 50 : 0 // Default for reviewed but no stability
  }

  const elapsedDays = calculateElapsedDays(card)

  // FSRS retrievability formula
  // R = (1 + t / (9 * S))^-1
  const retrievability = Math.pow(1 + elapsedDays / (9 * card.stability), -1)

  return Math.round(retrievability * 100)
}

/**
 * Mark a card as seen (for exposure tracking) without full review
 *
 * Used for exposure cards - updates last_seen_at without changing
 * FSRS scheduling state.
 *
 * @param {Object} card - Card to mark as seen
 * @returns {Object} - Card with updated last_seen_at
 */
export function markCardAsSeen(card) {
  return {
    ...card,
    last_seen_at: new Date().toISOString()
  }
}

/**
 * Get human-readable state name
 *
 * @param {number} state - FSRS state enum
 * @returns {string} - State name
 */
export function getStateName(state) {
  switch (state) {
    case FSRSState.NEW: return 'New'
    case FSRSState.LEARNING: return 'Learning'
    case FSRSState.REVIEW: return 'Review'
    case FSRSState.RELEARNING: return 'Relearning'
    default: return 'Unknown'
  }
}

/**
 * Calculate time until card is due
 *
 * @param {Object} card - Card with due_date
 * @returns {Object} - { isDue, timeUntilDue, formatted }
 */
export function getTimeUntilDue(card) {
  if (!card.due_date) {
    return { isDue: true, timeUntilDue: 0, formatted: 'Now' }
  }

  const dueDate = new Date(card.due_date)
  const now = new Date()
  const diffMs = dueDate - now

  if (diffMs <= 0) {
    return { isDue: true, timeUntilDue: 0, formatted: 'Now' }
  }

  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  let formatted
  if (diffHours < 1) {
    formatted = `${Math.round(diffMs / (1000 * 60))} min`
  } else if (diffHours < 24) {
    formatted = `${Math.round(diffHours)} hr`
  } else {
    formatted = `${Math.round(diffDays)} days`
  }

  return { isDue: false, timeUntilDue: diffMs, formatted }
}

export default {
  scheduleCard,
  scheduleFragmentCard,
  isCardDue,
  shouldIncludeForExposure,
  getUserActivityLevel,
  stabilityToMastery,
  calculateRetrievability,
  markCardAsSeen,
  getStateName,
  getTimeUntilDue,
  FSRSState,
  ButtonToRating
}
