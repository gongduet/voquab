/**
 * SentenceRow - Table row for a single sentence
 *
 * Displays sentence info in a Notion-style table row:
 * - Order number
 * - Paragraph toggle
 * - Spanish text (truncated)
 * - English text (truncated)
 * - Fragment count
 * - Edit button
 */

import { Link } from 'react-router-dom'
import { Edit2, ExternalLink, CheckCircle, Circle } from 'lucide-react'
import ParagraphToggle from './ParagraphToggle'

export default function SentenceRow({
  sentence,
  isSelected,
  onSelect,
  onEdit,
  onToggleParagraph,
  onToggleReviewed
}) {
  const fragments = sentence.sentence_fragments || []
  const fragmentCount = fragments.length

  // Truncate text for display
  const truncate = (text, maxLength = 60) => {
    if (!text) return ''
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  return (
    <tr
      onClick={onSelect}
      className={`
        cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
      `}
    >
      {/* Order number */}
      <td className="px-4 py-3 text-sm text-gray-500 font-mono w-16">
        {sentence.sentence_order}
      </td>

      {/* Paragraph toggle */}
      <td className="px-4 py-3 w-12">
        <ParagraphToggle
          isActive={sentence.is_paragraph_start}
          onToggle={() => onToggleParagraph(sentence.sentence_id, !sentence.is_paragraph_start)}
        />
      </td>

      {/* Spanish text */}
      <td className="px-4 py-3">
        <p className="text-sm text-gray-800 leading-relaxed">
          {truncate(sentence.sentence_text)}
        </p>
      </td>

      {/* English translation */}
      <td className="px-4 py-3">
        <p className="text-sm text-gray-600 italic leading-relaxed">
          {truncate(sentence.sentence_translation) || (
            <span className="text-gray-400">No translation</span>
          )}
        </p>
      </td>

      {/* Fragment count */}
      <td className="px-4 py-3 text-center w-20">
        <span className={`
          inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
          ${fragmentCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
        `}>
          {fragmentCount}
        </span>
      </td>

      {/* Reviewed toggle */}
      <td className="px-4 py-3 text-center w-20">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleReviewed(sentence)
          }}
          className={`p-1 rounded transition-colors ${
            sentence.is_reviewed
              ? 'text-green-600 hover:bg-green-50'
              : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
          }`}
          title={sentence.is_reviewed ? 'Reviewed' : 'Mark as reviewed'}
        >
          {sentence.is_reviewed ? (
            <CheckCircle size={18} className="fill-green-100" />
          ) : (
            <Circle size={18} />
          )}
        </button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-28">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(sentence)
            }}
            className="px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            title="Quick edit"
          >
            <Edit2 size={12} />
          </button>
          <Link
            to={`/admin/sentences/${sentence.sentence_id}`}
            onClick={(e) => e.stopPropagation()}
            className="px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
            title="Deep dive"
          >
            <ExternalLink size={12} />
          </Link>
        </div>
      </td>
    </tr>
  )
}
