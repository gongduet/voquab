/**
 * FlowingParagraph - A paragraph of flowing sentences
 *
 * Renders multiple sentences as continuous inline text,
 * like a real book paragraph.
 *
 * Can optionally include the active (in-progress) sentence
 * at the end of the paragraph for seamless flow.
 * Check button appears below the paragraph in a stable position.
 */

import { useRef } from 'react'
import { Check } from 'lucide-react'
import FlowingSentence from './FlowingSentence'
import ActiveSentenceInline from './ActiveSentenceInline'

// Convert number to Roman numeral
function toRoman(num) {
  if (!num) return ''
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

export default function FlowingParagraph({
  sentences,
  onSentenceClick,
  activeSentenceId,
  // Optional: include active sentence inline at end
  activeSentence = null,
  currentFragmentIndex = 0,
  onConfirm = null,
  isTransitioning = false,
  // Optional: blurred preview of next sentence or chapter
  nextSentencePreview = null,
  nextChapterPreview = null
}) {
  const activeSentenceRef = useRef(null)

  // Handle confirm click - check if fragment was peeked
  const handleConfirmClick = () => {
    const wasPeeked = activeSentenceRef.current?.wasCurrentFragmentPeeked?.() || false
    activeSentenceRef.current?.dismissTooltip?.()
    if (onConfirm) {
      onConfirm(wasPeeked)
    }
  }

  return (
    <div>
      <p className="text-lg leading-relaxed text-neutral-800 mb-0 px-4">
        {/* Completed sentences */}
        {sentences.map((sentence) => (
          <FlowingSentence
            key={sentence.sentence_id}
            sentence={sentence}
            isActive={activeSentenceId === sentence.sentence_id}
            onClick={(e) => onSentenceClick(sentence, e)}
          />
        ))}

        {/* Active sentence flows inline if provided */}
        {/* Wrap in transition container to fade during sentence completion */}
        {activeSentence && (
          <span className={`transition-opacity duration-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            <ActiveSentenceInline
              ref={activeSentenceRef}
              sentence={activeSentence}
              currentFragmentIndex={currentFragmentIndex}
            />
          </span>
        )}

        {/* Next sentence preview - fully blurred (only inline if not a new paragraph) */}
        {/* Hide during transition to prevent flash of duplicate sentence */}
        {!isTransitioning && activeSentence && nextSentencePreview && !nextSentencePreview.is_paragraph_start && (
          <span className="text-neutral-300 blur-[3px] select-none ml-1">
            {nextSentencePreview.sentence_text}
          </span>
        )}
      </p>

      {/* Next sentence preview as new paragraph (if it starts one) */}
      {!isTransitioning && activeSentence && nextSentencePreview && nextSentencePreview.is_paragraph_start && (
        <p className="text-lg leading-relaxed text-neutral-300 blur-[3px] select-none mt-4 px-4">
          {nextSentencePreview.sentence_text}
        </p>
      )}

      {/* Next chapter preview (at chapter boundary) */}
      {!isTransitioning && activeSentence && nextChapterPreview && !nextSentencePreview && (
        <div className="text-neutral-300 blur-[3px] select-none mt-8 text-center">
          Capítulo {toRoman(nextChapterPreview)}
        </div>
      )}

      {/* Check button - below paragraph, right-aligned */}
      {activeSentence && (
        <div className="flex justify-end mt-3 px-4">
          <button
            onClick={handleConfirmClick}
            disabled={isTransitioning}
            className="p-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100
                       text-emerald-500 transition-colors duration-150 shadow-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="I understand"
          >
            <Check size={16} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
