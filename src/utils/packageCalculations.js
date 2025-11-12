/**
 * Package Calculations Utility
 * Handles package composition, selection, and management
 */

import { calculateCurrentHealth } from './healthCalculations'
import { calculatePriorityScore } from './priorityCalculations'

// Package definitions from Algorithm Bible
export const PACKAGE_TYPES = {
  foundation: {
    name: 'Foundation',
    words: 50,
    estimatedMinutes: { min: 15, max: 20 },
    badge: '🥉',
    badgeName: 'Consistent Learner',
    description: 'Busy days, maintain progress',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  standard: {
    name: 'Standard',
    words: 100,
    estimatedMinutes: { min: 30, max: 40 },
    badge: '🥈',
    badgeName: 'Dedicated Student',
    description: 'Balanced learning',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  immersion: {
    name: 'Immersion',
    words: 150,
    estimatedMinutes: { min: 45, max: 60 },
    badge: '🥇',
    badgeName: 'Language Champion',
    description: 'Rapid advancement',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  mastery: {
    name: 'Mastery',
    words: 250,
    estimatedMinutes: { min: 75, max: 100 },
    badge: '💎',
    badgeName: 'Elite Polyglot',
    description: 'Maximum progress',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  getting_started: {
    name: 'Getting Started',
    words: 30,
    estimatedMinutes: { min: 10, max: 15 },
    badge: '🌱',
    badgeName: 'First Steps',
    description: 'Learn the most essential words',
    composition: {
      // Special beginner package - all new words from chapter 1
      new: 1.0
    }
  }
}

// REMOVED: MAX_NEW_WORDS_PER_PACKAGE hard limits
// Dynamic composition will determine new word counts based on user state

/**
 * Analyze user's current vocabulary state
 * @param {Array} userWords - User's existing vocabulary progress records
 * @param {number} totalAvailableWords - Total words in vocabulary table
 * @returns {Object} User state metrics
 */
export function analyzeUserVocabularyState(userWords, totalAvailableWords) {
  const criticalCount = userWords.filter(w => {
    const health = calculateCurrentHealth(w).health
    return health < 20
  }).length

  const masteryReadyCount = userWords.filter(w => {
    if (w.mastery_level >= 100 || (w.total_reviews || 0) === 0) return false

    const hoursSinceCorrect = w.last_correct_review_at
      ? (new Date() - new Date(w.last_correct_review_at)) / (1000 * 60 * 60)
      : 999999

    const currentLevel = Math.floor((w.mastery_level || 0) / 10)
    const TIME_GATES = {
      0: 0, 1: 4, 2: 12, 3: 24, 4: 72, 5: 168,
      6: 336, 7: 720, 8: 1440, 9: 2880, 10: 4320
    }
    const requiredHours = TIME_GATES[currentLevel] || 0
    return hoursSinceCorrect >= requiredHours
  }).length

  const reviewOnlyWords = userWords.filter(w => {
    const reviews = w.total_reviews || 0
    return reviews > 0 && reviews <= 10
  }).length

  const totalUserWords = userWords.length
  const newWordsAvailable = Math.max(0, totalAvailableWords - totalUserWords)

  return {
    criticalCount,
    masteryReadyCount,
    reviewOnlyWords,
    totalUserWords,
    totalAvailableWords,
    newWordsAvailable
  }
}

/**
 * Calculate optimal composition based on user's current state
 * @param {Object} userState - From analyzeUserVocabularyState()
 * @param {number} packageSize - Number of words in package
 * @returns {Object} Composition percentages
 */
export function calculateOptimalComposition(userState, packageSize) {
  const { criticalCount, masteryReadyCount, newWordsAvailable } = userState

  let composition = {}
  let rationale = ''

  // SCENARIO 1: Too many struggling words - focus on rescue
  if (criticalCount > packageSize * 0.3) {
    composition = { critical: 0.40, mastery_ready: 0.20, exposure: 0.20, new: 0.20 }
    rationale = 'High critical word count - focusing on rescue while maintaining some growth'
  }
  // SCENARIO 2: Healthy state + many new words - AGGRESSIVE expansion
  else if (criticalCount < 10 && masteryReadyCount < 10 && newWordsAvailable > 100) {
    composition = { critical: 0.15, mastery_ready: 0.15, exposure: 0.20, new: 0.50 }
    rationale = 'Healthy vocabulary state - aggressive expansion mode'
  }
  // SCENARIO 3: Many new words available - balanced growth
  else if (newWordsAvailable > 200) {
    composition = { critical: 0.20, mastery_ready: 0.20, exposure: 0.20, new: 0.40 }
    rationale = 'Large vocabulary available - balanced growth strategy'
  }
  // SCENARIO 4: Moderate new words - steady expansion
  else if (newWordsAvailable > 50) {
    composition = { critical: 0.25, mastery_ready: 0.20, exposure: 0.25, new: 0.30 }
    rationale = 'Moderate vocabulary available - steady expansion'
  }
  // SCENARIO 5: Few new words left - focus on mastery
  else if (newWordsAvailable < 50) {
    composition = { critical: 0.30, mastery_ready: 0.35, exposure: 0.35, new: 0.00 }
    rationale = 'Limited new words - focusing on mastery progression'
  }
  // DEFAULT: Balanced approach
  else {
    composition = { critical: 0.25, mastery_ready: 0.25, exposure: 0.25, new: 0.25 }
    rationale = 'Balanced learning approach'
  }

  return {
    composition,
    rationale
  }
}

/**
 * Select words for a package using priority scoring with dynamic composition
 * @param {Array} allUserWords - All user vocabulary progress records
 * @param {string} packageType - 'foundation' | 'standard' | 'immersion' | 'mastery'
 * @param {number} totalAvailableWords - Total words in vocabulary table
 * @param {Object} options - Additional options (chapterFocus, focusChapterId)
 * @returns {Object} - Selected words categorized and ordered
 */
export function selectWordsForPackage(allUserWords, packageType, totalAvailableWords, options = {}) {
  const packageConfig = PACKAGE_TYPES[packageType]
  const totalWords = packageConfig.words

  // STEP 1: Analyze user's vocabulary state
  const userState = analyzeUserVocabularyState(allUserWords, totalAvailableWords)

  // STEP 2: Calculate optimal composition dynamically
  const { composition, rationale } = calculateOptimalComposition(userState, totalWords)

  // STEP 3: Log composition decision for debugging
  console.log('📊 Package Composition Decision:')
  console.log('   Package:', packageConfig.name, `(${totalWords} words)`)
  console.log('   User State:', {
    total: userState.totalUserWords,
    critical: userState.criticalCount,
    masteryReady: userState.masteryReadyCount,
    newAvailable: userState.newWordsAvailable
  })
  console.log('   Composition:', {
    critical: `${Math.round(composition.critical * 100)}%`,
    mastery: `${Math.round(composition.mastery_ready * 100)}%`,
    exposure: `${Math.round(composition.exposure * 100)}%`,
    new: `${Math.round(composition.new * 100)}%`
  })
  console.log('   Strategy:', rationale)

  // Calculate target counts for each category
  const targets = {
    critical: Math.round(totalWords * composition.critical),
    mastery_ready: Math.round(totalWords * composition.mastery_ready),
    exposure: Math.round(totalWords * composition.exposure),
    new: Math.round(totalWords * composition.new)
  }

  console.log('   Target Counts:', targets)

  // Categorize all words
  const categorized = {
    critical: [],
    mastery_ready: [],
    exposure: [],
    new: [],
    other: []
  }

  allUserWords.forEach(word => {
    const currentHealthData = calculateCurrentHealth(word)
    const priorityData = calculatePriorityScore(word, options)

    const enrichedWord = {
      ...word,
      currentHealth: currentHealthData.health,
      priorityScore: priorityData.totalScore
    }

    // Categorize based on current state
    if (currentHealthData.health < 20) {
      // Critical health - needs immediate attention
      categorized.critical.push(enrichedWord)
    } else if (word.mastery_level < 100 && (word.total_reviews || 0) > 0) {
      // Has been reviewed before and can still gain mastery
      // Check if time gate met (if last_correct_review_at exists)
      const hoursSinceCorrect = word.last_correct_review_at
        ? (new Date() - new Date(word.last_correct_review_at)) / (1000 * 60 * 60)
        : 999999 // Very high number if never reviewed correctly

      const currentLevel = Math.floor((word.mastery_level || 0) / 10)
      const TIME_GATES = {
        0: 0, 1: 4, 2: 12, 3: 24, 4: 72, 5: 168,
        6: 336, 7: 720, 8: 1440, 9: 2880, 10: 4320
      }
      const requiredHours = TIME_GATES[currentLevel] || 0
      const timeGateMet = hoursSinceCorrect >= requiredHours

      if (timeGateMet) {
        categorized.mastery_ready.push(enrichedWord)
      } else {
        categorized.other.push(enrichedWord)
      }
    } else if ((word.total_reviews || 0) > 0 && (word.total_reviews || 0) < 10) {
      // Needs more exposure (1-9 reviews)
      categorized.exposure.push(enrichedWord)
    } else if ((word.total_reviews || 0) === 0) {
      // Brand new word
      categorized.new.push(enrichedWord)
    } else {
      // Everything else
      categorized.other.push(enrichedWord)
    }
  })

  // Sort each category by priority score (highest first)
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => b.priorityScore - a.priorityScore)
  })

  // Select words from each category
  const selected = {
    critical: [],
    mastery_ready: [],
    exposure: [],
    new: []
  }

  // Fill critical words
  selected.critical = categorized.critical.slice(0, targets.critical)

  // Fill mastery-ready words
  selected.mastery_ready = categorized.mastery_ready.slice(0, targets.mastery_ready)

  // Fill exposure words (exclude brand new words)
  selected.exposure = categorized.exposure
    .filter(w => (w.total_reviews || 0) > 0)
    .slice(0, targets.exposure)

  // Fill new words
  selected.new = categorized.new.slice(0, targets.new)

  // Calculate how many words we have so far
  const currentTotal =
    selected.critical.length +
    selected.mastery_ready.length +
    selected.exposure.length +
    selected.new.length

  // Fill remaining slots - prioritize NEW words first, then other
  if (currentTotal < totalWords) {
    const remaining = totalWords - currentTotal
    console.log(`   Filling ${remaining} remaining slots...`)

    // Try to fill with new words first (vocabulary expansion!)
    const additionalNewWords = categorized.new
      .slice(selected.new.length) // Get new words not yet selected
      .slice(0, remaining)

    selected.new = [...selected.new, ...additionalNewWords]

    // If still need more, use 'other' category
    const stillRemaining = totalWords - (
      selected.critical.length +
      selected.mastery_ready.length +
      selected.exposure.length +
      selected.new.length
    )

    if (stillRemaining > 0) {
      const fillWords = categorized.other.slice(0, stillRemaining)
      selected.exposure = [...selected.exposure, ...fillWords]
    }

    console.log(`   Added ${additionalNewWords.length} more new words from remaining slots`)
  }

  // Flatten and tag with category
  const allSelected = [
    ...selected.critical.map(w => ({ ...w, category: 'critical' })),
    ...selected.mastery_ready.map(w => ({ ...w, category: 'mastery_ready' })),
    ...selected.exposure.map(w => ({ ...w, category: 'exposure' })),
    ...selected.new.map(w => ({ ...w, category: 'new' }))
  ]

  // Shuffle to avoid predictable patterns
  const shuffled = shuffleArray(allSelected)

  // Add order
  const ordered = shuffled.map((word, index) => ({
    ...word,
    word_order: index + 1
  }))

  // Log final breakdown
  const finalBreakdown = {
    total: ordered.length,
    critical: selected.critical.length,
    mastery_ready: selected.mastery_ready.length,
    exposure: selected.exposure.length,
    new: selected.new.length
  }

  console.log('✅ Final Package Breakdown:', finalBreakdown)
  console.log(`   🆕 NEW WORDS: ${finalBreakdown.new} (${Math.round(finalBreakdown.new / finalBreakdown.total * 100)}%)`)

  return {
    words: ordered,
    breakdown: finalBreakdown,
    metadata: {
      packageType,
      estimatedMinutes: packageConfig.estimatedMinutes,
      averagePriority: calculateAverage(ordered.map(w => w.priorityScore)),
      compositionStrategy: rationale,
      userState: userState
    }
  }
}

/**
 * Check if package has expired (24 hours)
 */
export function isPackageExpired(package_) {
  const now = new Date()
  const expiresAt = new Date(package_.expires_at)
  return now > expiresAt && package_.status === 'active'
}

/**
 * Calculate package progress percentage
 */
export function calculatePackageProgress(package_) {
  if (package_.total_words === 0) return 0
  return Math.round((package_.words_completed / package_.total_words) * 100)
}

/**
 * Calculate accuracy from package performance
 */
export function calculatePackageAccuracy(package_) {
  const total =
    package_.dont_know_count +
    package_.hard_count +
    package_.medium_count +
    package_.easy_count

  if (total === 0) return 0

  const correct = package_.hard_count + package_.medium_count + package_.easy_count
  return Math.round((correct / total) * 100)
}

/**
 * Determine if streak should be maintained
 * Requires completing at least Foundation 50 equivalent
 */
export function shouldMaintainStreak(package_) {
  return package_.words_completed >= 50 && package_.status === 'completed'
}

/**
 * Get recommended package based on user history
 */
export function getRecommendedPackage(userStats, availableWords) {
  // Check user's recent patterns
  const recentAverage = userStats.recent_daily_average || 100

  // Check available critical words
  const criticalCount = availableWords.filter(w => w.currentHealth < 20).length

  // Default to Standard
  let recommended = 'standard'

  // Adjust based on critical words
  if (criticalCount > 100) {
    recommended = 'immersion' // Need more time for critical words
  } else if (criticalCount > 50) {
    recommended = 'standard'
  } else if (criticalCount < 20) {
    recommended = 'foundation' // Maintenance mode
  }

  // Consider user's typical commitment
  if (recentAverage >= 150) {
    recommended = 'immersion'
  } else if (recentAverage >= 100) {
    recommended = 'standard'
  } else if (recentAverage >= 50) {
    recommended = 'foundation'
  }

  return recommended
}

// Helper functions
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length)
}

