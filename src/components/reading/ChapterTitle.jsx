/**
 * ChapterTitle - Inline chapter title styled like the book
 *
 * Elegant typography matching Little Prince aesthetic
 * "Capítulo I", "Capítulo II", etc.
 */

import { forwardRef } from 'react'

// Convert number to Roman numeral
function toRoman(num) {
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

const ChapterTitle = forwardRef(function ChapterTitle({
  chapterNumber,
  title,
  isFirst = false
}, ref) {
  const romanNumeral = toRoman(chapterNumber)

  // Filter out duplicate chapter titles like "Capítulo 1", "Capitulo 2", etc.
  // Only show if it's a real chapter name (not just "Capítulo N")
  const hasRealTitle = title && !/^Cap[ií]tulo\s*\d+$/i.test(title.trim())

  return (
    <div
      ref={ref}
      className={`chapter-title text-center ${isFirst ? 'pt-8' : 'pt-12'} pb-8 px-4`}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        .chapter-numeral {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 500;
          font-size: 1.5rem;
          letter-spacing: 0.15em;
          color: #6d6875;
          text-transform: uppercase;
        }

        .chapter-title-text {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-weight: 400;
          font-style: italic;
          font-size: 1.125rem;
          color: #9ca3af;
          margin-top: 0.5rem;
        }

        .chapter-divider {
          width: 60px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            #d1d5db 20%,
            #d1d5db 80%,
            transparent
          );
          margin: 1rem auto 0;
        }
      `}</style>

      {/* Chapter number in Roman numerals */}
      <h2 className="chapter-numeral">
        Capítulo {romanNumeral}
      </h2>

      {/* Optional chapter title - only show if it's a real name, not "Capítulo N" */}
      {hasRealTitle && (
        <p className="chapter-title-text">
          {title}
        </p>
      )}

      {/* Decorative divider */}
      <div className="chapter-divider" />
    </div>
  )
})

export default ChapterTitle
