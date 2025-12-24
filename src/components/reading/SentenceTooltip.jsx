/**
 * SentenceTooltip - Popup tooltip for sentence translation
 *
 * Features:
 * - Shows Spanish text and English translation
 * - "Show Fragments" button to expand fragment breakdown
 * - Highlight toggle button
 * - Positioned above the tapped sentence
 * - Click outside to dismiss
 */

import { useState, useEffect, useRef } from 'react'

export default function SentenceTooltip({
  sentence,
  position,
  onClose,
  onToggleHighlight,
  isHighlighted
}) {
  const [showFragments, setShowFragments] = useState(false)
  const [placement, setPlacement] = useState('above')
  const [adjustedPos, setAdjustedPos] = useState({ left: 0, top: 0 })
  const tooltipRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        onClose()
      }
    }
    // Delay to prevent immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Calculate adjusted position after tooltip renders
  useEffect(() => {
    if (tooltipRef.current) {
      const tooltip = tooltipRef.current
      const rect = tooltip.getBoundingClientRect()
      const padding = 16
      const tooltipWidth = rect.width || 320

      // Calculate horizontal position
      let left = position.x
      const halfWidth = tooltipWidth / 2
      if (left - halfWidth < padding) {
        left = halfWidth + padding
      } else if (left + halfWidth > window.innerWidth - padding) {
        left = window.innerWidth - halfWidth - padding
      }

      // Determine if we should show above or below
      const estimatedHeight = rect.height || 200
      const spaceAbove = position.y - 8
      const spaceBelow = window.innerHeight - position.y - (position.height || 0) - 8

      let newPlacement = 'above'
      let top = position.y - 8

      if (spaceAbove < estimatedHeight + padding && spaceBelow > spaceAbove) {
        // Not enough space above, show below
        newPlacement = 'below'
        top = position.y + (position.height || 20) + 8
      }

      setPlacement(newPlacement)
      setAdjustedPos({ left, top })
    }
  }, [position, showFragments]) // Recalculate when fragments expand

  // Get position style
  const getPositionStyle = () => {
    return {
      position: 'fixed',
      zIndex: 50,
      left: adjustedPos.left,
      top: adjustedPos.top,
      transform: placement === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      maxWidth: 'calc(100vw - 32px)',
      width: 320
    }
  }

  const fragments = sentence.fragments || []

  return (
    <div
      ref={tooltipRef}
      className="sentence-tooltip bg-white rounded-lg shadow-xl border border-neutral-200 p-4 animate-fadeIn"
      style={getPositionStyle()}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 150ms ease-out;
        }
      `}</style>

      {/* Spanish text */}
      <p className="font-medium text-neutral-900 mb-2 text-base">
        {sentence.sentence_text}
      </p>

      {/* Divider */}
      <div className="border-t border-neutral-100 my-2" />

      {/* English translation */}
      <p className="text-neutral-600 italic mb-3 text-sm">
        {sentence.sentence_translation || 'No translation available'}
      </p>

      {/* Fragment expansion */}
      {showFragments && fragments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          {fragments
            .sort((a, b) => a.fragment_order - b.fragment_order)
            .map((frag, i) => (
              <div key={frag.fragment_id || i} className="mb-2 last:mb-0">
                <p className="text-sm font-medium text-neutral-800">
                  {frag.fragment_text}
                </p>
                <p className="text-sm text-neutral-500 italic">
                  {frag.fragment_translation || 'No translation'}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        {fragments.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowFragments(!showFragments)
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showFragments ? 'Hide Fragments' : 'Show Fragments'}
          </button>
        ) : (
          <span className="text-sm text-neutral-400">No fragments</span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleHighlight()
          }}
          className={`flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded transition-colors
            ${isHighlighted
              ? 'bg-amber-100 text-amber-700'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full border-2 transition-colors
            ${isHighlighted
              ? 'bg-amber-400 border-amber-400'
              : 'border-neutral-400'
            }`}
          />
          {isHighlighted ? 'Highlighted' : 'Highlight'}
        </button>
      </div>
    </div>
  )
}
