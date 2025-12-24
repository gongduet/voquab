/**
 * ReadingPage - Main container for Reading Mode
 *
 * Features:
 * - Flowing paragraphs of completed sentences (like a real book)
 * - Tap sentence to see translation tooltip
 * - Active sentence for current fragment-by-fragment work
 * - Chapter titles inline
 * - Sticky header with current chapter
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import useReadingSession from '../../hooks/reading/useReadingSession'
import useScrollToPosition from '../../hooks/reading/useScrollToPosition'
import { supabase } from '../../lib/supabase'

import { Check } from 'lucide-react'
import StickyHeader from './StickyHeader'
import ChapterTitle from './ChapterTitle'
import FlowingParagraph from './FlowingParagraph'
import SentenceTooltip from './SentenceTooltip'
import ActiveSentenceInline from './ActiveSentenceInline'
import NavigationControls from './NavigationControls'

// Convert number to Roman numeral
function toRoman(num) {
  if (!num) return ''
  const romanNumerals = [
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ]
  let result = ''
  let remaining = num
  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral
      remaining -= value
    }
  }
  return result
}

/**
 * Group sentences into paragraphs based on is_paragraph_start
 */
function groupIntoParagraphs(sentences) {
  const paragraphs = []
  let currentParagraph = []

  sentences.forEach((sentence) => {
    if (sentence.is_paragraph_start && currentParagraph.length > 0) {
      paragraphs.push(currentParagraph)
      currentParagraph = []
    }
    currentParagraph.push(sentence)
  })

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph)
  }

  return paragraphs
}

