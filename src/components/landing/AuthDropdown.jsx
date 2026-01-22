import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { User, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react'
import AuthForm from './AuthForm'

/**
 * AuthDropdown - Desktop auth dropdown component
 * Shows login/signup form for unauthenticated users
 * Shows user menu for authenticated users
 */
export default function AuthDropdown() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut()
    navigate('/')
  }

  // Authenticated user menu
  if (user) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 text-landing-text hover:text-landing-accent transition-colors rounded-lg hover:bg-landing-bg-accent/50"
        >
          <User className="w-5 h-5" />
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-landing-bg-secondary rounded-lg shadow-xl border border-landing-border py-2 z-50">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-landing-text hover:bg-landing-bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-landing-bg-accent transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        )}
      </div>
    )
  }

  // Unauthenticated - auth dropdown
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-2.5 bg-landing-accent text-landing-bg rounded-lg font-body font-semibold hover:bg-landing-accent-hover transition-colors"
      >
        Get Started
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-landing-bg-secondary rounded-xl shadow-2xl border border-landing-border p-5 z-50">
          <AuthForm onSuccess={() => setIsOpen(false)} compact />
        </div>
      )}
    </div>
  )
}
