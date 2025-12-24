/**
 * ActiveSentenceInline - Inline version of active sentence for flowing paragraphs
 *
 * Renders as inline spans that flow with preceding sentences.
 * Shows fragment highlighting: completed (normal), active (bold), upcoming (blurred).
 * Tap active fragment to peek at translation.
 * Check button is rendered separately below the paragraph.
 */

import { useState, Fragment, useRef, useImperativeHandle, forwardRef } from 'react'

const ActiveSentenceInline = forwardRef(function ActiveSentenceInline({
  sentence,
  currentFragmentIndex
}, ref) {
  const [peekedFragmentId, setPeekedFragmentId] = useState(null)
  const [peekedFragments, setPeekedFragments] = useState(new Set())
  const sentenceRef = useRef(null)

  const fragments = sentence?.fragments || []
  const currentFragment = fragments[currentFragmentIndex]

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    wasCurrentFragmentPeeked: () => {
      return currentFragment && peekedFragments.has(currentFragment.fragment_id)
    },
    dismissTooltip: () => {
      setPeekedFragmentId(null)
    }
  }), [currentFragment, peekedFragments])

  if (!sentence) return null

  // Handle fragment click for peek tooltip
  const handleFragmentClick = (fragment, index, e) => {
    e.stopPropagation()

    // Only allow peeking at current or completed fragments
    if (index <= currentFragmentIndex) {
      if (peekedFragmentId === fragment.fragment_id) {
        setPeekedFragmentId(null)
      } else {
        setPeekedFragmentId(fragment.fragment_id)
        if (!peekedFragments.has(fragment.fragment_id)) {
          setPeekedFragments(prev => new Set([...prev, fragment.fragment_id]))
        }
      }
    }
  }

  // Dismiss tooltip on outside click
  const handleContainerClick = (e) => {
    if (!e.target.closest('.fragment-span')) {
      setPeekedFragmentId(null)
    }
  }

  return (
    <span
      ref={sentenceRef}
      className="active-sentence-inline sentence-enter"
      onClick={handleContainerClick}
    >
      <style>{`
        .active-sentence-inline .fragment-completed {
          color: #1a1a1a;
        }

        .active-sentence-inline .fragment-active {
          font-weight: 600;
          color: #1a1a1a;
          cursor: pointer;
        }

        .active-sentence-inline .fragment-upcoming {
          color: #d4d4d4;
          filter: blur(3px);
          user-select: none;
        }

        .active-sentence-inline .peek-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          z-index: 20;
          white-space: nowrap;
        }

        @keyframes sentenceEnterInline {
          from {
            opacity: 0.5;
            filter: blur(4px);
          }
          to {
            opacity: 1;
            filter: blur(0);
          }
        }

        .sentence-enter {
          animation: sentenceEnterInline 500ms ease-out forwards;
        }
      `}</style>

      {fragments.map((fragment, index) => {
        const isCompleted = index < currentFragmentIndex
        const isActive = index === currentFragmentIndex
        const isUpcoming = index > currentFragmentIndex

        let fragmentClass = 'fragment-span relative inline transition-all duration-200 '
        if (isCompleted) fragmentClass += 'fragment-completed'
        else if (isActive) fragmentClass += 'fragment-active'
        else if (isUpcoming) fragmentClass += 'fragment-upcoming'

        return (
          <Fragment key={fragment.fragment_id || index}>
            <span
              className={fragmentClass}
              onClick={(e) => handleFragmentClick(fragment, index, e)}
            >
              {fragment.fragment_text}

              {/* Peek tooltip */}
              {peekedFragmentId === fragment.fragment_id && (
                <span className="peek-tooltip">
                  <span className="bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 text-sm block">
                    <span className="text-neutral-600 italic">
                      {fragment.fragment_translation || 'No translation'}
                    </span>
                  </span>
                </span>
              )}
            </span>
            {index < fragments.length - 1 && ' '}
          </Fragment>
        )
      })}
    </span>
  )
})

export default ActiveSentenceInline
