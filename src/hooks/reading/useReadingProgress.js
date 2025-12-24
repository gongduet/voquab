/**
 * Reading Progress Hook
 *
 * Handles database operations for reading mode:
 * - Fetching book progress and position
 * - Saving fragment/sentence progress
 * - Updating reading position
 *
 * Follows the pattern from useProgressTracking.js
 */

import { useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { scheduleCard, FSRSState } from '../../services/fsrsService'

/**
 * Score thresholds for FSRS rating mapping
 * Score >= 90% → Rating 3 (Good)
 * Score >= 60% → Rating 2 (Hard)
 * Score < 60% → Rating 1 (Again)
 */
const SCORE_THRESHOLDS = {
  GOOD: 0.9,
  HARD: 0.6
}

/**
 * Fragment response to score mapping
 */
const RESPONSE_SCORES = {
  'got-it': 1.0,
  'hard': 0.5,
  'need-help': 0.0
}

export default function useReadingProgress(userId) {
  // Memoize userId to prevent unnecessary recalculations
  const stableUserId = userId

  /**
   * Fetch the book ID for El Principito
   */
  async function fetchBookId() {
    const { data, error } = await supabase
      .from('books')
      .select('book_id')
      .eq('title', 'El Principito')
      .eq('language_code', 'es')
      .single()

    if (error) {
      console.error('Error fetching book ID:', error)
      return null
    }
    return data?.book_id
  }

  /**
   * Fetch user's reading progress for a book
   * Returns current position and stats
   */
  async function fetchBookProgress(bookId) {
    if (!userId || !bookId) return null

    const { data, error } = await supabase
      .from('user_book_reading_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (new user)
      console.error('Error fetching book progress:', error)
    }

    return data || null
  }

  /**
   * Initialize book progress for a new reader
   * Gets the first sentence of chapter 1
   */
  async function initializeBookProgress(bookId) {
    if (!userId || !bookId) return null

    // Get first chapter
    const { data: firstChapter } = await supabase
      .from('chapters')
      .select('chapter_id')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .single()

    if (!firstChapter) return null

    // Get first sentence of first chapter
    const { data: firstSentence } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', firstChapter.chapter_id)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (!firstSentence) return null

    // Create initial progress record
    const { data, error } = await supabase
      .from('user_book_reading_progress')
      .insert({
        user_id: userId,
        book_id: bookId,
        current_sentence_id: firstSentence.sentence_id,
        current_fragment_order: 1,
        furthest_sentence_id: firstSentence.sentence_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error initializing book progress:', error)
      return null
    }

    return data
  }

  /**
   * Fetch all completed sentences up to and including the current sentence
   * Used to render the "completed" portion of the book
   */
  async function fetchCompletedSentences(bookId, currentSentenceId) {
    if (!userId || !bookId) return []

    // First get the current sentence to know its order
    const { data: currentSentence } = await supabase
      .from('sentences')
      .select('sentence_order, chapter_id, chapters!inner(chapter_number)')
      .eq('sentence_id', currentSentenceId)
      .single()

    if (!currentSentence) return []

    // Get all sentences with progress that are before the current one
    const { data: sentencesWithProgress, error } = await supabase
      .from('user_sentence_progress')
      .select(`
        sentence_id,
        last_score,
        times_completed,
        sentences!inner (
          sentence_id,
          sentence_order,
          sentence_text,
          sentence_translation,
          is_paragraph_start,
          chapter_id,
          chapters!inner (
            chapter_id,
            chapter_number,
            title
          )
        )
      `)
      .eq('user_id', userId)
      .gt('times_completed', 0)

    if (error) {
      console.error('Error fetching completed sentences:', error)
      return []
    }

    // Filter to only sentences before current and sort
    const completed = (sentencesWithProgress || [])
      .filter(sp => {
        const s = sp.sentences
        const chapterNum = s.chapters.chapter_number
        const currentChapterNum = currentSentence.chapters.chapter_number

        // Before current chapter, or same chapter but earlier sentence
        return chapterNum < currentChapterNum ||
          (chapterNum === currentChapterNum && s.sentence_order < currentSentence.sentence_order)
      })
      .map(sp => ({
        ...sp.sentences,
        lastScore: sp.last_score,
        timesCompleted: sp.times_completed
      }))
      .sort((a, b) => {
        // Sort by chapter, then sentence order
        if (a.chapters.chapter_number !== b.chapters.chapter_number) {
          return a.chapters.chapter_number - b.chapters.chapter_number
        }
        return a.sentence_order - b.sentence_order
      })

    // Fetch fragments for all completed sentences
    if (completed.length > 0) {
      const sentenceIds = completed.map(s => s.sentence_id)
      const { data: allFragments, error: fragError } = await supabase
        .from('sentence_fragments')
        .select('*')
        .in('sentence_id', sentenceIds)
        .order('fragment_order', { ascending: true })

      if (!fragError && allFragments) {
        // Group fragments by sentence_id
        const fragmentsBySentence = {}
        for (const frag of allFragments) {
          if (!fragmentsBySentence[frag.sentence_id]) {
            fragmentsBySentence[frag.sentence_id] = []
          }
          fragmentsBySentence[frag.sentence_id].push(frag)
        }

        // Attach fragments to each sentence
        for (const sentence of completed) {
          sentence.fragments = fragmentsBySentence[sentence.sentence_id] || []
        }
      }
    }

    return completed
  }

  /**
   * Fetch completed sentences for a specific chapter only
   * Used for chapter-only view (performance optimization)
   * @param {string} chapterId - The chapter to fetch sentences for
   * @param {string} upToSentenceId - Only fetch sentences before this one (optional)
   */
  async function fetchChapterSentences(chapterId, upToSentenceId = null) {
    if (!userId || !chapterId) return []

    // Get the cutoff sentence order if provided
    let maxSentenceOrder = null
    if (upToSentenceId) {
      const { data: currentSentence } = await supabase
        .from('sentences')
        .select('sentence_order')
        .eq('sentence_id', upToSentenceId)
        .single()

      if (currentSentence) {
        maxSentenceOrder = currentSentence.sentence_order
      }
    }

    // Build query for sentences in this chapter that have been completed
    let query = supabase
      .from('user_sentence_progress')
      .select(`
        sentence_id,
        last_score,
        times_completed,
        is_highlighted,
        sentences!inner (
          sentence_id,
          sentence_order,
          sentence_text,
          sentence_translation,
          is_paragraph_start,
          chapter_id,
          chapters!inner (
            chapter_id,
            chapter_number,
            title
          )
        )
      `)
      .eq('user_id', userId)
      .eq('sentences.chapter_id', chapterId)
      .gt('times_completed', 0)

    const { data: sentencesWithProgress, error } = await query

    if (error) {
      console.error('Error fetching chapter sentences:', error)
      return []
    }

    // Filter and sort
    let completed = (sentencesWithProgress || [])
      .filter(sp => {
        // If we have a cutoff, only include sentences before it
        if (maxSentenceOrder !== null) {
          return sp.sentences.sentence_order < maxSentenceOrder
        }
        return true
      })
      .map(sp => ({
        ...sp.sentences,
        lastScore: sp.last_score,
        timesCompleted: sp.times_completed,
        is_highlighted: sp.is_highlighted
      }))
      .sort((a, b) => a.sentence_order - b.sentence_order)

    // Fetch fragments for all completed sentences
    if (completed.length > 0) {
      const sentenceIds = completed.map(s => s.sentence_id)
      const { data: allFragments, error: fragError } = await supabase
        .from('sentence_fragments')
        .select('*')
        .in('sentence_id', sentenceIds)
        .order('fragment_order', { ascending: true })

      if (!fragError && allFragments) {
        const fragmentsBySentence = {}
        for (const frag of allFragments) {
          if (!fragmentsBySentence[frag.sentence_id]) {
            fragmentsBySentence[frag.sentence_id] = []
          }
          fragmentsBySentence[frag.sentence_id].push(frag)
        }
        for (const sentence of completed) {
          sentence.fragments = fragmentsBySentence[sentence.sentence_id] || []
        }
      }
    }

    return completed
  }

  /**
   * Fetch chapter info by chapter_id
   */
  async function fetchChapterInfo(chapterId) {
    if (!chapterId) return null

    const { data, error } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number, title, book_id')
      .eq('chapter_id', chapterId)
      .single()

    if (error) {
      console.error('Error fetching chapter info:', error)
      return null
    }

    return data
  }

  /**
   * Fetch the first chapter of a book
   */
  async function fetchFirstChapter(bookId) {
    if (!bookId) return null

    const { data, error } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number, title, book_id')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching first chapter:', error)
      return null
    }

    return data
  }

  /**
   * Fetch a sentence with its fragments
   */
  async function fetchSentenceWithFragments(sentenceId) {
    if (!sentenceId) return null

    const { data: sentence, error: sentenceError } = await supabase
      .from('sentences')
      .select(`
        sentence_id,
        sentence_order,
        sentence_text,
        sentence_translation,
        is_paragraph_start,
        chapter_id,
        chapters!inner (
          chapter_id,
          chapter_number,
          title
        )
      `)
      .eq('sentence_id', sentenceId)
      .single()

    if (sentenceError) {
      console.error('Error fetching sentence:', sentenceError)
      return null
    }

    // Get fragments for this sentence
    const { data: fragments, error: fragmentError } = await supabase
      .from('sentence_fragments')
      .select('*')
      .eq('sentence_id', sentenceId)
      .order('fragment_order', { ascending: true })

    if (fragmentError) {
      console.error('Error fetching fragments:', fragmentError)
      return null
    }

    return {
      ...sentence,
      fragments: fragments || []
    }
  }

  /**
   * Fetch the next sentence after the given one
   */
  async function fetchNextSentence(currentSentenceId) {
    if (!currentSentenceId) return null

    // Get current sentence info
    const { data: current } = await supabase
      .from('sentences')
      .select('sentence_order, chapter_id, chapters!inner(chapter_number, book_id)')
      .eq('sentence_id', currentSentenceId)
      .single()

    if (!current) return null

    // Try to get next sentence in same chapter
    const { data: nextInChapter } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', current.chapter_id)
      .gt('sentence_order', current.sentence_order)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (nextInChapter) {
      return fetchSentenceWithFragments(nextInChapter.sentence_id)
    }

    // No more in this chapter, get first sentence of next chapter
    const { data: nextChapter } = await supabase
      .from('chapters')
      .select('chapter_id')
      .eq('book_id', current.chapters.book_id)
      .gt('chapter_number', current.chapters.chapter_number)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .single()

    if (!nextChapter) {
      // End of book
      return null
    }

    const { data: firstOfNextChapter } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', nextChapter.chapter_id)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (firstOfNextChapter) {
      return fetchSentenceWithFragments(firstOfNextChapter.sentence_id)
    }

    return null
  }

  /**
   * Fetch lightweight preview of the next sentence (just text and paragraph info)
   * Used for the blurred preview display
   */
  async function fetchNextSentencePreview(currentSentenceId) {
    if (!currentSentenceId) return null

    // Get current sentence info
    const { data: current } = await supabase
      .from('sentences')
      .select('sentence_order, chapter_id, chapters!inner(chapter_number, book_id)')
      .eq('sentence_id', currentSentenceId)
      .single()

    if (!current) return null

    // Try to get next sentence in same chapter
    const { data: nextInChapter } = await supabase
      .from('sentences')
      .select('sentence_id, sentence_text, is_paragraph_start, chapter_id')
      .eq('chapter_id', current.chapter_id)
      .gt('sentence_order', current.sentence_order)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (nextInChapter) {
      // Same chapter - include chapter number for consistency
      return {
        ...nextInChapter,
        chapter_number: current.chapters.chapter_number
      }
    }

    // No more in this chapter, get first sentence of next chapter
    const { data: nextChapter } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number')
      .eq('book_id', current.chapters.book_id)
      .gt('chapter_number', current.chapters.chapter_number)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .single()

    if (!nextChapter) {
      // End of book
      return null
    }

    const { data: firstOfNextChapter } = await supabase
      .from('sentences')
      .select('sentence_id, sentence_text, is_paragraph_start, chapter_id')
      .eq('chapter_id', nextChapter.chapter_id)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (firstOfNextChapter) {
      return {
        ...firstOfNextChapter,
        chapter_number: nextChapter.chapter_number
      }
    }

    return null
  }

  /**
   * Get the first sentence of a specific chapter
   */
  async function fetchChapterFirstSentence(bookId, chapterNumber) {
    const { data: chapter } = await supabase
      .from('chapters')
      .select('chapter_id')
      .eq('book_id', bookId)
      .eq('chapter_number', chapterNumber)
      .single()

    if (!chapter) return null

    const { data: firstSentence } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)
      .order('sentence_order', { ascending: true })
      .limit(1)
      .single()

    if (firstSentence) {
      return fetchSentenceWithFragments(firstSentence.sentence_id)
    }

    return null
  }

  /**
   * Fetch the previous sentence before the given one
   */
  async function fetchPreviousSentence(currentSentenceId) {
    if (!currentSentenceId) return null

    // Get current sentence info
    const { data: current } = await supabase
      .from('sentences')
      .select('sentence_order, chapter_id, chapters!inner(chapter_number, book_id)')
      .eq('sentence_id', currentSentenceId)
      .single()

    if (!current) return null

    // Try to get previous sentence in same chapter
    const { data: prevInChapter } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', current.chapter_id)
      .lt('sentence_order', current.sentence_order)
      .order('sentence_order', { ascending: false })
      .limit(1)
      .single()

    if (prevInChapter) {
      return fetchSentenceWithFragments(prevInChapter.sentence_id)
    }

    // No more in this chapter, get last sentence of previous chapter
    const { data: prevChapter } = await supabase
      .from('chapters')
      .select('chapter_id')
      .eq('book_id', current.chapters.book_id)
      .lt('chapter_number', current.chapters.chapter_number)
      .order('chapter_number', { ascending: false })
      .limit(1)
      .single()

    if (!prevChapter) {
      // Start of book
      return null
    }

    const { data: lastOfPrevChapter } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', prevChapter.chapter_id)
      .order('sentence_order', { ascending: false })
      .limit(1)
      .single()

    if (lastOfPrevChapter) {
      return fetchSentenceWithFragments(lastOfPrevChapter.sentence_id)
    }

    return null
  }

  /**
   * Get info about the previous chapter
   */
  async function fetchPreviousChapter(bookId, currentChapterNumber) {
    const { data: prevChapter } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number')
      .eq('book_id', bookId)
      .lt('chapter_number', currentChapterNumber)
      .order('chapter_number', { ascending: false })
      .limit(1)
      .single()

    return prevChapter || null
  }

  /**
   * Get info about the next chapter
   */
  async function fetchNextChapter(bookId, currentChapterNumber) {
    const { data: nextChapter } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number')
      .eq('book_id', bookId)
      .gt('chapter_number', currentChapterNumber)
      .order('chapter_number', { ascending: true })
      .limit(1)
      .single()

    return nextChapter || null
  }

  /**
   * Get the furthest sentence info
   */
  async function fetchFurthestPosition(bookId) {
    if (!userId || !bookId) return null

    const { data: progress } = await supabase
      .from('user_book_reading_progress')
      .select(`
        furthest_sentence_id,
        sentences:furthest_sentence_id (
          sentence_id,
          sentence_order,
          chapter_id,
          chapters!inner (
            chapter_id,
            chapter_number
          )
        )
      `)
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()

    if (!progress?.sentences) return null

    return {
      sentenceId: progress.furthest_sentence_id,
      sentenceOrder: progress.sentences.sentence_order,
      chapterId: progress.sentences.chapter_id,
      chapterNumber: progress.sentences.chapters.chapter_number
    }
  }

  /**
   * Update the user's current position in the book
   */
  async function updatePosition(bookId, sentenceId, fragmentOrder = 1) {
    if (!userId || !bookId) return

    const { error } = await supabase
      .from('user_book_reading_progress')
      .upsert({
        user_id: userId,
        book_id: bookId,
        current_sentence_id: sentenceId,
        current_fragment_order: fragmentOrder,
        last_activity_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,book_id'
      })

    if (error) {
      console.error('Error updating position:', error)
    }
  }

  /**
   * Update furthest position if this sentence is further than before
   */
  async function updateFurthestPosition(bookId, sentenceId) {
    if (!userId || !bookId) return

    // Get current furthest
    const { data: progress } = await supabase
      .from('user_book_reading_progress')
      .select('furthest_sentence_id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()

    if (!progress) return

    // Compare positions (need to check if new is further)
    const { data: currentSentence } = await supabase
      .from('sentences')
      .select('sentence_order, chapters!inner(chapter_number)')
      .eq('sentence_id', sentenceId)
      .single()

    const { data: furthestSentence } = await supabase
      .from('sentences')
      .select('sentence_order, chapters!inner(chapter_number)')
      .eq('sentence_id', progress.furthest_sentence_id)
      .single()

    if (!currentSentence || !furthestSentence) return

    const isNewFurther =
      currentSentence.chapters.chapter_number > furthestSentence.chapters.chapter_number ||
      (currentSentence.chapters.chapter_number === furthestSentence.chapters.chapter_number &&
        currentSentence.sentence_order > furthestSentence.sentence_order)

    if (isNewFurther) {
      await supabase
        .from('user_book_reading_progress')
        .update({ furthest_sentence_id: sentenceId })
        .eq('user_id', userId)
        .eq('book_id', bookId)
    }
  }

  /**
   * Save sentence completion with FSRS scheduling
   *
   * @param {string} sentenceId - The sentence that was completed
   * @param {number} score - Score from 0.0 to 1.0
   * @param {string[]} fragmentResults - Array of 'got-it' | 'hard' | 'need-help'
   */
  async function saveSentenceComplete(sentenceId, score, fragmentResults) {
    if (!userId || !sentenceId) return { success: false }

    try {
      // Get existing progress (if any)
      const { data: existingProgress } = await supabase
        .from('user_sentence_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId)
        .single()

      // Determine FSRS rating based on score
      let fsrsRating = 'again'
      if (score >= SCORE_THRESHOLDS.GOOD) {
        fsrsRating = 'got-it'
      } else if (score >= SCORE_THRESHOLDS.HARD) {
        fsrsRating = 'hard'
      }

      // Calculate FSRS scheduling
      const cardToSchedule = existingProgress || {
        stability: null,
        difficulty: null,
        due_date: null,
        fsrs_state: FSRSState.NEW,
        reps: 0,
        lapses: 0
      }

      const scheduledCard = scheduleCard(cardToSchedule, fsrsRating)

      // Build progress update
      const progressUpdate = {
        user_id: userId,
        sentence_id: sentenceId,
        stability: scheduledCard.stability,
        difficulty: scheduledCard.difficulty,
        due_date: scheduledCard.due_date,
        fsrs_state: scheduledCard.fsrs_state,
        reps: scheduledCard.reps,
        lapses: scheduledCard.lapses,
        last_seen_at: new Date().toISOString(),
        last_score: score,
        best_score: Math.max(score, existingProgress?.best_score || 0),
        last_fragment_results: fragmentResults,
        times_completed: (existingProgress?.times_completed || 0) + 1,
        updated_at: new Date().toISOString()
      }

      // Upsert progress
      const { error } = await supabase
        .from('user_sentence_progress')
        .upsert(progressUpdate, {
          onConflict: 'user_id,sentence_id'
        })

      if (error) {
        console.error('Error saving sentence progress:', error)
        return { success: false, error: error.message }
      }

      return {
        success: true,
        score,
        fsrsRating,
        dueDate: scheduledCard.due_date
      }

    } catch (error) {
      console.error('Error in saveSentenceComplete:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Increment aggregate stats in book progress
   */
  async function incrementFragmentStats(bookId, response) {
    if (!userId || !bookId) return

    const columnMap = {
      'got-it': 'fragments_got_it',
      'hard': 'fragments_hard',
      'need-help': 'fragments_need_help'
    }

    const column = columnMap[response]
    if (!column) return

    // Get current stats
    const { data: progress } = await supabase
      .from('user_book_reading_progress')
      .select('total_fragments_seen, fragments_got_it, fragments_hard, fragments_need_help')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()

    if (!progress) return

    const updates = {
      total_fragments_seen: (progress.total_fragments_seen || 0) + 1,
      [column]: (progress[column] || 0) + 1,
      last_activity_at: new Date().toISOString()
    }

    await supabase
      .from('user_book_reading_progress')
      .update(updates)
      .eq('user_id', userId)
      .eq('book_id', bookId)
  }

  /**
   * Increment sentences completed count
   */
  async function incrementSentencesCompleted(bookId) {
    if (!userId || !bookId) return

    const { data: progress } = await supabase
      .from('user_book_reading_progress')
      .select('total_sentences_completed')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single()

    if (!progress) return

    await supabase
      .from('user_book_reading_progress')
      .update({
        total_sentences_completed: (progress.total_sentences_completed || 0) + 1
      })
      .eq('user_id', userId)
      .eq('book_id', bookId)
  }

  /**
   * Calculate score from fragment results
   */
  function calculateScore(fragmentResults) {
    if (!fragmentResults || fragmentResults.length === 0) return 0

    const total = fragmentResults.reduce((sum, result) => {
      return sum + (RESPONSE_SCORES[result] || 0)
    }, 0)

    return total / fragmentResults.length
  }

  // Memoize the returned object to prevent infinite loops in consumers
  // The functions inside are stable (they only close over stableUserId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({
    // Fetch functions
    fetchBookId,
    fetchBookProgress,
    initializeBookProgress,
    fetchCompletedSentences,
    fetchChapterSentences,
    fetchChapterInfo,
    fetchFirstChapter,
    fetchSentenceWithFragments,
    fetchNextSentence,
    fetchNextSentencePreview,
    fetchPreviousSentence,
    fetchChapterFirstSentence,
    fetchPreviousChapter,
    fetchNextChapter,
    fetchFurthestPosition,

    // Update functions
    updatePosition,
    updateFurthestPosition,
    saveSentenceComplete,
    incrementFragmentStats,
    incrementSentencesCompleted,

    // Utilities
    calculateScore,
    RESPONSE_SCORES
  }), [stableUserId])  // Only recreate when userId changes
}
