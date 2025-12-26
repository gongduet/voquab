import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  HeroStats,
  QuickActions,
  ActivityHeatmap,
  ReviewForecast,
  CategoryPills,
  DashboardHeader,
  ActiveContentCards
} from '../components/dashboard'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    // HeroStats - 4 levels
    masteredCount: 0,
    familiarCount: 0,
    learningCount: 0,
    introducedCount: 0,
    totalCount: 0,
    // QuickActions
    dueCount: 0,
    // ActivityHeatmap
    activityData: [],
    currentStreak: 0,
    bestStreak: 0,
    dailyTarget: 50,
    // ReviewForecast
    forecastData: [],
    // CategoryPills
    categories: {},
    // Header
    streak: 0,
    username: ''
  })

  useEffect(() => {
    if (user?.id) {
      loadDashboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadDashboardData() {
    setLoading(true)

    try {
      // Parallel fetch all dashboard data
      const [
        heroStats,
        quickActionStats,
        activityData,
        forecastData,
        categoryData,
        profileData,
        userSettings
      ] = await Promise.all([
        fetchHeroStats(user.id),
        fetchQuickActionStats(user.id),
        fetchActivityData(user.id),
        fetchForecastData(user.id),
        fetchCategoryData(user.id),
        fetchProfileData(user.id),
        fetchUserSettings(user.id)
      ])

      // Use currentStreak from activityData as single source of truth
      // Best streak should be the max of current streak and stored best
      const currentStreak = activityData.currentStreak
      const bestStreak = Math.max(currentStreak, activityData.bestStreak || 0)

      setDashboardData({
        ...heroStats,
        dueCount: quickActionStats.dueCount,
        activityData: activityData.data,
        currentStreak,
        bestStreak,
        dailyTarget: userSettings.dailyTarget,
        forecastData,
        categories: categoryData,
        streak: currentStreak,  // Use same value for header
        username: profileData.username
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <DashboardHeader
        streak={dashboardData.streak}
        username={dashboardData.username}
        loading={loading}
      />

      {/* Main content - max width container for desktop */}
      <main className="max-w-4xl mx-auto pb-8">
        {/* Hero Stats */}
        <div className="mb-6">
          <HeroStats
            masteredCount={dashboardData.masteredCount}
            familiarCount={dashboardData.familiarCount}
            learningCount={dashboardData.learningCount}
            introducedCount={dashboardData.introducedCount}
            totalCount={dashboardData.totalCount}
            loading={loading}
          />
        </div>

        {/* Quick Actions - Review button only */}
        <section className="mb-8">
          <QuickActions
            dueCount={dashboardData.dueCount}
            loading={loading}
          />
        </section>

        {/* Active Content Cards */}
        <section className="mb-8">
          <ActiveContentCards loading={loading} />
        </section>

        {/* Category Pills - Words by Type */}
        <section className="mb-6">
          <CategoryPills
            categories={dashboardData.categories}
            loading={loading}
          />
        </section>

        {/* Stats Grid - Activity & Forecast side by side on tablet+ */}
        <section className="px-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActivityHeatmap
            activityData={dashboardData.activityData}
            currentStreak={dashboardData.currentStreak}
            bestStreak={dashboardData.bestStreak}
            dailyTarget={dashboardData.dailyTarget}
            loading={loading}
          />
          <ReviewForecast
            forecastData={dashboardData.forecastData}
            loading={loading}
          />
        </section>
      </main>
    </div>
  )
}

/**
 * Fetch hero stats: 4-level breakdown (mastered, familiar, learning, not seen)
 * Includes both lemmas and phrases
 */
async function fetchHeroStats(userId) {
  // Total lemmas (excluding stop words)
  const { count: totalLemmas } = await supabase
    .from('lemmas')
    .select('*', { count: 'exact', head: true })
    .eq('is_stop_word', false)

  // Total phrases
  const { count: totalPhrases } = await supabase
    .from('phrases')
    .select('*', { count: 'exact', head: true })

  const totalCount = (totalLemmas || 0) + (totalPhrases || 0)

  // Get all user lemma progress with FSRS fields
  const { data: lemmaProgress } = await supabase
    .from('user_lemma_progress')
    .select('stability, fsrs_state, reps')
    .eq('user_id', userId)

  // Get all user phrase progress with FSRS fields
  const { data: phraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('stability, fsrs_state, reps')
    .eq('user_id', userId)

  // Combine and categorize
  const allProgress = [...(lemmaProgress || []), ...(phraseProgress || [])]

  const levels = categorizeByLevel(allProgress)

  // "Introduced" = anything with reps >= 1 (for backward compatibility)
  const introducedCount = allProgress.filter(p => (p.reps || 0) >= 1).length

  return {
    masteredCount: levels.mastered,
    familiarCount: levels.familiar,
    learningCount: levels.learning,
    introducedCount,
    totalCount,
    notSeenCount: totalCount - introducedCount
  }
}

/**
 * Categorize progress records into 4 levels based on FSRS state and stability
 */
function categorizeByLevel(progressRecords) {
  let mastered = 0
  let familiar = 0
  let learning = 0

  for (const record of progressRecords) {
    const stability = record.stability || 0
    const fsrsState = record.fsrs_state ?? 0
    const reps = record.reps || 0

    // Must have at least 1 rep to be in any category
    if (reps < 1) continue

    if (stability >= 21 && fsrsState === 2) {
      mastered++
    } else if (stability >= 7 && stability < 21 && fsrsState === 2) {
      familiar++
    } else {
      // stability < 7 OR fsrs_state IN (1, 3) OR fsrs_state = 0
      learning++
    }
  }

  return { mastered, familiar, learning }
}

/**
 * Fetch quick action stats: due count only
 * (newAvailable is now on Book/Song dashboards, not main dashboard)
 */
async function fetchQuickActionStats(userId) {
  const now = new Date().toISOString()

  // Lemmas due now
  const { count: lemmasDue } = await supabase
    .from('user_lemma_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', now)

  // Phrases due now
  const { count: phrasesDue } = await supabase
    .from('user_phrase_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', now)

  // Slang due now
  const { count: slangDue } = await supabase
    .from('user_slang_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', now)

  const dueCount = (lemmasDue || 0) + (phrasesDue || 0) + (slangDue || 0)

  return { dueCount }
}

/**
 * Fetch activity data for heatmap - uses user_review_history for accurate counts
 * Counts UNIQUE cards reviewed per day (not total reviews)
 */
async function fetchActivityData(userId) {
  // Get reviews from last 35 days
  const thirtyFiveDaysAgo = new Date()
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)

  const { data: reviews, error } = await supabase
    .from('user_review_history')
    .select('reviewed_at, lemma_id, phrase_id')
    .eq('user_id', userId)
    .gte('reviewed_at', thirtyFiveDaysAgo.toISOString())
    .order('reviewed_at', { ascending: false })

  if (error) {
    console.error('❌ [fetchActivityData] query failed:', error)
    return { data: [], currentStreak: 0, bestStreak: 0 }
  }

  // Group by date and count UNIQUE lemmas + phrases per day
  const activityByDate = {}

  for (const review of reviews || []) {
    // Convert to local date string
    const reviewDate = new Date(review.reviewed_at)
    const dateStr = formatLocalDate(reviewDate)

    if (!activityByDate[dateStr]) {
      activityByDate[dateStr] = {
        lemmas: new Set(),
        phrases: new Set()
      }
    }

    // Add to appropriate set (Sets automatically dedupe)
    if (review.lemma_id) {
      activityByDate[dateStr].lemmas.add(review.lemma_id)
    }
    if (review.phrase_id) {
      activityByDate[dateStr].phrases.add(review.phrase_id)
    }
  }

  // Convert to array format for heatmap
  const activityData = Object.entries(activityByDate).map(([date, sets]) => ({
    date,
    reviews: sets.lemmas.size + sets.phrases.size
  }))

  // Build activity map for streak calculation
  const activityMap = new Map()
  for (const [date, sets] of Object.entries(activityByDate)) {
    activityMap.set(date, sets.lemmas.size + sets.phrases.size)
  }

  console.log('[fetchActivityData] Unique cards per day:', activityData.slice(0, 5))

  // Calculate streak from activity data
  let calculatedStreak = 0
  const today = new Date()

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const checkDateStr = formatLocalDate(checkDate)

    if (activityMap.has(checkDateStr) && activityMap.get(checkDateStr) > 0) {
      calculatedStreak++
    } else {
      break
    }
  }

  // Get best streak from database
  const { data: bestData } = await supabase
    .from('user_daily_stats')
    .select('longest_streak')
    .eq('user_id', userId)
    .order('longest_streak', { ascending: false })
    .limit(1)
    .single()

  return {
    data: activityData,
    currentStreak: calculatedStreak,
    bestStreak: bestData?.longest_streak || calculatedStreak
  }
}

/**
 * Calculate current and best streaks from activity data
 */
function calculateStreaks(activityByDate) {
  // Get sorted dates that have activity
  const activeDates = Object.keys(activityByDate)
    .filter(date => {
      const sets = activityByDate[date]
      return sets.lemmas.size + sets.phrases.size > 0
    })
    .sort((a, b) => new Date(b) - new Date(a)) // Most recent first

  if (activeDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  // Check if today or yesterday has activity (for current streak)
  const today = formatLocalDate(new Date())
  const yesterday = formatLocalDate(new Date(Date.now() - 86400000))

  let currentStreak = 0
  let bestStreak = 0
  let tempStreak = 0

  // Calculate current streak (must include today or yesterday)
  if (activeDates.includes(today) || activeDates.includes(yesterday)) {
    const startDate = activeDates.includes(today) ? today : yesterday
    let checkDate = new Date(startDate)

    while (true) {
      const dateStr = formatLocalDate(checkDate)
      if (activityByDate[dateStr] &&
          (activityByDate[dateStr].lemmas.size + activityByDate[dateStr].phrases.size) > 0) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Calculate best streak
  for (let i = 0; i < activeDates.length; i++) {
    const currentDate = new Date(activeDates[i])

    if (i === 0) {
      tempStreak = 1
    } else {
      const prevDate = new Date(activeDates[i - 1])
      const diffDays = Math.round((prevDate - currentDate) / 86400000)

      if (diffDays === 1) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }

    bestStreak = Math.max(bestStreak, tempStreak)
  }

  // Current streak is also a candidate for best streak
  bestStreak = Math.max(bestStreak, currentStreak)

  return { currentStreak, bestStreak }
}

/**
 * Fetch forecast data for next 7 days (includes lemmas + phrases)
 * Uses LOCAL time for day boundaries to match user perception
 */
async function fetchForecastData(userId) {
  const days = []
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Use local time for day boundaries
  const now = new Date()
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(todayLocal)
    dayStart.setDate(todayLocal.getDate() + i)

    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayStart.getDate() + 1)

    // Format for display
    const dateStr = formatLocalDate(dayStart)

    // Query uses ISO strings
    const startISO = dayStart.toISOString()
    const endISO = dayEnd.toISOString()

    let lemmaCount, phraseCount

    if (i === 0) {
      // TODAY: Include all overdue cards (no lower bound)
      const { count: lc, error: lemmaError } = await supabase
        .from('user_lemma_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due_date', endISO)  // Everything due up to end of today

      if (lemmaError) {
        console.error('❌ [fetchForecastData] lemma due query failed:', lemmaError)
      }
      lemmaCount = lc || 0

      const { count: pc, error: phraseError } = await supabase
        .from('user_phrase_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due_date', endISO)  // Everything due up to end of today

      if (phraseError) {
        console.error('❌ [fetchForecastData] phrase due query failed:', phraseError)
      }
      phraseCount = pc || 0

    } else {
      // FUTURE DAYS: Only cards due within that specific day
      const { count: lc, error: lemmaError } = await supabase
        .from('user_lemma_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('due_date', startISO)
        .lt('due_date', endISO)

      if (lemmaError && i === 1) {
        console.error('❌ [fetchForecastData] lemma due query failed:', lemmaError)
      }
      lemmaCount = lc || 0

      const { count: pc, error: phraseError } = await supabase
        .from('user_phrase_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('due_date', startISO)
        .lt('due_date', endISO)

      if (phraseError && i === 1) {
        console.error('❌ [fetchForecastData] phrase due query failed:', phraseError)
      }
      phraseCount = pc || 0
    }

    days.push({
      date: dateStr,
      label: i === 0 ? 'Today' : dayLabels[dayStart.getDay()],
      count: lemmaCount + phraseCount
    })
  }

  return days
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
 * Fetch category breakdown by part of speech (including phrases)
 * Normalizes POS values to standard categories
 */
async function fetchCategoryData(userId) {
  // Fetch lemma categories - only introduced lemmas (records exist = introduced)
  const { data: lemmaData, error: lemmaError } = await supabase
    .from('user_lemma_progress')
    .select(`
      lemma_id,
      lemmas!inner (
        part_of_speech
      )
    `)
    .eq('user_id', userId)

  if (lemmaError) {
    console.error('❌ [fetchCategoryData] lemma categories query failed:', lemmaError)
  }

  // Normalize POS values
  const posMap = {
    'noun': 'noun',
    'NOUN': 'noun',
    'Noun': 'noun',
    'verb': 'verb',
    'VERB': 'verb',
    'Verb': 'verb',
    'adjective': 'adjective',
    'ADJECTIVE': 'adjective',
    'Adjective': 'adjective',
    'adj': 'adjective',
    'ADJ': 'adjective',
    'adverb': 'adverb',
    'ADVERB': 'adverb',
    'Adverb': 'adverb',
    'adv': 'adverb',
    'ADV': 'adverb',
    'preposition': 'other',
    'conjunction': 'other',
    'pronoun': 'other',
    'interjection': 'other',
  }

  const categories = {}

  for (const item of lemmaData || []) {
    const rawPos = item.lemmas?.part_of_speech || 'other'
    const normalizedPos = posMap[rawPos] || posMap[rawPos.toLowerCase()] || 'other'
    categories[normalizedPos] = (categories[normalizedPos] || 0) + 1
  }

  // Fetch introduced phrase count (records in user_phrase_progress = introduced)
  const { count: phraseCount, error: phraseError } = await supabase
    .from('user_phrase_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (phraseError) {
    console.error('❌ [fetchCategoryData] phrase count query failed:', phraseError)
  }

  if (phraseCount && phraseCount > 0) {
    categories['phrase'] = phraseCount
  }

  return categories
}

/**
 * Fetch current streak by calculating consecutive days
 * Uses formatLocalDate for consistency with fetchActivityData
 */
async function fetchStreakData(userId) {
  const { data: recentStats, error } = await supabase
    .from('user_daily_stats')
    .select('review_date, words_reviewed')
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(60)

  if (error || !recentStats || recentStats.length === 0) {
    return 0
  }

  // Calculate consecutive days streak from today using LOCAL time
  const today = new Date()
  const todayStr = formatLocalDate(today)

  let streak = 0

  for (let i = 0; i < recentStats.length; i++) {
    const stat = recentStats[i]

    // Calculate expected date (today - i days) using LOCAL time
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    const expectedDateStr = formatLocalDate(expectedDate)

    // Check if this stat matches the expected consecutive day
    if (stat.review_date === expectedDateStr && (stat.words_reviewed || 0) > 0) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Fetch user profile
 */
async function fetchProfileData(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .single()

  return {
    username: data?.display_name || ''
  }
}

/**
 * Fetch user settings (daily goal)
 */
async function fetchUserSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('daily_goal_words')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('❌ [fetchUserSettings] failed:', error)
    return { dailyTarget: 50 }  // Default fallback
  }

  return {
    dailyTarget: data?.daily_goal_words || 50
  }
}
