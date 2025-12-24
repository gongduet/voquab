/**
 * FragmentButtons - Reading mode response buttons
 *
 * Three buttons: Need Help / Hard / Got It
 * Follows DifficultyButtons styling pattern with reading-specific labels
 */

import { HelpCircle, AlertCircle, CheckCircle } from 'lucide-react'

export default function FragmentButtons({
  onResponse,
  disabled = false
}) {
  return (
    <div className="w-full mt-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        .fragment-button-hover {
          transition: transform 0.15s ease-out, opacity 0.15s ease-out;
        }

        .fragment-button-hover:hover {
          transform: scale(1.15);
        }

        .fragment-button-hover:active {
          transform: scale(0.95);
        }
      `}</style>

      <div className="grid grid-cols-3 gap-6 px-4">
        {/* Need Help Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onResponse('need-help'); }}
          disabled={disabled}
          className="py-3 fragment-button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30 min-h-[72px]"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <HelpCircle
            size={32}
            strokeWidth={2}
            style={{ color: '#6d6875' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-xs font-semibold transition-all duration-150"
            style={{ color: '#6d6875' }}
          >
            Need Help
          </span>
        </button>

        {/* Hard Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onResponse('hard'); }}
          disabled={disabled}
          className="py-3 fragment-button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30 min-h-[72px]"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <AlertCircle
            size={32}
            strokeWidth={2}
            style={{ color: '#e5989b' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-xs font-semibold transition-all duration-150"
            style={{ color: '#e5989b' }}
          >
            Hard
          </span>
        </button>

        {/* Got It Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onResponse('got-it'); }}
          disabled={disabled}
          className="py-3 fragment-button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30 min-h-[72px]"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <CheckCircle
            size={32}
            strokeWidth={2}
            style={{ color: '#a8dadc' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-xs font-semibold transition-all duration-150"
            style={{ color: '#a8dadc' }}
          >
            Got It
          </span>
        </button>
      </div>
    </div>
  )
}
