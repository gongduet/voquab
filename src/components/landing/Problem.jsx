import useScrollAnimation from '../../hooks/landing/useScrollAnimation'

const POINTS = [
  {
    title: 'Learn through literature',
    description: 'Real sentences from real books, not artificial examples. Every word you learn has context and meaning.',
  },
  {
    title: 'One concept, one card',
    description: 'Master the root word, recognize all its forms. No deck flooding with endless conjugations.',
  },
  {
    title: 'Context over repetition',
    description: 'Understanding comes from seeing words in action. Read, comprehend, remember.',
  },
]

/**
 * Problem - Positioning section showing what makes Voquab different
 */
export default function Problem() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section
      id="problem"
      ref={ref}
      className={`py-24 bg-landing-bg-secondary landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            A different path to fluency
          </h2>
          <p className="font-body text-landing-muted text-lg">
            Language apps teach conversation. Voquab teaches reading comprehension.
          </p>
        </div>

        {/* Points */}
        <div className="space-y-0">
          {POINTS.map((point, index) => (
            <div key={index}>
              {/* Divider (top of each item except first) */}
              {index > 0 && (
                <div className="border-t border-landing-border/50 my-10" />
              )}

              <div className="text-center">
                <h3 className="font-display text-2xl font-medium text-landing-text mb-3">
                  {point.title}
                </h3>
                <p className="font-body text-landing-muted text-lg leading-relaxed max-w-xl mx-auto">
                  {point.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
