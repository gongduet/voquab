#!/usr/bin/env node

/**
 * Session Builder Test Script
 * Tests the session builder functions
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
console.log('SESSION BUILDER TESTS')
console.log('='.repeat(60))
console.log()

// Get a test user
async function getTestUser() {
  const { data } = await supabase
    .from('user_lemma_progress')
    .select('user_id')
    .limit(1)
    .single()

  return data?.user_id
}

// Test: Review session with due cards
async function testReviewSession(userId) {
  console.log('📋 Test 1: Review session query...')

  // Simulate the review session query
  const { data: progressData, error } = await supabase
    .from('user_lemma_progress')
    .select(`
      *,
      lemmas!inner (
        lemma_id,
        lemma_text,
        definitions,
        part_of_speech,
        is_stop_word
      )
    `)
    .eq('user_id', userId)
    .eq('lemmas.is_stop_word', false)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  // Count due cards
  const now = new Date()
  const dueCards = (progressData || []).filter(card => {
    if (!card.due_date) return card.fsrs_state === 0 || card.reps === 0
    return new Date(card.due_date) <= now
  })

  console.log(`  ✅ Found ${progressData?.length || 0} total progress records`)
  console.log(`  ✅ Found ${dueCards.length} due cards`)

  if (progressData && progressData.length > 0) {
    const sample = progressData[0]
    console.log('  Sample enriched card:')
    console.log(`    - lemma: ${sample.lemmas?.lemma_text}`)
    console.log(`    - stability: ${sample.stability}`)
    console.log(`    - due_date: ${sample.due_date}`)
  }

  return true
}

// Test: New cards query (for Learn mode)
async function testLearnSession(userId) {
  console.log()
  console.log('📋 Test 2: Learn session - finding new cards...')

  // Get existing lemma IDs
  const { data: existingProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)

  const existingLemmaIds = new Set((existingProgress || []).map(p => p.lemma_id))
  console.log(`  ✅ User has ${existingLemmaIds.size} introduced lemmas`)

  // Get chapter 1
  const { data: chapter } = await supabase
    .from('chapters')
    .select('chapter_id')
    .eq('chapter_number', 1)
    .single()

  if (!chapter) {
    console.log('  ⚠️ No chapter 1 found')
    return true
  }

  // Get sentences from chapter 1
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id')
    .eq('chapter_id', chapter.chapter_id)

  const sentenceIds = (sentences || []).map(s => s.sentence_id)

  // Get lemmas from these sentences
  const { data: words } = await supabase
    .from('words')
    .select('lemma_id')
    .in('sentence_id', sentenceIds)

  const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]
  const unintroducedCount = chapterLemmaIds.filter(id => !existingLemmaIds.has(id)).length

  console.log(`  ✅ Chapter 1 has ${chapterLemmaIds.length} total lemmas`)
  console.log(`  ✅ ${unintroducedCount} unintroduced lemmas available for learning`)

  return true
}

// Test: Sentence enrichment
async function testSentenceEnrichment(userId) {
  console.log()
  console.log('📋 Test 3: Sentence enrichment...')

  const { data: progressData } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .limit(3)

  if (!progressData || progressData.length === 0) {
    console.log('  ⚠️ No progress records to test')
    return true
  }

  const lemmaIds = progressData.map(p => p.lemma_id)

  // Get sentences for these lemmas
  const { data: wordsData, error } = await supabase
    .from('words')
    .select(`
      lemma_id,
      sentences!inner (
        sentence_text,
        sentence_translation
      )
    `)
    .in('lemma_id', lemmaIds)
    .not('sentences.sentence_text', 'is', null)

  if (error) {
    console.error('  ❌ Error:', error.message)
    return false
  }

  // Build sentence map
  const sentenceMap = {}
  for (const word of wordsData || []) {
    if (!sentenceMap[word.lemma_id] && word.sentences) {
      sentenceMap[word.lemma_id] = {
        text: word.sentences.sentence_text,
        translation: word.sentences.sentence_translation
      }
    }
  }

  console.log(`  ✅ Found sentences for ${Object.keys(sentenceMap).length}/${lemmaIds.length} lemmas`)

  const firstLemmaWithSentence = Object.keys(sentenceMap)[0]
  if (firstLemmaWithSentence) {
    const sent = sentenceMap[firstLemmaWithSentence]
    console.log('  Sample sentence:')
    console.log(`    - ES: ${sent.text?.substring(0, 50)}...`)
    console.log(`    - EN: ${sent.translation?.substring(0, 50)}...`)
  }

  return true
}

// Run all tests
async function runTests() {
  const userId = await getTestUser()

  if (!userId) {
    console.log('❌ No test user found with progress data')
    process.exit(1)
  }

  console.log(`Using test user: ${userId.substring(0, 8)}...`)
  console.log()

  let passed = 0
  let total = 3

  if (await testReviewSession(userId)) passed++
  if (await testLearnSession(userId)) passed++
  if (await testSentenceEnrichment(userId)) passed++

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
