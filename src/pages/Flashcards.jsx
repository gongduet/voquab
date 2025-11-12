import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculateCurrentHealth, getHealthBoost, applyHealthBoost } from '../utils/healthCalculations'
import { selectCardsForSession } from '../utils/priorityCalculations'
import { calculateMasteryChange } from '../utils/timeGateCalculations'
import { checkBadgesOnPackageComplete } from '../utils/badgeCalculations'
import BadgeNotification from '../components/BadgeNotification'

// Spanish stop words - ONLY super basic words that shouldn't be flashcards
const STOP_WORDS = new Set([
  // Articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // Basic prepositions
  'de', 'a', 'en',
  // Basic conjunctions
  'y', 'o',
  // Basic pronouns
  'me', 'te', 'se', 'le', 'lo',
  // Very common words
  'es', 'no', 'sí',
])

export default function Flashcards() {
  const [cards, setCards] = useState([])
  const [cardQueue, setCardQueue] = useState([]) // Queue of cards to review
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isComplete, setIsComplete] = useState(false)
  const [filterMode, setFilterMode] = useState(null) // 'due' or null

  // Session metrics
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [sessionRatings, setSessionRatings] = useState({
    'easy': 0,
    'medium': 0,
    'hard': 0,
    'dont-know': 0
  })
  const [reviewedCardIds, setReviewedCardIds] = useState(new Set()) // Track unique cards reviewed
  const [totalReviews, setTotalReviews] = useState(0) // Total reviews (including re-queued)
  const [challengingWords, setChallengingWords] = useState([]) // Words that were difficult
  const [timeGateMessage, setTimeGateMessage] = useState(null) // Time gate feedback message

  // Package mode state
  const [packageId, setPackageId] = useState(null)
  const [packageData, setPackageData] = useState(null)
  const [isPackageMode, setIsPackageMode] = useState(false)
  const [earnedBadges, setEarnedBadges] = useState([])

  // Badge notification state
  const [badgeQueue, setBadgeQueue] = useState([])
  const [currentBadge, setCurrentBadge] = useState(null)

  // Waypoint state (for package mode)
  const [currentWaypoint, setCurrentWaypoint] = useState(null)
  const [allWaypoints, setAllWaypoints] = useState([])
  const [waypointComplete, setWaypointComplete] = useState(false)

  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const filter = searchParams.get('filter')
    const pkgId = searchParams.get('package')

    setFilterMode(filter)
    setPackageId(pkgId)
    setIsPackageMode(!!pkgId)

    if (pkgId) {
      loadPackageMode(pkgId)
    } else {
      fetchVocabulary(filter)
    }
  }, [searchParams])

  // Handle showing badges sequentially
  useEffect(() => {
    if (earnedBadges.length > 0 && badgeQueue.length === 0 && !currentBadge) {
      // New badges earned - add to queue
      setBadgeQueue([...earnedBadges])
    }
  }, [earnedBadges])

  useEffect(() => {
    if (badgeQueue.length > 0 && !currentBadge) {
      // Show next badge from queue
      const nextBadge = badgeQueue[0]
      setCurrentBadge(nextBadge)
      setBadgeQueue(badgeQueue.slice(1))
    }
  }, [badgeQueue, currentBadge])

  function handleBadgeClose() {
    setCurrentBadge(null)
    // Next badge will be shown automatically by the useEffect above
  }

  async function fetchUserSettings() {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('cards_per_session')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching user settings:', error)
        return 25 // Default
      }

      return data?.cards_per_session || 25 // Default to 25 if not set
    } catch (err) {
      console.error('Error in fetchUserSettings:', err)
      return 25 // Default
    }
  }

  async function loadPackageMode(pkgId) {
    try {
      setLoading(true)
      setError(null)

      console.log('📦 Loading package mode for package:', pkgId)

      // Load package data
      const { data: pkg, error: pkgError } = await supabase
        .from('user_packages')
        .select('*')
        .eq('package_id', pkgId)
        .eq('user_id', user.id)
        .single()

      if (pkgError || !pkg) {
        throw new Error('Package not found')
      }

      console.log('📦 Package data loaded:', pkg)
      setPackageData(pkg)

      // Load waypoints for this package
      const { data: waypoints, error: waypointsError } = await supabase
        .from('user_waypoints')
        .select('*')
        .eq('package_id', pkgId)
        .order('waypoint_number')

      if (waypointsError) {
        throw waypointsError
      }

      console.log(`🗺️ Loaded ${waypoints?.length || 0} waypoints`)
      setAllWaypoints(waypoints || [])

      // Find first active or pending waypoint
      const activeWaypoint = waypoints?.find(w => w.status === 'active') ||
                             waypoints?.find(w => w.status === 'pending')

      if (!activeWaypoint) {
        throw new Error('No active waypoint found')
      }

      console.log(`🎯 Current waypoint: ${activeWaypoint.name} (${activeWaypoint.words_completed}/${activeWaypoint.total_words})`)
      setCurrentWaypoint(activeWaypoint)

      // Load package words (only unreviewed words from current waypoint)
      const { data: pkgWords, error: wordsError } = await supabase
        .from('package_words')
        .select(`
          *,
          vocabulary (
            vocab_id,
            lemma,
            english_definition,
            part_of_speech,
            is_common_word,
            vocabulary_occurrences!inner(
              word_position,
              sentences!inner(
                sentence_id,
                sentence_text,
                sentence_translation,
                chapter_id,
                chapters!inner(
                  chapter_number,
                  title
                )
              )
            )
          )
        `)
        .eq('package_id', pkgId)
        .eq('waypoint_id', activeWaypoint.waypoint_id)
        .eq('reviewed', false)
        .order('word_order')

      if (wordsError) {
        throw wordsError
      }

      console.log(`📚 Loaded ${pkgWords?.length || 0} unreviewed package words`)

      // Get user progress for these words
      const vocabIds = pkgWords.map(w => w.vocab_id)
      const { data: progress } = await supabase
        .from('user_vocabulary_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('vocab_id', vocabIds)

      const progressMap = new Map()
      if (progress) {
        progress.forEach(p => progressMap.set(p.vocab_id, p))
      }

      // Format words for flashcard display
      const formattedWords = pkgWords.map(pkgWord => {
        const word = pkgWord.vocabulary
        const firstOccurrence = word.vocabulary_occurrences[0]
        const userProgress = progressMap.get(word.vocab_id)

        return {
          vocab_id: word.vocab_id,
          lemma: word.lemma,
          english_definition: word.english_definition,
          part_of_speech: word.part_of_speech,
          is_common_word: word.is_common_word,
          sentence_text: firstOccurrence.sentences.sentence_text,
          sentence_translation: firstOccurrence.sentences.sentence_translation,
          word_position: firstOccurrence.word_position,
          chapter_id: firstOccurrence.sentences.chapter_id,
          chapter_number: firstOccurrence.sentences.chapters.chapter_number,
          chapter_title: firstOccurrence.sentences.chapters.title,
          // User progress
          times_reviewed: userProgress?.times_reviewed || 0,
          last_reviewed_at: userProgress?.last_reviewed_at || null,
          mastery_level: userProgress?.mastery_level || 0,
          total_reviews: userProgress?.total_reviews || 0,
          health: userProgress?.health || 100,
          failed_in_last_3_sessions: userProgress?.failed_in_last_3_sessions || false,
          // Package specific
          package_word_order: pkgWord.word_order,
          package_category: pkgWord.category
        }
      })

      setCards(formattedWords)
      setCardQueue(formattedWords)
      setSessionStartTime(new Date())
      setLoading(false)
    } catch (err) {
      console.error('Error loading package mode:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function loadNextWaypoint() {
    try {
      console.log('🗺️ Loading next waypoint...')
      setLoading(true)
      setWaypointComplete(false)

      // Find next pending waypoint (should already be activated)
      const nextWaypoint = allWaypoints.find(w => w.status === 'active' && w.waypoint_id !== currentWaypoint.waypoint_id)

      if (!nextWaypoint) {
        // No more waypoints - package should be complete
        console.log('🎉 All waypoints complete!')
        await completePackage()
        return
      }

      console.log(`🎯 Loading waypoint: ${nextWaypoint.name}`)
      setCurrentWaypoint(nextWaypoint)

      // Load words for this waypoint
      const { data: pkgWords, error: wordsError } = await supabase
        .from('package_words')
        .select(`
          *,
          vocabulary (
            vocab_id,
            lemma,
            english_definition,
            part_of_speech,
            is_common_word,
            vocabulary_occurrences!inner(
              word_position,
              sentences!inner(
                sentence_id,
                sentence_text,
                sentence_translation,
                chapter_id,
                chapters!inner(
                  chapter_number,
                  title
                )
              )
            )
          )
        `)
        .eq('package_id', packageId)
        .eq('waypoint_id', nextWaypoint.waypoint_id)
        .eq('reviewed', false)
        .order('word_order')

      if (wordsError) {
        throw wordsError
      }

      console.log(`📚 Loaded ${pkgWords?.length || 0} words for next waypoint`)

      // Get user progress for these words
      const vocabIds = pkgWords.map(w => w.vocab_id)
      const { data: progress } = await supabase
        .from('user_vocabulary_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('vocab_id', vocabIds)

      const progressMap = new Map()
      if (progress) {
        progress.forEach(p => progressMap.set(p.vocab_id, p))
      }

      // Format words for flashcard display
      const formattedWords = pkgWords.map(pkgWord => {
        const word = pkgWord.vocabulary
        const firstOccurrence = word.vocabulary_occurrences[0]
        const userProgress = progressMap.get(word.vocab_id)

        return {
          vocab_id: word.vocab_id,
          lemma: word.lemma,
          english_definition: word.english_definition,
          part_of_speech: word.part_of_speech,
          is_common_word: word.is_common_word,
          sentence_text: firstOccurrence.sentences.sentence_text,
          sentence_translation: firstOccurrence.sentences.sentence_translation,
          word_position: firstOccurrence.word_position,
          chapter_id: firstOccurrence.sentences.chapter_id,
          chapter_number: firstOccurrence.sentences.chapters.chapter_number,
          chapter_title: firstOccurrence.sentences.chapters.title,
          // User progress
          times_reviewed: userProgress?.times_reviewed || 0,
          last_reviewed_at: userProgress?.last_reviewed_at || null,
          mastery_level: userProgress?.mastery_level || 0,
          total_reviews: userProgress?.total_reviews || 0,
          health: userProgress?.health || 100,
          failed_in_last_3_sessions: userProgress?.failed_in_last_3_sessions || false,
          // Package specific
          package_word_order: pkgWord.word_order,
          package_category: pkgWord.category
        }
      })

      setCards(formattedWords)
      setCardQueue(formattedWords)
      setCurrentIndex(0)
      setIsFlipped(false)
      setLoading(false)
    } catch (err) {
      console.error('Error loading next waypoint:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function fetchVocabulary(filter = null) {
    try {
      setLoading(true)
      setError(null)

      // Fetch user's session size preference
      const sessionSize = await fetchUserSettings()
      console.log('📚 Session size from user settings:', sessionSize)

      if (filter === 'due') {
        // Fetch only words that are due today with enhanced metadata
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        const todayISO = today.toISOString()

        const { data, error: fetchError } = await supabase
          .from('user_vocabulary_progress')
          .select(`
            vocab_id,
            review_due,
            times_reviewed,
            last_reviewed_at,
            mastery_level,
            health,
            total_reviews,
            failed_in_last_3_sessions,
            vocabulary!inner(
              vocab_id,
              lemma,
              english_definition,
              part_of_speech,
              language_code,
              vocabulary_occurrences!inner(
                word_position,
                sentences!inner(
                  sentence_id,
                  sentence_text,
                  sentence_translation,
                  chapter_id,
                  chapters!inner(
                    chapter_number,
                    title
                  )
                )
              )
            )
          `)
          .eq('user_id', user.id)
          .eq('vocabulary.language_code', 'es')
          .gt('mastery_level', 0) // Only reviewed words
          .lte('review_due', todayISO) // Due today or earlier
          .limit(200) // Fetch more candidates for priority selection

        if (fetchError) throw fetchError

        console.log('Raw due words data:', data)

        // Get occurrence counts for due words
        const vocabIds = data.map(d => d.vocab_id)

        const { data: occurrenceCounts, error: countError } = await supabase
          .from('vocabulary_occurrences')
          .select('vocab_id')
          .in('vocab_id', vocabIds)

        if (countError) console.warn('Error fetching occurrence counts:', countError)

        // Create occurrence count map
        const occurrenceMap = new Map()
        if (occurrenceCounts) {
          occurrenceCounts.forEach(occ => {
            occurrenceMap.set(occ.vocab_id, (occurrenceMap.get(occ.vocab_id) || 0) + 1)
          })
        }

        // Calculate frequency ranks
        const wordFrequencies = Array.from(occurrenceMap.entries())
          .sort((a, b) => b[1] - a[1])

        const rankMap = new Map()
        wordFrequencies.forEach(([vocabId, count], index) => {
          rankMap.set(vocabId, index + 1)
        })

        // Process data with enhanced metadata + health system
        const processedWords = data.map(progress => {
          const word = progress.vocabulary
          const firstOccurrence = word.vocabulary_occurrences[0]
          const occurrenceCount = occurrenceMap.get(word.vocab_id) || 1
          const frequencyRank = rankMap.get(word.vocab_id) || 999

          return {
            vocab_id: word.vocab_id,
            lemma: word.lemma,
            english_definition: word.english_definition,
            part_of_speech: word.part_of_speech,
            sentence_text: firstOccurrence.sentences.sentence_text,
            sentence_translation: firstOccurrence.sentences.sentence_translation,
            word_position: firstOccurrence.word_position,
            // Enhanced metadata
            chapter_id: firstOccurrence.sentences.chapter_id,
            chapter_number: firstOccurrence.sentences.chapters.chapter_number,
            chapter_title: firstOccurrence.sentences.chapters.title,
            times_in_book: occurrenceCount,
            occurrence_count: occurrenceCount,
            frequency_rank: frequencyRank,
            // User progress (already available from user_vocabulary_progress)
            times_reviewed: progress.times_reviewed || 0,
            last_reviewed_at: progress.last_reviewed_at || null,
            mastery_level: progress.mastery_level || 0,
            total_reviews: progress.total_reviews || 0,
            // HEALTH SYSTEM (new!)
            health: progress.health || 100,
            failed_in_last_3_sessions: progress.failed_in_last_3_sessions || false,
          }
        })

        console.log(`Fetched ${processedWords.length} words due today with metadata`)

        if (processedWords.length === 0) {
          throw new Error('No words are due for review today. Great job staying on top of your reviews!')
        }

        // USE PRIORITY-BASED SELECTION (not random!)
        const { cards: selectedCards, stats } = selectCardsForSession(
          processedWords,
          sessionSize,
          { chapterFocus: false } // TODO: Get from user settings in future
        )

        console.log('📊 Session Stats:', stats)
        console.log(`✨ Selected ${selectedCards.length} cards based on priority scoring`)

        setCards(selectedCards)
        setCardQueue(selectedCards) // Initialize the review queue
        setSessionStartTime(new Date()) // Start session timer
        setLoading(false)
      } else {
        // Default: Fetch random vocabulary with enhanced context
        // Step 1: Fetch vocabulary with sentence context and chapter info
        const { data, error: fetchError } = await supabase
          .from('vocabulary')
          .select(`
            vocab_id,
            lemma,
            english_definition,
            part_of_speech,
            is_common_word,
            vocabulary_occurrences!inner(
              word_position,
              sentences!inner(
                sentence_id,
                sentence_text,
                sentence_translation,
                chapter_id,
                chapters!inner(
                  chapter_number,
                  title
                )
              )
            )
          `)
          .eq('language_code', 'es')
          .limit(200) // Fetch more to account for filtering

        if (fetchError) throw fetchError

        console.log('Raw data from query:', data)

        // Step 2: Get occurrence counts and user progress for all words
        const vocabIds = data.map(w => w.vocab_id)

        // Count total occurrences per word
        const { data: occurrenceCounts, error: countError } = await supabase
          .from('vocabulary_occurrences')
          .select('vocab_id')
          .in('vocab_id', vocabIds)

        if (countError) console.warn('Error fetching occurrence counts:', countError)

        // Create occurrence count map
        const occurrenceMap = new Map()
        if (occurrenceCounts) {
          occurrenceCounts.forEach(occ => {
            occurrenceMap.set(occ.vocab_id, (occurrenceMap.get(occ.vocab_id) || 0) + 1)
          })
        }

        // Get user progress for these words (including health!)
        const { data: userProgress, error: progressError } = await supabase
          .from('user_vocabulary_progress')
          .select('vocab_id, times_reviewed, last_reviewed_at, mastery_level, total_reviews, correct_reviews, health, failed_in_last_3_sessions')
          .eq('user_id', user.id)
          .in('vocab_id', vocabIds)

        if (progressError) console.warn('Error fetching user progress:', progressError)

        // Create user progress map
        const progressMap = new Map()
        if (userProgress) {
          userProgress.forEach(prog => {
            progressMap.set(prog.vocab_id, prog)
          })
        }

        // Step 3: Calculate frequency ranks
        const wordFrequencies = Array.from(occurrenceMap.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending

        const rankMap = new Map()
        wordFrequencies.forEach(([vocabId, count], index) => {
          rankMap.set(vocabId, index + 1)
        })

        // Process data: extract first occurrence and add metadata
        const processedWords = data.map(word => {
          // Get the first occurrence
          const firstOccurrence = word.vocabulary_occurrences[0]
          const progress = progressMap.get(word.vocab_id)
          const occurrenceCount = occurrenceMap.get(word.vocab_id) || 1
          const frequencyRank = rankMap.get(word.vocab_id) || 999

          return {
            vocab_id: word.vocab_id,
            lemma: word.lemma,
            english_definition: word.english_definition,
            part_of_speech: word.part_of_speech,
            is_common_word: word.is_common_word,
            sentence_text: firstOccurrence.sentences.sentence_text,
            sentence_translation: firstOccurrence.sentences.sentence_translation,
            word_position: firstOccurrence.word_position,
            // Enhanced metadata
            chapter_number: firstOccurrence.sentences.chapters.chapter_number,
            chapter_title: firstOccurrence.sentences.chapters.title,
            occurrence_count: occurrenceCount,
            frequency_rank: frequencyRank,
            // User progress (DUAL PROGRESSION SYSTEM)
            times_reviewed: progress?.times_reviewed || 0,
            last_reviewed_at: progress?.last_reviewed_at || null,
            mastery_level: progress?.mastery_level || 0,
            total_reviews: progress?.total_reviews || 0,
            correct_reviews: progress?.correct_reviews || 0,
            // HEALTH SYSTEM (new!)
            health: progress?.health || 100,
            failed_in_last_3_sessions: progress?.failed_in_last_3_sessions || false,
          }
        })

        console.log('Processed words with metadata:', processedWords)

        // Filter out common words
        const filtered = processedWords.filter(word => {
          // If word is explicitly marked as common, exclude it
          if (word.is_common_word === true) {
            return false
          }

          // If word is explicitly marked as not common, include it
          if (word.is_common_word === false) {
            return true
          }

          // If is_common_word is null (not yet marked), use STOP_WORDS fallback
          return !STOP_WORDS.has(word.lemma.toLowerCase())
        })

        console.log(`Fetched ${processedWords.length} words, filtered to ${filtered.length} (removed ${processedWords.length - filtered.length} common words)`)

        if (filtered.length === 0) {
          throw new Error('No vocabulary words available for review')
        }

        // Shuffle and take sessionSize
        const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, Math.min(sessionSize, filtered.length))
        setCards(shuffled)
        setCardQueue(shuffled) // Initialize the review queue
        setSessionStartTime(new Date()) // Start session timer
        setLoading(false)
      }
    } catch (err) {
      console.error('Error fetching vocabulary:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function updateDailyStats() {
    try {
      console.log('═══════════════════════════════════════════════')
      console.log('🔍 [STREAK DEBUG] ⭐ updateDailyStats() CALLED')
      console.log('═══════════════════════════════════════════════')

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]

      console.log('🔍 [STREAK DEBUG] User ID:', user.id)
      console.log('🔍 [STREAK DEBUG] Today date:', todayStr)
      console.log('🔍 [STREAK DEBUG] Cards reviewed:', cards.length)

      // Check if there's an entry for today
      const { data: todayStats, error: todayError } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('review_date', todayStr)
        .maybeSingle()

      console.log('🔍 [STREAK DEBUG] Today stats query error:', todayError)
      console.log('🔍 [STREAK DEBUG] Today stats found:', todayStats)

      if (todayStats) {
        // Update today's stats
        console.log('🔍 [STREAK DEBUG] Updating existing today stats')
        const { data: updateData, error: updateError } = await supabase
          .from('user_daily_stats')
          .update({
            words_reviewed: todayStats.words_reviewed + cards.length,
          })
          .eq('user_id', user.id)
          .eq('review_date', todayStr)
          .select()

        console.log('🔍 [STREAK DEBUG] Update result:', updateData)
        console.log('🔍 [STREAK DEBUG] Update error:', updateError)
      } else {
        // Check if they reviewed yesterday
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        console.log('🔍 [STREAK DEBUG] Yesterday date:', yesterdayStr)

        const { data: yesterdayStats, error: yesterdayError } = await supabase
          .from('user_daily_stats')
          .select('current_streak')
          .eq('user_id', user.id)
          .eq('review_date', yesterdayStr)
          .maybeSingle()

        console.log('🔍 [STREAK DEBUG] Yesterday stats query error:', yesterdayError)
        console.log('🔍 [STREAK DEBUG] Yesterday stats found:', yesterdayStats)

        const newStreak = yesterdayStats ? yesterdayStats.current_streak + 1 : 1
        console.log('🔍 [STREAK DEBUG] New streak value:', newStreak)

        // Create new entry for today
        const { data: insertData, error: insertError } = await supabase
          .from('user_daily_stats')
          .insert([{
            user_id: user.id,
            review_date: todayStr,
            words_reviewed: cards.length,
            current_streak: newStreak,
          }])
          .select()

        console.log('🔍 [STREAK DEBUG] Insert result:', insertData)
        console.log('🔍 [STREAK DEBUG] Insert error:', insertError)
      }

      console.log('✅ Daily stats updated')
    } catch (err) {
      console.error('❌ Error updating daily stats:', err)
    }
  }

  async function updateChapterProgress() {
    try {
      console.log('🔓 [CHAPTER UNLOCK] Updating chapter progress...')

      // Get all unique chapter IDs from the reviewed cards
      const chapterIds = [...new Set(cardQueue.map(card => card.chapter_id))]
      console.log('🔓 [CHAPTER UNLOCK] Chapters to update:', chapterIds)

      for (const chapterId of chapterIds) {
        if (!chapterId) continue

        // Get all vocab IDs for this chapter
        const { data: chapterWords } = await supabase
          .from('vocabulary')
          .select('vocab_id')
          .eq('chapter_id', chapterId)

        if (!chapterWords) continue

        const vocabIds = chapterWords.map(w => w.vocab_id)
        const totalChapterWords = vocabIds.length

        // Get user progress for these words
        const { data: userProgress } = await supabase
          .from('user_vocabulary_progress')
          .select('vocab_id, mastery_level, total_reviews')
          .eq('user_id', user.id)
          .in('vocab_id', vocabIds)

        if (!userProgress) continue

        // Calculate metrics
        const wordsEncountered = userProgress.length
        const totalReviews = userProgress.reduce((sum, w) => sum + (w.total_reviews || 0), 0)
        const avgMastery = wordsEncountered > 0
          ? userProgress.reduce((sum, w) => sum + (w.mastery_level || 0), 0) / wordsEncountered
          : 0

        console.log('🔓 [CHAPTER UNLOCK] Chapter', chapterId, 'metrics:', {
          wordsEncountered,
          totalChapterWords,
          totalReviews,
          avgMastery
        })

        // Calculate unlock progress
        const encounterRate = totalChapterWords > 0 ? wordsEncountered / totalChapterWords : 0

        let unlockProgress = 0
        if (encounterRate < 0.8) {
          // Must encounter 80% first
          unlockProgress = encounterRate * 50
        } else {
          // Calculate via three paths, take maximum
          const masteryProgress = (avgMastery / 40) * 100
          const exposureProgress = (totalReviews / 50) * 100
          const balancedProgress = ((avgMastery / 30) * 50) + ((totalReviews / 30) * 50)
          unlockProgress = Math.min(100, Math.max(masteryProgress, exposureProgress, balancedProgress))
        }

        // Check if should unlock
        const shouldUnlock = (
          encounterRate >= 0.8 &&
          (avgMastery >= 40 || totalReviews >= 50 || (avgMastery >= 30 && totalReviews >= 30))
        )

        console.log('🔓 [CHAPTER UNLOCK] Chapter', chapterId, 'unlock check:', {
          encounterRate,
          unlockProgress,
          shouldUnlock
        })

        // Update chapter progress
        const { error: upsertError } = await supabase
          .from('user_chapter_progress')
          .upsert({
            user_id: user.id,
            chapter_id: chapterId,
            words_encountered: wordsEncountered,
            total_chapter_words: totalChapterWords,
            total_reviews: totalReviews,
            average_mastery: avgMastery,
            unlock_progress: unlockProgress,
            is_unlocked: shouldUnlock,
            unlocked_at: shouldUnlock ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,chapter_id'
          })

        if (upsertError) {
          console.error('Error updating chapter progress:', upsertError)
        } else if (shouldUnlock) {
          console.log('🎉 [CHAPTER UNLOCK] Chapter', chapterId, 'UNLOCKED!')
        }
      }

      console.log('✅ [CHAPTER UNLOCK] Chapter progress updated')
    } catch (err) {
      console.error('❌ Error updating chapter progress:', err)
    }
  }

  async function completePackage() {
    try {
      console.log('🎉 Completing package...')

      const completedAt = new Date()
      const startedAt = new Date(packageData.started_at)
      const actualMinutes = Math.round((completedAt - startedAt) / (1000 * 60))

      // Mark package as completed
      await supabase
        .from('user_packages')
        .update({
          status: 'completed',
          completed_at: completedAt.toISOString(),
          actual_minutes: actualMinutes
        })
        .eq('package_id', packageId)

      console.log('✅ Package marked as completed')

      // Update daily stats
      await updateDailyStats()

      // Update user stats for badge calculations
      const { data: userStats } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('review_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('📊 User stats for badges:', userStats)

      // Calculate total words reviewed for milestone badges
      const { data: allStats } = await supabase
        .from('user_daily_stats')
        .select('words_reviewed')
        .eq('user_id', user.id)

      const totalWordsReviewed = allStats?.reduce((sum, stat) => sum + (stat.words_reviewed || 0), 0) || 0

      // Check which badges should be awarded
      const completedPackageData = {
        ...packageData,
        completed_at: completedAt.toISOString(),
        actual_minutes: actualMinutes
      }

      const badgesToAward = checkBadgesOnPackageComplete(
        completedPackageData,
        { ...userStats, total_words_reviewed: totalWordsReviewed }
      )

      console.log('🏅 Badges to award:', badgesToAward)

      // Insert badges into database (with ON CONFLICT DO NOTHING to prevent duplicates)
      const newlyEarnedBadges = []
      for (const badge of badgesToAward) {
        const { data, error } = await supabase
          .from('user_badges')
          .insert({
            user_id: user.id,
            badge_id: badge.id,
            badge_name: badge.name,
            badge_description: badge.description,
            badge_icon: badge.icon,
            badge_tier: badge.tier,
            badge_category: badge.category
          })
          .select()

        if (error) {
          // Check if error is due to duplicate (unique constraint violation)
          if (error.code === '23505') {
            console.log(`ℹ️ Badge ${badge.id} already earned (skipping)`)
          } else {
            console.error('Error inserting badge:', error)
          }
        } else if (data && data.length > 0) {
          console.log(`✅ Badge awarded: ${badge.name}`)
          newlyEarnedBadges.push(badge)
        }
      }

      // Store newly earned badges in state
      setEarnedBadges(newlyEarnedBadges)

      console.log(`🎉 ${newlyEarnedBadges.length} new badge(s) earned!`)

      // Navigate to package view (which will show completion state)
      navigate(`/package/${packageId}`)
    } catch (err) {
      console.error('❌ Error completing package:', err)
      alert('Error completing package. Please try again.')
    }
  }

  async function handleDifficulty(difficulty) {
    const currentCard = cardQueue[currentIndex]

    // Update session metrics
    setSessionRatings(prev => ({
      ...prev,
      [difficulty]: prev[difficulty] + 1
    }))
    setTotalReviews(prev => prev + 1)
    setReviewedCardIds(prev => new Set(prev).add(currentCard.vocab_id))

    // Track challenging words (Don't Know or Hard)
    if (difficulty === 'dont-know' || difficulty === 'hard') {
      setChallengingWords(prev => {
        const existing = prev.find(w => w.vocab_id === currentCard.vocab_id)
        if (existing) {
          return prev.map(w =>
            w.vocab_id === currentCard.vocab_id
              ? { ...w, count: w.count + 1 }
              : w
          )
        } else {
          return [...prev, {
            vocab_id: currentCard.vocab_id,
            lemma: currentCard.lemma,
            count: 1
          }]
        }
      })
    }

    // Handle "Don't Know" - Re-queue the card
    if (difficulty === 'dont-know') {
      // Remove card from current position
      const newQueue = [...cardQueue]
      newQueue.splice(currentIndex, 1)

      // Add back 3-5 cards later in the queue
      const insertPosition = Math.min(
        currentIndex + Math.floor(Math.random() * 3) + 3,
        newQueue.length
      )
      newQueue.splice(insertPosition, 0, currentCard)

      setCardQueue(newQueue)
      setIsFlipped(false)
      // Don't increment index - show next card at same position
      return
    }

    // For other difficulties, save to database
    // NOTE: We'll fetch the full progress record to use in time gate calculation
    // This will be done after checking if the record exists below

    // Review due date calculation will be done after mastery calculation

    try {
      // Record in review history
      console.log('📝 [REVIEW HISTORY] Writing to user_review_history:', {
        user_id: user.id,
        vocab_id: currentCard.vocab_id,
        difficulty: difficulty,
        reviewed_at: new Date().toISOString()
      })

      const { data: reviewHistoryData, error: reviewHistoryError } = await supabase
        .from('user_review_history')
        .insert([{
          user_id: user.id,
          vocab_id: currentCard.vocab_id,
          reviewed_at: new Date().toISOString(),
          difficulty: difficulty,
        }])
        .select()

      console.log('📝 [REVIEW HISTORY] Insert result:', reviewHistoryData)
      console.log('📝 [REVIEW HISTORY] Insert error:', reviewHistoryError)

      // Check if user_vocabulary_progress entry exists
      const { data: existing } = await supabase
        .from('user_vocabulary_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('vocab_id', currentCard.vocab_id)
        .maybeSingle()

      const isCorrect = difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard'
      const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
      const now = new Date().toISOString()

      // CALCULATE MASTERY CHANGE WITH TIME GATE ENFORCEMENT
      const masteryResult = calculateMasteryChange(existing || {
        mastery_level: 0,
        last_correct_review_at: null
      }, difficulty)

      const newMasteryLevel = masteryResult.newMastery
      const masteryChange = masteryResult.masteryChange
      const timeGateBlocked = masteryResult.timeGateInfo.blocked || false

      // Log time gate info for debugging
      if (masteryResult.timeGateInfo.message) {
        console.log('⏰ Time Gate:', masteryResult.timeGateInfo.message)
      }

      // CALCULATE CURRENT HEALTH (before update)
      const currentHealthData = calculateCurrentHealth(existing || {
        mastery_level: 0,
        health: 100,
        last_reviewed_at: null
      })

      // HEALTH SYSTEM: Calculate health boost and new health (from masteryResult)
      const healthBoost = masteryResult.healthBoost
      const newHealth = applyHealthBoost(currentHealthData.health, healthBoost)

      // Calculate review due date based on NEW mastery level
      let daysToAdd
      if (newMasteryLevel < 20) {
        daysToAdd = 0.5  // 12 hours - New words
      } else if (newMasteryLevel < 50) {
        daysToAdd = 1    // 1 day - Learning
      } else if (newMasteryLevel < 80) {
        daysToAdd = 3    // 3 days - Familiar
      } else {
        daysToAdd = 7    // 7 days - Mastered
      }

      const reviewDue = new Date()
      reviewDue.setDate(reviewDue.getDate() + daysToAdd)

      // Prepare review history entry (with health info + TIME GATE INFO)
      const reviewEntry = {
        date: today,
        difficulty: difficulty,
        mastery_change: masteryChange,
        new_mastery: newMasteryLevel,
        health_before: currentHealthData.health,
        health_after: newHealth,
        health_boost: healthBoost,
        time_gate_met: !timeGateBlocked,  // NEW!
        time_gate_message: masteryResult.timeGateInfo.message || null  // NEW!
      }

      if (existing) {
        // Parse existing review_history (default to empty array)
        let reviewHistory = []
        try {
          reviewHistory = existing.review_history ? JSON.parse(JSON.stringify(existing.review_history)) : []
        } catch (e) {
          console.warn('Failed to parse review_history:', e)
          reviewHistory = []
        }

        // Add new entry and keep only last 20
        reviewHistory.unshift(reviewEntry)
        reviewHistory = reviewHistory.slice(0, 20)

        // Track struggling words (failed in last 3 reviews)
        const recentFailures = reviewHistory
          .slice(0, 3)
          .filter(r => r.difficulty === 'dont-know')
          .length
        const failedInLast3 = recentFailures > 0

        // Update existing entry with DUAL PROGRESSION SYSTEM + HEALTH + TIME GATES
        await supabase
          .from('user_vocabulary_progress')
          .update({
            // TRACK 1: MASTERY (Quality - 0-100 scale)
            mastery_level: newMasteryLevel,
            review_due: reviewDue.toISOString(),
            last_reviewed_at: now,
            // ONLY update last_correct_review_at when mastery actually increased
            last_correct_review_at: (difficulty !== 'dont-know' && masteryChange > 0)
              ? now
              : existing.last_correct_review_at,

            // TRACK 2: HEALTH (Urgency)
            health: newHealth,
            failed_in_last_3_sessions: failedInLast3,

            // TRACK 3: EXPOSURE (Quantity)
            total_reviews: existing.total_reviews + 1,
            correct_reviews: existing.correct_reviews + (isCorrect ? 1 : 0),
            last_review_date: today,
            review_history: reviewHistory,

            // Legacy columns (keep for compatibility)
            times_reviewed: existing.times_reviewed + 1,
            times_correct: existing.times_correct + (isCorrect ? 1 : 0),
            times_incorrect: existing.times_incorrect + (isCorrect ? 0 : 1),
          })
          .eq('user_id', user.id)
          .eq('vocab_id', currentCard.vocab_id)
      } else {
        // Create new entry with DUAL PROGRESSION SYSTEM + HEALTH + TIME GATES
        await supabase
          .from('user_vocabulary_progress')
          .insert([{
            user_id: user.id,
            vocab_id: currentCard.vocab_id,

            // TRACK 1: MASTERY (Quality - 0-100 scale)
            mastery_level: newMasteryLevel,
            review_due: reviewDue.toISOString(),
            last_reviewed_at: now,
            // ONLY set last_correct_review_at when mastery actually increased
            last_correct_review_at: (difficulty !== 'dont-know' && masteryChange > 0) ? now : null,

            // TRACK 2: HEALTH (Urgency)
            health: newHealth,
            failed_in_last_3_sessions: difficulty === 'dont-know',

            // TRACK 3: EXPOSURE (Quantity)
            total_reviews: 1,
            correct_reviews: isCorrect ? 1 : 0,
            last_review_date: today,
            last_7_days_reviews: 1,
            review_history: [reviewEntry],

            // Legacy columns (keep for compatibility)
            times_reviewed: 1,
            times_correct: isCorrect ? 1 : 0,
            times_incorrect: isCorrect ? 0 : 1,
          }])
      }

      // SHOW TIME GATE MESSAGE TO USER (if blocked)
      if (timeGateBlocked && masteryResult.timeGateInfo.message) {
        // Store message to show in UI
        setTimeGateMessage(masteryResult.timeGateInfo.message)
        // Clear message after 3 seconds
        setTimeout(() => setTimeGateMessage(null), 3000)
      }

      // PACKAGE MODE: Update package_words and package counters
      if (isPackageMode && packageId) {
        console.log('📦 Updating package progress...')

        // Update package_words table - mark as reviewed
        await supabase
          .from('package_words')
          .update({
            reviewed: true,
            review_response: difficulty,
            reviewed_at: now
          })
          .eq('package_id', packageId)
          .eq('vocab_id', currentCard.vocab_id)

        // Update package performance counters
        const countField = difficulty.replace('-', '_') + '_count'
        const newPackageData = {
          ...packageData,
          words_completed: packageData.words_completed + 1,
          [countField]: packageData[countField] + 1
        }

        await supabase
          .from('user_packages')
          .update({
            words_completed: newPackageData.words_completed,
            [countField]: newPackageData[countField]
          })
          .eq('package_id', packageId)

        setPackageData(newPackageData)

        console.log(`📦 Package progress: ${newPackageData.words_completed}/${newPackageData.total_words}`)

        // UPDATE WAYPOINT PROGRESS
        if (currentWaypoint) {
          const newWaypointProgress = currentWaypoint.words_completed + 1
          const isWaypointComplete = newWaypointProgress >= currentWaypoint.total_words

          console.log(`🗺️ Waypoint progress: ${newWaypointProgress}/${currentWaypoint.total_words}`)

          // Update waypoint words_completed and status
          await supabase
            .from('user_waypoints')
            .update({
              words_completed: newWaypointProgress,
              status: isWaypointComplete ? 'completed' : 'active'
            })
            .eq('waypoint_id', currentWaypoint.waypoint_id)

          // Update local waypoint state
          const updatedWaypoint = {
            ...currentWaypoint,
            words_completed: newWaypointProgress,
            status: isWaypointComplete ? 'completed' : 'active'
          }
          setCurrentWaypoint(updatedWaypoint)

          // Update allWaypoints array
          setAllWaypoints(prev => prev.map(w =>
            w.waypoint_id === currentWaypoint.waypoint_id ? updatedWaypoint : w
          ))

          // Check if waypoint is complete
          if (isWaypointComplete) {
            console.log(`🎯 Waypoint "${currentWaypoint.name}" complete!`)

            // Find next waypoint
            const nextWaypoint = allWaypoints.find(w =>
              w.waypoint_number === currentWaypoint.waypoint_number + 1
            )

            if (nextWaypoint) {
              // Activate next waypoint
              console.log(`🗺️ Activating next waypoint: ${nextWaypoint.name}`)
              await supabase
                .from('user_waypoints')
                .update({ status: 'active' })
                .eq('waypoint_id', nextWaypoint.waypoint_id)

              // Update local state
              setAllWaypoints(prev => prev.map(w =>
                w.waypoint_id === nextWaypoint.waypoint_id ? { ...w, status: 'active' } : w
              ))
            }

            // Show waypoint completion screen
            setWaypointComplete(true)
            return
          }
        }

        // Check if package is complete
        if (newPackageData.words_completed >= newPackageData.total_words) {
          console.log('🎉 Package complete! Finalizing...')
          await completePackage()
          return
        }
      }

      // Move to next card
      if (currentIndex < cardQueue.length - 1) {
        console.log(`➡️ Moving to next card: ${currentIndex + 1} / ${cardQueue.length}`)
        setCurrentIndex(currentIndex + 1)
        setIsFlipped(false)
      } else {
        // Review complete
        if (isPackageMode) {
          console.log('📦 All current package words reviewed')
          setIsComplete(true)
        } else {
          // Regular mode - update daily stats and chapter progress
          console.log('🎉 [COMPLETE] Review session complete! Calling updateDailyStats()...')
          await updateDailyStats()
          console.log('✅ [COMPLETE] updateDailyStats() finished')
          console.log('🔓 [COMPLETE] Calling updateChapterProgress()...')
          await updateChapterProgress()
          console.log('✅ [COMPLETE] updateChapterProgress() finished, setting isComplete = true')
          setIsComplete(true)
        }
      }
    } catch (err) {
      console.error('Error saving review:', err)
    }
  }

  function handleCardClick() {
    setIsFlipped(!isFlipped)
  }

  // Helper function to format time ago
  function formatTimeAgo(dateString) {
    if (!dateString) return 'Never reviewed'

    const now = new Date()
    const past = new Date(dateString)
    const diffMs = now - past
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  // Helper function to calculate mastery percentage
  function getMasteryPercentage(level) {
    // Mastery level is already 0-100 scale
    return Math.max(0, Math.min(100, Math.round(level || 0)))
  }

  // Helper function to detect gender from sentence context
  function detectGenderFromSentence(sentence, wordPosition) {
    console.log('🔍 [GENDER FUNC] detectGenderFromSentence called with:', { sentence, wordPosition })

    if (!sentence || wordPosition === 0) {
      console.log('🔍 [GENDER FUNC] Early return: no sentence or position 0')
      return null
    }

    // Split sentence into words (non-whitespace tokens only)
    const words = sentence.split(/\s+/).filter(w => w.trim().length > 0)
    console.log('🔍 [GENDER FUNC] Split words:', words)

    // Clean punctuation from the previous word
    const previousWord = words[wordPosition - 1]?.replace(/[.,;:!?¿¡«»\"\"()—\-]/g, '').toLowerCase()
    console.log('🔍 [GENDER FUNC] Previous word (cleaned):', previousWord)

    // Detect gender based on preceding article
    if (previousWord === 'el' || previousWord === 'un' || previousWord === 'los' || previousWord === 'unos') {
      console.log('🔍 [GENDER FUNC] ✅ Detected MASCULINE')
      return 'masculine'
    }
    if (previousWord === 'la' || previousWord === 'una' || previousWord === 'las' || previousWord === 'unas') {
      console.log('🔍 [GENDER FUNC] ✅ Detected FEMININE')
      return 'feminine'
    }

    console.log('🔍 [GENDER FUNC] ❌ No gender detected')
    return null
  }

  // Helper function to get article for a word
  function getArticleForWord(lemma, gender) {
    if (!gender) return null

    // Default to singular definite articles
    if (gender === 'masculine') return 'el'
    if (gender === 'feminine') return 'la'

    return null
  }

  // Helper function to render sentence with target word bolded
  function renderSentenceWithBoldWord(sentence, wordPosition) {
    if (!sentence) return null

    // Split sentence into words (preserve spaces and punctuation)
    const words = sentence.split(/(\s+)/)

    // Count only non-whitespace tokens to match word_position
    let wordIndex = 0

    return (
      <span>
        {words.map((token, idx) => {
          // If it's whitespace, just return it
          if (/^\s+$/.test(token)) {
            return <span key={idx}>{token}</span>
          }

          // This is a word - check if it should be bold
          const shouldBold = wordIndex === wordPosition
          wordIndex++

          return shouldBold ? (
            <strong key={idx} className="font-bold text-amber-900">
              {token}
            </strong>
          ) : (
            <span key={idx}>{token}</span>
          )
        })}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600 font-serif">Loading flashcards...</p>
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
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  // Waypoint completion screen
  if (waypointComplete && currentWaypoint) {
    // Find next waypoint to show preview
    const nextWaypoint = allWaypoints.find(w =>
      w.waypoint_number === currentWaypoint.waypoint_number + 1
    )
    const isLastWaypoint = !nextWaypoint

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          {/* Celebration header */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">{currentWaypoint.icon}</div>
            <h2 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              Waypoint Complete!
            </h2>
            <p className="text-xl text-gray-700 font-semibold">
              {currentWaypoint.name}
            </p>
            <p className="text-gray-600 mt-2">
              {currentWaypoint.description}
            </p>
          </div>

          {/* Progress stats */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center gap-4">
              <span className="text-5xl">✅</span>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-700">
                  {currentWaypoint.total_words}
                </div>
                <div className="text-sm text-gray-600 uppercase tracking-wide">
                  Words Reviewed
                </div>
              </div>
            </div>
          </div>

          {/* Next waypoint preview or completion message */}
          {isLastWaypoint ? (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 mb-8">
              <div className="text-center">
                <span className="text-5xl mb-3 block">🎉</span>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  Package Complete!
                </h3>
                <p className="text-gray-600">
                  All waypoints finished! Great work on completing the entire package.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{nextWaypoint.icon}</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    Up Next: {nextWaypoint.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">
                    {nextWaypoint.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>📚 {nextWaypoint.total_words} words</span>
                    <span>•</span>
                    <span className="uppercase font-semibold">{nextWaypoint.theme.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            {isLastWaypoint ? (
              <button
                onClick={() => completePackage()}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl"
              >
                Complete Package 🎉
              </button>
            ) : (
              <button
                onClick={loadNextWaypoint}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                Continue to Next Waypoint →
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isComplete) {
    // Calculate session duration
    const sessionDuration = sessionStartTime
      ? Math.round((new Date() - sessionStartTime) / 1000 / 60) // minutes
      : 0

    // Calculate performance percentages
    const total = totalReviews
    const easyPercent = total > 0 ? Math.round((sessionRatings.easy / total) * 100) : 0
    const mediumPercent = total > 0 ? Math.round((sessionRatings.medium / total) * 100) : 0
    const hardPercent = total > 0 ? Math.round((sessionRatings.hard / total) * 100) : 0
    const dontKnowPercent = total > 0 ? Math.round((sessionRatings['dont-know'] / total) * 100) : 0

    // Get top 3 challenging words
    const topChallenging = challengingWords
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-serif font-bold text-amber-700 mb-2">
              Session Complete!
            </h2>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="text-sm text-gray-600 font-serif mb-1">Cards Reviewed</div>
              <div className="text-3xl font-bold text-amber-700 font-serif">{reviewedCardIds.size}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="text-sm text-gray-600 font-serif mb-1">Time Spent</div>
              <div className="text-3xl font-bold text-blue-700 font-serif">{sessionDuration} min</div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="mb-8">
            <h3 className="text-xl font-serif font-bold text-amber-900 mb-4 flex items-center gap-2">
              <span>📊</span>
              <span>Your Performance</span>
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-serif text-gray-700">😄 Easy</span>
                  <span className="text-sm font-serif font-semibold text-gray-900">
                    {sessionRatings.easy} ({easyPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${easyPercent}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-serif text-gray-700">😊 Medium</span>
                  <span className="text-sm font-serif font-semibold text-gray-900">
                    {sessionRatings.medium} ({mediumPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${mediumPercent}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-serif text-gray-700">😅 Hard</span>
                  <span className="text-sm font-serif font-semibold text-gray-900">
                    {sessionRatings.hard} ({hardPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${hardPercent}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-serif text-gray-700">😰 Don't Know</span>
                  <span className="text-sm font-serif font-semibold text-gray-900">
                    {sessionRatings['dont-know']} ({dontKnowPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${dontKnowPercent}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Challenging Words */}
          {topChallenging.length > 0 && (
            <div className="mb-8 bg-orange-50 rounded-xl p-6 border border-orange-200">
              <h3 className="text-lg font-serif font-bold text-orange-900 mb-3">
                📝 Words Still Challenging
              </h3>
              <div className="space-y-2">
                {topChallenging.map((word, index) => (
                  <div key={word.vocab_id} className="flex justify-between items-center text-sm font-serif">
                    <span className="text-gray-700">
                      {index + 1}. <span className="font-semibold">{word.lemma}</span>
                    </span>
                    <span className="text-gray-600">reviewed {word.count}× this session</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-700 mt-3 italic">
                These words will appear more frequently in future sessions
              </p>
            </div>
          )}

          {/* Achievements */}
          <div className="mb-8 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-xl p-6 border-2 border-amber-300">
            <div className="text-center">
              <div className="text-2xl font-serif font-bold text-amber-900 mb-2">
                🔥 Streak Maintained!
              </div>
              <div className="text-sm text-gray-700 font-serif mb-3">
                Keep up the great work! Come back tomorrow to continue your streak.
              </div>
              <div className="text-3xl font-bold text-amber-700 font-serif">
                +{reviewedCardIds.size} XP
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                // Reset all session state
                setCurrentIndex(0)
                setIsFlipped(false)
                setIsComplete(false)
                setSessionRatings({ 'easy': 0, 'medium': 0, 'hard': 0, 'dont-know': 0 })
                setReviewedCardIds(new Set())
                setTotalReviews(0)
                setChallengingWords([])
                fetchVocabulary(filterMode)
              }}
              className="w-full px-6 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-serif text-lg font-bold shadow-lg"
            >
              Review Another Session
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-4 border-2 border-amber-600 text-amber-800 rounded-xl hover:bg-amber-50 transition-colors font-serif text-lg"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (cardQueue.length === 0) return null

  const currentCard = cardQueue[currentIndex]
  const uniqueCardsReviewed = reviewedCardIds.size

  // Detect gender for the current card
  console.log('🔍 [GENDER DEBUG] Current card:', currentCard)
  console.log('🔍 [GENDER DEBUG] Part of speech:', currentCard.part_of_speech)
  console.log('🔍 [GENDER DEBUG] Sentence:', currentCard.sentence_text)
  console.log('🔍 [GENDER DEBUG] Word position:', currentCard.word_position)

  const detectedGender = currentCard.part_of_speech === 'noun'
    ? detectGenderFromSentence(currentCard.sentence_text, currentCard.word_position)
    : null

  console.log('🔍 [GENDER DEBUG] Detected gender:', detectedGender)

  const article = getArticleForWord(currentCard.lemma, detectedGender)
  console.log('🔍 [GENDER DEBUG] Article:', article)

  const displayWord = article ? `${article} ${currentCard.lemma}` : currentCard.lemma
  console.log('🔍 [GENDER DEBUG] Display word:', displayWord)

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-amber-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-amber-800 hover:text-amber-900 font-serif text-sm flex items-center gap-2"
          >
            ← Home
          </button>
          <div className="text-center">
            {isPackageMode && currentWaypoint ? (
              <>
                <div className="text-xs text-gray-500 font-serif">{currentWaypoint.name}</div>
                <div className="text-2xl font-bold text-amber-700 font-serif">
                  {currentIndex + 1} / {cardQueue.length}
                </div>
                <div className="text-xs text-gray-500 font-serif mt-1">
                  {currentWaypoint.theme.replace('_', ' ').toUpperCase()} • {currentWaypoint.icon}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-gray-500 font-serif">Unique Cards</div>
                <div className="text-2xl font-bold text-amber-700 font-serif">
                  {uniqueCardsReviewed} / {cards.length}
                </div>
                <div className="text-xs text-gray-500 font-serif mt-1">
                  {totalReviews} total reviews
                </div>
              </>
            )}
          </div>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-serif font-bold text-amber-700 mb-2">
            {filterMode === 'due' ? '📝 Due Today Review' : 'Flashcard Review'}
          </h1>
          <p className="text-gray-600 font-serif">
            {filterMode === 'due' ? `Reviewing ${cards.length} words due today` : (isFlipped ? 'Rate your knowledge' : 'Click the card to reveal the answer')}
          </p>
        </div>

        {/* Flashcard */}
        <div className="perspective-1000 mb-8">
          <div
            onClick={handleCardClick}
            className={`flashcard ${isFlipped ? 'flipped' : ''} cursor-pointer`}
            style={{ minHeight: '500px' }}
          >
            <div className="flashcard-inner">
              {/* Front */}
              <div className="flashcard-front bg-white rounded-2xl shadow-2xl p-10 flex flex-col justify-between border-4 border-amber-300">
                {/* Top badges */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-serif font-semibold">
                      Chapter {currentCard.chapter_number}
                    </span>
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-serif">
                      Rank #{currentCard.frequency_rank}
                    </span>
                  </div>
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-serif font-semibold whitespace-nowrap">
                    {currentCard.occurrence_count}× in book
                  </span>
                </div>

                {/* Word */}
                <div className="text-center flex-1 flex flex-col justify-center">
                  <div className="text-5xl font-serif font-bold text-[#4a3f35] mb-2">
                    {displayWord}
                  </div>
                  {article && (
                    <div className="text-sm text-gray-500 font-serif">
                      ({detectedGender} {currentCard.part_of_speech})
                    </div>
                  )}
                  {!article && currentCard.part_of_speech && (
                    <div className="text-sm text-gray-500 font-serif">
                      ({currentCard.part_of_speech})
                    </div>
                  )}
                </div>

                {/* Sentence */}
                <div className="px-4 mb-6">
                  <div className="text-lg font-serif text-gray-700 leading-relaxed text-center">
                    {renderSentenceWithBoldWord(currentCard.sentence_text, currentCard.word_position)}
                  </div>
                </div>

                {/* Hint */}
                <div className="text-center">
                  <div className="text-sm text-gray-400 font-serif italic">
                    Tap to reveal translation
                  </div>
                </div>
              </div>

              {/* Back */}
              <div className="flashcard-back bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-2xl p-8 flex flex-col justify-between border-4 border-amber-400">
                {/* Word and definition */}
                <div className="text-center mb-4">
                  <div className="text-3xl font-serif font-bold text-amber-900 mb-2">
                    {displayWord}
                  </div>
                  <div className="text-2xl font-serif font-bold text-amber-800 mb-3">
                    {currentCard.english_definition}
                  </div>
                  <div className="inline-block px-4 py-1 bg-white/80 rounded-full">
                    <span className="text-xs text-gray-700 font-serif capitalize">
                      {currentCard.part_of_speech || 'word'}
                      {article && ` • ${detectedGender}`}
                    </span>
                  </div>
                </div>

                {/* English sentence */}
                <div className="px-4 mb-4 border-t border-amber-200 pt-4">
                  <div className="text-sm font-serif text-gray-600 italic leading-relaxed text-center">
                    "{currentCard.sentence_translation}"
                  </div>
                </div>

                {/* Personal progress stats - DUAL PROGRESSION SYSTEM */}
                <div className="bg-white/60 rounded-xl p-4 border border-amber-200">
                  <div className="text-sm font-serif font-bold text-amber-900 mb-3 flex items-center justify-center gap-2">
                    <span>📊</span>
                    <span>Your Progress</span>
                  </div>

                  <div className="space-y-3 text-xs font-serif">
                    {/* TRACK 1: MASTERY (Quality - Green) */}
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-700 font-bold flex items-center gap-1">
                          <span>🎯</span>
                          <span>Mastery</span>
                        </span>
                        <span className="font-bold text-green-900">
                          {getMasteryPercentage(currentCard.mastery_level)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-green-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                          style={{ width: `${getMasteryPercentage(currentCard.mastery_level)}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-green-600 mt-1">
                        How well you know this word
                      </div>
                    </div>

                    {/* TRACK 2: EXPOSURE (Quantity - Blue) */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-700 font-bold flex items-center gap-1">
                          <span>📚</span>
                          <span>Exposure</span>
                        </span>
                        <span className="font-bold text-blue-900">
                          {currentCard.total_reviews || currentCard.times_reviewed || 0}×
                        </span>
                      </div>
                      <div className="h-2 mb-1"></div>
                      <div className="flex justify-between items-center text-[9px] text-blue-600">
                        <span>{currentCard.total_reviews > 0 ? Math.round((currentCard.correct_reviews / currentCard.total_reviews) * 100) : 0}% correct</span>
                        <span>{formatTimeAgo(currentCard.last_reviewed_at)}</span>
                      </div>
                      <div className="text-[10px] text-blue-600 mt-1">
                        How much practice you've had
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time Gate Feedback Message */}
        {timeGateMessage && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⏰</span>
              <p className="text-sm text-yellow-800">
                <strong>Health improved!</strong> {timeGateMessage}
              </p>
            </div>
          </div>
        )}

        {/* Difficulty Buttons (only show when flipped) */}
        {isFlipped && (
          <div className="space-y-3 animate-fadeIn">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 font-serif">How well did you know this word?</p>
            </div>

            <button
              onClick={() => handleDifficulty('dont-know')}
              className="w-full px-6 py-5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-serif shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="text-lg font-bold mb-1">😰 Don't Know</div>
              <div className="text-xs opacity-90">I need to see this again → Returns in 3-5 cards</div>
            </button>

            <button
              onClick={() => handleDifficulty('hard')}
              className="w-full px-6 py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all font-serif shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="text-lg font-bold mb-1">😅 Hard</div>
              <div className="text-xs opacity-90">I got it, but it was difficult → Review in 12 hours</div>
            </button>

            <button
              onClick={() => handleDifficulty('medium')}
              className="w-full px-6 py-5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-all font-serif shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="text-lg font-bold mb-1">😊 Medium</div>
              <div className="text-xs opacity-90">I got it with some thought → Review tomorrow</div>
            </button>

            <button
              onClick={() => handleDifficulty('easy')}
              className="w-full px-6 py-5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all font-serif shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="text-lg font-bold mb-1">😄 Easy</div>
              <div className="text-xs opacity-90">I knew this immediately → Review in 3 days</div>
            </button>
          </div>
        )}
      </main>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }

        .flashcard {
          position: relative;
          width: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }

        .flashcard-inner {
          position: relative;
          width: 100%;
          min-height: 500px;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }

        .flashcard.flipped .flashcard-inner {
          transform: rotateY(180deg);
        }

        .flashcard-front,
        .flashcard-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .flashcard-back {
          transform: rotateY(180deg);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      {/* Badge Notification */}
      {currentBadge && (
        <BadgeNotification badge={currentBadge} onClose={handleBadgeClose} />
      )}
    </div>
  )
}
