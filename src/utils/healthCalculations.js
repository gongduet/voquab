/**
 * Health decay rates by mastery level (points per day)
 * Higher mastery = slower decay = less frequent reviews needed
 */
export const HEALTH_DECAY_RATES = {
  0: 25,   // Level 0 (0-9 mastery): Decays 25 points/day = critical in 4 days
  1: 20,   // Level 1 (10-19 mastery): Decays 20 points/day = critical in 5 days
  2: 12,   // Level 2 (20-29 mastery): Decays 12 points/day = critical in 8 days
  3: 8,    // Level 3 (30-39 mastery): Decays 8 points/day = critical in 12 days
  4: 5,    // Level 4 (40-49 mastery): Decays 5 points/day = critical in 16 days
  5: 3,    // Level 5 (50-59 mastery): Decays 3 points/day = critical in 26 days
  6: 2,    // Level 6 (60-69 mastery): Decays 2 points/day = critical in 40 days
  7: 1.5,  // Level 7 (70-79 mastery): Decays 1.5 points/day = critical in 53 days
  8: 1,    // Level 8 (80-89 mastery): Decays 1 point/day = critical in 80 days
  9: 0.7,  // Level 9 (90-94 mastery): Decays 0.7 points/day = critical in 114 days
  10: 0.5  // Level 10 (95-100 mastery): Decays 0.5 points/day = critical in 160 days
}

/**
 * Calculate current health based on time since last review
 * Health decays over time - the longer since review, the lower the health
 *
 * @param {Object} word - Word object with mastery_level, health, last_reviewed_at
 * @returns {Object} - { health, status, daysSinceReview, decayRate }
 */
export function calculateCurrentHealth(word) {
  if (!word.last_reviewed_at) {
    // Never reviewed - return stored health (should be 100)
    return {
      health: word.health || 100,
      status: getHealthStatus(word.health || 100),
      daysSinceReview: 0,
      decayRate: 0
    }
  }

  const now = new Date()
  const lastReview = new Date(word.last_reviewed_at)
  const daysSinceReview = (now - lastReview) / (1000 * 60 * 60 * 24)

  // Determine mastery level (0-10)
  const currentLevel = Math.floor((word.mastery_level || 0) / 10)
  const decayRate = HEALTH_DECAY_RATES[currentLevel]

  // Calculate decayed health
  const health = Math.max(0, (word.health || 100) - (daysSinceReview * decayRate))

  return {
    health: Math.round(health),
    status: getHealthStatus(health),
    daysSinceReview: Math.round(daysSinceReview * 10) / 10, // Round to 1 decimal
    decayRate: decayRate
  }
}

/**
 * Get health status category
 * @param {number} health - Current health (0-100)
 * @returns {string} - CRITICAL/LOW/MEDIUM/GOOD/EXCELLENT
 */
export function getHealthStatus(health) {
  if (health < 20) return 'CRITICAL'
  if (health < 40) return 'LOW'
  if (health < 60) return 'MEDIUM'
  if (health < 80) return 'GOOD'
  return 'EXCELLENT'
}

/**
 * Calculate health boost based on user response
 * @param {string} difficulty - 'dont-know'|'hard'|'medium'|'easy'
 * @returns {number} - Health points to add
 */
export function getHealthBoost(difficulty) {
  const boosts = {
    'dont-know': 10,   // Small boost - they're struggling
    'hard': 30,        // Moderate boost
    'medium': 60,      // Good boost
    'easy': 100        // Full restoration
  }
  return boosts[difficulty] || 0
}

/**
 * Apply health boost and clamp to 0-100
 * @param {number} currentHealth - Current health value
 * @param {number} boost - Health boost amount
 * @returns {number} - New health value (0-100)
 */
export function applyHealthBoost(currentHealth, boost) {
  return Math.min(100, Math.max(0, currentHealth + boost))
}
