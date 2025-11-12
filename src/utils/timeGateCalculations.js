/**
 * Time gate requirements for each mastery level (in hours)
 * These enforce spaced repetition - higher levels = longer waits
 */
export const TIME_GATES = {
  0: 0,        // Level 0 (0-9 mastery): No gate (new word)
  1: 4,        // Level 1 (10-19 mastery): 4 hours
  2: 12,       // Level 2 (20-29 mastery): 12 hours
  3: 24,       // Level 3 (30-39 mastery): 1 day
  4: 72,       // Level 4 (40-49 mastery): 3 days
  5: 168,      // Level 5 (50-59 mastery): 7 days
  6: 336,      // Level 6 (60-69 mastery): 14 days
  7: 720,      // Level 7 (70-79 mastery): 30 days
  8: 1440,     // Level 8 (80-89 mastery): 60 days
  9: 2880,     // Level 9 (90-94 mastery): 120 days
  10: 4320     // Level 10 (95-100 mastery): 180 days
}

/**
 * Check if user can gain mastery points right now
 *
 * @param {Object} word - Word with mastery_level and last_correct_review_at
 * @returns {Object} - { canGainMastery, hoursUntilEligible, timeGateHours, message }
 */
export function checkTimeGate(word) {
  // If never reviewed correctly, time gate is automatically met
  if (!word.last_correct_review_at) {
    return {
      canGainMastery: true,
      hoursUntilEligible: 0,
      timeGateHours: 0,
      message: null
    }
  }

  // Determine current mastery level (0-10)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)
  const requiredHours = TIME_GATES[currentLevel]

  // Calculate hours since last correct review
  const now = new Date()
  const lastCorrect = new Date(word.last_correct_review_at)
  const hoursSinceCorrect = (now - lastCorrect) / (1000 * 60 * 60)

  // Check if time gate is met
  const canGainMastery = hoursSinceCorrect >= requiredHours
  const hoursUntilEligible = canGainMastery
    ? 0
    : Math.ceil(requiredHours - hoursSinceCorrect)

  // Generate user-friendly message
  let message = null
  if (!canGainMastery) {
    if (hoursUntilEligible < 1) {
      message = `Wait ${Math.ceil(hoursUntilEligible * 60)} more minutes for mastery credit`
    } else if (hoursUntilEligible === 1) {
      message = `Wait 1 more hour for mastery credit`
    } else if (hoursUntilEligible < 24) {
      message = `Wait ${hoursUntilEligible} more hours for mastery credit`
    } else {
      const days = Math.ceil(hoursUntilEligible / 24)
      message = `Wait ${days} more day${days > 1 ? 's' : ''} for mastery credit`
    }
  }

  return {
    canGainMastery,
    hoursUntilEligible,
    timeGateHours: requiredHours,
    hoursSinceCorrect: Math.round(hoursSinceCorrect * 10) / 10,
    message
  }
}

/**
 * Calculate mastery change with time gate enforcement
 *
 * @param {Object} word - Current word state
 * @param {string} difficulty - 'dont-know'|'hard'|'medium'|'easy'
 * @returns {Object} - { masteryChange, newMastery, timeGateInfo, healthBoost }
 */
export function calculateMasteryChange(word, difficulty) {
  const currentMastery = word.mastery_level || 0

  // Mastery point values
  const masteryPoints = {
    'dont-know': -5,
    'hard': 3,
    'medium': 6,
    'easy': 10
  }

  // "Don't Know" always applies (no time gate check)
  if (difficulty === 'dont-know') {
    const newMastery = Math.max(0, currentMastery - 5)
    return {
      masteryChange: -5,
      newMastery: newMastery,
      timeGateInfo: {
        canGainMastery: true,
        bypassed: true,
        reason: 'Forgetting has no time gate'
      },
      healthBoost: 10
    }
  }

  // Check time gate for correct responses
  const timeGateInfo = checkTimeGate(word)

  // If time gate met, apply mastery change
  if (timeGateInfo.canGainMastery) {
    const masteryChange = masteryPoints[difficulty] || 0
    const newMastery = Math.max(0, Math.min(100, currentMastery + masteryChange))

    return {
      masteryChange,
      newMastery,
      timeGateInfo: {
        ...timeGateInfo,
        applied: true
      },
      healthBoost: getHealthBoost(difficulty)
    }
  }

  // Time gate NOT met - no mastery change, but health still improves
  return {
    masteryChange: 0,
    newMastery: currentMastery, // No change
    timeGateInfo: {
      ...timeGateInfo,
      applied: false,
      blocked: true
    },
    healthBoost: getHealthBoost(difficulty)
  }
}

/**
 * Get health boost by difficulty
 * @param {string} difficulty
 * @returns {number}
 */
function getHealthBoost(difficulty) {
  const boosts = {
    'dont-know': 10,
    'hard': 30,
    'medium': 60,
    'easy': 100
  }
  return boosts[difficulty] || 0
}

/**
 * Format time remaining for display
 * @param {number} hours - Hours until eligible
 * @returns {string} - "2 hours" or "3 days" or "45 minutes"
 */
export function formatTimeRemaining(hours) {
  if (hours < 1) {
    const minutes = Math.ceil(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  } else if (hours < 24) {
    const roundedHours = Math.ceil(hours)
    return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`
  } else {
    const days = Math.ceil(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''}`
  }
}
