/**
 * ActiveContentCards - Shows active book and song with quick access
 *
 * Features:
 * - Card for active book (progress, Review/Learn buttons)
 * - Card for active song (progress, Review/Learn buttons)
 * - If no active content, show "Browse" CTAs
 * - Links to Library for browsing more content
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Book, Music, ArrowRight, RotateCcw, Plus } from 'lucide-react'
import { getBookProgress, getSongProgress } from '../../services/progressService'

export default function ActiveContentCards({
  loading: parentLoading = false,
  activeBookId: propBookId = null,
  activeSongId: propSongId = null
}) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeBook, setActiveBook] = useState(null)
  const [activeSong, setActiveSong] = useState(null)
  const [bookProgress, setBookProgress] = useState({
    current: 0, total: 27, percent: 0,
    mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0,
    dueCount: 0, wordsToUnlock: 0
  })
  const [songProgress, setSongProgress] = useState({
    sections: 0, percent: 0,
    mastered: 0, familiar: 0, learning: 0, notSeen: 0, totalVocab: 0,
    dueCount: 0, newCount: 0
  })

  const fetchActiveContent = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const bookId = propBookId
      const songId = propSongId

      // Fetch book data
      if (bookId) {
        const [bookInfo, bookProgressData] = await Promise.all([
          supabase.from('books').select('book_id, title, author, total_chapters').eq('book_id', bookId).single(),
          getBookProgress(user.id, bookId)
        ])

        if (bookInfo.data) {
          setActiveBook(bookInfo.data)
        }

        if (bookProgressData) {
          setBookProgress({
            current: bookProgressData.currentChapter,
            total: bookProgressData.totalChapters,
            percent: bookProgressData.totalVocab > 0
              ? Math.round(((bookProgressData.mastered + bookProgressData.familiar + bookProgressData.learning) / bookProgressData.totalVocab) * 100)
              : 0,
            mastered: bookProgressData.mastered,
            familiar: bookProgressData.familiar,
            learning: bookProgressData.learning,
            notSeen: bookProgressData.notSeen,
            totalVocab: bookProgressData.totalVocab,
            dueCount: bookProgressData.dueCount,
            wordsToUnlock: bookProgressData.newCount
          })
        }
      } else {
        // Try to get first available book
        const { data: firstBook } = await supabase
          .from('books')
          .select('book_id, title, author, total_chapters')
          .limit(1)
          .single()

        if (firstBook) {
          setActiveBook(firstBook)
          setBookProgress({ current: 1, total: firstBook.total_chapters || 27, percent: 0 })
        }
      }

      // Fetch song data
      if (songId) {
        const [songInfo, songProgressData] = await Promise.all([
          supabase.from('songs').select('song_id, title, artist').eq('song_id', songId).single(),
          getSongProgress(user.id, songId)
        ])

        if (songInfo.data) {
          setActiveSong(songInfo.data)
        }

        if (songProgressData) {
          setSongProgress({
            sections: songProgressData.sections,
            percent: songProgressData.totalVocab > 0
              ? Math.round(((songProgressData.mastered + songProgressData.familiar + songProgressData.learning) / songProgressData.totalVocab) * 100)
              : 0,
            mastered: songProgressData.mastered,
            familiar: songProgressData.familiar,
            learning: songProgressData.learning,
            notSeen: songProgressData.notSeen,
            totalVocab: songProgressData.totalVocab,
            dueCount: songProgressData.dueCount,
            newCount: songProgressData.newCount
          })
        }
      }
    } catch (error) {
      console.error('Error fetching active content:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, propBookId, propSongId])

  useEffect(() => {
    fetchActiveContent()
  }, [fetchActiveContent])

  const isLoading = loading || parentLoading

  if (isLoading) {
    return (
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-36 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-neutral-100 rounded-xl animate-pulse" />
          <div className="h-40 bg-neutral-100 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">Currently Learning</h2>
        <Link
          to="/library"
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          View Library
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Book Card */}
        {activeBook ? (
          <div
            onClick={() => navigate(`/book/${activeBook.book_id}`)}
            className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fdf8f0' }}>
                <Book style={{ color: '#b8862f' }} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 truncate">{activeBook.title}</h3>
                {activeBook.author && (
                  <p className="text-sm text-neutral-500 truncate">{activeBook.author}</p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  Chapter {bookProgress.current} of {bookProgress.total}
                </p>
              </div>
            </div>

            {/* Segmented Progress bar - 4 levels */}
            <div className="mt-4">
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                {bookProgress.totalVocab > 0 && (
                  <>
                    {/* Mastered - darkest amber */}
                    {bookProgress.mastered > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.mastered / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#92400e'
                        }}
                      />
                    )}
                    {/* Familiar - medium amber */}
                    {bookProgress.familiar > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.familiar / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#b8862f'
                        }}
                      />
                    )}
                    {/* Learning - light amber */}
                    {bookProgress.learning > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(bookProgress.learning / bookProgress.totalVocab) * 100}%`,
                          backgroundColor: '#fbbf24'
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">{bookProgress.percent}%</span>
                <span className="text-xs text-neutral-400">{(bookProgress.totalVocab || 0).toLocaleString()} words</span>
              </div>
            </div>

            {/* Action Buttons - Two buttons side by side */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {/* Review Due Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/flashcards?mode=review&bookId=${activeBook.book_id}`)
                }}
                disabled={bookProgress.dueCount === 0}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  bookProgress.dueCount > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                }`}
              >
                <RotateCcw size={14} />
                Review ({bookProgress.dueCount})
              </button>

              {/* Learn New Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/flashcards?mode=learn&bookId=${activeBook.book_id}`)
                }}
                disabled={bookProgress.wordsToUnlock === 0}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  bookProgress.wordsToUnlock > 0
                    ? 'text-white hover:opacity-90'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                }`}
                style={bookProgress.wordsToUnlock > 0 ? { backgroundColor: '#b8862f' } : {}}
              >
                <Plus size={14} />
                Learn ({bookProgress.wordsToUnlock})
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-xl p-6 text-center">
            <Book className="mx-auto text-neutral-300 mb-2" size={32} />
            <p className="text-neutral-500 text-sm mb-3">No book selected</p>
            <Link
              to="/library"
              className="text-primary-500 hover:underline text-sm font-medium"
            >
              Browse Books
            </Link>
          </div>
        )}

        {/* Active Song Card */}
        {activeSong ? (
          <div
            onClick={() => navigate(`/song/${activeSong.song_id}`)}
            className="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#f4f2f7' }}>
                <Music style={{ color: '#6f5d8a' }} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 truncate">{activeSong.title}</h3>
                {activeSong.artist && (
                  <p className="text-sm text-neutral-500 truncate">{activeSong.artist}</p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {songProgress.sections} sections
                </p>
              </div>
            </div>

            {/* Segmented Progress bar - 4 levels (purple shades) */}
            <div className="mt-4">
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                {songProgress.totalVocab > 0 && (
                  <>
                    {/* Mastered - darkest purple */}
                    {songProgress.mastered > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.mastered / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#4c1d95'
                        }}
                      />
                    )}
                    {/* Familiar - medium purple */}
                    {songProgress.familiar > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.familiar / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#6f5d8a'
                        }}
                      />
                    )}
                    {/* Learning - light purple */}
                    {songProgress.learning > 0 && (
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(songProgress.learning / songProgress.totalVocab) * 100}%`,
                          backgroundColor: '#a78bfa'
                        }}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">{songProgress.percent}%</span>
                <span className="text-xs text-neutral-400">{songProgress.totalVocab} items</span>
              </div>
            </div>

            {/* Action Buttons - Two buttons side by side */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {/* Review Due Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/flashcards?mode=song&songId=${activeSong.song_id}`)
                }}
                disabled={songProgress.dueCount === 0}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  songProgress.dueCount > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                }`}
              >
                <RotateCcw size={14} />
                Review ({songProgress.dueCount})
              </button>

              {/* Learn New Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/flashcards?mode=song&songId=${activeSong.song_id}&learnOnly=true`)
                }}
                disabled={songProgress.newCount === 0}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  songProgress.newCount > 0
                    ? 'text-white hover:opacity-90'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                }`}
                style={songProgress.newCount > 0 ? { backgroundColor: '#6f5d8a' } : {}}
              >
                <Plus size={14} />
                Learn ({songProgress.newCount})
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-xl p-6 text-center">
            <Music className="mx-auto text-neutral-300 mb-2" size={32} />
            <p className="text-neutral-500 text-sm mb-3">No song selected</p>
            <Link
              to="/library"
              className="text-primary-500 hover:underline text-sm font-medium"
            >
              Browse Songs
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
