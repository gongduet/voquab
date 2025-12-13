import { useNavigate } from 'react-router-dom'
import { Settings, Flame, User } from 'lucide-react'

/**
 * DashboardHeader - Logo, streak, settings, avatar
 *
 * @param {Object} props
 * @param {number} props.streak - Current streak in days
 * @param {string} props.username - User display name
 * @param {boolean} props.loading - Loading state
 */
export default function DashboardHeader({
  streak = 0,
  username = '',
  loading = false
}) {
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-100">
      {/* Logo / Title */}
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold text-primary-600">Voquab</span>
      </div>

      {/* Right side: streak, settings, avatar */}
      <div className="flex items-center gap-3">
        {/* Streak indicator */}
        {loading ? (
          <div className="w-12 h-6 bg-neutral-200 rounded animate-pulse" />
        ) : (
          <div
            className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium
              ${streak > 0 ? 'bg-secondary-100 text-secondary-700' : 'bg-neutral-100 text-neutral-500'}
            `}
          >
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-secondary-500' : 'text-neutral-400'}`} />
            <span>{streak}</span>
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Avatar / Profile */}
        <button
          onClick={() => navigate('/progress')}
          className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center hover:bg-primary-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Profile"
        >
          {username ? (
            <span className="text-sm font-semibold uppercase">{username.charAt(0)}</span>
          ) : (
            <User className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  )
}
