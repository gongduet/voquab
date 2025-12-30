/**
 * FSRS Configuration
 *
 * These values can be tuned to adjust spaced repetition behavior.
 * Future: Move to database + admin UI for runtime configuration.
 */

export const FSRS_CONFIG = {
  // Higher retention = see cards more often (0.90 default, 0.94 conservative)
  REQUEST_RETENTION: 0.94,

  // Maximum days before seeing a "Hard" card again (training wheels)
  HARD_INTERVAL_CAP_DAYS: 5,

  // Add randomness to intervals to prevent clustering
  ENABLE_FUZZ: true
}
