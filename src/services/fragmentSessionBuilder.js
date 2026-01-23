/**
 * Fragment Session Builder - Builds flashcard sessions for sentence fragments
 *
 * Modes:
 * 1. Read Mode - Sequential fragments through a chapter
 * 2. Review Mode - Due fragments from all unlocked chapters
 */

import { supabase } from '../lib/supabase'

/**
 * Fragment session modes
 */
export const FragmentMode = {
  READ: 'read',
  REVIEW: 'review'
}

/**
 * Default target size for read mode sessions
 */
const DEFAULT_READ_SIZE = 15

/**
 * Default size for review mode sessions
 */
const DEFAULT_REVIEW_SIZE = 15

/**
 * Build a fragment Read Mode session
 *
 * Fetches fragments sequentially starting from the user's last position.
 * Extends to paragraph boundaries to avoid breaking mid-paragraph.
 *
 * @param {string} userId - User ID
 * @param {string} chapterId - Chapter UUID
 * @param {number} targetSize - Target number of fragments (default 15)
 * @returns {Object} - { mode, fragments, chapterId, totalInChapter, currentPosition, sectionInfo }
 */
export async function buildFragmentReadSession(userId, chapterId, targetSize = DEFAULT_READ_SIZE) {
  // 1. Get or create chapter fragment progress record
  let { data: chapterProgress, error: progressError } = await supabase
    .from('user_chapter_fragment_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (progressError && progressError.code !== 'PGRST116') {
    console.error('Error fetching chapter fragment progress:', progressError)
    return { error: progressError.message }
  }

  // 2. Get total fragments in chapter via RPC
  const { data: fragmentCount } = await supabase
    .rpc('get_chapter_fragment_stats', {
      p_user_id: userId,
      p_chapter_id: chapterId
    })

  const totalInChapter = fragmentCount?.[0]?.total_fragments || 0

  // If no progress exists, create it
  if (!chapterProgress) {
    const { data: newProgress, error: createError } = await supabase
      .from('user_chapter_fragment_progress')
      .insert({
        user_id: userId,
        chapter_id: chapterId,
        fragments_seen: 0,
        total_fragments: totalInChapter,
        last_fragment_order: 0,
        last_sentence_order: 0,
        is_read_complete: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating chapter fragment progress:', createError)
      return { error: createError.message }
    }

    chapterProgress = newProgress
  }

  // 3. Fetch all fragments for the chapter, ordered properly
  // We'll filter to the starting position in JS (PostgREST complex OR with foreign tables is problematic)
  const { data: allFragments, error: fragmentError } = await supabase
    .from('sentence_fragments')
    .select(`
      fragment_id,
      fragment_order,
      fragment_text,
      fragment_translation,
      start_word_position,
      end_word_position,
      context_note,
      sentence_id,
      sentences!inner (
        sentence_id,
        sentence_text,
        sentence_translation,
        sentence_order,
        is_paragraph_start,
        chapter_id,
        chapters!inner (
          chapter_id,
          chapter_number,
          title
        )
      )
    `)
    .eq('sentences.chapter_id', chapterId)
    .order('sentences(sentence_order)', { ascending: true })
    .order('fragment_order', { ascending: true })

  if (fragmentError) {
    console.error('Error fetching fragments:', fragmentError)
    return { error: fragmentError.message }
  }

  // Filter to fragments after the user's last position
  const lastSentenceOrder = chapterProgress.last_sentence_order || 0
  const lastFragmentOrder = chapterProgress.last_fragment_order || 0

  const fragments = (allFragments || []).filter(f => {
    const sentenceOrder = f.sentences.sentence_order
    // Include if: sentence is after last, OR same sentence but fragment is after last
    return sentenceOrder > lastSentenceOrder ||
      (sentenceOrder === lastSentenceOrder && f.fragment_order > lastFragmentOrder)
  })

  if (!fragments || fragments.length === 0) {
    // Check if chapter is complete
    if (chapterProgress.fragments_seen >= totalInChapter && totalInChapter > 0) {
      return {
        mode: FragmentMode.READ,
        fragments: [],
        chapterId,
        totalInChapter,
        currentPosition: chapterProgress.fragments_seen,
        isComplete: true,
        message: 'All fragments in this chapter have been reviewed!'
      }
    }

    return {
      mode: FragmentMode.READ,
      fragments: [],
      chapterId,
      totalInChapter,
      currentPosition: 0,
      message: 'No fragments found in this chapter'
    }
  }

  // 4. Apply paragraph boundary logic
  let sessionFragments = []

  for (let i = 0; i < fragments.length && sessionFragments.length < targetSize; i++) {
    sessionFragments.push(fragments[i])
  }

  // Extend to paragraph boundary if we haven't reached end of chapter
  if (sessionFragments.length > 0 && sessionFragments.length >= targetSize) {
    const lastFragment = sessionFragments[sessionFragments.length - 1]
    const lastSentenceOrderInSession = lastFragment.sentences.sentence_order

    // Find remaining fragments in the same paragraph
    for (let i = sessionFragments.length; i < fragments.length; i++) {
      const fragment = fragments[i]

      // Stop if we hit a new paragraph (next sentence has is_paragraph_start = true)
      if (fragment.sentences.is_paragraph_start &&
          fragment.sentences.sentence_order > lastSentenceOrderInSession) {
        break
      }

      // Add fragments until paragraph break
      sessionFragments.push(fragment)
    }
  }

  // 5. Calculate max fragment_order per sentence (for isLastFragmentInSentence flag)
  const maxFragmentOrderBySentence = new Map()
  for (const f of allFragments || []) {
    const sentenceOrder = f.sentences.sentence_order
    const currentMax = maxFragmentOrderBySentence.get(sentenceOrder) || 0
    if (f.fragment_order > currentMax) {
      maxFragmentOrderBySentence.set(sentenceOrder, f.fragment_order)
    }
  }

  // 6. Flatten and format fragments for card display
  const formattedFragments = sessionFragments.map(f => {
    const sentenceOrder = f.sentences.sentence_order
    const maxOrder = maxFragmentOrderBySentence.get(sentenceOrder) || f.fragment_order
    const isLastFragmentInSentence = f.fragment_order === maxOrder

    return {
      fragment_id: f.fragment_id,
      card_type: 'fragment',
      fragment_text: f.fragment_text,
      fragment_translation: f.fragment_translation,
      sentence_text: f.sentences.sentence_text,
      sentence_translation: f.sentences.sentence_translation,
      start_word_position: f.start_word_position,
      end_word_position: f.end_word_position,
      context_note: f.context_note,
      sentence_order: f.sentences.sentence_order,
      fragment_order: f.fragment_order,
      chapter_number: f.sentences.chapters.chapter_number,
      chapter_title: f.sentences.chapters.title,
      is_paragraph_start: f.sentences.is_paragraph_start,
      isLastFragmentInSentence,
      // FSRS fields - will be populated from progress if exists
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      fsrs_state: 0,
      due_date: null,
      next_review_at: null,
      last_review_at: null,
      isNew: true
    }
  })

  // 7. Fetch existing progress for these fragments
  const fragmentIds = formattedFragments.map(f => f.fragment_id)
  const { data: progressData } = await supabase
    .from('user_fragment_progress')
    .select('*')
    .eq('user_id', userId)
    .in('fragment_id', fragmentIds)

  if (progressData && progressData.length > 0) {
    const progressMap = new Map(progressData.map(p => [p.fragment_id, p]))

    formattedFragments.forEach(f => {
      const progress = progressMap.get(f.fragment_id)
      if (progress) {
        f.stability = progress.stability
        f.difficulty = progress.difficulty
        f.reps = progress.reps
        f.lapses = progress.lapses
        f.fsrs_state = progress.fsrs_state
        f.next_review_at = progress.next_review_at
        f.last_review_at = progress.last_review_at
        f.isNew = progress.reps === 0
      }
    })
  }

  // 7. Calculate section info
  const sectionNumber = Math.ceil((chapterProgress.fragments_seen + 1) / targetSize)
  const totalSections = Math.ceil(totalInChapter / targetSize)

  return {
    mode: FragmentMode.READ,
    fragments: formattedFragments,
    chapterId,
    totalInChapter,
    currentPosition: chapterProgress.fragments_seen,
    sectionInfo: {
      sectionNumber,
      totalSections,
      fragmentsInSection: formattedFragments.length
    },
    chapterProgress
  }
}

/**
 * Build a fragment Review Mode session
 *
 * Fetches due fragments from all unlocked chapters, sorted by most overdue first.
 *
 * @param {string} userId - User ID
 * @param {string} bookId - Book UUID
 * @param {number} sessionSize - Number of fragments to include (default 15)
 * @returns {Object} - { mode, fragments, totalDue }
 */
export async function buildFragmentReviewSession(userId, bookId, sessionSize = DEFAULT_REVIEW_SIZE) {
  // 1. Get user's session size preference
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('cards_per_session')
    .eq('user_id', userId)
    .single()

  const effectiveSessionSize = userSettings?.cards_per_session || sessionSize

  // 2. Get due fragments across all unlocked chapters
  // Due fragments: next_review_at <= now AND fsrs_state != 0 (not new)
  const now = new Date().toISOString()

  const { data: dueFragments, error: dueError } = await supabase
    .from('user_fragment_progress')
    .select(`
      *,
      sentence_fragments!inner (
        fragment_id,
        fragment_text,
        fragment_translation,
        fragment_order,
        start_word_position,
        end_word_position,
        context_note,
        sentences!inner (
          sentence_id,
          sentence_text,
          sentence_translation,
          sentence_order,
          chapters!inner (
            chapter_id,
            chapter_number,
            title,
            book_id
          )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('sentence_fragments.sentences.chapters.book_id', bookId)
    .lte('next_review_at', now)
    .neq('fsrs_state', 0) // Not new
    .order('next_review_at', { ascending: true }) // Most overdue first
    .limit(effectiveSessionSize)

  if (dueError) {
    console.error('Error fetching due fragments:', dueError)
    return { error: dueError.message }
  }

  // 3. Get total due count for display
  const { count: totalDue } = await supabase
    .from('user_fragment_progress')
    .select('progress_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review_at', now)
    .neq('fsrs_state', 0)

  if (!dueFragments || dueFragments.length === 0) {
    return {
      mode: FragmentMode.REVIEW,
      fragments: [],
      totalDue: 0,
      message: 'No fragments due for review!'
    }
  }

  // 4. Get sentence IDs to find max fragment_order for each sentence
  const sentenceIds = [...new Set(dueFragments.map(p => p.sentence_fragments.sentences.sentence_id))]

  // 5. Query max fragment_order for each sentence
  const { data: sentenceFragmentCounts } = await supabase
    .from('sentence_fragments')
    .select('sentence_id, fragment_order')
    .in('sentence_id', sentenceIds)

  // Build map of sentence_id -> max fragment_order
  const maxFragmentOrderBySentence = new Map()
  if (sentenceFragmentCounts) {
    for (const sf of sentenceFragmentCounts) {
      const currentMax = maxFragmentOrderBySentence.get(sf.sentence_id) || 0
      if (sf.fragment_order > currentMax) {
        maxFragmentOrderBySentence.set(sf.sentence_id, sf.fragment_order)
      }
    }
  }

  // 6. Format fragments for card display
  const formattedFragments = dueFragments.map(p => {
    const sentenceId = p.sentence_fragments.sentences.sentence_id
    const maxOrder = maxFragmentOrderBySentence.get(sentenceId) || p.sentence_fragments.fragment_order
    const isLastFragmentInSentence = p.sentence_fragments.fragment_order === maxOrder

    return {
      fragment_id: p.fragment_id,
      card_type: 'fragment',
      fragment_text: p.sentence_fragments.fragment_text,
      fragment_translation: p.sentence_fragments.fragment_translation,
      sentence_text: p.sentence_fragments.sentences.sentence_text,
      sentence_translation: p.sentence_fragments.sentences.sentence_translation,
      start_word_position: p.sentence_fragments.start_word_position,
      end_word_position: p.sentence_fragments.end_word_position,
      context_note: p.sentence_fragments.context_note,
      sentence_order: p.sentence_fragments.sentences.sentence_order,
      fragment_order: p.sentence_fragments.fragment_order,
      chapter_number: p.sentence_fragments.sentences.chapters.chapter_number,
      chapter_title: p.sentence_fragments.sentences.chapters.title,
      isLastFragmentInSentence,
      // FSRS fields from progress
      stability: p.stability,
      difficulty: p.difficulty,
      reps: p.reps,
      lapses: p.lapses,
      fsrs_state: p.fsrs_state,
      next_review_at: p.next_review_at,
      last_review_at: p.last_review_at,
      isNew: false
    }
  })

  return {
    mode: FragmentMode.REVIEW,
    fragments: formattedFragments,
    totalDue: totalDue || dueFragments.length
  }
}

/**
 * Update chapter fragment progress after completing a read session
 *
 * @param {string} userId - User ID
 * @param {string} chapterId - Chapter UUID
 * @param {number} fragmentsSeen - Number of new fragments seen in this session
 * @param {number} lastSentenceOrder - Last sentence order seen
 * @param {number} lastFragmentOrder - Last fragment order within that sentence
 * @returns {Object} - Updated progress record
 */
export async function updateChapterFragmentProgress(
  userId,
  chapterId,
  fragmentsSeen,
  lastSentenceOrder,
  lastFragmentOrder
) {
  // Get current progress
  const { data: currentProgress, error: fetchError } = await supabase
    .from('user_chapter_fragment_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching progress:', fetchError)
    return { error: fetchError.message }
  }

  const newFragmentsSeen = (currentProgress?.fragments_seen || 0) + fragmentsSeen
  const totalFragments = currentProgress?.total_fragments || 0
  const isReadComplete = newFragmentsSeen >= totalFragments && totalFragments > 0

  const { data: updatedProgress, error: updateError } = await supabase
    .from('user_chapter_fragment_progress')
    .upsert({
      user_id: userId,
      chapter_id: chapterId,
      fragments_seen: newFragmentsSeen,
      total_fragments: totalFragments,
      last_sentence_order: lastSentenceOrder,
      last_fragment_order: lastFragmentOrder,
      is_read_complete: isReadComplete,
      completed_at: isReadComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,chapter_id'
    })
    .select()
    .single()

  if (updateError) {
    console.error('Error updating progress:', updateError)
    return { error: updateError.message }
  }

  return updatedProgress
}

/**
 * Get fragments due count for a book (for dashboard display)
 *
 * @param {string} userId - User ID
 * @param {string} bookId - Book UUID
 * @returns {number} - Count of due fragments
 */
export async function getFragmentsDueCount(userId, bookId) {
  const { data, error } = await supabase
    .rpc('get_fragments_due_count', {
      p_user_id: userId,
      p_book_id: bookId
    })

  if (error) {
    console.error('Error getting fragments due count:', error)
    return 0
  }

  return data || 0
}

/**
 * Get all chapter fragment stats for a book (for chapter cards)
 *
 * @param {string} userId - User ID
 * @param {string} bookId - Book UUID
 * @returns {Array} - Array of chapter stats
 */
export async function getBookFragmentStats(userId, bookId) {
  const { data, error } = await supabase
    .rpc('get_book_fragment_stats', {
      p_user_id: userId,
      p_book_id: bookId
    })

  if (error) {
    console.error('Error getting book fragment stats:', error)
    return []
  }

  return data || []
}

export default {
  FragmentMode,
  buildFragmentReadSession,
  buildFragmentReviewSession,
  updateChapterFragmentProgress,
  getFragmentsDueCount,
  getBookFragmentStats
}
