# VOQUAB LANDING PAGE SPECIFICATION

**Document Type:** Implementation Specification  
**Created:** January 21, 2026  
**For:** Claude Code Implementation  
**Status:** Ready for Development

---

## OVERVIEW

Create a single-page marketing/landing page for Voquab, a Spanish vocabulary learning platform that teaches through authentic literature. This page replaces the current login/signup page and serves as the entry point for all new visitors.

**Core Message:** "Read Spanish. For Real."

**Target Audience:** Middle school to adult learners who want to actually read in Spanish, not just collect streaks. Educated users who appreciate literature and want a faster, more meaningful path to reading fluency.

**Design Philosophy:** Sophisticated, literary, clean, and modern. Think elegant bookstore app, not gamified children's toy. Anti-Duolingo aesthetic.

---

## VISUAL DIRECTION

### Color Palette

```css
:root {
  /* Background */
  --bg-primary: #0f172a;      /* Deep slate - main background */
  --bg-secondary: #1e293b;    /* Lighter slate - cards, sections */
  --bg-accent: #334155;       /* Subtle highlight areas */
  
  /* Text */
  --text-primary: #f8f5f0;    /* Warm cream - main text */
  --text-secondary: #94a3b8;  /* Muted - secondary text */
  --text-muted: #64748b;      /* Subtle - tertiary text */
  
  /* Accent */
  --accent-gold: #d4a574;     /* Warm gold - CTAs, highlights */
  --accent-gold-hover: #e5b885; /* Lighter gold - hover states */
  --accent-gold-subtle: rgba(212, 165, 116, 0.1); /* Subtle gold bg */
  
  /* Status Colors */
  --status-not-seen: #64748b;   /* Gray */
  --status-learning: #f59e0b;   /* Amber */
  --status-familiar: #3b82f6;   /* Blue */
  --status-mastered: #10b981;   /* Emerald */
  
  /* Utility */
  --border-subtle: rgba(248, 245, 240, 0.1);
  --shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.3);
}
```

### Typography

```css
/* Headlines - Literary Serif */
--font-display: 'Cormorant Garamond', Georgia, serif;

/* Body - Clean Sans */
--font-body: 'Source Sans 3', 'Source Sans Pro', sans-serif;

/* Logo/Wordmark - Slightly bolder serif */
--font-logo: 'Cormorant Garamond', Georgia, serif;
```

**Font Weights:**
- Logo: 600 (semibold)
- Headlines: 400-500 (regular to medium)
- Body: 400 (regular)
- Labels/UI: 500 (medium)

**Font Sizes (Desktop):**
- Hero headline: 4rem (64px)
- Section headlines: 2.5rem (40px)
- Subheadlines: 1.5rem (24px)
- Body: 1.125rem (18px)
- Small/Labels: 0.875rem (14px)

**Mobile adjustments:** Scale headlines down ~30%

### Spacing System

Use 8px base unit:
- xs: 8px
- sm: 16px
- md: 24px
- lg: 32px
- xl: 48px
- 2xl: 64px
- 3xl: 96px

---

## PAGE STRUCTURE

### 1. HEADER (Fixed Navigation)

**Layout:** Fixed top, full width, transparent initially, gains background on scroll

**Left:** Voquab wordmark (text logo in Cormorant Garamond, semibold, ~24px)

