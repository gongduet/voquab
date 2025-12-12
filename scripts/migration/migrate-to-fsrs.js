#!/usr/bin/env node

/**
 * FSRS Migration Script
 *
 * Migrates existing user_lemma_progress data from the old mastery/health system
 * to FSRS fields (stability, difficulty, due_date, fsrs_state).
 *
 * IMPORTANT: Test on development database before running on production!
 *
 * Usage:
 *   node scripts/migration/migrate-to-fsrs.js [--dry-run] [--user-id=UUID]
 *
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --user-id    Migrate only a specific user (for testing)
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const userIdArg = args.find(a => a.startsWith('--user-id='))
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null

/**
 * Map old mastery_level (0-100) to FSRS stability (days until 90% recall)
 *
 * Mastery 0-9   → Stability 0.5 days (12 hours)
 * Mastery 10-19 → Stability 1 day
 * Mastery 20-29 → Stability 3 days
 * Mastery 30-39 → Stability 7 days
 * Mastery 40-49 → Stability 14 days
 * Mastery 50-59 → Stability 30 days
 * Mastery 60-69 → Stability 60 days
 * Mastery 70-79 → Stability 90 days
 * Mastery 80-89 → Stability 120 days
 * Mastery 90-100 → Stability 180 days
 */
function masteryToStability(mastery) {
  if (!mastery || mastery < 10) return 0.5
  if (mastery < 20) return 1
  if (mastery < 30) return 3
  if (mastery < 40) return 7
  if (mastery < 50) return 14
  if (mastery < 60) return 30
  if (mastery < 70) return 60
  if (mastery < 80) return 90
  if (mastery < 90) return 120
  return 180
}

/**
 * Map old mastery_level to FSRS difficulty (1-10 scale)
 *
 * Lower mastery + more lapses = higher difficulty
 */
function calculateDifficulty(mastery, totalReviews, correctReviews) {
  const accuracy = totalReviews > 0 ? correctReviews / totalReviews : 0.5

  // Base difficulty from mastery (inverted: higher mastery = lower difficulty)
  let baseDifficulty = 5 // Start at medium
  if (mastery >= 80) baseDifficulty = 3
  else if (mastery >= 60) baseDifficulty = 4
  else if (mastery >= 40) baseDifficulty = 5
  else if (mastery >= 20) baseDifficulty = 6
  else baseDifficulty = 7

  // Adjust based on accuracy
  if (accuracy >= 0.9) baseDifficulty -= 1
  else if (accuracy < 0.5) baseDifficulty += 1

  // Clamp to 1-10
  return Math.max(1, Math.min(10, baseDifficulty))
}

/**
 * Calculate due_date based on stability and last review
 */
function calculateDueDate(stability, lastReviewedAt, health) {
  // If never reviewed, due immediately
  if (!lastReviewedAt) {
    return new Date().toISOString()
  }

  const lastReview = new Date(lastReviewedAt)

  // If health is low (<50), card is due now
  if (health !== null && health < 50) {
    return new Date().toISOString()
  }

  // Calculate due date: last review + stability days
  const dueDate = new Date(lastReview.getTime() + stability * 24 * 60 * 60 * 1000)

  // If due date is in the past, return now
  if (dueDate < new Date()) {
    return new Date().toISOString()
  }

  return dueDate.toISOString()
}

/**
 * Determine FSRS state based on mastery and review history
 * 0 = New, 1 = Learning, 2 = Review, 3 = Relearning
 */
function determineFSRSState(mastery, totalReviews, lapses) {
  // Never reviewed = New
  if (!totalReviews || totalReviews === 0) return 0

  // Recent lapse (failed recently) = Relearning
  // We don't have exact data, so estimate based on mastery
  if (mastery < 20 && totalReviews > 3) return 3

  // Low mastery with some reviews = Learning
  if (mastery < 40) return 1

  // Good mastery = Review
  return 2
}

/**
 * Migrate a single progress record
 */
