import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const [dailyGoalWords, setDailyGoalWords] = useState(100)
  const [cardsPerSession, setCardsPerSession] = useState(25)
  const [allowExplicitContent, setAllowExplicitContent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      fetchSettings()
    }
  }, [user])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError(null)

      console.log('Fetching user settings for user:', user.id)

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('daily_goal_words, cards_per_session, allow_explicit_content')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        console.error('Error fetching settings:', fetchError)
        throw fetchError
      }

      if (data) {
        console.log('Loaded settings:', data)
        setDailyGoalWords(data.daily_goal_words || 100)
        setCardsPerSession(data.cards_per_session || 25)
        setAllowExplicitContent(data.allow_explicit_content || false)
      } else {
        console.log('No settings found, using defaults')
        // No settings yet, use defaults
        setDailyGoalWords(100)
        setCardsPerSession(25)
        setAllowExplicitContent(false)
      }

      setLoading(false)
    } catch (err) {
      console.error('Error in fetchSettings:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setMessage(null)
      setError(null)

      console.log('Saving settings:', {
        daily_goal_words: dailyGoalWords,
        cards_per_session: cardsPerSession,
        allow_explicit_content: allowExplicitContent
      })

      // Check if settings already exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        // Update existing settings
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            daily_goal_words: dailyGoalWords,
            cards_per_session: cardsPerSession,
            allow_explicit_content: allowExplicitContent,
          })
          .eq('user_id', user.id)

        if (updateError) throw updateError
      } else {
        // Insert new settings
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert([{
            user_id: user.id,
            daily_goal_words: dailyGoalWords,
            cards_per_session: cardsPerSession,
            allow_explicit_content: allowExplicitContent,
          }])

        if (insertError) throw insertError
      }

      setMessage('Settings saved successfully! ✅')
      setSaving(false)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f3] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <div className="text-xl font-serif text-gray-600">Loading settings...</div>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-serif font-bold text-amber-800">Settings</h1>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-amber-200">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">⚙️</span>
            <div>
              <h2 className="text-3xl font-serif font-bold text-amber-800">Your Settings</h2>
              <p className="text-sm text-gray-600 font-serif">Customize your learning experience</p>
            </div>
          </div>

          {/* Success/Error Messages */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-green-800 font-serif text-center">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-800 font-serif text-center">Error: {error}</p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            {/* Daily Goals Section */}
            <div>
              <h3 className="text-xl font-serif font-bold text-amber-700 mb-4 flex items-center gap-2">
                <span>🎯</span>
                <span>Daily Goals</span>
              </h3>

              <div className="bg-amber-50 rounded-xl p-6 border-2 border-amber-200">
                <label htmlFor="dailyGoalWords" className="block mb-2">
                  <span className="text-sm font-serif font-semibold text-gray-700">
                    Daily Word Goal
                  </span>
                </label>

                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    id="dailyGoalWords"
                    min="1"
                    max="500"
                    value={dailyGoalWords}
                    onChange={(e) => setDailyGoalWords(parseInt(e.target.value) || 100)}
                    className="w-32 px-4 py-3 text-2xl font-bold text-center rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none font-serif"
                  />
                  <span className="text-lg font-serif text-gray-700">words/day</span>
                </div>

                <p className="text-sm text-gray-600 font-serif mt-3">
                  Set your target for daily reviews. This affects your calendar color coding.
                </p>
              </div>
            </div>

            {/* Session Settings Section */}
            <div>
              <h3 className="text-xl font-serif font-bold text-amber-700 mb-4 flex items-center gap-2">
                <span>📚</span>
                <span>Session Settings</span>
              </h3>

              <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                <label htmlFor="cardsPerSession" className="block mb-2">
                  <span className="text-sm font-serif font-semibold text-gray-700">
                    Cards Per Session
                  </span>
                </label>

                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    id="cardsPerSession"
                    min="5"
                    max="100"
                    value={cardsPerSession}
                    onChange={(e) => setCardsPerSession(parseInt(e.target.value) || 25)}
                    className="w-32 px-4 py-3 text-2xl font-bold text-center rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none font-serif"
                  />
                  <span className="text-lg font-serif text-gray-700">cards</span>
                </div>

                <p className="text-sm text-gray-600 font-serif mt-3">
                  How many cards to show in each review session. Recommended: 15-30 cards.
                </p>
              </div>
            </div>

            {/* Content Settings Section */}
            <div>
              <h3 className="text-xl font-serif font-bold text-amber-700 mb-4 flex items-center gap-2">
                <span>🎵</span>
                <span>Content Settings</span>
              </h3>

              <div className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-serif font-semibold text-gray-700 block mb-1">
                      Allow Explicit Content
                    </span>
                    <p className="text-sm text-gray-600 font-serif">
                      Show vulgar slang terms when learning from songs. Disabled by default.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowExplicitContent(!allowExplicitContent)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      allowExplicitContent ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                        allowExplicitContent ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {allowExplicitContent && (
                  <div className="mt-4 p-3 bg-purple-100 rounded-lg border border-purple-300">
                    <p className="text-sm text-purple-800 font-serif">
                      Vulgar slang terms will be included in song vocabulary. These may include profanity and adult language.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-amber-300">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div className="text-sm font-serif text-gray-700">
                  <p className="font-bold mb-2">Tips for setting goals:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Start with 50-100 words/day if you're a beginner</li>
                    <li>15-25 cards per session is ideal for focused learning</li>
                    <li>You can always adjust these settings later</li>
                    <li>Calendar colors update based on your daily goal</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-serif text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-6 py-4 border-2 border-amber-600 text-amber-800 rounded-xl hover:bg-amber-50 transition-colors font-serif text-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
