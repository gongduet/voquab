export default function ChapterUnlockModal({ chapter, onClose, onStartReading }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-bounce-in">
        <div className="text-center">
          {/* Celebration Icon */}
          <div className="text-8xl mb-4 animate-pulse">🎉</div>

          {/* Title */}
          <h2 className="text-4xl font-serif font-bold text-amber-800 mb-3">
            Chapter Unlocked!
          </h2>

          {/* Chapter Info */}
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 mb-4 border-2 border-amber-300">
            <div className="text-2xl font-serif font-bold text-amber-900 mb-1">
              Chapter {chapter.chapter_number}
            </div>
            <div className="text-lg font-serif text-amber-800">
              {chapter.title}
            </div>
          </div>

          {/* Congratulations Message */}
          <p className="text-lg text-gray-700 font-serif mb-6 leading-relaxed">
            Excellent work! Your dedication to learning has paid off.
            You've unlocked the next chapter of your journey.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onStartReading}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:from-amber-700 hover:to-orange-700 transition-all font-serif font-bold text-lg shadow-lg"
            >
              Start Reading Chapter {chapter.chapter_number} →
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-serif"
            >
              Continue Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
