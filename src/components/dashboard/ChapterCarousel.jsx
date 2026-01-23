import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, BookOpen, CheckCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react'

/**
 * ChapterCarousel - Collapsible chapter grid with smart defaults
 *
 * Shows 4 chapters initially: 1 back, current, 2 forward
 * Expands to show all when "View all" is clicked
 */
export default function ChapterCarousel({
  chapters = [],
  totalChapters = 0,
  currentChapterIndex = 0,
  allChaptersLoaded = false,
  onLoadAllChapters,
  loading = false
}) {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(false)

  if (loading) {
    return (
      <div className="px-4">
        <h2 className="text-lg font-bold text-neutral-900 mb-3">Chapters</h2>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-neutral-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (chapters.length === 0) {
    return (
      <div className="px-4">
        <h2 className="text-lg font-bold text-neutral-900 mb-3">Chapters</h2>
        <div className="bg-white border border-neutral-100 rounded-xl p-6 text-center text-neutral-500">
          No chapters available yet
        </div>
      </div>
    )
  }

  // Handle expand/collapse
  const handleToggleExpand = () => {
    if (!isExpanded && !allChaptersLoaded && onLoadAllChapters) {
      // Load all chapters when expanding for the first time
      onLoadAllChapters()
    }
    setIsExpanded(!isExpanded)
  }

  // Determine which chapters to show (centered around current: 1 before, current, 2 after)
  const startIdx = Math.max(0, currentChapterIndex - 1)
  const visibleChapters = isExpanded ? chapters : chapters.slice(startIdx, startIdx + 4)

  return (
    <div className="px-4">
      {/* Header with expand/collapse button */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-neutral-900">Chapters</h2>
        {totalChapters > 4 && (
          <button
            onClick={handleToggleExpand}
            className="text-primary-500 text-sm font-medium flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            {isExpanded ? (
              <>
                Show less
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                View all {totalChapters}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Chapter cards - 2 column grid */}
      <div className="grid grid-cols-2 gap-3">
        {visibleChapters.map((chapter, index) => {
          const progress = chapter.total_lemmas > 0 ? (chapter.introduced / chapter.total_lemmas) : 0
          // Calculate actual index in full chapters array
          const actualIndex = isExpanded ? index : startIdx + index
          const isCurrent = actualIndex === currentChapterIndex ||
                           (chapter.isUnlocked && progress < 0.95 &&
                            chapters.findIndex(c => c.isUnlocked && (c.introduced / c.total_lemmas) < 0.95) === actualIndex)
          const isCompleted = chapter.isUnlocked && progress >= 0.95

          return (
            <ChapterCard
              key={chapter.chapter_number}
              chapter={chapter}
              isCurrent={isCurrent}
              isCompleted={isCompleted}
              onNavigate={() => {
                if (chapter.isUnlocked) {
                  navigate(`/read/${chapter.chapter_number}`)
                } else if (chapter.isNextToUnlock) {
                  navigate(`/flashcards?chapter=${chapter.chapter_number}`)
                }
              }}
              onStudy={() => navigate(`/flashcards?chapter=${chapter.chapter_number}`)}
              onFragments={() => navigate(`/fragments/read/${chapter.chapter_id}`)}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Compact chapter card with improved visual states
 */
function ChapterCard({ chapter, isCurrent, isCompleted, onNavigate, onStudy, onFragments }) {
  const {
    chapter_number,
    title,
    introduced = 0,
    total_lemmas = 1,
    mastered = 0,
    familiar = 0,
    learning = 0,
    isUnlocked = false,
    isNextToUnlock = false,
    // Fragment properties
    fragmentsUnlocked = false,
    fragmentsBlockedByPrevChapter = false,
    prevChapterNumber = null,
    totalFragments = 0,
    fragmentsSeen = 0,
    isFragmentsComplete = false
  } = chapter

  const progress = total_lemmas > 0 ? Math.round((introduced / total_lemmas) * 100) : 0
  const fragmentProgress = totalFragments > 0 ? Math.round((fragmentsSeen / totalFragments) * 100) : 0

  // Visual states - softer styling
  const getCardStyles = () => {
    if (isCurrent) {
      return 'bg-white ring-1 ring-primary-200 border border-primary-100 shadow-sm'
    }
    if (isCompleted) {
      return 'bg-white border border-secondary-100 shadow-sm'
    }
    if (isUnlocked) {
      return 'bg-white border border-neutral-100 shadow-sm'
    }
    if (isNextToUnlock) {
      return 'bg-secondary-50 border border-secondary-200 shadow-sm'
    }
    return 'bg-neutral-50 border border-neutral-100'
  }

  const handleClick = () => {
    if (isUnlocked || isNextToUnlock) {
      onNavigate()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`
        rounded-xl p-3 transition-all duration-150
        ${getCardStyles()}
        ${(isUnlocked || isNextToUnlock) ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed opacity-60'}
      `}
    >
      {/* Header - compact */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${
            isCurrent ? 'text-primary-600' : isCompleted ? 'text-secondary-600' : 'text-neutral-400'
          }`}>
            {isCurrent ? 'Current' : `Ch. ${chapter_number}`}
          </div>
          <h3 className={`text-sm font-bold truncate ${
            isUnlocked || isNextToUnlock ? 'text-neutral-900' : 'text-neutral-400'
          }`}>
            {title || `Capítulo ${chapter_number}`}
          </h3>
        </div>

        {/* Status icon - smaller */}
        <div className="flex-shrink-0 ml-1">
          {isCompleted ? (
            <CheckCircle className="w-4 h-4 text-secondary-500" fill="currentColor" />
          ) : isUnlocked ? (
            <BookOpen className="w-4 h-4 text-primary-500" />
          ) : isNextToUnlock ? (
            <Lock className="w-4 h-4 text-secondary-500" />
          ) : (
            <Lock className="w-4 h-4 text-neutral-300" />
          )}
        </div>
      </div>

      {/* Vocabulary Progress bar - 4-level stacked */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className={isUnlocked || isNextToUnlock ? 'text-neutral-500' : 'text-neutral-300'}>
            {introduced}/{total_lemmas}
          </span>
          <span className={`font-bold ${
            isCurrent ? 'text-primary-600' : isCompleted ? 'text-secondary-600' : isNextToUnlock ? 'text-secondary-500' : 'text-neutral-400'
          }`}>
            {progress}%
          </span>
        </div>
        <StackedProgressBar
          mastered={mastered}
          familiar={familiar}
          learning={learning}
          total={total_lemmas}
          isLocked={!isUnlocked && !isNextToUnlock}
        />
      </div>

      {/* Fragment Progress bar - only show when fragments are unlocked */}
      {fragmentsUnlocked && totalFragments > 0 && (
        <div className="mt-1.5">
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-neutral-500 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {fragmentsSeen}/{totalFragments}
            </span>
            <span className={`font-bold ${isFragmentsComplete ? 'text-amber-700' : 'text-amber-500'}`}>
              {fragmentProgress}%
            </span>
          </div>
          <FragmentProgressBar
            seen={fragmentsSeen}
            total={totalFragments}
            isComplete={isFragmentsComplete}
          />
        </div>
      )}

      {/* Action buttons - vocab study or fragment actions */}
      {(isUnlocked || isNextToUnlock) && (
        <>
          {/* Vocabulary button - show when not complete or when it's next to unlock */}
          {(isNextToUnlock || (!isCompleted && !fragmentsUnlocked)) && (
            <button
              onClick={(e) => { e.stopPropagation(); isNextToUnlock ? onStudy() : onNavigate() }}
              className={`
                w-full mt-2 py-1.5 text-xs font-semibold rounded-lg transition-colors
                ${isNextToUnlock
                  ? 'bg-secondary-500 text-white'
                  : isCurrent
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }
              `}
              style={{
                backgroundColor: isNextToUnlock ? '#f59e0b' : isCurrent ? '#0ea5e9' : undefined
              }}
            >
              {isNextToUnlock ? 'Study' : 'Continue'}
            </button>
          )}

          {/* Fragment button - show when vocabulary is complete (>=95%) AND previous chapter fragments complete */}
          {fragmentsUnlocked && totalFragments > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); isFragmentsComplete ? onNavigate() : onFragments() }}
              className={`
                w-full mt-2 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1
                ${isFragmentsComplete
                  ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
                }
              `}
            >
              <FileText className="w-3 h-3" />
              {isFragmentsComplete
                ? 'Read Chapter'
                : fragmentsSeen === 0
                  ? 'Start Fragments'
                  : `Resume (${fragmentsSeen}/${totalFragments})`
              }
            </button>
          )}

          {/* Fragments blocked by previous chapter - show disabled message */}
          {fragmentsBlockedByPrevChapter && totalFragments > 0 && (
            <div className="w-full mt-2 py-1.5 text-xs font-medium rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              Complete Ch. {prevChapterNumber} first
            </div>
          )}

          {/* Review button for completed chapters without fragments unlocked yet (vocab not at 95%) */}
          {isCompleted && !fragmentsUnlocked && !fragmentsBlockedByPrevChapter && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate() }}
              className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg transition-colors bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            >
              Review
            </button>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Stacked progress bar showing 4 levels of mastery
 */
function StackedProgressBar({ mastered, familiar, learning, total, isLocked }) {
  if (total === 0) return null

  const masteredPct = (mastered / total) * 100
  const familiarPct = (familiar / total) * 100
  const learningPct = (learning / total) * 100
  // notSeen fills the rest

  // Colors
  const colors = {
    mastered: '#1e3a5f',
    familiar: '#0369a1',
    learning: '#38bdf8',
    notSeen: '#d6d3d1'
  }

  // If locked, show gray bar with darker gray for words already seen
  if (isLocked) {
    const seenPct = total > 0 ? ((mastered + familiar + learning) / total) * 100 : 0
    return (
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e5e5' }}>
        {seenPct > 0 && (
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${seenPct}%`, backgroundColor: '#a3a3a3' }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden flex" style={{ backgroundColor: colors.notSeen }}>
      {masteredPct > 0 && (
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${masteredPct}%`, backgroundColor: colors.mastered }}
        />
      )}
      {familiarPct > 0 && (
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${familiarPct}%`, backgroundColor: colors.familiar }}
        />
      )}
      {learningPct > 0 && (
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${learningPct}%`, backgroundColor: colors.learning }}
        />
      )}
      {/* notSeen is the background, no need to render */}
    </div>
  )
}

/**
 * Simple progress bar for fragment reading progress
 * Uses amber/gold tones to differentiate from vocabulary bar
 */
function FragmentProgressBar({ seen, total, isComplete }) {
  if (total === 0) return null

  const seenPct = (seen / total) * 100

  // Colors - amber/gold tones
  const colors = {
    seen: isComplete ? '#92400e' : '#d97706', // amber-800 when complete, amber-600 otherwise
    notSeen: '#fef3c7' // amber-100 background
  }

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.notSeen }}>
      {seenPct > 0 && (
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${seenPct}%`, backgroundColor: colors.seen }}
        />
      )}
    </div>
  )
}
