/**
 * Session Builder - Builds flashcard sessions with different modes
 *
 * Modes:
 * 1. Review - Due cards + exposure oversampling
 * 2. Learn - New words from unlocked chapters
 * 3. Chapter Focus - 60% target chapter, 20% exposure, 20% other due
 */

import { supabase } from '../lib/supabase'
import {
  isCardDue,
  shouldIncludeForExposure,
  getUserActivityLevel,
  FSRSState
} from './fsrsService'

/**
 * Session modes
 */
export const SessionMode = {
  REVIEW: 'review',
  LEARN: 'learn',
  CHAPTER: 'chapter',
  SONG: 'song'          // Song vocabulary session (lemmas + phrases + slang)
}

/**
 * Default session size
 */
const DEFAULT_SESSION_SIZE = 20

/**
 * Build a flashcard session based on mode
 *
 * @param {string} userId - User ID
 * @param {string} mode - 'review' | 'learn' | 'chapter'
 * @param {Object} options - { chapterNumber, sessionSize }
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildSession(userId, mode = SessionMode.REVIEW, options = {}) {
  // Fetch user settings to get their preferred session size
  let sessionSize = options.sessionSize || DEFAULT_SESSION_SIZE

  if (!options.sessionSize) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('cards_per_session')
      .eq('user_id', userId)
      .single()

    if (userSettings?.cards_per_session) {
      sessionSize = userSettings.cards_per_session
    }
  }

  switch (mode) {
    case SessionMode.REVIEW:
      return buildReviewSession(userId, sessionSize, options.onProgress, { skipSentences: options.skipSentences })

    case SessionMode.LEARN:
      return buildLearnSession(userId, sessionSize, options.onProgress)

    case SessionMode.CHAPTER:
      if (!options.chapterNumber) {
        throw new Error('Chapter number required for chapter focus mode')
      }
      return buildChapterFocusSession(userId, options.chapterNumber, sessionSize)

    case SessionMode.SONG:
      if (!options.songId) {
        throw new Error('Song ID required for song mode')
      }
      return buildSongSession(userId, options.songId, sessionSize, options)

    default:
      return buildReviewSession(userId, sessionSize)
  }
}

/**
 * Build a review session with due cards + exposure (includes lemmas and phrases)
 *
 * @param {string} userId - User ID
 * @param {number} sessionSize - Max cards in session
 * @param {Function} onProgress - Optional progress callback
 * @param {Object} options - { skipSentences: boolean }
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildReviewSession(userId, sessionSize = DEFAULT_SESSION_SIZE, onProgress = null, options = {}) {
  const { skipSentences = false } = options
  // Report stage 1
  onProgress?.({ stage: 1, totalStages: 4, message: "Loading your progress..." })

  // Run independent queries in parallel
  const [
    { data: userSettings },
    { data: lemmaProgressData, error: lemmaProgressError },
    { data: phraseProgressData, error: phraseProgressError }
  ] = await Promise.all([
    supabase
      .from('user_settings')
      .select('cards_per_session')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('user_lemma_progress')
      .select(`
        *,
        lemmas!inner (
          lemma_id,
          lemma_text,
          definitions,
          part_of_speech,
          is_stop_word
        )
      `)
      .eq('user_id', userId)
      .eq('lemmas.is_stop_word', false),
    supabase
      .from('user_phrase_progress')
      .select(`
        *,
        phrases!inner (
          phrase_id,
          phrase_text,
          definitions,
          phrase_type
        )
      `)
      .eq('user_id', userId)
  ])

  // Use userSettings for session size if available
  const finalSessionSize = userSettings?.cards_per_session || sessionSize

  if (lemmaProgressError) {
    console.error('Error fetching lemma progress:', lemmaProgressError)
    return { cards: [], stats: {}, mode: SessionMode.REVIEW, error: lemmaProgressError.message }
  }

  if (phraseProgressError) {
    console.error('Error fetching phrase progress:', phraseProgressError)
    // Continue without phrases rather than failing
  }

  // Report stage 2
  onProgress?.({ stage: 2, totalStages: 4, message: "Finding due cards..." })

  // TODO: Reintroduce exposure oversampling post-MVP
  // Exposure logic commented out - just fetch due cards for now
  // const { data: dailyStats } = await supabase.from('user_daily_stats')...
  // const activityLevel = getUserActivityLevel(dailyStats)
  // const exposureCandidates = []

  // Collect due cards only (no exposure for MVP)
  const dueCards = []

  for (const card of lemmaProgressData || []) {
    const enrichedCard = enrichCardWithLemma(card)
    enrichedCard.card_type = 'lemma'

    if (isCardDue(enrichedCard)) {
      dueCards.push({ ...enrichedCard, isExposure: false })
    }
    // Exposure disabled for MVP:
    // else if (shouldIncludeForExposure(enrichedCard, activityLevel.daysBetween)) {
    //   exposureCandidates.push({ ...enrichedCard, isExposure: true })
    // }
  }

  // Process phrase cards
  for (const card of phraseProgressData || []) {
    const enrichedCard = enrichCardWithPhrase(card)
    enrichedCard.card_type = 'phrase'

    if (isCardDue(enrichedCard)) {
      dueCards.push({ ...enrichedCard, isExposure: false })
    }
    // Exposure disabled for MVP:
    // else if (shouldIncludeForExposure(enrichedCard, activityLevel.daysBetween)) {
    //   exposureCandidates.push({ ...enrichedCard, isExposure: true })
    // }
  }

  // Select due cards only (no exposure for MVP)
  const selectedDue = dueCards.slice(0, finalSessionSize)
  // Exposure disabled for MVP:
  // const remainingSlots = finalSessionSize - selectedDue.length
  // const exposureCount = Math.min(remainingSlots, activityLevel.exposureCards)
  // const shuffledExposure = shuffleArray(exposureCandidates)
  // const selectedExposure = shuffledExposure.slice(0, exposureCount)

  // Shuffle selected due cards (no exposure cards for MVP)
  const allCards = shuffleArray(selectedDue)

  // Fetch sentences for lemma cards only (phrases already have sentences)
  const lemmaCards = allCards.filter(c => c.card_type === 'lemma')
  const phraseCards = allCards.filter(c => c.card_type === 'phrase')

  let cardsWithSentences

  if (skipSentences) {
    // Return cards without sentences - they'll be loaded in background
    cardsWithSentences = shuffleArray([...lemmaCards, ...phraseCards])
    onProgress?.({ stage: 4, totalStages: 4, message: "Starting session..." })
  } else {
    // Load sentences synchronously (original behavior)
    onProgress?.({ stage: 3, totalStages: 4, message: "Loading sentences..." })
    const lemmaCardsWithSentences = await addSentencesToCards(lemmaCards)
    const phraseCardsWithSentences = await addSentencesToPhraseCards(phraseCards)
    cardsWithSentences = shuffleArray([...lemmaCardsWithSentences, ...phraseCardsWithSentences])
    onProgress?.({ stage: 4, totalStages: 4, message: "Building session..." })
  }

  const stats = {
    totalDue: dueCards.length,
    selectedDue: selectedDue.length,
    exposureAvailable: 0,  // Exposure disabled for MVP
    selectedExposure: 0,   // Exposure disabled for MVP
    // activityLevel: activityLevel.level,  // Exposure disabled for MVP
    lemmaCount: lemmaCards.length,
    phraseCount: phraseCards.length,
    dueRemaining: Math.max(0, dueCards.length - selectedDue.length),
    newRemaining: 0
  }

  console.log('📚 Review session built:', stats)

  return {
    cards: cardsWithSentences,
    stats,
    mode: SessionMode.REVIEW
  }
}

/**
 * Enrich card with phrase data from joined query
 *
 * @param {Object} card - Card with nested phrases object
 * @returns {Object} - Flattened card object
 */
