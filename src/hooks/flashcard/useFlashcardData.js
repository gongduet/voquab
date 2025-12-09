import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function useFlashcardData(userId) {
  const [searchParams] = useSearchParams()
  const focusChapter = searchParams.get('chapter') ? parseInt(searchParams.get('chapter')) : null

  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chapterInfo, setChapterInfo] = useState(null)

  useEffect(() => {
    if (userId) {
      fetchVocabulary()
    }
  }, [userId, focusChapter])

  async function fetchVocabulary() {
    setLoading(true)
    setError(null)

    try {
      // Step 1: Get chapter info if in focus mode
      let chapterData = null
      let chapterVocabIds = []

      if (focusChapter) {
        const { data: chapter, error: chapterError } = await supabase
          .from('chapters')
          .select('chapter_id, chapter_number, title')
          .eq('chapter_number', focusChapter)
          .single()

        if (chapterError) throw chapterError

        if (chapter) {
          chapterData = chapter
          setChapterInfo(chapter)

          // Get all sentence IDs for this chapter
          const { data: sentences } = await supabase
            .from('sentences')
            .select('sentence_id')
            .eq('chapter_id', chapter.chapter_id)

          if (sentences && sentences.length > 0) {
            const sentenceIds = sentences.map(s => s.sentence_id)

            // Get all lemma IDs from words in these sentences
            const { data: words } = await supabase
              .from('words')
              .select('lemma_id')
              .in('sentence_id', sentenceIds)

            if (words) {
              chapterVocabIds = [...new Set(words.map(w => w.lemma_id))]
            }
          }
        }
      }

      // Step 2: Build lemmas query with NEW LEMMA ARCHITECTURE
      let lemmaQuery = supabase
        .from('lemmas')
        .select(`
          lemma_id,
          lemma_text,
          definitions,
          part_of_speech
        `)
        .eq('language_code', 'es')
        .eq('is_stop_word', false)

      // Apply chapter filter if in focus mode
      if (focusChapter && chapterVocabIds.length > 0) {
        lemmaQuery = lemmaQuery.in('lemma_id', chapterVocabIds)
      }

      const { data: lemmaData, error: lemmaError } = await lemmaQuery

      if (lemmaError) throw lemmaError

      // Step 3: Get user progress for all lemmas
      const { data: progressData } = await supabase
        .from('user_lemma_progress')
        .select('*')
        .eq('user_id', userId)
        .in('lemma_id', lemmaData.map(l => l.lemma_id))

      const progressMap = {}
      progressData?.forEach(p => {
        progressMap[p.lemma_id] = p
      })

      // Step 4: Get example sentences from words table
      const { data: wordsData, error: wordsError } = await supabase
        .from('words')
        .select(`
          lemma_id,
          sentence_id,
          sentences!inner (
            sentence_text,
            sentence_translation
          )
        `)
        .in('lemma_id', lemmaData.map(l => l.lemma_id))
        .not('sentences.sentence_text', 'is', null)

      console.log('📝 Sentence fetch:', {
        totalSentences: wordsData?.length,
        hasData: !!wordsData,
        sampleSentence: wordsData?.[0],
        error: wordsError,
        lemmaIdsQueried: lemmaData.length
      })

      if (wordsError) {
        console.error('Sentence fetch error:', wordsError)
      }

      const sentencesMap = {}
      wordsData?.forEach(w => {
        if (!sentencesMap[w.lemma_id] && w.sentences) {
          sentencesMap[w.lemma_id] = {
            sentence_text: w.sentences.sentence_text,
            sentence_translation: w.sentences.sentence_translation
          }
        }
      })

      // Step 5: Combine all data with NEW LEMMA ARCHITECTURE
      const processedWords = lemmaData.map(lemma => {
        const progress = progressMap[lemma.lemma_id] || {
          mastery_level: 0,
          health: 0,  // NEW WORDS START AT 0% HEALTH
          total_reviews: 0,
          correct_reviews: 0,
          last_reviewed_at: null,
          last_correct_review_at: null
        }

        const sentence = sentencesMap[lemma.lemma_id]

        // Extract first definition from JSONB array
        const definitions = lemma.definitions || []
        const englishDefinition = Array.isArray(definitions) ? definitions[0] : definitions

        return {
          lemma_id: lemma.lemma_id,
          vocab_id: lemma.lemma_id,  // Backward compatibility alias
          lemma: lemma.lemma_text,
          english_definition: englishDefinition,
          part_of_speech: lemma.part_of_speech,
          ...progress,
          example_sentence: sentence?.sentence_text,
          example_sentence_translation: sentence?.sentence_translation
        }
      })

      console.log('📊 Debug Info:', {
        lemmaDataCount: lemmaData?.length,
        progressDataCount: progressData?.length,
        processedWordsCount: processedWords.length,
        sampleCard: processedWords[0]
      })

      setCards(processedWords)
      setLoading(false)

    } catch (err) {
      console.error('Error fetching vocabulary:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return {
    cards,
    loading,
    error,
    chapterInfo,
    focusChapter,
    refetch: fetchVocabulary
  }
}
