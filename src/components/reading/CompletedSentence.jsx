/**
 * CompletedSentence - Renders a completed sentence
 *
 * Features:
 * - All black text (sentence complete)
 * - Tap/click to expand and show fragment translations
 * - Long-press (500ms) on mobile for translation peek
 * - Colored dot toggle for highlighting sentences
 * - Subtle visual indicator that it's tappable
 */

import { useState, useRef, forwardRef, Fragment } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CompletedSentence = forwardRef(function CompletedSentence({
  sentence,
  fragments = [],
  userId
}, ref) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHighlighted, setIsHighlighted] = useState(sentence?.is_highlighted || false)
  const [longPressFragment, setLongPressFragment] = useState(null)
  const longPressTimer = useRef(null)

  if (!sentence) return null

  // Get fragments from sentence if not passed directly
  const sentenceFragments = fragments.length > 0 ? fragments : (sentence.fragments || [])

  const handleClick = () => {
    setIsExpanded(!isExpanded)
  }

  const handleToggleHighlight = async (e) => {
    e.stopPropagation() // Don't trigger expand/collapse
    const newValue = !isHighlighted
    setIsHighlighted(newValue)

    // Save to database
    if (userId && sentence.sentence_id) {
      await supabase
        .from('user_sentence_progress')
        .upsert({
          user_id: userId,
          sentence_id: sentence.sentence_id,
          is_highlighted: newValue
        }, { onConflict: 'user_id,sentence_id' })
    }
  }

  const handleTouchStart = (fragment) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressFragment(fragment)
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setLongPressFragment(null)
  }

  const handleMouseEnter = (fragment) => {
    // Desktop hover behavior
    setLongPressFragment(fragment)
  }

  const handleMouseLeave = () => {
    setLongPressFragment(null)
  }

  return (
    <div
      ref={ref}
      className={`completed-sentence py-3 px-4 rounded-lg transition-colors ${
        isHighlighted ? 'bg-amber-50/50' : ''
      }`}
    >
      <style>{`
        .completed-sentence-text {
          transition: background-color 0.15s ease;
          cursor: pointer;
          border-radius: 4px;
          padding: 4px 0;
        }

        .completed-sentence-text:hover {
          background-color: rgba(0, 0, 0, 0.03);
        }

        .expand-indicator {
          transition: transform 0.2s ease;
        }

        .fragment-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #1a1a1a;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          white-space: nowrap;
          z-index: 50;
          pointer-events: none;
          animation: tooltipFadeIn 0.15s ease-out;
        }

        .fragment-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #1a1a1a;
        }

        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .fragment-hover {
          position: relative;
          cursor: help;
          border-radius: 2px;
          transition: background-color 0.1s ease;
        }

        .fragment-hover:hover {
          background-color: rgba(168, 218, 220, 0.3);
        }

        .expanded-fragments {
          animation: expandFadeIn 0.2s ease-out;
        }

        @keyframes expandFadeIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 500px; }
        }

        .highlight-dot {
          transition: all 0.15s ease;
        }
      `}</style>

      {/* Collapsed view - sentence text with highlight toggle */}
      <div className="flex items-start gap-2">
        <div
          className="completed-sentence-text flex items-start justify-between gap-2 flex-1"
          onClick={handleClick}
        >
          <p className="text-base leading-relaxed text-neutral-800 flex-1">
            {/* Render with spaces between fragments */}
            {sentenceFragments.length > 0 ? (
              sentenceFragments.map((fragment, index) => (
                <Fragment key={fragment.fragment_id || index}>
                  {fragment.fragment_text}
                  {index < sentenceFragments.length - 1 && ' '}
                </Fragment>
              ))
            ) : (
              sentence.sentence_text
            )}
          </p>
          <span className="expand-indicator text-neutral-400 flex-shrink-0 mt-1">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>

        {/* Highlight toggle dot */}
        <button
          onClick={handleToggleHighlight}
          className="mt-1 p-1 rounded-full hover:bg-neutral-100 transition-colors flex-shrink-0"
          aria-label={isHighlighted ? "Remove highlight" : "Highlight for review"}
        >
          <div className={`highlight-dot w-3 h-3 rounded-full border-2 ${
            isHighlighted
              ? 'bg-amber-400 border-amber-400'
              : 'border-neutral-300 hover:border-neutral-400'
          }`} />
        </button>
      </div>

      {/* Expanded view - fragments with translations */}
      {isExpanded && (
        <div className="expanded-fragments mt-3 pl-4 border-l-2 border-neutral-200">
          {sentenceFragments.map((fragment, index) => (
            <div
              key={fragment.fragment_id || index}
              className="fragment-item py-2"
            >
              {/* Fragment text with hover/long-press for translation */}
              <span
                className="fragment-hover relative inline-block"
                onTouchStart={() => handleTouchStart(fragment)}
                onTouchEnd={handleTouchEnd}
                onMouseEnter={() => handleMouseEnter(fragment)}
                onMouseLeave={handleMouseLeave}
              >
                {fragment.fragment_text}

                {/* Tooltip on hover/long-press */}
                {longPressFragment?.fragment_id === fragment.fragment_id && (
                  <span className="fragment-tooltip">
                    {fragment.fragment_translation || 'No translation'}
                  </span>
                )}
              </span>

              {/* Translation always visible in expanded mode */}
              <p className="text-sm text-neutral-500 italic mt-1">
                {fragment.fragment_translation || 'No translation available'}
              </p>
            </div>
          ))}

          {/* Full sentence translation */}
          <div className="mt-3 pt-3 border-t border-neutral-200">
            <p className="text-sm text-neutral-600 italic">
              {sentence.sentence_translation || 'No translation available'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
})

export default CompletedSentence
