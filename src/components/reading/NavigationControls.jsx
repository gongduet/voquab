/**
 * NavigationControls - Tape deck style navigation for reading mode
 *
 * Fixed position on right side of screen:
 * - ^^ Chapter back
 * - ^  Sentence back
 * - v  Sentence forward (only if already visited)
 * - vv Chapter forward (only if already visited)
 */

import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react'

export default function NavigationControls({
  onChapterBack,
  onSentenceBack,
  onSentenceForward,
  onChapterForward,
  canChapterBack,
  canSentenceBack,
  canSentenceForward,
  canChapterForward
}) {
  const buttonClass = (enabled) => `
    p-2 rounded-lg transition-colors
    ${enabled
      ? 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 cursor-pointer'
      : 'text-neutral-200 cursor-not-allowed'
    }
  `

  // Position relative to content area (max-w-3xl = 768px)
  // calc(50% + 384px + 16px) puts it just outside the content on the right
  return (
    <div className="fixed left-[calc(50%+400px)] top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-40">
      {/* Chapter back */}
      <button
        onClick={onChapterBack}
        disabled={!canChapterBack}
        className={buttonClass(canChapterBack)}
        title="Previous chapter"
      >
        <ChevronsUp size={20} />
      </button>

      {/* Sentence back */}
      <button
        onClick={onSentenceBack}
        disabled={!canSentenceBack}
        className={buttonClass(canSentenceBack)}
        title="Previous sentence"
      >
        <ChevronUp size={20} />
      </button>

      {/* Spacer */}
      <div className="h-16" />

      {/* Sentence forward */}
      <button
        onClick={onSentenceForward}
        disabled={!canSentenceForward}
        className={buttonClass(canSentenceForward)}
        title="Next sentence"
      >
        <ChevronDown size={20} />
      </button>

      {/* Chapter forward */}
      <button
        onClick={onChapterForward}
        disabled={!canChapterForward}
        className={buttonClass(canChapterForward)}
        title="Next chapter"
      >
        <ChevronsDown size={20} />
      </button>
    </div>
  )
}