function enrichCardWithPhrase(card) {
  const phrase = card.phrases || {}
  // Parse definitions (may be JSON string or array)
  const defs = typeof phrase.definitions === 'string'
    ? JSON.parse(phrase.definitions)
    : phrase.definitions
  return {
    ...card,
    phrase_id: card.phrase_id,
    lemma: phrase.phrase_text,  // Use lemma field for display consistency
    english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
    part_of_speech: 'PHRASE',
    word_in_sentence: phrase.phrase_text  // Phrase appears as-is in sentence
  }
}

/**
 * Add example sentences to phrase cards
 *
 * @param {Array} cards - Array of phrase card objects
 * @returns {Array} - Cards with example_sentence and example_sentence_translation
 */
export async function addSentencesToPhraseCards(cards) {
  if (cards.length === 0) return cards

  const phraseIds = cards.map(c => c.phrase_id)

  // Get phrase occurrences with sentences
  const { data: occurrences } = await supabase
    .from('phrase_occurrences')
    .select(`
      phrase_id,
      sentences (
        sentence_text,
        sentence_translation
      )
    `)
    .in('phrase_id', phraseIds)
    .not('sentences.sentence_text', 'is', null)

  // Build sentence map (first sentence per phrase)
  const sentenceMap = {}
  for (const occ of occurrences || []) {
    if (!sentenceMap[occ.phrase_id] && occ.sentences) {
      sentenceMap[occ.phrase_id] = {
        sentence_text: occ.sentences.sentence_text,
        sentence_translation: occ.sentences.sentence_translation
      }
    }
  }

  // Add sentences to cards
  return cards.map(card => ({
    ...card,
    example_sentence: sentenceMap[card.phrase_id]?.sentence_text,
    example_sentence_translation: sentenceMap[card.phrase_id]?.sentence_translation
  }))
}

/**
 * Build a learn session with new/unintroduced words + phrases
 * Uses PROPORTIONAL selection: if pool is 80% lemmas / 20% phrases, session is ~80/20
 * Priority within each type: sentence order (words/phrases appear in book order)
 *
 * @param {string} userId - User ID
 * @param {number} sessionSize - Max cards in session
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildLearnSession(userId, sessionSize = DEFAULT_SESSION_SIZE, onProgress = null) {
  // Report stage 1
  onProgress?.({ stage: 1, totalStages: 4, message: "Checking unlocked chapters..." })

  // 1. Get unlocked chapter IDs
  const unlockedChapterIds = await getUnlockedChapterIds(userId)
  console.log('📚 Unlocked chapters:', unlockedChapterIds.length)

  if (unlockedChapterIds.length === 0) {
    return {
      cards: [],
      stats: { unintroducedAvailable: 0, selected: 0 },
      mode: SessionMode.LEARN,
      message: 'No chapters available.'
    }
  }

  // Report stage 2
  onProgress?.({ stage: 2, totalStages: 4, message: "Finding new words..." })

  // 2. Get unexposed lemmas from unlocked chapters (sorted by sentence order)
  const unexposedLemmas = await getUnexposedLemmas(userId, unlockedChapterIds)
  console.log('📖 Unexposed lemmas:', unexposedLemmas.length)

  // 3. Get unexposed phrases from unlocked chapters (sorted by sentence order)
  const unexposedPhrases = await getUnexposedPhrases(userId, unlockedChapterIds)
  console.log('📝 Unexposed phrases:', unexposedPhrases.length)

  // 4. Calculate proportional counts
  const totalPool = unexposedLemmas.length + unexposedPhrases.length
  if (totalPool === 0) {
    console.log('⚠️ No unexposed cards available')
    return {
      cards: [],
      stats: { unintroducedAvailable: 0, selected: 0 },
      mode: SessionMode.LEARN,
      message: 'No new words available. Unlock more chapters or switch to Review mode.'
    }
  }

  const lemmaRatio = unexposedLemmas.length / totalPool
  const phraseRatio = unexposedPhrases.length / totalPool

  const lemmaCount = Math.round(sessionSize * lemmaRatio)
  const phraseCount = sessionSize - lemmaCount // Remainder to phrases

  // 5. Lemmas and phrases are already sorted by sentence order from getUnexposed* functions

  // 6. Select proportional amounts
  const selectedLemmas = unexposedLemmas.slice(0, lemmaCount).map(l => ({
    ...l,
    card_type: 'lemma',
    isNew: true,
    isExposure: false
  }))

  const selectedPhrases = unexposedPhrases.slice(0, phraseCount).map(p => ({
    ...p,
    card_type: 'phrase',
    isNew: true,
    isExposure: false
  }))

  // Report stage 3
  onProgress?.({ stage: 3, totalStages: 4, message: "Loading sentences..." })

  // 7. Add sentences to lemma cards
  const lemmaCardsWithSentences = await addSentencesToCards(selectedLemmas)

  // Report stage 4
  onProgress?.({ stage: 4, totalStages: 4, message: "Building session..." })

  // 8. Combine and shuffle for variety
  const session = shuffleArray([...lemmaCardsWithSentences, ...selectedPhrases])

  const stats = {
    unintroducedAvailable: totalPool,
    selected: session.length,
    lemmaCount: lemmaCardsWithSentences.length,
    phraseCount: selectedPhrases.length,
    lemmaRatio: (lemmaRatio * 100).toFixed(1) + '%',
    phraseRatio: (phraseRatio * 100).toFixed(1) + '%',
    dueRemaining: 0,
    newRemaining: Math.max(0, totalPool - session.length)
  }

  return {
    cards: session,
    stats,
    mode: SessionMode.LEARN
  }
}

/**
 * Get unlocked chapter IDs for a user
 * A chapter is unlocked when 95% of the previous chapter's words are introduced
 *
 * @param {string} userId - User ID
 * @returns {Array<string>} - Array of unlocked chapter UUIDs
 */
