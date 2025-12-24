/**
 * TranslationReveal - Shows fragment translation after Need Help or Hard
 *
 * Features:
 * - Subtle fade-in animation
 * - Shows fragment text + translation
 * - "Continue" button to proceed
 */

import { ArrowRight } from 'lucide-react'

export default function TranslationReveal({
  fragmentText,
  translation,
  onContinue
}) {
  return (
    <div className="translation-reveal mt-6 px-4">
      <style>{`
        @keyframes translationFadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .translation-enter {
          animation: translationFadeIn 0.3s ease-out;
        }

        .continue-button {
          transition: all 0.15s ease-out;
        }

        .continue-button:hover {
          transform: translateX(4px);
        }

        .continue-button:active {
          transform: scale(0.98);
        }
      `}</style>

      <div className="translation-enter bg-neutral-50 rounded-lg p-4 border border-neutral-200">
        {/* Fragment text */}
        <p className="text-base font-medium text-neutral-800 mb-2">
          {fragmentText}
        </p>

        {/* Translation */}
        <p className="text-base text-neutral-600 italic">
          {translation || 'Translation not available'}
        </p>
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="continue-button mt-4 w-full py-3 px-4 flex items-center justify-center gap-2
                   bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-medium
                   min-h-[48px]"
      >
        <span>Continue</span>
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
