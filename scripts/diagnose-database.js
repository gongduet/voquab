/**
 * Database diagnostic script for Dashboard issues
 * Runs the diagnostic queries from v5 fix plan
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

async function runDiagnostics() {
  console.log('🔍 Running database diagnostics...\n')

  // 1. Check user_phrase_progress schema
  console.log('1. Checking user_phrase_progress schema...')
  const { data: sampleRow, error: sampleError } = await supabase
    .from('user_phrase_progress')
    .select('*')
    .limit(1)

  if (sampleError) {
    console.log('   ❌ Error accessing user_phrase_progress:', sampleError.message)
  } else if (sampleRow && sampleRow.length > 0) {
    console.log('   ✅ user_phrase_progress columns:', Object.keys(sampleRow[0]).join(', '))
  } else {
    // Table exists but is empty
    console.log('   ⚠️ Table exists but is empty (0 rows)')
  }

  // 2. Check if any phrase progress exists
  console.log('\n2. Checking phrase progress count...')
  const { count: phraseProgressCount, error: countError } = await supabase
    .from('user_phrase_progress')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.log('   ❌ Error:', countError.message)
  } else {
    console.log(`   📊 user_phrase_progress rows: ${phraseProgressCount}`)
  }

  // 3. Check if chapters exist
  console.log('\n3. Checking chapters...')
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('chapter_number, title, title_spanish')
    .order('chapter_number', { ascending: true })
    .limit(5)

  if (chaptersError) {
    console.log('   ❌ Error:', chaptersError.message)
  } else if (chapters && chapters.length > 0) {
    console.log(`   ✅ Found ${chapters.length} chapters:`)
    chapters.forEach(ch => console.log(`      Ch ${ch.chapter_number}: ${ch.title_spanish || ch.title}`))
  } else {
    console.log('   ⚠️ No chapters found!')
  }

  // 4. Check if user_lemma_progress has data
  console.log('\n4. Checking lemma progress count...')
  const { count: lemmaProgressCount, error: lemmaCountError } = await supabase
    .from('user_lemma_progress')
    .select('*', { count: 'exact', head: true })

  if (lemmaCountError) {
    console.log('   ❌ Error:', lemmaCountError.message)
  } else {
    console.log(`   📊 user_lemma_progress rows: ${lemmaProgressCount}`)
  }

  // 5. Check if phrases exist and are linked to chapters
  console.log('\n5. Checking phrases linked to chapters...')
  const { count: linkedPhrasesCount, error: linkedError } = await supabase
    .from('phrase_occurrences')
    .select('*', { count: 'exact', head: true })

  if (linkedError) {
    console.log('   ❌ Error:', linkedError.message)
  } else {
    console.log(`   📊 phrase_occurrences rows: ${linkedPhrasesCount}`)
  }

  // 6. Check total phrases
  console.log('\n6. Checking total phrases...')
  const { count: totalPhrases, error: phrasesError } = await supabase
    .from('phrases')
    .select('*', { count: 'exact', head: true })

  if (phrasesError) {
    console.log('   ❌ Error:', phrasesError.message)
  } else {
    console.log(`   📊 Total phrases: ${totalPhrases}`)
  }

  // 7. Check user_phrase_progress structure column by column
  console.log('\n7. Checking user_phrase_progress columns individually...')

  const columnsToCheck = ['user_id', 'phrase_id', 'stability', 'difficulty', 'due_date', 'fsrs_state', 'reps', 'lapses', 'last_seen_at', 'created_at', 'updated_at', 'mastery_level', 'health']
  const existingColumns = []
  const missingColumns = []

  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('user_phrase_progress')
      .select(col)
      .limit(0)

    if (error) {
      missingColumns.push(col)
    } else {
      existingColumns.push(col)
    }
  }

  console.log('   ✅ Existing columns:', existingColumns.join(', '))
  if (missingColumns.length > 0) {
    console.log('   ❌ Missing columns:', missingColumns.join(', '))
  }

  // 8. Check user_lemma_progress structure for comparison
  console.log('\n8. Checking user_lemma_progress structure...')
  const { data: lemmaSample, error: lemmaSampleError } = await supabase
    .from('user_lemma_progress')
    .select('*')
    .limit(1)

  if (lemmaSampleError) {
    console.log('   ❌ Error:', lemmaSampleError.message)
  } else if (lemmaSample && lemmaSample.length > 0) {
    console.log('   ✅ user_lemma_progress columns:', Object.keys(lemmaSample[0]).join(', '))
  }

  console.log('\n✅ Diagnostics complete!')
}

runDiagnostics().catch(console.error)
