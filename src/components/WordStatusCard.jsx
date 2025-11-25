import { useState } from 'react'
import { calculateCurrentHealth } from '../utils/healthCalculations'
import { checkTimeGate } from '../utils/timeGateCalculations'

/**
 * WordStatusCard - Shows detailed word status and learning context
 * Provides transparency on WHY the user is reviewing this word
 */
export default function WordStatusCard({ word }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Calculate current health with decay
  const healthData = calculateCurrentHealth(word)
  const currentHealth = healthData.health
  const healthStatus = healthData.status

  // Check time gate status
  const timeGateInfo = checkTimeGate(word)
  const canGainMastery = timeGateInfo.canGainMastery
  const timeGateMessage = timeGateInfo.message

  // Determine mastery level (0-10)
  const masteryLevel = Math.floor((word.mastery_level || 0) / 10)
  const masteryLabels = [
    'New', 'Introduced', 'Recognizing', 'Learning', 'Familiar',
    'Known', 'Strong', 'Mastered', 'Expert', 'Native', 'Perfect'
  ]
  const masteryLabel = masteryLabels[masteryLevel] || 'New'

  // Determine word category/reason for review
  const getCategory = () => {
    if ((word.total_reviews || 0) === 0) {
      return { icon: '🆕', label: 'New Word', color: 'purple' }
    }
    if (currentHealth < 20) {
      return { icon: '⚡', label: 'URGENT - Health Critical', color: 'red' }
    }
    if (canGainMastery && word.mastery_level < 100) {
      return { icon: '🎯', label: 'Mastery Ready', color: 'blue' }
    }
    if (currentHealth < 60) {
      return { icon: '💪', label: 'Health Building', color: 'orange' }
    }
    return { icon: '🔄', label: 'Review & Reinforce', color: 'green' }
  }

  const category = getCategory()

  // Calculate next milestone
  const getNextMilestone = () => {
    const nextLevelThreshold = (masteryLevel + 1) * 10
    const pointsToNext = nextLevelThreshold - (word.mastery_level || 0)

    if (pointsToNext > 0 && masteryLevel < 10) {
      return `${pointsToNext} points to Level ${masteryLevel + 1}`
    }

    if (currentHealth < 100) {
      const healthToRestore = 100 - currentHealth
      return `Restore ${healthToRestore} health points`
    }

    return 'Mastery Perfect!'
  }

  // Health bar color
  const getHealthColor = () => {
    if (currentHealth < 20) return 'bg-red-500'
    if (currentHealth < 40) return 'bg-orange-500'
    if (currentHealth < 60) return 'bg-yellow-500'
    if (currentHealth < 80) return 'bg-green-400'
    return 'bg-green-500'
  }

  // Mastery bar color
  const getMasteryColor = () => {
    if (word.mastery_level < 20) return 'bg-gray-400'
    if (word.mastery_level < 50) return 'bg-blue-400'
    if (word.mastery_level < 80) return 'bg-purple-400'
    return 'bg-amber-500'
  }

  // Category background color
  const getCategoryBgColor = () => {
    const colors = {
      red: 'bg-red-50 border-red-200',
      orange: 'bg-orange-50 border-orange-200',
      yellow: 'bg-yellow-50 border-yellow-200',
      green: 'bg-green-50 border-green-200',
      blue: 'bg-blue-50 border-blue-200',
      purple: 'bg-purple-50 border-purple-200'
    }
    return colors[category.color] || 'bg-gray-50 border-gray-200'
  }

  // What this review does
  const getReviewImpact = () => {
    if ((word.total_reviews || 0) === 0) {
      return {
        icon: '✨',
        text: 'First encounter! This review will establish your baseline.',
        color: 'text-purple-700'
      }
    }

    if (currentHealth < 20) {
      return {
        icon: '⚡',
        text: 'URGENT: Restore health to prevent forgetting this word!',
        color: 'text-red-700'
      }
    }

    if (canGainMastery && word.mastery_level < 100) {
      return {
        icon: '✅',
        text: 'This review can gain mastery points (progress toward mastery!)',
        color: 'text-green-700'
      }
    }

    if (!canGainMastery && timeGateMessage) {
      return {
        icon: '⏰',
        text: `${timeGateMessage} (health still improves!)`,
        color: 'text-amber-700'
      }
    }

    return {
      icon: '💪',
      text: 'This review will maintain your progress and restore health.',
      color: 'text-blue-700'
    }
  }

  const reviewImpact = getReviewImpact()

  if (isCollapsed) {
    // Collapsed view - just show expand button
    return (
      <div className="mb-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between font-serif text-sm text-gray-600"
        >
          <span>📊 Show Word Status</span>
          <span>▼</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div className={`border-2 rounded-lg p-4 ${getCategoryBgColor()}`}>
        {/* Header with collapse button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{category.icon}</span>
            <span className="font-serif font-semibold text-gray-800">
              {category.label}
            </span>
          </div>
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ▲ Hide
          </button>
        </div>

        {/* Current State */}
        <div className="space-y-3 mb-4">
          {/* Mastery Level */}
          <div>
            <div className="flex items-center justify-between text-xs font-serif mb-1">
              <span className="text-gray-700">Mastery Level: <span className="font-semibold">Level {masteryLevel}: {masteryLabel}</span></span>
              <span className="text-gray-600">{word.mastery_level || 0}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getMasteryColor()} transition-all duration-300`}
                style={{ width: `${word.mastery_level || 0}%` }}
              />
            </div>
          </div>

          {/* Health */}
          <div>
            <div className="flex items-center justify-between text-xs font-serif mb-1">
              <span className="text-gray-700">Health: <span className="font-semibold">{healthStatus}</span></span>
              <span className="text-gray-600">{Math.round(currentHealth)}/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getHealthColor()} transition-all duration-300`}
                style={{ width: `${currentHealth}%` }}
              />
            </div>
          </div>

          {/* Reviews Count */}
          <div className="text-xs font-serif text-gray-600">
            Total Reviews: <span className="font-semibold">{word.total_reviews || 0}</span>
            {word.total_reviews > 0 && (
              <span className="ml-2">
                ({Math.round(((word.correct_reviews || 0) / word.total_reviews) * 100)}% accuracy)
              </span>
            )}
          </div>
        </div>

        {/* What This Review Does */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{reviewImpact.icon}</span>
            <div className="flex-1">
              <p className={`text-sm font-serif font-medium ${reviewImpact.color}`}>
                {reviewImpact.text}
              </p>
            </div>
          </div>
        </div>

        {/* Next Milestone */}
        <div className="text-xs font-serif text-gray-600">
          🎯 Next Milestone: <span className="font-semibold">{getNextMilestone()}</span>
        </div>
      </div>
    </div>
  )
}
