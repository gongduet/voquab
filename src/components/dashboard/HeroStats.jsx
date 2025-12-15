import { Star } from 'lucide-react'

/**
 * HeroStats - Circular progress ring showing mastery percentage
 * Now displays 4-level breakdown below the ring
 */
export default function HeroStats({
  masteredCount = 0,
  familiarCount = 0,
  learningCount = 0,
  introducedCount = 0,
  totalCount = 1,
  loading = false
}) {
  // SVG circle calculations
  const radius = 88
  const circumference = 2 * Math.PI * radius

  // Calculate percentages for each level
  const masteredPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0
  const familiarPct = totalCount > 0 ? Math.round((familiarCount / totalCount) * 100) : 0
  const learningPct = totalCount > 0 ? Math.round((learningCount / totalCount) * 100) : 0
  // notSeenPct is implicit (the gray background)

  // Calculate not seen count for stats display
  const notSeenCount = totalCount - introducedCount

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
      {/* Circular Progress Ring - 4 levels */}
      <div className="relative w-52 h-52">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
          {/* Background circle - Not Seen (gray) */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#d6d3d1"
            strokeWidth="14"
          />

          {/* Learning segment (light blue) - starts at 0 */}
          {learningPct + familiarPct + masteredPct > 0 && (
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - ((learningPct + familiarPct + masteredPct) / 100) * circumference}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Familiar segment (dark blue) - overlays learning */}
          {familiarPct + masteredPct > 0 && (
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#0369a1"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - ((familiarPct + masteredPct) / 100) * circumference}
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Mastered segment (near-black) - overlays familiar */}
          {masteredPct > 0 && (
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#1e3a5f"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (masteredPct / 100) * circumference}
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Star className="w-7 h-7 mb-1" style={{ color: '#f59e0b' }} fill="currentColor" />
          <span className="text-5xl font-bold text-neutral-900">{masteredPct}%</span>
          <span className="text-sm font-medium text-neutral-600 mt-1">Mastered</span>
        </div>
      </div>

      {/* 4-level stats below ring */}
      <div className="mt-6 flex gap-4 text-center">
        <div className="px-3">
          <div className="text-2xl font-bold" style={{ color: '#1e3a5f' }}>{masteredCount}</div>
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Mastered</div>
        </div>
        <div className="w-px bg-neutral-300" />
        <div className="px-3">
          <div className="text-2xl font-bold" style={{ color: '#0369a1' }}>{familiarCount}</div>
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Familiar</div>
        </div>
        <div className="w-px bg-neutral-300" />
        <div className="px-3">
          <div className="text-2xl font-bold" style={{ color: '#38bdf8' }}>{learningCount}</div>
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Learning</div>
        </div>
        <div className="w-px bg-neutral-300" />
        <div className="px-3">
          <div className="text-2xl font-bold" style={{ color: '#a3a3a3' }}>{notSeenCount}</div>
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">Not Seen</div>
        </div>
      </div>
    </div>
  )
}
