import { useState, useEffect } from 'react'
import useScrollAnimation from '../../hooks/landing/useScrollAnimation'

const STAGES = [
  {
    name: 'Not Seen',
    bgColor: '#94a3b8', // Light gray - pale, hasn't started
    textColor: '#94a3b8',
    description: 'Words you haven\'t encountered yet. They\'re waiting in the chapters ahead.',
    percent: 15,
  },
  {
    name: 'Learning',
    bgColor: '#c9a87c', // Warm muted gold - entering warmth
    textColor: '#c9a87c',
    description: 'Actively building recognition. You\'ll see these in your daily reviews.',
    percent: 20,
  },
  {
    name: 'Familiar',
    bgColor: '#b8734d', // Bold coral/gold - deeper, richer
    textColor: '#b8734d',
    description: 'Getting stronger every day. Context helps cement understanding.',
    percent: 30,
  },
  {
    name: 'Mastered',
    bgColor: '#7a5c1a', // Rich deep gold - deep knowledge
    textColor: '#7a5c1a',
    description: 'Locked in long-term memory. Ready for the wild.',
    percent: 35,
  },
]

/**
 * Journey - Vocabulary mastery stages visualization
 */
export default function Journey() {
  const { ref, isVisible } = useScrollAnimation()
  const [animatedPercents, setAnimatedPercents] = useState(STAGES.map(() => 0))

  // Animate progress when visible
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setAnimatedPercents(STAGES.map((stage) => stage.percent))
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isVisible])

  // Stats match the bar visual: 35% mastered
  const totalWords = 1854
  const totalMastered = 649
  const masteredPercent = Math.round((totalMastered / totalWords) * 100)

  return (
    <section
      id="journey"
      ref={ref}
      className={`py-24 bg-landing-bg landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            Watch your vocabulary transform
          </h2>
          <p className="font-body text-landing-muted text-lg">
            From first encounter to full mastery — track every word's journey.
          </p>
        </div>

        {/* Progress Visualization */}
        <div className="p-8 bg-landing-bg-secondary rounded-2xl border border-landing-border">
          {/* Stage Labels */}
          <div className="flex justify-between mb-4">
            {STAGES.map((stage, index) => (
              <div key={index} className="text-center flex-1">
                <div
                  className="text-xs font-body font-medium uppercase tracking-wide"
                  style={{ color: stage.textColor }}
                >
                  {stage.name}
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="h-4 bg-landing-bg rounded-full overflow-hidden flex">
            {STAGES.map((stage, index) => (
              <div
                key={index}
                className="transition-all duration-1000 ease-out"
                style={{ width: `${animatedPercents[index]}%`, backgroundColor: stage.bgColor }}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="mt-6 text-center">
            <div className="font-display text-4xl font-bold text-landing-accent">
              {masteredPercent}%
            </div>
            <div className="font-body text-landing-muted mt-1">
              {totalMastered.toLocaleString()} of {totalWords.toLocaleString()} words mastered
            </div>
          </div>
        </div>

        {/* Stage Descriptions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {STAGES.map((stage, index) => (
            <div key={index} className="text-center">
              <div
                className="inline-block w-4 h-4 rounded-full mb-3"
                style={{ backgroundColor: stage.bgColor }}
              />
              <h4
                className="font-body font-semibold mb-1"
                style={{ color: stage.textColor }}
              >
                {stage.name}
              </h4>
              <p className="font-body text-landing-muted-dark text-sm">
                {stage.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
