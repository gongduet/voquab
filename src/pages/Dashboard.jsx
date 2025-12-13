import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  HeroStats,
  QuickActions,
  ChapterCarousel,
  ActivityHeatmap,
  ReviewForecast,
  CategoryPills,
  DashboardHeader
} from '../components/dashboard'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    // HeroStats
    masteredCount: 0,
    introducedCount: 0,
    totalLemmas: 0,
    // QuickActions
    dueCount: 0,
    newAvailable: 0,
    // ChapterCarousel
    chapters: [],
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
        chaptersData,
        activityData,
        forecastData,
        categoryData,
        streakData,
        profileData,
        userSettings
      ] = await Promise.all([
        fetchHeroStats(user.id),
        fetchQuickActionStats(user.id),
        fetchChaptersProgress(user.id),
        fetchActivityData(user.id),
        fetchForecastData(user.id),
        fetchCategoryData(user.id),
        fetchStreakData(user.id),
        fetchProfileData(user.id),
        fetchUserSettings(user.id)
      ])

      setDashboardData({
        ...heroStats,
        ...quickActionStats,
        chapters: chaptersData,
        activityData: activityData.data,
        currentStreak: activityData.currentStreak,
        bestStreak: activityData.bestStreak,
        dailyTarget: userSettings.dailyTarget,
        forecastData,
        categories: categoryData,
        streak: streakData,
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
            introducedCount={dashboardData.introducedCount}
            totalCount={dashboardData.totalLemmas}
            loading={loading}
          />
        </div>

        {/* Quick Actions */}
        <section className="mb-8">
          <QuickActions
            dueCount={dashboardData.dueCount}
            newAvailable={dashboardData.newAvailable}
            loading={loading}
          />
        </section>

        {/* Category Pills */}
        <section className="mb-6">
          <CategoryPills
            categories={dashboardData.categories}
            loading={loading}
          />
        </section>

        {/* Chapters */}
        <section className="mb-8">
          <ChapterCarousel
            chapters={dashboardData.chapters}
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
 * Fetch hero stats: mastered, introduced, total (includes lemmas + phrases)
 * "Introduced" = reps >= 1 (reviewed at least once)
 */
async function fetchHeroStats(userId) {
  // Total lemmas (excluding stop words)
  const { count: totalLemmas, error: lemmasError } = await supabase
    .from('lemmas')
    .select('*', { count: 'exact', head: true })
    .eq('is_stop_word', false)

  if (lemmasError) {
    console.error('❌ [fetchHeroStats] lemmas count failed:', lemmasError)
  }

  // Total phrases
  const { count: totalPhrases, error: phrasesError } = await supabase
    .from('phrases')
    .select('*', { count: 'exact', head: true })

  if (phrasesError) {
    console.error('❌ [fetchHeroStats] phrases count failed:', phrasesError)
  }

  // User's introduced lemmas (reps >= 1 means reviewed at least once)
  const { data: lemmaProgress, error: lemmaProgressError } = await supabase
    .from('user_lemma_progress')
    .select('stability, reps')
    .eq('user_id', userId)
    .gte('reps', 1)

  if (lemmaProgressError) {
    console.error('❌ [fetchHeroStats] user_lemma_progress failed:', lemmaProgressError)
  }

  // User's introduced phrases (reps >= 1 means reviewed at least once)
  const { data: phraseProgress, error: phraseProgressError } = await supabase
    .from('user_phrase_progress')
    .select('stability, reps')
    .eq('user_id', userId)
    .gte('reps', 1)

  if (phraseProgressError) {
    console.error('❌ [fetchHeroStats] user_phrase_progress failed:', phraseProgressError)
  }

  const lemmaIntroduced = lemmaProgress?.length || 0
  const phraseIntroduced = phraseProgress?.length || 0
  const introducedCount = lemmaIntroduced + phraseIntroduced

  // Mastered = stability >= 21 days (3 weeks)
  const lemmaMastered = lemmaProgress?.filter(p => (p.stability || 0) >= 21).length || 0
  const phraseMastered = phraseProgress?.filter(p => (p.stability || 0) >= 21).length || 0
  const masteredCount = lemmaMastered + phraseMastered

  console.log('[fetchHeroStats] Results:', {
    totalLemmas,
    totalPhrases,
    lemmaIntroduced,
    phraseIntroduced,
    lemmaMastered,
    phraseMastered
  })

  return {
    masteredCount,
    introducedCount,
    totalLemmas: (totalLemmas || 0) + (totalPhrases || 0)
  }
}

/**
 * Fetch quick action stats: due count, new available (includes lemmas + phrases)
 */
async function fetchQuickActionStats(userId) {
  const now = new Date().toISOString()

  // Lemmas due today
  const { count: lemmasDue, error: lemmasDueError } = await supabase
    .from('user_lemma_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', now)

  console.log('🔍 [QuickActionStats] Lemmas due:', { lemmasDue, error: lemmasDueError })

  // Phrases due today
  const { count: phrasesDue, error: phrasesDueError } = await supabase
    .from('user_phrase_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due_date', now)

  console.log('🔍 [QuickActionStats] Phrases due:', { phrasesDue, error: phrasesDueError })

  const dueCount = (lemmasDue || 0) + (phrasesDue || 0)

  console.log('🔍 [QuickActionStats] Total due:', dueCount)

  // Get user's introduced lemma IDs (reps >= 1 means reviewed at least once)
  const { data: existingProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const existingIds = new Set((existingProgress || []).map(p => p.lemma_id))

  // Get unlocked chapters
  const unlockedChapterNumbers = await getUnlockedChapterNumbers(userId)

  // Get chapter IDs for unlocked chapters
  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('chapter_id')
    .in('chapter_number', unlockedChapterNumbers)

  const chapterIds = (chaptersData || []).map(c => c.chapter_id)

  // Get sentences from unlocked chapters
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id')
    .in('chapter_id', chapterIds)

  const sentenceIds = (sentences || []).map(s => s.sentence_id)

  // Get lemmas from those sentences
  const { data: wordsData } = await supabase
    .from('words')
    .select('lemma_id')
    .in('sentence_id', sentenceIds)

  const chapterLemmaIds = [...new Set((wordsData || []).map(w => w.lemma_id))]

  // Get non-stop-word lemmas
  const { data: nonStopLemmas } = await supabase
    .from('lemmas')
    .select('lemma_id')
    .in('lemma_id', chapterLemmaIds)
    .eq('is_stop_word', false)

  const nonStopIds = new Set((nonStopLemmas || []).map(l => l.lemma_id))

  // New available = lemmas in unlocked chapters that aren't introduced yet
  const newLemmasAvailable = chapterLemmaIds.filter(id => !existingIds.has(id) && nonStopIds.has(id)).length

  // Count new phrases available via phrase_occurrences -> sentences -> chapters path
  // Get introduced phrases (reps >= 1 means reviewed at least once)
  const { data: existingPhrases } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const existingPhraseIds = new Set((existingPhrases || []).map(p => p.phrase_id))

  // Get phrase occurrences from sentences in unlocked chapters
  const { data: phraseOccurrences } = await supabase
    .from('phrase_occurrences')
    .select('phrase_id')
    .in('sentence_id', sentenceIds)

  // Get unique phrase IDs that haven't been introduced
  const chapterPhraseIds = [...new Set((phraseOccurrences || []).map(o => o.phrase_id))]
  const newPhrasesAvailable = chapterPhraseIds.filter(id => !existingPhraseIds.has(id)).length

  // Debug logging
  console.log('[Dashboard] New available debug:', {
    unlockedChapters: unlockedChapterNumbers,
    totalChapterLemmas: chapterLemmaIds.length,
    existingLemmas: existingIds.size,
    nonStopLemmas: nonStopIds.size,
    newLemmasAvailable,
    totalChapterPhrases: chapterPhraseIds.length,
    existingPhrases: existingPhraseIds.size,
    newPhrasesAvailable,
    total: newLemmasAvailable + newPhrasesAvailable
  })

  return {
    dueCount,
    newAvailable: newLemmasAvailable + newPhrasesAvailable
  }
}

/**
 * Fetch chapters with progress for carousel
 * Always returns at least Chapter 1 even if no data
 */
async function fetchChaptersProgress(userId) {
  // Get all chapters
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number, title')
    .order('chapter_number', { ascending: true })

  if (chaptersError) {
    console.error('❌ [fetchChaptersProgress] chapters query failed:', chaptersError)
  }

  console.log('[fetchChaptersProgress] Raw chapters data:', {
    count: chapters?.length,
    chapters: chapters?.slice(0, 3) // Log first 3 chapters
  })

  // Ensure we always have at least a placeholder for Chapter 1
  if (!chapters || chapters.length === 0) {
    console.warn('⚠️ [fetchChaptersProgress] No chapters found, returning placeholder')
    return [{
      chapter_number: 1,
      title: 'Chapter 1',
      introduced: 0,
      total_lemmas: 0,
      isUnlocked: true,
      isNextToUnlock: false
    }]
  }

  // Get user's introduced lemmas (reps >= 1 means reviewed at least once)
  const { data: userProgress, error: progressError } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  if (progressError) {
    console.error('❌ [fetchChaptersProgress] user_lemma_progress query failed:', progressError)
  }

  const introducedLemmaIds = new Set((userProgress || []).map(p => p.lemma_id))

  // Get user's introduced phrases (reps >= 1 means reviewed at least once)
  const { data: userPhraseProgress, error: phraseProgressError } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  if (phraseProgressError) {
    console.error('❌ [fetchChaptersProgress] user_phrase_progress query failed:', phraseProgressError)
  }

  const introducedPhraseIds = new Set((userPhraseProgress || []).map(p => p.phrase_id))

  // Calculate progress for each chapter
  const chaptersWithProgress = []
  let previousChapterComplete = true

  for (const chapter of chapters) {
    // Get sentences for this chapter
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)

    if (sentencesError) {
      console.error(`❌ [fetchChaptersProgress] sentences query failed for chapter ${chapter.chapter_number}:`, sentencesError)
    }

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    // Get lemmas for this chapter (skip if no sentences)
    let chapterLemmaIds = []
    let chapterPhraseIds = []

    if (sentenceIds.length > 0) {
      // Get words with lemma stop_word status - filter out stop words
      const { data: words, error: wordsError } = await supabase
        .from('words')
        .select('lemma_id, lemmas!inner(is_stop_word)')
        .in('sentence_id', sentenceIds)
        .eq('lemmas.is_stop_word', false)

      if (wordsError) {
        console.error(`❌ [fetchChaptersProgress] words query failed for chapter ${chapter.chapter_number}:`, wordsError)
      }

      chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]

      // Get phrases for this chapter
      const { data: phraseOccurrences, error: phrasesError } = await supabase
        .from('phrase_occurrences')
        .select('phrase_id')
        .in('sentence_id', sentenceIds)

      if (phrasesError) {
        console.error(`❌ [fetchChaptersProgress] phrases query failed for chapter ${chapter.chapter_number}:`, phrasesError)
      }

      chapterPhraseIds = [...new Set((phraseOccurrences || []).map(po => po.phrase_id))]
    }

    // Count introduced lemmas
    const introducedLemmaCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length

    // Count introduced phrases
    const introducedPhraseCount = chapterPhraseIds.filter(id => introducedPhraseIds.has(id)).length

    // Combined totals
    const introduced = introducedLemmaCount + introducedPhraseCount
    const total = chapterLemmaIds.length + chapterPhraseIds.length
    const introductionRate = total > 0 ? introduced / total : 0

    // Determine unlock state - Chapter 1 is always unlocked
    const isUnlocked = chapter.chapter_number === 1 || previousChapterComplete
    const isNextToUnlock = !isUnlocked && previousChapterComplete

    console.log(`📊 Chapter ${chapter.chapter_number}:`, {
      lemmas: chapterLemmaIds.length,
      phrases: chapterPhraseIds.length,
      total,
      introducedLemmas: introducedLemmaCount,
      introducedPhrases: introducedPhraseCount,
      introduced,
      rate: total > 0 ? Math.round((introduced / total) * 100) : 0
    })

    chaptersWithProgress.push({
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      introduced,
      total_lemmas: total,  // This is now lemmas + phrases
      isUnlocked,
      isNextToUnlock
    })

    // Update for next iteration - chapter is complete if 95%+ introduced
    previousChapterComplete = introductionRate >= 0.95
  }

  console.log('[fetchChaptersProgress] Processed chapters:', chaptersWithProgress.length)

  return chaptersWithProgress
}

/**
 * Fetch activity data for heatmap (last 35 days)
 * Queries both user_lemma_progress and user_phrase_progress for last_seen_at dates
 * Also calculates current and best streak
 */
async function fetchActivityData(userId) {
  const thirtyFiveDaysAgo = new Date()
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35)
  const cutoffDate = thirtyFiveDaysAgo.toISOString()

  // Fetch lemma reviews in last 35 days
  const { data: lemmaReviews, error: lemmaError } = await supabase
    .from('user_lemma_progress')
    .select('last_seen_at')
    .eq('user_id', userId)
    .gte('last_seen_at', cutoffDate)

  if (lemmaError) {
    console.error('❌ [fetchActivityData] lemma reviews query failed:', lemmaError)
  }

  // Fetch phrase reviews in last 35 days
  const { data: phraseReviews, error: phraseError } = await supabase
    .from('user_phrase_progress')
    .select('last_seen_at')
    .eq('user_id', userId)
    .gte('last_seen_at', cutoffDate)

  if (phraseError) {
    console.error('❌ [fetchActivityData] phrase reviews query failed:', phraseError)
  }

  console.log('[fetchActivityData] Reviews found:', {
    lemmaReviews: lemmaReviews?.length || 0,
    phraseReviews: phraseReviews?.length || 0
  })

  // Combine and count by date
  const dateCounts = {}

  for (const review of lemmaReviews || []) {
    if (review.last_seen_at) {
      const date = review.last_seen_at.split('T')[0]
      dateCounts[date] = (dateCounts[date] || 0) + 1
    }
  }

  for (const review of phraseReviews || []) {
    if (review.last_seen_at) {
      const date = review.last_seen_at.split('T')[0]
      dateCounts[date] = (dateCounts[date] || 0) + 1
    }
  }

  // Convert to array format
  const activityData = Object.entries(dateCounts)
    .map(([date, reviews]) => ({ date, reviews }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Debug logging
  const today = new Date().toISOString().split('T')[0]
  console.log('[Dashboard] Activity data - today:', today, 'count:', dateCounts[today] || 0, 'total records:', activityData.length)

  // Calculate streaks
  const { currentStreak, bestStreak } = calculateStreaks(activityData)

  return {
    data: activityData,
    currentStreak,
    bestStreak
  }
}

/**
 * Calculate current and best streaks from activity data
 */
function calculateStreaks(activityData) {
  if (!activityData || activityData.length === 0) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  // Create a set of dates with activity
  const activeDates = new Set(
    activityData
      .filter(d => d.reviews > 0)
      .map(d => d.date)
  )

  // Calculate current streak (counting backward from today)
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check today and yesterday to start
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Start counting from today or yesterday
  let checkDate = activeDates.has(todayStr) ? today : yesterday

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (activeDates.has(dateStr)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Calculate best streak
  let bestStreak = 0
  let tempStreak = 0
  let prevDate = null

  const sortedDates = [...activeDates].sort()
  for (const dateStr of sortedDates) {
    const date = new Date(dateStr)
    if (prevDate) {
      const dayDiff = (date - prevDate) / (1000 * 60 * 60 * 24)
      if (dayDiff === 1) {
        tempStreak++
      } else {
        bestStreak = Math.max(bestStreak, tempStreak)
        tempStreak = 1
      }
    } else {
      tempStreak = 1
    }
    prevDate = date
  }
  bestStreak = Math.max(bestStreak, tempStreak)

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

    // Query uses ISO strings (UTC) but we're querying for local day boundaries
    const startISO = dayStart.toISOString()
    const endISO = dayEnd.toISOString()

    // Lemmas due in this time window
    const { count: lemmaCount, error: lemmaError } = await supabase
      .from('user_lemma_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('due_date', startISO)
      .lt('due_date', endISO)

    if (lemmaError && i === 0) {
      console.error('❌ [fetchForecastData] lemma due query failed:', lemmaError)
    }

    // Phrases due in this time window
    const { count: phraseCount, error: phraseError } = await supabase
      .from('user_phrase_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('due_date', startISO)
      .lt('due_date', endISO)

    if (phraseError && i === 0) {
      console.error('❌ [fetchForecastData] phrase due query failed:', phraseError)
    }

    days.push({
      date: dateStr,
      label: i === 0 ? 'Today' : dayLabels[dayStart.getDay()],
      count: (lemmaCount || 0) + (phraseCount || 0)
    })
  }

  console.log('[fetchForecastData] Forecast:', days.map(d => `${d.label}: ${d.count}`).join(', '))

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

  // Debug logging
  console.log('[fetchCategoryData] Results:', { lemmas: lemmaData?.length || 0, phrases: phraseCount || 0 })

  if (phraseCount && phraseCount > 0) {
    categories['phrase'] = phraseCount
  }

  return categories
}

/**
 * Fetch current streak from user_daily_stats
 */
async function fetchStreakData(userId) {
  const { data } = await supabase
    .from('user_daily_stats')
    .select('current_streak')
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(1)
    .single()

  return data?.current_streak || 0
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
 * Get unlocked chapter numbers for a user
 * "Introduced" = reps >= 1 (reviewed at least once)
 * Includes both lemmas (excluding stop words) and phrases
 */
async function getUnlockedChapterNumbers(userId) {
  // Get all chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .order('chapter_number', { ascending: true })

  if (!chapters || chapters.length === 0) return [1]

  // Get user's introduced lemmas (reps >= 1 means reviewed at least once)
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const introducedLemmaIds = new Set((userProgress || []).map(p => p.lemma_id))

  // Get user's introduced phrases (reps >= 1 means reviewed at least once)
  const { data: userPhraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const introducedPhraseIds = new Set((userPhraseProgress || []).map(p => p.phrase_id))

  const unlockedChapters = [1]

  for (let i = 0; i < chapters.length - 1; i++) {
    const chapter = chapters[i]

    // Get sentences for this chapter
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    if (sentenceIds.length === 0) continue

    // Get lemmas for this chapter (excluding stop words)
    const { data: words } = await supabase
      .from('words')
      .select('lemma_id, lemmas!inner(is_stop_word)')
      .in('sentence_id', sentenceIds)
      .eq('lemmas.is_stop_word', false)

    const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]

    // Get phrases for this chapter
    const { data: phraseOccurrences } = await supabase
      .from('phrase_occurrences')
      .select('phrase_id')
      .in('sentence_id', sentenceIds)

    const chapterPhraseIds = [...new Set((phraseOccurrences || []).map(po => po.phrase_id))]

    // Count introduced
    const introducedLemmaCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length
    const introducedPhraseCount = chapterPhraseIds.filter(id => introducedPhraseIds.has(id)).length

    const introducedCount = introducedLemmaCount + introducedPhraseCount
    const total = chapterLemmaIds.length + chapterPhraseIds.length
    const rate = total > 0 ? introducedCount / total : 0

    if (rate >= 0.95) {
      const nextChapter = chapters[i + 1]
      if (nextChapter && !unlockedChapters.includes(nextChapter.chapter_number)) {
        unlockedChapters.push(nextChapter.chapter_number)
      }
    } else {
      break
    }
  }

  return unlockedChapters.sort((a, b) => a - b)
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
