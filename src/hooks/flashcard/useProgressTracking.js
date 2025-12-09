import { supabase } from '../../lib/supabase'
import { getHealthBoost, applyHealthBoost } from '../../utils/healthCalculations'
import { calculateMasteryChange } from '../../utils/timeGateCalculations'

export default function useProgressTracking(userId) {

  async function updateProgress(card, difficulty) {
    if (!userId || !card) return { success: false }

    try {
      // Step 1: Calculate health boost
      // FIX: current_health might be an object with .health property, or a number, or undefined
      let currentHealthValue = 0
      if (typeof card.current_health === 'object' && card.current_health !== null) {
        currentHealthValue = card.current_health.health || 0
      } else if (typeof card.current_health === 'number') {
        currentHealthValue = card.current_health
      } else if (typeof card.health === 'number') {
        currentHealthValue = card.health
      }

      const healthBoost = getHealthBoost(difficulty)
      const newHealth = applyHealthBoost(currentHealthValue, healthBoost)

      console.log('🏥 Health calculation:', {
        currentHealthValue,
        healthBoost,
        newHealth,
        cardCurrentHealth: card.current_health,
        cardHealth: card.health
      })

      // Step 2: Calculate mastery change with time gate enforcement
      const masteryResult = calculateMasteryChange(card, difficulty)
      const newMastery = masteryResult.newMastery
      const timeGateMessage = masteryResult.timeGateInfo.message

      // Step 3: Update vocabulary progress
      const progressUpdate = {
        health: newHealth,
        mastery_level: newMastery,
        total_reviews: (card.total_reviews || 0) + 1,
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Update correct reviews and last_correct_review_at for non-"don't know"
      if (difficulty !== 'dont-know') {
        progressUpdate.correct_reviews = (card.correct_reviews || 0) + 1
        // FIX: Use masteryResult.timeGateInfo.canGainMastery instead of undefined canGainMastery
        if (masteryResult.timeGateInfo.canGainMastery) {
          progressUpdate.last_correct_review_at = new Date().toISOString()
        }
      }

      const { error: progressError } = await supabase
        .from('user_lemma_progress')
        .upsert({
          user_id: userId,
          lemma_id: card.lemma_id || card.vocab_id,  // Support both new and legacy
          ...progressUpdate
        }, {
          onConflict: 'user_id,lemma_id'
        })

      if (progressError) throw progressError

      // Step 4: Update daily stats
      await updateDailyStats(userId)

      // Step 5: Update chapter progress
      await updateChapterProgress(userId, card)

      return {
        success: true,
        newHealth,
        newMastery,
        masteryChange: masteryResult.masteryChange,
        timeGateMessage
      }

    } catch (error) {
      console.error('Error updating progress:', error)
      return { success: false, error: error.message }
    }
  }

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
        // Update existing - REMOVE updated_at (column doesn't exist)
        const { error: updateError } = await supabase
          .from('user_daily_stats')
          .update({
            words_reviewed: (existingStats.words_reviewed || 0) + 1
          })
          .eq('user_id', userId)
          .eq('review_date', today)

        if (updateError) {
          console.error('Daily stats update error:', updateError)
        } else {
          console.log('Daily stats updated:', {
            date: today,
            words_reviewed: (existingStats.words_reviewed || 0) + 1
          })
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('user_daily_stats')
          .insert({
            user_id: userId,
            review_date: today,
            words_reviewed: 1,  // Changed from total_reviews
            current_streak: 1
          })

        if (insertError) {
          console.error('Daily stats insert error:', insertError)
        } else {
          console.log('Daily stats created:', { date: today })
        }
      }

      // Update streak logic (simplified - can be enhanced)
      await updateStreak(userId, today)

    } catch (error) {
      console.error('Daily stats error:', error)
    }
  }

  async function updateStreak(userId, today) {
    // Get last 2 days of stats
    const { data: recentStats } = await supabase
      .from('user_daily_stats')
      .select('review_date')
      .eq('user_id', userId)
      .order('review_date', { ascending: false })
      .limit(2)

    if (!recentStats || recentStats.length === 0) return

    // Simple streak calculation
    const dates = recentStats.map(s => s.review_date)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const hasYesterday = dates.includes(yesterday)
    const hasToday = dates.includes(today)

    if (hasToday && hasYesterday) {
      // Continuing streak - increment handled elsewhere
    } else if (hasToday && !hasYesterday) {
      // New streak started
      await supabase
        .from('user_daily_stats')
        .update({ current_streak: 1 })
        .eq('user_id', userId)
        .eq('review_date', today)
    }
  }

  async function updateChapterProgress(userId, card) {
    // This is simplified - full logic in original Flashcards.jsx
    // Updates chapter unlock progress after each review
    try {
      // Get chapter info from card
      // Calculate new progress
      // Update user_chapter_progress table

      // For now, placeholder - can be enhanced with full unlock logic
    } catch (error) {
      console.error('Error updating chapter progress:', error)
    }
  }

  return {
    updateProgress
  }
}
