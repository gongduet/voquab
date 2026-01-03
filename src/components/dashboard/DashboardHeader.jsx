import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import ContentSwitcher from './ContentSwitcher'
import UserMenu from './UserMenu'

/**
 * DashboardHeader - Logo, content switcher, animated streak pill, user menu
 */
export default function DashboardHeader({
  streak = 0,
  username = '',
  loading = false,
  isAdmin = false
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  // Auto-expand on first load if streak > 0, then collapse after delay
  useEffect(() => {
    if (streak > 0 && !loading && !hasAnimated) {
      // Small delay before expanding
      const expandTimer = setTimeout(() => {
        setIsExpanded(true)
      }, 500)

      // Collapse after showing
      const collapseTimer = setTimeout(() => {
        setIsExpanded(false)
        setHasAnimated(true)
      }, 3000)

      return () => {
        clearTimeout(expandTimer)
        clearTimeout(collapseTimer)
      }
    }
  }, [streak, loading, hasAnimated])

  // Toggle on click
  const handleStreakClick = () => {
    if (streak > 0) {
      setIsExpanded(!isExpanded)
    }
  }

  // Calculate compact pill width based on digit count
  const getCompactWidth = () => {
    const digits = String(streak).length
    if (digits === 1) return '52px'
    if (digits === 2) return '64px'
    return '76px' // 3+ digits
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
      {/* Logo / Title */}
      <div className="flex items-center">
        <span className="text-xl font-bold text-primary-600">Voquab</span>
      </div>

      {/* Right side: content switcher, streak, settings, avatar */}
      <div className="flex items-center gap-3">
        <ContentSwitcher />
        {/* Animated Streak Pill */}
        {loading ? (
          <div className="w-12 h-7 bg-neutral-200 rounded-full animate-pulse" />
        ) : (
          <button
            onClick={handleStreakClick}
            className={`
              flex items-center justify-center gap-1.5 py-1.5 rounded-full text-sm font-semibold
              transition-all duration-300 ease-out overflow-hidden
              ${streak > 0
                ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-amber-700 hover:from-orange-200 hover:to-amber-200'
                : 'bg-neutral-100 text-neutral-500'
              }
              ${isExpanded ? 'px-3' : 'px-2'}
            `}
            style={{
              minWidth: isExpanded ? '120px' : getCompactWidth(),
              maxWidth: isExpanded ? '140px' : getCompactWidth(),
            }}
          >
            <Flame
              className={`
                w-4 h-4 flex-shrink-0 transition-all duration-300
                ${streak > 0 ? 'text-orange-500' : 'text-neutral-400'}
                ${isExpanded && streak > 0 ? 'animate-pulse' : ''}
              `}
              fill={streak > 0 ? 'currentColor' : 'none'}
            />

            <span className={`
              transition-all duration-300 ease-out whitespace-nowrap
              ${isExpanded ? 'opacity-100 w-auto' : 'opacity-100 w-auto'}
            `}>
              {isExpanded ? (
                <span className="flex items-center gap-1">
                  <span>{streak}</span>
                  <span className="text-amber-600 font-medium">
                    {streak === 1 ? 'day' : 'days'}
                  </span>
                </span>
              ) : (
                streak
              )}
            </span>
          </button>
        )}

        {/* User Menu - Settings, Admin, Language, Logout */}
        <UserMenu
          username={username}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  )
}
