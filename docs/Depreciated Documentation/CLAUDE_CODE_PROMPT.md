# CLAUDE CODE PROMPT: Voquab Landing Page Implementation

## Task

Build a complete marketing/landing page for Voquab based on the specification in `LANDING_PAGE_SPEC.md` (I will paste the contents below or you can reference the document).

## Context

- Voquab is a Spanish vocabulary learning app that teaches through literature
- This landing page replaces the current login/signup page
- Tech stack: React 19, TailwindCSS, Supabase (auth already configured)
- The page should feel sophisticated, literary, and modern (not gamified/cartoonish)

## Key Requirements

### 1. Visual Design
- **Dark theme:** Background `#0f172a`, cream text `#f8f5f0`, gold accent `#d4a574`
- **Typography:** 
  - Headlines: `'Cormorant Garamond', Georgia, serif` (this is already used in read mode)
  - Body: `'Source Sans 3', sans-serif`
- Add Google Fonts to `index.html` if not present

### 2. Page Structure (Single Page with Anchor Sections)
1. Header (fixed, transparent → blur on scroll)
2. Hero (#hero)
3. The Problem (#problem)
4. How It Works (#how-it-works)
5. The Experience (#experience) - with screenshot placeholders
6. The Journey (#journey) - word mastery visualization
7. Content Library (#library)
8. Pricing (#pricing)
9. FAQ (#faq) - accordion style
10. Footer

### 3. Header & Auth
- Fixed navigation with smooth scroll to anchors
- Login/Sign Up dropdown using existing Supabase auth from `src/contexts/AuthContext.jsx`
- Mobile: hamburger menu with slide-out drawer
- On scroll: add backdrop blur and background

### 4. Screenshot Placeholders
Create a reusable `PhoneMockup` component with:
- iPhone-style frame (rounded corners, notch suggestion)
- Gray placeholder interior
- Label prop for "SCREENSHOT: Reading Mode" etc.
- Easy to swap real images later

### 5. Animations
- Sections fade in on scroll (IntersectionObserver or CSS)
- Progress bar in Journey section animates when visible
- Subtle hover effects on buttons and cards
- Smooth scroll behavior

### 6. Routing Update
Update `App.jsx`:
- `/` shows Landing page for unauthenticated users
- `/` redirects to `/dashboard` for authenticated users
- Keep all existing routes intact

### 7. File Organization
```
src/
  pages/
    Landing.jsx
  components/
    landing/
      Header.jsx
      Hero.jsx
      Problem.jsx
      HowItWorks.jsx
      Experience.jsx
      Journey.jsx
      Library.jsx
      Pricing.jsx
      FAQ.jsx
      Footer.jsx
      AuthDropdown.jsx
      PhoneMockup.jsx
```

## Copy/Content

All section copy is provided in the spec document. Use it verbatim or improve slightly if needed, but maintain the tone: confident, literary, not salesy.

**Key messages:**
- Hero: "Read Spanish. For Real."
- Subhead: "Stop memorizing random words. Start reading real books."
- CTA: "Start Reading Free →"

## Reference Sites for Aesthetic

- https://literal.club/ - Clean sections, book imagery
- https://whispernotes.app/ - Single-page structure, FAQ accordion
- https://www.katiekhan.com/ - Literary elegance, serif typography

## Implementation Notes

1. **Start with structure** - Get all sections laid out with placeholder content
2. **Apply styling** - Colors, typography, spacing
3. **Header & Auth** - Make navigation functional
4. **Animations** - Add polish last
5. **Test responsive** - Mobile, tablet, desktop

## What NOT to Do

- Don't use purple gradients or generic "AI" aesthetics
- Don't make it look like Duolingo (no cartoon owls, no gamification imagery)
- Don't add unnecessary complexity - keep it elegant and clean
- Don't break existing app functionality - this is additive

## Deliverables

1. All landing page components created
2. Routing updated in App.jsx
3. Google Fonts added to index.html
4. Auth dropdown functional
5. Responsive design working
6. Update `docs/99_LIVING_CHANGELOG.md` with the changes

## Questions to Answer Before Starting

- Check current login/signup page location - what file is it?
- Check if Google Fonts are already imported
- Review AuthContext.jsx for auth methods available
- Check existing TailwindCSS configuration

---

**Start by exploring the codebase to understand the current structure, then implement phase by phase. Report back after each major phase is complete.**
