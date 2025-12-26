/**
 * ActiveContentCards - Shows active book and song with quick access
 *
 * Features:
 * - Card for active book (progress, due count, "Continue Reading" button)
 * - Card for active song (progress, "Study Lyrics" button)
 * - If no active song, show "Browse Songs" CTA
 * - Links to Library for browsing more content
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Book, Music, ArrowRight, BookOpen, Play, Library } from 'lucide-react'

export default function ActiveContentCards({ loading: parentLoading = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeBook, setActiveBook] = useState(null)
  const [activeSong, setActiveSong] = useState(null)
  const [bookProgress, setBookProgress] = useState({
    current: 0, total: 27, percent: 0,
    mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0,
    dueCount: 0, wordsToUnlock: 0
  })
  const [songProgress, setSongProgress] = useState({
    sections: 0, percent: 0,
    mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0,
    lemmaCount: 0, phraseCount: 0, slangCount: 0, dueCount: 0
  })

  const fetchActiveContent = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Fetch user settings to get active book/song IDs
      const { data: settings } = await supabase
        .from('user_settings')
        .select('active_book_id, active_song_id')
        .eq('user_id', user.id)
        .maybeSingle()

      // Default to first book if none set
      let bookId = settings?.active_book_id
      let songId = settings?.active_song_id

      // Fetch book info
      if (bookId) {
        const { data: book } = await supabase
          .from('books')
          .select('book_id, title, author, total_chapters')
          .eq('book_id', bookId)
          .single()

        if (book) {
          setActiveBook(book)

          // Get reading progress from user_book_reading_progress
          const { data: progress } = await supabase
            .from('user_book_reading_progress')
            .select('furthest_sentence_id')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .maybeSingle()

          // Look up the chapter for the furthest sentence
          let currentChapter = 1
          if (progress?.furthest_sentence_id) {
            const { data: sentenceData } = await supabase
              .from('sentences')
              .select('chapters(chapter_number)')
              .eq('sentence_id', progress.furthest_sentence_id)
              .single()
            currentChapter = sentenceData?.chapters?.chapter_number || 1
          }
          const totalChapters = book.total_chapters || 27

          // Get vocabulary stats for this book (lemmas + phrases)
          let vocabStats = { mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0, dueCount: 0 }

          // Step 1: Get unique lemma IDs using direct book_id column
          // Phrases need join through sentences → chapters since phrase_occurrences has no book_id
          const [lemmaResult, phraseResult] = await Promise.all([
            supabase
              .from('words')
              .select('lemma_id')
              .eq('book_id', bookId)
              .not('lemma_id', 'is', null),
            supabase
              .from('phrase_occurrences')
              .select('phrase_id, sentences!inner(chapters!inner(book_id))')
              .eq('sentences.chapters.book_id', bookId)
          ])

          const bookLemmaIds = new Set((lemmaResult.data || []).map(w => w.lemma_id))
          const bookPhraseIds = new Set((phraseResult.data || []).map(p => p.phrase_id))
          vocabStats.totalVocab = bookLemmaIds.size + bookPhraseIds.size

          if (vocabStats.totalVocab > 0) {
            // Step 2: Get ALL user progress (no ID filter to avoid URL explosion)
            const [allLemmaProgress, allPhraseProgress] = await Promise.all([
              supabase
                .from('user_lemma_progress')
                .select('lemma_id, mastery_level, reps, due_date')
                .eq('user_id', user.id),
              supabase
                .from('user_phrase_progress')
                .select('phrase_id, mastery_level, reps, due_date')
                .eq('user_id', user.id)
            ])

            // Step 3: Filter and count client-side
            const lemmaProgressMap = new Map(
              (allLemmaProgress.data || [])
                .filter(p => bookLemmaIds.has(p.lemma_id))
                .map(p => [p.lemma_id, p])
            )
            const phraseProgressMap = new Map(
              (allPhraseProgress.data || [])
                .filter(p => bookPhraseIds.has(p.phrase_id))
                .map(p => [p.phrase_id, p])
            )
            const now = new Date()

            // Count lemma stats
            bookLemmaIds.forEach(lemmaId => {
              const p = lemmaProgressMap.get(lemmaId)
              if (!p || p.reps === 0) {
                vocabStats.notSeen++
              } else {
                if (p.due_date && new Date(p.due_date) <= now) vocabStats.dueCount++
                if (p.mastery_level >= 80) vocabStats.mastered++
                else if (p.mastery_level >= 50) vocabStats.familiar++
                else vocabStats.learning++
              }
            })

            // Count phrase stats
            bookPhraseIds.forEach(phraseId => {
              const p = phraseProgressMap.get(phraseId)
              if (!p || p.reps === 0) {
                vocabStats.notSeen++
              } else {
                if (p.due_date && new Date(p.due_date) <= now) vocabStats.dueCount++
                if (p.mastery_level >= 80) vocabStats.mastered++
                else if (p.mastery_level >= 50) vocabStats.familiar++
                else vocabStats.learning++
              }
            })
          }

          const percent = vocabStats.totalVocab > 0
            ? Math.round(((vocabStats.mastered + vocabStats.familiar + vocabStats.learning) / vocabStats.totalVocab) * 100)
            : 0

          // Calculate words needed to unlock next chapter
          let wordsToUnlock = 0
          const nextChapter = currentChapter + 1
          if (nextChapter <= totalChapters) {
            // Get the next chapter's ID
            const { data: nextChapterData } = await supabase
              .from('chapters')
              .select('chapter_id')
              .eq('book_id', bookId)
              .eq('chapter_number', nextChapter)
              .single()

            if (nextChapterData) {
              // Get lemmas required for next chapter (from words in sentences of that chapter)
              const { data: nextChapterWords } = await supabase
                .from('words')
                .select('lemma_id, sentences!inner(chapter_id)')
                .eq('sentences.chapter_id', nextChapterData.chapter_id)
                .not('lemma_id', 'is', null)

              const nextChapterLemmaIds = new Set((nextChapterWords || []).map(w => w.lemma_id))

              // Get user's lemma progress to check which are encountered
              const { data: userLemmaProgress } = await supabase
                .from('user_lemma_progress')
                .select('lemma_id, reps')
                .eq('user_id', user.id)

              const userProgressMap = new Map(
                (userLemmaProgress || []).map(p => [p.lemma_id, p])
              )

              nextChapterLemmaIds.forEach(lemmaId => {
                const p = userProgressMap.get(lemmaId)
                if (!p || p.reps === 0) {
                  wordsToUnlock++
                }
              })
            }
          }

          setBookProgress({
            current: currentChapter,
            total: totalChapters,
            percent,
            ...vocabStats,
            dueCount: vocabStats.dueCount || 0,
            wordsToUnlock
          })
        }
      } else {
        // Try to get first available book
        const { data: firstBook } = await supabase
          .from('books')
          .select('book_id, title, author, total_chapters')
          .limit(1)
          .single()

        if (firstBook) {
          setActiveBook(firstBook)
          setBookProgress({ current: 1, total: firstBook.total_chapters || 27, percent: 0 })
        }
      }

      // Fetch song info
      if (songId) {
        const { data: song } = await supabase
          .from('songs')
          .select('song_id, title, artist')
          .eq('song_id', songId)
          .single()

        if (song) {
          setActiveSong(song)

          // Get section count
          const { count: sectionCount } = await supabase
            .from('song_sections')
            .select('*', { count: 'exact', head: true })
            .eq('song_id', songId)

          // Get vocabulary stats for this song (lemmas, phrases, slang)
          const [lemmasResult, phrasesResult, slangResult] = await Promise.all([
            supabase.from('song_lemmas').select('lemma_id').eq('song_id', songId),
            supabase.from('song_phrases').select('phrase_id').eq('song_id', songId),
            supabase.from('song_slang').select('slang_id').eq('song_id', songId)
          ])

          const songLemmaIds = (lemmasResult.data || []).map(l => l.lemma_id)
          const songPhraseIds = (phrasesResult.data || []).map(p => p.phrase_id)
          const songSlangIds = (slangResult.data || []).map(s => s.slang_id)

          let vocabStats = {
            mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0, dueCount: 0,
            lemmaCount: songLemmaIds.length,
            phraseCount: songPhraseIds.length,
            slangCount: songSlangIds.length
          }
          vocabStats.totalVocab = songLemmaIds.length + songPhraseIds.length + songSlangIds.length

          // Fetch progress for each type (include due_date for due count)
          const [lemmaProgress, phraseProgress, slangProgress] = await Promise.all([
            songLemmaIds.length > 0
              ? supabase.from('user_lemma_progress').select('lemma_id, mastery_level, reps, due_date').eq('user_id', user.id).in('lemma_id', songLemmaIds)
              : { data: [] },
            songPhraseIds.length > 0
              ? supabase.from('user_phrase_progress').select('phrase_id, mastery_level, reps, due_date').eq('user_id', user.id).in('phrase_id', songPhraseIds)
              : { data: [] },
            songSlangIds.length > 0
              ? supabase.from('user_slang_progress').select('slang_id, mastery_level, reps, due_date').eq('user_id', user.id).in('slang_id', songSlangIds)
              : { data: [] }
          ])

          const allProgress = [
            ...(lemmaProgress.data || []),
            ...(phraseProgress.data || []),
            ...(slangProgress.data || [])
          ]

          const progressMap = new Map()
          allProgress.forEach(p => {
            const id = p.lemma_id || p.phrase_id || p.slang_id
            progressMap.set(id, p)
          })

          const allIds = [...songLemmaIds, ...songPhraseIds, ...songSlangIds]
          const now = new Date()
          allIds.forEach(id => {
            const p = progressMap.get(id)
            if (!p || p.reps === 0) {
              vocabStats.notSeen++
            } else {
              // Check if due for review
              if (p.due_date && new Date(p.due_date) <= now) {
                vocabStats.dueCount++
              }
              if (p.mastery_level >= 80) {
                vocabStats.mastered++
              } else if (p.mastery_level >= 50) {
                vocabStats.familiar++
              } else {
                vocabStats.learning++
              }
            }
          })

          // Recalculate notSeen for items without progress records
          const itemsWithProgress = progressMap.size
          vocabStats.notSeen = vocabStats.totalVocab - itemsWithProgress

          const percent = vocabStats.totalVocab > 0
            ? Math.round(((vocabStats.mastered + vocabStats.familiar) / vocabStats.totalVocab) * 100)
            : 0

          setSongProgress({
            sections: sectionCount || 0,
            percent,
            ...vocabStats,
            lemmaCount: vocabStats.lemmaCount,
            phraseCount: vocabStats.phraseCount,
            slangCount: vocabStats.slangCount,
            dueCount: vocabStats.dueCount
          })
        }
      }

    } catch (error) {
      console.error('Error fetching active content:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchActiveContent()
  }, [fetchActiveContent])

  const isLoading = loading || parentLoading

  if (isLoading) {
    return (
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-36 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-40 bg-neutral-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">Currently Learning</h2>
        <Link
          to="/library"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View Library
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Book Card */}
        {activeBook ? (
          <div
            onClick={() => navigate(`/book/${activeBook.book_id}`)}
            className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fdf8f0' }}>
                <Book style={{ color: '#b8862f' }} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 truncate">{activeBook.title}</h3>
                {activeBook.author && (
                  <p className="text-sm text-neutral-500 truncate">{activeBook.author}</p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  Chapter {bookProgress.current} of {bookProgress.total}
                </p>
              </div>
            </div>

            {/* Segmented Progress bar - 4 levels */}
            <div className="mt-4">
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                {bookProgress.totalVocab > 0 && (
                  <>
                    {/* Mastered - darkest amber */}
                    {bookProgress.mastered > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.mastered / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#92400e'
                        }}
                      />
                    )}
                    {/* Familiar - medium amber */}
                    {bookProgress.familiar > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.familiar / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#b8862f'
                        }}
                      />
                    )}
                    {/* Learning - light amber */}
                    {bookProgress.learning > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.learning / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#fbbf24'
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">{bookProgress.percent}%</span>
                <span className="text-xs text-neutral-400">{bookProgress.totalVocab.toLocaleString()} words</span>
              </div>
            </div>

            {/* Engaging stat line - words to unlock next chapter */}
            {bookProgress.wordsToUnlock > 0 && bookProgress.current < bookProgress.total && (
              <div className="mt-3 text-xs px-2 py-1.5 rounded-md flex items-center gap-1.5" style={{ backgroundColor: '#fef3c7' }}>
                <span style={{ color: '#92400e' }}>🔓</span>
                <span style={{ color: '#92400e' }} className="font-medium">{bookProgress.wordsToUnlock} new words to unlock Chapter {bookProgress.current + 1}</span>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/book/${activeBook.book_id}/read/${bookProgress.current}`)
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-white rounded-lg transition-colors text-sm font-medium"
              style={{ backgroundColor: '#b8862f' }}
            >
              <BookOpen size={16} />
              Continue Reading
            </button>
          </div>
        ) : (
          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-xl p-6 text-center">
            <Book className="mx-auto text-neutral-300 mb-2" size={32} />
            <p className="text-neutral-500 text-sm mb-3">No book selected</p>
            <Link
              to="/library"
              className="text-primary-500 hover:underline text-sm font-medium"
            >
              Browse Books
            </Link>
          </div>
        )}

        {/* Active Song Card */}
        {activeSong ? (
          <div
            onClick={() => navigate(`/song/${activeSong.song_id}`)}
            className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f4f2f7' }}>
                <Music style={{ color: '#6f5d8a' }} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 truncate">{activeSong.title}</h3>
                {activeSong.artist && (
                  <p className="text-sm text-neutral-500 truncate">{activeSong.artist}</p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {songProgress.sections} sections
                </p>
              </div>
            </div>

            {/* Segmented Progress bar - 4 levels (purple shades) */}
            <div className="mt-4">
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                {songProgress.totalVocab > 0 && (
                  <>
                    {/* Mastered - darkest purple */}
                    {songProgress.mastered > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.mastered / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#4c1d95'
                        }}
                      />
                    )}
                    {/* Familiar - medium purple */}
                    {songProgress.familiar > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.familiar / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#6f5d8a'
                        }}
                      />
                    )}
                    {/* Learning - light purple */}
                    {songProgress.learning > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.learning / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#a78bfa'
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">{songProgress.percent}% mastered</span>
                <span className="text-xs text-neutral-400">{songProgress.totalVocab} items</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/song/${activeSong.song_id}/study`)
              }}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-white rounded-lg transition-colors text-sm font-medium"
              style={{ backgroundColor: '#6f5d8a' }}
            >
              <Play size={16} />
              Study Lyrics
            </button>
          </div>
        ) : (
          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-xl p-6 text-center">
            <Music className="mx-auto text-neutral-300 mb-2" size={32} />
            <p className="text-neutral-500 text-sm mb-3">No song selected</p>
            <Link
              to="/library"
              className="text-primary-500 hover:underline text-sm font-medium"
            >
              Browse Songs
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
