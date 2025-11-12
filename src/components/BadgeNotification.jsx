import { useEffect, useState } from 'react'

export default function BadgeNotification({ badge, onClose }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation entrance
    setTimeout(() => setIsVisible(true), 10)

    // Auto-dismiss after 5 seconds
    const timeout = setTimeout(() => {
      handleClose()
    }, 5000)

    return () => clearTimeout(timeout)
  }, [])

  function handleClose() {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
    }, 300) // Wait for fade out animation
  }

  if (!badge) return null

  // Tier colors
  const tierColors = {
    bronze: 'from-orange-400 to-orange-600',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-blue-300 to-blue-500'
  }

  const tierGradient = tierColors[badge.tier] || 'from-blue-400 to-blue-600'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-300 ${
        isVisible ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Badge icon with gradient background */}
        <div className={`bg-gradient-to-br ${tierGradient} rounded-full w-32 h-32 flex items-center justify-center mx-auto mb-6 shadow-lg`}>
          <span className="text-7xl">{badge.icon}</span>
        </div>

        {/* Celebration header */}
        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
            Badge Earned!
          </h2>
          <div className="text-2xl font-bold text-gray-800 mb-2">
            {badge.name}
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm font-semibold uppercase mb-3">
            {badge.tier} Tier
          </div>
          <p className="text-gray-600">
            {badge.description}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleClose}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-6 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
        >
          Awesome! 🎉
        </button>
      </div>
    </div>
  )
}