async function getUnlockedChapterIds(userId) {
  // Run all queries in parallel (3 queries total - no URL length issues)
  const [
    { data: chapters },
    { data: chapterStats },
    { data: userProgress }
  ] = await Promise.all([
    // 1. All chapters ordered
    supabase
      .from('chapters')
      .select('chapter_id, chapter_number')
      .order('chapter_number', { ascending: true }),
    // 2. Pre-computed chapter vocabulary stats (totals)
    supabase
      .from('chapter_vocabulary_stats')
      .select('chapter_id, total_lemmas, total_phrases'),
    // 3. User's introduced counts per chapter (via RPC - no URL length issues)
    supabase.rpc('get_user_chapter_progress', { p_user_id: userId })
  ])

  if (!chapters || chapters.length === 0) {
    return []
  }

  // Build stats lookup: chapter_id -> {total_lemmas, total_phrases}
  const statsMap = new Map()
  for (const stat of (chapterStats || [])) {
    statsMap.set(stat.chapter_id, {
      total_lemmas: stat.total_lemmas,
      total_phrases: stat.total_phrases
    })
  }

  // Build progress lookup: chapter_id -> {introduced_lemmas, introduced_phrases}
  const progressMap = new Map()
  for (const row of (userProgress || [])) {
    progressMap.set(row.chapter_id, {
      introduced_lemmas: Number(row.introduced_lemmas) || 0,
      introduced_phrases: Number(row.introduced_phrases) || 0
    })
  }

  // First chapter always unlocked
  const unlockedChapterIds = [chapters[0].chapter_id]

  // Check each chapter's introduction rate
  for (let i = 0; i < chapters.length - 1; i++) {
    const currentChapter = chapters[i]
    const chapterId = currentChapter.chapter_id

    const stats = statsMap.get(chapterId) || { total_lemmas: 0, total_phrases: 0 }
    const progress = progressMap.get(chapterId) || { introduced_lemmas: 0, introduced_phrases: 0 }

    const totalCount = stats.total_lemmas + stats.total_phrases
    const introducedCount = progress.introduced_lemmas + progress.introduced_phrases
    const introductionRate = totalCount > 0 ? introducedCount / totalCount : 0

    if (introductionRate >= 0.95) {
      const nextChapter = chapters[i + 1]
      if (nextChapter) {
        unlockedChapterIds.push(nextChapter.chapter_id)
      }
    } else {
      break
    }
  }

  return unlockedChapterIds
}

/**
 * Get unexposed lemmas from unlocked chapters, sorted by sentence order
 *
 * @param {string} userId - User ID
 * @param {Array<string>} chapterIds - Array of unlocked chapter UUIDs
 * @returns {Array<Object>} - Array of lemma card objects sorted by sentence order
 */
