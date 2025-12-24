/**
 * OrphanedWords - View and reassign words without valid lemma assignments
 *
 * An orphaned word is one where:
 * - lemma_id is NULL
 * - lemma_id points to a deleted/non-existent lemma
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'
import LemmaReassignModal from '../components/admin/LemmaReassignModal'

export default function OrphanedWords() {
  const navigate = useNavigate()
  const [orphanedWords, setOrphanedWords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reassignWord, setReassignWord] = useState(null)

  const fetchOrphanedWords = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch words with NULL lemma_id or where the joined lemma doesn't exist
      const { data, error: fetchError } = await supabase
        .from('words')
        .select(`
          word_id,
          word_text,
          word_position,
          lemma_id,
          sentence_id,
          sentences (
            sentence_id,
            sentence_text,
            sentence_order,
            chapter_id,
            chapters (
              chapter_id,
              chapter_number,
              title
            )
          )
        `)
        .is('lemma_id', null)
        .order('word_text')
        .range(0, 999)

      if (fetchError) throw fetchError

      // Group by chapter for easier viewing
      const grouped = {}
      data?.forEach(word => {
        const chapterId = word.sentences?.chapter_id || 'unknown'
        if (!grouped[chapterId]) {
          grouped[chapterId] = {
            chapter: word.sentences?.chapters || { chapter_number: '?', title: 'Unknown' },
            words: []
          }
        }
        grouped[chapterId].words.push(word)
      })

      // Sort by chapter number
      const sortedGroups = Object.values(grouped)
        .sort((a, b) => (a.chapter.chapter_number || 99) - (b.chapter.chapter_number || 99))

      setOrphanedWords(sortedGroups)
    } catch (err) {
      console.error('Error fetching orphaned words:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrphanedWords()
  }, [fetchOrphanedWords])

  const handleReassign = async (wordId, newLemmaId) => {
    const { error } = await supabase
      .from('words')
      .update({ lemma_id: newLemmaId })
      .eq('word_id', wordId)

    if (!error) {
      // Remove from orphaned list
      setOrphanedWords(prev => prev.map(group => ({
        ...group,
        words: group.words.filter(w => w.word_id !== wordId)
      })).filter(group => group.words.length > 0))
    } else {
      console.error('Error reassigning word:', error)
      alert('Failed to reassign: ' + error.message)
    }

    setReassignWord(null)
  }

  const totalOrphaned = orphanedWords.reduce((sum, g) => sum + g.words.length, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-neutral-400">Loading orphaned words...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft size={16} />
          Back to Lemmas
        </button>

        <button
          onClick={fetchOrphanedWords}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Title and Stats */}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Orphaned Words</h1>
        <p className="text-neutral-500 mt-1">
          Words without a valid lemma assignment that need to be reassigned
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 inline-block">
        <div className="flex items-center gap-3">
          {totalOrphaned > 0 ? (
            <>
              <AlertTriangle className="text-amber-500" size={20} />
              <div>
                <div className="text-2xl font-semibold text-neutral-900">{totalOrphaned}</div>
                <div className="text-xs text-neutral-500 uppercase tracking-wide">Orphaned Words</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-xs">✓</span>
              </div>
              <div>
                <div className="text-lg font-medium text-neutral-700">All Clear!</div>
                <div className="text-xs text-neutral-500">No orphaned words found</div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Orphaned Words List */}
      {totalOrphaned > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {orphanedWords.map(({ chapter, words }) => (
              <div key={chapter.chapter_id || 'unknown'}>
                {/* Chapter header */}
                <div className="px-6 py-3 bg-neutral-50 flex items-center justify-between">
                  <span className="font-medium text-neutral-800">
                    Chapter {chapter.chapter_number}: {chapter.title}
                  </span>
                  <span className="text-sm text-neutral-500">
                    {words.length} orphaned word{words.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Words table */}
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-6 py-2 text-left">Word</th>
                      <th className="px-6 py-2 text-left">Sentence Context</th>
                      <th className="px-6 py-2 text-right w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {words.map((word) => (
                      <tr key={word.word_id} className="hover:bg-neutral-50">
                        <td className="px-6 py-3">
                          <span className="font-medium text-neutral-800">
                            {word.word_text}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-neutral-600 line-clamp-1">
                            {word.sentences?.sentence_text || '—'}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => navigate(`/admin/sentences/${word.sentence_id}`)}
                              className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
                              title="View sentence"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => setReassignWord(word)}
                              className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Assign Lemma
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-neutral-400 mb-2">
            <span className="text-4xl">🎉</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-700 mb-1">No Orphaned Words</h3>
          <p className="text-sm text-neutral-500">
            All words are properly assigned to lemmas. Great job!
          </p>
        </div>
      )}

      {/* Reassign Modal */}
      <LemmaReassignModal
        isOpen={!!reassignWord}
        word={reassignWord}
        onClose={() => setReassignWord(null)}
        onConfirm={(newLemmaId) => handleReassign(reassignWord?.word_id, newLemmaId)}
      />
    </div>
  )
}
