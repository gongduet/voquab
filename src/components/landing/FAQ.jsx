import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import useScrollAnimation from '../../hooks/landing/useScrollAnimation'

const FAQS = [
  {
    question: 'How is this different from Duolingo?',
    answer: 'Duolingo teaches isolated vocabulary through gamification. Voquab teaches vocabulary through real literature. You\'re not memorizing "the cat is on the table" — you\'re reading The Little Prince. Every word has context. Every lesson moves you toward actual reading fluency.',
  },
  {
    question: 'How does the spaced repetition work?',
    answer: 'We use FSRS, the same algorithm trusted by medical students worldwide. It calculates the optimal moment to review each word — right before you\'d forget it. Science does the scheduling. You just show up.',
  },
  {
    question: 'Is this really free?',
    answer: 'Yes. We\'re building this because we believe language learning should be accessible to everyone. No premium tiers, no paywalls, no "limited free version." Just free.',
  },
  {
    question: 'What if I\'m a complete beginner?',
    answer: 'Perfect. We start with the basics. The Little Prince uses relatively simple vocabulary, and our system introduces words gradually. You\'ll build comprehension chapter by chapter.',
  },
  {
    question: 'Will there be other languages?',
    answer: 'Yes! French, Italian, and German are on the roadmap. Spanish is our starting point because of the wealth of public domain literature available.',
  },
]

/**
 * FAQ - Accordion-style FAQ section
 */
export default function FAQ() {
  const { ref, isVisible } = useScrollAnimation()
  const [openIndex, setOpenIndex] = useState(null)

  const toggleQuestion = (index) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section
      id="faq"
      ref={ref}
      className={`py-24 bg-landing-bg-secondary landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            Questions? Answers.
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-landing-bg border border-landing-border overflow-hidden"
            >
              <button
                onClick={() => toggleQuestion(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-landing-bg-accent/30 transition-colors"
              >
                <span className="font-body font-medium text-landing-text pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-landing-muted flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pt-2 pb-6">
                  <p className="font-body text-landing-muted leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
