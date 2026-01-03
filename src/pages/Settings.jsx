import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, User, BookOpen, Music, Check } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Account
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')

  // Learning
  const [dailyGoalWords, setDailyGoalWords] = useState(100)
  const [cardsPerSession, setCardsPerSession] = useState(25)

  // Content
  const [allowExplicitContent, setAllowExplicitContent] = useState(false)

  // UI State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      fetchSettings()
    }
  }, [user])

  async function fetchSettings() {
    try {
      setLoading(true)

      // Fetch user settings and profile in parallel
      const [settingsResult, profileResult] = await Promise.all([
        supabase
          .from('user_settings')
          .select('daily_goal_words, cards_per_session, allow_explicit_content')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle()
      ])

      if (settingsResult.data) {
        setDailyGoalWords(settingsResult.data.daily_goal_words || 100)
        setCardsPerSession(settingsResult.data.cards_per_session || 25)
        setAllowExplicitContent(settingsResult.data.allow_explicit_content || false)
      }

      if (profileResult.data) {
        setDisplayName(profileResult.data.display_name || '')
      }

      // Get email from auth user
      setEmail(user.email || '')

    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      setSaved(false)

      // Update user_settings
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingSettings) {
        await supabase
          .from('user_settings')
          .update({
            daily_goal_words: dailyGoalWords,
            cards_per_session: cardsPerSession,
            allow_explicit_content: allowExplicitContent,
          })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            daily_goal_words: dailyGoalWords,
            cards_per_session: cardsPerSession,
            allow_explicit_content: allowExplicitContent,
          })
      }

      // Update user_profiles display_name
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingProfile) {
        await supabase
          .from('user_profiles')
          .update({ display_name: displayName })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: displayName,
          })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

    } catch (err) {
      console.error('Error saving settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-sm font-semibold text-neutral-800">Settings</h1>
          <div className="w-14" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">

          {/* Account Section */}
          <section className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <User className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-medium text-neutral-700">Account</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                  Email
                </label>
                <div className="px-3 py-2 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-md">
                  {email}
                </div>
              </div>
            </div>
          </section>

          {/* Learning Section */}
          <section className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-medium text-neutral-700">Learning</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Daily Word Goal */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-700">Daily Word Goal</div>
                  <div className="text-xs text-neutral-400 mt-0.5">Target words to review each day</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={dailyGoalWords}
                    onChange={(e) => setDailyGoalWords(parseInt(e.target.value) || 100)}
                    className="w-20 px-2 py-1.5 text-sm text-center border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="text-xs text-neutral-400">words</span>
                </div>
              </div>

              <div className="border-t border-neutral-100" />

              {/* Cards Per Session */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-700">Cards Per Session</div>
                  <div className="text-xs text-neutral-400 mt-0.5">Flashcards shown in each review</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={cardsPerSession}
                    onChange={(e) => setCardsPerSession(parseInt(e.target.value) || 25)}
                    className="w-20 px-2 py-1.5 text-sm text-center border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="text-xs text-neutral-400">cards</span>
                </div>
              </div>
            </div>
          </section>

          {/* Content Section */}
          <section className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
              <Music className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-medium text-neutral-700">Content</h2>
            </div>
            <div className="p-4">
              {/* Explicit Content Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-700">Allow Explicit Content</div>
                  <div className="text-xs text-neutral-400 mt-0.5">Show vulgar slang terms from songs</div>
                </div>
                <button
                  onClick={() => setAllowExplicitContent(!allowExplicitContent)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    allowExplicitContent ? 'bg-primary-500' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                      allowExplicitContent ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                saved
                  ? 'bg-green-500 text-white'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : saving ? (
                <span>Saving...</span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
