import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const { signIn, resetPassword } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setError('')
    setLoading(true)

    const { data, error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (data?.user) {
      navigate('/dashboard')
    }

    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }

    setError('')
    setResetLoading(true)

    const { error: resetError } = await resetPassword(email)

    if (resetError) {
      setError(resetError.message)
      setResetLoading(false)
      return
    }

    setResetEmailSent(true)
    setResetLoading(false)
  }

  // Show "check your email" confirmation after reset request
  if (resetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
        <div className="w-full max-w-md bg-landing-bg-secondary rounded-xl border border-landing-border p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-landing-accent/20 flex items-center justify-center">
            <span className="text-3xl">&#x2709;&#xFE0F;</span>
          </div>
          <h2 className="font-display text-2xl font-semibold text-landing-text mb-3">
            Check your email
          </h2>
          <p className="text-landing-muted font-body mb-6">
            We sent a password reset link to <strong className="text-landing-text">{email}</strong>
          </p>
          <button
            onClick={() => setResetEmailSent(false)}
            className="text-landing-accent hover:text-landing-accent-hover font-body text-sm transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-landing-bg px-4">
      <div className="w-full max-w-md bg-landing-bg-secondary rounded-xl border border-landing-border p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-3xl font-semibold text-landing-accent hover:text-landing-accent-hover transition-colors">
            Voquab
          </Link>
          <h2 className="font-display text-xl font-semibold text-landing-text mt-6">
            Welcome back
          </h2>
          <p className="text-landing-muted font-body text-sm mt-2">
            Sign in to continue your learning journey
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm font-body">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-body font-medium text-landing-text mb-2">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-body font-medium text-landing-text mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 bg-landing-bg border border-landing-border rounded-lg text-landing-text placeholder-landing-muted-dark focus:outline-none focus:ring-2 focus:ring-landing-accent focus:border-transparent"
                placeholder="Enter your password"
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

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-sm text-landing-accent hover:text-landing-accent-hover font-body transition-colors disabled:opacity-50"
            >
              {resetLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold hover:bg-landing-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center pt-6 border-t border-landing-border mt-6">
          <p className="text-landing-muted font-body text-sm">
            Don't have an account?{' '}
            <Link to="/signup" className="text-landing-accent hover:text-landing-accent-hover font-semibold transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
