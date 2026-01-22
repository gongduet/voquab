import {
  Header,
  Hero,
  Problem,
  HowItWorks,
  Experience,
  Journey,
  Library,
  Pricing,
  FAQ,
  Footer,
} from '../components/landing'

/**
 * Landing - Main landing page for unauthenticated users
 * Single-page marketing site with smooth scroll navigation
 */
export default function Landing() {
  return (
    <div className="bg-landing-bg min-h-screen">
      <Header />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Experience />
        <Journey />
        <Library />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
