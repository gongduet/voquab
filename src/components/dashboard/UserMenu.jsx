/**
 * UserMenu - Dropdown menu for user actions
 *
 * Features:
 * - User avatar trigger with initial
 * - Language switcher with submenu
 * - Settings link
 * - Admin link (conditional)
 * - Logout
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Settings,
  LogOut,
  Shield,
  Globe,
  ChevronRight,
  Check,
  User
} from 'lucide-react'

export default function UserMenu({
  username = '',
  isAdmin = false,
  onLanguageChange = null
}) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [languages, setLanguages] = useState([])
  const [activeLanguage, setActiveLanguage] = useState(null)
  const [loading, setLoading] = useState(true)
  const menuRef = useRef(null)
  const languageMenuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
        setShowLanguageMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch languages and user's active language
  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  async function fetchData() {
    setLoading(true)
    try {
      const [languagesResult, settingsResult] = await Promise.all([
        supabase
          .from('languages')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('user_settings')
          .select('active_language')
          .eq('user_id', user.id)
          .maybeSingle()
      ])

      if (languagesResult.data) {
        setLanguages(languagesResult.data)
      }

      if (settingsResult.data?.active_language) {
        const activeLang = languagesResult.data?.find(
          l => l.language_code === settingsResult.data.active_language
        )
        setActiveLanguage(activeLang || languagesResult.data?.[0])
      } else {
        // Default to first language (Spanish)
        setActiveLanguage(languagesResult.data?.[0])
      }
    } catch (error) {
      console.error('Error fetching user menu data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleLanguageSwitch(language) {
    if (language.language_code === activeLanguage?.language_code) {
      setShowLanguageMenu(false)
      return
    }

    try {
      // Get first book in the new language to set as active
      const { data: books } = await supabase
        .from('books')
        .select('book_id')
        .eq('language_code', language.language_code)
        .limit(1)

      const newActiveBookId = books?.[0]?.book_id || null

      // Update user settings
      const { data: existing } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      const updateData = {
        active_language: language.language_code,
        active_book_id: newActiveBookId,
        active_song_id: null // Reset song when changing language
      }

      if (existing) {
        await supabase
          .from('user_settings')
          .update(updateData)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_settings')
          .insert({ user_id: user.id, ...updateData })
      }

      setActiveLanguage(language)
      setShowLanguageMenu(false)
      setIsOpen(false)

      // Callback to parent to refresh content
      if (onLanguageChange) {
        onLanguageChange(language)
      } else {
        // Reload the page to refresh all content
        window.location.reload()
      }
    } catch (error) {
      console.error('Error switching language:', error)
    }
  }

  async function handleLogout() {
    setIsOpen(false)
    await signOut()
    navigate('/login')
  }

  const displayInitial = username ? username.charAt(0).toUpperCase() : 'U'

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar trigger button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          setShowLanguageMenu(false)
        }}
        className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center hover:bg-primary-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="User menu"
      >
        {username ? (
          <span className="text-sm font-semibold">{displayInitial}</span>
        ) : (
          <User className="w-4 h-4" />
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50 text-sm">
          {/* User info header */}
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="font-medium text-neutral-800 text-sm">{username || 'User'}</div>
            {activeLanguage && !loading && (
              <div className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                <span>Learning {activeLanguage.language_name}</span>
                <span>{activeLanguage.flag_emoji}</span>
              </div>
            )}
          </div>

          {/* Language switcher */}
          <div className="py-0.5">
            <button
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-600">Switch Language</span>
              </div>
              <ChevronRight className={`w-3 h-3 text-neutral-400 transition-transform ${showLanguageMenu ? 'rotate-90' : ''}`} />
            </button>

            {/* Language submenu (inline expand) */}
            {showLanguageMenu && (
              <div className="bg-neutral-50 py-0.5" ref={languageMenuRef}>
                {languages.map(lang => (
                  <button
                    key={lang.language_code}
                    onClick={() => handleLanguageSwitch(lang)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 pl-9 text-left transition-colors ${
                      activeLanguage?.language_code === lang.language_code
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{lang.flag_emoji}</span>
                      <span>{lang.language_name}</span>
                    </div>
                    {activeLanguage?.language_code === lang.language_code && (
                      <Check className="w-3 h-3 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-100 py-0.5">
            {/* Settings */}
            <button
              onClick={() => {
                setIsOpen(false)
                navigate('/settings')
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-50 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-neutral-600">Settings</span>
            </button>

            {/* Admin (conditional) */}
            {isAdmin && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  navigate('/admin')
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-neutral-50 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-neutral-600">Admin</span>
              </button>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-neutral-100 py-0.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-red-50 transition-colors text-red-500"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
