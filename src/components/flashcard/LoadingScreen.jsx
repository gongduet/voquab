import { useState, useEffect } from 'react'

/**
 * LoadingScreen - Notion-inspired loading animation for flashcard sessions
 *
 * Features:
 * - Animated book that opens and closes
 * - Spanish words floating up from the book
 * - "Reverse dissolve" text animation
 * - Clean, sophisticated aesthetic matching dashboard/session summary
 */
export default function LoadingScreen({ mode = 'review' }) {
  // Dynamic title based on mode
  const titleWords = mode === 'learn'
    ? ["Curating", "new", "words..."]
    : ["Preparing", "your", "session..."]

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-6 font-sans">

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes openBook {
          0%, 10% { transform: scaleX(0); }
          30%, 70% { transform: scaleX(1); }
          90%, 100% { transform: scaleX(0); }
        }

        @keyframes floatMagic {
          0% { opacity: 0; transform: translateY(10px) scale(0.5) rotate(0deg); filter: blur(2px); }
          20% { opacity: 1; transform: translateY(-15px) scale(1) rotate(-5deg); filter: blur(0px); }
          50% { transform: translateY(-35px) translateX(5px) rotate(5deg); }
          80% { opacity: 0; transform: translateY(-50px) translateX(-5px) rotate(-5deg); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
        }

        @keyframes reverseDissolve {
          0% { opacity: 0; filter: blur(8px); transform: translateY(4px); }
          100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
      `}</style>

      {/* Card Container */}
      <div className="w-full max-w-[320px] bg-white rounded-xl border border-[#e7e5e4] shadow-[0_2px_8px_rgba(0,0,0,0.02)] py-12 px-8 flex flex-col items-center text-center relative overflow-hidden">

        {/* Animated Book Icon Container */}
        <div className="mb-10 relative h-20 w-32 flex items-center justify-center">

          {/* Magic Words floating out */}
          <div className="absolute bottom-8 flex flex-col items-center z-0 pointer-events-none">
            <div
              className="text-[10px] text-[#0ea5e9] font-medium opacity-0 absolute"
              style={{ animation: 'floatMagic 3.5s ease-in-out infinite', animationDelay: '0.8s', left: '-10px' }}
            >
              luna
            </div>
            <div
              className="text-[10px] text-[#f59e0b] font-medium opacity-0 absolute"
              style={{ animation: 'floatMagic 3.5s ease-in-out infinite', animationDelay: '1.4s', left: '8px' }}
            >
              flor
            </div>
            <div
              className="text-[10px] text-[#0ea5e9]/70 font-medium opacity-0 absolute"
              style={{ animation: 'floatMagic 3.5s ease-in-out infinite', animationDelay: '2.1s', left: '-4px' }}
            >
              rey
            </div>
            <div
              className="text-[10px] text-[#0ea5e9]/50 font-medium opacity-0 absolute"
              style={{ animation: 'floatMagic 3.5s ease-in-out infinite', animationDelay: '2.8s', left: '12px' }}
            >
              zorro
            </div>
          </div>

          {/* The Book SVG */}
          <div className="relative z-10 text-[#737373]">
            <svg
              width="64"
              height="48"
              viewBox="0 0 64 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Left Page (Static base) */}
              <path d="M4 8C4 8 14 6 32 8V44C14 42 4 44 4 44V8Z" fill="white" />

              {/* Right Page (Animated) */}
              <g style={{ transformOrigin: '32px center', animation: 'openBook 3.5s ease-in-out infinite' }}>
                <path d="M32 8C50 6 60 8 60 8V44C60 44 50 42 32 44V8Z" fill="white" />
                {/* Text lines on the right page */}
                <path d="M38 16H54" strokeWidth="1.5" stroke="#e5e5e5" />
                <path d="M38 24H50" strokeWidth="1.5" stroke="#e5e5e5" />
                <path d="M38 32H52" strokeWidth="1.5" stroke="#e5e5e5" />
              </g>

              {/* Spine / Center Binding */}
              <line x1="32" y1="8" x2="32" y2="44" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Primary Message with Reverse Dissolve Animation */}
        <h2 className="text-[15px] font-medium text-[#171717] tracking-wide flex gap-1.5 justify-center">
          {titleWords.map((word, index) => (
            <span
              key={index}
              className="opacity-0"
              style={{
                animation: 'reverseDissolve 0.8s ease-out forwards',
                animationDelay: `${index * 0.2}s`
              }}
            >
              {word}
            </span>
          ))}
        </h2>

      </div>
    </div>
  )
}
