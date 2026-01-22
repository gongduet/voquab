import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * PublicRoute - Shows landing page for unauthenticated users
 * Redirects to /dashboard for authenticated users
 */
export default function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-landing-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-landing-accent"></div>
          <p className="mt-4 text-landing-muted font-body">Loading...</p>
        </div>
      </div>
    )
  }

  // If logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
