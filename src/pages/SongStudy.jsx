/**
 * SongStudy - Line-by-line song study mode
 *
 * Redesigned to match ReadingPage experience:
 * - Lines flow as continuous text within sections
 * - Tap line to reveal translation in tooltip
 * - Section headers styled like chapter headers
 * - Tape-deck navigation controls
 * - Progress bar at top
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Music,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'

export default function SongStudy() {
  const { songId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const containerRef = useRef(null)

  const [song, setSong] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentLineIndex, setCurrentLineIndex] = useState(0)

  // Tooltip state
  const [activeTooltipLine, setActiveTooltipLine] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch song
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('song_id', songId)
        .single()

      if (songError) throw songError
      setSong(songData)

      // Fetch sections with lines
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('song_sections')
        .select(`
          *,
          song_lines (*)
        `)
        .eq('song_id', songId)
        .order('section_order')

      if (sectionsError) throw sectionsError

      // Sort lines within each section
      const sortedSections = sectionsData.map(section => ({
        ...section,
        song_lines: (section.song_lines || []).sort((a, b) => a.line_order - b.line_order)
      }))
      setSections(sortedSections)

    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [songId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Flatten all lines for navigation
  const allLines = sections.flatMap((section, sectionIdx) =>
    section.song_lines.map(line => ({
      ...line,
      sectionLabel: section.section_label,
      sectionType: section.section_type,
      sectionId: section.section_id,
      isFirstInSection: section.song_lines[0]?.line_id === line.line_id
    }))
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown':
        case ' ':
        case 'ArrowRight':
          e.preventDefault()
          if (currentLineIndex < allLines.length - 1) {
            setCurrentLineIndex(prev => prev + 1)
            setActiveTooltipLine(null)
          }
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          if (currentLineIndex > 0) {
            setCurrentLineIndex(prev => prev - 1)
            setActiveTooltipLine(null)
          }
          break
        case 'Escape':
          setActiveTooltipLine(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentLineIndex, allLines.length])

  // Auto-scroll to current line
  useEffect(() => {
    const currentLineEl = document.getElementById(`line-${currentLineIndex}`)
    if (currentLineEl) {
      currentLineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentLineIndex])

  // Handle line click for tooltip
  const handleLineClick = useCallback((line, lineIndex, event) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8
    })
    setActiveTooltipLine(activeTooltipLine?.line_id === line.line_id ? null : line)
  }, [activeTooltipLine])

  // Close tooltip when clicking outside
  const handleContainerClick = useCallback(() => {
    setActiveTooltipLine(null)
  }, [])

  // Navigation handlers
  const goToFirstLine = () => {
    setCurrentLineIndex(0)
    setActiveTooltipLine(null)
  }

  const goToPrevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1)
      setActiveTooltipLine(null)
    }
  }

  const goToNextLine = () => {
    if (currentLineIndex < allLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1)
      setActiveTooltipLine(null)
    }
  }

  const goToLastLine = () => {
    setCurrentLineIndex(allLines.length - 1)
    setActiveTooltipLine(null)
  }

  // Section type styling - muted Notion-like colors
  const getSectionTypeStyle = (type) => {
    switch (type) {
      case 'chorus': return { bg: '#faf9fb', text: '#594a70', border: '#e9e5ef' }
      case 'verse': return { bg: '#f8fafc', text: '#1e40af', border: '#dbeafe' }
      case 'bridge': return { bg: '#fffbeb', text: '#a16207', border: '#fef3c7' }
      case 'outro': return { bg: '#fafafa', text: '#525252', border: '#e5e5e5' }
      case 'intro': return { bg: '#f7fdf9', text: '#15803d', border: '#dcfce7' }
      default: return { bg: '#fafafa', text: '#525252', border: '#e5e5e5' }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-neutral-400">Loading song...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-red-600">Error: {error}</div>
          <button
            onClick={() => navigate(`/song/${songId}`)}
            className="mt-4 text-purple-600 hover:underline"
          >
            ← Back to Song
          </button>
        </div>
      </div>
    )
  }

  if (allLines.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <Music size={48} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 mb-4">No lyrics found for this song</p>
          <button
            onClick={() => navigate(`/song/${songId}`)}
            className="text-purple-600 hover:underline"
          >
            ← Back to Song
          </button>
        </div>
      </div>
    )
  }

  const progress = ((currentLineIndex + 1) / allLines.length) * 100

  return (
    <div
      className="min-h-screen bg-white"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => navigate(`/song/${songId}`)}
              className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="text-center flex-1 mx-4">
              <div className="font-medium text-neutral-900 truncate">{song?.title}</div>
              <div className="text-xs text-neutral-500">{song?.artist}</div>
            </div>
            <div className="w-8" /> {/* Spacer */}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-neutral-100 -mx-4">
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: '#8b7aa3' }}
            />
          </div>
        </div>
      </div>

      {/* Lyrics content - flowing text style */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
        {sections.map((section, sectionIdx) => {
          const sectionStyle = getSectionTypeStyle(section.section_type)

          return (
            <div key={section.section_id} className="mb-8">
              {/* Section header - styled like chapter title */}
              <div
                className="text-center mb-6 py-4 rounded-lg border"
                style={{ backgroundColor: sectionStyle.bg, borderColor: sectionStyle.border }}
              >
                <div
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: sectionStyle.text }}
                >
                  {section.section_type}
                </div>
                {section.section_label && (
                  <div className="text-sm text-neutral-500 mt-1">
                    {section.section_label}
                  </div>
                )}
              </div>

              {/* Lines as flowing text */}
              <div className="space-y-0">
                {section.song_lines.map((line) => {
                  const lineGlobalIndex = allLines.findIndex(l => l.line_id === line.line_id)
                  const isCurrentLine = lineGlobalIndex === currentLineIndex
                  const isPastLine = lineGlobalIndex < currentLineIndex
                  const isFutureLine = lineGlobalIndex > currentLineIndex
                  const isTooltipActive = activeTooltipLine?.line_id === line.line_id

                  return (
                    <p
                      key={line.line_id}
                      id={`line-${lineGlobalIndex}`}
                      onClick={(e) => !isFutureLine && handleLineClick(line, lineGlobalIndex, e)}
                      className="text-lg leading-relaxed py-2 px-3 -mx-3 rounded-lg transition-all duration-200"
                      style={{
                        backgroundColor: isCurrentLine ? '#faf9fb' : isTooltipActive ? '#fafafa' : 'transparent',
                        color: isCurrentLine ? '#37352f' : isPastLine ? '#525252' : '#d4d4d4',
                        fontWeight: isCurrentLine ? 500 : 400,
                        cursor: isFutureLine ? 'default' : 'pointer',
                        filter: isFutureLine ? 'blur(2px)' : 'none',
                        userSelect: isFutureLine ? 'none' : 'auto',
                        pointerEvents: isFutureLine ? 'none' : 'auto',
                        boxShadow: isTooltipActive ? '0 0 0 2px #e9e5ef' : 'none'
                      }}
                    >
                      {line.line_text}
                    </p>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Translation tooltip */}
      {activeTooltipLine && activeTooltipLine.translation && (
        <div
          className="fixed z-30 bg-white border border-neutral-200 rounded-xl shadow-xl p-4 max-w-sm"
          style={{
            left: Math.min(Math.max(tooltipPosition.x - 150, 16), window.innerWidth - 316),
            top: Math.min(tooltipPosition.y, window.innerHeight - 150)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="text-sm font-medium text-neutral-800">
              {activeTooltipLine.line_text}
            </div>
            <button
              onClick={() => setActiveTooltipLine(null)}
              className="p-1 hover:bg-neutral-100 rounded -mr-1 -mt-1"
            >
              <X size={14} className="text-neutral-400" />
            </button>
          </div>
          <div className="text-sm text-neutral-600 italic">
            {activeTooltipLine.translation}
          </div>
          {activeTooltipLine.cultural_note && (
            <div
              className="mt-3 pt-3 border-t border-neutral-100 text-xs -mx-4 -mb-4 p-4 rounded-b-xl"
              style={{ backgroundColor: '#faf9fb', color: '#594a70' }}
            >
              {activeTooltipLine.cultural_note}
            </div>
          )}
        </div>
      )}

      {/* Navigation controls - tape deck style */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-2xl mx-auto px-4 pb-6">
          <div className="bg-white border border-neutral-200 rounded-full shadow-lg px-2 py-2 flex items-center justify-center gap-1">
            {/* First */}
            <button
              onClick={goToFirstLine}
              disabled={currentLineIndex === 0}
              className="p-3 rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Go to first line"
            >
              <ChevronFirst size={20} className="text-neutral-600" />
            </button>

            {/* Previous */}
            <button
              onClick={goToPrevLine}
              disabled={currentLineIndex === 0}
              className="p-3 rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous line"
            >
              <ChevronLeft size={20} className="text-neutral-600" />
            </button>

            {/* Progress indicator */}
            <div className="px-4 text-sm text-neutral-500 min-w-[80px] text-center">
              {currentLineIndex + 1} / {allLines.length}
            </div>

            {/* Next */}
            <button
              onClick={goToNextLine}
              disabled={currentLineIndex >= allLines.length - 1}
              className="p-3 rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next line"
            >
              <ChevronRight size={20} className="text-neutral-600" />
            </button>

            {/* Last */}
            <button
              onClick={goToLastLine}
              disabled={currentLineIndex >= allLines.length - 1}
              className="p-3 rounded-full hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Go to last line"
            >
              <ChevronLast size={20} className="text-neutral-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