async function getUnexposedLemmas(userId, chapterIds) {
  // Get user's introduced lemmas (reps >= 1 means reviewed at least once)
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const introducedLemmaIds = new Set((userProgress || []).map(p => p.lemma_id))

  // Get sentences from unlocked chapters with their order info
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id, sentence_order, chapter_id')
    .in('chapter_id', chapterIds)
    .order('sentence_order', { ascending: true })

  if (!sentences || sentences.length === 0) return []

  const sentenceIds = sentences.map(s => s.sentence_id)

  // Build a map of sentence_id -> {chapter_id, sentence_order}
  const sentenceInfo = {}
  for (const s of sentences) {
    sentenceInfo[s.sentence_id] = {
      chapter_id: s.chapter_id,
      sentence_order: s.sentence_order
    }
  }

  // Get chapter numbers for sorting
  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .in('chapter_id', chapterIds)

  const chapterNumbers = {}
  for (const c of chaptersData || []) {
    chapterNumbers[c.chapter_id] = c.chapter_number
  }

  // Get words with their lemma info
  const { data: wordsData } = await supabase
    .from('words')
    .select(`
      word_id,
      word_text,
      sentence_id,
      lemma_id,
      lemmas!inner (
        lemma_id,
        lemma_text,
        definitions,
        part_of_speech,
        is_stop_word
      )
    `)
    .in('sentence_id', sentenceIds)
    .eq('lemmas.is_stop_word', false)

  if (!wordsData || wordsData.length === 0) return []

  // Filter to unexposed lemmas and dedupe, keeping first occurrence (sorted by sentence order)
  const seen = new Set()
  const unexposedLemmas = []

  // Sort by chapter number then sentence order
  const sortedWords = wordsData.sort((a, b) => {
    const aInfo = sentenceInfo[a.sentence_id] || {}
    const bInfo = sentenceInfo[b.sentence_id] || {}
    const aChapter = chapterNumbers[aInfo.chapter_id] || 0
    const bChapter = chapterNumbers[bInfo.chapter_id] || 0

    if (aChapter !== bChapter) return aChapter - bChapter
    return (aInfo.sentence_order || 0) - (bInfo.sentence_order || 0)
  })

  for (const word of sortedWords) {
    const lemmaId = word.lemma_id
    if (introducedLemmaIds.has(lemmaId) || seen.has(lemmaId)) continue

    seen.add(lemmaId)
    const lemma = word.lemmas
    const defs = typeof lemma.definitions === 'string' ? JSON.parse(lemma.definitions) : lemma.definitions

    unexposedLemmas.push({
      lemma_id: lemma.lemma_id,
      lemma: lemma.lemma_text,
      english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
      part_of_speech: lemma.part_of_speech,
      // Track sentence order for sorting
      chapter_number: chapterNumbers[sentenceInfo[word.sentence_id]?.chapter_id] || 0,
      sentence_order: sentenceInfo[word.sentence_id]?.sentence_order || 0,
      // New card defaults
      stability: null,
      difficulty: null,
      due_date: null,
      fsrs_state: FSRSState.NEW,
      reps: 0,
      lapses: 0,
      last_seen_at: null
    })
  }

  return unexposedLemmas
}

/**
 * Get unexposed phrases from unlocked chapters, sorted by sentence order
 * Uses phrase_occurrences -> sentences -> chapters path
 *
 * @param {string} userId - User ID
 * @param {Array<string>} chapterIds - Array of unlocked chapter UUIDs
 * @returns {Array<Object>} - Array of phrase card objects sorted by sentence order
 */
async function getUnexposedPhrases(userId, chapterIds) {
  // Get user's introduced phrases (reps >= 1 means reviewed at least once)
  const { data: userProgress } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const introducedPhraseIds = new Set((userProgress || []).map(p => p.phrase_id))

  // Get sentences from unlocked chapters
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id, sentence_order, sentence_text, sentence_translation, chapter_id')
    .in('chapter_id', chapterIds)
    .order('sentence_order', { ascending: true })

  if (!sentences || sentences.length === 0) return []

  const sentenceIds = sentences.map(s => s.sentence_id)

  // Build a map of sentence_id -> sentence info
  const sentenceInfo = {}
  for (const s of sentences) {
    sentenceInfo[s.sentence_id] = {
      chapter_id: s.chapter_id,
      sentence_order: s.sentence_order,
      sentence_text: s.sentence_text,
      sentence_translation: s.sentence_translation
    }
  }

  // Get chapter numbers for sorting
  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .in('chapter_id', chapterIds)

  const chapterNumbers = {}
  for (const c of chaptersData || []) {
    chapterNumbers[c.chapter_id] = c.chapter_number
  }

  // Get phrase occurrences from these sentences
  const { data: occurrences } = await supabase
    .from('phrase_occurrences')
    .select(`
      phrase_id,
      sentence_id,
      start_position,
      phrases!inner (
        phrase_id,
        phrase_text,
        definitions
      )
    `)
    .in('sentence_id', sentenceIds)

  if (!occurrences || occurrences.length === 0) return []

  // Sort by chapter number then sentence order
  const sortedOccurrences = occurrences.sort((a, b) => {
    const aInfo = sentenceInfo[a.sentence_id] || {}
    const bInfo = sentenceInfo[b.sentence_id] || {}
    const aChapter = chapterNumbers[aInfo.chapter_id] || 0
    const bChapter = chapterNumbers[bInfo.chapter_id] || 0

    if (aChapter !== bChapter) return aChapter - bChapter
    return (aInfo.sentence_order || 0) - (bInfo.sentence_order || 0)
  })

  // Filter to unexposed phrases and dedupe, keeping first occurrence
  const seen = new Set()
  const unexposedPhrases = []

  for (const occ of sortedOccurrences) {
    const phraseId = occ.phrase_id
    if (introducedPhraseIds.has(phraseId) || seen.has(phraseId)) continue

    seen.add(phraseId)
    const phrase = occ.phrases
    const sentInfo = sentenceInfo[occ.sentence_id] || {}
    const defs = typeof phrase.definitions === 'string' ? JSON.parse(phrase.definitions) : phrase.definitions

    unexposedPhrases.push({
      phrase_id: phrase.phrase_id,
      lemma: phrase.phrase_text,  // Use lemma field for display consistency
      english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
      part_of_speech: 'PHRASE',
      word_in_sentence: phrase.phrase_text,
      // Sentence info for display
      example_sentence: sentInfo.sentence_text,
      example_sentence_translation: sentInfo.sentence_translation,
      // Track sentence order for sorting
      chapter_number: chapterNumbers[sentInfo.chapter_id] || 0,
      sentence_order: sentInfo.sentence_order || 0,
      // New card defaults
      stability: null,
      difficulty: null,
      due_date: null,
      fsrs_state: FSRSState.NEW,
      reps: 0,
      lapses: 0,
      last_seen_at: null
    })
  }

  return unexposedPhrases
}

/**
 * Check which chapters are ready for phrases (20%+ lemmas introduced)
 * NOTE: This function is no longer used - phrases are now included from all unlocked chapters
 *
 * @param {string} userId - User ID
 * @param {Array<number>} unlockedChapters - Array of unlocked chapter numbers
 * @returns {Array<number>} - Array of chapter numbers ready for phrases
 * @deprecated Use getUnexposedPhrases with unlocked chapter IDs instead
 */
