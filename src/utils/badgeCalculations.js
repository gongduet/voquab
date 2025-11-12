/**
 * Badge Calculations Utility
 * Defines badges and checks eligibility
 */

// Badge definitions from Algorithm Bible
export const BADGE_DEFINITIONS = {
  // COMPLETION BADGES
  foundation_complete: {
    id: 'foundation_complete',
    name: 'Consistent Learner',
    description: 'Complete a Foundation package (50 words)',
    icon: '🥉',
    tier: 'bronze',
    category: 'completion'
  },
  standard_complete: {
    id: 'standard_complete',
    name: 'Dedicated Student',
    description: 'Complete a Standard package (100 words)',
    icon: '🥈',
    tier: 'silver',
    category: 'completion'
  },
  immersion_complete: {
    id: 'immersion_complete',
    name: 'Language Champion',
    description: 'Complete an Immersion package (150 words)',
    icon: '🥇',
    tier: 'gold',
    category: 'completion'
  },
  mastery_complete: {
    id: 'mastery_complete',
    name: 'Elite Polyglot',
    description: 'Complete a Mastery package (250 words)',
    icon: '💎',
    tier: 'diamond',
    category: 'completion'
  },

  // STREAK BADGES
  week_warrior: {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    tier: 'bronze',
    category: 'streak'
  },
  month_master: {
    id: 'month_master',
    name: 'Month Master',
    description: 'Maintain a 30-day learning streak',
    icon: '🔥',
    tier: 'silver',
    category: 'streak'
  },
  century_scholar: {
    id: 'century_scholar',
    name: 'Century Scholar',
    description: 'Maintain a 100-day learning streak',
    icon: '🔥',
    tier: 'gold',
    category: 'streak'
  },

  // ACHIEVEMENT BADGES
  perfectionist: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete a package with 95%+ accuracy',
    icon: '🎯',
    tier: 'gold',
    category: 'achievement'
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a package after 10 PM',
    icon: '🌙',
    tier: 'bronze',
    category: 'achievement'
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a package before 7 AM',
    icon: '🌅',
    tier: 'bronze',
    category: 'achievement'
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 150 words in under 45 minutes',
    icon: '⚡',
    tier: 'silver',
    category: 'achievement'
  },

  // MILESTONE BADGES
  words_1000: {
    id: 'words_1000',
    name: '1,000 Words',
    description: 'Review 1,000 total words',
    icon: '📖',
    tier: 'bronze',
    category: 'milestone'
  },
  words_5000: {
    id: 'words_5000',
    name: '5,000 Words',
    description: 'Review 5,000 total words',
    icon: '📚',
    tier: 'silver',
    category: 'milestone'
  },
  words_10000: {
    id: 'words_10000',
    name: '10,000 Words',
    description: 'Review 10,000 total words',
    icon: '📕',
    tier: 'gold',
    category: 'milestone'
  },
  words_50000: {
    id: 'words_50000',
    name: '50,000 Words',
    description: 'Review 50,000 total words',
    icon: '🏆',
    tier: 'diamond',
    category: 'milestone'
  }
}

/**
 * Check which badges should be awarded on package completion
 */
export function checkBadgesOnPackageComplete(package_, userStats) {
  const badges = []
  const completedAt = new Date(package_.completed_at)
  const hours = completedAt.getHours()

  // Completion badges
  const packageBadgeMap = {
    foundation: 'foundation_complete',
    standard: 'standard_complete',
    immersion: 'immersion_complete',
    mastery: 'mastery_complete'
  }

  const completionBadge = packageBadgeMap[package_.package_type]
  if (completionBadge) {
    badges.push(BADGE_DEFINITIONS[completionBadge])
  }

  // Achievement badges
  const accuracy = calculatePackageAccuracy(package_)
  if (accuracy >= 95) {
    badges.push(BADGE_DEFINITIONS.perfectionist)
  }

  // Time-based achievements
  if (hours >= 22 || hours < 4) {
    // After 10 PM or before 4 AM
    badges.push(BADGE_DEFINITIONS.night_owl)
  }

  if (hours >= 4 && hours < 7) {
    // 4 AM - 7 AM
    badges.push(BADGE_DEFINITIONS.early_bird)
  }

  // Speed demon
  if (
    package_.total_words >= 150 &&
    package_.actual_minutes &&
    package_.actual_minutes < 45
  ) {
    badges.push(BADGE_DEFINITIONS.speed_demon)
  }

  // Milestone badges
  const totalReviews = userStats.total_words_reviewed || 0
  if (totalReviews >= 50000 && totalReviews < 50000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_50000)
  } else if (totalReviews >= 10000 && totalReviews < 10000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_10000)
  } else if (totalReviews >= 5000 && totalReviews < 5000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_5000)
  } else if (totalReviews >= 1000 && totalReviews < 1000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_1000)
  }

  return badges
}

/**
 * Check streak badges
 */
export function checkStreakBadges(currentStreak) {
  const badges = []

  if (currentStreak >= 100) {
    badges.push(BADGE_DEFINITIONS.century_scholar)
  } else if (currentStreak >= 30) {
    badges.push(BADGE_DEFINITIONS.month_master)
  } else if (currentStreak >= 7) {
    badges.push(BADGE_DEFINITIONS.week_warrior)
  }

  return badges
}

// Helper
function calculatePackageAccuracy(package_) {
  const total =
    package_.dont_know_count +
    package_.hard_count +
    package_.medium_count +
    package_.easy_count

  if (total === 0) return 0

  const correct = package_.hard_count + package_.medium_count + package_.easy_count
  return Math.round((correct / total) * 100)
}
