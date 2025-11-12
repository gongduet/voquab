import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Google Translate API
const TRANSLATE_API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY || 'AIzaSyABljNcVe3bqnnjJUwyMvDBz2XwjtOrBp8'

// Translation cache
const translationCache = new Map()

export default function ReadingMode() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bookTitle, setBookTitle] = useState('')
  const [chapterTitle, setChapterTitle] = useState('')
  const [sentences, setSentences] = useState([])
  const [viewMode, setViewMode] = useState('both') // 'spanish', 'both', 'english'
  const [hoveredWord, setHoveredWord] = useState(null)
  const [hoveredWordTranslation, setHoveredWordTranslation] = useState('')
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [chapters, setChapters] = useState([])
  const [currentChapterNumber, setCurrentChapterNumber] = useState(1)
  const [bookId, setBookId] = useState(null)
  const navigate = useNavigate()
  const { chapterNumber } = useParams()

  useEffect(() => {
    // Set chapter number from URL or default to 1
    const chapterNum = chapterNumber ? parseInt(chapterNumber) : 1
    setCurrentChapterNumber(chapterNum)
  }, [chapterNumber])

  useEffect(() => {
    fetchBookAndChapters()
  }, [])

  useEffect(() => {
    if (bookId && currentChapterNumber) {
      fetchChapterContent()
    }
  }, [bookId, currentChapterNumber])

  async function fetchBookAndChapters() {
    try {
      // Get the book "El Principito"
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('book_id, title')
        .eq('title', 'El Principito')
        .eq('language_code', 'es')
        .single()

      if (bookError) throw bookError
      if (!book) throw new Error('Book not found')

      setBookTitle(book.title)
      setBookId(book.book_id)

      // Get all chapters for this book
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('chapter_id, chapter_number, title')
        .eq('book_id', book.book_id)
        .order('chapter_number', { ascending: true })

      if (chaptersError) throw chaptersError

      setChapters(chaptersData || [])
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function fetchChapterContent() {
    try {
      setLoading(true)
      setError(null)

      // Get the specific chapter
      const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('chapter_id, title')
        .eq('book_id', bookId)
        .eq('chapter_number', currentChapterNumber)
        .single()

      if (chapterError) throw chapterError
      if (!chapter) throw new Error('Chapter not found')

      setChapterTitle(chapter.title)

      // Get all sentences
      const { data: sentencesData, error: sentencesError } = await supabase
        .from('sentences')
        .select('sentence_id, sentence_order, sentence_text, sentence_translation')
        .eq('chapter_id', chapter.chapter_id)
        .order('sentence_order', { ascending: true })

      if (sentencesError) throw sentencesError

      setSentences(sentencesData || [])
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function translateWord(word) {
    if (translationCache.has(word.toLowerCase())) {
      return translationCache.get(word.toLowerCase())
    }

    try {
      const url = `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_API_KEY}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: word,
          source: 'es',
          target: 'en',
          format: 'text',
        }),
      })

      if (!response.ok) throw new Error('Translation failed')

      const data = await response.json()
      const translation = data.data.translations[0].translatedText

      translationCache.set(word.toLowerCase(), translation)
      return translation
    } catch (error) {
      return ''
    }
  }

  async function handleWordHover(word, event) {
    const cleanWord = word.replace(/[.,;:!?¿¡«»""]/g, '').trim()
    if (!cleanWord) return

    const rect = event.target.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    })

    setHoveredWord(cleanWord)
    const translation = await translateWord(cleanWord)
    setHoveredWordTranslation(translation)
  }

  function handleWordClick(word) {
    const cleanWord = word.replace(/[.,;:!?¿¡«»""]/g, '').trim()
    if (!cleanWord) return
    console.log('Word clicked:', cleanWord)
  }

  function handleChapterChange(newChapterNumber) {
    navigate(`/read/${newChapterNumber}`)
  }

  function handlePreviousChapter() {
    if (currentChapterNumber > 1) {
      navigate(`/read/${currentChapterNumber - 1}`)
    }
  }

  function handleNextChapter() {
    if (currentChapterNumber < chapters.length) {
      navigate(`/read/${currentChapterNumber + 1}`)
    }
  }

  function renderClickableText(text) {
    const words = text.split(/(\s+)/)

    return words.map((word, index) => {
      if (word.trim() === '') {
        return <span key={index}>{word}</span>
      }

      return (
        <span
          key={index}
          onMouseEnter={(e) => handleWordHover(word, e)}
          onMouseLeave={() => setHoveredWord(null)}
          onClick={() => handleWordClick(word)}
          className="hover:bg-amber-100/30 cursor-pointer transition-colors duration-150 rounded px-0.5"
        >
          {word}
        </span>
      )
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600 font-serif">Cargando...</p>
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
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-amber-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Top Row - Home button and View Toggle */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="text-amber-800 hover:text-amber-900 font-serif text-sm flex items-center gap-2"
            >
              ← Inicio
            </button>

            {/* View Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('spanish')}
                className={`px-4 py-1.5 rounded-lg font-serif text-sm transition-all ${
                  viewMode === 'spanish'
                    ? 'bg-amber-600 text-white'
                    : 'border border-amber-600 text-amber-800 hover:bg-amber-50'
                }`}
              >
                Español
              </button>
              <button
                onClick={() => setViewMode('both')}
                className={`px-4 py-1.5 rounded-lg font-serif text-sm transition-all ${
                  viewMode === 'both'
                    ? 'bg-amber-600 text-white'
                    : 'border border-amber-600 text-amber-800 hover:bg-amber-50'
                }`}
              >
                Ambos
              </button>
              <button
                onClick={() => setViewMode('english')}
                className={`px-4 py-1.5 rounded-lg font-serif text-sm transition-all ${
                  viewMode === 'english'
                    ? 'bg-amber-600 text-white'
                    : 'border border-amber-600 text-amber-800 hover:bg-amber-50'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Bottom Row - Chapter Navigation */}
          <div className="flex items-center justify-between gap-4">
            {/* Previous Button */}
            <button
              onClick={handlePreviousChapter}
              disabled={currentChapterNumber === 1}
              className={`px-4 py-2 rounded-lg font-serif text-sm transition-all flex items-center gap-2 ${
                currentChapterNumber === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              ← Anterior
            </button>

            {/* Chapter Selector and Progress */}
            <div className="flex items-center gap-3 flex-1 justify-center">
              {/* Chapter Dropdown */}
              <select
                value={currentChapterNumber}
                onChange={(e) => handleChapterChange(parseInt(e.target.value))}
                className="px-4 py-2 rounded-lg border-2 border-amber-300 bg-white text-amber-900 font-serif text-sm cursor-pointer hover:border-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.chapter_id} value={chapter.chapter_number}>
                    {chapter.title}
                  </option>
                ))}
              </select>

              {/* Progress Indicator */}
              <div className="text-sm text-gray-600 font-serif">
                <span className="text-amber-700 font-semibold">{currentChapterNumber}</span> de {chapters.length}
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextChapter}
              disabled={currentChapterNumber === chapters.length}
              className={`px-4 py-2 rounded-lg font-serif text-sm transition-all flex items-center gap-2 ${
                currentChapterNumber === chapters.length
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Book Title */}
        <div className="text-center mb-12">
          <div className="text-4xl mb-2">⭐</div>
          <h1 className="text-4xl font-serif font-bold text-amber-700 mb-2">{bookTitle}</h1>
          <p className="text-lg font-serif italic text-gray-600">{chapterTitle}</p>
        </div>

        {/* Sentences */}
        <div className="space-y-6">
          {sentences.map((sentence) => (
            <div
              key={sentence.sentence_id}
              className="relative bg-[#fdfcfa] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
              style={{ maxWidth: '800px', margin: '0 auto 24px' }}
            >
              {/* Sentence Number */}
              <div className="absolute -left-3 top-6 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">{sentence.sentence_order}</span>
              </div>

              <div className="pl-8">
                {/* Spanish Text */}
                {(viewMode === 'spanish' || viewMode === 'both') && (
                  <p className="text-xl leading-relaxed text-[#4a3f35] mb-3" style={{ fontFamily: 'Georgia, "Crimson Text", serif', lineHeight: '1.8' }}>
                    {renderClickableText(sentence.sentence_text)}
                  </p>
                )}

                {/* English Translation */}
                {(viewMode === 'english' || viewMode === 'both') && (
                  <p className="text-base italic text-gray-500 opacity-80" style={{ fontFamily: 'Georgia, serif', marginTop: viewMode === 'both' ? '12px' : '0' }}>
                    {sentence.sentence_translation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* End Marker */}
        <div className="text-center mt-16 mb-12">
          <div className="inline-flex items-center gap-2 text-amber-700 font-serif italic">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
          </div>
        </div>
      </main>

      {/* Hover Tooltip */}
      {hoveredWord && hoveredWordTranslation && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-white px-3 py-1.5 rounded-lg shadow-lg text-sm animate-fadeIn">
            {hoveredWordTranslation}
            {/* Arrow */}
            <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
              <div className="border-8 border-transparent border-t-white"></div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
