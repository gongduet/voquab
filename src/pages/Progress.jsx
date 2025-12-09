import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import CalendarView from '../components/CalendarView'

export default function Progress() {
  const [stats, setStats] = useState({
    totalWords: 0,
    wordsMastered: 0,
    currentStreak: 0,
    wordsDueToday: 0,
  })
  const [chapterMastery, setChapterMastery] = useState({
    totalWords: 0,
    reviewedWords: 0,
    percentage: 0,
  })
  const [vocabularyBreakdown, setVocabularyBreakdown] = useState({
    new: 0,
    learning: 0,
    familiar: 0,
    mastered: 0,
  })
  const [learningMetrics, setLearningMetrics] = useState({
    avgMastery: 0,
    totalReviews: 0,
    weeklyReviews: 0,
    accuracy: 0,
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      fetchAllStats()
    }
  }, [user])

  async function fetchAllStats() {
    try {
      setLoading(true)
      setError(null)

      console.log('📊 Starting to fetch all stats...')

      await Promise.all([
        fetchOverallStats(),
        fetchChapterMastery(),
        fetchVocabularyBreakdown(),
        fetchLearningMetrics(),
        fetchRecentActivity(),
      ])

      console.log('✅ All stats fetched successfully')
      setLoading(false)
    } catch (err) {
      console.error('❌ Error fetching stats:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function fetchOverallStats() {
    try {
      console.log('📈 Fetching overall stats...')

      // Get all user lemma progress (DUAL PROGRESSION SYSTEM)
      const { data: progressData, error: progressError } = await supabase
        .from('user_lemma_progress')
        .select('mastery_level, review_due, total_reviews, correct_reviews')
        .eq('user_id', user.id)

      if (progressError) {
        console.error('Error fetching progress data:', progressError)
        throw progressError
      }

      console.log('Progress data:', progressData)

      // Defensive: ensure progressData is an array
      const safeProgressData = Array.isArray(progressData) ? progressData : []

      const totalWords = safeProgressData.length
      // Mastered: mastery_level >= 81 (on 0-100 scale)
      const wordsMastered = safeProgressData.filter(p => (p.mastery_level || 0) >= 81).length

      // Calculate words due today
      // Only count words with mastery_level > 0 (reviewed at least once) AND review_due <= today
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const wordsDueToday = safeProgressData.filter(p => {
        // Must have been reviewed at least once
        if ((p.mastery_level || 0) === 0) return false
        // Must have a review_due date set
        if (!p.review_due) return false
        // Must be due today or earlier
        const dueDate = new Date(p.review_due)
        return dueDate <= today
      }).length

      // Get current streak from user_daily_stats (most recent entry)
      console.log('🔍 [STREAK DEBUG PROGRESS] Fetching streak data for user:', user.id)

      const { data: streakData, error: streakError } = await supabase
        .from('user_daily_stats')
        .select('current_streak, review_date')
        .eq('user_id', user.id)
        .order('review_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('🔍 [STREAK DEBUG PROGRESS] Streak query error:', streakError)
      console.log('🔍 [STREAK DEBUG PROGRESS] Streak data found:', streakData)

      if (streakError) {
        console.warn('Error fetching streak (non-critical):', streakError)
      }

      // Check if the most recent entry is today or yesterday to count as active streak
      let currentStreak = 0
      if (streakData) {
        // Use date strings for comparison to avoid timezone issues
        const today = new Date()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const todayStr = today.toISOString().split('T')[0]
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        console.log('🔍 [STREAK DEBUG PROGRESS] Today date string:', todayStr)
        console.log('🔍 [STREAK DEBUG PROGRESS] Yesterday date string:', yesterdayStr)
        console.log('🔍 [STREAK DEBUG PROGRESS] Review date string:', streakData.review_date)

        // Only count as active if reviewed today or yesterday
        if (streakData.review_date === todayStr || streakData.review_date === yesterdayStr) {
          currentStreak = streakData.current_streak || 0
          console.log('🔍 [STREAK DEBUG PROGRESS] ✅ Setting streak to:', currentStreak)
        } else {
          console.log('🔍 [STREAK DEBUG PROGRESS] ❌ Review date too old, streak = 0')
        }
      } else {
        console.log('🔍 [STREAK DEBUG PROGRESS] ❌ No streak data found, streak = 0')
      }

      console.log('Overall stats:', { totalWords, wordsMastered, currentStreak, wordsDueToday })

      setStats({
        totalWords,
        wordsMastered,
        currentStreak,
        wordsDueToday,
      })
    } catch (err) {
      console.error('❌ fetchOverallStats failed:', err)
      // Set default values on error
      setStats({
        totalWords: 0,
        wordsMastered: 0,
        currentStreak: 0,
        wordsDueToday: 0,
      })
    }
  }

  async function fetchChapterMastery() {
    try {
      console.log('📖 Fetching chapter mastery...')

      // Get Chapter 1 ID
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('book_id')
        .eq('title', 'El Principito')
        .eq('language_code', 'es')
        .maybeSingle()

      if (bookError) {
        console.error('Error fetching book:', bookError)
        throw bookError
      }

      if (!book) {
        console.warn('Book "El Principito" not found')
        setChapterMastery({ totalWords: 0, reviewedWords: 0, percentage: 0 })
        return
      }

      const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('chapter_id')
        .eq('book_id', book.book_id)
        .eq('chapter_number', 1)
        .maybeSingle()

      if (chapterError) {
        console.error('Error fetching chapter:', chapterError)
        throw chapterError
      }

      if (!chapter) {
        console.warn('Chapter 1 not found')
        setChapterMastery({ totalWords: 0, reviewedWords: 0, percentage: 0 })
        return
      }

      // First get all sentences in Chapter 1
      const { data: sentences, error: sentencesError } = await supabase
        .from('sentences')
        .select('sentence_id')
        .eq('chapter_id', chapter.chapter_id)

      if (sentencesError) {
        console.error('Error fetching sentences:', sentencesError)
        throw sentencesError
      }

      const safeSentences = Array.isArray(sentences) ? sentences : []
      const sentenceIds = safeSentences.map(s => s.sentence_id)

      console.log('Found sentences:', sentenceIds.length)

      if (sentenceIds.length === 0) {
        console.warn('No sentences found in Chapter 1')
        setChapterMastery({ totalWords: 0, reviewedWords: 0, percentage: 0 })
        return
      }

      // Get all unique lemma IDs in Chapter 1
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select('lemma_id, sentence_id')
        .in('sentence_id', sentenceIds)

      if (wordsError) {
        console.error('Error fetching words:', wordsError)
        throw wordsError
      }

      // Defensive: ensure wordsData is an array
      const safeWordsData = Array.isArray(wordsData) ? wordsData : []

      // Get unique lemma IDs
      const uniqueLemmaIds = [...new Set(safeWordsData.map(w => w.lemma_id))]
      const totalWords = uniqueLemmaIds.length

      console.log('Total unique lemmas in chapter:', totalWords)

      if (totalWords === 0) {
        setChapterMastery({ totalWords: 0, reviewedWords: 0, percentage: 0 })
        return
      }

      // Get how many of these the user has reviewed at mastery level 30+ (equivalent to old level 3+)
      const { data: userProgress, error: progressError } = await supabase
        .from('user_lemma_progress')
        .select('lemma_id, mastery_level')
        .eq('user_id', user.id)
        .in('lemma_id', uniqueLemmaIds)
        .gte('mastery_level', 30)

      if (progressError) {
        console.error('Error fetching user progress:', progressError)
        throw progressError
      }

      const safeUserProgress = Array.isArray(userProgress) ? userProgress : []
      const reviewedWords = safeUserProgress.length
      const percentage = totalWords > 0 ? Math.round((reviewedWords / totalWords) * 100) : 0

      console.log('Chapter mastery:', { totalWords, reviewedWords, percentage })

      setChapterMastery({
        totalWords,
        reviewedWords,
        percentage,
      })
    } catch (err) {
      console.error('❌ fetchChapterMastery failed:', err)
      // Set default values on error
      setChapterMastery({
        totalWords: 0,
        reviewedWords: 0,
        percentage: 0,
      })
    }
  }

  async function fetchVocabularyBreakdown() {
    try {
      console.log('📊 Fetching vocabulary breakdown...')

      const { data: progressData, error: progressError } = await supabase
        .from('user_lemma_progress')
        .select('mastery_level')
        .eq('user_id', user.id)

      if (progressError) {
        console.error('Error fetching vocabulary breakdown:', progressError)
        throw progressError
      }

      // Defensive: ensure progressData is an array
      const safeProgressData = Array.isArray(progressData) ? progressData : []

      console.log('Vocabulary progress data:', safeProgressData.length, 'words')

      // DUAL PROGRESSION SYSTEM - Mastery-based thresholds (0-100 scale)
      const breakdown = {
        new: safeProgressData.filter(p => (p.mastery_level || 0) >= 0 && (p.mastery_level || 0) <= 20).length,
        learning: safeProgressData.filter(p => (p.mastery_level || 0) >= 21 && (p.mastery_level || 0) <= 50).length,
        familiar: safeProgressData.filter(p => (p.mastery_level || 0) >= 51 && (p.mastery_level || 0) <= 80).length,
        mastered: safeProgressData.filter(p => (p.mastery_level || 0) >= 81 && (p.mastery_level || 0) <= 100).length,
      }

      console.log('Vocabulary breakdown (mastery-based):', breakdown)

      setVocabularyBreakdown(breakdown)
    } catch (err) {
      console.error('❌ fetchVocabularyBreakdown failed:', err)
      // Set default values on error
      setVocabularyBreakdown({
        new: 0,
        learning: 0,
        familiar: 0,
        mastered: 0,
      })
    }
  }

  async function fetchLearningMetrics() {
    try {
      console.log('📈 Fetching learning metrics (DUAL PROGRESSION)...')

      const { data: progressData, error: progressError } = await supabase
        .from('user_lemma_progress')
        .select('mastery_level, total_reviews, correct_reviews, last_reviewed_at')
        .eq('user_id', user.id)

      if (progressError) {
        console.error('Error fetching learning metrics:', progressError)
        throw progressError
      }

      const safeProgressData = Array.isArray(progressData) ? progressData : []

      if (safeProgressData.length === 0) {
        setLearningMetrics({
          avgMastery: 0,
          totalReviews: 0,
          weeklyReviews: 0,
          accuracy: 0,
        })
        return
      }

      // Calculate average mastery (0-100)
      const totalMastery = safeProgressData.reduce((sum, p) => sum + (p.mastery_level || 0), 0)
      const avgMastery = Math.round(totalMastery / safeProgressData.length)

      // Calculate total reviews across all words
      const totalReviews = safeProgressData.reduce((sum, p) => sum + (p.total_reviews || 0), 0)

      // Calculate total correct reviews
      const totalCorrect = safeProgressData.reduce((sum, p) => sum + (p.correct_reviews || 0), 0)

      // Calculate accuracy percentage
      const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0

      // Calculate weekly reviews (last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

      const { data: recentReviews, error: recentError } = await supabase
        .from('user_review_history')
        .select('review_id')
        .eq('user_id', user.id)
        .gte('reviewed_at', sevenDaysAgoStr)

      if (recentError) {
        console.warn('Error fetching weekly reviews:', recentError)
      }

      const weeklyReviews = Array.isArray(recentReviews) ? recentReviews.length : 0

      const metrics = {
        avgMastery,
        totalReviews,
        weeklyReviews,
        accuracy,
      }

      console.log('Learning metrics:', metrics)

      setLearningMetrics(metrics)
    } catch (err) {
      console.error('❌ fetchLearningMetrics failed:', err)
      setLearningMetrics({
        avgMastery: 0,
        totalReviews: 0,
        weeklyReviews: 0,
        accuracy: 0,
      })
    }
  }

  async function fetchRecentActivity() {
    try {
      console.log('═══════════════════════════════════════════════')
      console.log('📅 [ACTIVITY DEBUG] Fetching recent activity...')
      console.log('═══════════════════════════════════════════════')

      // Get last 7 days
      const last7Days = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        last7Days.push({
          date: date.toISOString().split('T')[0],
          count: 0,
          label: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
        })
      }

      console.log('📅 [ACTIVITY DEBUG] Generated 7-day template:', last7Days)

      // Query user_review_history for the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      console.log('📅 [ACTIVITY DEBUG] Querying reviews since:', sevenDaysAgo.toISOString())

      const { data: reviewHistory, error: reviewError } = await supabase
        .from('user_review_history')
        .select('reviewed_at')
        .eq('user_id', user.id)
        .gte('reviewed_at', sevenDaysAgo.toISOString())

      console.log('📅 [ACTIVITY DEBUG] Query error:', reviewError)
      console.log('📅 [ACTIVITY DEBUG] Raw review data:', reviewHistory)

      if (reviewError) {
        console.warn('Error fetching review history (non-critical):', reviewError)
        // Not critical, just show empty activity
        setRecentActivity(last7Days)
        return
      }

      // Defensive: ensure reviewHistory is an array
      const safeReviewHistory = Array.isArray(reviewHistory) ? reviewHistory : []

      console.log('📅 [ACTIVITY DEBUG] Total reviews found:', safeReviewHistory.length)

      // Count reviews per day
      safeReviewHistory.forEach((review, index) => {
        if (review && review.reviewed_at) {
          // IMPORTANT: Convert UTC timestamp to LOCAL date to match template dates
          const reviewDate = new Date(review.reviewed_at).toLocaleDateString('en-CA') // YYYY-MM-DD in local time
          console.log(`📅 [ACTIVITY DEBUG] Review #${index + 1}: ${review.reviewed_at} → local date: ${reviewDate}`)

          const dayEntry = last7Days.find(d => d.date === reviewDate)
          if (dayEntry) {
            dayEntry.count++
            console.log(`📅 [ACTIVITY DEBUG] ✅ Matched to ${dayEntry.label}, new count: ${dayEntry.count}`)
          } else {
            console.log(`📅 [ACTIVITY DEBUG] ❌ No match found for date: ${reviewDate}`)
            console.log(`📅 [ACTIVITY DEBUG] Available dates in template:`, last7Days.map(d => d.date))
          }
        } else {
          console.log(`📅 [ACTIVITY DEBUG] ⚠️ Review #${index + 1} has no reviewed_at field:`, review)
        }
      })

      console.log('📅 [ACTIVITY DEBUG] Final activity data:', last7Days)

      setRecentActivity(last7Days)
    } catch (err) {
      console.error('❌ fetchRecentActivity failed:', err)
      // Set default empty 7 days on error
      const emptyDays = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        emptyDays.push({
          date: date.toISOString().split('T')[0],
          count: 0,
          label: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
        })
      }
      setRecentActivity(emptyDays)
    }
  }

  function getHealthBarColor(percentage) {
    if (percentage >= 80) return 'from-green-400 to-green-600'
    if (percentage >= 60) return 'from-yellow-400 to-yellow-600'
    if (percentage >= 30) return 'from-orange-400 to-orange-600'
    return 'from-red-400 to-red-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600 font-serif">Loading your progress...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-serif font-bold text-red-700 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-serif"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Defensive: ensure recentActivity is an array before mapping
  const safeRecentActivity = Array.isArray(recentActivity) ? recentActivity : []
  const maxActivityCount = safeRecentActivity.length > 0
    ? Math.max(...safeRecentActivity.map(d => d.count || 0), 1)
    : 1

  console.log('📊 [CHART RENDER] safeRecentActivity:', safeRecentActivity)
  console.log('📊 [CHART RENDER] maxActivityCount:', maxActivityCount)

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-amber-800 hover:text-amber-900 font-serif text-sm flex items-center gap-2"
          >
            ← Home
          </button>
          <h1 className="text-2xl font-serif font-bold text-amber-700">Your Progress</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Overall Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl">📚</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-amber-700 font-serif">
                  {stats.totalWords}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-serif">Words Encountered</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl">⭐</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-700 font-serif">
                  {stats.wordsMastered}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-serif">Words Mastered</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl">🔥</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-orange-700 font-serif">
                  {stats.currentStreak}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-serif">Day Streak</p>
          </div>

          <div
            onClick={() => navigate('/flashcards?filter=due')}
            className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-3xl">📝</div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-700 font-serif">
                  {stats.wordsDueToday}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-serif">Due Today</p>
            <p className="text-xs text-blue-600 font-serif mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Click to review →
            </p>
          </div>
        </div>

        {/* Chapter 1 Mastery Health Bar */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-2 border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-serif font-bold text-amber-700">
              El Principito - Capítulo 1
            </h2>
            <span className="text-sm text-gray-600 font-serif">
              {chapterMastery.reviewedWords} / {chapterMastery.totalWords} words
            </span>
          </div>

          <div className="relative w-full h-12 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full bg-gradient-to-r ${getHealthBarColor(chapterMastery.percentage)} transition-all duration-1000 ease-out flex items-center justify-center`}
              style={{ width: `${chapterMastery.percentage}%` }}
            >
              {chapterMastery.percentage > 15 && (
                <span className="text-white font-bold font-serif text-lg">
                  {chapterMastery.percentage}%
                </span>
              )}
            </div>
            {chapterMastery.percentage <= 15 && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <span className="text-gray-600 font-bold font-serif text-lg">
                  {chapterMastery.percentage}%
                </span>
              </div>
            )}
          </div>

          <p className="mt-3 text-sm text-gray-600 font-serif text-center">
            {chapterMastery.percentage >= 80 && "🎉 Excellent mastery! Keep it up!"}
            {chapterMastery.percentage >= 60 && chapterMastery.percentage < 80 && "💪 Good progress! Almost there!"}
            {chapterMastery.percentage >= 30 && chapterMastery.percentage < 60 && "📖 Keep learning! You're making progress!"}
            {chapterMastery.percentage < 30 && "🌱 Just getting started! Review flashcards to improve!"}
          </p>
        </div>

        {/* Two-column layout: Calendar + Learning Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Left Column: Calendar (max 600px) */}
          <div className="max-w-[600px]">
            <CalendarView userId={user.id} />
          </div>

          {/* Right Column: Learning Metrics */}
          <div className="bg-gradient-to-br from-white to-amber-50 rounded-xl shadow-lg p-6 border-2 border-amber-300">
            <h2 className="text-xl font-serif font-bold text-amber-800 mb-2 flex items-center gap-2">
              <span>📊</span>
              <span>Learning Metrics</span>
            </h2>
            <p className="text-xs text-gray-600 font-serif mb-4">
              Dual progression system tracking quality (mastery) and quantity (exposure)
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* TRACK 1: MASTERY (Green) */}
              <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <div className="text-xs text-green-700 font-serif font-bold mb-1 flex items-center gap-1">
                  <span>🎯</span>
                  <span>Mastery</span>
                </div>
                <div className="text-3xl font-bold text-green-900 font-serif">
                  {learningMetrics.avgMastery}
                </div>
                <div className="text-[10px] text-green-600 font-serif">
                  Average quality (0-100)
                </div>
              </div>

              {/* TRACK 2: EXPOSURE - Total Reviews (Blue) */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="text-xs text-blue-700 font-serif font-bold mb-1 flex items-center gap-1">
                  <span>📚</span>
                  <span>Total Reviews</span>
                </div>
                <div className="text-3xl font-bold text-blue-900 font-serif">
                  {learningMetrics.totalReviews}
                </div>
                <div className="text-[10px] text-blue-600 font-serif">
                  All-time practice count
                </div>
              </div>

              {/* TRACK 2: EXPOSURE - Weekly Reviews (Blue) */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="text-xs text-blue-700 font-serif font-bold mb-1 flex items-center gap-1">
                  <span>📅</span>
                  <span>This Week</span>
                </div>
                <div className="text-3xl font-bold text-blue-900 font-serif">
                  {learningMetrics.weeklyReviews}
                </div>
                <div className="text-[10px] text-blue-600 font-serif">
                  Reviews last 7 days
                </div>
              </div>

              {/* TRACK 2: EXPOSURE - Accuracy (Purple) */}
              <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                <div className="text-xs text-purple-700 font-serif font-bold mb-1 flex items-center gap-1">
                  <span>✨</span>
                  <span>Accuracy</span>
                </div>
                <div className="text-3xl font-bold text-purple-900 font-serif">
                  {learningMetrics.accuracy}%
                </div>
                <div className="text-[10px] text-purple-600 font-serif">
                  Medium/Easy rate
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vocabulary Breakdown - Full Width */}
        <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-amber-200 mb-8">
          <h2 className="text-2xl font-serif font-bold text-amber-700 mb-6">
            Vocabulary Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-serif text-gray-700 flex items-center gap-2">
                    <span className="w-4 h-4 bg-red-500 rounded-full"></span>
                    New Words
                  </span>
                  <span className="text-lg font-bold font-serif text-gray-900">
                    {vocabularyBreakdown.new}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-500"
                    style={{
                      width: `${stats.totalWords > 0 ? (vocabularyBreakdown.new / stats.totalWords) * 100 : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-serif text-gray-700 flex items-center gap-2">
                    <span className="w-4 h-4 bg-orange-500 rounded-full"></span>
                    Learning
                  </span>
                  <span className="text-lg font-bold font-serif text-gray-900">
                    {vocabularyBreakdown.learning}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-500"
                    style={{
                      width: `${stats.totalWords > 0 ? (vocabularyBreakdown.learning / stats.totalWords) * 100 : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-serif text-gray-700 flex items-center gap-2">
                    <span className="w-4 h-4 bg-yellow-500 rounded-full"></span>
                    Familiar
                  </span>
                  <span className="text-lg font-bold font-serif text-gray-900">
                    {vocabularyBreakdown.familiar}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 transition-all duration-500"
                    style={{
                      width: `${stats.totalWords > 0 ? (vocabularyBreakdown.familiar / stats.totalWords) * 100 : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-serif text-gray-700 flex items-center gap-2">
                    <span className="w-4 h-4 bg-green-500 rounded-full"></span>
                    Mastered
                  </span>
                  <span className="text-lg font-bold font-serif text-gray-900">
                    {vocabularyBreakdown.mastered}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{
                      width: `${stats.totalWords > 0 ? (vocabularyBreakdown.mastered / stats.totalWords) * 100 : 0}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  )
}
