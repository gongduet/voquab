import { Calendar } from 'lucide-react'

/**
 * ReviewForecast - Bar chart showing upcoming reviews by day
 *
 * Shows next 7 days of scheduled reviews
 */
export default function ReviewForecast({ forecastData = [], loading = false }) {
  // Generate default 7-day forecast if none provided
  const displayData = forecastData.length > 0 ? forecastData : generateDefaultForecast()

  // Get max count for scaling bars (minimum 10 to avoid tiny bars for small counts)
  const maxCount = Math.max(10, ...displayData.map(d => d.count || 0))

  // Calculate total for the week
  const weekTotal = displayData.reduce((sum, d) => sum + (d.count || 0), 0)

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-900">Upcoming Reviews</h3>
          <span className="text-xs text-neutral-400">Next 7 days</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 bg-neutral-200 rounded animate-pulse" style={{ height: `${Math.random() * 60 + 20}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-neutral-900">Upcoming Reviews</h3>
        <span className="text-xs text-neutral-400">Next 7 days</span>
      </div>

      {/* Bar chart container - fixed height, no flex */}
      <div className="relative" style={{ height: '140px' }}>
        <div className="absolute inset-0 flex items-end gap-1.5 pb-6">
          {displayData.slice(0, 7).map((day, i) => {
            const isToday = i === 0
            const count = day.count || 0

            // Calculate bar height in pixels
            // Available height for bars: 140px - 24px (pb-6 for labels) - 20px (for count) = ~96px
            const maxBarHeight = 96
            const barHeight = count > 0
              ? Math.max(8, Math.round((count / maxCount) * maxBarHeight))
              : 3

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                {/* Today label - positioned at top */}
                {isToday && (
                  <span className="text-[9px] font-bold text-primary-500 mb-auto">
                    TODAY
                  </span>
                )}

                {/* Count above bar */}
                <span
                  className={`text-xs font-semibold mb-1 ${
                    isToday
                      ? 'text-primary-600'
                      : count > 0
                        ? 'text-neutral-700'
                        : 'text-neutral-300'
                  }`}
                >
                  {count}
                </span>

                {/* Bar - explicit pixel height */}
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    isToday ? 'shadow-sm' : ''
                  }`}
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isToday
                      ? '#0ea5e9'  // primary-500
                      : count > 0
                        ? '#7dd3fc'  // primary-300
                        : '#e5e5e5', // neutral-200
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Day labels - absolute positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 flex gap-1.5">
          {displayData.slice(0, 7).map((day, i) => {
            const isToday = i === 0
            return (
              <span
                key={i}
                className={`flex-1 text-center text-[11px] ${
                  isToday
                    ? 'font-bold text-primary-600'
                    : 'font-medium text-neutral-400'
                }`}
              >
                {day.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Total summary - compact */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
        <span className="text-xs text-neutral-500 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          Total this week
        </span>
        <span className="text-lg font-bold text-neutral-900">
          {weekTotal}
        </span>
      </div>
    </div>
  )
}

/**
 * Generate default 7-day forecast using LOCAL time
 */
function generateDefaultForecast() {
  const days = []
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Use local time for consistency with ActivityHeatmap
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)

    // Format as YYYY-MM-DD in local time
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    days.push({
      date: dateStr,
      label: i === 0 ? 'Today' : dayLabels[date.getDay()],
      count: 0
    })
  }

  return days
}
