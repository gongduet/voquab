import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function AdminRoute({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

      if (!error && data?.is_admin) {
        setIsAdmin(true)
      }
      setLoading(false)
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, authLoading])

  // Still loading auth or admin status
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-600"></div>
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />
  }

  // Logged in but not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // Logged in and is admin
  return children
}
