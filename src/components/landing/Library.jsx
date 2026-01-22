import useScrollAnimation from '../../hooks/landing/useScrollAnimation'
import { BookOpen, Sparkles } from 'lucide-react'

const CONTENT = [
  {
    title: 'El Principito',
    subtitle: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    stats: '27 chapters • 1,854 unique words',
    description: 'The perfect starting point for Spanish learners. A timeless story with vocabulary that matters.',
    badge: 'AVAILABLE NOW',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: BookOpen,
    featured: true,
  },
  {
    title: 'The Tale of Peter Rabbit',
    subtitle: null,
    author: 'Beatrix Potter',
    stats: 'Coming soon',
    description: 'A beloved children\'s classic. Perfect for beginners building their first Spanish vocabulary.',
    badge: 'COMING SOON',
    badgeColor: 'bg-landing-accent/20 text-landing-accent border-landing-accent/30',
    icon: BookOpen,
    featured: false,
  },
  {
    title: 'More Classics Coming',
    subtitle: null,
    author: null,
    stats: 'Public domain literature',
    description: 'Curated by difficulty level. Fairy tales → Short stories → Novels.',
    badge: 'COMING SOON',
    badgeColor: 'bg-landing-accent/20 text-landing-accent border-landing-accent/30',
    icon: Sparkles,
    featured: false,
  },
]

const LANGUAGES = [
  { code: '🇪🇸', name: 'Español', status: 'available' },
  { code: '🇫🇷', name: 'Français', status: 'coming' },
  { code: '🇮🇹', name: 'Italiano', status: 'coming' },
  { code: '🇩🇪', name: 'Deutsch', status: 'coming' },
]

/**
 * Library - Content library showcase
 */
export default function Library() {
  const { ref, isVisible } = useScrollAnimation()

  return (
    <section
      id="library"
      ref={ref}
      className={`py-24 bg-landing-bg-secondary landing-fade-in ${isVisible ? 'visible' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-landing-text mb-4">
            Your library awaits
          </h2>
          <p className="font-body text-landing-muted text-lg">
            Start with Spanish. More languages coming soon.
          </p>
        </div>

        {/* Content Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {CONTENT.map((item, index) => (
            <div
              key={index}
              className={`p-6 rounded-2xl border transition-colors ${
                item.featured
                  ? 'bg-landing-bg border-landing-accent/30 hover:border-landing-accent'
                  : 'bg-landing-bg border-landing-border hover:border-landing-accent/30'
              }`}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-landing-accent/10 flex items-center justify-center mb-4">
                <item.icon className="w-6 h-6 text-landing-accent" />
              </div>

              {/* Badge */}
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-body font-medium border mb-4 ${item.badgeColor}`}>
                {item.badge}
              </div>

              {/* Title */}
              <h3 className="font-display text-xl font-semibold text-landing-text mb-1">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="font-body text-landing-muted-dark text-sm italic mb-1">
                  {item.subtitle}
                </p>
              )}
              {item.author && (
                <p className="font-body text-landing-muted-dark text-sm mb-2">
                  {item.author}
                </p>
              )}

              {/* Stats */}
              <p className="font-body text-landing-accent text-sm font-medium mb-3">
                {item.stats}
              </p>

              {/* Description */}
              <p className="font-body text-landing-muted text-sm">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Language Flags */}
        <div className="flex flex-wrap justify-center gap-8">
          {LANGUAGES.map((lang, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 ${
                lang.status === 'available' ? 'text-landing-text' : 'text-landing-muted-dark'
              }`}
            >
              <span className="text-2xl">{lang.code}</span>
              <span className="font-body text-sm">{lang.name}</span>
              {lang.status === 'coming' && (
                <span className="text-xs text-landing-muted-dark">(soon)</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
