import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

/**
 * Admin Dashboard - Password-protected admin interface
 *
 * Features:
 * - Simple password authentication (VITE_ADMIN_PASSWORD)
 * - Tab navigation for different admin functions
 * - Session-based auth (stored in sessionStorage)
 */
export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const location = useLocation()

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

  useEffect(() => {
    // Check if already authenticated this session
    const authStatus = sessionStorage.getItem('admin_authenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()

    if (!ADMIN_PASSWORD) {
      setError('Admin password not configured. Set VITE_ADMIN_PASSWORD in .env')
      return
    }

    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_authenticated', 'true')
      setError('')
      setPassword('')
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('admin_authenticated')
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-gray-800 mb-2">
              🔒 Admin Access
            </h1>
            <p className="text-gray-600 font-serif">
              Enter admin password to continue
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-serif font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-serif"
                placeholder="Enter admin password"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-serif">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white font-serif font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-sm text-blue-600 hover:text-blue-700 font-serif"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Admin dashboard
  const isLemmasActive = location.pathname === '/admin/common-words' || location.pathname.startsWith('/admin/lemmas/')
  const isLemmaDeepDive = location.pathname.startsWith('/admin/lemmas/') && location.pathname !== '/admin/lemmas'
  const isPhrasesActive = location.pathname === '/admin/phrases' || location.pathname.startsWith('/admin/phrases/')
  const isPhraseDeepDive = location.pathname.startsWith('/admin/phrases/') && location.pathname !== '/admin/phrases'
  const isSentencesActive = location.pathname === '/admin/sentences' || location.pathname.startsWith('/admin/sentences/')
  const isSentenceDeepDive = location.pathname.startsWith('/admin/sentences/') && location.pathname !== '/admin/sentences'

  // Get current page name for breadcrumb
  const currentPage = isLemmaDeepDive ? 'Lemma Details'
    : isLemmasActive ? 'Lemmas'
    : isPhraseDeepDive ? 'Phrase Details'
    : isPhrasesActive ? 'Phrases'
    : isSentenceDeepDive ? 'Sentence Details'
    : isSentencesActive ? 'Sentences'
    : 'Dashboard'

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header - Notion style */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row: Breadcrumb + Logout */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Link to="/admin" className="hover:text-neutral-700">Admin</Link>
              {currentPage !== 'Dashboard' && (
                <>
                  <span>/</span>
                  <span className="text-neutral-900">{currentPage}</span>
                </>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-neutral-900">
            {currentPage === 'Dashboard' ? 'Admin Dashboard' : currentPage}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {currentPage === 'Dashboard' && 'Manage vocabulary and system settings'}
            {currentPage === 'Lemmas' && 'Manage lemmas, definitions, and stop words'}
            {currentPage === 'Lemma Details' && 'Complete lemma breakdown with words, occurrences, and phrases'}
            {currentPage === 'Phrases' && 'Manage multi-word expressions, idioms, and collocations'}
            {currentPage === 'Phrase Details' && 'Complete phrase breakdown with definitions and occurrences'}
            {currentPage === 'Sentences' && 'Edit sentences, fragments, and translations'}
            {currentPage === 'Sentence Details' && 'Complete sentence breakdown with words, lemmas, and phrases'}
          </p>
        </div>
      </header>

      {/* Navigation Tabs - Notion style */}
      <nav className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            <Link
              to="/admin/common-words"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isLemmasActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Lemmas
            </Link>
            <Link
              to="/admin/phrases"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isPhrasesActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Phrases
            </Link>
            <Link
              to="/admin/sentences"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSentencesActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Sentences
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {location.pathname === '/admin' ? (
          // Default admin home
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to="/admin/common-words"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Lemmas
              </h3>
              <p className="text-sm text-neutral-500">
                Manage lemmas, definitions, and stop words
              </p>
            </Link>

            <Link
              to="/admin/phrases"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Phrases
              </h3>
              <p className="text-sm text-neutral-500">
                Manage multi-word expressions, idioms, and collocations
              </p>
            </Link>

            <Link
              to="/admin/sentences"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Sentences
              </h3>
              <p className="text-sm text-neutral-500">
                Edit sentences, fragments, translations, and paragraph breaks
              </p>
            </Link>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
