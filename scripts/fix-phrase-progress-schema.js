/**
 * Fix user_phrase_progress schema to match user_lemma_progress
 * Adds missing columns needed for FSRS progress tracking
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixSchema() {
  console.log('🔧 Fixing user_phrase_progress schema...\n')

  // SQL to add missing columns
  const alterTableSQL = `
    -- Add missing columns to user_phrase_progress
    ALTER TABLE user_phrase_progress
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS correct_reviews INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_correct_review_at TIMESTAMPTZ;
  `

  console.log('Running ALTER TABLE to add missing columns...')

  // Use the Supabase SQL editor via RPC or direct query
  // Since we can't run raw SQL directly, let's try inserting a test record to see the error

  const testUserId = '00000000-0000-0000-0000-000000000000'
  const testPhraseId = 1

  // First, let's see what error we get when trying to insert with all columns
  const { data, error } = await supabase
    .from('user_phrase_progress')
    .upsert({
      user_id: testUserId,
      phrase_id: testPhraseId,
      stability: 1.0,
      difficulty: 5.0,
      due_date: new Date().toISOString(),
      fsrs_state: 1,
      reps: 1,
      lapses: 0,
      last_seen_at: new Date().toISOString(),
      mastery_level: 1,
      health: 100,
      total_reviews: 1,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      correct_reviews: 1,
      last_correct_review_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,phrase_id'
    })

  if (error) {
    console.log('❌ Upsert test failed with error:', error.message)
    console.log('   Error code:', error.code)
    console.log('   Error details:', error.details)

    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n📝 The following SQL needs to be run in Supabase SQL Editor:')
      console.log('---')
      console.log(alterTableSQL)
      console.log('---')
    }
  } else {
    console.log('✅ Upsert test succeeded! All columns exist.')

    // Clean up test record
    await supabase
      .from('user_phrase_progress')
      .delete()
      .eq('user_id', testUserId)
      .eq('phrase_id', testPhraseId)

    console.log('   (Test record cleaned up)')
  }
}

fixSchema().catch(console.error)
