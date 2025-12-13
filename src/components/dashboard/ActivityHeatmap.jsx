import { Flame, Calendar } from 'lucide-react'

/**
 * ActivityHeatmap - Calendar heatmap showing review activity
 *
 * Shows 5 weeks of activity with today in correct position
 * Colors scale based on user's daily target
 */
export default function ActivityHeatmap({
  activityData = [],
  currentStreak = 0,
  bestStreak = 0,
  dailyTarget = 50,
  loading = false
}) {
  // Generate last 35 days using LOCAL time
  const { days, todayIndex } = generateDaysGrid()

  // Create a map of date -> reviews count
  const activityMap = new Map()
  activityData.forEach(({ date, reviews }) => {
    activityMap.set(date, reviews)
  })

  // Calculate days practiced in last 28 days
  const last28Days = days.slice(-28).filter(day => !day.isFuture)
  const daysPracticed = last28Days.filter(day => (activityMap.get(day.date) || 0) > 0).length

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4">
        <h3 className="text-sm font-bold text-neutral-900 mb-3">Activity</h3>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded bg-neutral-200 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-900">Activity</h3>
        <span className="text-xs text-neutral-500">Last 5 weeks</span>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-[10px] font-medium text-neutral-400 text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const reviews = activityMap.get(day.date) || 0
          const { bgColor, textColor, borderStyle } = getColors(reviews, dailyTarget, day.isToday, day.isFuture)

          return (
            <div
              key={i}
              className={`
                aspect-square rounded-md flex items-center justify-center text-[9px] font-bold
                transition-all duration-150
                ${day.isToday ? 'ring-2 ring-primary-500 shadow-md shadow-primary-200' : ''}
                ${day.isFuture ? 'opacity-40' : ''}
              `}
              style={{
                backgroundColor: bgColor,
                border: borderStyle
              }}
              title={day.isFuture ? 'Future' : `${day.date}: ${reviews} reviews`}
            >
              {!day.isFuture && reviews > 0 && (
                <span style={{ color: textColor }}>
                  {reviews}
                </span>
              )}
              {day.isToday && reviews === 0 && (
                <span className="text-primary-400 text-[8px]">today</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-400">0</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f5f5f4' }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#bae6fd' }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#38bdf8' }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0ea5e9' }} />
          <div className="w-3 h-3 rounded-sm border border-amber-400" style={{ backgroundColor: '#0284c7' }} />
          <span className="text-[10px] text-neutral-400">{dailyTarget}+</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-3">
          {/* Current streak */}
          <span className="text-neutral-600 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-semibold text-neutral-900">{currentStreak}</span>
            <span className="text-neutral-400">{currentStreak === 1 ? 'day' : 'days'}</span>
          </span>

          {/* Best streak */}
          <span className="text-neutral-400">
            Best: <span className="font-semibold text-neutral-600">{bestStreak}</span>
          </span>
        </div>

        {/* Days practiced */}
        <span className="text-neutral-500 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-primary-400" />
          <span className="font-semibold text-neutral-700">{daysPracticed}</span>
          <span className="text-neutral-400">/ 28 days</span>
        </span>
      </div>
    </div>
  )
}

/**
 * Generate 35-day grid ending with current week
 * Uses LOCAL time so day-of-week matches user's perception
 */
function generateDaysGrid() {
  const days = []

  // Get today in LOCAL time
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayStr = formatLocalDate(today)
  const todayDayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday

  // End of grid should be Saturday of current week
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (6 - todayDayOfWeek))

  // Start 34 days before end of week (5 weeks total)
  const startDate = new Date(endOfWeek)
  startDate.setDate(endOfWeek.getDate() - 34)

  let todayIndex = -1

  for (let i = 0; i < 35; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    const dateStr = formatLocalDate(date)
    const isToday = dateStr === todayStr
    const isFuture = date > today

    if (isToday) todayIndex = i

    days.push({
      date: dateStr,
      isToday,
      isFuture
    })
  }

  return { days, todayIndex }
}

/**
 * Format date as YYYY-MM-DD in local time
 */
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get colors based on reviews vs daily target
 */
function getColors(count, target, isToday, isFuture) {
  // Future dates
  if (isFuture) {
    return {
      bgColor: '#fafaf9',  // neutral-50
      textColor: '#d6d3d1',
      borderStyle: '1px dashed #e7e5e4'
    }
  }

  // No activity
  if (count === 0) {
    return {
      bgColor: '#f5f5f4',  // neutral-100
      textColor: '#a8a29e',
      borderStyle: 'none'
    }
  }

  const percent = count / target

  // Exceeded target (100%+) - add gold accent
  if (percent >= 1) {
    return {
      bgColor: '#0284c7',  // primary-600
      textColor: '#ffffff',
      borderStyle: '2px solid #f59e0b'  // secondary-500 gold border
    }
  }

  // 75-99% of target
  if (percent >= 0.75) {
    return {
      bgColor: '#0ea5e9',  // primary-500
      textColor: '#ffffff',
      borderStyle: 'none'
    }
  }

  // 50-74% of target
  if (percent >= 0.5) {
    return {
      bgColor: '#38bdf8',  // primary-400
      textColor: '#0c4a6e',
      borderStyle: 'none'
    }
  }

  // 25-49% of target
  if (percent >= 0.25) {
    return {
      bgColor: '#7dd3fc',  // primary-300
      textColor: '#0369a1',
      borderStyle: 'none'
    }
  }

  // 1-24% of target
  return {
    bgColor: '#bae6fd',  // primary-200
    textColor: '#0369a1',
    borderStyle: 'none'
  }
}
