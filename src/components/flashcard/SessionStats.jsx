import { useEffect, useState } from 'react'

export default function SessionStats({
  currentIndex,
  totalCards,
  sessionRatings,
  sessionStartTime,
  focusChapter = null,
  chapterInfo = null,
  onExitChapterFocus = null
}) {
  const [elapsedTime, setElapsedTime] = useState(0)

  // Update elapsed time every second
  useEffect(() => {
    if (!sessionStartTime) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
      setElapsedTime(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionStartTime])

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate accuracy
  const totalReviewed = Object.values(sessionRatings).reduce((sum, count) => sum + count, 0)
  const correctReviews = (sessionRatings.hard || 0) + (sessionRatings.medium || 0) + (sessionRatings.easy || 0)
  const accuracy = totalReviewed > 0 ? Math.round((correctReviews / totalReviewed) * 100) : 0

  return (
    <div className="mb-6">
      {/* Chapter Focus Banner */}
      {focusChapter && chapterInfo && (
        <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📖</span>
              <div>
                <div className="font-semibold text-blue-800">
                  Chapter {focusChapter} Focus Mode
                </div>
                <div className="text-sm text-blue-600">
                  {chapterInfo.title}
                </div>
              </div>
            </div>
            {onExitChapterFocus && (
              <button
                onClick={onExitChapterFocus}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Study All Chapters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cards Remaining */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">
            {currentIndex + 1}/{totalCards}
          </div>
          <div className="text-sm text-gray-600 mt-1">Cards</div>
        </div>

        {/* Accuracy */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">
            {accuracy}%
          </div>
          <div className="text-sm text-gray-600 mt-1">Accuracy</div>
        </div>

        {/* Time Elapsed */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">
            {formatTime(elapsedTime)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Time</div>
        </div>

        {/* Total Reviews */}
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">
            {totalReviewed}
          </div>
          <div className="text-sm text-gray-600 mt-1">Reviewed</div>
        </div>
      </div>

      {/* Rating Breakdown */}
      {totalReviewed > 0 && (
        <div className="mt-3 flex justify-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-red-500">❌</span>
            <span className="text-gray-600">{sessionRatings['dont-know'] || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-orange-500">🟠</span>
            <span className="text-gray-600">{sessionRatings.hard || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">🟡</span>
            <span className="text-gray-600">{sessionRatings.medium || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-500">✅</span>
            <span className="text-gray-600">{sessionRatings.easy || 0}</span>
          </div>
        </div>
      )}
    </div>
  )
}
