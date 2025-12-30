import { RotateCcw, AlertCircle, Check, Sparkles } from 'lucide-react'

export default function DifficultyButtons({
  onDifficulty,
  disabled = false
}) {
  return (
    <div className="max-w-2xl mx-auto mt-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        .button-hover {
          transition: transform 0.15s ease-out, opacity 0.15s ease-out;
        }

        .button-hover:hover {
          transform: scale(1.25);
        }

        .button-hover:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* Icon Buttons - 4 buttons with new color scheme */}
      <div className="grid grid-cols-4 gap-4 px-2">
        {/* Again Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('again', e); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <RotateCcw
            size={36}
            strokeWidth={2.5}
            style={{ color: '#d4806a' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-sm font-semibold transition-all duration-150"
            style={{ color: '#d4806a' }}
          >
            Again
          </span>
        </button>

        {/* Hard Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('hard', e); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <AlertCircle
            size={36}
            strokeWidth={2.5}
            style={{ color: '#e5989b' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-sm font-semibold transition-all duration-150"
            style={{ color: '#e5989b' }}
          >
            Hard
          </span>
        </button>

        {/* Got It Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('got-it', e); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <Check
            size={36}
            strokeWidth={2.5}
            style={{ color: '#5aada4' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-sm font-semibold transition-all duration-150"
            style={{ color: '#5aada4' }}
          >
            Got It
          </span>
        </button>

        {/* Easy Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('easy', e); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <Sparkles
            size={36}
            strokeWidth={2.5}
            style={{ color: '#006d77' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-150"
          />
          <span
            className="text-sm font-semibold transition-all duration-150"
            style={{ color: '#006d77' }}
          >
            Easy
          </span>
        </button>
      </div>

    </div>
  )
}
