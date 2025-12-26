/**
 * BookDashboard - Deep dive into specific book progress
 *
 * Features:
 * - Book completion percentage
 * - Vocabulary from this book (mastered/familiar/learning/not seen)
 * - Chapter progress cards
 * - Review/Learn New actions for this book
 * - Continue Reading button
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Book,
  BookOpen,
  GraduationCap,
  Play,
  MoreVertical,
  Check,
  Lock
} from 'lucide-react'

export default function BookDashboard() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState(null)
  const [chapters, setChapters] = useState([])
  const [stats, setStats] = useState({
    masteredCount: 0,
    familiarCount: 0,
    learningCount: 0,
    notSeenCount: 0,
    totalLemmas: 0,
    completionPercent: 0,
    dueCount: 0,
    newAvailable: 0
  })
  const [readingProgress, setReadingProgress] = useState(null)

  const fetchData = useCallback(async () => {
    if (!user?.id || !bookId) return

    setLoading(true)
    try {
      // Fetch book info
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('book_id', bookId)
        .single()

      if (bookError) throw bookError
      setBook(bookData)

      // Fetch chapters
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookId)
        .order('chapter_number')

      setChapters(chaptersData || [])

      // Fetch reading progress from user_book_reading_progress
      const { data: progressData } = await supabase
        .from('user_book_reading_progress')
        .select(`
          current_sentence_id,
          furthest_sentence_id,
          sentences:current_sentence_id (
            chapter_id,
            chapters:chapter_id (
              chapter_number
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle()

      // Extract chapter number from the joined data
      const currentChapterNum = progressData?.sentences?.chapters?.chapter_number || 1
      setReadingProgress({ chapter_number: currentChapterNum })

      // Get all lemma IDs that appear in this book's chapters
      // via: chapters → sentences → words → lemmas
      const chapterIds = chaptersData?.map(ch => ch.chapter_id) || []

      if (chapterIds.length > 0) {
        // Get unique lemma IDs for this book
        const { data: bookWords } = await supabase
          .from('words')
          .select(`
            lemma_id,
            sentences!inner (
              chapter_id
            )
          `)
          .in('sentences.chapter_id', chapterIds)
          .not('lemma_id', 'is', null)

        // Get unique lemma IDs
        const bookLemmaIds = [...new Set((bookWords || []).map(w => w.lemma_id))]
        const totalBookLemmas = bookLemmaIds.length

        // Fetch user progress for these specific lemmas
        let lemmaProgress = []
        if (bookLemmaIds.length > 0) {
          const { data } = await supabase
            .from('user_lemma_progress')
            .select('lemma_id, mastery_level, due_date, reps')
            .eq('user_id', user.id)
            .in('lemma_id', bookLemmaIds)
          lemmaProgress = data || []
        }

        // Create a map for quick lookup
        const progressMap = new Map(lemmaProgress.map(p => [p.lemma_id, p]))

        // Calculate stats
        const now = new Date()
        let mastered = 0, familiar = 0, learning = 0, notSeen = 0
        let dueCount = 0, newAvailable = 0

        bookLemmaIds.forEach(lemmaId => {
          const p = progressMap.get(lemmaId)
          if (!p || p.reps === 0) {
            notSeen++
            newAvailable++
          } else if (p.mastery_level >= 80) {
            mastered++
            if (new Date(p.due_date) <= now) dueCount++
          } else if (p.mastery_level >= 50) {
            familiar++
            if (new Date(p.due_date) <= now) dueCount++
          } else {
            learning++
            if (new Date(p.due_date) <= now) dueCount++
          }
        })

        // Calculate completion percent based on mastered + familiar / total
        const completionPercent = totalBookLemmas > 0
          ? Math.round(((mastered + familiar) / totalBookLemmas) * 100)
          : 0

        setStats({
          masteredCount: mastered,
          familiarCount: familiar,
          learningCount: learning,
          notSeenCount: notSeen,
          totalLemmas: totalBookLemmas,
          completionPercent,
          dueCount,
          newAvailable
        })
      }

    } catch (error) {
      console.error('Error fetching book data:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, bookId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-neutral-400">Loading book...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
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

  const currentChapter = readingProgress?.chapter_number || 1

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/library')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#37352f' }}>
                <Book style={{ color: '#b8862f' }} size={28} />
                {book.title}
              </h1>
              {book.author && (
                <p className="text-sm text-neutral-500">{book.author}</p>
              )}
            </div>
          </div>
          <button className="p-2 hover:bg-neutral-100 rounded-lg">
            <MoreVertical size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Progress Circle */}
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-4" style={{ backgroundColor: '#fefdfb', borderColor: '#faecd8' }}>
            <div>
              <div className="text-3xl font-bold" style={{ color: '#b8862f' }}>{stats.completionPercent}%</div>
              <div className="text-xs" style={{ color: '#956b25' }}>Complete</div>
            </div>
          </div>

          {/* Vocabulary Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#1e40af' }}>{stats.masteredCount}</div>
              <div className="text-xs text-neutral-500 uppercase">Mastered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#2563eb' }}>{stats.familiarCount}</div>
              <div className="text-xs text-neutral-500 uppercase">Familiar</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: '#93c5fd' }}>{stats.learningCount}</div>
              <div className="text-xs text-neutral-500 uppercase">Learning</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-400">{stats.notSeenCount}</div>
              <div className="text-xs text-neutral-500 uppercase">Not Seen</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate(`/flashcards?bookId=${bookId}&mode=review`)}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <GraduationCap style={{ color: '#2563eb' }} size={24} />
            <div className="text-left">
              <div className="font-medium" style={{ color: '#37352f' }}>Review</div>
              <div className="text-sm text-neutral-500">{stats.dueCount} due</div>
            </div>
          </button>

          <button
            onClick={() => navigate(`/flashcards?bookId=${bookId}&mode=learn`)}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <Play style={{ color: '#22c55e' }} size={24} />
            <div className="text-left">
              <div className="font-medium" style={{ color: '#37352f' }}>Learn New</div>
              <div className="text-sm text-neutral-500">{stats.newAvailable} available</div>
            </div>
          </button>
        </div>

        {/* Continue Reading */}
        <button
          onClick={() => navigate(`/book/${bookId}/read/${currentChapter}`)}
          className="w-full flex items-center justify-center gap-3 p-5 text-white rounded-xl transition-colors"
          style={{ backgroundColor: '#b8862f' }}
        >
          <BookOpen size={24} />
          <div className="text-left">
            <div className="font-semibold">Continue Reading</div>
            <div className="text-sm" style={{ opacity: 0.85 }}>
              Chapter {currentChapter} of {chapters.length}
            </div>
          </div>
        </button>

        {/* Chapters Grid */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: '#37352f' }}>Chapters</h2>
            <span className="text-sm text-neutral-500">
              {currentChapter} of {chapters.length}
            </span>
          </div>
          <div className="p-4 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2">
            {chapters.map((chapter) => {
              const isCompleted = chapter.chapter_number < currentChapter
              const isCurrent = chapter.chapter_number === currentChapter
              const isLocked = chapter.chapter_number > currentChapter + 1
              const isNext = chapter.chapter_number === currentChapter + 1

              return (
                <button
                  key={chapter.chapter_id}
                  onClick={() => !isLocked && navigate(`/book/${bookId}/read/${chapter.chapter_number}`)}
                  disabled={isLocked}
                  className="aspect-square rounded-lg flex items-center justify-center font-medium text-sm transition-all relative"
                  style={{
                    backgroundColor: isCompleted ? '#dcfce7' : isCurrent ? '#b8862f' : isNext ? '#fdf8f0' : isLocked ? '#fafafa' : '#f5f5f5',
                    color: isCompleted ? '#15803d' : isCurrent ? 'white' : isNext ? '#956b25' : isLocked ? '#d4d4d4' : '#525252',
                    boxShadow: isCurrent ? '0 0 0 2px #faecd8' : 'none',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    border: isNext ? '1px dashed #e5bc7a' : 'none'
                  }}
                >
                  {isCompleted ? (
                    <Check size={16} />
                  ) : isLocked ? (
                    <Lock size={14} />
                  ) : (
                    chapter.chapter_number
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="px-4 pb-4 flex items-center justify-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#dcfce7' }}></span>
              Complete
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#b8862f' }}></span>
              Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded border border-dashed" style={{ borderColor: '#e5bc7a', backgroundColor: '#fdf8f0' }}></span>
              Next
            </span>
            <span className="flex items-center gap-1">
              <Lock size={10} className="text-neutral-300" />
              Locked
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
