import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * AuthForm - Shared auth form component for login/signup
 * Used by AuthDropdown (desktop) and MobileMenu (mobile)
 *
 * Props:
 * - onSuccess: Callback when auth succeeds (optional)
 * - compact: Use more compact styling (default: false)
 */
export default function AuthForm({ onSuccess, compact = false }) {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Validate passwords match
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }

        // Validate password length
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setLoading(false)
          return
        }

        // Validate username
        if (!username.trim()) {
          setError('Username is required')
          setLoading(false)
          return
        }

        const { data, error: signUpError } = await signUp(email, password, username)

        if (signUpError) {
          setError(signUpError.message)
          setLoading(false)
          return
        }

        // Check if email confirmation is required
        if (data?.user && !data.session) {
          setShowConfirmation(true)
          setLoading(false)
          return
        }

        // Success - redirect to dashboard
        onSuccess?.()
        navigate('/dashboard')
      } else {
        // Sign in
        const { error: signInError } = await signIn(email, password)

        if (signInError) {
          setError(signInError.message)
          setLoading(false)
          return
        }

        // Success - redirect to dashboard
        onSuccess?.()
        navigate('/dashboard')
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const inputClasses = compact
    ? "w-full px-3 py-2 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark text-sm focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"
    : "w-full px-4 py-3 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"

  const buttonClasses = compact
    ? "w-full py-2 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold text-sm hover:bg-landing-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    : "w-full py-3 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold hover:bg-landing-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"

  if (showConfirmation) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-landing-accent/20 flex items-center justify-center">
          <span className="text-2xl">✉️</span>
        </div>
        <h3 className="font-display text-lg font-semibold text-landing-text mb-2">
          Check your email
        </h3>
        <p className="text-landing-muted text-sm font-body">
          We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form Title */}
      <div className="text-center mb-4">
        <h3 className="font-display text-xl font-semibold text-landing-text">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h3>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm font-body">{error}</p>
        </div>
      )}

      {/* Username (signup only) */}
      {mode === 'signup' && (
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClasses}
          required
          disabled={loading}
        />
      )}

      {/* Email */}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClasses}
        required
        disabled={loading}
      />

      {/* Password */}
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClasses}
        required
        disabled={loading}
        minLength={6}
      />

      {/* Confirm Password (signup only) */}
      {mode === 'signup' && (
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClasses}
          required
          disabled={loading}
        />
      )}

      {/* Submit Button */}
      <button type="submit" className={buttonClasses} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-landing-border"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-landing-bg-secondary text-landing-muted-dark text-xs font-body">
            or
          </span>
        </div>
      </div>

      {/* Toggle Mode */}
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError('')
        }}
        className="w-full py-2 text-landing-accent hover:text-landing-accent-hover font-body text-sm transition-colors"
        disabled={loading}
      >
        {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>
    </form>
  )
}
