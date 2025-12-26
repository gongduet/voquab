/**
 * SongDashboard - Deep dive into specific song progress
 *
 * Features:
 * - Song completion percentage
 * - Standard vocabulary from this song
 * - Slang terms (respects explicit content setting)
 * - Section progress cards
 * - Learn Slang / Study Lyrics actions
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft,
  Music,
  BookOpen,
  MessageCircle,
  Play,
  MoreVertical,
  MapPin,
  GraduationCap
} from 'lucide-react'

export default function SongDashboard() {
  const { songId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [song, setSong] = useState(null)
  const [sections, setSections] = useState([])
  const [slangTerms, setSlangTerms] = useState([])
  const [allowExplicit, setAllowExplicit] = useState(false)
  const [stats, setStats] = useState({
    masteredCount: 0,
    familiarCount: 0,
    learningCount: 0,
    notSeenCount: 0,
    totalVocab: 0,
    completionPercent: 0,
    dueCount: 0,
    newAvailable: 0
  })

  const fetchData = useCallback(async () => {
    if (!user?.id || !songId) return

    setLoading(true)
    try {
      // Fetch user settings for explicit content preference
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('allow_explicit_content')
        .eq('user_id', user.id)
        .maybeSingle()

      const explicitAllowed = settingsData?.allow_explicit_content || false
      setAllowExplicit(explicitAllowed)

      // Fetch song info
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('song_id', songId)
        .single()

      if (songError) throw songError
      setSong(songData)

      // Fetch sections
      const { data: sectionsData } = await supabase
        .from('song_sections')
        .select(`
          *,
          song_lines (count)
        `)
        .eq('song_id', songId)
        .order('section_order')

      setSections(sectionsData || [])

      // Fetch slang terms
      const { data: slangData } = await supabase
        .from('song_slang')
        .select(`
          slang_id,
          slang_terms (
            slang_id,
            term,
            definition,
            region,
            formality,
            cultural_note
          )
        `)
        .eq('song_id', songId)

      // Filter slang based on explicit content setting
      const allSlang = slangData?.map(s => s.slang_terms).filter(Boolean) || []
      const filteredSlang = explicitAllowed
        ? allSlang
        : allSlang.filter(s => s.formality !== 'vulgar')

      setSlangTerms(filteredSlang)

      // Get song vocabulary IDs (lemmas, phrases, slang)
      const [lemmasResult, phrasesResult] = await Promise.all([
        supabase.from('song_lemmas').select('lemma_id').eq('song_id', songId),
        supabase.from('song_phrases').select('phrase_id').eq('song_id', songId)
      ])

      const songLemmaIds = (lemmasResult.data || []).map(l => l.lemma_id)
      const songPhraseIds = (phrasesResult.data || []).map(p => p.phrase_id)
      const songSlangIds = filteredSlang.map(s => s.slang_id)

      // Fetch user progress for this song's vocabulary
      const [lemmaProgress, phraseProgress, slangProgress] = await Promise.all([
        songLemmaIds.length > 0
          ? supabase
              .from('user_lemma_progress')
              .select('lemma_id, mastery_level, due_date, reps')
              .eq('user_id', user.id)
              .in('lemma_id', songLemmaIds)
          : { data: [] },
        songPhraseIds.length > 0
          ? supabase
              .from('user_phrase_progress')
              .select('phrase_id, mastery_level, due_date, reps')
              .eq('user_id', user.id)
              .in('phrase_id', songPhraseIds)
          : { data: [] },
        songSlangIds.length > 0
          ? supabase
              .from('user_slang_progress')
              .select('slang_id, mastery_level, due_date, reps')
              .eq('user_id', user.id)
              .in('slang_id', songSlangIds)
          : { data: [] }
      ])

      // Combine all progress records
      const allProgress = [
        ...(lemmaProgress.data || []),
        ...(phraseProgress.data || []),
        ...(slangProgress.data || [])
      ]

      // Calculate vocabulary stats
      const now = new Date()
      let mastered = 0, familiar = 0, learning = 0, notSeen = 0
      let dueCount = 0, newAvailable = 0

      // Count items with progress
      const progressMap = new Map()
      allProgress.forEach(p => {
        const id = p.lemma_id || p.phrase_id || p.slang_id
        progressMap.set(id, p)

        if (p.mastery_level >= 80) mastered++
        else if (p.mastery_level >= 50) familiar++
        else if (p.reps > 0) learning++
        else notSeen++

        if (p.reps > 0 && new Date(p.due_date) <= now) dueCount++
        if (p.reps === 0) newAvailable++
      })

      // Count items without any progress record (not seen)
      const totalVocabIds = songLemmaIds.length + songPhraseIds.length + songSlangIds.length
      const itemsWithProgress = progressMap.size
      notSeen += (totalVocabIds - itemsWithProgress)
      newAvailable += (totalVocabIds - itemsWithProgress)

      // Calculate completion percent (mastered + familiar / total)
      const totalVocab = totalVocabIds
      const completionPercent = totalVocab > 0
        ? Math.round(((mastered + familiar) / totalVocab) * 100)
        : 0

      setStats({
        masteredCount: mastered,
        familiarCount: familiar,
        learningCount: learning,
        notSeenCount: notSeen,
        totalVocab,
        completionPercent,
        dueCount,
        newAvailable
      })

    } catch (error) {
      console.error('Error fetching song data:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, songId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getSectionTypeStyle = (type) => {
    switch (type) {
      case 'chorus': return { backgroundColor: '#f4f2f7', color: '#594a70' }
      case 'verse': return { backgroundColor: '#eff6ff', color: '#1e40af' }
      case 'bridge': return { backgroundColor: '#fef3c7', color: '#a16207' }
      case 'outro': return { backgroundColor: '#f5f5f5', color: '#525252' }
      case 'intro': return { backgroundColor: '#dcfce7', color: '#15803d' }
      default: return { backgroundColor: '#f5f5f5', color: '#525252' }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-neutral-400">Loading song...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Music size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-500 mb-4">Song not found</p>
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
                <Music style={{ color: '#6f5d8a' }} size={28} />
                {song.title}
              </h1>
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                {song.artist}
                {song.region && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {song.region}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-neutral-100 rounded-lg">
            <MoreVertical size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Progress Circle */}
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 mb-4" style={{ backgroundColor: '#faf9fb', borderColor: '#e9e5ef' }}>
            <div>
              <div className="text-3xl font-bold" style={{ color: '#6f5d8a' }}>{stats.completionPercent}%</div>
              <div className="text-xs" style={{ color: '#594a70' }}>Complete</div>
            </div>
          </div>

          {/* Vocabulary Stats - matching BookDashboard */}
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

          {/* Themes */}
          {song.themes && song.themes.length > 0 && (
            <div className="mt-4 text-sm text-neutral-500">
              <span className="font-medium">Themes:</span> {Array.isArray(song.themes) ? song.themes.join(' · ') : song.themes}
            </div>
          )}
        </div>

        {/* Action Buttons - matching BookDashboard */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate(`/flashcards?songId=${songId}&mode=review`)}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <GraduationCap style={{ color: '#2563eb' }} size={24} />
            <div className="text-left">
              <div className="font-medium" style={{ color: '#37352f' }}>Review</div>
              <div className="text-sm text-neutral-500">{stats.dueCount} due</div>
            </div>
          </button>

          <button
            onClick={() => navigate(`/flashcards?songId=${songId}&mode=learn`)}
            className="flex items-center justify-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <Play style={{ color: '#22c55e' }} size={24} />
            <div className="text-left">
              <div className="font-medium" style={{ color: '#37352f' }}>Learn New</div>
              <div className="text-sm text-neutral-500">{stats.newAvailable} available</div>
            </div>
          </button>
        </div>

        {/* Study Lyrics */}
        <button
          onClick={() => navigate(`/song/${songId}/study`)}
          className="w-full flex items-center justify-center gap-3 p-5 text-white rounded-xl transition-colors"
          style={{ backgroundColor: '#6f5d8a' }}
        >
          <BookOpen size={24} />
          <div className="text-left">
            <div className="font-semibold">Study Lyrics</div>
            <div className="text-sm" style={{ opacity: 0.85 }}>
              {sections.length} sections · Line by line
            </div>
          </div>
        </button>

        {/* Slang Terms Preview */}
        {slangTerms.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2" style={{ color: '#37352f' }}>
                <MessageCircle style={{ color: '#6f5d8a' }} size={18} />
                Slang Terms
              </h2>
              <span className="text-sm text-neutral-500">{slangTerms.length} terms</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {slangTerms.slice(0, 12).map((term) => (
                <span
                  key={term.slang_id}
                  className="px-3 py-1.5 rounded-full text-sm"
                  style={{
                    backgroundColor: term.formality === 'vulgar' ? '#fee2e2' : term.formality === 'informal' ? '#fef3c7' : '#f4f2f7',
                    color: term.formality === 'vulgar' ? '#b91c1c' : term.formality === 'informal' ? '#a16207' : '#594a70'
                  }}
                >
                  {term.term}
                </span>
              ))}
              {slangTerms.length > 12 && (
                <span className="px-3 py-1.5 rounded-full text-sm bg-neutral-100 text-neutral-500">
                  +{slangTerms.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="font-semibold" style={{ color: '#37352f' }}>Song Structure</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {sections.map((section, index) => (
              <div
                key={section.section_id}
                className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={getSectionTypeStyle(section.section_type)}
                    >
                      {section.section_type}
                    </span>
                    {section.section_label && (
                      <span className="ml-2 text-sm text-neutral-500">{section.section_label}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
