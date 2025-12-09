export default function WordStatusCard({
  card,
  showDetailedReview = false,
  onToggleDetail = null,
  getMasteryPercentage,
  formatTimeAgo
}) {
  if (!card) return null

  const masteryPercentage = getMasteryPercentage(card.mastery_level)
  const masteryLevel = Math.floor(card.mastery_level / 10)

  // Mastery level labels
  const masteryLabels = [
    'New', 'Introduced', 'Recognizing', 'Learning', 'Familiar',
    'Known', 'Strong', 'Mastered', 'Expert', 'Native', 'Perfect'
  ]

  // Health status
  const healthStatus = card.health >= 80 ? 'EXCELLENT' :
                       card.health >= 60 ? 'GOOD' :
                       card.health >= 40 ? 'MEDIUM' :
                       card.health >= 20 ? 'LOW' : 'CRITICAL'

  const healthColor = card.health >= 80 ? 'bg-green-500' :
                      card.health >= 60 ? 'bg-lime-500' :
                      card.health >= 40 ? 'bg-yellow-500' :
                      card.health >= 20 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className="max-w-2xl mx-auto mt-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-bold text-gray-800">Word Status</h3>
          </div>
          {onToggleDetail && (
            <button
              onClick={onToggleDetail}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showDetailedReview ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>

        {/* Mastery Section */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Mastery Level: {masteryLabels[masteryLevel]}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {card.mastery_level}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${masteryPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {masteryLevel < 10 ? `Next level at ${(masteryLevel + 1) * 10} points` : 'Maximum level reached!'}
          </div>
        </div>

        {/* Health Section */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Health: {healthStatus}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {card.health}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`${healthColor} h-3 rounded-full transition-all duration-500`}
              style={{ width: `${card.health}%` }}
            />
          </div>
        </div>

        {/* Total Reviews */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600">Total Reviews</div>
            <div className="text-2xl font-bold text-gray-900">{card.total_reviews || 0}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-600">Correct Reviews</div>
            <div className="text-2xl font-bold text-green-600">{card.correct_reviews || 0}</div>
          </div>
        </div>

        {/* Last Reviewed */}
        {card.last_reviewed_at && (
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-semibold">Last reviewed:</span> {formatTimeAgo(card.last_reviewed_at)}
          </div>
        )}

        {/* Why This Word Appeared */}
        {showDetailedReview && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-2">
              💡 Why this word appeared:
            </div>
            <ul className="text-sm text-blue-700 space-y-1">
              {card.health < 40 && (
                <li>• Low health ({card.health}/100) - needs practice</li>
              )}
              {card.mastery_level < 50 && (
                <li>• Still learning (mastery: {card.mastery_level}/100)</li>
              )}
              {card.total_reviews < 10 && (
                <li>• Building exposure ({card.total_reviews} reviews so far)</li>
              )}
              {card.frequency > 20 && (
                <li>• High-frequency word (appears {card.frequency}x in book)</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
