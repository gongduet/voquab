/**
 * CategoryPills - Display counts by part of speech
 *
 * @param {Object} props
 * @param {Object} props.categories - { noun: 42, verb: 38, adjective: 15, phrase: 8 }
 * @param {boolean} props.loading - Loading state
 */
export default function CategoryPills({ categories = {}, loading = false }) {
  // Define display order and labels - show all categories
  const categoryConfig = [
    { key: 'noun', label: 'Nouns', activeColor: 'bg-primary-100 text-primary-700 border-primary-200', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
    { key: 'verb', label: 'Verbs', activeColor: 'bg-success-100 text-success-700 border-success-200', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
    { key: 'adjective', label: 'Adjectives', activeColor: 'bg-secondary-100 text-secondary-700 border-secondary-200', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
    { key: 'adverb', label: 'Adverbs', activeColor: 'bg-info-100 text-info-700 border-info-200', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
    { key: 'phrase', label: 'Phrases', activeColor: 'bg-warning-100 text-warning-700 border-warning-200', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
    { key: 'other', label: 'Other', activeColor: 'bg-neutral-200 text-neutral-700 border-neutral-300', inactiveColor: 'bg-neutral-50 text-neutral-400 border-neutral-200' },
  ]

  if (loading) {
    return (
      <div className="px-4">
        <h3 className="text-sm font-bold text-neutral-900 mb-2">Words by Type</h3>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-24 bg-neutral-200 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Calculate total for display
  const total = categoryConfig.reduce((sum, cat) => sum + (categories[cat.key] || 0), 0)

  // If no categories at all, show empty state
  if (total === 0) {
    return (
      <div className="px-4">
        <h3 className="text-sm font-bold text-neutral-900 mb-2">Words by Type</h3>
        <p className="text-sm text-neutral-500">Start learning to see your word breakdown</p>
      </div>
    )
  }

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-neutral-900">Words by Type</h3>
        <span className="text-sm font-bold text-neutral-700">{total} total</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {categoryConfig.map(({ key, label, activeColor, inactiveColor }) => {
          const count = categories[key] || 0
          const isActive = count > 0
          const colorClass = isActive ? activeColor : inactiveColor

          return (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${colorClass}`}
              title={key === 'other' ? 'Prepositions, conjunctions, pronouns, etc.' : undefined}
            >
              <span>{label}</span>
              <span className="font-bold">{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
