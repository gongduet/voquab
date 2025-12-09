import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PACKAGE_TYPES, calculatePackageProgress, isPackageExpired } from '../utils/packageCalculations'

export default function PackageView() {
  const { packageId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [package_, setPackage] = useState(null)
  const [words, setWords] = useState([])
  const [waypoints, setWaypoints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPackage()

    // Check expiration every minute
    const interval = setInterval(checkExpiration, 60000)
    return () => clearInterval(interval)
  }, [packageId])

  async function loadPackage() {
    try {
      if (!user) {
        navigate('/login')
        return
      }

      console.log('📦 Loading package:', packageId)

      // Load package
      const { data: pkg, error: pkgError } = await supabase
        .from('user_packages')
        .select('*')
        .eq('package_id', packageId)
        .eq('user_id', user.id)
        .single()

      if (pkgError || !pkg) {
        console.error('Error loading package:', pkgError)
        navigate('/')
        return
      }

      console.log('✅ Package loaded:', pkg)
      setPackage(pkg)

      // Load package words with lemma data
      const { data: pkgWords, error: wordsError } = await supabase
        .from('package_words')
        .select(`
          *,
          lemmas (
            lemma_id,
            lemma_text,
            definitions
          )
        `)
        .eq('package_id', packageId)
        .order('word_order')

      if (wordsError) {
        console.error('Error loading package words:', wordsError)
      } else {
        console.log(`📚 Loaded ${pkgWords?.length || 0} package words`)

        // Load occurrence counts for times_in_book calculation
        const { data: wordsData } = await supabase
          .from('words')
          .select('lemma_id')

        // Count occurrences per lemma_id
        const countsMap = {}
        if (wordsData) {
          wordsData.forEach(word => {
            countsMap[word.lemma_id] = (countsMap[word.lemma_id] || 0) + 1
          })
        }

        // Merge times_in_book into vocabulary objects with compatibility aliases
        const wordsWithCounts = pkgWords?.map(word => ({
          ...word,
          vocabulary: word.lemmas ? {
            vocab_id: word.lemmas.lemma_id,
            lemma: word.lemmas.lemma_text,
            english_definition: Array.isArray(word.lemmas.definitions) ? word.lemmas.definitions[0] : word.lemmas.definitions,
            times_in_book: countsMap[word.vocab_id] || 0
          } : null
        })) || []

        console.log(`📊 Calculated occurrence counts for package words`)
        setWords(wordsWithCounts)
      }

      // Load waypoints
      const { data: waypointsData, error: waypointsError } = await supabase
        .from('user_waypoints')
        .select('*')
        .eq('package_id', packageId)
        .order('waypoint_number')

      if (waypointsError) {
        console.error('Error loading waypoints:', waypointsError)
      } else {
        console.log(`🗺️ Loaded ${waypointsData?.length || 0} waypoints`)
        setWaypoints(waypointsData || [])
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading package:', error)
      setLoading(false)
    }
  }

  async function checkExpiration() {
    if (!package_) return

    if (isPackageExpired(package_) && package_.status === 'active') {
      console.log('⏰ Package expired, marking as expired')

      // Mark as expired
      await supabase
        .from('user_packages')
        .update({ status: 'expired' })
        .eq('package_id', package_.package_id)

      // Reload
      await loadPackage()
    }
  }

  function startReview() {
    // Navigate to flashcards in package mode
    // Flashcards component will automatically load the current active waypoint
    navigate(`/flashcards?package=${packageId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!package_) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Package not found</div>
      </div>
    )
  }

  const config = PACKAGE_TYPES[package_.package_type]
  const progress = calculatePackageProgress(package_)
  const isExpired = package_.status === 'expired'
  const isCompleted = package_.status === 'completed'

  // Time remaining
  const now = new Date()
  const expiresAt = new Date(package_.expires_at)
  const hoursRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)))
  const minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60)) % 60)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{config.badge}</span>
            <div>
              <h1 className="text-3xl font-bold">
                {config.name} Package
              </h1>
              <p className="text-gray-600">{config.words} words</p>
            </div>
          </div>

          {!isCompleted && !isExpired && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Time Remaining</div>
              <div className="text-2xl font-bold text-orange-600">
                {hoursRemaining}h {minutesRemaining}m
              </div>
            </div>
          )}
        </div>

        {/* Status banner */}
        {isExpired && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold">
              This package has expired after 24 hours.
            </p>
          </div>
        )}

        {isCompleted && (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">
              Package completed! Great work!
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-medium">
              {package_.words_completed}/{package_.total_words} words ({progress}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Waypoint Trail */}
        {waypoints.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Learning Journey</h2>
            <div className="space-y-3">
              {waypoints.map((waypoint, index) => {
                const waypointProgress = waypoint.total_words > 0
                  ? Math.round((waypoint.words_completed / waypoint.total_words) * 100)
                  : 0

                const statusIcon =
                  waypoint.status === 'completed' ? '✅' :
                  waypoint.status === 'active' ? '🔵' :
                  '⚪'

                const borderColor =
                  waypoint.status === 'completed' ? 'border-green-400' :
                  waypoint.status === 'active' ? 'border-blue-400' :
                  'border-gray-300'

                const bgColor =
                  waypoint.status === 'completed' ? 'bg-green-50' :
                  waypoint.status === 'active' ? 'bg-blue-50' :
                  'bg-gray-50'

                return (
                  <div
                    key={waypoint.waypoint_id}
                    className={`border-2 ${borderColor} ${bgColor} rounded-lg p-4 transition-all`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{statusIcon}</span>
                          <span className="text-3xl">{waypoint.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{waypoint.name}</h3>
                            <span className="text-xs text-gray-500 uppercase font-semibold">
                              {waypoint.theme.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{waypoint.description}</p>

                          {/* Waypoint progress bar */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    waypoint.status === 'completed' ? 'bg-green-500' :
                                    waypoint.status === 'active' ? 'bg-blue-500' :
                                    'bg-gray-400'
                                  }`}
                                  style={{ width: `${waypointProgress}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-sm font-medium whitespace-nowrap">
                              {waypoint.words_completed}/{waypoint.total_words}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Performance stats */}
        {package_.words_completed > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">
                {package_.dont_know_count}
              </div>
              <div className="text-sm text-gray-600">Don't Know</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">
                {package_.hard_count}
              </div>
              <div className="text-sm text-gray-600">Hard</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {package_.medium_count}
              </div>
              <div className="text-sm text-gray-600">Medium</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {package_.easy_count}
              </div>
              <div className="text-sm text-gray-600">Easy</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-4">
          {!isCompleted && !isExpired && (
            <button
              onClick={startReview}
              className="flex-1 bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-semibold text-lg transition-colors"
            >
              {package_.words_completed > 0 ? 'Continue Review →' : 'Begin Package →'}
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="bg-gray-200 py-4 px-6 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Home
          </button>
        </div>

        {/* Words breakdown (optional detail view) */}
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-bold mb-4">Package Contents</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Critical:</span>{' '}
              {words.filter(w => w.category === 'critical').length} words
            </div>
            <div>
              <span className="font-semibold">Mastery Ready:</span>{' '}
              {words.filter(w => w.category === 'mastery_ready').length} words
            </div>
            <div>
              <span className="font-semibold">Exposure:</span>{' '}
              {words.filter(w => w.category === 'exposure').length} words
            </div>
            <div>
              <span className="font-semibold">New:</span>{' '}
              {words.filter(w => w.category === 'new').length} words
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
