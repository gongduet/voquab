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

// Test: New cards query (for Learn mode) with proportional phrase/lemma mix
async function testLearnSession(userId) {
  console.log()
  console.log('📋 Test 2: Learn session - proportional phrase/lemma mix...')

  // Get existing lemma IDs (reps >= 1)
  const { data: existingProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const existingLemmaIds = new Set((existingProgress || []).map(p => p.lemma_id))
  console.log(`  ✅ User has ${existingLemmaIds.size} introduced lemmas`)

  // Get existing phrase IDs (reps >= 1)
  const { data: existingPhraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const existingPhraseIds = new Set((existingPhraseProgress || []).map(p => p.phrase_id))
  console.log(`  ✅ User has ${existingPhraseIds.size} introduced phrases`)

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

  // Get lemmas from these sentences (non-stop words)
  const { data: words } = await supabase
    .from('words')
    .select('lemma_id, lemmas!inner(is_stop_word)')
    .in('sentence_id', sentenceIds)
    .eq('lemmas.is_stop_word', false)

  const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]
  const introducedLemmas = chapterLemmaIds.filter(id => existingLemmaIds.has(id))

  console.log(`  ✅ Chapter 1 has ${chapterLemmaIds.length} total lemmas (non-stop)`)
  console.log(`  ✅ ${introducedLemmas.length} introduced lemmas`)

  // Get phrases from these sentences via phrase_occurrences
  const { data: phraseOccurrences } = await supabase
    .from('phrase_occurrences')
    .select('phrase_id')
    .in('sentence_id', sentenceIds)

  const chapterPhraseIds = [...new Set((phraseOccurrences || []).map(o => o.phrase_id))]
  const introducedPhrases = chapterPhraseIds.filter(id => existingPhraseIds.has(id))

  console.log(`  ✅ Chapter 1 has ${chapterPhraseIds.length} total phrases`)
  console.log(`  ✅ ${introducedPhrases.length} introduced phrases`)

  // Calculate chapter progress (like fetchChaptersProgress does)
  const totalIntroduced = introducedLemmas.length + introducedPhrases.length
  const totalInChapter = chapterLemmaIds.length + chapterPhraseIds.length
  const rate = totalInChapter > 0 ? Math.round((totalIntroduced / totalInChapter) * 100) : 0

  console.log()
  console.log(`  📊 Chapter 1 Progress: ${totalIntroduced}/${totalInChapter} (${rate}%)`)
  console.log(`     Lemmas: ${introducedLemmas.length}/${chapterLemmaIds.length}`)
  console.log(`     Phrases: ${introducedPhrases.length}/${chapterPhraseIds.length}`)

  if (rate >= 95) {
    console.log('  🔓 Chapter 2 should be UNLOCKED (>= 95%)')
  } else {
    console.log(`  🔒 Chapter 2 locked (need ${Math.ceil(totalInChapter * 0.95) - totalIntroduced} more)`)
  }

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
