# 08_DESIGN_SYSTEM.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Color Palette](#color-palette)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Shadows & Effects](#shadows--effects)
7. [Iconography](#iconography)
8. [Animation](#animation)

---

## OVERVIEW

Voquab's design system creates a beautiful, cohesive experience that honors The Little Prince while prioritizing mobile usability and learning effectiveness.

**Goals:**
- Beautiful, polished aesthetic (design is a feature, not afterthought)
- Consistent visual language across all screens
- Mobile-first responsive design
- Accessible to all users (WCAG AA minimum)
- Little Prince themed without being childish

**Inspiration:**
- The Little Prince illustrations (watercolor aesthetic)
- Duolingo (playful but professional)
- Notion (clean, organized)
- Apple HIG (mobile-first, touch-friendly)

---

## DESIGN PHILOSOPHY

### 1. Mobile-First Beauty

Primary use case is phone screens. Every design decision prioritizes mobile.

**Principles:**
- Touch targets minimum 44px × 44px
- Generous padding (never cramped)
- Readable font sizes (16px minimum body text)
- Single-column layouts on mobile
- Bottom navigation for primary actions

---

### 2. The Little Prince Aesthetic

Capture the book's magic without being cartoonish.

**Visual Language:**
- Watercolor-inspired gradients (subtle, not garish)
- Star accents (⭐ as rewards, progress markers)
- Warm color palette (golden yellows, soft blues)
- Hand-drawn feeling for illustrations
- Whimsical but sophisticated

**NOT:**
- Childish or overly cute
- Cartoon characters everywhere
- Bright primary colors
- Comic Sans or playful fonts

---

### 3. Learning-Focused Clarity

Interface must support learning, not distract from it.

**Principles:**
- Spanish text always prominent
- Clear visual hierarchy (what to focus on)
- Minimal cognitive load (one task at a time)
- Progress always visible
- Encouragement without patronizing

---

### 4. Progressive Enhancement

Start with solid foundation, add polish.

**Priorities:**
1. Functionality (works correctly)
2. Usability (easy to use)
3. Accessibility (everyone can use)
4. Beauty (delightful to use)

All four required for MVP, but in this order of importance.

---

## COLOR PALETTE

### Primary Colors

**Little Prince Blue**
```
--primary-50:  #f0f9ff  /* Lightest blue backgrounds */
--primary-100: #e0f2fe
--primary-200: #bae6fd
--primary-300: #7dd3fc
--primary-400: #38bdf8
--primary-500: #0ea5e9  /* Main brand color */
--primary-600: #0284c7
--primary-700: #0369a1  /* Hover states */
--primary-800: #075985
--primary-900: #0c4a6e  /* Darkest blue */
```

**Usage:**
- Buttons, links, interactive elements
- Progress bars
- Active states
- Accents

---

### Secondary Colors

**Star Gold**
```
--secondary-50:  #fffbeb
--secondary-100: #fef3c7
--secondary-200: #fde68a
--secondary-300: #fcd34d
--secondary-400: #fbbf24
--secondary-500: #f59e0b  /* Main gold */
--secondary-600: #d97706
--secondary-700: #b45309
--secondary-800: #92400e
--secondary-900: #78350f
```

**Usage:**
- Badges, achievements
- Stars and rewards
- Level-up celebrations
- Highlights

---

### Neutral Colors

**Warm Grays**
```
--neutral-50:  #fafaf9  /* Page backgrounds */
--neutral-100: #f5f5f4
--neutral-200: #e7e5e4
--neutral-300: #d6d3d1
--neutral-400: #a8a29e
--neutral-500: #78716c  /* Body text secondary */
--neutral-600: #57534e
--neutral-700: #44403c
--neutral-800: #292524
--neutral-900: #1c1917  /* Headings, primary text */
```

**Usage:**
- Text colors
- Backgrounds
- Borders
- Disabled states

---

### Semantic Colors

**Success Green**
```
--success-50:  #f0fdf4
--success-100: #dcfce7
--success-500: #22c55e  /* Main success */
--success-700: #15803d
```

**Error Red**
```
--error-50:  #fef2f2
--error-100: #fee2e2
--error-500: #ef4444  /* Main error */
--error-700: #b91c1c
```

**Warning Orange**
```
--warning-50:  #fff7ed
--warning-100: #ffedd5
--warning-500: #f97316  /* Main warning */
--warning-700: #c2410c
```

**Info Blue**
```
--info-50:  #eff6ff
--info-100: #dbeafe
--info-500: #3b82f6  /* Main info */
--info-700: #1d4ed8
```

---

### Health Status Colors

**For word health visualization:**

```
--health-critical: #ef4444  /* Red - 0-19 health */
--health-low:      #f97316  /* Orange - 20-39 */
--health-medium:   #eab308  /* Yellow - 40-59 */
--health-good:     #84cc16  /* Light green - 60-79 */
--health-excellent: #22c55e /* Bright green - 80-100 */
```

---

### Usage Examples

```jsx
/* Buttons */
<button className="bg-primary-500 hover:bg-primary-700 text-white">
  Study Now
</button>

/* Success message */
<div className="bg-success-50 border-success-500 text-success-700">
  Chapter unlocked!
</div>

/* Health indicator */
<div 
  className="h-2 rounded-full"
  style={{ 
    width: `${health}%`,
    backgroundColor: getHealthColor(health)
  }}
/>
```

---

## TYPOGRAPHY

### Font Families

**Sans-Serif (UI)**
```css
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Usage:** Buttons, labels, navigation, UI elements

**Serif (Reading)**
```css
--font-serif: Georgia, Cambria, "Times New Roman", Times, serif;
```

**Usage:** Spanish text (reading), chapter titles, literature content

**Mono (Code)**
```css
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
```

**Usage:** Debug info (if needed), technical details

---

### Type Scale

**Mobile-First Sizes:**

```css
/* Headings */
--text-xs:   0.75rem;  /* 12px */
--text-sm:   0.875rem; /* 14px */
--text-base: 1rem;     /* 16px - Body text minimum */
--text-lg:   1.125rem; /* 18px - Large body */
--text-xl:   1.25rem;  /* 20px - Small headings */
--text-2xl:  1.5rem;   /* 24px - Medium headings */
--text-3xl:  1.875rem; /* 30px - Large headings */
--text-4xl:  2.25rem;  /* 36px - Extra large */
--text-5xl:  3rem;     /* 48px - Hero text */
```

**Responsive Scaling:**
```css
/* Mobile */
h1 { font-size: 1.875rem; }  /* 30px */
h2 { font-size: 1.5rem; }    /* 24px */

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  h1 { font-size: 2.25rem; } /* 36px */
  h2 { font-size: 1.875rem; } /* 30px */
}
```

---

### Font Weights

```css
--font-normal:    400;  /* Body text */
--font-medium:    500;  /* Emphasis */
--font-semibold:  600;  /* Buttons, labels */
--font-bold:      700;  /* Headings */
```

---

### Line Heights

```css
--leading-tight:  1.25;  /* Headings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.75; /* Reading content */
```

---

### Letter Spacing

```css
--tracking-tight:   -0.025em; /* Large headings */
--tracking-normal:   0;       /* Body text */
--tracking-wide:     0.025em; /* Small caps, labels */
```

---

### Usage Examples

```jsx
/* Page heading */
<h1 className="text-3xl font-bold text-neutral-900 mb-4">
  Flashcards
</h1>

/* Spanish reading text */
<p className="font-serif text-lg leading-relaxed text-neutral-900">
  Cuando yo tenía seis años...
</p>

/* Button text */
<button className="text-base font-semibold">
  Continue
</button>

/* Small label */
<span className="text-sm font-medium text-neutral-600 uppercase tracking-wide">
  Chapter 1
</span>
```

---

## SPACING & LAYOUT

### Spacing Scale

Based on 4px increments:

```css
--spacing-0:  0;
--spacing-1:  0.25rem;  /* 4px */
--spacing-2:  0.5rem;   /* 8px */
--spacing-3:  0.75rem;  /* 12px */
--spacing-4:  1rem;     /* 16px */
--spacing-5:  1.25rem;  /* 20px */
--spacing-6:  1.5rem;   /* 24px */
--spacing-8:  2rem;     /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
```

---

### Container Widths

```css
--container-sm:  640px;  /* Small content */
--container-md:  768px;  /* Medium content */
--container-lg:  1024px; /* Large content */
--container-xl:  1280px; /* Extra large */

/* Reading content optimal width */
--prose-width: 65ch;  /* ~720px at 18px font */
```

---

### Layout Patterns

**Page Layout:**
```jsx
<div className="min-h-screen bg-neutral-50">
  <Header />
  <main className="max-w-container-md mx-auto px-4 py-8">
    {children}
  </main>
  <Footer />
</div>
```

**Card Layout:**
```jsx
<div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
  <h2>Card Title</h2>
  <p>Card content</p>
</div>
```

**Grid Layout:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
</div>
```

---

### Border Radius

```css
--rounded-none: 0;
--rounded-sm:   0.125rem;  /* 2px */
--rounded:      0.25rem;   /* 4px */
--rounded-md:   0.375rem;  /* 6px */
--rounded-lg:   0.5rem;    /* 8px */
--rounded-xl:   0.75rem;   /* 12px */
--rounded-2xl:  1rem;      /* 16px */
--rounded-full: 9999px;    /* Circles */
```

**Usage:**
- Buttons: `rounded-lg` (8px)
- Cards: `rounded-xl` (12px)
- Modals: `rounded-2xl` (16px)
- Badges: `rounded-full`

---

## SHADOWS & EFFECTS

### Shadow Scale

```css
/* Subtle depth */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Default card shadow */
--shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
          0 1px 2px -1px rgba(0, 0, 0, 0.1);

/* Elevated elements */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
             0 2px 4px -2px rgba(0, 0, 0, 0.1);

/* Modals, popovers */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -4px rgba(0, 0, 0, 0.1);

/* Prominent elements */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
             0 8px 10px -6px rgba(0, 0, 0, 0.1);
```

**Usage:**
```jsx
<div className="shadow">Default card</div>
<div className="shadow-lg">Modal</div>
<button className="shadow-md hover:shadow-lg">Button</button>
```

---

### Focus Rings

```css
--ring-offset-width: 2px;
--ring-width: 2px;
--ring-color: var(--primary-500);
```

**Usage:**
```jsx
<button className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Click me
</button>
```

---

## ICONOGRAPHY

### Icon Library

**Choice:** Lucide React (consistent, clean, customizable)

**Installation:**
```bash
npm install lucide-react
```

**Usage:**
```jsx
import { Star, Book, Home, User } from 'lucide-react';

<Star className="w-5 h-5 text-secondary-500" />
```

---

### Icon Sizes

```css
--icon-xs: 1rem;    /* 16px */
--icon-sm: 1.25rem; /* 20px */
--icon-md: 1.5rem;  /* 24px */
--icon-lg: 2rem;    /* 32px */
--icon-xl: 3rem;    /* 48px */
```

**Standard Sizes:**
- Inline text icons: 16px (w-4 h-4)
- Button icons: 20px (w-5 h-5)
- Navigation icons: 24px (w-6 h-6)
- Feature icons: 32px (w-8 h-8)
- Hero icons: 48px (w-12 h-12)

---

### Common Icons

```jsx
/* Navigation */
<Home className="w-6 h-6" />
<Book className="w-6 h-6" />
<User className="w-6 h-6" />
<BarChart2 className="w-6 h-6" />

/* Actions */
<Check className="w-5 h-5" />
<X className="w-5 h-5" />
<ChevronRight className="w-5 h-5" />
<Plus className="w-5 h-5" />

/* Status */
<Star className="w-5 h-5" />
<Heart className="w-5 h-5" />
<AlertCircle className="w-5 h-5" />
<CheckCircle className="w-5 h-5" />
```

---

## ANIMATION

### Transition Timing

```css
--duration-75:   75ms;
--duration-100:  100ms;
--duration-150:  150ms;
--duration-200:  200ms;
--duration-300:  300ms;
--duration-500:  500ms;
--duration-700:  700ms;
--duration-1000: 1000ms;
```

**Standard Durations:**
- Hover effects: 150ms
- Button clicks: 100ms
- Modals: 200ms
- Page transitions: 300ms
- Celebrations: 500ms

---

### Easing Functions

```css
--ease-linear:     linear;
--ease-in:         cubic-bezier(0.4, 0, 1, 1);
--ease-out:        cubic-bezier(0, 0, 0.2, 1);  /* Recommended */
--ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);
```

**Default:** Use `ease-out` for most animations

---

### Animation Patterns

**Hover States:**
```jsx
<button className="transition-colors duration-150 hover:bg-primary-700">
  Button
</button>
```

**Slide In (Modal):**
```jsx
<div className="transition-transform duration-200 translate-y-full data-[state=open]:translate-y-0">
  Modal content
</div>
```

**Fade In:**
```jsx
<div className="transition-opacity duration-300 opacity-0 data-[visible=true]:opacity-100">
  Content
</div>
```

**Level Up Celebration:**
```jsx
/* Pulse animation */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

<div className="animate-pulse">
  ⭐ Level Up!
</div>
```

---

### Reduced Motion

**Respect user preferences:**
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## QUICK REFERENCE

### TailwindCSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          // ... rest of scale
          500: '#0ea5e9',
          900: '#0c4a6e',
        },
        secondary: {
          // Star gold scale
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
      spacing: {
        // Custom spacing if needed
      }
    }
  }
}
```

---

### Component Examples

**Primary Button:**
```jsx
<button className="
  bg-primary-500 
  hover:bg-primary-700 
  active:bg-primary-800
  text-white 
  font-semibold 
  px-6 py-3 
  rounded-lg 
  shadow-md 
  hover:shadow-lg
  transition-all duration-150
  focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
">
  Start Learning
</button>
```

**Card:**
```jsx
<div className="
  bg-white 
  rounded-xl 
  shadow 
  hover:shadow-md
  p-6 
  space-y-4
  transition-shadow duration-150
">
  <h3 className="text-xl font-bold text-neutral-900">
    Chapter 1
  </h3>
  <p className="text-neutral-600">
    Description
  </p>
</div>
```

---

## RELATED DOCUMENTS

- See **09_COMPONENT_LIBRARY.md** for component implementations
- See **10_ACCESSIBILITY.md** for a11y requirements
- See **16_CODE_STYLE_GUIDE.md** for code standards

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF DESIGN SYSTEM**
