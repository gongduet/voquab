#!/usr/bin/env node
/**
 * Content Pipeline: Generate Sentence Fragments
 *
 * Generates meaningful sentence fragments for the reading comprehension feature.
 * Uses Claude API to intelligently segment Spanish sentences into 2-4 chunks
 * that translate meaningfully on their own.
 *
 * Usage:
 *   node scripts/content_pipeline/generate_fragments.js --chapters 1 --dry-run
 *   node scripts/content_pipeline/generate_fragments.js --chapters 1 2 3
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env') })

// Initialize clients
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

/**
 * Get chapter_id for a chapter number
 */
async function getChapterId(chapterNumber) {
  const { data, error } = await supabase
    .from('chapters')
    .select('chapter_id')
    .eq('chapter_number', chapterNumber)
    .single()

  if (error) {
    console.error(`Error getting chapter ${chapterNumber}:`, error.message)
    return null
  }
  return data?.chapter_id
}

/**
 * Fetch all sentences for a chapter
 */
async function getSentencesForChapter(chapterId) {
  const { data, error } = await supabase
    .from('sentences')
    .select('sentence_id, sentence_order, sentence_text, sentence_translation')
    .eq('chapter_id', chapterId)
    .order('sentence_order')

  if (error) {
    console.error('Error fetching sentences:', error.message)
    return []
  }
  return data || []
}

/**
 * Check if sentence already has fragments
 */
async function hasExistingFragments(sentenceId) {
  const { data } = await supabase
    .from('sentence_fragments')
    .select('fragment_id')
    .eq('sentence_id', sentenceId)
    .limit(1)

  return data && data.length > 0
}

/**
 * Use Claude to translate a sentence if translation is missing
 */
async function translateSentence(spanishText) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Translate this Spanish sentence to English. Return ONLY the English translation, nothing else.

Spanish: ${spanishText}

English:`
    }]
  })

  return response.content[0].text.trim()
}

/**
 * Use Claude to segment a sentence into meaningful fragments
 */
async function generateFragments(spanishText, englishText) {
  const prompt = `Segment this Spanish sentence into 2-4 meaningful fragments for language learners.

RULES:
1. Each fragment should be 4-10 words (prefer 5-8)
2. Each fragment MUST translate meaningfully on its own
3. Follow natural reading rhythm and clause boundaries
4. NEVER split:
   - Verb phrases (he estado → keep together)
   - Noun phrases with articles (la pequeña rosa → keep together)
   - Prepositional phrases (en el desierto → keep together)
5. If sentence is < 5 words, return it as a single fragment
6. Keep quoted text intact within fragments

Spanish: ${spanishText}
English: ${englishText}

Respond with a JSON array of fragments. Each fragment has:
- "es": Spanish text
- "en": English translation
- "context_note": (optional) Brief grammar note if fragment contains tricky pattern

Example response:
[
  {"es": "Cuando yo tenía seis años,", "en": "When I was six years old,"},
  {"es": "vi una magnífica lámina", "en": "I saw a magnificent illustration", "context_note": "magnífica agrees with feminine lámina"}
]

Return ONLY the JSON array, no other text.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  let responseText = response.content[0].text.trim()

  // Handle potential markdown code blocks
  if (responseText.startsWith('```')) {
    const lines = responseText.split('\n')
    // Remove first and last lines (code fence)
    responseText = lines.slice(1, -1).join('\n')
  }

  try {
    return JSON.parse(responseText)
  } catch (e) {
    console.log(`    WARNING: Could not parse Claude response as JSON: ${e.message}`)
    console.log(`    Response was: ${responseText.substring(0, 200)}...`)
    return []
  }
}

/**
 * Calculate start and end word positions for a fragment
 */
