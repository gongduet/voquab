import { useNavigate } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'

/**
 * QuickActions - Single prominent Review button
 * Other actions (Learn New, Reading, Songs) are accessible via Active Content Cards
 *
 * @param {Object} props
 * @param {number} props.dueCount - Number of cards due for review
 * @param {boolean} props.loading - Loading state
 */
export default function QuickActions({
  dueCount = 0,
  loading = false
}) {
  const navigate = useNavigate()

  const handleReview = () => {
    navigate('/flashcards?mode=review')
  }

  if (loading) {
    return (
      <div className="px-4">
        <div className="h-20 bg-neutral-200 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const hasCards = dueCount > 0

  return (
    <div className="px-4">
      {/* Single prominent Review button - full width */}
      <button
        onClick={handleReview}
        disabled={!hasCards}
        style={{
          backgroundColor: hasCards ? '#2563eb' : '#f5f5f5',
          color: hasCards ? 'white' : '#6b7280',
          height: '5rem',
          borderRadius: '0.75rem',
          border: hasCards ? 'none' : '1px solid #e5e5e5',
          boxShadow: hasCards ? '0 1px 3px 0 rgb(0 0 0 / 0.1)' : 'none',
          width: '100%'
        }}
        className="flex items-center justify-center gap-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        <RotateCcw className="w-8 h-8" strokeWidth={2.5} />
        <div className="flex flex-col items-start">
          <span className="text-xl font-bold">Review</span>
          <span style={{ opacity: 0.8 }} className="text-sm font-medium">
            {dueCount} {dueCount === 1 ? 'card' : 'cards'} due
          </span>
        </div>
      </button>
    </div>
  )
}
