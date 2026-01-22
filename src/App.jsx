import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AdminRoute from './components/AdminRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ReadingMode from './pages/ReadingMode'
import Flashcards from './pages/Flashcards'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import StyleTest from './pages/StyleTest'
import PackageSelection from './pages/PackageSelection'
import PackageView from './pages/PackageView'
import Admin from './pages/Admin'
import AdminCommonWords from './pages/AdminCommonWords'
import AdminSentences from './pages/AdminSentences'
import SentenceDeepDive from './pages/SentenceDeepDive'
import LemmaDeepDive from './pages/LemmaDeepDive'
import OrphanedWords from './pages/OrphanedWords'
import AdminPhrases from './pages/AdminPhrases'
import PhraseDeepDive from './pages/PhraseDeepDive'
import AdminSongs from './pages/AdminSongs'
import SongDeepDive from './pages/SongDeepDive'
import AdminSongLines from './pages/AdminSongLines'
import LineDeepDive from './pages/LineDeepDive'
import AdminSlang from './pages/AdminSlang'
import SlangDeepDive from './pages/SlangDeepDive'
import AdminFeedback from './pages/AdminFeedback'
import Songs from './pages/Songs'
import SongStudy from './pages/SongStudy'
import Library from './pages/Library'
import BookDashboard from './pages/BookDashboard'
import SongDashboard from './pages/SongDashboard'

// Redirect component for song vocab routes → unified flashcards
function SongVocabRedirect() {
  const { songId } = useParams()
  return <Navigate to={`/flashcards?songId=${songId}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public landing page for unauthenticated users */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />
          {/* Auth routes (fallback for direct navigation) */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/styletest" element={<StyleTest />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          {/* /book without ID → redirect to library */}
          <Route
            path="/book"
            element={
              <ProtectedRoute>
                <Navigate to="/library" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/read"
            element={
              <ProtectedRoute>
                <ReadingMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/read/:chapterNumber"
            element={
              <ProtectedRoute>
                <ReadingMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flashcards"
            element={
              <ProtectedRoute>
                <Flashcards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/package-selection"
            element={
              <ProtectedRoute>
                <PackageSelection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/package/:packageId"
            element={
              <ProtectedRoute>
                <PackageView />
              </ProtectedRoute>
            }
          />
          {/* Library - Browse all content */}
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          {/* Book Dashboard */}
          <Route
            path="/book/:bookId"
            element={
              <ProtectedRoute>
                <BookDashboard />
              </ProtectedRoute>
            }
          />
          {/* Book Reading Mode */}
          <Route
            path="/book/:bookId/read"
            element={
              <ProtectedRoute>
                <ReadingMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:bookId/read/:chapterNumber"
            element={
              <ProtectedRoute>
                <ReadingMode />
              </ProtectedRoute>
            }
          />
          {/* Song Dashboard */}
          <Route
            path="/song/:songId"
            element={
              <ProtectedRoute>
                <SongDashboard />
              </ProtectedRoute>
            }
          />
          {/* Songs (Lyrics-based learning) */}
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <Songs />
              </ProtectedRoute>
            }
          />
          {/* Song Vocab → redirect to unified flashcards */}
          <Route
            path="/song/:songId/vocab"
            element={
              <ProtectedRoute>
                <SongVocabRedirect />
              </ProtectedRoute>
            }
          />
          {/* Song Study (new route) */}
          <Route
            path="/song/:songId/study"
            element={
              <ProtectedRoute>
                <SongStudy />
              </ProtectedRoute>
            }
          />
          {/* Legacy song routes - redirect to unified flashcards */}
          <Route
            path="/songs/:songId/vocab"
            element={
              <ProtectedRoute>
                <SongVocabRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs/:songId/study"
            element={
              <ProtectedRoute>
                <SongStudy />
              </ProtectedRoute>
            }
          />
          {/* Admin Routes (requires is_admin flag in user_settings) */}
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>}>
            <Route path="common-words" element={<AdminCommonWords />} />
            <Route path="lemmas/orphaned" element={<OrphanedWords />} />
            <Route path="lemmas/:lemmaId" element={<LemmaDeepDive />} />
            <Route path="phrases" element={<AdminPhrases />} />
            <Route path="phrases/:phraseId" element={<PhraseDeepDive />} />
            <Route path="sentences" element={<AdminSentences />} />
            <Route path="sentences/:sentenceId" element={<SentenceDeepDive />} />
            <Route path="songs" element={<AdminSongs />} />
            <Route path="songs/:songId" element={<SongDeepDive />} />
            <Route path="song-lines/:lineId" element={<LineDeepDive />} />
            <Route path="song-lines" element={<AdminSongLines />} />
            <Route path="slang" element={<AdminSlang />} />
            <Route path="slang/:slangId" element={<SlangDeepDive />} />
            <Route path="feedback" element={<AdminFeedback />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
