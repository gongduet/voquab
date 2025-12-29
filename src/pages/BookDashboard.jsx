/**
 * BookDashboard - Deep dive into specific book progress
 *
 * Features:
 * - Book title and author
 * - HeroStats showing book-level mastery ring
 * - ChapterCarousel with per-chapter progress
 * - Uses RPC functions to avoid 431 errors (no huge .in() clauses)
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getBookProgress, getBookChaptersProgress } from '../services/progressService'
import { DashboardHeader, HeroStats, ChapterCarousel } from '../components/dashboard'
import { Book, ChevronLeft, BookOpen, RotateCcw, Sparkles } from 'lucide-react'

/**
 * Format date to local YYYY-MM-DD string
 */
function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate current streak from review history
 * Counts consecutive days with activity, starting from today
 */
async function calculateStreak(userId) {
  try {
    // Get reviews from last 60 days
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const { data: reviews, error } = await supabase
      .from('user_review_history')
      .select('reviewed_at')
      .eq('user_id', userId)
      .gte('reviewed_at', sixtyDaysAgo.toISOString())

    if (error || !reviews) return 0

    // Build set of dates with activity
    const activeDates = new Set()
    for (const review of reviews) {
      const dateStr = formatLocalDate(new Date(review.reviewed_at))
      activeDates.add(dateStr)
    }

    // Count consecutive days from today
    let streak = 0
    const today = new Date()

    for (let i = 0; i < 60; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() - i)
      const checkDateStr = formatLocalDate(checkDate)

      if (activeDates.has(checkDateStr)) {
        streak++
      } else {
        break
      }
    }

    return streak
  } catch (err) {
    console.error('calculateStreak failed:', err)
    return 0
  }
}

export default function BookDashboard() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [bookMeta, setBookMeta] = useState(null)
  const [bookProgress, setBookProgress] = useState(null)
  const [chapters, setChapters] = useState([])
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    if (!user?.id || !bookId) return

    async function fetchData() {
      setLoading(true)

      // Parallel fetch: book metadata, progress, chapters, streak
      const [metaResult, progress, chaptersData, streakValue] = await Promise.all([
        supabase
          .from('books')
          .select('title, author, total_chapters')
          .eq('book_id', bookId)
          .single(),
        getBookProgress(user.id, bookId),
        getBookChaptersProgress(user.id, bookId),
        calculateStreak(user.id)
      ])

      setBookMeta(metaResult.data)
      setBookProgress(progress)
      setChapters(chaptersData)
      setStreak(streakValue)
      setLoading(false)
    }

    fetchData()
  }, [user?.id, bookId])

  // Transform chapters for ChapterCarousel
  const carouselChapters = chapters.map((ch, idx) => ({
    chapter_number: ch.chapterNumber,
    title: ch.title,
    total_lemmas: ch.totalVocab, // Now includes lemmas + phrases from RPC
    introduced: ch.mastered + ch.familiar + ch.learning,
    mastered: ch.mastered,
    familiar: ch.familiar,
    learning: ch.learning,
    notSeen: ch.notSeen,
    isUnlocked: ch.isUnlocked,
    isNextToUnlock: !ch.isUnlocked && idx > 0 && chapters[idx - 1]?.isUnlocked &&
      ((chapters[idx - 1].mastered + chapters[idx - 1].familiar + chapters[idx - 1].learning) / chapters[idx - 1].totalVocab) >= 0.95
  }))

  // Find current chapter (first unlocked that's not complete)
  const currentChapterIndex = carouselChapters.findIndex(ch =>
    ch.isUnlocked && (ch.introduced / ch.total_lemmas) < 0.95
  )
  const effectiveCurrentIndex = currentChapterIndex >= 0 ? currentChapterIndex : 0

  if (!loading && !bookMeta) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Book size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500 mb-4">Book not found</p>
            <Link to="/library" className="text-primary-600 hover:underline">
              Back to Library
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <DashboardHeader
        streak={streak}
        username={user?.email?.split('@')[0] || ''}
        loading={loading}
      />

      <main className="max-w-4xl mx-auto pb-8">
        {/* Back to Dashboard */}
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ChevronLeft size={16} />
            Dashboard
          </button>
        </div>

        {/* Book Title Section */}
        <div className="px-4 pt-2 pb-2 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">
            {bookMeta?.title || 'Loading...'}
          </h1>
          {bookMeta?.author && (
            <p className="text-sm text-neutral-500 mt-1">{bookMeta.author}</p>
          )}
        </div>

        {/* Hero Stats - Book Level */}
        <HeroStats
          masteredCount={bookProgress?.mastered || 0}
          familiarCount={bookProgress?.familiar || 0}
          learningCount={bookProgress?.learning || 0}
          introducedCount={
            (bookProgress?.mastered || 0) +
            (bookProgress?.familiar || 0) +
            (bookProgress?.learning || 0)
          }
          totalCount={bookProgress?.totalVocab || 1}
          loading={loading}
        />

        {/* Quick Actions Row */}
        <div className="px-4 pt-4 flex gap-3">
          <button
            onClick={() => navigate(`/flashcards?mode=review&bookId=${bookId}`)}
            disabled={!bookProgress?.dueCount}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
              bookProgress?.dueCount
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <RotateCcw size={18} />
            Review ({bookProgress?.dueCount || 0})
          </button>

          <button
            onClick={() => navigate(`/flashcards?mode=learn&bookId=${bookId}`)}
            disabled={!bookProgress?.newCount}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
              bookProgress?.newCount
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <Sparkles size={18} />
            Learn New ({bookProgress?.newCount || 0})
          </button>
        </div>

        {/* Continue Reading Button */}
        <div className="px-4 pt-3">
          <button
            onClick={() => navigate(`/read/${bookProgress?.currentChapter || 1}`)}
            className="w-full py-3 rounded-xl border border-neutral-200 bg-white text-neutral-700 font-medium hover:bg-neutral-50 flex items-center justify-center gap-2 transition-colors"
          >
            <BookOpen size={18} />
            Continue Reading — Chapter {bookProgress?.currentChapter || 1}
          </button>
        </div>

        {/* Chapter Carousel */}
        <div className="mt-6">
          <ChapterCarousel
            chapters={carouselChapters}
            totalChapters={bookProgress?.totalChapters || bookMeta?.total_chapters || 27}
            currentChapterIndex={effectiveCurrentIndex}
            loading={loading}
          />
        </div>
      </main>
    </div>
  )
}
