import { Star } from 'lucide-react'

/**
 * HeroStats - Circular progress ring showing mastery percentage
 *
 * @param {Object} props
 * @param {number} props.masteredCount - Number of mastered lemmas (stability >= 21 days)
 * @param {number} props.introducedCount - Number of introduced lemmas
 * @param {number} props.totalCount - Total lemmas available
 * @param {boolean} props.loading - Loading state
 */
export default function HeroStats({
  masteredCount = 0,
  introducedCount = 0,
  totalCount = 1,
  loading = false
}) {
  // Calculate percentage (mastered / total)
  const percentage = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0

  // SVG circle calculations
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  if (loading) {
    return (
      <div className="flex flex-col items-center py-8 mx-4">
        <div className="w-52 h-52 rounded-full bg-neutral-200 animate-pulse" />
        <div className="mt-4 h-6 w-32 bg-neutral-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6 mx-4">
      {/* Circular Progress Ring */}
      <div className="relative w-52 h-52">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          {/* Background circle - more visible */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            className="text-neutral-200"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary-500 transition-all duration-700 ease-out drop-shadow-sm"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Star className="w-7 h-7 text-secondary-500 mb-1" fill="currentColor" />
          <span className="text-5xl font-bold text-neutral-900">{percentage}%</span>
          <span className="text-sm font-medium text-neutral-600 mt-1">Mastered</span>
        </div>
      </div>

      {/* Stats summary below ring - higher contrast */}
      <div className="mt-6 flex gap-6 text-center">
        <div className="px-4">
          <div className="text-2xl font-bold text-primary-600">{masteredCount}</div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Mastered</div>
        </div>
        <div className="w-px bg-neutral-300" />
        <div className="px-4">
          <div className="text-2xl font-bold text-secondary-600">{introducedCount}</div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Learning</div>
        </div>
        <div className="w-px bg-neutral-300" />
        <div className="px-4">
          <div className="text-2xl font-bold text-neutral-700">{totalCount}</div>
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Total</div>
        </div>
      </div>
    </div>
  )
}
