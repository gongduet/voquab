/**
 * ReadingMode Page
 *
 * Wrapper page for the Reading Mode feature.
 * Handles route params and renders ReadingPage component.
 *
 * Routes:
 * - /read → Load from user's saved position (legacy, uses active book)
 * - /read/:chapterNumber → Jump to start of specific chapter (legacy)
 * - /book/:bookId/read → Load from user's saved position for specific book
 * - /book/:bookId/read/:chapterNumber → Jump to specific chapter of book
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import ReadingPage from '../components/reading/ReadingPage'

export default function ReadingMode() {
  const { bookId, chapterNumber } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(true)
  const [unlockError, setUnlockError] = useState(null)
  const [resolvedBookId, setResolvedBookId] = useState(null)

  // Check if chapter is unlocked (100% vocab introduced)
  useEffect(() => {
    async function checkChapterUnlock() {
      console.log('[ReadingMode] Starting checkChapterUnlock', { bookId, chapterNumber, userId: user?.id })

      try {
        // Resolve book ID: use param, active book, or default to El Principito
        let targetBookId = bookId

        if (!targetBookId) {
          // Try to get active book from settings
          const { data: settings } = await supabase
            .from('user_settings')
            .select('active_book_id')
            .eq('user_id', user.id)
            .maybeSingle()

          targetBookId = settings?.active_book_id
          console.log('[ReadingMode] Got active book from settings:', targetBookId)
        }

        if (!targetBookId) {
          // Fall back to El Principito
          const { data: defaultBook } = await supabase
            .from('books')
            .select('book_id')
            .eq('title', 'El Principito')
            .eq('language_code', 'es')
            .single()

          targetBookId = defaultBook?.book_id
          console.log('[ReadingMode] Fell back to El Principito:', targetBookId)
        }

        if (!targetBookId) {
          console.error('[ReadingMode] No book available')
          setUnlockError('No book available')
          setIsCheckingUnlock(false)
          return
        }

        console.log('[ReadingMode] Resolved book ID:', targetBookId)
        setResolvedBookId(targetBookId)

        // If no specific chapter requested, user's position will be validated by ReadingPage
        if (!chapterNumber) {
          console.log('[ReadingMode] No chapter specified, proceeding to ReadingPage')
          setIsCheckingUnlock(false)
          return
        }

        const chapterNum = parseInt(chapterNumber, 10)
        console.log('[ReadingMode] Checking chapter:', chapterNum)

        // Get chapter info
        const { data: chapter, error: chapterError } = await supabase
          .from('chapters')
          .select('chapter_id')
          .eq('book_id', targetBookId)
          .eq('chapter_number', chapterNum)
          .single()

        if (chapterError || !chapter) {
          console.error('[ReadingMode] Chapter not found:', chapterError)
          setUnlockError('Chapter not found')
          setIsCheckingUnlock(false)
          return
        }

        console.log('[ReadingMode] Found chapter:', chapter.chapter_id)

        // For now, skip the complex unlock check and allow access
        // The vocab gating logic was using a non-existent book_vocabulary table
        // TODO: Implement proper chapter unlock logic using lemmas → words → sentences → chapters
        setIsCheckingUnlock(false)

      } catch (err) {
        console.error('[ReadingMode] Error checking chapter unlock:', err)
        setUnlockError('Could not verify chapter access')
        setIsCheckingUnlock(false)
      }
    }

    if (user?.id) {
      checkChapterUnlock()
    }
  }, [bookId, chapterNumber, user?.id])

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
  return <ReadingPage bookId={resolvedBookId} chapterNumber={chapterNumber} />
}
