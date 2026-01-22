import { useState, useEffect } from 'react'
import AuthDropdown from './AuthDropdown'
import MobileMenu from './MobileMenu'

const NAV_ITEMS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'experience', label: 'Experience' },
  { id: 'library', label: 'Library' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]

/**
 * Header - Fixed navigation with scroll effects
 * - Transparent on page load
 * - Gains backdrop blur on scroll
 * - Desktop: inline nav + auth dropdown
 * - Mobile: hamburger menu
 */
export default function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-landing-bg/95 backdrop-blur-md shadow-lg border-b border-landing-border/50'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="font-display text-2xl font-semibold text-landing-accent hover:text-landing-accent-hover transition-colors"
        >
          Voquab
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-landing-muted hover:text-landing-text transition-colors font-body text-sm"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Desktop Auth */}
        <div className="hidden md:block">
          <AuthDropdown />
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </nav>
    </header>
  )
}