**Center/Right Navigation Links:**
- How It Works (anchor: #how-it-works)
- Library (anchor: #library)
- Pricing (anchor: #pricing)
- FAQ (anchor: #faq)

**Far Right:** Login/Sign Up button that triggers dropdown or modal

**Mobile:** Hamburger menu with slide-out drawer

**Scroll Behavior:** 
- Add subtle backdrop blur and background color after 50px scroll
- Smooth scroll to anchors

```jsx
// Header states
{
  default: { background: 'transparent' },
  scrolled: { background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)' }
}
```

---

### 2. HERO SECTION

**Layout:** Full viewport height (min-height: 100vh), centered content with device mockup

**Content (Left/Center):**

```
[Small label - gold accent color]
Spanish Vocabulary Through Literature

[Main Headline - Cormorant Garamond, large]
Read Spanish.
For Real.

[Subheadline - Source Sans, muted color]
Stop memorizing random words. Start reading real books.
Voquab builds your vocabulary through literature you'll actually enjoy.

[CTA Button - Gold background, dark text]
Start Reading Free →

[Small note below CTA]
Free forever. No credit card required.
```

**Right Side:** Phone mockup placeholder (iPhone-style frame)
- Placeholder dimensions: ~280px wide x 560px tall
- Label: "SCREENSHOT: Reading Mode"
- Note for later: This will show the reading experience

**Background:** Subtle gradient or noise texture, maybe faint book/page imagery

**Animation:**
- Text fades in with slight upward motion (staggered)
- Phone mockup fades in slightly delayed
- Subtle floating animation on phone

---

### 3. THE PROBLEM SECTION

**ID:** `#problem`

**Layout:** Centered text, max-width ~800px

**Headline:** "Traditional language apps have it backwards"

**Content (3 pain points):**

```
[Pain Point 1]
🎯 Endless flashcards, no context
You memorize "el gato" for the 100th time, 
but you still can't read a single paragraph.

[Pain Point 2]
📚 50 conjugations, one verb
"Vivía, vivió, vivo, vivirá..." 
Your deck floods with forms you'll never use.

[Pain Point 3]
🎮 Gamification over comprehension
Streaks and points feel good, 
but can you actually read anything?
```

**Design:** Cards or simple text blocks with icons, subtle gold accent on icons

---

### 4. HOW IT WORKS SECTION

**ID:** `#how-it-works`

**Layout:** 3-column on desktop, stacked on mobile

**Headline:** "A better path to reading fluency"

**Subheadline:** "Three steps. Real results."

**Steps:**

```
[Step 1 - Icon: Book]
PICK A BOOK
Choose from our curated library of public domain 
literature, starting with classics like The Little Prince.
Your reading level guides your path.

[Step 2 - Icon: Lightbulb or Brain]
LEARN IN CONTEXT
New words appear within real sentences.
Tap to peek at translations. Study with spaced repetition.
One flashcard per concept, not per conjugation.

[Step 3 - Icon: Graduation Cap or Arrow Up]
GRADUATE TO REAL BOOKS
Build the foundation vocabulary you need.
Then move on to Harry Potter, García Márquez, 
or whatever calls to you.
```

**Visual Element:** Animated progress bar showing the journey:
```
[Not Seen] → [Learning] → [Familiar] → [Mastered]
     ●           ●            ●            ●
```

This bar should animate/fill as user scrolls into view.

---

### 5. THE EXPERIENCE SECTION

**ID:** `#experience`

**Layout:** Screenshot showcase with descriptions

**Headline:** "Beautiful. Effective. Designed for readers."

**Screenshots Grid (3 items):**

```
[Screenshot 1 - Large or Featured]
READING MODE
Follow along with full chapters.
Tap any word to see its meaning.
Build vocabulary naturally.
>>> PLACEHOLDER: Phone mockup, label "Reading Mode Screenshot"

[Screenshot 2]
SMART FLASHCARDS
Spaced repetition powered by science.
Review at the perfect moment.
No deck flooding. Ever.
>>> PLACEHOLDER: Phone mockup, label "Flashcard Screenshot"

[Screenshot 3]
TRACK PROGRESS
Watch your vocabulary grow.
See exactly where you stand.
Unlock new chapters as you learn.
>>> PLACEHOLDER: Phone mockup, label "Progress Screenshot"
```

**Design Notes:**
- Screenshots in phone frames (iPhone style)
- Slight tilt/rotation for visual interest
- Subtle shadow/glow effect
- On mobile: horizontal scroll or stacked

---

### 6. THE JOURNEY SECTION

**ID:** `#journey`

**Layout:** Visual representation of word mastery stages

**Headline:** "Watch your vocabulary transform"

**Content:** Interactive/animated visualization showing the four stages:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   NOT SEEN → LEARNING → FAMILIAR → MASTERED                │
│      ○          ◐          ◕          ●                    │
│                                                             │
│   [======================================]  67%            │
│   1,247 of 1,854 words mastered                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Stage Descriptions (below or on hover):**

```
NOT SEEN (Gray)
Words you haven't encountered yet.
They're waiting in the chapters ahead.

LEARNING (Amber)
Actively building recognition.
You'll see these in your daily reviews.

FAMILIAR (Blue)
Getting stronger every day.
Context helps cement understanding.

MASTERED (Green)
Locked in long-term memory.
Ready for the wild.
```

**Animation:** 
- Progress bar fills on scroll
- Numbers count up
- Stages light up sequentially

---

### 7. CONTENT LIBRARY SECTION

**ID:** `#library`

**Layout:** Featured content cards

**Headline:** "Your library awaits"

**Subheadline:** "Start with Spanish. More languages coming soon."

**Featured Content:**

```
[Card 1 - Featured/Large]
EL PRINCIPITO (The Little Prince)
Antoine de Saint-Exupéry
━━━━━━━━━━━━━━━━━━━━
27 chapters • 1,854 unique words
The perfect starting point for Spanish learners.
A timeless story with vocabulary that matters.
[Badge: AVAILABLE NOW]

[Card 2]
BAD BUNNY: Debí Tirar Más Fotos
━━━━━━━━━━━━━━━━━━━━
17 songs • 215 slang terms
Learn Puerto Rican Spanish through 
one of the biggest albums of the year.
[Badge: AVAILABLE NOW]

[Card 3 - Coming Soon style]
MORE CLASSICS COMING
━━━━━━━━━━━━━━━━━━━━
Public domain literature
curated by difficulty level.
Fairy tales → Short stories → Novels
[Badge: COMING SOON]
```

**Language Flags (below cards):**

```
Currently Available:        Coming Soon:
🇪🇸 ES - Español           🇫🇷 FR - Français
                           🇮🇹 IT - Italiano
                           🇩🇪 DE - Deutsch
```

**Design:** 
- Cards have subtle border or glow
- Available content has gold accent
- Coming soon content slightly muted
- Flags are simple emoji + abbreviation

---

### 8. PRICING SECTION

**ID:** `#pricing`

**Layout:** Single centered card

**Headline:** "Simple pricing"

**Content:**

```
┌─────────────────────────────────────┐
│                                     │
│              FREE                   │
│              ────                   │
│           Forever. Really.          │
│                                     │
│  ✓ Full access to all books        │
│  ✓ Unlimited flashcard reviews     │
│  ✓ Progress tracking               │
│  ✓ All current & future content    │
│                                     │
│     [Start Reading Free →]          │
│                                     │
│  No credit card. No trial period.   │
│  No catch.                          │
│                                     │
└─────────────────────────────────────┘
```

**Design:**
- Card with gold border or subtle glow
- Checkmarks in gold accent color
- CTA button matches hero

---

### 9. FAQ SECTION

**ID:** `#faq`

**Layout:** Accordion style, max-width ~800px centered

**Headline:** "Questions? Answers."

**FAQ Items:**

```
Q: How is this different from Duolingo?
A: Duolingo teaches isolated vocabulary through gamification. 
   Voquab teaches vocabulary through real literature. You're not 
   memorizing "the cat is on the table" — you're reading The Little 
   Prince. Every word has context. Every lesson moves you toward 
   actual reading fluency.

Q: What does "no deck flooding" mean?
A: Traditional flashcard apps create a new card for every word form. 
   The verb "vivir" becomes 50+ cards (vivía, vivió, vivo, vivirá...). 
   Voquab is smarter: you learn the lemma (canonical form) once. 
   One concept, one card. Your deck stays manageable.

Q: How does the spaced repetition work?
A: We use FSRS, the same algorithm trusted by medical students 
   worldwide. It calculates the optimal moment to review each word 
   — right before you'd forget it. Science does the scheduling. 
   You just show up.

Q: Is this really free?
A: Yes. We're building this because we believe language learning 
   should be accessible to everyone. No premium tiers, no paywalls, 
   no "limited free version." Just free.

Q: What if I'm a complete beginner?
A: Perfect. We start with the basics. The Little Prince uses 
   relatively simple vocabulary, and our system introduces words 
   gradually. You'll build comprehension chapter by chapter.

Q: Will there be other languages?
A: Yes! French, Italian, and German are on the roadmap. Spanish 
   is our starting point because of the wealth of public domain 
   literature available.
```

**Interaction:**
- Click question to expand/collapse answer
- Smooth height animation
- Only one open at a time (optional)
- Gold accent on active/open question

---

### 10. FOOTER

**Layout:** Simple, minimal

**Content:**

```
─────────────────────────────────────────────────────────
                         Voquab
              Read Spanish. For Real.

                    [Social icons if any]
              
         © 2026 Voquab. All rights reserved.
                Terms • Privacy • Contact
─────────────────────────────────────────────────────────
```

**Design:** 
- Subtle top border
- Muted text colors
- Minimal footprint

---

## AUTH COMPONENTS

### Login/Sign Up Dropdown

Triggered by "Login / Sign Up" button in header.

**Dropdown Design:**

```
┌─────────────────────────────────┐
│  Welcome to Voquab              │
│                                 │
│  [Email                      ]  │
│  [Password                   ]  │
│                                 │
│  [     Sign In     ]            │
│                                 │
│  ─────── or ───────             │
│                                 │
│  [    Create Account    ]       │
│                                 │
│  Forgot password?               │
└─────────────────────────────────┘
```

**States:**
1. **Sign In Mode** - Email, password, sign in button
2. **Sign Up Mode** - Email, password, confirm password, create account button
3. **Forgot Password Mode** - Email, send reset link button

**Behavior:**
- Dropdown appears below header button
- Click outside closes
- ESC key closes
- On successful auth, redirect to /dashboard
- Error messages appear inline (red text below relevant field)

**Use existing Supabase auth:**
- Reference `src/contexts/AuthContext.jsx`
- Use `signIn`, `signUp`, `signOut` methods
- Handle loading states

---

## RESPONSIVE DESIGN

### Breakpoints

```css
/* Mobile first */
--mobile: 0px;
--tablet: 768px;
--desktop: 1024px;
--wide: 1280px;
```

### Mobile Adaptations

- **Header:** Hamburger menu, slide-out navigation drawer
- **Hero:** Stack content vertically, phone mockup below text or hidden
- **How It Works:** Single column, steps stacked
- **Experience:** Horizontal scroll for screenshots or stacked
- **Library:** Single column cards
- **FAQ:** Full width accordions
- **Typography:** Scale down headlines ~30%

### Tablet Adaptations

- **How It Works:** 3 columns still work, slightly smaller
- **Experience:** 2-column grid
- **Library:** 2-column grid

---

## ANIMATIONS & INTERACTIONS

### Page Load

1. Header fades in immediately
2. Hero text fades in with upward motion (staggered: headline, subhead, CTA)
3. Phone mockup fades in last with subtle scale

### Scroll Animations

- Sections fade in as they enter viewport
- Progress bar in Journey section fills on scroll
- Stats count up when visible
- Cards lift slightly on hover

### Micro-interactions

- Buttons: Subtle scale (1.02) and brightness on hover
- Links: Underline animation or color shift
- FAQ: Smooth accordion open/close
- Auth dropdown: Fade in, slight downward slide

### Smooth Scrolling

```css
html {
  scroll-behavior: smooth;
}
```

Anchor links should smoothly scroll to target sections.

---

## TECHNICAL REQUIREMENTS

### File Structure

```
src/
  pages/
    Landing.jsx          # Main landing page component
  components/
    landing/
      Header.jsx         # Fixed navigation with auth dropdown
      Hero.jsx           # Hero section
      Problem.jsx        # Pain points section
      HowItWorks.jsx     # 3-step process
      Experience.jsx     # Screenshots showcase
      Journey.jsx        # Mastery stages visualization
      Library.jsx        # Content library cards
      Pricing.jsx        # Pricing card
      FAQ.jsx            # Accordion FAQ
      Footer.jsx         # Footer
      AuthDropdown.jsx   # Login/signup dropdown
      PhoneMockup.jsx    # Reusable phone frame for screenshots
```

### Route Configuration

Update `App.jsx`:
- `/` → Landing page (for unauthenticated users)
- `/` → Redirect to `/dashboard` (for authenticated users)
- Keep all existing routes

### Dependencies

**Google Fonts (add to index.html or import):**
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
```

**No additional npm packages required** - use existing React, Tailwind, and Supabase.

### SEO

```html
<title>Voquab - Read Spanish. For Real.</title>
<meta name="description" content="Learn Spanish vocabulary through real literature. Read The Little Prince and build fluency with smart spaced repetition. Free forever.">
```

---

## PLACEHOLDER NOTES

**For Screenshots (Peter will provide later):**

Create placeholder components with:
- Phone frame (iPhone style, rounded corners, notch)
- Gray background inside
- Label text: "SCREENSHOT: [Type]"
- Dimensions: ~280px × 560px (adjustable)

Easy to swap in real images later by replacing the placeholder content.

---

## IMPLEMENTATION PRIORITY

1. **Phase 1:** Structure & Layout
   - Set up Landing.jsx with all sections
   - Implement responsive grid/flex layouts
   - Add placeholder content

2. **Phase 2:** Styling & Theme
   - Apply color palette
   - Set up typography
   - Style all components

3. **Phase 3:** Header & Auth
   - Fixed header with scroll behavior
   - Auth dropdown with Supabase integration
   - Mobile menu

4. **Phase 4:** Animations
   - Scroll-triggered reveals
   - Progress bar animation
   - Micro-interactions

5. **Phase 5:** Polish
   - Responsive testing
   - Performance optimization
   - Final adjustments

---

## REFERENCE SITES

Design inspiration from:
- https://literal.club/ - Clean sections, book imagery
- https://whispernotes.app/ - Perfect single-page structure, FAQ accordion
- https://www.katiekhan.com/ - Literary elegance, serif typography
- https://oku.club/ - Bookshelf aesthetic

---

## SUCCESS CRITERIA

The landing page is complete when:

- [ ] All 10 sections implemented and styled
- [ ] Header fixed with scroll behavior
- [ ] Auth dropdown functional with Supabase
- [ ] Smooth scroll to anchor links
- [ ] Responsive on mobile, tablet, desktop
- [ ] Typography matches spec (Cormorant Garamond + Source Sans)
- [ ] Color palette applied consistently
- [ ] Animations feel polished, not distracting
- [ ] Page loads fast (<3s on 3G)
- [ ] Screenshot placeholders ready for real images

---

**END OF SPECIFICATION**
