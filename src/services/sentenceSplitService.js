/**
 * Sentence Split Service
 *
 * Handles the complex operation of splitting a single sentence into multiple sentences.
 * This involves:
 * 1. Creating new sentences with proper ordering
 * 2. Reordering all subsequent sentences in the chapter
 * 3. Deleting words, fragments, phrase_occurrences for original
 * 4. Generating new words for each new sentence
 * 5. Generating new fragments via AI
 * 6. Recalculating phrase occurrences
 * 7. Cleaning up user progress
 * 8. Deleting original sentence
 */

import { supabase } from '../lib/supabase'

/**
 * Split a sentence into multiple sentences
 *
 * @param {string} originalSentenceId - The sentence to split
 * @param {Array<{text: string, translation: string, isParagraphStart: boolean}>} newSentences - Array of new sentence data
 * @returns {Promise<{success: boolean, newSentenceIds?: string[], error?: string}>}
 */
export async function splitSentence(originalSentenceId, newSentences) {
  console.log('[SplitSentence] Starting split operation', { originalSentenceId, newSentences })

  try {
    // Call the database function which bypasses RLS
    const { data, error } = await supabase.rpc('split_sentence', {
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
      throw new Error(data.error || 'Split operation failed')
    }

    // Generate words for each new sentence using database function
    console.log('[SplitSentence] Generating words for new sentences')
    for (const sentenceId of (data.newSentenceIds || [])) {
      const { data: wordResult, error: wordError } = await supabase.rpc('generate_words_for_sentence', {
        p_sentence_id: sentenceId
      })

      if (wordError) {
        console.error('[SplitSentence] Error generating words for', sentenceId, wordError)
      } else {
        console.log('[SplitSentence] Word generation result:', wordResult)
      }
    }

    console.log('[SplitSentence] Split complete!')

    return {
      success: true,
      newSentenceIds: data.newSentenceIds,
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
 * Generate word entries for a sentence
 * Parses the sentence text and creates word records
 */
async function generateWordsForSentence(sentenceId, sentenceText) {
  // Simple word tokenization - split on whitespace and punctuation boundaries
  // This is a simplified version - a real implementation might use NLP
  const words = tokenizeSpanish(sentenceText)

  const wordRecords = words.map((word, index) => ({
    sentence_id: sentenceId,
    word_text: word.text,
    word_position: index + 1,
    is_punctuation: word.isPunctuation
  }))

  if (wordRecords.length > 0) {
    const { error } = await supabase
      .from('words')
      .insert(wordRecords)

    if (error) {
      console.error('[generateWordsForSentence] Error:', error)
    }
  }
}

/**
 * Simple Spanish tokenizer
 * Splits text into words and punctuation
 */
function tokenizeSpanish(text) {
  const tokens = []
  // Match words (including accented chars and ñ) or punctuation
  const regex = /([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)|([^\s\w])/g
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      // Word
      tokens.push({ text: match[1], isPunctuation: false })
    } else if (match[2]) {
      // Punctuation
      tokens.push({ text: match[2], isPunctuation: true })
    }
  }

  return tokens
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