function calculateWordPositions(sentenceText, fragmentText, startFrom = 0) {
  const sentenceWords = sentenceText.split(/\s+/)
  const fragmentWords = fragmentText.split(/\s+/)

  // Find where fragment starts in sentence
  let fragmentStart = null
  for (let i = startFrom; i < sentenceWords.length; i++) {
    let matches = true
    for (let j = 0; j < fragmentWords.length; j++) {
      if (i + j >= sentenceWords.length) {
        matches = false
        break
      }
      // Normalize for comparison
      const sentWord = sentenceWords[i + j].replace(/[.,;:!?»"']/g, '').replace(/^[«"'¿¡]/g, '').toLowerCase()
      const fragWord = fragmentWords[j].replace(/[.,;:!?»"']/g, '').replace(/^[«"'¿¡]/g, '').toLowerCase()
      if (sentWord !== fragWord) {
        matches = false
        break
      }
    }
    if (matches) {
      fragmentStart = i
      break
    }
  }

  if (fragmentStart === null) {
    // Fallback: use sequential positioning
    return {
      startPos: startFrom,
      endPos: startFrom + fragmentWords.length - 1,
      nextStart: startFrom + fragmentWords.length
    }
  }

  return {
    startPos: fragmentStart,
    endPos: fragmentStart + fragmentWords.length - 1,
    nextStart: fragmentStart + fragmentWords.length
  }
}

/**
 * Insert fragments into database
 */
async function insertFragments(sentenceId, fragments, sentenceText) {
  let currentPosition = 0
  let inserted = 0

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i]

    // Calculate word positions
    const { startPos, endPos, nextStart } = calculateWordPositions(
      sentenceText, frag.es, currentPosition
    )
    currentPosition = nextStart

    // Build insert data
    const insertData = {
      sentence_id: sentenceId,
      fragment_order: i + 1,
      start_word_position: startPos,
      end_word_position: endPos,
      fragment_text: frag.es,
      fragment_translation: frag.en
    }

    if (frag.context_note) {
      insertData.context_note = frag.context_note
    }

    const { error } = await supabase
      .from('sentence_fragments')
      .insert(insertData)

    if (error) {
      throw new Error(error.message)
    }
    inserted++
  }

  return inserted
}

/**
 * Process all sentences in a chapter
 */
async function processChapter(chapterNumber, dryRun = false) {
  console.log(`\nProcessing Chapter ${chapterNumber}`)
  console.log('='.repeat(40))

  const chapterId = await getChapterId(chapterNumber)
  if (!chapterId) {
    console.log(`  ERROR: Chapter ${chapterNumber} not found in database`)
    return { sentences: 0, processed: 0, fragments: 0, skipped: 0, errors: 0 }
  }

  const sentences = await getSentencesForChapter(chapterId)

  const stats = {
    sentences: sentences.length,
    processed: 0,
    fragments: 0,
    skipped: 0,
    errors: 0,
    translationsGenerated: 0
  }

  for (const sentence of sentences) {
    const { sentence_id, sentence_order, sentence_text } = sentence
    let { sentence_translation } = sentence

    // Skip if fragments already exist
    if (await hasExistingFragments(sentence_id)) {
      console.log(`  [${sentence_order}] SKIPPED (fragments exist)`)
      stats.skipped++
      continue
    }

    // Generate translation if missing
    if (!sentence_translation || sentence_translation.trim() === '') {
      console.log(`  [${sentence_order}] Generating translation...`)
      sentence_translation = await translateSentence(sentence_text)
      stats.translationsGenerated++

      // Update sentence with translation if not dry run
      if (!dryRun) {
        await supabase
          .from('sentences')
          .update({ sentence_translation })
          .eq('sentence_id', sentence_id)
      }
    }

    // Generate fragments
    const fragments = await generateFragments(sentence_text, sentence_translation)

    if (!fragments || fragments.length === 0) {
      console.log(`  [${sentence_order}] ERROR: No fragments generated`)
      stats.errors++
      continue
    }

    // Display fragments
    console.log(`  [${sentence_order}] ${fragments.length} fragments:`)
    for (const frag of fragments) {
      const hasNote = frag.context_note ? '*' : ''
      console.log(`       → "${frag.es}" = "${frag.en}"${hasNote}`)
    }

    // Insert if not dry run
    if (!dryRun) {
      try {
        await insertFragments(sentence_id, fragments, sentence_text)
      } catch (e) {
        console.log(`       ERROR inserting: ${e.message}`)
        stats.errors++
        continue
      }
    }

    stats.processed++
    stats.fragments += fragments.length
  }

  return stats
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const result = {
    chapters: [],
    dryRun: false
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chapters') {
      // Collect all chapter numbers until we hit another flag
      i++
      while (i < args.length && !args[i].startsWith('--')) {
        result.chapters.push(parseInt(args[i], 10))
        i++
      }
      i-- // Step back since for loop will increment
    } else if (args[i] === '--dry-run') {
      result.dryRun = true
    }
  }

  if (result.chapters.length === 0) {
    console.log('Usage: node generate_fragments.js --chapters 1 2 3 [--dry-run]')
    process.exit(1)
  }

  return result
}

/**
 * Main entry point
 */
async function main() {
  const { chapters, dryRun } = parseArgs()

  if (dryRun) {
    console.log('\n' + '='.repeat(50))
    console.log('DRY RUN MODE - No database changes will be made')
    console.log('='.repeat(50))
  }

  const totalStats = {
    sentences: 0,
    processed: 0,
    fragments: 0,
    skipped: 0,
    errors: 0,
    translationsGenerated: 0
  }

  for (const chapterNum of chapters) {
    const stats = await processChapter(chapterNum, dryRun)

    for (const key in totalStats) {
      totalStats[key] += stats[key] || 0
    }
  }

  // Print summary
  console.log('\n')
  console.log('='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`  Chapters processed: ${chapters.length}`)
  console.log(`  Total sentences: ${totalStats.sentences}`)
  console.log(`  Processed: ${totalStats.processed}`)
  console.log(`  Skipped (existing): ${totalStats.skipped}`)
  console.log(`  Errors: ${totalStats.errors}`)
  console.log(`  Translations generated: ${totalStats.translationsGenerated}`)
  console.log()

  if (dryRun) {
    console.log(`  Fragments WOULD be created: ${totalStats.fragments}`)
    console.log('\n  (Run without --dry-run to insert into database)')
  } else {
    console.log(`  Fragments created: ${totalStats.fragments}`)
  }

  console.log()
}

main().catch(console.error)
