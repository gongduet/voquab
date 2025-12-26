/**
 * Layout - Simple page wrapper for consistent styling
 *
 * Provides:
 * - Min height screen
 * - Background color
 * - Max width container
 * - Padding
 */

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
