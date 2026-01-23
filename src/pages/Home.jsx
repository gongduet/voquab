import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PACKAGE_TYPES } from '../utils/packageCalculations'

export default function Home() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activePackage, setActivePackage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      checkActivePackage()
    }
  }, [user])

  async function checkActivePackage() {
    try {
      const { data } = await supabase
        .from('user_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        setActivePackage(data[0])
      }
    } catch (error) {
      console.error('Error checking active package:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">Voquab</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Daily Package Hero Section */}
        {!loading && (
          <div className="mb-8">
            {activePackage ? (
              <div
                onClick={() => navigate(`/package/${activePackage.package_id}`)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-2xl p-8 cursor-pointer hover:shadow-3xl transform hover:scale-[1.02] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-5xl">{PACKAGE_TYPES[activePackage.package_type]?.badge}</span>
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">
                          Resume Your Package
                        </h2>
                        <p className="text-blue-100 text-lg">
                          {PACKAGE_TYPES[activePackage.package_type]?.name} Package - {activePackage.words_completed}/{activePackage.total_words} words
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-blue-300 bg-opacity-30 rounded-full h-3 mb-4">
                      <div
                        className="bg-white h-3 rounded-full transition-all"
                        style={{ width: `${Math.round((activePackage.words_completed / activePackage.total_words) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <button className="ml-6 px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-bold text-lg transition-colors shadow-lg">
                    Continue →
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => navigate('/package-selection')}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-2xl p-8 cursor-pointer hover:shadow-3xl transform hover:scale-[1.02] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-5xl">📦</span>
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-1">
                          Start Today's Package
                        </h2>
                        <p className="text-purple-100 text-lg">
                          Choose your learning journey: Foundation, Standard, Immersion, or Mastery
                        </p>
                      </div>
                    </div>
                  </div>
                  <button className="ml-6 px-8 py-4 bg-white text-purple-600 rounded-lg hover:bg-purple-50 font-bold text-lg transition-colors shadow-lg">
                    Get Started →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Explore More Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <div
              onClick={() => navigate('/book')}
              className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-lg border-2 border-amber-200 hover:border-amber-400 transition-all cursor-pointer hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">📖</div>
              <h3 className="text-xl font-semibold text-amber-900 mb-2">
                Read El Principito
              </h3>
              <p className="text-gray-700 mb-4">
                Read The Little Prince in Spanish with chapter unlocking
              </p>
              <button className="mt-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium">
                Choose Chapter →
              </button>
            </div>

            <div
              onClick={() => navigate('/flashcards')}
              className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200 hover:border-green-400 transition-all cursor-pointer hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">📚</div>
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                Review Flashcards
              </h3>
              <p className="text-gray-700 mb-4">
                Practice vocabulary with spaced repetition flashcards
              </p>
              <button className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                Start Review →
              </button>
            </div>

            <div
              onClick={() => navigate('/progress')}
              className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-all cursor-pointer hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-xl font-semibold text-purple-900 mb-2">
                Track Progress
              </h3>
              <p className="text-gray-700 mb-4">
                Monitor your learning journey and achievements
              </p>
              <button className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                View Progress →
              </button>
            </div>

            <div
              onClick={() => navigate('/settings')}
              className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all cursor-pointer hover:shadow-xl transform hover:-translate-y-1"
            >
              <div className="text-3xl mb-3">⚙️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Settings
              </h3>
              <p className="text-gray-700 mb-4">
                Customize your daily goals and session preferences
              </p>
              <button className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
                Configure →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
