/**
 * Sentence Split Service (V2)
 *
 * Handles splitting a single sentence into multiple sentences while PRESERVING
 * word-to-lemma associations (no more lost vocabulary work!).
 *
 * This involves:
 * 1. Creating new sentences with proper ordering
 * 2. Reordering all subsequent sentences in the chapter
 * 3. MIGRATING words to new sentences (preserves lemma_id!)
 * 4. Deleting fragments (must be regenerated via CLI)
 * 5. Recalculating phrase occurrences
 * 6. Cleaning up user progress
 * 7. Deleting original sentence
 *
 * After splitting, run fragment generation CLI:
 *   python scripts/content_pipeline/generate_fragments.py --sentence-ids <ids>
 */

import { supabase } from '../lib/supabase'

/**
 * Split a sentence into multiple sentences (V2 - preserves lemma associations)
 *
 * @param {string} originalSentenceId - The sentence to split
 * @param {Array<{text: string, translation: string, isParagraphStart: boolean}>} newSentences - Array of new sentence data
 * @param {string} chapterId - The chapter ID (for phrase occurrence recalculation)
 * @returns {Promise<{success: boolean, newSentenceIds?: string[], wordsMigrated?: number, error?: string}>}
 */
export async function splitSentence(originalSentenceId, newSentences, chapterId) {
  console.log('[SplitSentence] Starting split operation (v2 - word migration)', { originalSentenceId, newSentences })

  try {
    // Call the v2 database function which migrates words instead of deleting them
    const { data, error } = await supabase.rpc('split_sentence_v2', {
      p_original_sentence_id: originalSentenceId,
      p_new_sentences: newSentences.map(s => ({
        text: s.text.trim(),
        translation: s.translation?.trim() || '',
        isParagraphStart: s.isParagraphStart || false
      }))
    })

    if (error) {
      throw new Error(`Database function error: ${error.message}`)
    }

    console.log('[SplitSentence] RPC result:', data)

    if (!data.success) {
      // Include word count mismatch details if available
      const errorDetails = data.dbWordCount !== undefined
        ? ` (DB: ${data.dbWordCount}, UI: ${data.uiWordCount})`
        : ''
      throw new Error((data.error || 'Split operation failed') + errorDetails)
    }

    // Words are already migrated by v2 function - no need to regenerate
    console.log('[SplitSentence] Words migrated:', data.wordsMigrated)

    // Recalculate phrase occurrences for each new sentence
    console.log('[SplitSentence] Recalculating phrase occurrences')
    for (let i = 0; i < (data.newSentenceIds || []).length; i++) {
      const sentenceId = data.newSentenceIds[i]
      const sentenceText = newSentences[i].text
      await recalculatePhraseOccurrences(sentenceId, sentenceText, chapterId)
    }

    console.log('[SplitSentence] Split complete!')
    console.log('[SplitSentence] New sentence IDs for fragment generation:', data.newSentenceIds)

    return {
      success: true,
      newSentenceIds: data.newSentenceIds,
      wordsMigrated: data.wordsMigrated,
      message: data.message
    }

  } catch (error) {
    console.error('[SplitSentence] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Generate fragments for a sentence using Claude AI
 *
 * @param {string} sentenceId - The sentence to generate fragments for
 * @param {string} sentenceText - The Spanish sentence text
 * @param {string} translation - The English translation (optional)
 * @returns {Promise<{success: boolean, fragments?: Array, error?: string}>}
 */
export async function generateFragmentsForSentence(sentenceId, sentenceText, translation = null) {
  console.log('[GenerateFragments] Starting for sentence:', sentenceId)

  try {
    // Call the fragment generation edge function
    const { data, error } = await supabase.functions.invoke('generate-fragments', {
      body: {
        sentenceId,
        sentenceText,
        translation
      }
    })

    if (error) {
      throw new Error(`Fragment generation failed: ${error.message}`)
    }

    console.log('[GenerateFragments] Generated fragments:', data)

    return {
      success: true,
      fragments: data.fragments
    }

  } catch (error) {
    console.error('[GenerateFragments] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Recalculate phrase occurrences for a sentence
 * Matches existing phrases against the sentence text
 *
 * @param {string} sentenceId - The sentence to check
 * @param {string} sentenceText - The Spanish sentence text
 * @param {string} chapterId - The chapter ID (for denormalized storage)
 */
export async function recalculatePhraseOccurrences(sentenceId, sentenceText, chapterId) {
  console.log('[RecalculatePhrases] Starting for sentence:', sentenceId)

  try {
    // Get all active phrases
    const { data: phrases, error: phrasesError } = await supabase
      .from('phrases')
      .select('phrase_id, phrase_text')

    if (phrasesError) {
      throw new Error(`Could not fetch phrases: ${phrasesError.message}`)
    }

    const sentenceLower = sentenceText.toLowerCase()
    const occurrences = []

    for (const phrase of (phrases || [])) {
      const phraseLower = phrase.phrase_text.toLowerCase()
      let startIndex = 0
      let foundIndex

      // Find all occurrences of this phrase in the sentence
      while ((foundIndex = sentenceLower.indexOf(phraseLower, startIndex)) !== -1) {
        // Calculate word positions (approximate)
        const beforeText = sentenceText.substring(0, foundIndex)
        const startPosition = beforeText.split(/\s+/).filter(w => w).length + 1
        const phraseWordCount = phrase.phrase_text.split(/\s+/).filter(w => w).length
        const endPosition = startPosition + phraseWordCount - 1

        occurrences.push({
          phrase_id: phrase.phrase_id,
          sentence_id: sentenceId,
          chapter_id: chapterId,
          start_position: startPosition,
          end_position: endPosition
        })

        startIndex = foundIndex + 1
      }
    }

    if (occurrences.length > 0) {
      const { error: insertError } = await supabase
        .from('phrase_occurrences')
        .insert(occurrences)

      if (insertError) {
        console.error('[RecalculatePhrases] Insert error:', insertError)
      }
    }

    console.log('[RecalculatePhrases] Found', occurrences.length, 'phrase occurrences')

    return { success: true, count: occurrences.length }

  } catch (error) {
    console.error('[RecalculatePhrases] Error:', error)
    return { success: false, error: error.message }
  }
}
