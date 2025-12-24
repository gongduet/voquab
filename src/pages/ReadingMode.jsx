/**
 * ReadingMode Page
 *
 * Wrapper page for the Reading Mode feature.
 * Handles route params and renders ReadingPage component.
 *
 * Routes:
 * - /read → Load from user's saved position
 * - /read/:chapterNumber → Jump to start of specific chapter
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import ReadingPage from '../components/reading/ReadingPage'

export default function ReadingMode() {
  const { chapterNumber } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(true)
  const [unlockError, setUnlockError] = useState(null)

  // Check if chapter is unlocked (100% vocab introduced)
  useEffect(() => {
    async function checkChapterUnlock() {
      // If no specific chapter requested, user's position will be validated by ReadingPage
      if (!chapterNumber) {
        setIsCheckingUnlock(false)
        return
      }

      const chapterNum = parseInt(chapterNumber, 10)

      try {
        // Get book ID
        const { data: book } = await supabase
          .from('books')
          .select('book_id')
          .eq('title', 'El Principito')
          .eq('language_code', 'es')
          .single()

        if (!book) {
          setUnlockError('Book not found')
          setIsCheckingUnlock(false)
          return
        }

        // Get chapter info
        const { data: chapter } = await supabase
          .from('chapters')
          .select('chapter_id')
          .eq('book_id', book.book_id)
          .eq('chapter_number', chapterNum)
          .single()

        if (!chapter) {
          setUnlockError('Chapter not found')
          setIsCheckingUnlock(false)
          return
        }

        // Check vocab progress for this chapter
        // A chapter is unlocked if all its vocab has been introduced (seen at least once)
        const { data: vocabStats } = await supabase
          .from('book_vocabulary')
          .select('vocab_id')
          .eq('first_chapter_id', chapter.chapter_id)

        if (!vocabStats || vocabStats.length === 0) {
          // Chapter has no vocab to learn - it's unlocked
          setIsCheckingUnlock(false)
          return
        }

        // Check how many of these vocab items the user has seen
        const vocabIds = vocabStats.map(v => v.vocab_id)

        const { data: userProgress } = await supabase
          .from('user_lemma_progress')
          .select('vocab_id')
          .eq('user_id', user.id)
          .in('vocab_id', vocabIds)
          .gt('reps', 0) // Has been seen at least once

        const seenCount = userProgress?.length || 0
        const totalCount = vocabIds.length

        if (seenCount < totalCount) {
          setUnlockError(`Chapter ${chapterNum} is locked. Complete vocab study first. (${seenCount}/${totalCount} words introduced)`)
          setIsCheckingUnlock(false)
          return
        }

        // Chapter is unlocked
        setIsCheckingUnlock(false)

      } catch (err) {
        console.error('Error checking chapter unlock:', err)
        setUnlockError('Could not verify chapter access')
        setIsCheckingUnlock(false)
      }
    }

    if (user) {
      checkChapterUnlock()
    }
  }, [chapterNumber, user])

  // Loading state while checking unlock
  if (isCheckingUnlock) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">
          Loading...
        </div>
      </div>
    )
  }

  // Unlock error - show message and redirect option
  if (unlockError) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex flex-col items-center justify-center h-screen px-4 text-center">
          <div className="max-w-md">
            <h2 className="text-xl font-medium text-neutral-800 mb-4">
              Chapter Locked
            </h2>
            <p className="text-neutral-500 mb-6">
              {unlockError}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => navigate(`/flashcards?chapter=${chapterNumber}`)}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                style={{ backgroundColor: '#0ea5e9' }}
              >
                Study Vocab
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render the reading page
  return <ReadingPage chapterNumber={chapterNumber} />
}
