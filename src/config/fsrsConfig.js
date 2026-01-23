/**
 * FSRS Configuration
 *
 * These values can be tuned to adjust spaced repetition behavior.
 * Future: Move to database + admin UI for runtime configuration.
 */

export const FSRS_CONFIG = {
  // Higher retention = see cards more often (0.90 default, 0.94 conservative)
  REQUEST_RETENTION: 0.94,

  // Fragment retention - lower = longer intervals between reviews
  // Fragments are a stepping stone to reading, not a primary study activity
  // 0.80 retention results in ~14-21 day intervals for "Good" vs ~7 days for words
  FRAGMENT_REQUEST_RETENTION: 0.80,

  // Maximum days before seeing a "Hard" card again (training wheels)
  HARD_INTERVAL_CAP_DAYS: 5,

  // Add randomness to intervals to prevent clustering
  ENABLE_FUZZ: true
}
