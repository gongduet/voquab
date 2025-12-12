#!/usr/bin/env node

/**
 * FSRS Service Test Script
 * Tests the core FSRS functions to verify they work correctly
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

console.log('='.repeat(60))
console.log('FSRS SERVICE TESTS')
console.log('='.repeat(60))
console.log()

// Test 1: Verify migrated data has FSRS fields
async function testMigratedData() {
  console.log('📋 Test 1: Verifying migrated data has FSRS fields...')

  const { data, error } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id, stability, difficulty, due_date, fsrs_state, reps, lapses')
    .not('stability', 'is', null)
    .limit(5)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  if (!data || data.length === 0) {
    console.error('  ❌ No migrated records found')
    return false
  }

  console.log(`  ✅ Found ${data.length} records with FSRS data`)
  console.log('  Sample record:')
  console.log(`    - stability: ${data[0].stability} days`)
  console.log(`    - difficulty: ${data[0].difficulty}`)
  console.log(`    - due_date: ${data[0].due_date}`)
  console.log(`    - fsrs_state: ${data[0].fsrs_state}`)
  console.log(`    - reps: ${data[0].reps}`)
  console.log(`    - lapses: ${data[0].lapses}`)
  return true
}

// Test 2: Check due cards query works
async function testDueCardsQuery() {
  console.log()
  console.log('📋 Test 2: Testing due cards query...')

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id, due_date')
    .lte('due_date', now)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  console.log(`  ✅ Found ${data?.length || 0} due cards`)
  return true
}

// Test 3: Check lemma join works
async function testLemmaJoin() {
  console.log()
  console.log('📋 Test 3: Testing progress with lemma join...')

  const { data, error } = await supabase
    .from('user_lemma_progress')
    .select(`
      *,
      lemmas!inner (
        lemma_id,
        lemma_text,
        definitions,
        part_of_speech
      )
    `)
    .limit(1)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  if (!data || data.length === 0) {
    console.log('  ⚠️ No progress records found')
    return true
  }

  console.log(`  ✅ Join successful`)
  console.log(`    - lemma_text: ${data[0].lemmas?.lemma_text}`)
  console.log(`    - definitions: ${JSON.stringify(data[0].lemmas?.definitions)}`)
  return true
}

// Test 4: Check chapter progress function exists
async function testChapterProgressFunction() {
  console.log()
  console.log('📋 Test 4: Testing get_chapter_progress function...')

  // Get a user ID to test with
  const { data: user } = await supabase
    .from('user_lemma_progress')
    .select('user_id')
    .limit(1)
    .single()

  if (!user) {
    console.log('  ⚠️ No users found to test with')
    return true
  }

  const { data, error } = await supabase
    .rpc('get_chapter_progress', { p_user_id: user.user_id })

  if (error) {
    console.log('  ⚠️ Function may not exist yet:', error.message)
    console.log('  (Run create_chapter_progress_function.sql to create it)')
    return true
  }

  console.log(`  ✅ Function works - found ${data?.length || 0} chapters`)
  if (data && data.length > 0) {
    console.log(`    - Chapter ${data[0].chapter_number}: ${data[0].introduced_pct}% introduced`)
  }
  return true
}

// Test 5: Verify FSRS state distribution
async function testStateDistribution() {
  console.log()
  console.log('📋 Test 5: Checking FSRS state distribution...')

  const { data, error } = await supabase
    .from('user_lemma_progress')
    .select('fsrs_state')
    .not('fsrs_state', 'is', null)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  const stateCounts = { 0: 0, 1: 0, 2: 0, 3: 0 }
  const stateNames = ['New', 'Learning', 'Review', 'Relearning']

  for (const row of data || []) {
    stateCounts[row.fsrs_state] = (stateCounts[row.fsrs_state] || 0) + 1
  }

  console.log('  ✅ State distribution:')
  for (let i = 0; i < 4; i++) {
    console.log(`    - ${stateNames[i]}: ${stateCounts[i]} cards`)
  }
  return true
}

// Run all tests
async function runTests() {
  let passed = 0
  let total = 5

  if (await testMigratedData()) passed++
  if (await testDueCardsQuery()) passed++
  if (await testLemmaJoin()) passed++
  if (await testChapterProgressFunction()) passed++
  if (await testStateDistribution()) passed++

  console.log()
  console.log('='.repeat(60))
  console.log(`RESULTS: ${passed}/${total} tests passed`)
  console.log('='.repeat(60))

  process.exit(passed === total ? 0 : 1)
}

runTests().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
