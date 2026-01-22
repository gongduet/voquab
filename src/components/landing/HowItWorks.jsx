import useScrollAnimation from '../../hooks/landing/useScrollAnimation'
import { BookOpen, Lightbulb, GraduationCap } from 'lucide-react'

const STEPS = [
  {
    icon: BookOpen,
    step: '01',
    title: 'Pick a Book',
    description: 'Choose from our curated library of public domain literature, starting with classics like The Little Prince. Your reading level guides your path.',
  },
  {
    icon: Lightbulb,
    step: '02',
    title: 'Learn in Context',
    description: 'New words appear within real sentences. Tap to peek at translations. Study with spaced repetition. One flashcard per concept, not per conjugation.',
  },
  {
    icon: GraduationCap,
    step: '03',
    title: 'Graduate to Real Books',
    description: 'Build the foundation vocabulary you need. Then move on to Harry Potter, García Márquez, or whatever calls to you.',
  },
]

/**
 * HowItWorks - 3-step process section
 */
export default function HowItWorks() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section
      id="how-it-works"
      ref={ref}
      className={`py-24 bg-landing-bg landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            A better path to reading fluency
          </h2>
          <p className="font-body text-landing-muted text-lg">
            Three steps. Real results.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) - z-0 so it's behind circles */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-0.5 bg-landing-border z-0" />

          {STEPS.map((step, index) => (
            <div key={index} className="relative text-center">
              {/* Step number circle - solid bg so line doesn't show through */}
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-landing-bg border-2 border-landing-accent mb-6 z-10">
                <step.icon className="w-10 h-10 text-landing-accent" />
                <span className="absolute -top-2 -right-2 w-8 h-8 bg-landing-accent text-landing-bg text-sm font-bold rounded-full flex items-center justify-center font-body">
                  {step.step}
                </span>
              </div>

              <h3 className="font-display text-xl font-semibold text-landing-text mb-3">
                {step.title}
              </h3>
              <p className="font-body text-landing-muted text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
