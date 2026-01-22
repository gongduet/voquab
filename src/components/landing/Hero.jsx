import { ArrowRight } from 'lucide-react'
import PhoneMockup from './PhoneMockup'

/**
 * Hero - Main hero section with headline, CTA, and phone mockup
 */
export default function Hero() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="min-h-screen flex items-center pt-20 pb-16 bg-landing-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Copy */}
        <div className="text-center lg:text-left">
          {/* Label */}
          <div className="inline-block px-4 py-1.5 mb-6 bg-landing-accent/10 border border-landing-accent/20 rounded-full">
            <span className="text-landing-accent font-body text-sm font-medium">
              Spanish Vocabulary Through Literature
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-landing-text leading-tight mb-6">
            Read Spanish.
            <br />
            <span className="text-landing-accent">For Real.</span>
          </h1>

          {/* Subheadline */}
          <p className="font-body text-lg sm:text-xl text-landing-muted mb-8 max-w-lg mx-auto lg:mx-0">
            Stop memorizing random words. Start reading real books.
            Voquab builds your vocabulary through literature you'll actually enjoy.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <button
              onClick={() => scrollToSection('pricing')}
              className="group px-8 py-4 bg-landing-accent text-landing-bg rounded-xl font-body font-semibold text-lg hover:bg-landing-accent-hover transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              Start Reading Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-8 py-4 border border-landing-border text-landing-text rounded-xl font-body font-medium text-lg hover:border-landing-accent hover:text-landing-accent transition-colors"
            >
              See How It Works
            </button>
          </div>

          {/* Trust note */}
          <p className="mt-6 text-landing-muted-dark font-body text-sm">
            Free forever. No credit card required.
          </p>
        </div>

        {/* Right: Phone mockup */}
        <div className="flex justify-center lg:justify-end">
          <div className="relative">
            {/* Glow effect behind phone */}
            <div className="absolute inset-0 bg-landing-accent/20 blur-3xl rounded-full scale-75 -z-10" />
            <PhoneMockup label="Reading Mode" />
          </div>
        </div>
      </div>
    </section>
  )
}
