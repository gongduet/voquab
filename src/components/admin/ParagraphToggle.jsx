/**
 * ParagraphToggle - Toggle button for paragraph start indicator
 *
 * Renders a clickable circle that toggles paragraph start status.
 * Filled blue = paragraph start, empty = continuation
 */

export default function ParagraphToggle({ isActive, onToggle, disabled = false }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onToggle()
      }}
      disabled={disabled}
      className={`
        para-toggle w-5 h-5 rounded border-2 transition-all duration-150
        ${isActive
          ? 'bg-blue-500 border-blue-500'
          : 'bg-white border-gray-300 hover:border-blue-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-label={isActive ? "Remove paragraph start" : "Mark as paragraph start"}
    />
  )
}
