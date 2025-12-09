import { useNavigate } from 'react-router-dom'

export default function ChapterCompleteScreen({
  focusChapter,
  chapterInfo
}) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Celebration Icon */}
        <div className="text-6xl mb-4">🎉</div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Chapter {focusChapter} Complete!
        </h2>

        {/* Chapter Title */}
        {chapterInfo && (
          <div className="text-lg text-gray-600 mb-4">
            {chapterInfo.title}
          </div>
        )}

        {/* Message */}
        <p className="text-gray-600 mb-6">
          All words in this chapter are studied with good health and up-to-date mastery.
          Great work! 🌟
        </p>

        {/* Stats (optional - can add later) */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600">
            Keep reviewing words regularly to maintain your progress!
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/book')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            📚 Return to Book
          </button>

          <button
            onClick={() => navigate('/flashcards')}
            className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Study All Chapters
          </button>
        </div>
      </div>
    </div>
  )
}