async function getChaptersReadyForPhrases(userId, unlockedChapters) {
  const readyChapters = []

  // Get user's introduced lemmas (reps >= 1 means reviewed at least once)
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const introducedLemmaIds = new Set((userProgress || []).map(p => p.lemma_id))

  for (const chapterNumber of unlockedChapters) {
    // Get chapter ID
    const { data: chapter } = await supabase
      .from('chapters')
      .select('chapter_id')
      .eq('chapter_number', chapterNumber)
      .single()

    if (!chapter) continue

    // Get sentences from this chapter
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', chapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    // Get lemmas from this chapter
    const { data: words } = await supabase
      .from('words')
      .select('lemma_id')
      .in('sentence_id', sentenceIds)

    const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]
    const introducedCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length
    const totalCount = chapterLemmaIds.length

    const introductionRate = totalCount > 0 ? introducedCount / totalCount : 0

    // 20% threshold for phrases
    if (introductionRate >= 0.20) {
      readyChapters.push(chapterNumber)
    }
  }

  return readyChapters
}

/**
 * Get unintroduced phrases from chapters ready for phrases
 *
 * @param {string} userId - User ID
 * @param {Array<number>} chapterNumbers - Chapter numbers ready for phrases
 * @param {number} limit - Max number of phrases to return
 * @returns {Array<Object>} - Array of phrase card objects
 */
async function getUnintroducedPhrases(userId, chapterNumbers, limit) {
  // Get phrase IDs the user has already introduced (reps >= 1)
  const { data: existingPhraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)
    .gte('reps', 1)

  const existingPhraseIds = new Set((existingPhraseProgress || []).map(p => p.phrase_id))

  // Get chapter IDs
  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_id')
    .in('chapter_number', chapterNumbers)

  const chapterIds = (chapters || []).map(c => c.chapter_id)

  // Get sentence IDs from these chapters
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id')
    .in('chapter_id', chapterIds)

  const sentenceIds = (sentences || []).map(s => s.sentence_id)

  // Get phrase occurrences from these sentences
  const { data: occurrences } = await supabase
    .from('phrase_occurrences')
    .select('phrase_id, sentence_id')
    .in('sentence_id', sentenceIds)

  // Get unique phrase IDs that haven't been introduced
  const phraseIdsInChapters = [...new Set((occurrences || []).map(o => o.phrase_id))]
  const unintroducedPhraseIds = phraseIdsInChapters.filter(id => !existingPhraseIds.has(id))

  if (unintroducedPhraseIds.length === 0) {
    return []
  }

  // Fetch phrase details with first occurrence sentence
  const { data: phrases } = await supabase
    .from('phrases')
    .select(`
      phrase_id,
      phrase_text,
      definitions,
      phrase_type,
      phrase_occurrences (
        sentence_id,
        sentences (
          sentence_text,
          sentence_translation
        )
      )
    `)
    .in('phrase_id', unintroducedPhraseIds.slice(0, limit))

  // Transform to card format
  return (phrases || []).map(phrase => {
    const defs = typeof phrase.definitions === 'string' ? JSON.parse(phrase.definitions) : phrase.definitions
    return {
      phrase_id: phrase.phrase_id,
      lemma: phrase.phrase_text,  // Use lemma field for display consistency
      english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
      part_of_speech: 'PHRASE',
      word_in_sentence: phrase.phrase_text,  // Phrase appears as-is in sentence
      example_sentence: phrase.phrase_occurrences?.[0]?.sentences?.sentence_text,
      example_sentence_translation: phrase.phrase_occurrences?.[0]?.sentences?.sentence_translation,
      // New card defaults
      stability: null,
      difficulty: null,
      due_date: null,
      fsrs_state: FSRSState.NEW,
      reps: 0,
      lapses: 0,
      last_seen_at: null,
      isExposure: false,
      isNew: true,
      card_type: 'phrase'
    }
  })
}