function migrateRecord(record) {
  const mastery = record.mastery_level || 0
  const health = record.health
  const totalReviews = record.total_reviews || 0
  const correctReviews = record.correct_reviews || 0
  const lapses = totalReviews - correctReviews
  const lastReviewedAt = record.last_reviewed_at

  const stability = masteryToStability(mastery)
  const difficulty = calculateDifficulty(mastery, totalReviews, correctReviews)
  const dueDate = calculateDueDate(stability, lastReviewedAt, health)
  const fsrsState = determineFSRSState(mastery, totalReviews, lapses)

  return {
    user_id: record.user_id,
    lemma_id: record.lemma_id,
    // FSRS fields
    stability,
    difficulty,
    due_date: dueDate,
    fsrs_state: fsrsState,
    reps: totalReviews,
    lapses: Math.max(0, lapses),
    last_seen_at: lastReviewedAt || new Date().toISOString()
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('FSRS MIGRATION')
  console.log('='.repeat(60))
  console.log()

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log()
  }

  // Build query
  let query = supabase
    .from('user_lemma_progress')
    .select('*')

  if (specificUserId) {
    query = query.eq('user_id', specificUserId)
    console.log(`📌 Filtering to user: ${specificUserId}`)
  }

  // Fetch all progress records
  const { data: records, error } = await query

  if (error) {
    console.error('Error fetching records:', error.message)
    process.exit(1)
  }

  console.log(`📊 Found ${records.length} progress records to migrate`)
  console.log()

  // Check if already migrated (have stability values)
  const alreadyMigrated = records.filter(r => r.stability !== null)
  const needsMigration = records.filter(r => r.stability === null)

  console.log(`✅ Already migrated: ${alreadyMigrated.length}`)
  console.log(`⏳ Needs migration: ${needsMigration.length}`)
  console.log()

  if (needsMigration.length === 0) {
    console.log('✅ All records already have FSRS data. Nothing to migrate.')
    return
  }

  // Show sample migrations
  console.log('📝 Sample migrations (first 5):')
  console.log('-'.repeat(60))

  const samples = needsMigration.slice(0, 5)
  for (const record of samples) {
    const migrated = migrateRecord(record)
    console.log(`Lemma ${record.lemma_id.slice(0, 8)}...`)
    console.log(`  Mastery ${record.mastery_level || 0} → Stability ${migrated.stability} days`)
    console.log(`  Health ${record.health || 0} → Due: ${migrated.due_date.slice(0, 10)}`)
    console.log(`  Reviews ${record.total_reviews || 0} → State: ${migrated.fsrs_state} (${['New', 'Learning', 'Review', 'Relearning'][migrated.fsrs_state]})`)
    console.log()
  }

  if (dryRun) {
    console.log('🔍 DRY RUN - Would migrate', needsMigration.length, 'records')
    console.log('Run without --dry-run to apply changes')
    return
  }

  // Perform migration in batches
  console.log('🚀 Starting migration...')
  const BATCH_SIZE = 50
  let migrated = 0
  let errors = 0

  for (let i = 0; i < needsMigration.length; i += BATCH_SIZE) {
    const batch = needsMigration.slice(i, i + BATCH_SIZE)
    const updates = batch.map(migrateRecord)

    const { error: updateError } = await supabase
      .from('user_lemma_progress')
      .upsert(updates, { onConflict: 'user_id,lemma_id' })

    if (updateError) {
      console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, updateError.message)
      errors += batch.length
    } else {
      migrated += batch.length
      console.log(`✅ Migrated batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needsMigration.length / BATCH_SIZE)} (${migrated} records)`)
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log('MIGRATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`✅ Successfully migrated: ${migrated}`)
  console.log(`❌ Errors: ${errors}`)
  console.log()

  // Verify migration
  console.log('🔍 Verifying migration...')
  const { data: verifyData, error: verifyError } = await supabase
    .from('user_lemma_progress')
    .select('stability')
    .not('stability', 'is', null)

  if (!verifyError) {
    console.log(`✅ Records with FSRS data: ${verifyData.length}`)
  }
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