/**
 * Generate waypoints for a package
 * Groups words by category into themed waypoints
 * @param {Array} packageWords - Selected words with category tags
 * @param {string} packageType - Package type (foundation/standard/etc)
 * @returns {Array} Array of waypoint objects
 */
export function generateWaypoints(packageWords, packageType) {
  // Group words by category
  const categorized = {
    critical: packageWords.filter(w => w.category === 'critical'),
    mastery_ready: packageWords.filter(w => w.category === 'mastery_ready'),
    exposure: packageWords.filter(w => w.category === 'exposure'),
    new: packageWords.filter(w => w.category === 'new')
  }

  // Waypoint themes configuration
  const waypointThemes = {
    critical: {
      name: 'Critical Rescue',
      icon: '🚨',
      description: 'Words that need urgent attention to prevent forgetting'
    },
    mastery_ready: {
      name: 'Level-Up Zone',
      icon: '⭐',
      description: 'Words ready to advance to the next mastery level'
    },
    exposure: {
      name: 'Building Exposure',
      icon: '🔄',
      description: 'Words being reinforced through repeated practice'
    },
    new: {
      name: 'New Territory',
      icon: '🆕',
      description: 'Brand new words being introduced for the first time'
    }
  }

  const waypoints = []
  let waypointNumber = 1

  // Create waypoints for each category that has words
  const categoryOrder = ['critical', 'new', 'mastery_ready', 'exposure']

  categoryOrder.forEach(category => {
    const words = categorized[category]

    if (words.length > 0) {
      const theme = waypointThemes[category]

      waypoints.push({
        waypoint_number: waypointNumber++,
        theme: category,
        name: theme.name,
        description: theme.description,
        icon: theme.icon,
        total_words: words.length,
        words_completed: 0,
        word_ids: words.map(w => w.vocab_id),
        status: waypointNumber === 2 ? 'active' : 'pending' // First waypoint is active
      })
    }
  })

  // If no waypoints were created (shouldn't happen), create a default one
  if (waypoints.length === 0) {
    waypoints.push({
      waypoint_number: 1,
      theme: 'exposure',
      name: 'Practice Session',
      description: 'Review and practice your vocabulary',
      icon: '📚',
      total_words: packageWords.length,
      words_completed: 0,
      word_ids: packageWords.map(w => w.vocab_id),
      status: 'active'
    })
  }

  return waypoints
}
