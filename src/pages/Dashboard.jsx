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
    // HeroStats - 4 levels
    masteredCount: 0,
    familiarCount: 0,
    learningCount: 0,
    introducedCount: 0,
    totalCount: 0,
    // QuickActions
    dueCount: 0,
    newAvailable: 0,
    // ChapterCarousel
    chapters: [],
    totalChapters: 0,
    currentChapterIndex: 0,
    allChaptersLoaded: false,
    _allChaptersCache: null,
    _absoluteCurrentIndex: 0,
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
        chapters: chaptersData.chapters,
        totalChapters: chaptersData.totalChapters,
        currentChapterIndex: chaptersData.currentChapterIndex,
        allChaptersLoaded: false,
        _allChaptersCache: chaptersData._allChaptersCache,
        _absoluteCurrentIndex: chaptersData._absoluteCurrentIndex,
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

  function handleLoadAllChapters() {
    if (dashboardData._allChaptersCache) {
      // Use cached data - instant!
      setDashboardData(prev => ({
        ...prev,
        chapters: prev._allChaptersCache,
        currentChapterIndex: prev._absoluteCurrentIndex,
        allChaptersLoaded: true
      }))
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
            totalChapters={dashboardData.totalChapters}
            currentChapterIndex={dashboardData.currentChapterIndex}
            allChaptersLoaded={dashboardData.allChaptersLoaded}
            onLoadAllChapters={handleLoadAllChapters}
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
 * Fetch quick action stats: due count, new available
 *
 * "New available" = all unintroduced items from Chapter 1 through current chapter (inclusive)
 * This ensures no items from earlier chapters are missed
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

  const dueCount = (lemmasDue || 0) + (phrasesDue || 0)

  // Get user's introduced lemma and phrase IDs (fetch once, reuse)
  const [introducedLemmasResult, introducedPhrasesResult] = await Promise.all([
    supabase
      .from('user_lemma_progress')
      .select('lemma_id')
      .eq('user_id', userId)
      .gte('reps', 1),
    supabase
      .from('user_phrase_progress')
      .select('phrase_id')
      .eq('user_id', userId)
      .gte('reps', 1)
  ])

  const introducedLemmaIds = new Set((introducedLemmasResult.data || []).map(p => p.lemma_id))
  const introducedPhraseIds = new Set((introducedPhrasesResult.data || []).map(p => p.phrase_id))

  // Find current chapter and get all chapters up to it
  const chaptersToCount = await getChaptersThroughCurrent(userId, introducedLemmaIds, introducedPhraseIds)

  if (chaptersToCount.length === 0) {
    return { dueCount, newAvailable: 0 }
  }

  // Count unintroduced items per chapter (smaller queries, more reliable)
  let totalNewLemmas = 0
  let totalNewPhrases = 0

  for (const chapter of chaptersToCount) {
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)
    if (sentenceIds.length === 0) continue

    // Get non-stop lemmas for this chapter
    const { data: words } = await supabase
      .from('words')
      .select('lemma_id, lemmas!inner(is_stop_word)')
      .in('sentence_id', sentenceIds)
      .eq('lemmas.is_stop_word', false)

    const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]
    const newLemmasInChapter = chapterLemmaIds.filter(id => !introducedLemmaIds.has(id)).length
    totalNewLemmas += newLemmasInChapter

    // Get phrases for this chapter
    const { data: phraseOccs } = await supabase
      .from('phrase_occurrences')
      .select('phrase_id')
      .in('sentence_id', sentenceIds)

    const chapterPhraseIds = [...new Set((phraseOccs || []).map(o => o.phrase_id))]
    const newPhrasesInChapter = chapterPhraseIds.filter(id => !introducedPhraseIds.has(id)).length
    totalNewPhrases += newPhrasesInChapter
  }

  const newAvailable = totalNewLemmas + totalNewPhrases

  console.log('[Dashboard] New available debug:', {
    chaptersIncluded: chaptersToCount.map(c => c.chapter_number),
    introducedLemmas: introducedLemmaIds.size,
    introducedPhrases: introducedPhraseIds.size,
    newLemmasAvailable: totalNewLemmas,
    newPhrasesAvailable: totalNewPhrases,
    total: newAvailable
  })

  return { dueCount, newAvailable }
}

/**
 * Get all unlocked chapters for counting "Learn New" available words
 * Uses same 95% threshold as session builder for consistency
 *
 * A chapter is unlocked when:
 * - It's Chapter 1 (always unlocked), OR
 * - The previous chapter is >= 95% complete
 */
