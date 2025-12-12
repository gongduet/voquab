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
  CHAPTER: 'chapter'
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

  console.log('📊 Session size from settings:', sessionSize)

  switch (mode) {
    case SessionMode.REVIEW:
      return buildReviewSession(userId, sessionSize)

    case SessionMode.LEARN:
      return buildLearnSession(userId, sessionSize)

    case SessionMode.CHAPTER:
      if (!options.chapterNumber) {
        throw new Error('Chapter number required for chapter focus mode')
      }
      return buildChapterFocusSession(userId, options.chapterNumber, sessionSize)

    default:
      return buildReviewSession(userId, sessionSize)
  }
}

/**
 * Build a review session with due cards + exposure (includes lemmas and phrases)
 *
 * @param {string} userId - User ID
 * @param {number} sessionSize - Max cards in session
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildReviewSession(userId, sessionSize = DEFAULT_SESSION_SIZE) {
  // Get user activity level for exposure settings
  const { data: dailyStats } = await supabase
    .from('user_daily_stats')
    .select('review_date, words_reviewed')
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(7)

  const activityLevel = getUserActivityLevel(dailyStats)

  // Fetch all lemma cards with progress
  const { data: lemmaProgressData, error: lemmaProgressError } = await supabase
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
    .eq('lemmas.is_stop_word', false)

  if (lemmaProgressError) {
    console.error('Error fetching lemma progress:', lemmaProgressError)
    return { cards: [], stats: {}, mode: SessionMode.REVIEW, error: lemmaProgressError.message }
  }

  // Fetch all phrase cards with progress
  const { data: phraseProgressData, error: phraseProgressError } = await supabase
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

  if (phraseProgressError) {
    console.error('Error fetching phrase progress:', phraseProgressError)
    // Continue without phrases rather than failing
  }

  // Separate due cards and exposure candidates for lemmas
  const dueCards = []
  const exposureCandidates = []

  for (const card of lemmaProgressData || []) {
    const enrichedCard = enrichCardWithLemma(card)
    enrichedCard.card_type = 'lemma'

    if (isCardDue(enrichedCard)) {
      dueCards.push({ ...enrichedCard, isExposure: false })
    } else if (shouldIncludeForExposure(enrichedCard, activityLevel.daysBetween)) {
      exposureCandidates.push({ ...enrichedCard, isExposure: true })
    }
  }

  // Process phrase cards
  for (const card of phraseProgressData || []) {
    const enrichedCard = enrichCardWithPhrase(card)
    enrichedCard.card_type = 'phrase'

    if (isCardDue(enrichedCard)) {
      dueCards.push({ ...enrichedCard, isExposure: false })
    } else if (shouldIncludeForExposure(enrichedCard, activityLevel.daysBetween)) {
      exposureCandidates.push({ ...enrichedCard, isExposure: true })
    }
  }

  // Select cards: due cards first, then exposure
  const selectedDue = dueCards.slice(0, sessionSize)
  const remainingSlots = sessionSize - selectedDue.length
  const exposureCount = Math.min(remainingSlots, activityLevel.exposureCards)

  // Randomly select exposure cards
  const shuffledExposure = shuffleArray(exposureCandidates)
  const selectedExposure = shuffledExposure.slice(0, exposureCount)

  // Combine and shuffle
  const allCards = shuffleArray([...selectedDue, ...selectedExposure])

  // Fetch sentences for lemma cards only (phrases already have sentences)
  const lemmaCards = allCards.filter(c => c.card_type === 'lemma')
  const phraseCards = allCards.filter(c => c.card_type === 'phrase')

  const lemmaCardsWithSentences = await addSentencesToCards(lemmaCards)
  const phraseCardsWithSentences = await addSentencesToPhraseCards(phraseCards)

  const cardsWithSentences = shuffleArray([...lemmaCardsWithSentences, ...phraseCardsWithSentences])

  const stats = {
    totalDue: dueCards.length,
    selectedDue: selectedDue.length,
    exposureAvailable: exposureCandidates.length,
    selectedExposure: selectedExposure.length,
    activityLevel: activityLevel.level,
    lemmaCount: lemmaCardsWithSentences.length,
    phraseCount: phraseCardsWithSentences.length
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
  return {
    ...card,
    phrase_id: card.phrase_id,
    lemma: phrase.phrase_text,  // Use lemma field for display consistency
    english_definition: Array.isArray(phrase.definitions) ? phrase.definitions[0] : phrase.definitions,
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
async function addSentencesToPhraseCards(cards) {
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
 *
 * @param {string} userId - User ID
 * @param {number} sessionSize - Max cards in session
 * @returns {Object} - { cards, stats, mode }
 */
