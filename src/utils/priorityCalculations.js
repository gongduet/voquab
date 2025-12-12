import { calculateCurrentHealth } from './healthCalculations'

/**
 * @deprecated This file is deprecated as of December 2025.
 * FSRS algorithm now handles card scheduling via fsrsService.js and sessionBuilder.js.
 * Kept for backward compatibility - will be removed in future release.
 */

/**
 * Calculate priority score for a word
 * Higher score = more likely to be selected for review
 *
 * @deprecated Use isCardDue() from fsrsService.js instead
 * @param {Object} word - Word with progress data and vocabulary metadata
 * @param {Object} options - { chapterFocus: boolean, focusChapterId: uuid }
 * @returns {Object} - { totalScore, breakdown, currentHealth, status }
 */
export function calculatePriorityScore(word, options = {}) {
  const currentHealth = calculateCurrentHealth(word)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)

  let score = 0
  const breakdown = {}

  // COMPONENT 1: Health Urgency (0-50 points) - 35% weight
  // Lower health = higher urgency = higher score
  const healthScore = (100 - currentHealth.health) * 0.5
  score += healthScore
  breakdown.health = Math.round(healthScore)

  // COMPONENT 2: Frequency in Book (0-30 points) - 30% weight
  // More frequent words are more important to learn
  const timesInBook = word.vocabulary?.times_in_book || word.times_in_book || 1
  const frequencyScore = Math.min(30, timesInBook * 0.6)
  score += frequencyScore
  breakdown.frequency = Math.round(frequencyScore)

  // COMPONENT 3: Chapter Position (0-15 points) - 15% weight
  // Earlier chapters = foundational vocabulary = higher priority
  const chapterNumber = word.vocabulary?.chapters?.chapter_number ||
                        word.chapter_number ||
                        999
  let chapterScore = 5 // Default for unknown chapters
  if (chapterNumber <= 3) chapterScore = 15
  else if (chapterNumber <= 5) chapterScore = 10
  score += chapterScore
  breakdown.chapter = chapterScore

  // COMPONENT 4: Mastery Readiness (0-10 points) - 10% weight
  // Can they gain mastery points right now? (Phase 2 will enforce time gates)
  // For now, just check if they have mastery < 100
  const masteryReady = (word.mastery_level || 0) < 100 ? 10 : 0
  score += masteryReady
  breakdown.masteryReady = masteryReady

  // COMPONENT 5: Chapter Focus Bonus (0-10 points) - 10% weight
  // If user has chapter focus mode enabled, boost current chapter words
  if (options.chapterFocus && word.chapter_id === options.focusChapterId) {
    score += 10
    breakdown.chapterFocus = 10
  } else {
    breakdown.chapterFocus = 0
  }

  // MULTIPLIER 1: Critical Health (×1.5)
  // Critical words get 50% priority boost
  if (currentHealth.health < 20) {
    score *= 1.5
    breakdown.criticalMultiplier = 1.5
  } else {
    breakdown.criticalMultiplier = 1.0
  }

  // MULTIPLIER 2: Leech/Struggling Word (×1.3)
  // Words marked "Don't Know" recently get attention boost
  if (word.failed_in_last_3_sessions) {
    score *= 1.3
    breakdown.leechMultiplier = 1.3
  } else {
    breakdown.leechMultiplier = 1.0
  }

  // MULTIPLIER 3: New Word Bonus (×1.1)
  // Brand new words get a BONUS to encourage vocabulary expansion
  // Learning new words is the primary goal!
  if ((word.total_reviews || 0) === 0) {
    score *= 1.1
    breakdown.newWordBonus = 1.1
  } else {
    breakdown.newWordBonus = 1.0
  }

  return {
    totalScore: Math.round(score),
    breakdown: breakdown,
    currentHealth: currentHealth.health,
    status: currentHealth.status,
    healthInfo: currentHealth
  }
}

/**
 * Select cards for review session using priority scoring
 * Replaces random selection with intelligent prioritization
 *
 * @param {Array} words - Array of word objects with progress data
 * @param {number} count - Number of cards to select
 * @param {Object} options - { chapterFocus, focusChapterId }
 * @returns {Object} - { cards, stats }
 */
