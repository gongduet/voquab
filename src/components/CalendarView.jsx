import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// DayCell Component
function DayCell({ date, count, isToday, userGoal }) {
  // Calculate percentage of goal
  const percentage = userGoal > 0 ? (count / userGoal) * 100 : 0

  // Get color based on percentage
  const getColor = (pct) => {
    if (pct === 0) return 'bg-gray-200 text-gray-400'
    if (pct < 25) return 'bg-red-100 text-red-700'
    if (pct < 50) return 'bg-red-500 text-white'
    if (pct < 75) return 'bg-yellow-400 text-gray-800'
    if (pct < 100) return 'bg-green-200 text-green-800'
    if (pct < 150) return 'bg-green-500 text-white'
    if (pct < 200) return 'bg-blue-500 text-white'
    return 'bg-gray-900 text-white' // Black belt!
  }

  const dayOfMonth = new Date(date).getDate()

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Bubble with count */}
      <div
        className={`
          relative w-10 h-10 rounded-full flex items-center justify-center
          font-semibold text-xs
          ${getColor(percentage)}
          ${isToday ? 'animate-pulse ring-4 ring-amber-400 ring-offset-2' : ''}
          hover:scale-110 transition-transform cursor-pointer
        `}
        title={`${date}: ${count} words (${Math.round(percentage)}% of goal)`}
      >
        {count}
      </div>

      {/* Day of month below bubble */}
      <div className="text-[10px] text-gray-500 font-serif">
        {dayOfMonth}
      </div>
    </div>
  )
}

// CalendarView Component
export default function CalendarView({ userId }) {
  const [calendarData, setCalendarData] = useState([])
  const [userGoal, setUserGoal] = useState(100)
  const [streakStats, setStreakStats] = useState({
    current: 0,
    longest: 0,
    longestDates: '',
    totalActiveDays: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchUserSettings()
      fetchCalendarData()
    }
  }, [userId])

  // Fetch user settings (daily goal)
  async function fetchUserSettings() {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('daily_goal_words')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching user settings:', error)
      }

      if (data) {
        setUserGoal(data.daily_goal_words || 100)
      }
    } catch (err) {
      console.error('Error in fetchUserSettings:', err)
    }
  }

  // Fetch last 35 days of activity
  async function fetchCalendarData() {
    try {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 34) // 35 days total including today

      console.log('📅 Fetching calendar data from', startDate.toISOString(), 'to', today.toISOString())

      // Query user_review_history, group by date
      const { data, error } = await supabase
        .from('user_review_history')
        .select('reviewed_at')
        .eq('user_id', userId)
        .gte('reviewed_at', startDate.toISOString())

      if (error) {
        console.error('Error fetching calendar data:', error)
        throw error
      }

      console.log('📅 Fetched', data?.length || 0, 'review records')

      // Group by date and count reviews
      const countsByDate = {}
      data?.forEach(review => {
        // Convert UTC to local date
        const dateStr = new Date(review.reviewed_at).toLocaleDateString('en-CA')
        countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1
      })

      console.log('📅 Counts by date:', countsByDate)

      // Get today's date string in local timezone for comparison
      const todayStr = new Date().toLocaleDateString('en-CA')
      console.log('📅 Today (local):', todayStr)

      // Generate 35 days array
      const calendar = []
      for (let i = 34; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toLocaleDateString('en-CA')

        calendar.push({
          date: dateStr,
          count: countsByDate[dateStr] || 0,
          isToday: dateStr === todayStr  // Compare actual date strings
        })
      }

      console.log('📅 Calendar array:', calendar)
      console.log('📅 Today marked as:', calendar.find(d => d.isToday)?.date)

      setCalendarData(calendar)
      calculateStreaks(calendar)
      setLoading(false)
    } catch (err) {
      console.error('Error in fetchCalendarData:', err)
      setLoading(false)
    }
  }

  // Calculate streak statistics
  function calculateStreaks(data) {
    let currentStreak = 0
    let longestStreak = 0
    let longestStart = null
    let longestEnd = null
    let tempStart = null
    let tempStreak = 0
    let totalActive = 0

    // Count from most recent backwards for current streak
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].count > 0) {
        if (i === data.length - 1 || (i < data.length - 1 && data[i + 1].count > 0)) {
          currentStreak++
        } else {
          break // Streak broken
        }
      } else if (i === data.length - 1) {
        break // No activity today, streak is 0
      }
    }

    // Find longest streak
    for (let i = 0; i < data.length; i++) {
      if (data[i].count > 0) {
        totalActive++
        if (tempStreak === 0) tempStart = data[i].date
        tempStreak++

        if (tempStreak > longestStreak) {
          longestStreak = tempStreak
          longestStart = tempStart
          longestEnd = data[i].date
        }
      } else {
        tempStreak = 0
      }
    }

    const formatDateRange = (start, end) => {
      if (!start || !end) return ''
      const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${s} - ${e}`
    }

    console.log('🔥 Streak stats:', {
      current: currentStreak,
      longest: longestStreak,
      longestDates: formatDateRange(longestStart, longestEnd),
      totalActiveDays: totalActive
    })

    setStreakStats({
      current: currentStreak,
      longest: longestStreak,
      longestDates: formatDateRange(longestStart, longestEnd),
      totalActiveDays: totalActive
    })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-amber-200 mb-8">
        <div className="text-center text-gray-500 font-serif">
          Loading calendar...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-amber-200">
      <h2 className="text-xl font-serif font-bold text-amber-800 mb-2 flex items-center gap-2">
        <span>📅</span>
        <span>Your Learning Calendar</span>
      </h2>
      <p className="text-xs text-gray-600 font-serif mb-4">
        Last 35 days • Daily goal: {userGoal} words
      </p>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-gray-600 font-serif">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - 5 weeks */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {calendarData.map(day => (
          <DayCell
            key={day.date}
            date={day.date}
            count={day.count}
            isToday={day.isToday}
            userGoal={userGoal}
          />
        ))}
      </div>

      {/* Streak stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg text-center border-2 border-orange-200">
          <div className="text-3xl mb-1">🔥</div>
          <div className="text-2xl font-bold text-orange-600 font-serif">
            {streakStats.current}
          </div>
          <div className="text-sm text-gray-600 font-serif">Current Streak</div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg text-center border-2 border-yellow-200">
          <div className="text-3xl mb-1">🏆</div>
          <div className="text-2xl font-bold text-yellow-600 font-serif">
            {streakStats.longest}
          </div>
          <div className="text-sm text-gray-600 font-serif">Longest Streak</div>
          {streakStats.longestDates && (
            <div className="text-xs text-gray-500 mt-1 font-serif">
              {streakStats.longestDates}
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg text-center border-2 border-blue-200">
          <div className="text-3xl mb-1">📊</div>
          <div className="text-2xl font-bold text-blue-600 font-serif">
            {streakStats.totalActiveDays}
          </div>
          <div className="text-sm text-gray-600 font-serif">Total Active Days</div>
        </div>
      </div>
    </div>
  )
}
