import useScrollAnimation from '../../hooks/landing/useScrollAnimation'
import PhoneMockup from './PhoneMockup'

const FEATURES = [
  'Sentence-by-sentence comprehension — never feel lost',
  'Instant translations for words you don\'t know',
  'Track which sentences you\'ve mastered',
  'Pick up exactly where you left off',
]

/**
 * Experience - Screenshot showcase with feature list
 */
export default function Experience() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section
      id="experience"
      ref={ref}
      className={`py-24 bg-landing-bg-secondary landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            Beautiful. Effective. Designed for readers.
          </h2>
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Phone Mockups */}
          <div className="flex justify-center gap-6">
            <PhoneMockup label="Reading Mode" className="transform -rotate-3" />
            <PhoneMockup label="Flashcards" className="transform rotate-3 hidden sm:block" />
          </div>

          {/* Feature List */}
          <div>
            <h3 className="font-display text-2xl font-semibold text-landing-text mb-6">
              Reading that feels like progress
            </h3>

            <ul className="space-y-5">
              {FEATURES.map((feature, index) => (
                <li key={index} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-landing-accent/20 flex items-center justify-center mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-landing-accent" />
                  </span>
                  <span className="font-body text-landing-muted text-lg">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* Extra callout */}
            <div className="mt-8 p-6 bg-landing-bg rounded-xl border border-landing-border">
              <h4 className="font-display text-lg font-semibold text-landing-text mb-2">
                Smart Flashcards
              </h4>
              <p className="font-body text-landing-muted text-sm">
                Spaced repetition powered by FSRS — the same algorithm trusted by medical students worldwide.
                Review at the perfect moment. No deck flooding. Ever.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
