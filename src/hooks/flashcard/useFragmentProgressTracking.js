/**
 * Fragment Progress Tracking Hook - FSRS Implementation for Fragments
 *
 * Handles updating user progress when reviewing fragment flashcards.
 * Uses the fragment-specific FSRS scheduler (lower retention = longer intervals).
 */

import { supabase } from '../../lib/supabase'
import {
  scheduleFragmentCard,
  getTimeUntilDue
} from '../../services/fsrsService'

export default function useFragmentProgressTracking(userId) {

  /**
   * Update progress for a fragment after user response
   *
   * @param {Object} fragment - Fragment card that was reviewed
   * @param {string} difficulty - 'again' | 'hard' | 'got-it' | 'easy'
   * @returns {Object} - { success, newStability, newDifficulty, dueDate, dueFormatted, ... }
   */
  async function updateFragmentProgress(fragment, difficulty) {
    if (!userId || !fragment?.fragment_id) {
      console.error('❌ Missing userId or fragment_id')
      return { success: false }
    }

    try {
      // Schedule the fragment using FSRS (fragment-specific scheduler)
      const scheduledFragment = scheduleFragmentCard(fragment, difficulty)

      const progressUpdate = {
        user_id: userId,
        fragment_id: fragment.fragment_id,
        stability: scheduledFragment.stability,
        difficulty: scheduledFragment.difficulty,
        reps: scheduledFragment.reps,
        lapses: scheduledFragment.lapses,
        fsrs_state: scheduledFragment.fsrs_state,
        last_review_at: scheduledFragment.last_review_at,
        next_review_at: scheduledFragment.next_review_at,
        last_seen_at: scheduledFragment.last_seen_at,
        updated_at: new Date().toISOString()
      }

      // Upsert progress
      const { error } = await supabase
        .from('user_fragment_progress')
        .upsert(progressUpdate, {
          onConflict: 'user_id,fragment_id'
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Failed to update fragment progress:', error)
        return { success: false, error: error.message }
      }

      // Calculate formatted due date for UI feedback
      const timeInfo = getTimeUntilDue({
        due_date: scheduledFragment.next_review_at
      })

      console.log('✅ Fragment progress updated:', {
        fragment_id: fragment.fragment_id,
        difficulty,
        newStability: scheduledFragment.stability,
        nextReview: scheduledFragment.next_review_at,
        dueFormatted: timeInfo.formatted
      })

      return {
        success: true,
        newStability: scheduledFragment.stability,
        newDifficulty: scheduledFragment.difficulty,
        dueDate: scheduledFragment.next_review_at,
        dueFormatted: timeInfo.formatted,
        fsrsState: scheduledFragment.fsrs_state,
        reps: scheduledFragment.reps,
        lapses: scheduledFragment.lapses,
        lastReviewAt: scheduledFragment.last_review_at
      }

    } catch (err) {
      console.error('❌ Error updating fragment progress:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * Update chapter fragment progress after completing a session
   *
   * @param {string} chapterId - Chapter UUID
   * @param {number} fragmentsReviewed - Number of fragments reviewed in this session
   * @param {number} lastSentenceOrder - Last sentence order seen
   * @param {number} lastFragmentOrder - Last fragment order within that sentence
   * @returns {Object} - Updated progress record
   */
  async function updateChapterProgress(
    chapterId,
    fragmentsReviewed,
    lastSentenceOrder,
    lastFragmentOrder
  ) {
    if (!userId || !chapterId) {
      console.error('❌ Missing userId or chapterId')
      return { success: false }
    }

    try {
      // Get current progress
      const { data: currentProgress, error: fetchError } = await supabase
        .from('user_chapter_fragment_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('chapter_id', chapterId)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching progress:', fetchError)
        return { success: false, error: fetchError.message }
      }

      const newFragmentsSeen = (currentProgress?.fragments_seen || 0) + fragmentsReviewed
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
        console.error('Error updating chapter progress:', updateError)
        return { success: false, error: updateError.message }
      }

      console.log('✅ Chapter fragment progress updated:', {
        chapterId,
        fragmentsReviewed,
        newFragmentsSeen,
        isReadComplete
      })

      return {
        success: true,
        progress: updatedProgress,
        isReadComplete
      }

    } catch (err) {
      console.error('❌ Error updating chapter progress:', err)
      return { success: false, error: err.message }
    }
  }

  /**
   * Update daily activity stats after fragment review
   * Increments words_reviewed count for today
   */
  async function updateDailyStats() {
    if (!userId) return

    try {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]

      // Try to increment existing row
      const { data: existing, error: fetchError } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('review_date', dateStr)
        .single()

      if (existing) {
        // Update existing row
        await supabase
          .from('user_daily_stats')
          .update({
            words_reviewed: (existing.words_reviewed || 0) + 1
          })
          .eq('user_id', userId)
          .eq('review_date', dateStr)
      } else if (fetchError?.code === 'PGRST116') {
        // Insert new row for today
        await supabase
          .from('user_daily_stats')
          .insert({
            user_id: userId,
            review_date: dateStr,
            words_reviewed: 1,
            new_words_introduced: 0
          })
      }

    } catch (err) {
      // Non-critical - just log
      console.error('Error updating daily stats:', err)
    }
  }

  return {
    updateFragmentProgress,
    updateChapterProgress,
    updateDailyStats
  }
}
