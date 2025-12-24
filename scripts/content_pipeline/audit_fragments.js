#!/usr/bin/env node
/**
 * Fragment Generation Audit Script
 *
 * Analyzes the current state of sentence fragment generation.
 * Read-only - does not modify any data.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env') })

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runAudit() {
  console.log('\n' + '='.repeat(70))
  console.log('FRAGMENT GENERATION AUDIT')
  console.log('='.repeat(70))

  // Get all chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .order('chapter_number')

  // 1. Fragment Coverage by Chapter
  console.log('\n1. FRAGMENT COVERAGE BY CHAPTER')
  console.log('-'.repeat(70))
  console.log(`${'Ch'.padStart(3)} | ${'Total'.padStart(6)} | ${'With'.padStart(6)} | ${'Without'.padStart(7)} | ${'Frags'.padStart(6)} | ${'Coverage'.padStart(8)}`)
  console.log('-'.repeat(70))

  let totalSentencesAll = 0
  let totalWithFragments = 0
  let totalWithoutFragments = 0
  let totalFragments = 0
  let completeChapters = 0
  let partialChapters = 0
  let notStartedChapters = 0

  const chapterStats = []
  const missingSentences = []

  for (const ch of chapters) {
    // Get all sentences for this chapter
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id, sentence_order, sentence_text, sentence_translation')
      .eq('chapter_id', ch.chapter_id)
      .order('sentence_order')

    if (!sentences || sentences.length === 0) continue

    const sentenceIds = sentences.map(s => s.sentence_id)

    // Get fragments for these sentences
    const { data: fragments } = await supabase
      .from('sentence_fragments')
      .select('sentence_id, fragment_id')
      .in('sentence_id', sentenceIds)

    const sentencesWithFrags = new Set(fragments?.map(f => f.sentence_id) || [])
    const withFrags = sentencesWithFrags.size
    const fragCount = fragments?.length || 0
    const withoutFrags = sentences.length - withFrags
    const coverage = (withFrags / sentences.length * 100)

    // Track totals
    totalSentencesAll += sentences.length
    totalWithFragments += withFrags
    totalWithoutFragments += withoutFrags
    totalFragments += fragCount

    // Categorize chapter
    if (coverage === 100) {
      completeChapters++
    } else if (coverage > 0) {
      partialChapters++
    } else {
      notStartedChapters++
    }

    chapterStats.push({
      num: ch.chapter_number,
      total: sentences.length,
      with: withFrags,
      without: withoutFrags,
      frags: fragCount,
      coverage: coverage
    })

    console.log(`${String(ch.chapter_number).padStart(3)} | ${String(sentences.length).padStart(6)} | ${String(withFrags).padStart(6)} | ${String(withoutFrags).padStart(7)} | ${String(fragCount).padStart(6)} | ${coverage.toFixed(1).padStart(7)}%`)

    // Track missing sentences
    for (const sent of sentences) {
      if (!sentencesWithFrags.has(sent.sentence_id)) {
        missingSentences.push({
          chapter: ch.chapter_number,
          order: sent.sentence_order,
          text: sent.sentence_text.length > 50 ? sent.sentence_text.substring(0, 50) + '...' : sent.sentence_text,
          hasTranslation: sent.sentence_translation ? 'yes' : 'no',
          length: sent.sentence_text.length
        })
      }
    }
  }

  console.log('-'.repeat(70))
  const totalCoverage = (totalWithFragments / totalSentencesAll * 100)
  console.log(`${'TOT'.padStart(3)} | ${String(totalSentencesAll).padStart(6)} | ${String(totalWithFragments).padStart(6)} | ${String(totalWithoutFragments).padStart(7)} | ${String(totalFragments).padStart(6)} | ${totalCoverage.toFixed(1).padStart(7)}%`)

  // 2. Identify Missing Sentences
  console.log('\n\n2. MISSING SENTENCES (No Fragments)')
  console.log('-'.repeat(70))

  if (missingSentences.length > 0) {
    let currentChapter = null
    for (const ms of missingSentences) {
      if (ms.chapter !== currentChapter) {
        currentChapter = ms.chapter
        console.log(`\nChapter ${currentChapter}:`)
      }
      console.log(`  [${String(ms.order).padStart(3)}] ${ms.text} (trans: ${ms.hasTranslation})`)
    }
  } else {
    console.log('No missing sentences found!')
  }

  // 3. Check for Duplicates
  console.log('\n\n3. DUPLICATE FRAGMENT CHECK')
  console.log('-'.repeat(70))

  const { data: allFrags } = await supabase
    .from('sentence_fragments')
    .select('sentence_id, fragment_order')

  const seen = new Map()
  const duplicates = []

  for (const f of allFrags || []) {
    const key = `${f.sentence_id}-${f.fragment_order}`
    if (seen.has(key)) {
      seen.set(key, seen.get(key) + 1)
    } else {
      seen.set(key, 1)
    }
  }

  for (const [key, count] of seen.entries()) {
    if (count > 1) {
      const [sentenceId, fragmentOrder] = key.split('-')
      duplicates.push({ sentenceId, fragmentOrder, count })
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate entries:`)
    for (const d of duplicates) {
      console.log(`  sentence_id: ${d.sentenceId}, fragment_order: ${d.fragmentOrder}, count: ${d.count}`)
    }
  } else {
    console.log('No duplicates found!')
  }

  // 4. Last Successfully Processed
  console.log('\n\n4. LAST SUCCESSFULLY PROCESSED')
  console.log('-'.repeat(70))

  for (const ch of [...chapters].reverse()) {
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id, sentence_order, sentence_text')
      .eq('chapter_id', ch.chapter_id)
      .order('sentence_order', { ascending: false })

    for (const sent of sentences || []) {
      const { data: fragCheck } = await supabase
        .from('sentence_fragments')
        .select('fragment_id')
        .eq('sentence_id', sent.sentence_id)
        .limit(1)

      if (fragCheck && fragCheck.length > 0) {
        console.log(`Chapter: ${ch.chapter_number}`)
        console.log(`Sentence Order: ${sent.sentence_order}`)
        console.log(`Text: ${sent.sentence_text.substring(0, 80)}...`)
        break
      }
    }
    // Check if we found something in this chapter
    const { data: anyFrags } = await supabase
      .from('sentence_fragments')
      .select('fragment_id')
      .in('sentence_id', (sentences || []).map(s => s.sentence_id))
      .limit(1)

    if (anyFrags && anyFrags.length > 0) {
      break
    }
  }

  // 5. Error Pattern Analysis
  console.log('\n\n5. ERROR PATTERN ANALYSIS')
  console.log('-'.repeat(70))

  if (missingSentences.length > 0) {
    const chaptersWithMissing = [...new Set(missingSentences.map(ms => ms.chapter))]
    const missingWithoutTrans = missingSentences.filter(ms => ms.hasTranslation === 'no').length
    const avgLength = missingSentences.reduce((sum, ms) => sum + ms.length, 0) / missingSentences.length

    console.log(`Missing sentences appear in ${chaptersWithMissing.length} chapters: ${chaptersWithMissing.sort((a, b) => a - b).join(', ')}`)
    console.log(`Missing without translation: ${missingWithoutTrans} / ${missingSentences.length}`)
    console.log(`Average length of missing sentences: ${avgLength.toFixed(0)} characters`)

    const longMissing = missingSentences.filter(ms => ms.length > 200)
    if (longMissing.length > 0) {
      console.log(`Long sentences (>200 chars) missing: ${longMissing.length}`)
    }
  } else {
    console.log('No missing sentences to analyze.')
  }

  // 6. Summary Report
  console.log('\n\n' + '='.repeat(70))
  console.log('SUMMARY REPORT')
  console.log('='.repeat(70))
  console.log(`Total chapters: ${chapters.length}`)
  console.log(`Chapters complete (100%): ${completeChapters}`)
  console.log(`Chapters partial: ${partialChapters}`)
  console.log(`Chapters not started: ${notStartedChapters}`)
  console.log()
  console.log(`Total sentences in book: ${totalSentencesAll}`)
  console.log(`Sentences with fragments: ${totalWithFragments}`)
  console.log(`Sentences missing fragments: ${totalWithoutFragments}`)
  console.log()
  console.log(`Duplicates found: ${duplicates.length}`)
  console.log()
  console.log('RECOMMENDATION:')

  if (totalWithoutFragments === 0) {
    console.log('All sentences have fragments! Job complete.')
  } else {
    const incomplete = chapterStats.filter(s => s.coverage < 100)
    if (incomplete.length > 0) {
      const chaptersToRun = incomplete.map(s => s.num).join(' ')
      console.log(`Re-run fragment generation for chapters: ${chaptersToRun}`)
      console.log(`Command: node scripts/content_pipeline/generate_fragments.js --chapters ${chaptersToRun}`)
    }
  }

  console.log('\n')
}

runAudit().catch(console.error)
