import { useNavigate } from 'react-router-dom'
import { RotateCcw, Sparkles } from 'lucide-react'

/**
 * QuickActions - Review Due / Learn New buttons
 * Uses inline styles as fallback to ensure visibility
 *
 * @param {Object} props
 * @param {number} props.dueCount - Number of cards due for review
 * @param {number} props.newAvailable - Number of new words available to learn
 * @param {boolean} props.loading - Loading state
 */
export default function QuickActions({
  dueCount = 0,
  newAvailable = 0,
  loading = false
}) {
  const navigate = useNavigate()

  const handleReview = () => {
    navigate('/flashcards?mode=review')
  }

  const handleLearnNew = () => {
    navigate('/flashcards?mode=learn')
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 px-4">
        <div className="h-28 bg-neutral-200 rounded-2xl animate-pulse" />
        <div className="h-28 bg-neutral-200 rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 px-4">
      {/* Review Due Button - using inline styles for guaranteed visibility */}
      <button
        onClick={handleReview}
        disabled={dueCount === 0}
        style={{
          backgroundColor: dueCount > 0 ? '#0ea5e9' : '#e7e5e4',
          color: dueCount > 0 ? 'white' : '#78716c',
          height: '7rem',
          borderRadius: '1rem',
          boxShadow: dueCount > 0 ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
        }}
        className="flex flex-col items-center justify-center p-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        <RotateCcw className="w-8 h-8 mb-2" strokeWidth={2.5} />
        <span className="text-lg font-bold">Review</span>
        <span style={{ opacity: 0.8 }} className="text-sm font-medium">
          {dueCount} due
        </span>
      </button>

      {/* Learn New Button - using inline styles for guaranteed visibility */}
      <button
        onClick={handleLearnNew}
        disabled={newAvailable === 0}
        style={{
          backgroundColor: newAvailable > 0 ? '#f59e0b' : '#e7e5e4',
          color: newAvailable > 0 ? 'white' : '#78716c',
          height: '7rem',
          borderRadius: '1rem',
          boxShadow: newAvailable > 0 ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
        }}
        className="flex flex-col items-center justify-center p-4 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2"
      >
        <Sparkles className="w-8 h-8 mb-2" strokeWidth={2.5} />
        <span className="text-lg font-bold">Learn New</span>
        <span style={{ opacity: 0.8 }} className="text-sm font-medium">
          {newAvailable} available
        </span>
      </button>
    </div>
  )
}
