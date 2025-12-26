/**
 * Library - Browse all available content (books, songs)
 *
 * Features:
 * - Tabs: Books | Songs
 * - Grid of content cards
 * - Shows progress per item
 * - "Active" badge on current selections
 * - Click card → go to that content's dashboard
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Book,
  Music,
  Search,
  Check,
  Lock
} from 'lucide-react'

export default function Library() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('books')
  const [loading, setLoading] = useState(true)
  const [books, setBooks] = useState([])
  const [songs, setSongs] = useState([])
  const [activeBookId, setActiveBookId] = useState(null)
  const [activeSongId, setActiveSongId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bookProgress, setBookProgress] = useState({}) // { bookId: { currentChapter, totalChapters, percent } }
  const [songProgress, setSongProgress] = useState({}) // { songId: { learned, total, percent } }

  const fetchData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Fetch all data in parallel
      const [booksResult, songsResult, settingsResult] = await Promise.all([
        supabase.from('books').select('book_id, title, author, total_chapters'),
        supabase.from('songs').select('song_id, title, artist, dialect, is_published'),
        supabase.from('user_settings').select('active_book_id, active_song_id').eq('user_id', user.id).maybeSingle()
      ])

      // Debug logging
      console.log('[Library] Books query result:', booksResult)
      console.log('[Library] Songs query result:', songsResult)
      console.log('[Library] Settings query result:', settingsResult)

      if (booksResult.error) console.error('[Library] Books error:', booksResult.error)
      if (songsResult.error) console.error('[Library] Songs error:', songsResult.error)

      if (booksResult.data) setBooks(booksResult.data)
      if (songsResult.data) setSongs(songsResult.data.filter(s => s.is_published))

      if (settingsResult.data) {
        setActiveBookId(settingsResult.data.active_book_id)
        setActiveSongId(settingsResult.data.active_song_id)
      }

      // Fetch book progress based on vocabulary mastery
      if (booksResult.data?.length > 0) {
        // Get all lemmas for each book (via chapters → sentences → words → lemmas)
        // For simplicity, we'll use the user's overall vocabulary progress
        const { data: lemmaProgress } = await supabase
          .from('user_lemma_progress')
          .select('lemma_id, mastery_level, reps')
          .eq('user_id', user.id)

        if (lemmaProgress && lemmaProgress.length > 0) {
          // Count mastered (80+) and familiar (50+) as "learned"
          const learnedCount = lemmaProgress.filter(p => p.mastery_level >= 50 || p.reps > 0).length
          const totalLemmas = lemmaProgress.length

          // For now, apply same progress to all books (since vocab is shared)
          // In future, we could filter by book-specific lemmas
          const progressMap = {}
          booksResult.data.forEach(book => {
            progressMap[book.book_id] = {
              learned: learnedCount,
              total: totalLemmas,
              percent: totalLemmas > 0 ? Math.round((learnedCount / totalLemmas) * 100) : 0
            }
          })
          setBookProgress(progressMap)
        }
      }

      // Fetch song vocabulary progress (count learned words per song)
      if (songsResult.data?.length > 0) {
        const publishedSongIds = songsResult.data.filter(s => s.is_published).map(s => s.song_id)

        if (publishedSongIds.length > 0) {
          // Get total vocab counts per song
          const [lemmasResult, phrasesResult, slangResult] = await Promise.all([
            supabase.from('song_lemmas').select('song_id, lemma_id').in('song_id', publishedSongIds),
            supabase.from('song_phrases').select('song_id, phrase_id').in('song_id', publishedSongIds),
            supabase.from('song_slang').select('song_id, slang_id').in('song_id', publishedSongIds)
          ])

          // Count total vocab per song
          const vocabCounts = {}
          ;[lemmasResult.data, phrasesResult.data, slangResult.data]
            .filter(Boolean)
            .flat()
            .forEach(item => {
              const songId = item.song_id
              vocabCounts[songId] = (vocabCounts[songId] || 0) + 1
            })

          // Get user progress for these items
          const [lemmaProgress, phraseProgress, slangProgress] = await Promise.all([
            supabase.from('user_lemma_progress').select('lemma_id').eq('user_id', user.id).gt('reps', 0),
            supabase.from('user_phrase_progress').select('phrase_id').eq('user_id', user.id).gt('reps', 0),
            supabase.from('user_slang_progress').select('slang_id').eq('user_id', user.id).gt('reps', 0)
          ])

          // Build sets of learned item IDs
          const learnedLemmas = new Set((lemmaProgress.data || []).map(p => p.lemma_id))
          const learnedPhrases = new Set((phraseProgress.data || []).map(p => p.phrase_id))
          const learnedSlang = new Set((slangProgress.data || []).map(p => p.slang_id))

          // Calculate learned counts per song
          const progressMap = {}
          publishedSongIds.forEach(songId => {
            const songLemmas = (lemmasResult.data || []).filter(l => l.song_id === songId)
            const songPhrases = (phrasesResult.data || []).filter(p => p.song_id === songId)
            const songSlang = (slangResult.data || []).filter(s => s.song_id === songId)

            const learned = songLemmas.filter(l => learnedLemmas.has(l.lemma_id)).length +
                           songPhrases.filter(p => learnedPhrases.has(p.phrase_id)).length +
                           songSlang.filter(s => learnedSlang.has(s.slang_id)).length

            const total = vocabCounts[songId] || 0
            progressMap[songId] = {
              learned,
              total,
              percent: total > 0 ? Math.round((learned / total) * 100) : 0
            }
          })
          setSongProgress(progressMap)
        }
      }
    } catch (error) {
      console.error('Error fetching library data:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSetActive(type, id) {
    try {
      const updateData = type === 'book'
        ? { active_book_id: id }
        : { active_song_id: id }

      const { data: existing } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('user_settings')
          .update(updateData)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_settings')
          .insert({ user_id: user.id, ...updateData })
      }

      if (type === 'book') {
        setActiveBookId(id)
      } else {
        setActiveSongId(id)
      }
    } catch (error) {
      console.error('Error setting active content:', error)
    }
  }

  // Filter content by search query
  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (song.artist && song.artist.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-neutral-400">Loading library...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-neutral-900">Library</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'books'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Book size={18} />
            Books ({filteredBooks.length})
          </button>
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'songs'
                ? 'border-purple-500 text-purple-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Music size={18} />
            Songs ({filteredSongs.length})
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'books' && filteredBooks.map(book => (
            <ContentCard
              key={book.book_id}
              type="book"
              id={book.book_id}
              title={book.title}
              subtitle={book.author}
              meta={`A2-B1 · ${book.total_chapters || 27} chapters`}
              isActive={book.book_id === activeBookId}
              isAvailable={true}
              progress={bookProgress[book.book_id]}
              onNavigate={() => navigate(`/book/${book.book_id}`)}
              onSetActive={() => handleSetActive('book', book.book_id)}
            />
          ))}

          {activeTab === 'songs' && filteredSongs.map(song => (
            <ContentCard
              key={song.song_id}
              type="song"
              id={song.song_id}
              title={song.title}
              subtitle={song.artist}
              meta={song.dialect || 'Latin America'}
              isActive={song.song_id === activeSongId}
              isAvailable={true}
              progress={songProgress[song.song_id]}
              onNavigate={() => navigate(`/song/${song.song_id}`)}
              onSetActive={() => handleSetActive('song', song.song_id)}
            />
          ))}

          {/* Empty states */}
          {activeTab === 'books' && filteredBooks.length === 0 && (
            <div className="col-span-full text-center py-12 text-neutral-500">
              {searchQuery ? 'No books match your search' : 'No books available'}
            </div>
          )}

          {activeTab === 'songs' && filteredSongs.length === 0 && (
            <div className="col-span-full text-center py-12 text-neutral-500">
              {searchQuery ? 'No songs match your search' : 'No songs available'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContentCard({ type, id, title, subtitle, meta, isActive, isAvailable, progress, onNavigate, onSetActive }) {
  const isBook = type === 'book'
  const Icon = isBook ? Book : Music

  // Use explicit classes for Tailwind JIT to work
  const activeClasses = isBook
    ? 'border-amber-300 ring-2 ring-amber-100'
    : 'border-purple-300 ring-2 ring-purple-100'

  const iconColor = isBook ? 'text-amber-500' : 'text-purple-500'

  const badgeClasses = isBook
    ? 'bg-amber-100 text-amber-700'
    : 'bg-purple-100 text-purple-700'

  const progressBarColor = isBook ? 'bg-amber-500' : 'bg-purple-500'
  const progressBgColor = isBook ? 'bg-amber-100' : 'bg-purple-100'

  // Format progress label
  const progressLabel = progress
    ? `${progress.learned}/${progress.total} words`
    : null

  return (
    <div
      className={`bg-white border rounded-xl p-5 transition-all ${
        isActive
          ? activeClasses
          : 'border-neutral-200 hover:border-neutral-300'
      } ${isAvailable ? 'cursor-pointer hover:shadow-md' : 'opacity-60'}`}
      onClick={isAvailable ? onNavigate : undefined}
    >
      {/* Icon */}
      <div className={`text-3xl mb-3 ${iconColor}`}>
        <Icon size={32} />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-neutral-900 mb-1 truncate">{title}</h3>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-sm text-neutral-500 mb-2 truncate">{subtitle}</p>
      )}

      {/* Meta info */}
      <p className="text-xs text-neutral-400 mb-3">{meta}</p>

      {/* Progress bar */}
      {progress && progress.percent > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-neutral-500">{progressLabel}</span>
            <span className="text-xs font-medium text-neutral-700">{progress.percent}%</span>
          </div>
          <div className={`h-1.5 rounded-full ${progressBgColor}`}>
            <div
              className={`h-1.5 rounded-full ${progressBarColor} transition-all`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Status badges and actions */}
      <div className="flex items-center justify-between">
        {isActive ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badgeClasses}`}>
            <Check size={12} />
            Active
          </span>
        ) : isAvailable ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSetActive()
            }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Set as Active
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
            <Lock size={12} />
            Coming Soon
          </span>
        )}
      </div>
    </div>
  )
}
