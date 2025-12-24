/**
 * ActiveSentence - The current sentence being worked on
 *
 * Fragment highlighting:
 * - Active: bold, black (#1a1a1a)
 * - Upcoming: light gray (#9ca3af)
 * - Completed: normal weight, black
 *
 * Features:
 * - Tap-to-peek translation tooltip
 * - Single check button to confirm understanding
 * - Blur-to-focus animation (800ms)
 */

import { forwardRef, useState, Fragment } from 'react'
import { Check } from 'lucide-react'

const ActiveSentence = forwardRef(function ActiveSentence({
  sentence,
  currentFragmentIndex,
  onConfirm,
  onPeek,  // Callback when fragment is peeked
  disabled = false
}, ref) {
  const [peekedFragmentId, setPeekedFragmentId] = useState(null)
  const [peekedFragments, setPeekedFragments] = useState(new Set())

  if (!sentence) return null

  const fragments = sentence.fragments || []
  const currentFragment = fragments[currentFragmentIndex]

  // Handle fragment click for peek tooltip
  const handleFragmentClick = (fragment, index, e) => {
    e.stopPropagation()

    // Only allow peeking at current or completed fragments, not upcoming
    if (index <= currentFragmentIndex) {
      if (peekedFragmentId === fragment.fragment_id) {
        setPeekedFragmentId(null) // Toggle off
      } else {
        setPeekedFragmentId(fragment.fragment_id)
        // Track that this fragment was peeked
        if (!peekedFragments.has(fragment.fragment_id)) {
          setPeekedFragments(prev => new Set([...prev, fragment.fragment_id]))
          // Notify parent about peek
          if (onPeek) {
            onPeek(fragment.fragment_id)
          }
        }
      }
    }
  }

  // Dismiss tooltip when clicking outside
  const handleContainerClick = (e) => {
    if (!e.target.closest('.fragment-span')) {
      setPeekedFragmentId(null)
    }
  }

  // Handle confirm button click
  const handleConfirmClick = () => {
    const wasPeeked = currentFragment && peekedFragments.has(currentFragment.fragment_id)
    if (onConfirm) {
      onConfirm(wasPeeked)
    }
    // Reset peeked state for next fragment
    setPeekedFragmentId(null)
  }

  // Get fragment class based on position
  const getFragmentClass = (index) => {
    let className = 'fragment-span fragment-transition relative inline '

    if (index < currentFragmentIndex) {
      className += 'fragment-completed cursor-pointer'
    } else if (index === currentFragmentIndex) {
      className += 'fragment-active cursor-pointer'
    } else {
      className += 'fragment-upcoming'
    }

    return className
  }

  return (
    <div
      ref={ref}
      className="active-sentence py-6 px-4"
      onClick={handleContainerClick}
    >
      <style>{`
        .fragment-transition {
          transition: all 0.2s ease;
        }

        .fragment-active {
          font-weight: 600;
          color: #1a1a1a;
          filter: blur(0);
          transition: all 200ms ease;
        }

        .fragment-upcoming {
          color: #d4d4d4;
          filter: blur(3px);
          transition: all 200ms ease;
          user-select: none;
        }

        .fragment-completed {
          font-weight: 400;
          color: #1a1a1a;
          filter: blur(0);
          transition: all 200ms ease;
        }

        @keyframes sentenceAppear {
          from {
            opacity: 0;
            filter: blur(10px);
            transform: scale(0.98) translateY(8px);
          }
          to {
            opacity: 1;
            filter: blur(0);
            transform: scale(1) translateY(0);
          }
        }

        .sentence-enter {
          animation: sentenceAppear 800ms ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fadeIn {
          animation: fadeIn 150ms ease-out;
        }

        .peek-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          z-index: 10;
        }
      `}</style>

      {/* Sentence text with fragment highlighting */}
      <div
        key={sentence.sentence_id}
        className="text-lg leading-relaxed sentence-enter"
      >
        {fragments.map((fragment, index) => (
          <Fragment key={fragment.fragment_id || index}>
            <span
              className={getFragmentClass(index)}
              onClick={(e) => handleFragmentClick(fragment, index, e)}
            >
              {fragment.fragment_text}

              {/* Peek tooltip */}
              {peekedFragmentId === fragment.fragment_id && (
                <div className="peek-tooltip animate-fadeIn">
                  <div className="bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 text-sm whitespace-nowrap">
                    <p className="text-neutral-600 italic">
                      {fragment.fragment_translation || 'No translation'}
                    </p>
                  </div>
                </div>
              )}
            </span>
            {/* Add space between fragments (except last) */}
            {index < fragments.length - 1 && ' '}
          </Fragment>
        ))}
      </div>

      {/* Single check button - right aligned */}
      <div className="flex justify-end mt-6 pr-2">
        <button
          onClick={handleConfirmClick}
          disabled={disabled}
          className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100
                     text-emerald-500 transition-colors duration-150 shadow-sm
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="I understand"
        >
          <Check size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
})

export default ActiveSentence
