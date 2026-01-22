import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Menu, X, LogOut, LayoutDashboard } from 'lucide-react'
import AuthForm from './AuthForm'

const NAV_ITEMS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'experience', label: 'Experience' },
  { id: 'library', label: 'Library' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]

/**
 * MobileMenu - Hamburger menu with slide-out drawer for mobile
 */
export default function MobileMenu() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const scrollToSection = (id) => {
    setIsOpen(false)
    // Small delay to allow drawer to close
    setTimeout(() => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }, 300)
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-landing-text hover:text-landing-accent transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-landing-bg-secondary z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-landing-border">
          <span className="font-display text-xl font-semibold text-landing-accent">
            Voquab
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-landing-muted hover:text-landing-text transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)]">
          {/* Navigation Links */}
          <nav className="p-4 border-b border-landing-border">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="block w-full text-left px-4 py-3 text-landing-text hover:text-landing-accent hover:bg-landing-bg-accent/50 rounded-lg transition-colors font-body"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Auth Section */}
          <div className="p-4">
            {user ? (
              // Logged in state
              <div className="space-y-2">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-landing-text hover:bg-landing-bg-accent/50 rounded-lg transition-colors"
                >
                  <LayoutDashboard className="w-5 h-5" />
                  Go to Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-landing-bg-accent/50 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              </div>
            ) : (
              // Logged out state - show auth form
              <AuthForm onSuccess={() => setIsOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