export async function buildLearnSession(userId, sessionSize = DEFAULT_SESSION_SIZE) {
  // Get unlocked chapters
  const unlockedChapters = await getUnlockedChapters(userId)

  if (unlockedChapters.length === 0) {
    // First chapter is always unlocked
    unlockedChapters.push(1)
  }

  // Get lemma IDs the user has already started
  const { data: existingProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)

  const existingLemmaIds = new Set((existingProgress || []).map(p => p.lemma_id))

  // Fetch unintroduced lemmas from unlocked chapters
  // We need to find lemmas that appear in sentences from unlocked chapters
  const { data: chaptersData } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .in('chapter_number', unlockedChapters)

  const chapterIds = (chaptersData || []).map(c => c.chapter_id)
  const chapterIdToNumber = {}
  for (const ch of chaptersData || []) {
    chapterIdToNumber[ch.chapter_id] = ch.chapter_number
  }

  // Get sentence IDs from these chapters
  const { data: sentences } = await supabase
    .from('sentences')
    .select('sentence_id, chapter_id')
    .in('chapter_id', chapterIds)

  const sentenceIds = (sentences || []).map(s => s.sentence_id)

  // Get lemma IDs from words in these sentences
  const { data: wordsData } = await supabase
    .from('words')
    .select('lemma_id')
    .in('sentence_id', sentenceIds)

  const chapterLemmaIds = [...new Set((wordsData || []).map(w => w.lemma_id))]

  // Filter to unintroduced lemmas
  const unintroducedLemmaIds = chapterLemmaIds.filter(id => !existingLemmaIds.has(id))

  // Check if chapters are ready for phrases (20% of lemmas introduced)
  const chaptersReadyForPhrases = await getChaptersReadyForPhrases(userId, unlockedChapters)

  // Calculate lemma vs phrase count (80/20 split if phrases available)
  const hasPhraseChapters = chaptersReadyForPhrases.length > 0
  const lemmaCount = hasPhraseChapters ? Math.ceil(sessionSize * 0.8) : sessionSize
  const phraseCount = hasPhraseChapters ? Math.floor(sessionSize * 0.2) : 0

  // Fetch ALL unintroduced lemmas that are NOT stop words, then limit
  const { data: lemmas } = await supabase
    .from('lemmas')
    .select('*')
    .in('lemma_id', unintroducedLemmaIds)
    .eq('is_stop_word', false)
    .limit(lemmaCount)

  console.log('📗 Learn session query:', {
    unintroducedCount: unintroducedLemmaIds.length,
    nonStopWordCount: lemmas?.length,
    sessionSize,
    lemmaCount,
    phraseCount,
    chaptersReadyForPhrases
  })

  // Build card objects for new words
  const newCards = (lemmas || []).map(lemma => ({
    lemma_id: lemma.lemma_id,
    lemma: lemma.lemma_text,
    english_definition: Array.isArray(lemma.definitions) ? lemma.definitions[0] : lemma.definitions,
    part_of_speech: lemma.part_of_speech,
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
    card_type: 'lemma'
  }))

  // Fetch unintroduced phrases if chapters are ready
  let phraseCards = []
  if (phraseCount > 0) {
    phraseCards = await getUnintroducedPhrases(userId, chaptersReadyForPhrases, phraseCount)
  }

  // Add sentences to lemma cards
  const lemmaCardsWithSentences = await addSentencesToCards(newCards)

  // Combine and shuffle
  const allCards = shuffleArray([...lemmaCardsWithSentences, ...phraseCards])

  if (allCards.length === 0) {
    return {
      cards: [],
      stats: { unintroducedAvailable: 0, selected: 0 },
      mode: SessionMode.LEARN,
      message: 'No new words available. Unlock more chapters or switch to Review mode.'
    }
  }

  const stats = {
    unintroducedAvailable: unintroducedLemmaIds.length,
    selected: allCards.length,
    lemmaCount: lemmaCardsWithSentences.length,
    phraseCount: phraseCards.length,
    unlockedChapters: unlockedChapters.length,
    chaptersReadyForPhrases: chaptersReadyForPhrases.length
  }

  console.log('📗 Learn session built:', stats)

  return {
    cards: allCards,
    stats,
    mode: SessionMode.LEARN
  }
}

