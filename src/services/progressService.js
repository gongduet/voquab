/**
 * Progress Service - Single source of truth for progress counts
 * Calls Supabase RPC functions for consistent data across app.
 */

import { supabase } from '../lib/supabase'

export async function getBookProgress(userId, bookId) {
  try {
    const { data, error } = await supabase.rpc('get_book_progress', {
      p_user_id: userId,
      p_book_id: bookId
    })
    if (error) throw error
    return {
      dueCount: data.due_count || 0,
      newCount: data.new_count || 0,
      mastered: data.mastered || 0,
      familiar: data.familiar || 0,
      learning: data.learning || 0,
      notSeen: data.not_seen || 0,
      totalVocab: data.total_vocab || 0,
      unlockedChapters: data.unlocked_chapters || [1],
      currentChapter: data.current_chapter || 1,
      totalChapters: data.total_chapters || 27
    }
  } catch (err) {
    console.error('getBookProgress failed:', err)
    return null
  }
}

export async function getSongProgress(userId, songId) {
  try {
    const { data, error } = await supabase.rpc('get_song_progress', {
      p_user_id: userId,
      p_song_id: songId
    })
    if (error) throw error
    return {
      dueCount: data.due_count || 0,
      newCount: data.new_count || 0,
      mastered: data.mastered || 0,
      familiar: data.familiar || 0,
      learning: data.learning || 0,
      notSeen: data.not_seen || 0,
      totalVocab: data.total_vocab || 0,
      sections: data.sections || 0
    }
  } catch (err) {
    console.error('getSongProgress failed:', err)
    return null
  }
}

export async function getGlobalDueCount(userId) {
  try {
    const now = new Date().toISOString()
    const [lemmaResult, phraseResult] = await Promise.all([
      supabase
        .from('user_lemma_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due_date', now),
      supabase
        .from('user_phrase_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due_date', now)
    ])
    return (lemmaResult.count || 0) + (phraseResult.count || 0)
  } catch (err) {
    console.error('getGlobalDueCount failed:', err)
    return 0
  }
}

export async function getBookChaptersProgress(userId, bookId) {
  try {
    const { data, error } = await supabase.rpc('get_book_chapters_progress', {
      p_user_id: userId,
      p_book_id: bookId
    })
    if (error) throw error
    return (data || []).map(ch => ({
      chapterNumber: ch.chapter_number,
      title: ch.title,
      totalVocab: ch.total_vocab,
      mastered: ch.mastered,
      familiar: ch.familiar,
      learning: ch.learning,
      notSeen: ch.not_seen,
      isUnlocked: ch.is_unlocked
    }))
  } catch (err) {
    console.error('getBookChaptersProgress failed:', err)
    return []
  }
}
