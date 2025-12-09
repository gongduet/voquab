export default function DifficultyButtons({
  onDifficulty,
  disabled = false,
  timeGateMessage = null,
  showingAnswer = false
}) {
  return (
    <div className="max-w-2xl mx-auto mt-6">
      {/* Time gate message */}
      {timeGateMessage && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <div className="text-sm text-yellow-800">
            ⏰ {timeGateMessage}
          </div>
          <div className="text-xs text-yellow-600 mt-1">
            Health will still improve, but mastery points require more time.
          </div>
        </div>
      )}

      {/* Button grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Don't Know */}
        <button
          onClick={() => onDifficulty('dont-know')}
          disabled={disabled}
          className="px-6 py-4 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <div className="text-lg">❌</div>
          <div className="text-sm">Don't Know</div>
          <div className="text-xs opacity-75 mt-1">(1)</div>
        </button>

        {/* Hard */}
        <button
          onClick={() => onDifficulty('hard')}
          disabled={disabled}
          className="px-6 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <div className="text-lg">🟠</div>
          <div className="text-sm">Hard</div>
          <div className="text-xs opacity-75 mt-1">(2)</div>
        </button>

        {/* Medium */}
        <button
          onClick={() => onDifficulty('medium')}
          disabled={disabled}
          className="px-6 py-4 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <div className="text-lg">🟡</div>
          <div className="text-sm">Medium</div>
          <div className="text-xs opacity-75 mt-1">(3)</div>
        </button>

        {/* Easy */}
        <button
          onClick={() => onDifficulty('easy')}
          disabled={disabled}
          className="px-6 py-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <div className="text-lg">✅</div>
          <div className="text-sm">Easy</div>
          <div className="text-xs opacity-75 mt-1">(4)</div>
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-4 text-center text-sm text-gray-500">
        💡 Use keyboard: 1 (Don't Know) • 2 (Hard) • 3 (Medium) • 4 (Easy) • Space (Flip)
      </div>
    </div>
  )
}
