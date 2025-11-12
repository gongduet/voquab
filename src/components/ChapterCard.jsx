import { useNavigate } from 'react-router-dom'

export default function ChapterCard({ chapter, progress, isUnlocked, isNextToUnlock, onUnlockCelebration }) {
  const navigate = useNavigate()

  // UNLOCKED CHAPTER - Can read and study
  if (isUnlocked) {
    const encounterRate = progress.total_chapter_words > 0
      ? (progress.words_encountered / progress.total_chapter_words) * 100
      : 0

    return (
      <div className="bg-white border-2 border-green-200 rounded-xl p-6 hover:shadow-xl transition-all">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✅</span>
          <h3 className="text-xl font-serif font-bold text-amber-800">
            Chapter {chapter.chapter_number}: {chapter.title}
          </h3>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{progress.words_encountered}/{progress.total_chapter_words} words encountered</span>
            <span className="font-semibold">{encounterRate.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${encounterRate}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/read/${chapter.chapter_number}`)}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-serif font-semibold"
          >
            Read Chapter →
          </button>
          <button
            onClick={() => navigate('/flashcards')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-serif font-semibold"
          >
            📚 Study
          </button>
        </div>
      </div>
    )
  }

  // NEXT CHAPTER TO UNLOCK - Show progress
  if (isNextToUnlock) {
    const encounterRate = progress.total_chapter_words > 0
      ? (progress.words_encountered / progress.total_chapter_words) * 100
      : 0

    const masteryProgress = (progress.average_mastery / 40) * 100
    const exposureProgress = (progress.total_reviews / 50) * 100
    const balancedProgress = ((progress.average_mastery / 30) * 50) + ((progress.total_reviews / 30) * 50)

    const masteryMet = progress.average_mastery >= 40
    const exposureMet = progress.total_reviews >= 50
    const balancedMet = progress.average_mastery >= 30 && progress.total_reviews >= 30

    return (
      <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6 hover:shadow-xl transition-all">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🔒</span>
          <h3 className="text-xl font-serif font-bold text-amber-800">
            Chapter {chapter.chapter_number}: {chapter.title}
          </h3>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-serif font-bold text-yellow-800">
              Unlock Progress
            </span>
            <span className="text-lg font-serif font-bold text-yellow-800">
              {Math.min(100, progress.unlock_progress).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-yellow-200 rounded-full h-3 mb-4">
            <div
              className="bg-gradient-to-r from-yellow-500 to-amber-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progress.unlock_progress)}%` }}
            />
          </div>

          <div className="space-y-2 text-sm font-serif">
            {/* Baseline: Encounter Rate */}
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-amber-200">
              <span className="flex items-center gap-2">
                <span>📖</span>
                <span>Words Encountered</span>
              </span>
              <span className={`font-bold ${encounterRate >= 80 ? 'text-green-600' : 'text-gray-600'}`}>
                {progress.words_encountered}/{progress.total_chapter_words} ({encounterRate.toFixed(0)}%)
              </span>
            </div>

            {/* Path A: Mastery */}
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-amber-200">
              <span className="flex items-center gap-2">
                <span>⭐</span>
                <span>Avg Mastery (Path A)</span>
              </span>
              <span className={`font-bold ${masteryMet ? 'text-green-600' : 'text-gray-600'}`}>
                {progress.average_mastery.toFixed(0)}/40 {masteryMet && '✓'}
              </span>
            </div>

            {/* Path B: Exposure */}
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-amber-200">
              <span className="flex items-center gap-2">
                <span>📚</span>
                <span>Total Reviews (Path B)</span>
              </span>
              <span className={`font-bold ${exposureMet ? 'text-green-600' : 'text-gray-600'}`}>
                {progress.total_reviews}/50 {exposureMet && '✓'}
              </span>
            </div>

            {/* Path C: Balanced */}
            <div className="flex justify-between items-center p-2 bg-white rounded-lg border border-amber-200">
              <span className="flex items-center gap-2">
                <span>⚖️</span>
                <span>Balanced (Path C)</span>
              </span>
              <span className={`font-bold ${balancedMet ? 'text-green-600' : 'text-gray-600'}`}>
                {progress.average_mastery.toFixed(0)}/30 + {progress.total_reviews}/30 {balancedMet && '✓'}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 bg-amber-100 rounded-lg border border-amber-300">
            <div className="text-xs text-amber-800 font-serif">
              <div className="font-bold mb-1">Unlock Requirements (any one):</div>
              <div>• 80%+ words encountered + (40 avg mastery OR 50 reviews OR 30+30)</div>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/flashcards')}
          className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-serif font-semibold"
        >
          Study to Unlock →
        </button>
      </div>
    )
  }

  // FUTURE LOCKED CHAPTERS - Not yet accessible
  return (
    <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 opacity-60 cursor-not-allowed">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🔒</span>
        <h3 className="text-xl font-serif font-bold text-gray-600">
          Chapter {chapter.chapter_number}: {chapter.title}
        </h3>
      </div>
      <div className="text-sm text-gray-500 font-serif">
        Complete previous chapters to unlock
      </div>
    </div>
  )
}
