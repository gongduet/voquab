import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Book from './pages/Book'
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/styletest" element={<StyleTest />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/book"
            element={
              <ProtectedRoute>
                <Book />
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
          {/* Admin Routes (password-protected, no ProtectedRoute needed) */}
          <Route path="/admin" element={<Admin />}>
            <Route path="common-words" element={<AdminCommonWords />} />
            <Route path="sentences" element={<AdminSentences />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
