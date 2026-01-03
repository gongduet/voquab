import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DashboardHeader } from '../components/dashboard'

/**
 * Admin Dashboard - Admin interface for content management
 *
 * Access controlled by AdminRoute component (checks user_settings.is_admin)
 *
 * Features:
 * - Tab navigation for different admin functions
 * - Nested routes via Outlet
 * - Voquab header bar for consistent navigation
 */
export default function Admin() {
  const location = useLocation()
  const { user } = useAuth()
  const [headerData, setHeaderData] = useState({
    streak: 0,
    username: '',
    loading: true
  })

  // Fetch minimal user data for header
  useEffect(() => {
    async function fetchHeaderData() {
      if (!user?.id) return

      try {
        // Fetch display_name from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single()

        // Calculate streak from user_review_history (same logic as Dashboard.jsx)
        const streak = await calculateStreakFromHistory(user.id)

        setHeaderData({
          streak,
          username: profile?.display_name || user.email?.split('@')[0] || '',
          loading: false
        })
      } catch (error) {
        console.error('Error fetching header data:', error)
        setHeaderData(prev => ({ ...prev, loading: false }))
      }
    }

    fetchHeaderData()
  }, [user?.id, user?.email])

  /**
   * Calculate streak from user_review_history - matches Dashboard.jsx logic exactly
   * Counts consecutive days with activity, starting from today (or yesterday if no activity today)
   */
  async function calculateStreakFromHistory(userId) {
    // Helper to format date as YYYY-MM-DD in local time
    const formatLocalDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    console.log('[Admin] calculateStreakFromHistory called with userId:', userId)

    // Get reviews from last 70 days
    const seventyDaysAgo = new Date()
    seventyDaysAgo.setDate(seventyDaysAgo.getDate() - 70)

    console.log('[Admin] Querying reviews since:', seventyDaysAgo.toISOString())

    const { data: reviews, error } = await supabase
      .from('user_review_history')
      .select('reviewed_at, lemma_id, phrase_id')
      .eq('user_id', userId)
      .gte('reviewed_at', seventyDaysAgo.toISOString())

    console.log('[Admin] Query result - error:', error, 'reviews count:', reviews?.length)

    if (error || !reviews) {
      console.log('[Admin] Returning 0 due to error or no reviews')
      return 0
    }

    // Group by date, counting unique lemmas + phrases per day
    const activityByDate = {}
    for (const review of reviews) {
      const dateStr = formatLocalDate(new Date(review.reviewed_at))
      if (!activityByDate[dateStr]) {
        activityByDate[dateStr] = { lemmas: new Set(), phrases: new Set() }
      }
      if (review.lemma_id) activityByDate[dateStr].lemmas.add(review.lemma_id)
      if (review.phrase_id) activityByDate[dateStr].phrases.add(review.phrase_id)
    }

    // Build activity map for streak calculation
    const activityMap = new Map()
    for (const [date, sets] of Object.entries(activityByDate)) {
      activityMap.set(date, sets.lemmas.size + sets.phrases.size)
    }

    console.log('[Admin] Activity dates:', [...activityMap.keys()].slice(0, 10))

    // Calculate streak - don't break if today has no activity yet
    let calculatedStreak = 0
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const hasTodayActivity = activityMap.has(todayStr) && activityMap.get(todayStr) > 0

    console.log('[Admin] Today:', todayStr, 'hasTodayActivity:', hasTodayActivity)

    // If today has activity, include it and count backwards
    // If today has no activity, start from yesterday
    const startOffset = hasTodayActivity ? 0 : 1

    console.log('[Admin] startOffset:', startOffset)

    for (let i = startOffset; i < 60; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() - i)
      const checkDateStr = formatLocalDate(checkDate)

      if (activityMap.has(checkDateStr) && activityMap.get(checkDateStr) > 0) {
        calculatedStreak++
      } else {
        console.log('[Admin] Streak broken at:', checkDateStr, 'i:', i)
        break
      }
    }

    console.log('[Admin] Final calculated streak:', calculatedStreak)
    return calculatedStreak
  }

  // Determine active tab based on current route
  const isLemmasActive = location.pathname === '/admin/common-words' || location.pathname.startsWith('/admin/lemmas/')
  const isLemmaDeepDive = location.pathname.startsWith('/admin/lemmas/') && location.pathname !== '/admin/lemmas'
  const isPhrasesActive = location.pathname === '/admin/phrases' || location.pathname.startsWith('/admin/phrases/')
  const isPhraseDeepDive = location.pathname.startsWith('/admin/phrases/') && location.pathname !== '/admin/phrases'
  const isSentencesActive = location.pathname === '/admin/sentences' || location.pathname.startsWith('/admin/sentences/')
  const isSentenceDeepDive = location.pathname.startsWith('/admin/sentences/') && location.pathname !== '/admin/sentences'
  const isSongsActive = location.pathname === '/admin/songs' || location.pathname.startsWith('/admin/songs/')
  const isSongDeepDive = location.pathname.startsWith('/admin/songs/') && location.pathname !== '/admin/songs'
  const isLinesActive = location.pathname === '/admin/song-lines' || location.pathname.startsWith('/admin/song-lines/')
  const isLineDeepDive = location.pathname.startsWith('/admin/song-lines/') && location.pathname !== '/admin/song-lines'
  const isSlangActive = location.pathname === '/admin/slang' || location.pathname.startsWith('/admin/slang/')
  const isSlangDeepDive = location.pathname.startsWith('/admin/slang/') && location.pathname !== '/admin/slang'

  // Get current page name for breadcrumb
  const currentPage = isLemmaDeepDive ? 'Lemma Details'
    : isLemmasActive ? 'Lemmas'
    : isPhraseDeepDive ? 'Phrase Details'
    : isPhrasesActive ? 'Phrases'
    : isSentenceDeepDive ? 'Sentence Details'
    : isSentencesActive ? 'Sentences'
    : isSongDeepDive ? 'Song Details'
    : isSongsActive ? 'Songs'
    : isLineDeepDive ? 'Line Details'
    : isLinesActive ? 'Lines'
    : isSlangDeepDive ? 'Slang Details'
    : isSlangActive ? 'Slang'
    : 'Dashboard'

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Main App Header */}
      <DashboardHeader
        streak={headerData.streak}
        username={headerData.username}
        loading={headerData.loading}
        isAdmin={true}
      />

      {/* Admin Header - Notion style */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row: Breadcrumb + Back link */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Link to="/admin" className="hover:text-neutral-700">Admin</Link>
              {currentPage !== 'Dashboard' && (
                <>
                  <span>/</span>
                  <span className="text-neutral-900">{currentPage}</span>
                </>
              )}
            </div>
            <Link
              to="/"
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
            >
              ← Dashboard
            </Link>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-neutral-900">
            {currentPage === 'Dashboard' ? 'Admin Dashboard' : currentPage}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {currentPage === 'Dashboard' && 'Manage vocabulary and system settings'}
            {currentPage === 'Lemmas' && 'Manage lemmas, definitions, and stop words'}
            {currentPage === 'Lemma Details' && 'Complete lemma breakdown with words, occurrences, and phrases'}
            {currentPage === 'Phrases' && 'Manage multi-word expressions, idioms, and collocations'}
            {currentPage === 'Phrase Details' && 'Complete phrase breakdown with definitions and occurrences'}
            {currentPage === 'Sentences' && 'Edit sentences, fragments, and translations'}
            {currentPage === 'Sentence Details' && 'Complete sentence breakdown with words, lemmas, and phrases'}
            {currentPage === 'Songs' && 'Manage songs for lyrics-based learning'}
            {currentPage === 'Song Details' && 'Edit song metadata, sections, and linked slang'}
            {currentPage === 'Lines' && 'Review song lines, translations, and vocabulary'}
            {currentPage === 'Line Details' && 'Edit line translation and view linked vocabulary'}
            {currentPage === 'Slang' && 'Manage slang terms, definitions, and cultural context'}
            {currentPage === 'Slang Details' && 'Edit slang term details and view linked songs'}
          </p>
        </div>
      </header>

      {/* Navigation Tabs - Notion style */}
      <nav className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <Link
              to="/admin/common-words"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isLemmasActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Lemmas
            </Link>
            <Link
              to="/admin/phrases"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isPhrasesActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Phrases
            </Link>
            <Link
              to="/admin/sentences"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSentencesActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Sentences
            </Link>
            <div className="border-l border-neutral-200 mx-2" />
            <Link
              to="/admin/songs"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSongsActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Songs
            </Link>
            <Link
              to="/admin/song-lines"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isLinesActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Lines
            </Link>
            <Link
              to="/admin/slang"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSlangActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Slang
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {location.pathname === '/admin' ? (
          // Default admin home
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to="/admin/common-words"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Lemmas
              </h3>
              <p className="text-sm text-neutral-500">
                Manage lemmas, definitions, and stop words
              </p>
            </Link>

            <Link
              to="/admin/phrases"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Phrases
              </h3>
              <p className="text-sm text-neutral-500">
                Manage multi-word expressions, idioms, and collocations
              </p>
            </Link>

            <Link
              to="/admin/sentences"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Sentences
              </h3>
              <p className="text-sm text-neutral-500">
                Edit sentences, fragments, translations, and paragraph breaks
              </p>
            </Link>

            <Link
              to="/admin/songs"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Songs
              </h3>
              <p className="text-sm text-neutral-500">
                Manage songs for lyrics-based vocabulary learning
              </p>
            </Link>

            <Link
              to="/admin/slang"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Slang
              </h3>
              <p className="text-sm text-neutral-500">
                Manage slang terms, definitions, and cultural context
              </p>
            </Link>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
