import { useEffect, useState } from 'react'

/**
 * LevelUpCelebration - Animated celebration when user advances mastery levels
 * Shows old level → new level transition with confetti-like effect
 */
export default function LevelUpCelebration({ oldLevel, newLevel, word, onClose }) {
  const [isVisible, setIsVisible] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState([])

  const masteryLabels = [
    'New', 'Introduced', 'Recognizing', 'Learning', 'Familiar',
    'Known', 'Strong', 'Mastered', 'Expert', 'Native', 'Perfect'
  ]

  const oldLevelName = masteryLabels[oldLevel] || 'New'
  const newLevelName = masteryLabels[newLevel] || 'New'

  useEffect(() => {
    // Fade in animation
    setIsVisible(true)

    // Generate confetti pieces
    const pieces = []
    const colors = ['#fbbf24', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6']
    for (let i = 0; i < 30; i++) {
      pieces.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    }
    setConfettiPieces(pieces)

    // Auto-dismiss after 3 seconds
    const timer = setTimeout(() => {
      handleClose()
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      if (onClose) onClose()
    }, 300) // Wait for fade-out animation
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-300 ${
        isVisible ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={handleClose}
    >
      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            className="absolute w-2 h-2 rounded-full animate-fall"
            style={{
              left: `${piece.left}%`,
              top: '-10px',
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`
            }}
          />
        ))}
      </div>

      {/* Celebration Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 animate-bounce">🎆</div>
          <h2 className="text-3xl font-serif font-bold text-amber-700 mb-1">
            LEVEL UP!
          </h2>
          {word && (
            <p className="text-sm text-gray-600 font-serif">
              "{word.lemma}"
            </p>
          )}
        </div>

        {/* Level Transition */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 mb-6 border-2 border-amber-200">
          <div className="flex items-center justify-center gap-4">
            {/* Old Level */}
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-400 font-serif mb-1">
                {oldLevel}
              </div>
              <div className="text-sm text-gray-500 font-serif">
                {oldLevelName}
              </div>
            </div>

            {/* Arrow */}
            <div className="text-3xl text-amber-600 animate-pulse">
              →
            </div>

            {/* New Level */}
            <div className="text-center">
              <div className="text-5xl font-bold text-amber-600 font-serif mb-1 animate-pulse">
                {newLevel}
              </div>
              <div className="text-sm text-amber-700 font-serif font-semibold">
                {newLevelName}
              </div>
            </div>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="text-center mb-6">
          <p className="text-gray-700 font-serif">
            {getMotivationalMessage(newLevel)}
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleClose}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-serif font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg"
        >
          Continue
        </button>

        {/* Auto-dismiss timer */}
        <p className="text-xs text-center text-gray-500 mt-3 font-serif">
          Auto-continues in 3 seconds
        </p>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
    </div>
  )
}

/**
 * Get motivational message based on new level
 */
function getMotivationalMessage(level) {
  const messages = {
    1: "You're getting familiar with this word! 🌱",
    2: "Starting to recognize it! Keep going! 👀",
    3: "You're learning! Great progress! 📚",
    4: "This word is becoming familiar! 💪",
    5: "You know this word well! 🎯",
    6: "Strong grasp of this word! 💎",
    7: "You've mastered it! Excellent work! 🏆",
    8: "Expert level! You're crushing it! 🌟",
    9: "Near-native proficiency! Incredible! 🚀",
    10: "Perfect mastery achieved! 🎉"
  }
  return messages[level] || "Great progress! Keep it up! 🎉"
}
