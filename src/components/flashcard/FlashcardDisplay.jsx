export default function FlashcardDisplay({
  card,
  isFlipped,
  onCardClick
}) {
  if (!card) {
    return (
      <div className="text-center text-gray-500">
        No card to display
      </div>
    )
  }

  // Extract display data - handle both new and legacy data structures
  const displayLemma = card.lemma || card.lemma_text || 'No word'
  const displayTranslation = card.english_definition || (Array.isArray(card.definitions) ? card.definitions[0] : 'No translation')
  const displayPOS = card.part_of_speech || 'unknown'

  // Debug logging
  console.log('🎴 Card data:', {
    lemma: card.lemma,
    lemma_text: card.lemma_text,
    english_definition: card.english_definition,
    definitions: card.definitions,
    example_sentence: card.example_sentence
  })

  // Helper to highlight word in sentence
  const highlightWordInSentence = (sentence, word) => {
    if (!sentence || !word) return sentence

    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    const parts = sentence.split(regex)
    const matches = sentence.match(regex) || []

    return parts.map((part, index) => (
      <span key={index}>
        {part}
        {matches[index] && (
          <span className="font-bold text-gray-800">
            {matches[index]}
          </span>
        )}
      </span>
    ))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

        .flip-card {
          perspective: 1000px;
        }

        .flip-card-inner {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-style: preserve-3d;
          position: relative;
        }

        .flip-card-inner.flipped {
          transform: rotateY(180deg);
        }

        .flip-card-front, .flip-card-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .flip-card-back {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Card container with flip effect */}
      <div className="flip-card mb-8">
        <div
          onClick={onCardClick}
          className={`flip-card-inner ${isFlipped ? 'flipped' : ''} cursor-pointer`}
        >
          {/* Front - Spanish Side */}
          <div className="flip-card-front bg-white rounded-3xl shadow-2xl p-8 h-[550px] flex flex-col justify-between border border-slate-100">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-auto"></div>
              <div>
                <h1
                  className="text-7xl font-bold text-slate-800 mb-4 tracking-tight lowercase"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayLemma}
                </h1>
                <p
                  className="text-slate-500 text-lg"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  ({displayPOS})
                </p>
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* Spanish sentence at bottom - only show if exists */}
            {card.example_sentence && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p
                  className="text-slate-400 text-base leading-relaxed"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {highlightWordInSentence(card.example_sentence, displayLemma)}
                </p>
              </div>
            )}
          </div>

          {/* Back - English Side */}
          <div className="flip-card-back bg-white rounded-3xl shadow-2xl p-8 h-[550px] flex flex-col justify-between border border-slate-100">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-auto"></div>
              <div>
                <h1
                  className="text-6xl font-bold text-slate-800 mb-4"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayTranslation}
                </h1>
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* English sentence at bottom - only show if exists */}
            {card.example_sentence_translation && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p
                  className="text-slate-400 text-base leading-relaxed italic"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {card.example_sentence_translation}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
