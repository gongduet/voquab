import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PACKAGE_TYPES, getRecommendedPackage, selectWordsForPackage, generateWaypoints } from '../utils/packageCalculations'
import { calculateCurrentHealth } from '../utils/healthCalculations'

export default function PackageSelection() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [userWords, setUserWords] = useState([])
  const [userStats, setUserStats] = useState(null)
  const [activePackage, setActivePackage] = useState(null)
  const [recommendedPackage, setRecommendedPackage] = useState('standard')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      if (!user) {
        navigate('/login')
        return
      }

      console.log('📦 Loading package selection data...')

      // Debug: Check vocabulary table structure
      console.log('🔍 Checking vocabulary table structure...')
      const { data: sampleVocab } = await supabase
        .from('vocabulary')
        .select('*')
        .limit(1)
      console.log('📋 Sample vocabulary record:', sampleVocab?.[0])

      // Check for active package
      const { data: packages } = await supabase
        .from('user_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (packages && packages.length > 0) {
        console.log('✅ Found active package:', packages[0])
        setActivePackage(packages[0])
      }

      // Load user words with vocabulary data
      const { data: words, error: wordsError } = await supabase
        .from('user_vocabulary_progress')
        .select(`
          vocab_id,
          mastery_level,
          health,
          last_reviewed_at,
          last_correct_review_at,
          total_reviews,
          failed_in_last_3_sessions,
          vocabulary (
            vocab_id,
            lemma,
            english_definition
          )
        `)
        .eq('user_id', user.id)

      if (wordsError) {
        console.error('Error loading words:', wordsError)
      } else {
        console.log(`📚 Loaded ${words?.length || 0} words`)

        // Load occurrence counts for times_in_book calculation
        const { data: occurrences } = await supabase
          .from('vocabulary_occurrences')
          .select('vocab_id')

        // Count occurrences per vocab_id
        const countsMap = {}
        if (occurrences) {
          occurrences.forEach(occ => {
            countsMap[occ.vocab_id] = (countsMap[occ.vocab_id] || 0) + 1
          })
        }

        // Merge times_in_book into vocabulary objects
        const wordsWithCounts = words?.map(word => ({
          ...word,
          vocabulary: word.vocabulary ? {
            ...word.vocabulary,
            times_in_book: countsMap[word.vocab_id] || 0
          } : null
        })) || []

        console.log(`📊 Calculated occurrence counts for ${Object.keys(countsMap).length} unique words`)
        setUserWords(wordsWithCounts)
      }

      // Load user stats for today
      const today = new Date().toISOString().split('T')[0]
      const { data: stats } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('review_date', today)
        .single()

      setUserStats(stats)
      console.log('📊 User stats:', stats)

      // Calculate recommendation
      const wordsWithHealth = (words || []).map(w => ({
        ...w,
        currentHealth: calculateCurrentHealth(w).health
      }))

      const recommended = getRecommendedPackage(stats || {}, wordsWithHealth)
      setRecommendedPackage(recommended)
      console.log('⭐ Recommended package:', recommended)

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  async function seedTestData() {
    setLoading(true)
    try {
      console.log('🌱 Seeding test data...')

      if (!user) {
        console.error('❌ No user found')
        return
      }

      // Get first 100 vocabulary words
      const { data: vocabWords, error: vocabError } = await supabase
        .from('vocabulary')
        .select('vocab_id')
        .limit(100)

      if (vocabError || !vocabWords) {
        console.error('Error fetching vocabulary:', vocabError)
        alert('Failed to fetch vocabulary words')
        setLoading(false)
        return
      }

      console.log(`📚 Found ${vocabWords.length} vocabulary words`)

      // Create progress records with random values
      const progressRecords = vocabWords.map(word => ({
        user_id: user.id,
        vocab_id: word.vocab_id,
        mastery_level: Math.floor(Math.random() * 50), // 0-50
        health: Math.floor(Math.random() * 80) + 20, // 20-100
        total_reviews: Math.floor(Math.random() * 20), // 0-20
        correct_reviews: Math.floor(Math.random() * 15),
        failed_in_last_3_sessions: Math.random() > 0.8,
        last_reviewed_at: new Date().toISOString()
      }))

      console.log(`📝 Inserting ${progressRecords.length} progress records...`)

      // Insert all at once
      const { error: insertError } = await supabase
        .from('user_vocabulary_progress')
        .insert(progressRecords)

      if (insertError) {
        console.error('Error inserting progress:', insertError)
        alert('Failed to seed data: ' + insertError.message)
        setLoading(false)
        return
      }

      console.log('✅ Test data seeded successfully!')
      alert('Test data seeded! Reloading page...')
      window.location.reload()
    } catch (error) {
      console.error('Seed error:', error)
      alert('Failed to seed data')
      setLoading(false)
    }
  }

  async function createPackage(packageType) {
    try {
      setCreating(true)
      console.log(`🎯 Creating ${packageType} package...`)
      console.log('📋 User ID:', user?.id)
      console.log('📚 Total user words available:', userWords.length)

      if (!user) {
        console.error('❌ No user found')
        return
      }

      // Get user settings for options
      console.log('⚙️ Fetching user settings...')
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (settingsError) {
        console.warn('⚠️ Settings error (non-fatal):', settingsError)
      }
      console.log('✅ Settings loaded:', settings)

      // Get total vocabulary count for dynamic composition
      console.log('📊 Querying total vocabulary count...')
      const { count: totalVocabCount, error: countError } = await supabase
        .from('vocabulary')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.warn('⚠️ Error getting vocab count:', countError)
      }

      const totalAvailableWords = totalVocabCount || 1000 // Fallback if count fails
      console.log(`📚 Total vocabulary available: ${totalAvailableWords} words`)

      // Select words for package
      console.log('🔍 Selecting words for package...')
      console.log('📊 Package type config:', PACKAGE_TYPES[packageType])

      let selection

      // Special handling for beginner package
      if (packageType === 'getting_started' && userWords.length < 50) {
        console.log('🌱 Creating beginner package from foundational vocabulary...')

        // Query vocabulary directly (not user progress) - get first 30 words
        // These are the foundational words that appear early in the book
        // FILTER: Exclude stop words (is_stop_word = false)
        const { data: chapter1Words, error: vocabError } = await supabase
          .from('vocabulary')
          .select('*')  // Get ALL columns to see what's available
          .eq('is_stop_word', false)  // EXCLUDE STOP WORDS
          .limit(30)

        console.log('📚 Beginner words fetched:', chapter1Words)
        console.log('❌ Any error?', vocabError)

        if (vocabError || !chapter1Words) {
          console.error('Error fetching chapter 1 vocabulary:', vocabError)
          alert('Failed to load beginner words')
          setCreating(false)
          return
        }

        console.log(`📚 Found ${chapter1Words.length} words`)
        console.log('🔍 First word structure:', chapter1Words[0])

        // Create selection object matching expected format
        // Use the actual word object structure
        selection = {
          words: chapter1Words.map((word, i) => ({
            vocab_id: word.vocab_id,
            vocabulary: word,  // Use the entire word object as-is
            word_order: i + 1,
            category: 'new',
            mastery_level: 0,
            health: 100,
            total_reviews: 0
          })),
          breakdown: {
            total: chapter1Words.length,
            new: chapter1Words.length,
            critical: 0,
            mastery_ready: 0,
            exposure: 0
          }
        }
      } else {
        // Normal package selection from user's existing progress
        selection = selectWordsForPackage(userWords, packageType, totalAvailableWords, {
          chapterFocus: settings?.chapter_focus_mode || false,
          focusChapterId: settings?.current_focus_chapter || null
        })
      }

      console.log('✅ Selected words:', selection.breakdown)
      console.log('📝 Total selected words:', selection.words.length)
      console.log('🔢 Sample word data:', selection.words[0])

      // Check if we have any words to create a package with
      if (!selection.words || selection.words.length === 0) {
        console.error('❌ No words selected for package')
        alert('You need to review some words first before creating a package. Try the regular flashcard mode to get started!')
        setCreating(false)
        return
      }

      // Create package record
      console.log('📦 Creating package record...')
      const packageConfig = PACKAGE_TYPES[packageType]
      const estimatedMinutes = Math.round(
        (packageConfig.estimatedMinutes.min + packageConfig.estimatedMinutes.max) / 2
      )

      const packageInsertData = {
        user_id: user.id,
        package_type: packageType,
        total_words: selection.words.length,
        estimated_minutes: estimatedMinutes
      }
      console.log('📄 Package insert data:', packageInsertData)

      const { data: package_, error: packageError } = await supabase
        .from('user_packages')
        .insert(packageInsertData)
        .select()
        .single()

      if (packageError) {
        console.error('❌ Error creating package:', packageError)
        console.error('❌ Full error object:', JSON.stringify(packageError, null, 2))
        throw packageError
      }

      console.log('✅ Package created successfully!')
      console.log('📦 Package data:', package_)

      // Generate and insert waypoints FIRST (so we have waypoint_ids for package_words)
      console.log('🗺️ Generating waypoints...')
      const waypoints = generateWaypoints(selection.words, packageType)
      console.log(`✅ Generated ${waypoints.length} waypoints`)
      console.log('🗺️ Waypoint data:', waypoints)

      console.log('🗺️ Preparing waypoint records for insertion...')
      const waypointRecords = waypoints.map(wp => ({
        package_id: package_.package_id,
        waypoint_number: wp.waypoint_number,
        theme: wp.theme,
        name: wp.name,
        description: wp.description,
        icon: wp.icon,
        total_words: wp.total_words,
        words_completed: wp.words_completed,
        word_ids: JSON.stringify(wp.word_ids),
        status: wp.status
      }))
      console.log('🗺️ Sample waypoint record:', waypointRecords[0])

      const { data: insertedWaypoints, error: waypointsError } = await supabase
        .from('user_waypoints')
        .insert(waypointRecords)
        .select()

      if (waypointsError) {
        console.error('❌ Error inserting waypoints:', waypointsError)
        console.error('❌ Full error object:', JSON.stringify(waypointsError, null, 2))
        throw waypointsError
      }

      console.log(`✅ Inserted ${insertedWaypoints.length} waypoints successfully!`)

      // Create a mapping of theme → waypoint_id for assigning to words
      const themeToWaypointId = {}
      insertedWaypoints.forEach(wp => {
        themeToWaypointId[wp.theme] = wp.waypoint_id
      })
      console.log('🗺️ Theme to waypoint ID mapping:', themeToWaypointId)

      // Insert package words with waypoint_id assigned
      console.log('📝 Preparing package words with waypoint assignments...')
      const packageWords = selection.words.map(word => ({
        package_id: package_.package_id,
        vocab_id: word.vocab_id,
        word_order: word.word_order,
        category: word.category,
        waypoint_id: themeToWaypointId[word.category] || null
      }))
      console.log(`📝 Inserting ${packageWords.length} package words...`)
      console.log('📝 Sample package word:', packageWords[0])

      const { error: wordsError } = await supabase
        .from('package_words')
        .insert(packageWords)

      if (wordsError) {
        console.error('❌ Error inserting package words:', wordsError)
        console.error('❌ Full error object:', JSON.stringify(wordsError, null, 2))
        throw wordsError
      }

      console.log(`✅ Inserted ${packageWords.length} package words successfully!`)

      // Navigate to package view
      console.log('🎉 Package creation complete! Navigating to package view...')
      navigate(`/package/${package_.package_id}`)
    } catch (error) {
      console.error('❌❌❌ PACKAGE CREATION FAILED ❌❌❌')
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      console.error('Full error object:', error)
      console.error('Error JSON:', JSON.stringify(error, null, 2))
      alert(`Failed to create package. Error: ${error.message || 'Unknown error'}`)
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // If active package exists, show resume option
  if (activePackage) {
    const packageConfig = PACKAGE_TYPES[activePackage.package_type]
    const progress = Math.round((activePackage.words_completed / activePackage.total_words) * 100)

    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{packageConfig.badge}</span>
            <div>
              <h2 className="text-2xl font-bold">Active Package Found</h2>
              <p className="text-gray-700">
                {packageConfig.name} Package ({activePackage.words_completed}/{activePackage.total_words} words)
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">{progress}% complete</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => navigate(`/package/${activePackage.package_id}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              Resume Package →
            </button>
            <button
              onClick={() => setActivePackage(null)}
              className="bg-gray-300 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Start New Package
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Calculate stats for display
  const criticalCount = userWords.filter(w => {
    const health = calculateCurrentHealth(w).health
    return health < 20
  }).length

  const masteryReadyCount = userWords.filter(w => {
    if (w.mastery_level >= 100) return false
    if (!w.last_correct_review_at) return true

    const hoursSince = (new Date() - new Date(w.last_correct_review_at)) / (1000 * 60 * 60)
    const level = Math.floor((w.mastery_level || 0) / 10)
    const TIME_GATES = { 0: 0, 1: 4, 2: 12, 3: 24, 4: 72, 5: 168, 6: 336, 7: 720, 8: 1440, 9: 2880, 10: 4320 }
    return hoursSince >= (TIME_GATES[level] || 0)
  }).length

  const currentStreak = userStats?.current_streak || 0

  // Package selection screen
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2">
          Good {getTimeOfDay()}, {user?.user_metadata?.name || 'Learner'}!
        </h1>
        <p className="text-gray-600 mb-6">Choose Your Learning Journey Today</p>

        {/* User stats summary */}
        {userStats && (
          <div className="bg-blue-50 rounded-lg p-4 mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  🔥 {currentStreak}
                </div>
                <div className="text-sm text-gray-600">Day Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  ⚠️ {criticalCount}
                </div>
                <div className="text-sm text-gray-600">Need Attention</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  ⭐ {masteryReadyCount}
                </div>
                <div className="text-sm text-gray-600">Ready to Level Up</div>
              </div>
            </div>
          </div>
        )}

        {/* Seed test data button (dev only) */}
        {userWords.length === 0 && (
          <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
            <p className="text-sm text-purple-800 mb-3">
              No vocabulary progress found. Click below to seed test data for development:
            </p>
            <button
              onClick={seedTestData}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors"
              disabled={loading}
            >
              🌱 Seed Test Data (Dev Only)
            </button>
          </div>
        )}

        {/* Package options */}
        <div className="space-y-4">
          {Object.entries(PACKAGE_TYPES)
            .sort(([typeA], [typeB]) => {
              // Show getting_started first if user has < 50 words
              if (userWords.length < 50) {
                if (typeA === 'getting_started') return -1
                if (typeB === 'getting_started') return 1
              }
              return 0
            })
            .map(([type, config]) => {
            const isRecommended = type === recommendedPackage
            const isGettingStarted = type === 'getting_started'
            const showGettingStarted = isGettingStarted && userWords.length < 50

            // Hide getting_started if user has >= 50 words
            if (isGettingStarted && userWords.length >= 50) {
              return null
            }

            // Special styling for getting_started package
            const borderClass = isGettingStarted
              ? 'border-green-500 bg-green-50'
              : isRecommended
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'

            return (
              <div
                key={type}
                className={`border-2 rounded-lg p-6 transition-all hover:shadow-lg cursor-pointer ${borderClass}`}
                onClick={() => !creating && createPackage(type)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-4xl">{config.badge}</span>
                      <div>
                        <h3 className="text-xl font-bold">
                          {config.name.toUpperCase()} ({config.words} words)
                        </h3>
                        {isGettingStarted && (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                            ⭐ PERFECT FOR BEGINNERS - START HERE!
                          </span>
                        )}
                        {isRecommended && !isGettingStarted && (
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            ⭐ RECOMMENDED
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        ⏱️ {config.estimatedMinutes.min}-{config.estimatedMinutes.max} minutes
                      </div>
                      <div>
                        🏅 Badge: {config.badgeName}
                      </div>
                    </div>

                    <p className="text-gray-700 mb-3">
                      Perfect for: {config.description}
                    </p>
                  </div>

                  <button
                    className={`ml-4 px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                      creating
                        ? 'bg-gray-300 cursor-not-allowed'
                        : isGettingStarted
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Select →'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {userStats && (
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>Yesterday: {userStats.words_reviewed || 0} words reviewed</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}
