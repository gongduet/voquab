/**
 * ContentSwitcher - Dropdown for switching active book/song
 *
 * Features:
 * - Shows current active content
 * - Dropdown with books and songs sections
 * - Clicking sets as active AND navigates
 * - "Browse Library" link
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Book, Music, ChevronDown, Library, Check } from 'lucide-react'

export default function ContentSwitcher() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeBook, setActiveBook] = useState(null)
  const [activeSong, setActiveSong] = useState(null)
  const [books, setBooks] = useState([])
  const [songs, setSongs] = useState([])
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch content and user settings
  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  async function fetchData() {
    setLoading(true)
    try {
      // First get user settings to know active language
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('active_book_id, active_song_id, active_language')
        .eq('user_id', user.id)
        .maybeSingle()

      const userLanguage = settingsData?.active_language || 'es'

      // Fetch books and songs filtered by active language
      const [booksResult, songsResult] = await Promise.all([
        supabase
          .from('books')
          .select('book_id, title, author, language_code')
          .eq('language_code', userLanguage),
        supabase
          .from('songs')
          .select('song_id, title, artist, language_code')
          .eq('is_published', true)
          .eq('language_code', userLanguage)
      ])

      const filteredBooks = booksResult.data || []
      const filteredSongs = songsResult.data || []

      setBooks(filteredBooks)
      setSongs(filteredSongs)

      // Set active content
      if (settingsData) {
        const activeBookData = filteredBooks.find(b => b.book_id === settingsData.active_book_id)
        const activeSongData = filteredSongs.find(s => s.song_id === settingsData.active_song_id)
        setActiveBook(activeBookData || filteredBooks[0] || null)
        setActiveSong(activeSongData || null)
      } else {
        // No settings yet, default to first book
        setActiveBook(filteredBooks[0] || null)
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectContent(type, id) {
    setIsOpen(false)

    try {
      // Update user settings
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

      // Update local state
      if (type === 'book') {
        const book = books.find(b => b.book_id === id)
        setActiveBook(book)
      } else {
        const song = songs.find(s => s.song_id === id)
        setActiveSong(song)
      }

      // Navigate to content dashboard
      navigate(`/${type}/${id}`)
    } catch (error) {
      console.error('Error setting active content:', error)
    }
  }

  // Display text for the current selection
  const displayText = activeBook?.title || 'Select Content'

  if (loading) {
    return (
      <div className="w-32 h-8 bg-neutral-100 rounded-lg animate-pulse" />
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button - minimal style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-sm font-medium text-neutral-600"
      >
        <Book size={15} className="text-amber-600" />
        <span className="max-w-[100px] truncate">{displayText}</span>
        <ChevronDown size={12} className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu - aligned to right */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50">
          {/* Books section */}
          {books.length > 0 && (
            <div className="px-3 py-1">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Books</div>
              {books.map(book => (
                <button
                  key={book.book_id}
                  onClick={() => handleSelectContent('book', book.book_id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeBook?.book_id === book.book_id
                      ? 'bg-amber-50 text-amber-800'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <Book size={16} className={activeBook?.book_id === book.book_id ? 'text-amber-600' : 'text-neutral-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{book.title}</div>
                    {book.author && (
                      <div className="text-xs text-neutral-500 truncate">{book.author}</div>
                    )}
                  </div>
                  {activeBook?.book_id === book.book_id && (
                    <Check size={14} className="text-amber-600" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Songs section */}
          {songs.length > 0 && (
            <div className="px-3 py-1 border-t border-neutral-100 mt-1 pt-2">
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Songs</div>
              {songs.map(song => (
                <button
                  key={song.song_id}
                  onClick={() => handleSelectContent('song', song.song_id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeSong?.song_id === song.song_id
                      ? 'bg-purple-50 text-purple-800'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <Music size={16} className={activeSong?.song_id === song.song_id ? 'text-purple-600' : 'text-neutral-400'} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{song.title}</div>
                    {song.artist && (
                      <div className="text-xs text-neutral-500 truncate">{song.artist}</div>
                    )}
                  </div>
                  {activeSong?.song_id === song.song_id && (
                    <Check size={14} className="text-purple-600" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Browse Library link */}
          <div className="px-3 pt-2 mt-1 border-t border-neutral-100">
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/library')
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-neutral-50 text-primary-600 transition-colors"
            >
              <Library size={16} />
              <span className="font-medium">Browse Library</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