async function getChaptersThroughCurrent(userId, introducedLemmaIds, introducedPhraseIds) {
  // Get all chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number, title')
    .order('chapter_number', { ascending: true })

  if (!chapters || chapters.length === 0) return []

  const unlockedChapters = []

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]

    if (i === 0) {
      // Chapter 1 is always unlocked
      unlockedChapters.push(chapter)
      continue
    }

    // Check if PREVIOUS chapter is >= 95% complete
    const prevChapter = chapters[i - 1]

    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', prevChapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    if (sentenceIds.length === 0) {
      // No sentences in previous chapter, consider it complete
      unlockedChapters.push(chapter)
      continue
    }

    // Get non-stop lemmas for previous chapter
    const { data: words } = await supabase
      .from('words')
      .select('lemma_id, lemmas!inner(is_stop_word)')
      .in('sentence_id', sentenceIds)
      .eq('lemmas.is_stop_word', false)

    const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]

    // Get phrases for previous chapter
    const { data: phraseOccs } = await supabase
      .from('phrase_occurrences')
      .select('phrase_id')
      .in('sentence_id', sentenceIds)

    const chapterPhraseIds = [...new Set((phraseOccs || []).map(o => o.phrase_id))]

    // Calculate previous chapter's progress
    const introducedLemmaCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length
    const introducedPhraseCount = chapterPhraseIds.filter(id => introducedPhraseIds.has(id)).length
    const totalItems = chapterLemmaIds.length + chapterPhraseIds.length
    const introducedItems = introducedLemmaCount + introducedPhraseCount
    const completionRate = totalItems > 0 ? introducedItems / totalItems : 1

    // 95% threshold to unlock this chapter (same as session builder)
    if (completionRate >= 0.95) {
      unlockedChapters.push(chapter)
    } else {
      // Previous chapter not at 95%, stop here
      break
    }
  }

  console.log('[Dashboard] Unlocked chapters for Learn New:', unlockedChapters.map(c => c.chapter_number))

  return unlockedChapters
}

/**
 * Fetch chapters with progress for carousel - PARALLEL APPROACH
 * Fetches all chapters in parallel for speed, but uses per-chapter queries for accuracy
 *
 * @param {string} userId - User ID
 * @returns {Object} - { chapters, currentChapterIndex, totalChapters }
 */
