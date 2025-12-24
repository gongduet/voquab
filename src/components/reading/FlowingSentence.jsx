/**
 * FlowingSentence - An inline sentence within a flowing paragraph
 *
 * Features:
 * - Inline span that flows with other sentences
 * - Tappable to show translation tooltip
 * - Visual highlight for marked sentences
 * - Active state when tooltip is open
 */

export default function FlowingSentence({
  sentence,
  isActive,
  onClick
}) {
  const isHighlighted = sentence.is_highlighted

  return (
    <>
      <span
        onClick={onClick}
        className={`
          cursor-pointer
          transition-colors duration-150
          hover:bg-neutral-100
          rounded
          px-0.5
          -mx-0.5
          ${isHighlighted ? 'bg-amber-50 border-b-2 border-amber-300' : ''}
          ${isActive ? 'bg-blue-50' : ''}
        `}
      >
        {sentence.sentence_text}
      </span>
      {/* Space between sentences */}
      {' '}
    </>
  )
}
