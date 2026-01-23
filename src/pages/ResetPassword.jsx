import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { updatePassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Listen for PASSWORD_RECOVERY event and check session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true)
          setCheckingSession(false)
        } else if (event === 'SIGNED_IN' && session) {
          // User might be in recovery mode if they have a session
          setCheckingSession(false)
        }
      }
    )

    // Check current session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // If there's a session, allow password update
        setIsRecoveryMode(true)
      }
      setCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setError('')
    setLoading(true)

    const { error: updateError } = await updatePassword(password)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    // Redirect to dashboard after 2 seconds
    setTimeout(() => navigate('/dashboard'), 2000)
  }

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-landing-accent mx-auto" />
          <p className="mt-4 text-landing-muted font-body">Verifying...</p>
        </div>
      </div>
    )
  }

  // No valid recovery session
  if (!isRecoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
        <div className="w-full max-w-md bg-landing-bg-secondary rounded-xl border border-landing-border p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-3xl">&#x26A0;&#xFE0F;</span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-landing-text mb-3">
            Invalid or Expired Link
          </h2>
          <p className="text-landing-muted font-body mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold hover:bg-landing-accent-hover transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
        <div className="w-full max-w-md bg-landing-bg-secondary rounded-xl border border-landing-border p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-landing-text mb-3">
            Password Updated
          </h2>
          <p className="text-landing-muted font-body">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
      <div className="w-full max-w-md bg-landing-bg-secondary rounded-xl border border-landing-border p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-3xl font-semibold text-landing-accent hover:text-landing-accent-hover transition-colors">
            Voquab
          </Link>
          <h2 className="font-display text-xl font-semibold text-landing-text mt-6">
            Set new password
          </h2>
          <p className="text-landing-muted font-body text-sm mt-2">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm font-body">{error}</p>
            </div>
          )}

          {/* New Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-body font-medium text-landing-text mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"
                placeholder="Enter new password"
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-landing-muted hover:text-landing-text transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-body font-medium text-landing-text mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-landing-muted hover:text-landing-text transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold hover:bg-landing-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {/* Back to Login Link */}
        <div className="text-center pt-6 border-t border-landing-border mt-6">
          <Link
            to="/login"
            className="text-landing-accent hover:text-landing-accent-hover font-body text-sm transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