export function selectCardsForSession(words, count = 25, options = {}) {
  // Calculate priority scores for all words
  const scoredWords = words.map(word => ({
    ...word,
    priority: calculatePriorityScore(word, options)
  }))

  // Sort by priority score (highest first)
  scoredWords.sort((a, b) => b.priority.totalScore - a.priority.totalScore)

  // Select top N cards
  const selectedCards = scoredWords.slice(0, count)

  // LOG SELECTION RATIONALE FOR TOP 10 CARDS
  console.log('\n📊 WORD SELECTION RATIONALE (Top 10):')
  console.log('=' .repeat(60))
  selectedCards.slice(0, 10).forEach((card, index) => {
    const reason = getSelectionReason(card)
    console.log(`${index + 1}. "${card.lemma}" (Priority: ${card.priority.totalScore})`)
    console.log(`   ${reason.icon} ${reason.text}`)
    console.log(`   Health: ${card.priority.currentHealth}/100 | Mastery: ${card.mastery_level || 0}/100 | Reviews: ${card.total_reviews || 0}`)
    console.log('')
  })
  console.log('=' .repeat(60))

  // Shuffle to avoid predictability in card order
  // (User shouldn't know "first 7 cards are always critical")
  const shuffled = shuffleArray(selectedCards)

  // Calculate session statistics
  const stats = {
    totalAvailable: words.length,
    selected: shuffled.length,
    critical: shuffled.filter(c => c.priority.currentHealth < 20).length,
    low: shuffled.filter(c => c.priority.currentHealth >= 20 && c.priority.currentHealth < 40).length,
    medium: shuffled.filter(c => c.priority.currentHealth >= 40 && c.priority.currentHealth < 60).length,
    good: shuffled.filter(c => c.priority.currentHealth >= 60).length,
    new: shuffled.filter(c => (c.total_reviews || 0) === 0).length,
    avgPriority: Math.round(shuffled.reduce((sum, c) => sum + c.priority.totalScore, 0) / shuffled.length)
  }

  return {
    cards: shuffled,
    stats: stats
  }
}

/**
 * Get human-readable reason for why a word was selected
 * @param {Object} card - Card with priority data
 * @returns {Object} - { icon, text }
 */
function getSelectionReason(card) {
  const health = card.priority.currentHealth
  const mastery = card.mastery_level || 0
  const reviews = card.total_reviews || 0
  const breakdown = card.priority.breakdown

  // Determine primary reason for selection
  if (reviews === 0) {
    return {
      icon: '🆕',
      text: 'New word - First encounter to establish baseline'
    }
  }

  if (health < 20) {
    return {
      icon: '⚡',
      text: `URGENT - Critical health (${Math.round(health)}/100), needs immediate rescue`
    }
  }

  if (breakdown.criticalMultiplier === 1.5) {
    return {
      icon: '🚨',
      text: `Critical health (<20), boosted priority by 50%`
    }
  }

  if (breakdown.leechMultiplier === 1.3) {
    return {
      icon: '🔁',
      text: `Struggling word - Failed in recent sessions, needs extra attention`
    }
  }

  if (breakdown.masteryReady > 0) {
    return {
      icon: '🎯',
      text: `Mastery ready - Can gain progress toward next level`
    }
  }

  if (health < 40) {
    return {
      icon: '💊',
      text: `Low health (${Math.round(health)}/100), needs restoration`
    }
  }

  if (breakdown.frequency > 15) {
    return {
      icon: '📖',
      text: `High-frequency word (appears ${card.times_in_book || 1}× in book), important to master`
    }
  }

  if (breakdown.chapter >= 10) {
    return {
      icon: '📚',
      text: `Early chapter word (Ch ${card.chapter_number || '?'}), foundational vocabulary`
    }
  }

  return {
    icon: '🔄',
    text: `Maintenance review - Keep skills sharp (Health: ${Math.round(health)}, Mastery: ${mastery})`
  }
}

/**
 * Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle (modifies in place)
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
