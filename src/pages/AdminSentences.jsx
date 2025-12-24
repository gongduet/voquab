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
import { supabase } from '../lib/supabase'
import SentenceTable from '../components/admin/SentenceTable'
import SentenceEditModal from '../components/admin/SentenceEditModal'
import { Search, ChevronDown, CheckCircle, Circle } from 'lucide-react'

export default function AdminSentences() {
  // State
  const [chapters, setChapters] = useState([])
  const [selectedChapterId, setSelectedChapterId] = useState(null)
  const [sentences, setSentences] = useState([])
  const [filteredSentences, setFilteredSentences] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterReviewed, setFilterReviewed] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSentenceId, setSelectedSentenceId] = useState(null)
  const [editingSentence, setEditingSentence] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const tableRef = useRef(null)

  // Fetch chapters on mount
  useEffect(() => {
    async function fetchChapters() {
      const { data, error } = await supabase
        .from('chapters')
        .select('chapter_id, chapter_number, title')
        .order('chapter_number')

      if (!error && data) {
        setChapters(data)
        // Select first chapter by default
        if (data.length > 0) {
          setSelectedChapterId(data[0].chapter_id)
        }
      }
      setIsLoading(false)
    }
    fetchChapters()
  }, [])

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
  }, [filteredSentences, selectedSentenceId, isModalOpen])

  // Handlers
  const handleChapterChange = (chapterId) => {
    setSelectedChapterId(chapterId)
    setSelectedSentenceId(null)
    setSearchQuery('')
  }

  const handleEdit = (sentence) => {
    setEditingSentence(sentence)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSentence(null)
  }

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

  // Get selected chapter info
  const selectedChapter = chapters.find(c => c.chapter_id === selectedChapterId)

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
        {/* Chapter dropdown */}
        <div className="relative">
          <select
            value={selectedChapterId || ''}
            onChange={(e) => handleChapterChange(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
          >
            {chapters.map(chapter => (
              <option key={chapter.chapter_id} value={chapter.chapter_id}>
                Chapter {chapter.chapter_number}: {chapter.title || 'Untitled'}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
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
      />
    </div>
  )
}
