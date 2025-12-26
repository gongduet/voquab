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
  const displayTranslation = card.english_definition || (Array.isArray(card.definitions) ? card.definitions.join(', ') : 'No translation')

  // Format part of speech to full word
  const formatPartOfSpeech = (pos) => {
    const posMap = {
      'NOUN': 'noun',
      'VERB': 'verb',
      'ADJ': 'adjective',
      'ADV': 'adverb',
      'PRON': 'pronoun',
      'DET': 'determiner',
      'ADP': 'preposition',
      'CONJ': 'conjunction',
      'NUM': 'number',
      'PHRASE': 'phrase',
      'SLANG': 'slang'
    }
    return posMap[pos] || (pos ? pos.toLowerCase() : '')
  }

  const displayPOS = formatPartOfSpeech(card.part_of_speech)
  const isSlang = card.card_type === 'slang'

  // Debug logging
  console.log('🎴 Card data:', {
    lemma: card.lemma,
    lemma_text: card.lemma_text,
    english_definition: card.english_definition,
    definitions: card.definitions,
    example_sentence: card.example_sentence
  })

  // Helper to escape special regex characters
  const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Helper to highlight word in sentence
  const highlightWordInSentence = (sentence, word) => {
    if (!sentence || !word) return sentence

    // Escape special chars and create regex
    const escapedWord = escapeRegex(word)
    const regex = new RegExp(`(${escapedWord})`, 'gi')
    const parts = sentence.split(regex)

    return parts.map((part, index) => {
      // Check if this part matches the word (case-insensitive)
      if (part.toLowerCase() === word.toLowerCase()) {
        return (
          <span key={index} className="font-bold text-gray-800">
            {part}
          </span>
        )
      }
      return <span key={index}>{part}</span>
    })
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
          <div className="flip-card-front bg-white rounded-3xl shadow-2xl p-8 h-[550px] flex flex-col justify-between border border-slate-100 relative">
            {/* Badge inside card - top right corner - styled to match header */}
            {card.isNew && (
              <span
                className="absolute top-3 right-4"
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif',
                  color: '#15803d'
                }}
              >
                {card.card_type === 'slang' ? 'New Slang' : card.card_type === 'phrase' ? 'New Phrase' : 'New Word'}
              </span>
            )}
            {card.isExposure && (
              <span
                className="absolute top-3 right-4"
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif',
                  color: '#b45309'
                }}
              >
                Exposure
              </span>
            )}
            {/* Phrase badge - left side */}
            {card.card_type === 'phrase' && !card.isNew && (
              <span
                className="absolute top-3 left-4"
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif',
                  color: '#7c3aed'
                }}
              >
                Phrase
              </span>
            )}
            {/* Slang badge - left side */}
            {card.card_type === 'slang' && !card.isNew && (
              <span
                className="absolute top-3 left-4"
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, sans-serif',
                  color: '#dc2626'
                }}
              >
                Slang
              </span>
            )}

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-auto"></div>
              <div>
                <h1
                  className="text-4xl font-bold text-slate-800 mb-4 tracking-tight lowercase break-words"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayLemma}
                </h1>
                {/* Region for slang cards */}
                {isSlang && card.region && (
                  <p style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: '500',
                    fontFamily: 'Inter, sans-serif',
                    marginTop: '4px'
                  }}>
                    {card.region}
                  </p>
                )}
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* Spanish sentence at bottom - only show if exists */}
            {card.example_sentence && (
              <div className="mt-6 pt-6 border-t border-slate-200 text-center">
                <p
                  className="text-slate-500 text-lg leading-relaxed italic"
                  style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.6' }}
                >
                  {/* Use word_in_sentence (conjugated form) if available, otherwise fall back to lemma */}
                  {highlightWordInSentence(card.example_sentence, card.word_in_sentence || displayLemma)}
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
                  className="text-3xl font-bold text-slate-800 mb-4 break-words"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayTranslation}
                </h1>
                {/* Part of speech - formatted as full word */}
                {displayPOS && (
                  <p style={{
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: '500',
                    fontFamily: 'Inter, sans-serif',
                    marginTop: '4px'
                  }}>
                    {displayPOS}
                  </p>
                )}
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* Cultural note for slang cards */}
            {isSlang && card.cultural_note && (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg text-left">
                <p
                  className="text-purple-700 text-sm"
                  style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.5' }}
                >
                  {card.cultural_note}
                </p>
              </div>
            )}

            {/* English sentence at bottom - only show if exists */}
            {card.example_sentence_translation && (
              <div className={`pt-6 border-t border-slate-200 text-center ${isSlang && card.cultural_note ? 'mt-4' : 'mt-6'}`}>
                <p
                  className="text-slate-500 text-lg leading-relaxed italic"
                  style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.6' }}
                >
                  {/* No bolding for English - translations aren't always literal word matches */}
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
