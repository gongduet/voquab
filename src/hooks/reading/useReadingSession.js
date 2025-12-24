/**
 * Reading Session Hook
 *
 * Manages the reading session state for fragment-by-fragment reading.
 * Follows the pattern from useFlashcardSession.js
 *
 * State:
 * - currentSentence (the sentence object with fragments)
 * - currentFragmentIndex (which fragment is active)
 * - completedSentences (array of sentences above current)
 * - fragmentResults (array of 'got-it' | 'hard' | 'need-help' for current sentence)
 * - isShowingTranslation (after Need Help or Hard)
 * - isLoading
 *
 * Actions:
 * - handleFragmentResponse(response) - 'got-it' | 'hard' | 'need-help'
 * - handleContinue() - after viewing translation, move to next fragment
 * - handleSentenceComplete() - calculate score, save progress, load next sentence
 * - jumpToSentence(sentenceId) - for re-review
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import useReadingProgress from './useReadingProgress'

export default function useReadingSession(userId) {
  // Core state
  const [bookId, setBookId] = useState(null)
  const [currentChapter, setCurrentChapter] = useState(null) // { chapter_id, chapter_number, title, book_id }
  const [currentSentence, setCurrentSentence] = useState(null)
  const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0)
  const [completedSentences, setCompletedSentences] = useState([]) // Now only contains current chapter's sentences
  const [fragmentResults, setFragmentResults] = useState([])
  const [nextSentencePreview, setNextSentencePreview] = useState(null)
  const [nextChapterPreview, setNextChapterPreview] = useState(null)

  // UI state
  const [isShowingTranslation, setIsShowingTranslation] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState(null)

  // Chapter gate state - when next chapter is locked due to vocab
  const [chapterLocked, setChapterLocked] = useState(null)
  // { chapterNumber: number, vocabPercentage: number }

  // Navigation state - tracks furthest position for enabling forward navigation
  const [furthestPosition, setFurthestPosition] = useState(null)

  // Session stats
  const [sessionStartTime] = useState(Date.now())
  const [sessionStats, setSessionStats] = useState({
    sentencesCompleted: 0,
    fragmentsAnswered: 0,
    gotItCount: 0,
    hardCount: 0,
    needHelpCount: 0
  })

  // Progress hook for database operations
  const progress = useReadingProgress(userId)

  // Ref to always hold the latest handleSentenceComplete (fixes stale closure bug)
  const handleSentenceCompleteRef = useRef(null)

  /**
   * Initialize the reading session
   * Fetches book ID, progress, and loads ONLY current chapter's sentences
   */
  const initializeSession = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      // Get book ID for El Principito
      const bookIdResult = await progress.fetchBookId()
      if (!bookIdResult) {
        setError('Could not find book')
        setIsLoading(false)
        return
      }
      setBookId(bookIdResult)

      // Get user's current progress
      let bookProgress = await progress.fetchBookProgress(bookIdResult)

      // If no progress, initialize at chapter 1
      if (!bookProgress) {
        bookProgress = await progress.initializeBookProgress(bookIdResult)
        if (!bookProgress) {
          setError('Could not initialize book progress')
          setIsLoading(false)
          return
        }
      }

      // Load current sentence with fragments
      const sentence = await progress.fetchSentenceWithFragments(
        bookProgress.current_sentence_id
      )

      if (!sentence) {
        setError('Could not load current sentence')
        setIsLoading(false)
        return
      }

      // Get chapter info for the current sentence's chapter
      const chapterInfo = await progress.fetchChapterInfo(sentence.chapter_id)
      setCurrentChapter(chapterInfo)

      // Load ONLY this chapter's completed sentences (before current position)
      // This is the key performance optimization
      const chapterSentences = await progress.fetchChapterSentences(
        sentence.chapter_id,
        bookProgress.current_sentence_id
      )
      setCompletedSentences(chapterSentences)

      // Load furthest position for navigation
      const furthest = await progress.fetchFurthestPosition(bookIdResult)
      setFurthestPosition(furthest)

      setCurrentSentence(sentence)
      setCurrentFragmentIndex(bookProgress.current_fragment_order - 1) // Convert to 0-indexed
      setFragmentResults([])
      setIsLoading(false)

    } catch (err) {
      console.error('Error initializing reading session:', err)
      setError(err.message)
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])  // progress is memoized in useReadingProgress, safe to exclude

  // Initialize on mount
  useEffect(() => {
    initializeSession()
  }, [initializeSession])

  // Fetch preview of next sentence when current sentence changes
  useEffect(() => {
    if (currentSentence?.sentence_id) {
      console.log('[Preview] Fetching preview for sentence:', currentSentence.sentence_id, 'chapter_id:', currentSentence.chapter_id)
      progress.fetchNextSentencePreview(currentSentence.sentence_id)
        .then(nextSentence => {
          console.log('[Preview] Result:', nextSentence)
          if (!nextSentence) {
            // End of book
            console.log('[Preview] No next sentence - end of book')
            setNextSentencePreview(null)
            setNextChapterPreview(null)
            return
          }

          // Check if next sentence is in a different chapter
          if (nextSentence.chapter_id !== currentSentence.chapter_id) {
            // At chapter boundary - show chapter preview instead of sentence
            console.log('[Preview] Chapter boundary - next chapter:', nextSentence.chapter_number)
            setNextSentencePreview(null)
            setNextChapterPreview(nextSentence.chapter_number)
          } else {
            // Same chapter - show sentence preview
            console.log('[Preview] Same chapter - showing sentence preview')
            setNextSentencePreview(nextSentence)
            setNextChapterPreview(null)
          }
        })
        .catch((err) => {
          console.error('[Preview] Error fetching preview:', err)
          setNextSentencePreview(null)
          setNextChapterPreview(null)
        })
    } else {
      console.log('[Preview] No current sentence, clearing previews')
      setNextSentencePreview(null)
      setNextChapterPreview(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentence?.sentence_id, currentSentence?.chapter_id])

  /**
   * Handle confirm button click (single button flow)
   * @param {boolean} wasPeeked - Whether the user peeked at the translation
   */
  const handleConfirm = useCallback(async (wasPeeked = false) => {
    if (!currentSentence || isTransitioning) return

    const fragments = currentSentence.fragments || []
    const currentFragment = fragments[currentFragmentIndex]

    if (!currentFragment) return

    // Calculate score: 1.0 if not peeked, 0.7 if peeked
    const score = wasPeeked ? 0.7 : 1.0

    // Record the result
    const result = {
      fragmentId: currentFragment.fragment_id,
      score,
      peeked: wasPeeked
    }
    const newResults = [...fragmentResults, result]
    setFragmentResults(newResults)

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      fragmentsAnswered: prev.fragmentsAnswered + 1,
      gotItCount: prev.gotItCount + (wasPeeked ? 0 : 1),
      hardCount: prev.hardCount + (wasPeeked ? 1 : 0)
    }))

    // Increment fragment stats in book progress
    if (bookId) {
      const response = wasPeeked ? 'hard' : 'got-it'
      await progress.incrementFragmentStats(bookId, response)
    }

    // Move to next fragment
    await moveToNextFragment(newResults)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSentence, currentFragmentIndex, fragmentResults, isTransitioning, bookId])

  /**
   * Legacy: Handle fragment response (Got It / Hard / Need Help)
   * Kept for backwards compatibility
   */
  const handleFragmentResponse = useCallback(async (response) => {
    const wasPeeked = response === 'hard' || response === 'need-help'
    await handleConfirm(wasPeeked)
  }, [handleConfirm])

  /**
   * Handle continue after viewing translation (legacy)
   */
  const handleContinue = useCallback(async () => {
    await moveToNextFragment(fragmentResults)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragmentResults])

  /**
   * Move to the next fragment or complete the sentence
   */
  const moveToNextFragment = useCallback(async (results) => {
    if (!currentSentence) return

    const fragments = currentSentence.fragments || []
    const nextIndex = currentFragmentIndex + 1

    if (nextIndex >= fragments.length) {
      // All fragments completed - use ref to get latest handleSentenceComplete
      // This fixes the stale closure bug where nextSentencePreview was undefined
      if (handleSentenceCompleteRef.current) {
        await handleSentenceCompleteRef.current(results)
      }
    } else {
      // Move to next fragment
      setCurrentFragmentIndex(nextIndex)

      // Save position
      if (bookId) {
        await progress.updatePosition(bookId, currentSentence.sentence_id, nextIndex + 1)
      }
    }
  }, [currentSentence, currentFragmentIndex, bookId, progress])

  /**
   * Handle sentence completion
   * Calculates score, saves progress, loads next sentence
   *
   * Key optimization: Batch all visible state updates together BEFORE any async operations
   * to prevent jarring transitions from multiple re-renders.
   */
  const handleSentenceComplete = useCallback(async (results) => {
    console.log('=== handleSentenceComplete ===')
    console.log('currentSentence:', currentSentence?.sentence_id, 'order:', currentSentence?.sentence_order)
    console.log('currentChapter:', currentChapter?.chapter_number)
    console.log('nextSentencePreview:', nextSentencePreview?.sentence_id, nextSentencePreview?.sentence_text?.substring(0, 30))
    console.log('nextChapterPreview:', nextChapterPreview)

    if (!currentSentence || !bookId) return

    // Capture values before any state changes
    const completedSentence = { ...currentSentence }
    const score = progress.calculateScore(results)

    // Capture preview info before clearing state
    // nextSentencePreview is the next sentence in the same chapter
    // nextChapterPreview is set when we're at a chapter boundary
    const nextSentenceId = nextSentencePreview?.sentence_id
    const isAtChapterBoundary = !nextSentencePreview && nextChapterPreview
    const capturedNextChapterPreview = nextChapterPreview

    console.log('nextSentenceId:', nextSentenceId)
    console.log('isAtChapterBoundary:', isAtChapterBoundary)

    // === BATCH ALL VISIBLE STATE UPDATES TOGETHER ===
    // React 18 batches these automatically, but we group them for clarity
    setIsTransitioning(true)
    setNextSentencePreview(null)
    setNextChapterPreview(null)
    setCompletedSentences(prev => [...prev, {
      ...completedSentence,
      lastScore: score,
      timesCompleted: 1
    }])
    setSessionStats(prev => ({
      ...prev,
      sentencesCompleted: prev.sentencesCompleted + 1
    }))

    // If no next sentence AND not at chapter boundary, it's truly end of book
    if (!nextSentenceId && !isAtChapterBoundary) {
      setCurrentSentence(null)
      // End transition after React processes updates
      requestAnimationFrame(() => {
        setIsTransitioning(false)
      })

      // Still save to DB in background
      progress.saveSentenceComplete(completedSentence.sentence_id, score, results)
      progress.incrementSentencesCompleted(bookId)
      progress.updateFurthestPosition(bookId, completedSentence.sentence_id)
      return
    }

    // If at chapter boundary, check if next chapter's vocab is ready
    let nextSentenceIdToFetch = nextSentenceId
    if (isAtChapterBoundary) {
      // Check if next chapter's vocabulary is 100% introduced
      const vocabStatus = await progress.checkChapterVocabReady(bookId, capturedNextChapterPreview)
      console.log('[ChapterGate] Vocab status for chapter', capturedNextChapterPreview, ':', vocabStatus)

      if (!vocabStatus.ready) {
        console.log('[ChapterGate] BLOCKING - setting chapterLocked state and returning')
        // Chapter locked - show the locked message instead of advancing
        // IMPORTANT: Do NOT set currentSentence to null - keep showing the last sentence
        // The chapterLocked state will trigger the locked UI in ReadingPage
        setChapterLocked({
          chapterNumber: capturedNextChapterPreview,
          vocabPercentage: vocabStatus.percentage
        })
        setIsTransitioning(false)

        // Save the completed sentence progress in background
        Promise.all([
          progress.saveSentenceComplete(completedSentence.sentence_id, score, results),
          progress.incrementSentencesCompleted(bookId),
          progress.updateFurthestPosition(bookId, completedSentence.sentence_id)
        ]).catch(err => {
          console.error('Error saving sentence progress:', err)
        })

        console.log('[ChapterGate] Returning early - should NOT see any more logs after this')
        return
      }

      // Vocab is ready, fetch first sentence of next chapter
      const firstSentence = await progress.fetchChapterFirstSentence(bookId, capturedNextChapterPreview)
      if (firstSentence) {
        nextSentenceIdToFetch = firstSentence.sentence_id
      } else {
        // Couldn't find next chapter's first sentence - treat as end of book
        setCurrentSentence(null)
        requestAnimationFrame(() => setIsTransitioning(false))
        progress.saveSentenceComplete(completedSentence.sentence_id, score, results)
        progress.incrementSentencesCompleted(bookId)
        progress.updateFurthestPosition(bookId, completedSentence.sentence_id)
        return
      }
    }

    // Fetch next sentence with fragments (we only had preview before)
    try {
      const nextSentence = await progress.fetchSentenceWithFragments(nextSentenceIdToFetch)

      if (!nextSentence) {
        setCurrentSentence(null)
        requestAnimationFrame(() => setIsTransitioning(false))
        return
      }

      // Check if we're crossing a chapter boundary
      const isNewChapter = nextSentence.chapter_id !== currentChapter?.chapter_id
      if (isNewChapter) {
        // Update to new chapter and reset completed sentences
        const newChapterInfo = await progress.fetchChapterInfo(nextSentence.chapter_id)
        setCurrentChapter(newChapterInfo)
        setCompletedSentences([]) // Fresh start for new chapter

        // Register chapter as reached immediately (Fix 2: enables navigation back)
        await progress.registerChapterReached(bookId, newChapterInfo.chapter_number, nextSentence.sentence_id)

        // Update furthest position state so navigation buttons update
        const updatedFurthest = await progress.fetchFurthestPosition(bookId)
        setFurthestPosition(updatedFurthest)
      }

      // Update current sentence state
      setCurrentSentence(nextSentence)
      setCurrentFragmentIndex(0)
      setFragmentResults([])

      // End transition after React processes all updates
      requestAnimationFrame(() => {
        setIsTransitioning(false)
      })

      // === BACKGROUND DB OPERATIONS (non-blocking) ===
      // These don't affect UI, so run them without awaiting
      Promise.all([
        progress.saveSentenceComplete(completedSentence.sentence_id, score, results),
        progress.incrementSentencesCompleted(bookId),
        progress.updateFurthestPosition(bookId, completedSentence.sentence_id),
        progress.updatePosition(bookId, nextSentence.sentence_id, 1)
      ]).then(async () => {
        // Refresh furthest position for navigation (affects UI but non-critical)
        const updatedFurthest = await progress.fetchFurthestPosition(bookId)
        setFurthestPosition(updatedFurthest)
      }).catch(err => {
        console.error('Error saving sentence progress:', err)
      })

    } catch (err) {
      console.error('Error completing sentence:', err)
      setIsTransitioning(false)
    }
  }, [currentSentence, currentChapter, bookId, nextSentencePreview, nextChapterPreview, progress])

  // Keep the ref updated with the latest handleSentenceComplete
  useEffect(() => {
    handleSentenceCompleteRef.current = handleSentenceComplete
  }, [handleSentenceComplete])

  /**
   * Jump to a specific sentence (for re-review)
   */
  const jumpToSentence = useCallback(async (sentenceId) => {
    if (!bookId || isTransitioning) return

    setIsLoading(true)

    try {
      const sentence = await progress.fetchSentenceWithFragments(sentenceId)

      if (!sentence) {
        console.error('Could not load sentence:', sentenceId)
        setIsLoading(false)
        return
      }

      // Update position
      await progress.updatePosition(bookId, sentenceId, 1)

      // Reload completed sentences up to this point
      const completed = await progress.fetchCompletedSentences(bookId, sentenceId)
      setCompletedSentences(completed)

      // Set state
      setCurrentSentence(sentence)
      setCurrentFragmentIndex(0)
      setFragmentResults([])
      setIsShowingTranslation(false)
      setIsLoading(false)

    } catch (err) {
      console.error('Error jumping to sentence:', err)
      setIsLoading(false)
    }
  }, [bookId, isTransitioning, progress])

  /**
   * Jump to start of a specific chapter
   * Now loads only that chapter's sentences (chapter-only view)
   */
  const jumpToChapter = useCallback(async (chapterNumber) => {
    if (!bookId || isTransitioning) return

    setIsLoading(true)

    try {
      const sentence = await progress.fetchChapterFirstSentence(bookId, chapterNumber)

      if (!sentence) {
        console.error('Could not load chapter:', chapterNumber)
        setIsLoading(false)
        return
      }

      // Get chapter info
      const chapterInfo = await progress.fetchChapterInfo(sentence.chapter_id)
      setCurrentChapter(chapterInfo)

      // Update position
      await progress.updatePosition(bookId, sentence.sentence_id, 1)

      // Register chapter as reached immediately (if further than before)
      await progress.registerChapterReached(bookId, chapterNumber, sentence.sentence_id)

      // Refresh furthest position after registration
      const updatedFurthest = await progress.fetchFurthestPosition(bookId)
      setFurthestPosition(updatedFurthest)

      // Load ONLY this chapter's completed sentences (starts empty for first sentence)
      // When jumping to a chapter start, there are no completed sentences before the first one
      setCompletedSentences([])

      // Set state
      setCurrentSentence(sentence)
      setCurrentFragmentIndex(0)
      setFragmentResults([])
      setIsShowingTranslation(false)
      setNextSentencePreview(null)
      setNextChapterPreview(null)
      setIsLoading(false)

    } catch (err) {
      console.error('Error jumping to chapter:', err)
      setIsLoading(false)
    }
  }, [bookId, isTransitioning, progress])

  /**
   * Jump to start of book (chapter 1)
   * Resets position but keeps all progress data
   */
  const jumpToStart = useCallback(async () => {
    await jumpToChapter(1)
  }, [jumpToChapter])

  /**
   * Go to the previous sentence - seamless, no loading screen
   */
  const goToPreviousSentence = useCallback(async () => {
    if (completedSentences.length === 0 || !bookId || isTransitioning) return

    // Get last completed sentence
    const prevSentence = completedSentences[completedSentences.length - 1]

    // Move it from completed to current (instant state update)
    setCompletedSentences(prev => prev.slice(0, -1))
    setCurrentSentence(prevSentence)
    setCurrentFragmentIndex(0)
    setFragmentResults([])

    // Update position in background (don't await)
    progress.updatePosition(bookId, prevSentence.sentence_id, 1)
  }, [completedSentences, bookId, isTransitioning, progress])

  /**
   * Go to the next sentence (only if already visited) - seamless, no loading screen
   */
  const goToNextSentence = useCallback(async () => {
    if (!currentSentence || !bookId || isTransitioning) return

    // Check if we can go forward (have we visited the next sentence?)
    if (!furthestPosition) return

    const currentChapterNum = currentChapter?.chapter_number || 0
    const currentOrder = currentSentence.sentence_order || 0
    const canGoForward = furthestPosition && (
      currentChapterNum < furthestPosition.chapterNumber ||
      (currentChapterNum === furthestPosition.chapterNumber &&
        currentOrder < furthestPosition.sentenceOrder)
    )

    if (!canGoForward) return

    // Fetch just the next sentence (lightweight)
    const nextSentence = await progress.fetchNextSentence(currentSentence.sentence_id)

    if (!nextSentence) {
      // Shouldn't happen if canGoForward was true, but handle gracefully
      return
    }

    // Check if we're crossing a chapter boundary
    const isNewChapter = nextSentence.chapter_id !== currentChapter?.chapter_id
    if (isNewChapter) {
      // Update to new chapter and reset completed sentences
      const newChapterInfo = await progress.fetchChapterInfo(nextSentence.chapter_id)
      setCurrentChapter(newChapterInfo)
      setCompletedSentences([]) // Fresh start for new chapter

      // Register chapter as reached immediately (enables navigation back)
      await progress.registerChapterReached(bookId, newChapterInfo.chapter_number, nextSentence.sentence_id)

      // Update furthest position state
      const updatedFurthest = await progress.fetchFurthestPosition(bookId)
      setFurthestPosition(updatedFurthest)
    } else {
      // Same chapter - add current to completed
      setCompletedSentences(prev => [...prev, currentSentence])
    }

    setCurrentSentence(nextSentence)
    setCurrentFragmentIndex(0)
    setFragmentResults([])

    // Update position in background (don't await)
    progress.updatePosition(bookId, nextSentence.sentence_id, 1)
  }, [currentSentence, currentChapter, bookId, isTransitioning, furthestPosition, progress])

  /**
   * Go to the previous chapter (first sentence of previous chapter)
   */
  const goToPreviousChapter = useCallback(async () => {
    if (!currentChapter || !bookId || isTransitioning) return

    const chapterNum = currentChapter.chapter_number
    if (!chapterNum || chapterNum <= 1) return

    await jumpToChapter(chapterNum - 1)
  }, [currentChapter, bookId, isTransitioning, jumpToChapter])

  /**
   * Go to the next chapter (only if already visited AND vocab is ready)
   */
  const goToNextChapter = useCallback(async () => {
    if (!currentChapter || !bookId || isTransitioning) return

    const chapterNum = currentChapter.chapter_number
    if (!chapterNum) return

    // Check if we can go to next chapter (have we visited it?)
    if (!furthestPosition || chapterNum >= furthestPosition.chapterNumber) {
      // Can't go forward to a chapter we haven't reached
      return
    }

    // Also check vocab readiness for next chapter
    const nextChapterNum = chapterNum + 1
    const vocabStatus = await progress.checkChapterVocabReady(bookId, nextChapterNum)
    if (!vocabStatus.ready) {
      // Show chapter locked message
      setChapterLocked({
        chapterNumber: nextChapterNum,
        vocabPercentage: vocabStatus.percentage
      })
      return
    }

    await jumpToChapter(nextChapterNum)
  }, [currentChapter, bookId, isTransitioning, furthestPosition, jumpToChapter, progress])

  /**
   * Dismiss the chapter locked message
   */
  const dismissChapterLocked = useCallback(() => {
    setChapterLocked(null)
  }, [])

  /**
   * Get the current fragment being worked on
   */
  const currentFragment = currentSentence?.fragments?.[currentFragmentIndex] || null

  /**
   * Check if session is at end of book
   */
  const isEndOfBook = !isLoading && !currentSentence && completedSentences.length > 0

  /**
   * Get progress info for current sentence
   */
  const sentenceProgress = {
    current: currentFragmentIndex + 1,
    total: currentSentence?.fragments?.length || 0,
    percentage: currentSentence?.fragments?.length
      ? ((currentFragmentIndex + 1) / currentSentence.fragments.length) * 100
      : 0
  }

  /**
   * Navigation can-do checks
   */
  const currentChapterNumber = currentChapter?.chapter_number || 0
  const currentSentenceOrder = currentSentence?.sentence_order || 0

  // Can go back if there are completed sentences to go back to
  const canSentenceBack = completedSentences.length > 0

  // Can go forward if we've been further than current position
  const canSentenceForward = furthestPosition && (
    currentChapterNumber < furthestPosition.chapterNumber ||
    (currentChapterNumber === furthestPosition.chapterNumber &&
      currentSentenceOrder < furthestPosition.sentenceOrder)
  )

  // Can go to previous chapter if not in chapter 1
  const canChapterBack = currentChapterNumber > 1

  // Can go to next chapter if we've reached that chapter
  const canChapterForward = furthestPosition &&
    currentChapterNumber < furthestPosition.chapterNumber

  return {
    // Core state
    bookId,
    currentChapter,
    currentSentence,
    currentFragment,
    currentFragmentIndex,
    completedSentences,
    fragmentResults,
    nextSentencePreview,
    nextChapterPreview,

    // UI state
    isShowingTranslation,
    isLoading,
    isTransitioning,
    error,
    isEndOfBook,
    chapterLocked,
    dismissChapterLocked,

    // Progress
    sentenceProgress,
    sessionStats,
    sessionStartTime,

    // Actions
    handleConfirm,  // New single-button flow
    handleFragmentResponse,  // Legacy 3-button flow
    handleContinue,
    jumpToSentence,
    jumpToChapter,
    jumpToStart,
    initializeSession,

    // Navigation actions
    goToPreviousSentence,
    goToNextSentence,
    goToPreviousChapter,
    goToNextChapter,

    // Navigation can-do flags
    canSentenceBack,
    canSentenceForward,
    canChapterBack,
    canChapterForward
  }
}
