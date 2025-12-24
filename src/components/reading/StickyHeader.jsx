/**
 * StickyHeader - Shows current chapter name/number
 *
 * Layout: Exit (left) | Book Title (center) | Chapter (right)
 * Updates as user scrolls past chapter boundaries
 */

import { ArrowLeft } from 'lucide-react'
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
  bookTitle = 'El Principito'
}) {
  const navigate = useNavigate()
  const romanNumeral = toRoman(chapterNumber)

  const handleExit = () => {
    navigate('/dashboard')
  }

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

        {/* Right - Chapter */}
        <span className="text-sm text-neutral-500">
          {chapterNumber ? `Capítulo ${romanNumeral}` : ''}
        </span>
      </div>
    </header>
  )
}