/**
 * Build a chapter focus session
 * 60% due from target chapter
 * 20% exposure from target chapter
 * 20% due from other chapters
 *
 * @param {string} userId - User ID
 * @param {number} chapterNumber - Target chapter
 * @param {number} sessionSize - Max cards in session
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildChapterFocusSession(userId, chapterNumber, sessionSize = DEFAULT_SESSION_SIZE) {
  // Get chapter ID
  const { data: chapter } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number, title')
    .eq('chapter_number', chapterNumber)
    .single()

  if (!chapter) {
    return {
      cards: [],
      stats: {},
      mode: SessionMode.CHAPTER,
      error: `Chapter ${chapterNumber} not found`
    }
  }

  // Get user activity level
  const { data: dailyStats } = await supabase
    .from('user_daily_stats')
    .select('review_date, words_reviewed')
    .eq('user_id', userId)
    .limit(7)

  const activityLevel = getUserActivityLevel(dailyStats)

  // Get sentence IDs from this chapter
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id')
    .eq('chapter_id', chapter.chapter_id)

  const sentenceIds = (sentences || []).map(s => s.sentence_id)

  // Get lemma IDs from this chapter
  const { data: words } = await supabase
    .from('words')
    .select('lemma_id')
    .in('sentence_id', sentenceIds)

  const chapterLemmaIds = new Set((words || []).map(w => w.lemma_id))

  // Fetch all user progress
  const { data: allProgress } = await supabase
    .from('user_lemma_progress')
    .select(`
      *,
      lemmas!inner (
        lemma_id,
        lemma_text,
        definitions,
        part_of_speech
      )
    `)
    .eq('user_id', userId)

  // Separate into chapter cards and other cards
  const chapterDue = []
  const chapterExposure = []
  const otherDue = []

  for (const card of allProgress || []) {
    const enrichedCard = enrichCardWithLemma(card)
    const isChapterCard = chapterLemmaIds.has(card.lemma_id)

    if (isChapterCard) {
      if (isCardDue(enrichedCard)) {
        chapterDue.push({ ...enrichedCard, isExposure: false })
      } else if (shouldIncludeForExposure(enrichedCard, activityLevel.daysBetween)) {
        chapterExposure.push({ ...enrichedCard, isExposure: true })
      }
    } else {
      if (isCardDue(enrichedCard)) {
        otherDue.push({ ...enrichedCard, isExposure: false })
      }
    }
  }

  // Calculate slot distribution (60/20/20)
  const chapterDueSlots = Math.floor(sessionSize * 0.6)
  const chapterExposureSlots = Math.floor(sessionSize * 0.2)
  const otherDueSlots = sessionSize - chapterDueSlots - chapterExposureSlots

  // Select cards
  const selectedChapterDue = shuffleArray(chapterDue).slice(0, chapterDueSlots)
  const selectedChapterExposure = shuffleArray(chapterExposure).slice(0, chapterExposureSlots)
  const selectedOtherDue = shuffleArray(otherDue).slice(0, otherDueSlots)

  // Combine and shuffle
  const allCards = shuffleArray([
    ...selectedChapterDue,
    ...selectedChapterExposure,
    ...selectedOtherDue
  ])

  // Add sentences
  const cardsWithSentences = await addSentencesToCards(allCards)

  const stats = {
    chapter: chapterNumber,
    chapterTitle: chapter.title,
    chapterDueAvailable: chapterDue.length,
    chapterDueSelected: selectedChapterDue.length,
    chapterExposureAvailable: chapterExposure.length,
    chapterExposureSelected: selectedChapterExposure.length,
    otherDueAvailable: otherDue.length,
    otherDueSelected: selectedOtherDue.length,
    dueRemaining: Math.max(0, chapterDue.length + otherDue.length - selectedChapterDue.length - selectedOtherDue.length),
    newRemaining: 0
  }

  console.log('📕 Chapter focus session built:', stats)

  return {
    cards: cardsWithSentences,
    stats,
    mode: SessionMode.CHAPTER,
    chapterInfo: chapter
  }
}

/**
 * Build a song vocabulary session
 * Includes: lemmas (from song_lemmas), phrases (from song_phrases), slang (from song_slang)
 * All three types mixed together, using the same card UI
 *
 * @param {string} userId - User ID
 * @param {string} songId - Song ID to learn from
 * @param {number} sessionSize - Max cards in session
 * @param {Object} options - { allowExplicit: boolean, learnOnly: boolean }
 * @returns {Object} - { cards, stats, mode, songInfo }
 */
