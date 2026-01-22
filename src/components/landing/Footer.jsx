import { Link } from 'react-router-dom'

/**
 * Footer - Simple footer with logo and links
 */
export default function Footer() {
  return (
    <footer className="py-12 bg-landing-bg border-t border-landing-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Tagline */}
          <div className="text-center md:text-left">
            <div className="font-display text-xl font-semibold text-landing-accent mb-1">
              Voquab
            </div>
            <div className="font-body text-landing-muted-dark text-sm">
              Read Spanish. For Real.
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 font-body text-sm text-landing-muted">
            <Link
              to="/login"
              className="hover:text-landing-text transition-colors"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="hover:text-landing-text transition-colors"
            >
              Sign Up
            </Link>
          </div>

          {/* Copyright */}
          <div className="font-body text-sm text-landing-muted-dark">
            &copy; {new Date().getFullYear()} Voquab. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
