/**
 * SentenceTable - Notion-style table for sentences
 *
 * Features:
 * - Clean borders and subtle hover
 * - Sortable columns (future)
 * - Keyboard navigation
 * - Selection state
 */

import SentenceRow from './SentenceRow'

export default function SentenceTable({
  sentences,
  selectedId,
  onSelect,
  onEdit,
  onToggleParagraph,
  isLoading
}) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-pulse text-gray-400">Loading sentences...</div>
        </div>
      </div>
    )
  }

  if (!sentences || sentences.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-8 text-center">
          <p className="text-gray-500">No sentences found for this chapter</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <style>{`
        .admin-table {
          border-collapse: collapse;
          width: 100%;
        }

        .admin-table th {
          text-align: left;
          padding: 12px 16px;
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .admin-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }

        .admin-table tr:last-child td {
          border-bottom: none;
        }
      `}</style>

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="w-16">#</th>
              <th className="w-12">P</th>
              <th>Spanish</th>
              <th>English</th>
              <th className="w-20 text-center">Frags</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {sentences.map((sentence) => (
              <SentenceRow
                key={sentence.sentence_id}
                sentence={sentence}
                isSelected={selectedId === sentence.sentence_id}
                onSelect={() => onSelect(sentence.sentence_id)}
                onEdit={onEdit}
                onToggleParagraph={onToggleParagraph}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
