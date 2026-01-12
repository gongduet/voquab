/**
 * AdminSentences - Admin page for managing sentences
 *
 * Features:
 * - Chapter dropdown filter
 * - Search by Spanish or English text
 * - Notion-style table with inline paragraph toggle
 * - Edit modal for sentence/fragment translations
 * - Keyboard shortcuts for efficiency
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SentenceTable from '../components/admin/SentenceTable'
import SentenceEditModal from '../components/admin/SentenceEditModal'
import { Search, ChevronDown, CheckCircle, Circle } from 'lucide-react'

export default function AdminSentences() {
  // URL-based state for book/chapter selection
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedBookId = searchParams.get('book') || null
  const selectedChapterId = searchParams.get('chapter') || null

  // State
  const [books, setBooks] = useState([])
  const [chapters, setChapters] = useState([])
  const [sentences, setSentences] = useState([])
  const [filteredSentences, setFilteredSentences] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReviewed, setFilterReviewed] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSentenceId, setSelectedSentenceId] = useState(null)
  const [editingSentence, setEditingSentence] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const tableRef = useRef(null)

  // Handlers - defined early so they can be used in useEffects
  const handleBookChange = useCallback((bookId) => {
    const newParams = new URLSearchParams(searchParams)
    if (bookId) {
      newParams.set('book', bookId)
    } else {
      newParams.delete('book')
    }
    newParams.delete('chapter') // Reset chapter when book changes
    setSearchParams(newParams, { replace: true })
    setSelectedSentenceId(null)
    setSearchQuery('')
  }, [searchParams, setSearchParams])

  const handleChapterChange = useCallback((chapterId) => {
    const newParams = new URLSearchParams(searchParams)
    if (chapterId) {
      newParams.set('chapter', chapterId)
    } else {
      newParams.delete('chapter')
    }
    setSearchParams(newParams, { replace: true })
    setSelectedSentenceId(null)
    setSearchQuery('')
  }, [searchParams, setSearchParams])

  const handleToggleParagraph = useCallback(async (sentenceId, newValue) => {
    console.log('Toggling paragraph for sentence:', sentenceId, 'to:', newValue)

    // Optimistic update
    setSentences(prev => prev.map(s =>
      s.sentence_id === sentenceId
        ? { ...s, is_paragraph_start: newValue }
        : s
    ))

    // Save to database
    const { data, error } = await supabase
      .from('sentences')
      .update({ is_paragraph_start: newValue })
      .eq('sentence_id', sentenceId)
      .select()

    console.log('Paragraph toggle result:', { data, error })

    if (error) {
      console.error('Error updating paragraph start:', error)
      // Revert on error
      setSentences(prev => prev.map(s =>
        s.sentence_id === sentenceId
          ? { ...s, is_paragraph_start: !newValue }
          : s
      ))
    }
  }, [])

  // Fetch books on mount
  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from('books')
        .select('book_id, title')
        .order('title')

      if (!error && data) {
        setBooks(data)
      }
    }
    fetchBooks()
  }, [])

  // Fetch chapters when book selection changes
  useEffect(() => {
    async function fetchChapters() {
      let query = supabase
        .from('chapters')
        .select('chapter_id, chapter_number, title, book_id')
        .order('chapter_number')

      if (selectedBookId) {
        query = query.eq('book_id', selectedBookId)
      }

      const { data, error } = await query

      if (!error && data) {
        setChapters(data)

        // If current chapter not in filtered list, select first chapter
        // Note: We intentionally only run this when selectedBookId changes
        if (data.length > 0 && !data.find(c => c.chapter_id === selectedChapterId)) {
          const newParams = new URLSearchParams(searchParams)
          newParams.set('chapter', data[0].chapter_id)
          setSearchParams(newParams, { replace: true })
        } else if (data.length === 0) {
          // No chapters for this book
          const newParams = new URLSearchParams(searchParams)
          newParams.delete('chapter')
          setSearchParams(newParams, { replace: true })
        }
      }
      setIsLoading(false)
    }
    fetchChapters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookId])

  // Fetch sentences when chapter changes
  useEffect(() => {
    if (!selectedChapterId) return

    async function fetchSentences() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('sentences')
        .select(`
          *,
          sentence_fragments (*)
        `)
        .eq('chapter_id', selectedChapterId)
        .order('sentence_order')

      if (!error && data) {
        setSentences(data)
        setFilteredSentences(data)
      }
      setIsLoading(false)
    }
    fetchSentences()
  }, [selectedChapterId])

  // Filter sentences when search query or review filter changes
  useEffect(() => {
    let filtered = sentences

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        s.sentence_text?.toLowerCase().includes(query) ||
        s.sentence_translation?.toLowerCase().includes(query)
      )
    }

    // Review status filter
    if (filterReviewed === 'reviewed') {
      filtered = filtered.filter(s => s.is_reviewed)
    } else if (filterReviewed === 'unreviewed') {
      filtered = filtered.filter(s => !s.is_reviewed)
    }

    setFilteredSentences(filtered)
  }, [searchQuery, filterReviewed, sentences])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't capture if modal is open or typing in input
      if (isModalOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentIndex = filteredSentences.findIndex(s => s.sentence_id === selectedSentenceId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < filteredSentences.length - 1) {
            setSelectedSentenceId(filteredSentences[currentIndex + 1].sentence_id)
          } else if (currentIndex === -1 && filteredSentences.length > 0) {
            setSelectedSentenceId(filteredSentences[0].sentence_id)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedSentenceId(filteredSentences[currentIndex - 1].sentence_id)
          }
          break

        case 'Enter':
          e.preventDefault()
          if (selectedSentenceId) {
            const sentence = filteredSentences.find(s => s.sentence_id === selectedSentenceId)
            if (sentence) {
              handleEdit(sentence)
            }
          }
          break

        case 'p':
        case 'P':
          e.preventDefault()
          if (selectedSentenceId) {
            const sentence = filteredSentences.find(s => s.sentence_id === selectedSentenceId)
            if (sentence) {
              handleToggleParagraph(sentence.sentence_id, !sentence.is_paragraph_start)
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredSentences, selectedSentenceId, isModalOpen, handleToggleParagraph])

  // Additional handlers
  const handleEdit = (sentence) => {
    setEditingSentence(sentence)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSentence(null)
  }

  const handleSaveSentence = useCallback(async (sentenceId, translation) => {
    console.log('Saving sentence:', sentenceId, 'translation:', translation)

    const { data, error } = await supabase
      .from('sentences')
      .update({ sentence_translation: translation })
      .eq('sentence_id', sentenceId)
      .select()

    console.log('Sentence save result:', { data, error })

    if (!error) {
      // Update local state
      setSentences(prev => prev.map(s =>
        s.sentence_id === sentenceId
          ? { ...s, sentence_translation: translation }
          : s
      ))
    } else {
      console.error('Error updating sentence:', error)
    }
  }, [])

  const handleSaveFragment = useCallback(async (fragmentId, translation, contextNote) => {
    const { error } = await supabase
      .from('sentence_fragments')
      .update({
        fragment_translation: translation,
        context_note: contextNote
      })
      .eq('fragment_id', fragmentId)

    if (!error) {
      // Update local state
      setSentences(prev => prev.map(s => ({
        ...s,
        sentence_fragments: s.sentence_fragments?.map(f =>
          f.fragment_id === fragmentId
            ? { ...f, fragment_translation: translation, context_note: contextNote }
            : f
        )
      })))
    } else {
      console.error('Error updating fragment:', error)
    }
  }, [])

  const handleToggleReviewed = useCallback(async (sentence) => {
    const newValue = !sentence.is_reviewed
    const { error } = await supabase
      .from('sentences')
      .update({
        is_reviewed: newValue,
        reviewed_at: newValue ? new Date().toISOString() : null
      })
      .eq('sentence_id', sentence.sentence_id)

    if (!error) {
      setSentences(prev => prev.map(s =>
        s.sentence_id === sentence.sentence_id
          ? { ...s, is_reviewed: newValue }
          : s
      ))
    } else {
      console.error('Error toggling reviewed:', error)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center justify-end">
        <div className="text-sm text-neutral-500">
          {filteredSentences.length} sentences
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Book dropdown */}
        <div className="relative">
          <select
            value={selectedBookId || ''}
            onChange={(e) => handleBookChange(e.target.value || null)}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            <option value="">All Books</option>
            {books.map(book => (
              <option key={book.book_id} value={book.book_id}>
                {book.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Chapter dropdown */}
        <div className="relative">
          <select
            value={selectedChapterId || ''}
            onChange={(e) => handleChapterChange(e.target.value || null)}
            disabled={chapters.length === 0}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer disabled:bg-gray-100 disabled:text-gray-400"
          >
            {chapters.length === 0 ? (
              <option value="">No chapters</option>
            ) : (
              chapters.map(chapter => (
                <option key={chapter.chapter_id} value={chapter.chapter_id}>
                  Chapter {chapter.chapter_number}: {chapter.title || 'Untitled'}
                </option>
              ))
            )}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sentences..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Review status filter */}
        <select
          value={filterReviewed}
          onChange={(e) => setFilterReviewed(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Review Status</option>
          <option value="reviewed">Reviewed</option>
          <option value="unreviewed">Needs Review</option>
        </select>
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">up/down</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">P</kbd> Toggle paragraph</span>
      </div>

      {/* Table */}
      <div ref={tableRef}>
        <SentenceTable
          sentences={filteredSentences}
          selectedId={selectedSentenceId}
          onSelect={setSelectedSentenceId}
          onEdit={handleEdit}
          onToggleParagraph={handleToggleParagraph}
          onToggleReviewed={handleToggleReviewed}
          isLoading={isLoading}
        />
      </div>

      {/* Edit Modal */}
      <SentenceEditModal
        sentence={editingSentence}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSaveSentence={handleSaveSentence}
        onSaveFragment={handleSaveFragment}
        onToggleParagraph={handleToggleParagraph}
        onSplitComplete={() => {
          // Refresh sentences after split
          if (selectedChapterId) {
            supabase
              .from('sentences')
              .select(`*, sentence_fragments (*)`)
              .eq('chapter_id', selectedChapterId)
              .order('sentence_order')
              .then(({ data }) => {
                if (data) {
                  setSentences(data)
                  setFilteredSentences(data)
                }
              })
          }
        }}
      />
    </div>
  )
}
