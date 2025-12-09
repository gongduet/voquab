export default function FlashcardDisplay({
  card,
  isFlipped,
  onCardClick,
  chapterInfo,
  formatGrammaticalContext,
  highlightWordInSentence
}) {
  if (!card) {
    return (
      <div className="text-center text-gray-500">
        No card to display
      </div>
    )
  }

  // Extract data with FALLBACKS for missing canonical forms
  const wordForm = card.lemma

  // Check if we have a valid canonical form
  const hasValidCanonical = (
    !card.is_canonical &&
    card.canonical_vocab_id &&
    card.canonical &&
    card.canonical.lemma &&
    card.canonical.lemma !== card.lemma
  )

  // Use canonical if available, otherwise use the word itself
  const displayLemma = hasValidCanonical ? card.canonical.lemma : card.lemma
  const displayTranslation = hasValidCanonical ? card.canonical.english_definition : card.english_definition
  const displayPOS = hasValidCanonical ? card.canonical.part_of_speech : card.part_of_speech
  const formMetadata = card.form_metadata || {}

  console.log('🎴 Display logic:', {
    wordForm,
    hasValidCanonical,
    displayLemma,
    isCanonical: card.is_canonical,
    canonicalVocabId: card.canonical_vocab_id
  })

  return (
    <div className="max-w-2xl mx-auto">
      {/* Card container with flip effect */}
      <div
        onClick={onCardClick}
        className="relative bg-white rounded-2xl shadow-2xl cursor-pointer transition-all duration-300 hover:shadow-3xl"
        style={{ minHeight: '400px' }}
      >
        {/* Front - Spanish Side */}
        {!isFlipped && (
          <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
            {/* Chapter badge */}
            {chapterInfo && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                Chapter {chapterInfo.chapter_number}
              </div>
            )}

            {/* Main word display */}
            <div className="text-center mb-6">
              <div className="text-6xl font-bold text-gray-900 mb-2">
                {displayLemma.toUpperCase()}
              </div>

              {/* Show encountered form ONLY if we have a different canonical form */}
              {hasValidCanonical && (
                <div className="text-2xl text-gray-500 italic">
                  ({wordForm})
                </div>
              )}

              {/* Part of speech */}
              <div className="text-sm text-gray-400 mt-2">
                ({displayPOS || 'unknown'})
              </div>
            </div>

            {/* Context sentence with highlighted word */}
            {card.example_sentence && (
              <div className="mt-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-200 max-w-xl">
                <div className="text-gray-700 text-lg leading-relaxed">
                  {highlightWordInSentence(card.example_sentence, wordForm)}
                </div>
              </div>
            )}

            {/* Tap to reveal hint */}
            <div className="absolute bottom-6 text-gray-400 text-sm italic">
              Tap to reveal translation
            </div>
          </div>
        )}

        {/* Back - English Side */}
        {isFlipped && (
          <div className="p-8 flex flex-col items-center justify-center min-h-[400px] bg-gradient-to-br from-blue-50 to-indigo-50">
            {/* Main translation */}
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-gray-900 mb-4">
                {displayTranslation}
              </div>

              {/* Show form-specific translation ONLY if different from canonical */}
              {hasValidCanonical && card.english_definition !== displayTranslation && (
                <div className="text-2xl text-gray-600 italic mb-2">
                  (as {card.part_of_speech}: {card.english_definition})
                </div>
              )}

              {/* Grammatical context */}
              {formMetadata && Object.keys(formMetadata).length > 0 && (
                <div className="text-sm text-gray-500 italic mt-2">
                  {formatGrammaticalContext(formMetadata)}
                </div>
              )}
            </div>

            {/* Translated sentence */}
            {card.example_sentence_translation && (
              <div className="mt-6 p-4 bg-white rounded-lg border-2 border-blue-200 max-w-xl">
                <div className="text-gray-700 text-lg leading-relaxed">
                  {card.example_sentence_translation}
                </div>
              </div>
            )}

            {/* Tap to flip back */}
            <div className="absolute bottom-6 text-gray-400 text-sm italic">
              Tap to flip back
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
