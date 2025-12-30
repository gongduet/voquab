# 11_MOBILE_OPTIMIZATION.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Mobile-First Design](#mobile-first-design)
3. [Responsive Breakpoints](#responsive-breakpoints)
4. [Touch Interactions](#touch-interactions)
5. [Performance Optimization](#performance-optimization)
6. [Mobile Navigation](#mobile-navigation)
7. [Viewport & Meta Tags](#viewport--meta-tags)
8. [Testing Strategies](#testing-strategies)

---

## OVERVIEW

Voquab is designed mobile-first. Most users will study on phones during commutes, breaks, or downtime. The mobile experience must be exceptional.

**Design Philosophy:**
- Mobile is the primary experience (not an afterthought)
- Touch-friendly interfaces (44px minimum targets)
- Fast loading on cellular networks
- One-handed usability where possible
- Portrait orientation optimized

**Success Criteria:**
- 100% features work on mobile
- <2 second initial load on 4G
- Smooth 60fps scrolling
- No horizontal scroll at any viewport

---

## MOBILE-FIRST DESIGN

### Design Process

**Start with mobile, scale up:**

```css
/* ✅ Good - Mobile first */
.card {
  padding: 1rem;           /* Mobile: 16px */
  font-size: 1rem;         /* Mobile: 16px */
}

@media (min-width: 768px) {
  .card {
    padding: 1.5rem;       /* Tablet: 24px */
    font-size: 1.125rem;   /* Tablet: 18px */
  }
}

/* ❌ Bad - Desktop first */
.card {
  padding: 2rem;           /* Desktop: 32px */
  font-size: 1.25rem;      /* Desktop: 20px */
}

@media (max-width: 768px) {
  .card {
    padding: 1rem;         /* Mobile override */
    font-size: 1rem;       /* Mobile override */
  }
}
```

**Why Mobile-First?**
- Forces prioritization (what's essential?)
- Simpler base styles (fewer overrides)
- Better performance (less CSS to parse)
- Progressive enhancement mindset

---

### Mobile Design Constraints

**Small Screen Real Estate:**
- Prioritize content over chrome
- Single-column layouts
- Collapsible sections
- Bottom sheet modals (not centered)

**Limited Attention:**
- Clear hierarchy (what's most important?)
- Fewer choices per screen
- Progressive disclosure
- One primary action per screen

**Touch Input:**
- No hover states (design for tap)
- Larger targets (44px minimum)
- Thumb-friendly zones
- Swipe gestures where natural

---

## RESPONSIVE BREAKPOINTS

### Breakpoint Scale

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '640px',   // Large phones (landscape)
      'md': '768px',   // Tablets (portrait)
      'lg': '1024px',  // Tablets (landscape), small laptops
      'xl': '1280px',  // Desktops
      '2xl': '1536px', // Large desktops
    }
  }
}
```

---

### Common Device Sizes

**Phones:**
- iPhone SE: 375px × 667px
- iPhone 12/13/14: 390px × 844px
- iPhone 14 Pro Max: 430px × 932px
- Android (typical): 360px × 640px

**Tablets:**
- iPad Mini: 768px × 1024px
- iPad: 820px × 1180px
- iPad Pro 11": 834px × 1194px

**Design for:** 360px minimum width (small Android phones)

---

### Responsive Patterns

#### 1. Single Column → Multi-Column

```jsx
/* Mobile: Stack vertically */
<div className="flex flex-col gap-4">
  <Card>Content 1</Card>
  <Card>Content 2</Card>
  <Card>Content 3</Card>
</div>

/* Tablet+: Grid layout */
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>Content 1</Card>
  <Card>Content 2</Card>
  <Card>Content 3</Card>
</div>
```

---

#### 2. Hamburger → Full Navigation

```jsx
function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <header>
      {/* Mobile: Hamburger */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden"
      >
        <Menu />
      </button>
      
      {/* Desktop: Full nav */}
      <nav className="hidden md:flex gap-6">
        <a href="/book">Book</a>
        <a href="/flashcards">Flashcards</a>
        <a href="/progress">Progress</a>
      </nav>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <MobileMenu onClose={() => setMobileMenuOpen(false)} />
      )}
    </header>
  );
}
```

---

#### 3. Bottom Sheet → Modal

```jsx
function DefinitionPopup({ isOpen, onClose, word }) {
  return (
    <>
      {/* Mobile: Bottom sheet */}
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        className="md:hidden"
      >
        <DefinitionContent word={word} />
      </BottomSheet>
      
      {/* Desktop: Centered modal */}
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        className="hidden md:block"
      >
        <DefinitionContent word={word} />
      </Modal>
    </>
  );
}
```

---

#### 4. Hide/Show Content

```jsx
/* Show only on mobile */
<div className="md:hidden">
  Mobile-only content
</div>

/* Show only on desktop */
<div className="hidden md:block">
  Desktop-only content
</div>

/* Different layouts per breakpoint */
<div className="
  text-sm md:text-base lg:text-lg
  p-4 md:p-6 lg:p-8
  max-w-full md:max-w-2xl lg:max-w-4xl
">
  Responsive content
</div>
```

---

## TOUCH INTERACTIONS

### Touch Target Sizes

**Minimum Sizes:**
- Buttons: 44px × 44px (Apple HIG standard)
- Links in text: 44px × 44px tap area (even if text is smaller)
- Icons: 24px icon in 44px tap area
- Form inputs: 44px height minimum

```jsx
/* Button with proper touch target */
<button className="
  px-6 py-3           /* 44px height with padding */
  min-h-[44px]        /* Ensure minimum */
  min-w-[44px]        /* Ensure minimum */
  text-base
">
  Click me
</button>

/* Icon button */
<button className="
  w-11 h-11          /* 44px × 44px */
  flex items-center justify-center
  rounded-full
">
  <X className="w-5 h-5" />  /* 20px icon */
</button>

/* Link with extended tap area */
<a href="/chapter1" className="
  inline-block
  py-2              /* Vertical padding */
  -mx-2 px-2        /* Extend horizontal tap area */
">
  Chapter 1
</a>
```

---

### Touch Target Spacing

**Minimum spacing:** 8px between adjacent targets

```jsx
/* ❌ Bad - too close */
<div className="flex gap-1">
  <button>Cancel</button>
  <button>Delete</button>
</div>

/* ✅ Good - proper spacing */
<div className="flex gap-3">      {/* 12px gap */}
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

---

### Touch Gestures

**Supported Gestures:**
- Tap (primary action)
- Swipe (navigate, dismiss)
- Scroll (natural scrolling)
- Pinch-to-zoom (reading content only)

**Avoid:**
- Double-tap (unreliable)
- Long-press (not discoverable)
- Multi-finger gestures (hard to execute)

---

### Swipe Gestures

**Swipe to Dismiss (Modal):**

```jsx
function BottomSheet({ isOpen, onClose, children }) {
  const [startY, setStartY] = useState(0);
  const [deltaY, setDeltaY] = useState(0);
  
  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };
  
  const handleTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    
    if (delta > 0) {  // Only allow swipe down
      setDeltaY(delta);
    }
  };
  
  const handleTouchEnd = () => {
    if (deltaY > 100) {  // Threshold for dismiss
      onClose();
    }
    setDeltaY(0);
  };
  
  return (
    <div
      style={{ transform: `translateY(${deltaY}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
```

---

### Thumb Zones

**Design for one-handed use:**

```
┌─────────────────────────────┐
│  🔴 Hard to reach           │  Top
│                             │
│  🟡 Okay                    │  Middle
│                             │
│  🟢 Easy (thumb zone)       │  Bottom
│  [Primary Action Button]   │
└─────────────────────────────┘
```

**Best Practices:**
- Primary actions at bottom (green zone)
- Navigation at bottom (tab bar pattern)
- Scrollable content in middle (yellow)
- Secondary actions at top (red)

```jsx
<div className="min-h-screen flex flex-col">
  {/* Top: Secondary actions (harder to reach) */}
  <header className="p-4">
    <button className="ml-auto">
      Settings
    </button>
  </header>
  
  {/* Middle: Scrollable content */}
  <main className="flex-1 overflow-auto p-4">
    <Content />
  </main>
  
  {/* Bottom: Primary action (easy to reach) */}
  <footer className="p-4 border-t">
    <Button fullWidth variant="primary">
      Continue
    </Button>
  </footer>
</div>
```

---

## PERFORMANCE OPTIMIZATION

### Loading Speed Goals

**Targets:**
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Time to Interactive: <3s
- Cumulative Layout Shift: <0.1

**On 4G Network:**
- Initial load: <2s
- Page transitions: <500ms
- Interaction response: <100ms

---

### Image Optimization

**Best Practices:**
- Use modern formats (WebP, AVIF)
- Serve responsive images
- Lazy load below-the-fold images
- Optimize file sizes

```jsx
/* Responsive image */
<img
  src="prince-400.webp"
  srcSet="
    prince-400.webp 400w,
    prince-800.webp 800w,
    prince-1200.webp 1200w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  alt="The Little Prince"
  loading="lazy"
/>

/* Next-gen format with fallback */
<picture>
  <source srcSet="prince.avif" type="image/avif" />
  <source srcSet="prince.webp" type="image/webp" />
  <img src="prince.jpg" alt="The Little Prince" />
</picture>
```

---

### Code Splitting

**Lazy load routes:**

```jsx
import { lazy, Suspense } from 'react';

const Flashcards = lazy(() => import('./pages/Flashcards'));
const Book = lazy(() => import('./pages/Book'));
const Progress = lazy(() => import('./pages/Progress'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/book" element={<Book />} />
        <Route path="/progress" element={<Progress />} />
      </Routes>
    </Suspense>
  );
}
```

**Lazy load heavy components:**

```jsx
const AdminDashboard = lazy(() => import('./pages/Admin'));

function App() {
  const { user } = useAuth();

  return user?.isAdmin ? (
    <Suspense fallback={<LoadingSpinner />}>
      <AdminDashboard />
    </Suspense>
  ) : (
    <NotAuthorized />
  );
}
```

---

### Flashcard Session Loading (Added Dec 30, 2025)

**Background sentence loading for instant session start:**

Sessions now start immediately without waiting for example sentences to load:

```javascript
// sessionBuilder.js - skipSentences option
const result = await buildSession(userId, mode, {
  onProgress: setLoadingProgress,
  skipSentences: true  // Start immediately, load sentences in background
})

// Flashcards.jsx - background loading
if (effectiveMode === SessionMode.REVIEW && result.cards?.length > 0) {
  loadSentencesInBackground(result.cards)
}
```

**Progress indicator with stages:**

LoadingScreen shows real-time progress during session building:

```javascript
// Progress stages reported via onProgress callback
{ stage: 1, totalStages: 4, message: "Loading your progress..." }
{ stage: 2, totalStages: 4, message: "Finding due cards..." }
{ stage: 3, totalStages: 4, message: "Loading sentences..." }  // or skipped
{ stage: 4, totalStages: 4, message: "Starting session..." }
```

**Benefits:**
- Session starts 50-70% faster (no sentence loading blocking)
- Users see first card immediately
- Sentences appear seamlessly as they load
- Progress bar gives feedback during loading

---

### Bundle Size

**Keep JavaScript small:**
- Voquab target: <200KB gzipped JS
- Use tree-shaking (import only what you need)
- Avoid large libraries when possible

```bash
# Analyze bundle
npm run build
npx vite-bundle-visualizer
```

**Optimize imports:**

```jsx
// ❌ Bad - imports entire library
import _ from 'lodash';

// ✅ Good - imports single function
import debounce from 'lodash/debounce';

// ✅ Better - use native JavaScript
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
```

---

### Rendering Performance

**Optimize re-renders:**

```jsx
// Memoize expensive calculations
const sortedWords = useMemo(() => {
  return words.sort((a, b) => b.priority - a.priority);
}, [words]);

// Memoize callbacks
const handleClick = useCallback(() => {
  updateProgress(word.id);
}, [word.id]);

// Memoize components
const FlashcardDisplay = React.memo(function FlashcardDisplay({ word }) {
  return <div>{word.lemma}</div>;
});
```

**Virtualize long lists:**

```jsx
import { FixedSizeList } from 'react-window';

function WordList({ words }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {words[index].lemma}
    </div>
  );
  
  return (
    <FixedSizeList
      height={600}
      itemCount={words.length}
      itemSize={60}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

---

## MOBILE NAVIGATION

### Bottom Tab Navigation

**Best for:** Primary navigation (3-5 items)

```jsx
function MobileTabBar() {
  const location = useLocation();
  
  const tabs = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/book', icon: Book, label: 'Book' },
    { path: '/flashcards', icon: GraduationCap, label: 'Study' },
    { path: '/progress', icon: BarChart2, label: 'Progress' },
  ];
  
  return (
    <nav className="
      fixed bottom-0 left-0 right-0
      bg-white border-t border-neutral-200
      md:hidden
      safe-area-inset-bottom
    ">
      <div className="flex justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`
                flex flex-col items-center gap-1
                py-2 px-3 min-w-[60px]
                ${isActive ? 'text-primary-600' : 'text-neutral-600'}
              `}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

### Hamburger Menu

**Best for:** Secondary navigation, settings, account

```jsx
function MobileMenu({ isOpen, onClose }) {
  return (
    <div
      className={`
        fixed inset-0 z-40 md:hidden
        ${isOpen ? 'block' : 'hidden'}
      `}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      
      {/* Menu panel */}
      <div className="
        absolute top-0 left-0 bottom-0
        w-64 bg-white
        shadow-xl
        transform transition-transform duration-200
      ">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Menu</h2>
            <IconButton
              icon={<X />}
              onClick={onClose}
              aria-label="Close menu"
            />
          </div>
        </div>
        
        <nav className="p-4 space-y-2">
          <MenuLink href="/account" onClick={onClose}>
            Account
          </MenuLink>
          <MenuLink href="/settings" onClick={onClose}>
            Settings
          </MenuLink>
          <MenuLink href="/help" onClick={onClose}>
            Help
          </MenuLink>
        </nav>
      </div>
    </div>
  );
}
```

---

## VIEWPORT & META TAGS

### Essential Meta Tags

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  
  <!-- Viewport -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=5.0"
  />
  
  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Voquab" />
  
  <!-- Theme color -->
  <meta name="theme-color" content="#0ea5e9" />
  
  <!-- Title -->
  <title>Voquab - Learn Spanish with El Principito</title>
  
  <!-- Description -->
  <meta
    name="description"
    content="Master Spanish vocabulary through The Little Prince"
  />
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

---

### Safe Area Insets (Notches)

**Handle iPhone notches:**

```css
/* Add padding for safe areas */
.header {
  padding-top: env(safe-area-inset-top);
}

.footer {
  padding-bottom: env(safe-area-inset-bottom);
}

.sidebar-left {
  padding-left: env(safe-area-inset-left);
}

.sidebar-right {
  padding-right: env(safe-area-inset-right);
}
```

**TailwindCSS plugin:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      }
    }
  }
}
```

**Usage:**

```jsx
<div className="pt-safe-top pb-safe-bottom">
  Content with safe area padding
</div>
```

---

## TESTING STRATEGIES

### Browser DevTools

**Chrome DevTools Device Mode:**
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M / Ctrl+Shift+M)
3. Select device or set custom dimensions
4. Test at different viewport sizes

**Test at these sizes:**
- 375px (iPhone SE)
- 390px (iPhone 12/13/14)
- 430px (iPhone 14 Pro Max)
- 768px (iPad portrait)
- 1024px (iPad landscape)

---

### Real Device Testing

**Essential Devices:**
- iOS: iPhone (any model from last 3 years)
- Android: Mid-range Android phone

**Test on Real Devices:**
- Touch interactions feel right
- Scroll performance smooth
- Text readable
- Buttons easy to tap
- Loading speed acceptable

---

### Testing Checklist

**Every Feature:**
- [ ] Works on 360px width (smallest phones)
- [ ] No horizontal scroll at any size
- [ ] Touch targets ≥ 44px × 44px
- [ ] Text readable without zoom
- [ ] Images load quickly
- [ ] No layout shift during load
- [ ] Smooth 60fps scrolling
- [ ] Modals/sheets work properly
- [ ] Forms usable on mobile
- [ ] Navigation intuitive

---

### Performance Testing

**Lighthouse Audit:**
```bash
# Run Lighthouse in Chrome DevTools
# Target scores:
# - Performance: 90+
# - Accessibility: 95+
# - Best Practices: 95+
# - SEO: 90+
```

**Network Throttling:**
- Test on "Slow 3G" (Chrome DevTools)
- Ensure usable, not perfect
- Show loading states

---

## COMMON MOBILE PITFALLS

### 1. Hover States

```css
/* ❌ Bad - hover doesn't work on touch */
.button:hover {
  background: blue;
}

/* ✅ Good - active state for touch */
.button:active {
  background: blue;
}

/* ✅ Better - hover only on devices that support it */
@media (hover: hover) {
  .button:hover {
    background: blue;
  }
}
```

---

### 2. Fixed Positioning Issues

```css
/* ❌ Bad - keyboard pushes content */
.fixed-footer {
  position: fixed;
  bottom: 0;
}

/* ✅ Good - use sticky instead */
.sticky-footer {
  position: sticky;
  bottom: 0;
}

/* Or handle with viewport units */
.fixed-footer {
  position: fixed;
  bottom: env(safe-area-inset-bottom);
}
```

---

### 3. Font Size Too Small

```css
/* ❌ Bad - unreadable on mobile */
body {
  font-size: 12px;
}

/* ✅ Good - readable minimum */
body {
  font-size: 16px;  /* 16px minimum */
}
```

---

### 4. Accidental Zoom

```html
<!-- ❌ Bad - triggers zoom on input focus (iOS) -->
<input type="text" style="font-size: 14px" />

<!-- ✅ Good - 16px prevents zoom -->
<input type="text" style="font-size: 16px" />
```

---

## RELATED DOCUMENTS

- See **08_DESIGN_SYSTEM.md** for design tokens
- See **09_COMPONENT_LIBRARY.md** for components
- See **10_ACCESSIBILITY.md** for a11y requirements

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- 2025-12-30: Added Flashcard Session Loading section (background sentence loading, progress indicator)
- Status: Active

---

**END OF MOBILE OPTIMIZATION**
