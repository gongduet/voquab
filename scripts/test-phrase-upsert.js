/**
 * Test phrase progress upsert with the correct columns
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

async function testPhraseUpsert() {
  console.log('🧪 Testing phrase progress upsert...\n')

  // Get a real user ID from user_lemma_progress
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('user_id')
    .limit(1)

  if (!userProgress || userProgress.length === 0) {
    console.log('❌ No user progress found')
    return
  }

  const testUserId = userProgress[0].user_id
  console.log('Using user_id:', testUserId)

  // Get a real phrase ID
  const { data: phrases, error: phraseError } = await supabase
    .from('phrases')
    .select('phrase_id')
    .limit(1)

  if (phraseError || !phrases || phrases.length === 0) {
    console.log('❌ Could not find a phrase to test with:', phraseError?.message)
    return
  }

  const testPhraseId = phrases[0].phrase_id
  console.log('Using phrase_id:', testPhraseId)

  // Build the same upsert data that useProgressTracking would use for phrases
  const progressUpdate = {
    user_id: testUserId,
    phrase_id: testPhraseId,
    // FSRS fields
    stability: 1.0,
    difficulty: 5.0,
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    fsrs_state: 1,
    reps: 1,
    lapses: 0,
    last_seen_at: new Date().toISOString(),
    // Legacy fields
    mastery_level: 1,
    health: 100
    // NOT including: total_reviews, last_reviewed_at, updated_at, correct_reviews, last_correct_review_at
  }

  console.log('\nUpserting:', JSON.stringify(progressUpdate, null, 2))

  const { data, error } = await supabase
    .from('user_phrase_progress')
    .upsert(progressUpdate, {
      onConflict: 'user_id,phrase_id'
    })
    .select()

  if (error) {
    console.log('\n❌ Upsert failed:', error.message)
    console.log('   Code:', error.code)
    console.log('   Details:', error.details)
  } else {
    console.log('\n✅ Upsert succeeded!')
    console.log('   Result:', data)

    // Clean up test record
    const { error: deleteError } = await supabase
      .from('user_phrase_progress')
      .delete()
      .eq('user_id', testUserId)
      .eq('phrase_id', testPhraseId)

    if (deleteError) {
      console.log('   ⚠️ Cleanup failed:', deleteError.message)
    } else {
      console.log('   ✅ Test record cleaned up')
    }
  }

  // Verify current row count
  const { count } = await supabase
    .from('user_phrase_progress')
    .select('*', { count: 'exact', head: true })

  console.log('\n📊 Current user_phrase_progress count:', count)
}

testPhraseUpsert().catch(console.error)
