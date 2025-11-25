/**
 * Mastery-level based intervals for SRS
 * Used by Easy (optimal SRS) and Medium (reinforcement)
 */

// Easy intervals - optimal spaced repetition based on mastery level
const EASY_INTERVALS = {
  0: 1,    // Level 0 (0-9)
  1: 2,    // Level 1 (10-19)
  2: 4,    // Level 2 (20-29)
  3: 7,    // Level 3 (30-39)
  4: 14,   // Level 4 (40-49)
  5: 30,   // Level 5 (50-59)
  6: 60,   // Level 6 (60-69)
  7: 90,   // Level 7 (70-79)
  8: 120,  // Level 8 (80-89)
  9: 180,  // Level 9 (90-94)
  10: 180  // Level 10 (95-100)
}

// Medium intervals - shorter reinforcement intervals
const MEDIUM_INTERVAL_RANGES = {
  0: { min: 1, max: 1 },      // Mastery 0-19
  1: { min: 1, max: 1 },      // Mastery 0-19
  2: { min: 1, max: 2 },      // Mastery 20-39
  3: { min: 1, max: 2 },      // Mastery 20-39
  4: { min: 2, max: 4 },      // Mastery 40-59
  5: { min: 2, max: 4 },      // Mastery 40-59
  6: { min: 5, max: 7 },      // Mastery 60-79
  7: { min: 5, max: 7 },      // Mastery 60-79
  8: { min: 7, max: 10 },     // Mastery 80-100
  9: { min: 7, max: 10 },     // Mastery 80-100
  10: { min: 7, max: 10 }     // Mastery 80-100
}

/**
 * Get mastery level from mastery score
 * @param {number} mastery - Mastery score (0-100)
 * @returns {number} Level (0-10)
 */
function getMasteryLevel(mastery) {
  return Math.floor(Math.min(100, Math.max(0, mastery)) / 10)
}

/**
 * Get next review interval for Easy response (optimal SRS)
 * @param {number} newMastery - Mastery level AFTER the +10 increase
 * @returns {number} Days until next review
 */
export function getEasyInterval(newMastery) {
  const level = getMasteryLevel(newMastery)
  return EASY_INTERVALS[level]
}

/**
 * Get next review interval for Medium response (reinforcement)
 * @param {number} currentMastery - Current mastery level (no change for Medium)
 * @returns {number} Days until next review (randomized within range)
 */
export function getMediumInterval(currentMastery) {
  const level = getMasteryLevel(currentMastery)
  const range = MEDIUM_INTERVAL_RANGES[level]
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
}

/**
 * Get next review interval for Hard response (fixed practice)
 * @returns {number} Always 1 day
 */
export function getHardInterval() {
  return 1
}

/**
 * Get next review interval for Don't Know (uses Medium intervals)
 * @param {number} newMastery - Mastery AFTER the -15 decrease
 * @returns {number} Days until next review
 */
export function getDontKnowInterval(newMastery) {
  // Uses same logic as Medium
  return getMediumInterval(newMastery)
}
