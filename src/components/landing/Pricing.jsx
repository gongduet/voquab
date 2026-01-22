import { ArrowRight, Check } from 'lucide-react'
import useScrollAnimation from '../../hooks/landing/useScrollAnimation'

const FEATURES = [
  'Full access to all books',
  'Unlimited flashcard reviews',
  'Progress tracking',
  'All current & future content',
  'FSRS spaced repetition',
]

/**
 * Pricing - Simple free pricing section
 */
export default function Pricing() {
  const { ref, isVisible } = useScrollAnimation()

  const scrollToAuth = () => {
    // Scroll to top to trigger auth
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section
      id="pricing"
      ref={ref}
      className={`py-24 bg-landing-bg landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            Simple pricing
          </h2>
          <p className="font-body text-landing-muted text-lg">
            Everything you need to master Spanish vocabulary.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="p-8 rounded-2xl bg-landing-bg-secondary border-2 border-landing-accent">
          {/* Price */}
          <div className="text-center mb-8">
            <div className="font-display text-5xl font-bold text-landing-accent mb-2">
              Early Access
            </div>
            <p className="font-body text-landing-muted">
              Free during beta
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-4 mb-8">
            {FEATURES.map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-landing-accent/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-landing-accent" />
                </div>
                <span className="font-body text-landing-text">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={scrollToAuth}
            className="group w-full py-4 bg-landing-accent text-landing-bg rounded-xl font-body font-semibold text-lg hover:bg-landing-accent-hover transition-all flex items-center justify-center gap-2"
          >
            Start Reading Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Note */}
          <p className="mt-4 text-center font-body text-landing-muted-dark text-sm">
            No credit card. No trial period.
          </p>
        </div>
      </div>
    </section>
  )
}