export async function buildSongSession(userId, songId, sessionSize = DEFAULT_SESSION_SIZE, options = {}) {
  const { allowExplicit = true, learnOnly = false } = options

  // Fetch song info
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('song_id, title, artist, dialect')
    .eq('song_id', songId)
    .single()

  if (songError || !song) {
    console.error('Song not found:', songError)
    return {
      cards: [],
      stats: {},
      mode: SessionMode.SONG,
      error: 'Song not found'
    }
  }

  // Check user's explicit content setting if not overridden
  let filterVulgar = !allowExplicit
  if (allowExplicit) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('allow_explicit_content')
      .eq('user_id', userId)
      .maybeSingle()
    filterVulgar = userSettings?.allow_explicit_content === false
  }

  // Fetch song lemmas with user progress
  const { data: songLemmasData } = await supabase
    .from('song_lemmas')
    .select(`
      lemma_id,
      first_line_id,
      lemmas!inner (
        lemma_id,
        lemma_text,
        definitions,
        part_of_speech,
        is_stop_word
      )
    `)
    .eq('song_id', songId)
    .eq('lemmas.is_stop_word', false)

  // Get user progress for these lemmas
  const lemmaIds = (songLemmasData || []).map(sl => sl.lemma_id)
  const { data: userLemmaProgress } = await supabase
    .from('user_lemma_progress')
    .select('*')
    .eq('user_id', userId)
    .in('lemma_id', lemmaIds)

  const lemmaProgressMap = {}
  for (const p of userLemmaProgress || []) {
    lemmaProgressMap[p.lemma_id] = p
  }

  // Fetch song phrases with user progress
  const { data: songPhrasesData } = await supabase
    .from('song_phrases')
    .select(`
      phrase_id,
      first_line_id,
      phrases!inner (
        phrase_id,
        phrase_text,
        definitions
      )
    `)
    .eq('song_id', songId)

  const phraseIds = (songPhrasesData || []).map(sp => sp.phrase_id)
  const { data: userPhraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('*')
    .eq('user_id', userId)
    .in('phrase_id', phraseIds)

  const phraseProgressMap = {}
  for (const p of userPhraseProgress || []) {
    phraseProgressMap[p.phrase_id] = p
  }

  // Fetch song slang with user progress (filter vulgar if needed)
  let slangQuery = supabase
    .from('song_slang')
    .select(`
      slang_id,
      first_line_id,
      slang_terms!inner (
        slang_id,
        term,
        definition,
        region,
        cultural_note,
        formality,
        example_spanish,
        example_english
      )
    `)
    .eq('song_id', songId)

  if (filterVulgar) {
    slangQuery = slangQuery.neq('slang_terms.formality', 'vulgar')
  }

  const { data: songSlangData } = await slangQuery

  const slangIds = (songSlangData || []).map(ss => ss.slang_id)
  const { data: userSlangProgress } = await supabase
    .from('user_slang_progress')
    .select('*')
    .eq('user_id', userId)
    .in('slang_id', slangIds)

  const slangProgressMap = {}
  for (const p of userSlangProgress || []) {
    slangProgressMap[p.slang_id] = p
  }

  // Build card arrays
  const newCards = []
  const dueCards = []

  // Process lemmas
  for (const sl of songLemmasData || []) {
    const lemma = sl.lemmas
    const progress = lemmaProgressMap[sl.lemma_id]
    const isIntroduced = progress?.reps >= 1
    const defs = typeof lemma.definitions === 'string' ? JSON.parse(lemma.definitions) : lemma.definitions

    const card = {
      lemma_id: lemma.lemma_id,
      lemma: lemma.lemma_text,
      english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
      part_of_speech: lemma.part_of_speech,
      card_type: 'lemma',
      // FSRS fields from progress
      stability: progress?.stability,
      difficulty: progress?.difficulty,
      due_date: progress?.due_date,
      fsrs_state: progress?.fsrs_state || FSRSState.NEW,
      reps: progress?.reps || 0,
      lapses: progress?.lapses || 0,
      last_seen_at: progress?.last_seen_at
    }

    if (!isIntroduced) {
      newCards.push({ ...card, isNew: true, isExposure: false })
    } else if (!learnOnly && isCardDue(card)) {
      dueCards.push({ ...card, isNew: false, isExposure: false })
    }
  }

  // Process phrases
  for (const sp of songPhrasesData || []) {
    const phrase = sp.phrases
    const progress = phraseProgressMap[sp.phrase_id]
    const isIntroduced = progress?.reps >= 1
    const defs = typeof phrase.definitions === 'string' ? JSON.parse(phrase.definitions) : phrase.definitions

    const card = {
      phrase_id: phrase.phrase_id,
      lemma: phrase.phrase_text,
      english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
      part_of_speech: 'PHRASE',
      word_in_sentence: phrase.phrase_text,
      card_type: 'phrase',
      stability: progress?.stability,
      difficulty: progress?.difficulty,
      due_date: progress?.due_date,
      fsrs_state: progress?.fsrs_state || FSRSState.NEW,
      reps: progress?.reps || 0,
      lapses: progress?.lapses || 0,
      last_seen_at: progress?.last_seen_at
    }

    if (!isIntroduced) {
      newCards.push({ ...card, isNew: true, isExposure: false })
    } else if (!learnOnly && isCardDue(card)) {
      dueCards.push({ ...card, isNew: false, isExposure: false })
    }
  }

  // Process slang
  for (const ss of songSlangData || []) {
    const slang = ss.slang_terms
    const progress = slangProgressMap[ss.slang_id]
    const isIntroduced = progress?.reps >= 1

    const card = {
      slang_id: slang.slang_id,
      lemma: slang.term,
      english_definition: slang.definition,
      part_of_speech: 'SLANG',
      card_type: 'slang',
      // Slang-specific fields
      cultural_note: slang.cultural_note,
      region: slang.region,
      formality: slang.formality,
      example_sentence: slang.example_spanish,
      example_sentence_translation: slang.example_english,
      // FSRS fields
      stability: progress?.stability,
      difficulty: progress?.difficulty,
      due_date: progress?.due_date,
      fsrs_state: progress?.fsrs_state || FSRSState.NEW,
      reps: progress?.reps || 0,
      lapses: progress?.lapses || 0,
      last_seen_at: progress?.last_seen_at
    }

    if (!isIntroduced) {
      newCards.push({ ...card, isNew: true, isExposure: false })
    } else if (!learnOnly && isCardDue(card)) {
      dueCards.push({ ...card, isNew: false, isExposure: false })
    }
  }

  // Proportionally select cards
  const totalPool = newCards.length + dueCards.length
  if (totalPool === 0) {
    return {
      cards: [],
      stats: { message: 'All vocabulary mastered!' },
      mode: SessionMode.SONG,
      songInfo: song
    }
  }

  // If learn only, just take new cards
  let selectedCards = []
  if (learnOnly) {
    selectedCards = shuffleArray(newCards).slice(0, sessionSize)
  } else {
    // Mix due cards first, then fill with new
    const selectedDue = dueCards.slice(0, sessionSize)
    const remaining = sessionSize - selectedDue.length
    const selectedNew = shuffleArray(newCards).slice(0, remaining)
    selectedCards = shuffleArray([...selectedDue, ...selectedNew])
  }

  // Add sentences to lemma cards (slang already has examples)
  const lemmaCards = selectedCards.filter(c => c.card_type === 'lemma')
  const otherCards = selectedCards.filter(c => c.card_type !== 'lemma')
  const lemmaCardsWithSentences = await addSongSentencesToCards(lemmaCards, songId)

  const finalCards = shuffleArray([...lemmaCardsWithSentences, ...otherCards])

  // Count by type
  const lemmaCount = finalCards.filter(c => c.card_type === 'lemma').length
  const phraseCount = finalCards.filter(c => c.card_type === 'phrase').length
  const slangCount = finalCards.filter(c => c.card_type === 'slang').length

  const stats = {
    totalAvailable: totalPool,
    selected: finalCards.length,
    lemmaCount,
    phraseCount,
    slangCount,
    newRemaining: Math.max(0, newCards.length - finalCards.filter(c => c.isNew).length),
    dueRemaining: Math.max(0, dueCards.length - finalCards.filter(c => !c.isNew).length)
  }

  console.log('🎵 Song session built:', stats)

  return {
    cards: finalCards,
    stats,
    mode: SessionMode.SONG,
    songInfo: song
  }
}

/**
 * Add example sentences from song lines to lemma cards
 *
 * @param {Array} cards - Array of lemma card objects
 * @param {string} songId - Song ID to get lines from
 * @returns {Array} - Cards with example_sentence and example_sentence_translation
 */
