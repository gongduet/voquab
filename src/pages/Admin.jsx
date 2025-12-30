import { Link, Outlet, useLocation } from 'react-router-dom'

/**
 * Admin Dashboard - Admin interface for content management
 *
 * Access controlled by AdminRoute component (checks user_settings.is_admin)
 *
 * Features:
 * - Tab navigation for different admin functions
 * - Nested routes via Outlet
 */
export default function Admin() {
  const location = useLocation()

  // Determine active tab based on current route
  const isLemmasActive = location.pathname === '/admin/common-words' || location.pathname.startsWith('/admin/lemmas/')
  const isLemmaDeepDive = location.pathname.startsWith('/admin/lemmas/') && location.pathname !== '/admin/lemmas'
  const isPhrasesActive = location.pathname === '/admin/phrases' || location.pathname.startsWith('/admin/phrases/')
  const isPhraseDeepDive = location.pathname.startsWith('/admin/phrases/') && location.pathname !== '/admin/phrases'
  const isSentencesActive = location.pathname === '/admin/sentences' || location.pathname.startsWith('/admin/sentences/')
  const isSentenceDeepDive = location.pathname.startsWith('/admin/sentences/') && location.pathname !== '/admin/sentences'
  const isSongsActive = location.pathname === '/admin/songs' || location.pathname.startsWith('/admin/songs/')
  const isSongDeepDive = location.pathname.startsWith('/admin/songs/') && location.pathname !== '/admin/songs'
  const isSlangActive = location.pathname === '/admin/slang' || location.pathname.startsWith('/admin/slang/')
  const isSlangDeepDive = location.pathname.startsWith('/admin/slang/') && location.pathname !== '/admin/slang'

  // Get current page name for breadcrumb
  const currentPage = isLemmaDeepDive ? 'Lemma Details'
    : isLemmasActive ? 'Lemmas'
    : isPhraseDeepDive ? 'Phrase Details'
    : isPhrasesActive ? 'Phrases'
    : isSentenceDeepDive ? 'Sentence Details'
    : isSentencesActive ? 'Sentences'
    : isSongDeepDive ? 'Song Details'
    : isSongsActive ? 'Songs'
    : isSlangDeepDive ? 'Slang Details'
    : isSlangActive ? 'Slang'
    : 'Dashboard'

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header - Notion style */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row: Breadcrumb + Back link */}
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
            <Link
              to="/"
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
            >
              ← Dashboard
            </Link>
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
            {currentPage === 'Songs' && 'Manage songs for lyrics-based learning'}
            {currentPage === 'Song Details' && 'Edit song metadata, sections, and linked slang'}
            {currentPage === 'Slang' && 'Manage slang terms, definitions, and cultural context'}
            {currentPage === 'Slang Details' && 'Edit slang term details and view linked songs'}
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
            <div className="border-l border-neutral-200 mx-2" />
            <Link
              to="/admin/songs"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSongsActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Songs
            </Link>
            <Link
              to="/admin/slang"
              className={`py-3 text-sm border-b-2 transition-colors ${
                isSlangActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Slang
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

            <Link
              to="/admin/songs"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Songs
              </h3>
              <p className="text-sm text-neutral-500">
                Manage songs for lyrics-based vocabulary learning
              </p>
            </Link>

            <Link
              to="/admin/slang"
              className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <h3 className="text-base font-medium text-neutral-900 mb-1">
                Slang
              </h3>
              <p className="text-sm text-neutral-500">
                Manage slang terms, definitions, and cultural context
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
