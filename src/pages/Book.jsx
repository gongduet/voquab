import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import ChapterCard from '../components/ChapterCard'
import ChapterUnlockModal from '../components/ChapterUnlockModal'

export default function Book() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [chapters, setChapters] = useState([])
  const [chapterProgress, setChapterProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [unlockedChapter, setUnlockedChapter] = useState(null)

  useEffect(() => {
    if (user) {
      fetchChaptersAndProgress()
    }
  }, [user])

  async function fetchChaptersAndProgress() {
    try {
      // Fetch all chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .order('chapter_number')

      if (chaptersError) throw chaptersError

      // Fetch user's chapter progress
      const { data: progressData, error: progressError } = await supabase
        .from('user_chapter_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('chapter_id')

      if (progressError) throw progressError

      // If no progress exists, initialize it
      if (!progressData || progressData.length === 0) {
        await initializeChapterProgress(user.id, chaptersData)
        // Refetch after initialization
        const { data: newProgressData } = await supabase
          .from('user_chapter_progress')
          .select('*')
          .eq('user_id', user.id)
          .order('chapter_id')

        if (newProgressData) {
          const progressMap = {}
          newProgressData.forEach(p => {
            progressMap[p.chapter_id] = p
          })
          setChapterProgress(progressMap)
        }
      } else {
        const progressMap = {}
        progressData.forEach(p => {
          progressMap[p.chapter_id] = p
        })
        setChapterProgress(progressMap)
      }

      setChapters(chaptersData || [])
      setLoading(false)
    } catch (err) {
      console.error('Error fetching chapters:', err)
      setLoading(false)
    }
  }

  async function initializeChapterProgress(userId, chaptersData) {
    const initialProgress = chaptersData.map(ch => ({
      user_id: userId,
      chapter_id: ch.chapter_id,
      is_unlocked: ch.chapter_number === 1,
      unlocked_at: ch.chapter_number === 1 ? new Date().toISOString() : null,
      words_encountered: 0,
      total_chapter_words: 0,
      total_reviews: 0,
      average_mastery: 0,
      unlock_progress: 0
    }))

    await supabase
      .from('user_chapter_progress')
      .insert(initialProgress)

    // Update total_chapter_words for each chapter
    for (const ch of chaptersData) {
      // Get sentences for this chapter
      const { data: sentences } = await supabase
        .from('sentences')
        .select('sentence_id')
        .eq('chapter_id', ch.chapter_id)

      if (sentences && sentences.length > 0) {
        const sentenceIds = sentences.map(s => s.sentence_id)

        // Get unique lemma count from words in these sentences
        const { data: words } = await supabase
          .from('words')
          .select('lemma_id')
          .in('sentence_id', sentenceIds)

        const uniqueLemmaCount = words ? new Set(words.map(w => w.lemma_id)).size : 0

        await supabase
          .from('user_chapter_progress')
          .update({ total_chapter_words: uniqueLemmaCount })
          .eq('user_id', userId)
          .eq('chapter_id', ch.chapter_id)
      }
    }
  }

  function getChapterStatus(chapter) {
    const progress = chapterProgress[chapter.chapter_id]
    if (!progress) {
      return {
        isUnlocked: chapter.chapter_number === 1,
        isNextToUnlock: false,
        progress: {
          words_encountered: 0,
          total_chapter_words: 0,
          total_reviews: 0,
          average_mastery: 0,
          unlock_progress: 0
        }
      }
    }

    // Check if this is the next chapter to unlock
    const unlockedChapters = Object.values(chapterProgress).filter(p => p.is_unlocked)
    const maxUnlockedChapter = Math.max(...unlockedChapters.map(p => {
      const ch = chapters.find(c => c.chapter_id === p.chapter_id)
      return ch ? ch.chapter_number : 0
    }), 1)

    const isNextToUnlock = !progress.is_unlocked && chapter.chapter_number === maxUnlockedChapter + 1

    return {
      isUnlocked: progress.is_unlocked,
      isNextToUnlock,
      progress: {
        words_encountered: progress.words_encountered || 0,
        total_chapter_words: progress.total_chapter_words || 0,
        total_reviews: progress.total_reviews || 0,
        average_mastery: progress.average_mastery || 0,
        unlock_progress: progress.unlock_progress || 0
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="text-amber-800 hover:text-amber-900 font-serif text-sm flex items-center gap-2"
            >
              ← Home
            </button>
            <h1 className="text-2xl font-serif font-bold text-amber-700">El Principito</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600 font-serif">Loading chapters...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-amber-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-amber-800 hover:text-amber-900 font-serif text-sm flex items-center gap-2"
          >
            ← Home
          </button>
          <h1 className="text-2xl font-serif font-bold text-amber-700">El Principito</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border-2 border-amber-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-6xl">📖</div>
            <div>
              <h2 className="text-3xl font-serif font-bold text-amber-800 mb-2">
                The Little Prince
              </h2>
              <p className="text-gray-600 font-serif">
                by Antoine de Saint-Exupéry
              </p>
            </div>
          </div>
          <p className="text-gray-700 font-serif leading-relaxed">
            Read this beloved classic in Spanish with English translations.
            Complete chapters to unlock new ones through quality learning (mastery)
            or dedicated practice (exposure).
          </p>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-serif font-bold text-amber-800 flex items-center gap-2">
            <span>📚</span>
            <span>Chapters</span>
          </h3>

          {chapters.map(chapter => {
            const status = getChapterStatus(chapter)
            return (
              <ChapterCard
                key={chapter.chapter_id}
                chapter={chapter}
                progress={status.progress}
                isUnlocked={status.isUnlocked}
                isNextToUnlock={status.isNextToUnlock}
              />
            )
          })}
        </div>
      </main>

      {unlockedChapter && (
        <ChapterUnlockModal
          chapter={unlockedChapter}
          onClose={() => setUnlockedChapter(null)}
          onStartReading={() => {
            navigate(`/read/${unlockedChapter.chapter_number}`)
            setUnlockedChapter(null)
          }}
        />
      )}
    </div>
  )
}
