/**
 * Progress Tracking Hook - FSRS Implementation
 *
 * Handles updating user progress when reviewing flashcards.
 * Uses FSRS algorithm for scheduling instead of custom mastery/health system.
 */

import { supabase } from '../../lib/supabase'
import {
  scheduleCard,
  markCardAsSeen,
  stabilityToMastery,
  calculateRetrievability,
  getStateName
} from '../../services/fsrsService'

export default function useProgressTracking(userId) {

  /**
   * Log a review event to user_review_history for activity tracking
   */
  async function logReviewEvent(card, difficulty) {
    // Use same robust detection as updateProgress
    const isPhrase = card.card_type === 'phrase' || (card.phrase_id && !card.lemma_id)

    const reviewData = {
      user_id: userId,
      reviewed_at: new Date().toISOString(),
      difficulty: difficulty,
      // Set the appropriate ID based on card type
      lemma_id: isPhrase ? null : (card.lemma_id || null),
      phrase_id: isPhrase ? card.phrase_id : null
    }

    const { error } = await supabase
      .from('user_review_history')
      .insert(reviewData)

    if (error) {
      console.error('❌ Failed to log review event:', error)
    }
  }

  /**
   * Update progress for a card after user response
   * Supports both lemmas and phrases
   *
   * @param {Object} card - Card that was reviewed
   * @param {string} difficulty - 'again' | 'hard' | 'got-it' (or legacy 'dont-know' | 'easy')
   * @param {boolean} isExposure - If true, only update last_seen_at (exposure card)
   * @returns {Object} - { success, newStability, newDifficulty, dueDate, ... }
   */
  async function updateProgress(card, difficulty, isExposure = false) {
    if (!userId || !card) return { success: false }

    try {
      // Determine if this is a phrase or lemma card
      // Check both card_type AND presence of phrase_id (for robustness)
      const isPhrase = card.card_type === 'phrase' || (card.phrase_id && !card.lemma_id)
      const tableName = isPhrase ? 'user_phrase_progress' : 'user_lemma_progress'
      const idField = isPhrase ? 'phrase_id' : 'lemma_id'
      const cardId = isPhrase ? card.phrase_id : (card.lemma_id || card.vocab_id)

      // Validate we have a valid cardId
      if (!cardId) {
        console.error('❌ No valid card ID found:', { card_type: card.card_type, phrase_id: card.phrase_id, lemma_id: card.lemma_id })
        return { success: false, error: 'No valid card ID' }
      }

      // Handle exposure cards differently - only update last_seen_at
      if (isExposure || card.isExposure) {
        const exposureUpdate = markCardAsSeen(card)

        const { data: expResult, error } = await supabase
          .from(tableName)
          .upsert({
            user_id: userId,
            [idField]: cardId,
            last_seen_at: exposureUpdate.last_seen_at
          }, {
            onConflict: `user_id,${idField}`
          })
          .select()

        if (error) {
          console.error('❌ Exposure upsert error for', tableName, ':', error)
          throw error
        }

        // Still update daily stats for exposure reviews
        await updateDailyStats(userId)

        return {
          success: true,
          isExposure: true,
          message: 'Exposure check complete'
        }
      }

      // Regular review - use FSRS scheduling
      const scheduledCard = scheduleCard(card, difficulty)

      // Build progress update with FSRS fields
      // Note: user_phrase_progress has fewer columns than user_lemma_progress
      const progressUpdate = {
        // FSRS fields (required for both tables)
        stability: scheduledCard.stability,
        difficulty: scheduledCard.difficulty,
        due_date: scheduledCard.due_date,
        fsrs_state: scheduledCard.fsrs_state,
        reps: scheduledCard.reps,
        lapses: scheduledCard.lapses,
        last_seen_at: scheduledCard.last_seen_at,

        // Legacy fields that exist in both tables
        mastery_level: stabilityToMastery(scheduledCard.stability),
        health: calculateRetrievability(scheduledCard)
      }

      // These columns only exist in user_lemma_progress, not user_phrase_progress
      if (!isPhrase) {
        progressUpdate.total_reviews = scheduledCard.total_reviews
        progressUpdate.last_reviewed_at = scheduledCard.last_reviewed_at
        progressUpdate.updated_at = new Date().toISOString()

        // Update correct_reviews for non-"again" responses (lemmas only)
        if (difficulty !== 'again' && difficulty !== 'dont-know') {
          progressUpdate.correct_reviews = (card.correct_reviews || 0) + 1
          progressUpdate.last_correct_review_at = new Date().toISOString()
        }
      }

      // Upsert to database
      const upsertData = {
        user_id: userId,
        [idField]: cardId,
        ...progressUpdate
      }

      const { data: upsertResult, error: progressError } = await supabase
        .from(tableName)
        .upsert(upsertData, {
          onConflict: `user_id,${idField}`
        })
        .select()

      if (progressError) {
        console.error('❌ Upsert error for', tableName, ':', progressError)
        throw progressError
      }

      // Update daily stats
      await updateDailyStats(userId)

      // Log review event for activity tracking
      await logReviewEvent(card, difficulty)

      // Calculate human-readable info for UI
      const dueInfo = formatDueDate(scheduledCard.due_date)

      return {
        success: true,
        // FSRS results
        newStability: scheduledCard.stability,
        newDifficulty: scheduledCard.difficulty,
        dueDate: scheduledCard.due_date,
        dueFormatted: dueInfo,
        fsrsState: getStateName(scheduledCard.fsrs_state),
        reps: scheduledCard.reps,
        lapses: scheduledCard.lapses,
        // Legacy compatibility
        newMastery: progressUpdate.mastery_level,
        newHealth: progressUpdate.health,
        // No time gate in FSRS - always can progress
        timeGateMessage: null
      }

    } catch (error) {
      console.error('Error updating progress:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update daily stats
   */
  async function updateDailyStats(userId) {
    const today = new Date().toISOString().split('T')[0]

    try {
      const { data: existingStats, error: fetchError } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('review_date', today)
        .maybeSingle()

      if (fetchError) {
        console.error('Error fetching daily stats:', fetchError)
        return
      }

      if (existingStats) {
        // Update existing
        const { error: updateError } = await supabase
          .from('user_daily_stats')
          .update({
            words_reviewed: (existingStats.words_reviewed || 0) + 1
          })
          .eq('user_id', userId)
          .eq('review_date', today)

        if (updateError) {
          console.error('Daily stats update error:', updateError)
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('user_daily_stats')
          .insert({
            user_id: userId,
            review_date: today,
            words_reviewed: 1,
            current_streak: 1
          })

        if (insertError) {
          console.error('Daily stats insert error:', insertError)
        }
      }

      // Update streak logic
      await updateStreak(userId, today)

    } catch (error) {
      console.error('Daily stats error:', error)
    }
  }

  /**
   * Update streak calculation
   */
  async function updateStreak(userId, today) {
    const { data: recentStats } = await supabase
      .from('user_daily_stats')
      .select('review_date')
      .eq('user_id', userId)
      .order('review_date', { ascending: false })
      .limit(2)

    if (!recentStats || recentStats.length === 0) return

    const dates = recentStats.map(s => s.review_date)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const hasYesterday = dates.includes(yesterday)
    const hasToday = dates.includes(today)

    if (hasToday && !hasYesterday) {
      // New streak started
      await supabase
        .from('user_daily_stats')
        .update({ current_streak: 1 })
        .eq('user_id', userId)
        .eq('review_date', today)
    }
  }

  return {
    updateProgress
  }
}

/**
 * Format due date for display
 *
 * @param {string} dueDate - ISO date string
 * @returns {string} - Human readable format
 */
function formatDueDate(dueDate) {
  if (!dueDate) return 'Now'

  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due - now

  if (diffMs <= 0) return 'Now'

  const diffMin = diffMs / (1000 * 60)
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffMin < 60) return `${Math.round(diffMin)} min`
  if (diffHours < 24) return `${Math.round(diffHours)} hr`
  if (diffDays < 7) return `${Math.round(diffDays)} days`
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks`

  return `${Math.round(diffDays / 30)} months`
}