async function addSongSentencesToCards(cards, songId) {
  if (cards.length === 0) return cards

  const lemmaIds = cards.map(c => c.lemma_id)

  // Get first_line_id for each lemma from song_lemmas
  const { data: songLemmas } = await supabase
    .from('song_lemmas')
    .select('lemma_id, first_line_id')
    .eq('song_id', songId)
    .in('lemma_id', lemmaIds)

  const lineIds = (songLemmas || []).filter(sl => sl.first_line_id).map(sl => sl.first_line_id)

  if (lineIds.length === 0) return cards

  // Get line text
  const { data: lines } = await supabase
    .from('song_lines')
    .select('line_id, line_text, translation')
    .in('line_id', lineIds)

  const lineMap = {}
  for (const line of lines || []) {
    lineMap[line.line_id] = {
      sentence_text: line.line_text,
      sentence_translation: line.translation
    }
  }

  // Map lemma_id -> first_line_id
  const lemmaLineMap = {}
  for (const sl of songLemmas || []) {
    if (sl.first_line_id) {
      lemmaLineMap[sl.lemma_id] = sl.first_line_id
    }
  }

  return cards.map(card => {
    const lineId = lemmaLineMap[card.lemma_id]
    const line = lineId ? lineMap[lineId] : null
    return {
      ...card,
      example_sentence: line?.sentence_text || card.example_sentence,
      example_sentence_translation: line?.sentence_translation || card.example_sentence_translation
    }
  })
}

/**
 * Get unlocked chapters for a user
 * A chapter is unlocked when 95% of the previous chapter's words are introduced
 *
 * @param {string} userId - User ID
 * @returns {Array<number>} - Array of unlocked chapter numbers
 */
export async function getUnlockedChapters(userId) {
  // Run all queries in parallel (3 queries total - no URL length issues)
  const [
    { data: chapters },
    { data: chapterStats },
    { data: userProgress }
  ] = await Promise.all([
    // 1. All chapters ordered
    supabase
      .from('chapters')
      .select('chapter_id, chapter_number')
      .order('chapter_number', { ascending: true }),
    // 2. Pre-computed chapter vocabulary stats (totals)
    supabase
      .from('chapter_vocabulary_stats')
      .select('chapter_id, total_lemmas, total_phrases'),
    // 3. User's introduced counts per chapter (via RPC - no URL length issues)
    supabase.rpc('get_user_chapter_progress', { p_user_id: userId })
  ])

  if (!chapters || chapters.length === 0) {
    return [1] // First chapter always unlocked
  }

  // Build stats lookup: chapter_id -> {total_lemmas, total_phrases}
  const statsMap = new Map()
  for (const stat of (chapterStats || [])) {
    statsMap.set(stat.chapter_id, {
      total_lemmas: stat.total_lemmas,
      total_phrases: stat.total_phrases
    })
  }

  // Build progress lookup: chapter_id -> {introduced_lemmas, introduced_phrases}
  const progressMap = new Map()
  for (const row of (userProgress || [])) {
    progressMap.set(row.chapter_id, {
      introduced_lemmas: Number(row.introduced_lemmas) || 0,
      introduced_phrases: Number(row.introduced_phrases) || 0
    })
  }

  // First chapter always unlocked
  const unlockedChapters = [1]

  // Check each chapter's introduction rate
  for (let i = 0; i < chapters.length - 1; i++) {
    const currentChapter = chapters[i]
    const chapterId = currentChapter.chapter_id

    const stats = statsMap.get(chapterId) || { total_lemmas: 0, total_phrases: 0 }
    const progress = progressMap.get(chapterId) || { introduced_lemmas: 0, introduced_phrases: 0 }

    const totalCount = stats.total_lemmas + stats.total_phrases
    const introducedCount = progress.introduced_lemmas + progress.introduced_phrases
    const introductionRate = totalCount > 0 ? introducedCount / totalCount : 0

    if (introductionRate >= 0.95) {
      const nextChapter = chapters[i + 1]
      if (nextChapter) {
        unlockedChapters.push(nextChapter.chapter_number)
      }
    } else {
      break
    }
  }

  return unlockedChapters
}

/**
 * Enrich card with lemma data from joined query
 *
 * @param {Object} card - Card with nested lemmas object
 * @returns {Object} - Flattened card object
 */
function enrichCardWithLemma(card) {
  const lemma = card.lemmas || {}
  // Parse definitions (may be JSON string or array)
  const defs = typeof lemma.definitions === 'string'
    ? JSON.parse(lemma.definitions)
    : lemma.definitions
  return {
    ...card,
    lemma_id: card.lemma_id,
    lemma: lemma.lemma_text,
    english_definition: Array.isArray(defs) ? defs.join(', ') : defs,
    part_of_speech: lemma.part_of_speech
  }
}

/**
 * Add example sentences to cards
 *
 * @param {Array} cards - Array of card objects
 * @returns {Array} - Cards with example_sentence, example_sentence_translation, and word_in_sentence
 */
export async function addSentencesToCards(cards) {
  if (cards.length === 0) return cards

  const lemmaIds = cards.map(c => c.lemma_id)

  // Get words with sentences for these lemmas - include word_text for verb conjugations
  const { data: wordsData } = await supabase
    .from('words')
    .select(`
      lemma_id,
      word_text,
      sentences!inner (
        sentence_text,
        sentence_translation
      )
    `)
    .in('lemma_id', lemmaIds)
    .not('sentences.sentence_text', 'is', null)

  // Build sentence map (first sentence per lemma)
  // Include word_text so we can bold the actual conjugated form, not the lemma
  const sentenceMap = {}
  for (const word of wordsData || []) {
    if (!sentenceMap[word.lemma_id] && word.sentences) {
      sentenceMap[word.lemma_id] = {
        sentence_text: word.sentences.sentence_text,
        sentence_translation: word.sentences.sentence_translation,
        word_in_sentence: word.word_text  // The actual word form in the sentence
      }
    }
  }

  // Add sentences to cards
  return cards.map(card => ({
    ...card,
    example_sentence: sentenceMap[card.lemma_id]?.sentence_text,
    example_sentence_translation: sentenceMap[card.lemma_id]?.sentence_translation,
    word_in_sentence: sentenceMap[card.lemma_id]?.word_in_sentence
  }))
}

/**
 * Fisher-Yates shuffle
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array (new array)
 */
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default {
  buildSession,
  buildReviewSession,
  buildLearnSession,
  buildChapterFocusSession,
  buildSongSession,
  getUnlockedChapters,
  addSentencesToCards,
  addSentencesToPhraseCards,
  SessionMode
}
