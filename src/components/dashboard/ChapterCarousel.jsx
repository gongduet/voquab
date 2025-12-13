import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, BookOpen, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ChapterCarousel - Collapsible chapter grid with smart defaults
 *
 * @param {Object} props
 * @param {Array} props.chapters - Array of chapter objects with progress
 * @param {boolean} props.loading - Loading state
 */
export default function ChapterCarousel({ chapters = [], loading = false }) {
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

  // Find current chapter (first unlocked with progress < 95%)
  const currentChapterIndex = chapters.findIndex(ch => {
    const progress = ch.total_lemmas > 0 ? (ch.introduced / ch.total_lemmas) : 0
    return ch.isUnlocked && progress < 0.95
  })

  // If no current chapter found, show first unlocked or first chapter
  const startIndex = currentChapterIndex >= 0 ? currentChapterIndex : 0

  // Collapsed: show current chapter + next 3 chapters (4 total for 2x2 grid)
  const visibleChapters = isExpanded
    ? chapters
    : chapters.slice(startIndex, Math.min(startIndex + 4, chapters.length))

  return (
    <div className="px-4">
      {/* Header with expand/collapse button */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-neutral-900">Chapters</h2>
        {chapters.length > 4 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary-500 text-sm font-medium flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            {isExpanded ? (
              <>
                Show less
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                View all {chapters.length}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Chapter cards - 2 column grid */}
      <div className="grid grid-cols-2 gap-3">
        {visibleChapters.map((chapter) => {
          const progress = chapter.total_lemmas > 0 ? (chapter.introduced / chapter.total_lemmas) : 0
          const isCurrent = chapter.isUnlocked && progress < 0.95 && chapters.indexOf(chapter) === currentChapterIndex
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
function ChapterCard({ chapter, isCurrent, isCompleted, onNavigate, onStudy }) {
  const {
    chapter_number,
    title,
    introduced = 0,
    total_lemmas = 1,
    isUnlocked = false,
    isNextToUnlock = false
  } = chapter

  const progress = total_lemmas > 0 ? Math.round((introduced / total_lemmas) * 100) : 0

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
            {title || `Chapter ${chapter_number}`}
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

      {/* Progress bar - using inline style for width */}
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
        <div className="w-full bg-neutral-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300`}
            style={{
              width: `${progress}%`,
              backgroundColor: isCurrent ? '#0ea5e9' : isCompleted ? '#f59e0b' : isNextToUnlock ? '#fbbf24' : '#a8a29e'
            }}
          />
        </div>
      </div>

      {/* Single compact action button */}
      {(isUnlocked || isNextToUnlock) && (
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
          {isNextToUnlock ? 'Study' : isCompleted ? 'Review' : 'Continue'}
        </button>
      )}
    </div>
  )
}