async function fetchChaptersProgress(userId) {
  console.time('fetchChaptersProgress')

  // Get all chapters first
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number, title')
    .order('chapter_number', { ascending: true })

  if (chaptersError || !chapters || chapters.length === 0) {
    console.error('❌ [fetchChaptersProgress] chapters query failed:', chaptersError)
    return {
      chapters: [{
        chapter_number: 1,
        title: 'Chapter 1',
        introduced: 0,
        total_lemmas: 0,
        mastered: 0,
        familiar: 0,
        learning: 0,
        notSeen: 0,
        isUnlocked: true,
        isNextToUnlock: false
      }],
      currentChapterIndex: 0,
      totalChapters: 1
    }
  }

  // Get user's progress with FSRS fields for level calculation
  const [lemmaProgressResult, phraseProgressResult] = await Promise.all([
    supabase
      .from('user_lemma_progress')
      .select('lemma_id, stability, fsrs_state, reps')
      .eq('user_id', userId),
    supabase
      .from('user_phrase_progress')
      .select('phrase_id, stability, fsrs_state, reps')
      .eq('user_id', userId)
  ])

  // Build maps for quick lookup
  const lemmaProgressMap = new Map((lemmaProgressResult.data || []).map(p => [p.lemma_id, p]))
  const phraseProgressMap = new Map((phraseProgressResult.data || []).map(p => [p.phrase_id, p]))

  // Also keep sets for introduced check (reps >= 1)
  const introducedLemmaIds = new Set(
    (lemmaProgressResult.data || []).filter(p => (p.reps || 0) >= 1).map(p => p.lemma_id)
  )
  const introducedPhraseIds = new Set(
    (phraseProgressResult.data || []).filter(p => (p.reps || 0) >= 1).map(p => p.phrase_id)
  )

  // Fetch chapter stats in parallel (all 27 chapters at once)
  const chapterStatsPromises = chapters.map(async (chapter) => {
    // Get sentences for this chapter
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    if (sentenceIds.length === 0) {
      return {
        chapter_id: chapter.chapter_id,
        chapter_number: chapter.chapter_number,
        title: chapter.title,
        introduced: 0,
        total_lemmas: 0,
        mastered: 0,
        familiar: 0,
        learning: 0,
        notSeen: 0
      }
    }

    // Get lemmas (excluding stop words) and phrases in parallel
    const [wordsResult, phrasesResult] = await Promise.all([
      supabase
        .from('words')
        .select('lemma_id, lemmas!inner(is_stop_word)')
        .in('sentence_id', sentenceIds)
        .eq('lemmas.is_stop_word', false),
      supabase
        .from('phrase_occurrences')
        .select('phrase_id')
        .in('sentence_id', sentenceIds)
    ])

    // Get unique lemmas and phrases for this chapter
    const chapterLemmaIds = [...new Set((wordsResult.data || []).map(w => w.lemma_id))]
    const chapterPhraseIds = [...new Set((phrasesResult.data || []).map(po => po.phrase_id))]

    // Count introduced
    const introducedLemmaCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length
    const introducedPhraseCount = chapterPhraseIds.filter(id => introducedPhraseIds.has(id)).length
    const introducedCount = introducedLemmaCount + introducedPhraseCount
    const totalItems = chapterLemmaIds.length + chapterPhraseIds.length

    // Get progress records for this chapter's items and categorize by level
    const chapterProgressRecords = [
      ...chapterLemmaIds.map(id => lemmaProgressMap.get(id)).filter(Boolean),
      ...chapterPhraseIds.map(id => phraseProgressMap.get(id)).filter(Boolean)
    ]
    const levels = categorizeByLevel(chapterProgressRecords)

    return {
      chapter_id: chapter.chapter_id,
      chapter_number: chapter.chapter_number,
      title: chapter.title,
      introduced: introducedCount,
      total_lemmas: totalItems, // Keep name for backward compatibility
      // New 4-level breakdown
      mastered: levels.mastered,
      familiar: levels.familiar,
      learning: levels.learning,
      notSeen: totalItems - introducedCount
    }
  })

  // Wait for all chapter stats
  const chapterStats = await Promise.all(chapterStatsPromises)

  // Build final chapters array with unlock logic
  const chaptersWithProgress = []
  let previousChapterComplete = true

  for (const stats of chapterStats) {
    const completionRate = stats.total_lemmas > 0 ? stats.introduced / stats.total_lemmas : 0

    const isUnlocked = stats.chapter_number === 1 || previousChapterComplete
    const isNextToUnlock = !isUnlocked && previousChapterComplete

    chaptersWithProgress.push({
      chapter_number: stats.chapter_number,
      title: stats.title,
      introduced: stats.introduced,
      total_lemmas: stats.total_lemmas,
      // 4-level breakdown
      mastered: stats.mastered,
      familiar: stats.familiar,
      learning: stats.learning,
      notSeen: stats.notSeen,
      isUnlocked,
      isNextToUnlock,
      completionRate
    })

    // Update for next iteration (95% threshold)
    previousChapterComplete = completionRate >= 0.95
  }

  // Find current chapter: first unlocked with < 100% completion
  let currentChapterIndex = chaptersWithProgress.findIndex(
    ch => ch.isUnlocked && ch.completionRate < 1.0
  )

  if (currentChapterIndex === -1) {
    currentChapterIndex = 0
  }

  console.timeEnd('fetchChaptersProgress')
  console.log(`📚 [fetchChaptersProgress] Current chapter: ${currentChapterIndex + 1}, Total: ${chapters.length}`)

  // Return with "1 back, current, 2 forward" logic for visible chapters
  const startIndex = Math.max(0, currentChapterIndex - 1)
  const endIndex = Math.min(chaptersWithProgress.length, startIndex + 4)
  const adjustedStartIndex = Math.max(0, endIndex - 4)

  const visibleChapters = chaptersWithProgress.slice(adjustedStartIndex, adjustedStartIndex + 4)
  const visibleCurrentIndex = currentChapterIndex - adjustedStartIndex

  return {
    chapters: visibleChapters,
    currentChapterIndex: visibleCurrentIndex,
    totalChapters: chapters.length,
    _allChaptersCache: chaptersWithProgress,
    _absoluteCurrentIndex: currentChapterIndex
  }
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
 * This ensures accuracy even if stored values are stale
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

  // Calculate consecutive days streak from today
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  let streak = 0

  for (let i = 0; i < recentStats.length; i++) {
    const stat = recentStats[i]

    // Calculate expected date (today - i days)
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    const expectedDateStr = expectedDate.toISOString().split('T')[0]

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
