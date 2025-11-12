import { calculateCurrentHealth } from './healthCalculations'

/**
 * Calculate priority score for a word
 * Higher score = more likely to be selected for review
 *
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