export default function ReadingPage({ chapterNumber }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const containerRef = useRef(null)
  const activeSentenceRef = useRef(null)
  const standaloneActiveSentenceRef = useRef(null)

  // Tooltip state
  const [activeTooltipSentence, setActiveTooltipSentence] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, height: 0 })

  // Reading session hook
  const session = useReadingSession(user?.id)

  // Scroll management
  const scroll = useScrollToPosition(containerRef)

  // Group completed sentences into paragraphs (single chapter only now)
  const paragraphs = useMemo(() =>
    groupIntoParagraphs(session.completedSentences),
    [session.completedSentences]
  )

  // Jump to specific chapter if provided via route
  useEffect(() => {
    if (chapterNumber && session.bookId && !session.isLoading) {
      session.jumpToChapter(parseInt(chapterNumber, 10))
    }
  }, [chapterNumber, session.bookId, session.isLoading])

  // Auto-scroll to current sentence on load
  useEffect(() => {
    if (!session.isLoading && session.currentSentence && !scroll.hasScrolled()) {
      scroll.scrollToCurrentSentence(session.currentSentence.sentence_id, true)
    }
  }, [session.isLoading, session.currentSentence, scroll])

  // Scroll to new sentence when it changes
  useEffect(() => {
    if (session.currentSentence && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [session.currentSentence?.sentence_id])

  // Handle sentence click for tooltip
  const handleSentenceClick = useCallback((sentence, event) => {
    event.stopPropagation()
    const rect = event.target.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
      height: rect.height
    })
    setActiveTooltipSentence(sentence)
  }, [])

  // Handle highlight toggle
  const handleToggleHighlight = useCallback(async () => {
    if (!activeTooltipSentence || !user?.id) return

    const newValue = !activeTooltipSentence.is_highlighted

    // Update tooltip sentence immediately
    setActiveTooltipSentence(prev => ({ ...prev, is_highlighted: newValue }))

    // Update in session's completedSentences
    // Note: This modifies the session state indirectly - ideally we'd have a method for this
    const sentenceIndex = session.completedSentences.findIndex(
      s => s.sentence_id === activeTooltipSentence.sentence_id
    )
    if (sentenceIndex !== -1) {
      session.completedSentences[sentenceIndex].is_highlighted = newValue
    }

    // Persist to database
    await supabase
      .from('user_sentence_progress')
      .upsert({
        user_id: user.id,
        sentence_id: activeTooltipSentence.sentence_id,
        is_highlighted: newValue
      }, { onConflict: 'user_id,sentence_id' })
  }, [activeTooltipSentence, user?.id, session.completedSentences])

  // Close tooltip when clicking outside
  const handleContainerClick = useCallback(() => {
    setActiveTooltipSentence(null)
  }, [])

  // Handle confirm for standalone active sentence (when it starts a new paragraph)
  const handleStandaloneConfirm = useCallback(() => {
    const wasPeeked = standaloneActiveSentenceRef.current?.wasCurrentFragmentPeeked?.() || false
    standaloneActiveSentenceRef.current?.dismissTooltip?.()
    session.handleConfirm(wasPeeked)
  }, [session])

  // Loading state
  if (session.isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <StickyHeader bookTitle="El Principito" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-neutral-400">
            Loading...
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (session.error) {
    return (
      <div className="min-h-screen bg-white">
        <StickyHeader bookTitle="El Principito" />
        <div className="flex flex-col items-center justify-center h-64 px-4">
          <p className="text-red-500 mb-4">{session.error}</p>
          <button
            onClick={() => session.initializeSession()}
            className="px-4 py-2 bg-neutral-100 rounded-lg text-neutral-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // End of book state
  if (session.isEndOfBook) {
    return (
      <div className="min-h-screen bg-white">
        <StickyHeader bookTitle="El Principito" />
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <h2 className="text-xl font-medium text-neutral-800 mb-2">
            Fin
          </h2>
          <p className="text-neutral-500 mb-6">
            You've completed El Principito!
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-neutral-800 text-white rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Chapter locked state - next chapter requires more vocabulary study
  if (session.chapterLocked) {
    return (
      <div className="min-h-screen bg-white">
        <StickyHeader bookTitle="El Principito" chapterNumber={session.currentChapter?.chapter_number} />
        <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Chapter {session.chapterLocked.chapterNumber} Locked
          </h2>
          <p className="text-neutral-600 mb-4">
            You need to study more vocabulary before continuing.
          </p>
          <p className="text-sm text-neutral-500 mb-6">
            {session.chapterLocked.vocabPercentage}% of Chapter {session.chapterLocked.chapterNumber} words introduced
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                session.dismissChapterLocked()
                navigate('/dashboard')
              }}
              className="px-6 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700"
            >
              Return to Dashboard
            </button>
            <button
              onClick={session.dismissChapterLocked}
              className="px-6 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200"
            >
              Stay Here
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Determine if active sentence starts a new paragraph or continues the last one
  const activeStartsNewParagraph = session.currentSentence?.is_paragraph_start
  const hasCompletedSentences = paragraphs.length > 0

  return (
    <div
      className="reading-page min-h-screen bg-white"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <style>{`
        .reading-content {
          max-width: 768px;
          margin: 0 auto;
          padding-bottom: 200px;
        }
      `}</style>

      {/* Sticky header */}
      <StickyHeader
        chapterNumber={session.currentChapter?.chapter_number}
        bookTitle="El Principito"
      />

      {/* Reading content */}
      <div className="reading-content pt-4">
        {/* Single chapter title at top */}
        {session.currentChapter && (
          <ChapterTitle
            chapterNumber={session.currentChapter.chapter_number}
            title={session.currentChapter.title}
            isFirst={true}
            ref={(el) => scroll.registerSentenceRef(`chapter-${session.currentChapter.chapter_id}`, el)}
          />
        )}

        {/* Completed sentences as flowing paragraphs */}
        {paragraphs.map((paragraphSentences, index) => {
          // Check if this is the last paragraph and active sentence should flow inline
          const isLastParagraph = index === paragraphs.length - 1
          const includeActiveSentence = isLastParagraph &&
            session.currentSentence &&
            !activeStartsNewParagraph

          // Paragraph of sentences
          return (
            <div key={`paragraph-${index}`} className="mb-6" ref={isLastParagraph ? activeSentenceRef : null}>
              <FlowingParagraph
                sentences={paragraphSentences}
                onSentenceClick={handleSentenceClick}
                activeSentenceId={activeTooltipSentence?.sentence_id}
                // Include active sentence inline at end of last paragraph
                activeSentence={includeActiveSentence ? session.currentSentence : null}
                currentFragmentIndex={session.currentFragmentIndex}
                onConfirm={session.handleConfirm}
                isTransitioning={session.isTransitioning}
                // Blurred preview of next sentence or chapter
                nextSentencePreview={includeActiveSentence ? session.nextSentencePreview : null}
                nextChapterPreview={includeActiveSentence ? session.nextChapterPreview : null}
              />
            </div>
          )
        })}

        {/* Active sentence as new paragraph (if it starts one or no completed sentences) */}
        {session.currentSentence && (activeStartsNewParagraph || !hasCompletedSentences) && (
          <div className="mb-6" ref={activeSentenceRef}>
            <p className="text-lg leading-relaxed text-neutral-800 mb-0 px-4">
              {/* Wrap in transition container to fade during sentence completion */}
              <span className={`transition-opacity duration-100 ${session.isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                <ActiveSentenceInline
                  ref={standaloneActiveSentenceRef}
                  sentence={session.currentSentence}
                  currentFragmentIndex={session.currentFragmentIndex}
                />
              </span>
              {/* Next sentence preview - blurred inline (if not a new paragraph) */}
              {/* Hide during transition to prevent flash of duplicate sentence */}
              {!session.isTransitioning && session.nextSentencePreview && !session.nextSentencePreview.is_paragraph_start && (
                <span className="text-neutral-300 blur-[3px] select-none ml-1">
                  {session.nextSentencePreview.sentence_text}
                </span>
              )}
            </p>
            {/* Next sentence preview as new paragraph (if it starts one) */}
            {!session.isTransitioning && session.nextSentencePreview && session.nextSentencePreview.is_paragraph_start && (
              <p className="text-lg leading-relaxed text-neutral-300 blur-[3px] select-none mt-4 px-4">
                {session.nextSentencePreview.sentence_text}
              </p>
            )}
            {/* Next chapter preview (at chapter boundary) */}
            {!session.isTransitioning && session.nextChapterPreview && !session.nextSentencePreview && (
              <div className="text-neutral-300 blur-[3px] select-none mt-8 text-center">
                Capítulo {toRoman(session.nextChapterPreview)}
              </div>
            )}
            {/* Check button - below paragraph, right-aligned */}
            <div className="flex justify-end mt-3 px-4">
              <button
                onClick={handleStandaloneConfirm}
                disabled={session.isTransitioning}
                className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100
                           text-emerald-500 transition-colors duration-150 shadow-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="I understand"
              >
                <Check size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sentence tooltip */}
      {activeTooltipSentence && (
        <SentenceTooltip
          sentence={activeTooltipSentence}
          position={tooltipPosition}
          onClose={() => setActiveTooltipSentence(null)}
          onToggleHighlight={handleToggleHighlight}
          isHighlighted={activeTooltipSentence.is_highlighted}
        />
      )}

      {/* Navigation controls - tape deck style */}
      <NavigationControls
        onChapterBack={session.goToPreviousChapter}
        onSentenceBack={session.goToPreviousSentence}
        onSentenceForward={session.goToNextSentence}
        onChapterForward={session.goToNextChapter}
        canChapterBack={session.canChapterBack}
        canSentenceBack={session.canSentenceBack}
        canSentenceForward={session.canSentenceForward}
        canChapterForward={session.canChapterForward}
      />
    </div>
  )
}
