/**
 * StickyHeader - Shows current chapter name/number with chapter selector dropdown
 *
 * Layout: Exit (left) | Book Title (center) | Chapter Dropdown (right)
 * Features:
 * - Smooth animated dropdown for chapter selection
 * - Cascading waterfall animation for chapter items
 * - Only shows unlocked chapters
 * - Roman numeral chapter numbers
 */

import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// Convert number to Roman numeral
function toRoman(num) {
  if (!num || num < 1) return ''

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

export default function StickyHeader({
  chapterNumber,
  bookTitle = 'El Principito',
  furthestChapter = 1,
  onJumpToChapter = null
}) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const dropdownRef = useRef(null)
  const romanNumeral = toRoman(chapterNumber)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Trigger cascade animation when opening
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dropdown is visible before animating items
      const timer = setTimeout(() => setShouldAnimate(true), 50)
      return () => clearTimeout(timer)
    } else {
      setShouldAnimate(false)
    }
  }, [isOpen])

  const handleExit = () => {
    navigate('/dashboard')
  }

  const handleChapterSelect = (chapter) => {
    setIsOpen(false)
    if (onJumpToChapter && chapter !== chapterNumber) {
      onJumpToChapter(chapter)
    }
  }

  // Generate list of unlocked chapters (1 to furthestChapter)
  const unlockedChapters = Array.from(
    { length: furthestChapter },
    (_, i) => i + 1
  )

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-neutral-100">
      <div className="flex items-center justify-between px-4 py-3 max-w-3xl mx-auto">
        {/* Left - Exit */}
        <button
          onClick={handleExit}
          className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Exit</span>
        </button>

        {/* Center - Book Title */}
        <h1 className="font-serif text-lg text-neutral-700">
          {bookTitle}
        </h1>

        {/* Right - Chapter Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={!onJumpToChapter}
            className={`
              flex items-center gap-1 text-sm text-neutral-500
              px-2 py-1 rounded-md
              transition-all duration-200
              ${onJumpToChapter
                ? 'hover:text-neutral-700 hover:bg-neutral-100 hover:shadow-sm cursor-pointer'
                : 'cursor-default'
              }
              ${isOpen ? 'bg-neutral-100 shadow-sm text-neutral-700' : ''}
            `}
          >
            <span>{chapterNumber ? `Capítulo ${romanNumeral}` : ''}</span>
            {onJumpToChapter && (
              <ChevronDown
                size={14}
                className={`
                  transition-transform duration-300 ease-out
                  ${isOpen ? 'rotate-180' : ''}
                `}
              />
            )}
          </button>

          {/* Dropdown Menu */}
          <div
            className={`
              absolute top-full right-0 mt-2
              bg-white/95 backdrop-blur-sm rounded-xl
              border border-neutral-200/60
              min-w-[160px] overflow-hidden
              transition-all duration-300 origin-top-right
              ${isOpen
                ? 'opacity-100 scale-100 translate-y-0 shadow-lg shadow-neutral-900/10'
                : 'opacity-0 scale-95 -translate-y-2 shadow-none pointer-events-none'
              }
            `}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div className="py-1.5 max-h-[280px] overflow-y-auto">
              {unlockedChapters.map((chapter, index) => (
                <button
                  key={chapter}
                  onClick={() => handleChapterSelect(chapter)}
                  className={`
                    w-full px-4 py-2 text-sm text-left
                    transition-all duration-250 ease-out
                    ${chapter === chapterNumber
                      ? 'bg-amber-50/80 text-amber-700 font-medium'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                    }
                  `}
                  style={{
                    opacity: shouldAnimate ? 1 : 0,
                    transform: shouldAnimate ? 'translateY(0)' : 'translateY(-8px)',
                    transitionDelay: `${index * 40}ms`,
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  Capítulo {toRoman(chapter)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
