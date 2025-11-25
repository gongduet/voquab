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
  const isCommonWordsActive = location.pathname === '/admin/common-words'

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-gray-800">
                ⚙️ Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600 font-serif">
                Manage vocabulary and system settings
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-serif"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-6">
            <Link
              to="/admin/common-words"
              className={`px-4 py-3 font-serif font-medium border-b-2 transition-colors ${
                isCommonWordsActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              📚 Common Words
            </Link>
            {/* Future tabs can be added here */}
            {/* <Link to="/admin/users">👥 Users</Link> */}
            {/* <Link to="/admin/content">📖 Content</Link> */}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {location.pathname === '/admin' ? (
          // Default admin home
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-serif font-bold text-gray-800 mb-4">
              Welcome to Admin Dashboard
            </h2>
            <p className="text-gray-600 font-serif mb-6">
              Select a tab above to manage different aspects of Voquab.
            </p>

            <div className="grid gap-4">
              <Link
                to="/admin/common-words"
                className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <h3 className="text-lg font-serif font-semibold text-gray-800 mb-2">
                  📚 Common Words Management
                </h3>
                <p className="text-sm text-gray-600 font-serif">
                  Mark common/stop words that shouldn't appear in learning sessions
                </p>
              </Link>

              {/* Future admin sections */}
              <div className="p-6 border-2 border-gray-200 rounded-lg opacity-50">
                <h3 className="text-lg font-serif font-semibold text-gray-800 mb-2">
                  👥 User Management (Coming Soon)
                </h3>
                <p className="text-sm text-gray-600 font-serif">
                  View and manage user accounts
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