/**
 * Check which chapters are ready for phrases (20%+ lemmas introduced)
 *
 * @param {string} userId - User ID
 * @param {Array<number>} unlockedChapters - Array of unlocked chapter numbers
 * @returns {Array<number>} - Array of chapter numbers ready for phrases
 */
async function getChaptersReadyForPhrases(userId, unlockedChapters) {
  const readyChapters = []

  // Get user's introduced lemmas
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)

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
  // Get phrase IDs the user has already started
  const { data: existingPhraseProgress } = await supabase
    .from('user_phrase_progress')
    .select('phrase_id')
    .eq('user_id', userId)

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
  return (phrases || []).map(phrase => ({
    phrase_id: phrase.phrase_id,
    lemma: phrase.phrase_text,  // Use lemma field for display consistency
    english_definition: Array.isArray(phrase.definitions) ? phrase.definitions[0] : phrase.definitions,
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
  }))
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
    otherDueSelected: selectedOtherDue.length
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
 * Get unlocked chapters for a user
 * A chapter is unlocked when 95% of the previous chapter's words are introduced
 *
 * @param {string} userId - User ID
 * @returns {Array<number>} - Array of unlocked chapter numbers
 */
export async function getUnlockedChapters(userId) {
  // Get all chapters
  const { data: chapters } = await supabase
    .from('chapters')
    .select('chapter_id, chapter_number')
    .order('chapter_number', { ascending: true })

  if (!chapters || chapters.length === 0) {
    return [1] // First chapter always unlocked
  }

  // Get user's introduced lemmas
  const { data: userProgress } = await supabase
    .from('user_lemma_progress')
    .select('lemma_id')
    .eq('user_id', userId)

  const introducedLemmaIds = new Set((userProgress || []).map(p => p.lemma_id))

  const unlockedChapters = [1] // First chapter always unlocked

  for (let i = 0; i < chapters.length - 1; i++) {
    const currentChapter = chapters[i]

    // Get lemmas for current chapter
    const { data: sentences } = await supabase
      .from('sentences')
      .select('sentence_id')
      .eq('chapter_id', currentChapter.chapter_id)

    const sentenceIds = (sentences || []).map(s => s.sentence_id)

    const { data: words } = await supabase
      .from('words')
      .select('lemma_id')
      .in('sentence_id', sentenceIds)

    const chapterLemmaIds = [...new Set((words || []).map(w => w.lemma_id))]
    const introducedCount = chapterLemmaIds.filter(id => introducedLemmaIds.has(id)).length
    const totalCount = chapterLemmaIds.length

    const introductionRate = totalCount > 0 ? introducedCount / totalCount : 0

    // 95% threshold to unlock next chapter
    if (introductionRate >= 0.95) {
      const nextChapter = chapters[i + 1]
      if (nextChapter && !unlockedChapters.includes(nextChapter.chapter_number)) {
        unlockedChapters.push(nextChapter.chapter_number)
      }
    } else {
      // Stop - can't unlock further chapters
      break
    }
  }

  return unlockedChapters.sort((a, b) => a - b)
}

/**
 * Enrich card with lemma data from joined query
 *
 * @param {Object} card - Card with nested lemmas object
 * @returns {Object} - Flattened card object
 */
function enrichCardWithLemma(card) {
  const lemma = card.lemmas || {}
  return {
    ...card,
    lemma_id: card.lemma_id,
    lemma: lemma.lemma_text,
    english_definition: Array.isArray(lemma.definitions) ? lemma.definitions[0] : lemma.definitions,
    part_of_speech: lemma.part_of_speech
  }
}

/**
 * Add example sentences to cards
 *
 * @param {Array} cards - Array of card objects
 * @returns {Array} - Cards with example_sentence, example_sentence_translation, and word_in_sentence
 */
async function addSentencesToCards(cards) {
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
  getUnlockedChapters,
  SessionMode
}
