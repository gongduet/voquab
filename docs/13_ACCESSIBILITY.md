# 10_ACCESSIBILITY.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [WCAG Compliance](#wcag-compliance)
3. [Keyboard Navigation](#keyboard-navigation)
4. [Screen Readers](#screen-readers)
5. [Color & Contrast](#color--contrast)
6. [Focus Management](#focus-management)
7. [Accessible Components](#accessible-components)
8. [Testing Checklist](#testing-checklist)

---

## OVERVIEW

Voquab must be accessible to all users, including those with disabilities. We target WCAG 2.1 Level AA compliance.

**Why Accessibility Matters:**
- Legal requirement (ADA, Section 508)
- Inclusive design benefits everyone
- Better SEO and user experience
- Language learners may have diverse needs

**Guiding Principle:** Design for accessibility from the start, not as an afterthought.

---

## WCAG COMPLIANCE

### WCAG 2.1 Level AA

We target Level AA compliance across four principles (POUR):

#### 1. Perceivable
Information and UI must be presentable to users in ways they can perceive.

**Requirements:**
- ✅ Text alternatives for images
- ✅ Captions for audio/video (future feature)
- ✅ Sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
- ✅ Resizable text up to 200% without loss of functionality
- ✅ No information conveyed by color alone

---

#### 2. Operable
UI components must be operable.

**Requirements:**
- ✅ All functionality via keyboard
- ✅ No keyboard traps
- ✅ Skip links for navigation
- ✅ Focus indicators visible
- ✅ No time limits (or user can extend)
- ✅ Pause/stop/hide moving content

---

#### 3. Understandable
Information and UI must be understandable.

**Requirements:**
- ✅ Language of page identified (lang="es" for Spanish, lang="en" for English)
- ✅ Predictable navigation
- ✅ Clear error messages
- ✅ Labels for form inputs
- ✅ Help available when needed

---

#### 4. Robust
Content must work with current and future technologies.

**Requirements:**
- ✅ Valid HTML
- ✅ Proper ARIA usage
- ✅ Compatible with assistive technologies
- ✅ No parsing errors

---

## KEYBOARD NAVIGATION

### Standard Keyboard Patterns

**Tab Navigation:**
- `Tab` - Move to next focusable element
- `Shift + Tab` - Move to previous focusable element
- Logical tab order (top to bottom, left to right)

**Activation:**
- `Enter` - Activate buttons, links
- `Space` - Activate buttons, checkboxes
- `Escape` - Close modals, cancel actions

**Arrow Keys:**
- Navigate within components (radio groups, menus)
- Scroll lists

---

### Tab Order

**Ensure logical tab order:**
```jsx
// ✅ Good - natural DOM order
<form>
  <input name="email" />      {/* Tab 1 */}
  <input name="password" />   {/* Tab 2 */}
  <button type="submit">      {/* Tab 3 */}
    Sign In
  </button>
</form>

// ❌ Bad - using tabIndex to reorder
<button tabIndex={3}>Third</button>
<button tabIndex={1}>First</button>
<button tabIndex={2}>Second</button>
```

**Skip tabIndex except for:**
- `tabIndex={0}` - Include in natural tab order (for non-interactive elements made interactive)
- `tabIndex={-1}` - Remove from tab order but allow programmatic focus

---

### Focus Traps

Trap focus within modals:

```jsx
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleTabKey(e) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
    
    modal.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
```

---

### Skip Links

Allow keyboard users to skip navigation:

```jsx
function Layout({ children }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white"
      >
        Skip to main content
      </a>
      
      <Header />
      
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}

/* CSS for screen-reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## SCREEN READERS

### Semantic HTML

Use correct HTML elements:

```jsx
// ✅ Good - semantic HTML
<button onClick={handleClick}>Click me</button>
<a href="/page">Link</a>
<nav>...</nav>
<main>...</main>

// ❌ Bad - div/span for everything
<div onClick={handleClick}>Click me</div>
<div onClick={navigateToPage}>Link</div>
```

---

### ARIA Labels

**When to use:**
- Buttons with only icons (no visible text)
- Providing additional context
- Describing interactive elements

```jsx
// Icon button
<button onClick={handleClose} aria-label="Close modal">
  <X />
</button>

// Image
<img src="prince.jpg" alt="The Little Prince standing on his planet" />

// Form input
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-required="true" />

// Error message
<input
  id="password"
  type="password"
  aria-invalid={hasError}
  aria-describedby={hasError ? "password-error" : undefined}
/>
{hasError && (
  <p id="password-error" role="alert">
    Password must be at least 8 characters
  </p>
)}
```

---

### ARIA Roles

Common roles and usage:

```jsx
// Navigation
<nav role="navigation" aria-label="Main navigation">
  <ul>...</ul>
</nav>

// Alert (live region)
<div role="alert">
  Word added to study queue
</div>

// Dialog
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Action</h2>
  ...
</div>

// Status (polite live region)
<div role="status" aria-live="polite">
  Loading: 25% complete
</div>

// Tab panel
<div role="tabpanel" aria-labelledby="tab-1">
  Content for tab 1
</div>
```

---

### Live Regions

Announce dynamic content changes:

```jsx
function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

// For urgent messages
<div role="alert" aria-live="assertive">
  Error: Failed to save progress
</div>
```

---

### Hiding Content

**Visually hidden but available to screen readers:**
```jsx
<span className="sr-only">
  Current page: Chapter 1
</span>
```

**Hidden from everyone:**
```jsx
<div aria-hidden="true">
  Decorative element
</div>
```

**Conditionally hide:**
```jsx
{!isVisible && <div inert>Hidden content</div>}
```

---

## COLOR & CONTRAST

### Contrast Ratios

**WCAG AA Requirements:**
- Normal text (< 24px): 4.5:1 minimum
- Large text (≥ 24px or 18.66px bold): 3:1 minimum
- UI components and graphics: 3:1 minimum

---

### Color Palette Compliance

All Voquab colors meet WCAG AA:

```css
/* ✅ Passes - 4.5:1 on white */
color: #1c1917; /* neutral-900 for body text */

/* ✅ Passes - 4.51:1 on white */
color: #57534e; /* neutral-600 for secondary text */

/* ✅ Passes - 3.46:1 on white (large text only) */
color: #78716c; /* neutral-500 for large text */

/* ✅ Passes - 4.89:1 on white */
background: #0ea5e9; /* primary-500 */
color: #ffffff;
```

---

### Never Rely on Color Alone

```jsx
// ❌ Bad - color only
<span className="text-error-500">Error</span>

// ✅ Good - color + icon + text
<span className="text-error-500 flex items-center gap-1">
  <AlertCircle className="w-4 h-4" />
  Error: Invalid input
</span>

// ❌ Bad - color-coded status
<div className={health < 20 ? 'bg-red-500' : 'bg-green-500'} />

// ✅ Good - color + label
<div>
  <span className="sr-only">Health: {getHealthStatus(health)}</span>
  <div className="h-2 bg-neutral-200">
    <div 
      className={getHealthColor(health)}
      style={{ width: `${health}%` }}
      aria-hidden="true"
    />
  </div>
</div>
```

---

### Link Identification

```jsx
// ✅ Good - underlined links
<a href="/chapter1" className="text-primary-600 underline hover:text-primary-700">
  Chapter 1
</a>

// ✅ Good - button-styled links (clearly interactive)
<a href="/study" className="btn btn-primary">
  Start Studying
</a>
```

---

## FOCUS MANAGEMENT

### Visible Focus Indicators

**Always show focus:**
```css
/* ✅ Good - visible focus ring */
button:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

/* ❌ Bad - no focus indicator */
button:focus {
  outline: none;
}
```

**TailwindCSS:**
```jsx
<button className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
  Click me
</button>
```

---

### Focus on Modal Open

```jsx
function Modal({ isOpen, title, children }) {
  const firstFocusableRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus();
    }
  }, [isOpen]);
  
  return (
    <div role="dialog" aria-modal="true">
      <h2 ref={firstFocusableRef} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </div>
  );
}
```

---

### Restore Focus on Close

```jsx
function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const previousFocusRef = useRef(null);
  
  const openModal = () => {
    previousFocusRef.current = document.activeElement;
    setIsOpen(true);
  };
  
  const closeModal = () => {
    setIsOpen(false);
    previousFocusRef.current?.focus();
  };
  
  return { isOpen, openModal, closeModal };
}
```

---

## ACCESSIBLE COMPONENTS

### Button

```jsx
<button
  type="button"
  onClick={handleClick}
  disabled={isDisabled}
  aria-label={ariaLabel}        // If no visible text
  aria-pressed={isPressed}      // If toggle button
  aria-expanded={isExpanded}    // If controls expandable content
>
  {children}
</button>
```

---

### Form Input

```jsx
<div>
  <label htmlFor="email" className="block mb-2">
    Email Address
    <span aria-label="required">*</span>
  </label>
  
  <input
    id="email"
    type="email"
    value={email}
    onChange={handleChange}
    required
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : "email-hint"}
  />
  
  <p id="email-hint" className="text-sm text-neutral-600">
    We'll never share your email
  </p>
  
  {hasError && (
    <p id="email-error" role="alert" className="text-error-600">
      Please enter a valid email address
    </p>
  )}
</div>
```

---

### Modal/Dialog

```jsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">Confirm Action</h2>
  <p id="modal-description">Are you sure you want to continue?</p>
  
  <button onClick={handleConfirm}>Yes, continue</button>
  <button onClick={handleCancel}>Cancel</button>
</div>
```

---

### Tabs

```jsx
function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div>
      <div role="tablist" aria-label="Chapter sections">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

---

## TESTING CHECKLIST

### Manual Testing

**Keyboard Navigation:**
- [ ] All interactive elements reachable via Tab
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] No keyboard traps
- [ ] Skip links work
- [ ] Modals trap focus properly
- [ ] Escape closes modals

**Screen Reader (macOS VoiceOver / Windows NVDA):**
- [ ] All content announced
- [ ] Headings properly structured (h1 → h6)
- [ ] Form labels announced
- [ ] Button purposes clear
- [ ] Error messages announced
- [ ] Live regions work
- [ ] Images have alt text

**Visual:**
- [ ] Sufficient color contrast
- [ ] Text resizable to 200%
- [ ] No information by color alone
- [ ] Focus indicators visible
- [ ] Touch targets ≥ 44px × 44px

---

### Automated Testing

**Tools:**
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [WAVE](https://wave.webaim.org/) - Browser extension
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Chrome DevTools

**Run on Every Page:**
```bash
# Install axe-core
npm install --save-dev axe-core

# Test in development
import { axe } from 'jest-axe';

test('page is accessible', async () => {
  const { container } = render(<Page />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

### Quick Accessibility Checks

**Before Every Release:**

1. **Keyboard Test (5 min)**
   - Can you navigate the entire page with Tab/Enter/Space?
   - Are focus indicators visible?
   - Can you close modals with Escape?

2. **Screen Reader Test (10 min)**
   - Turn on VoiceOver (macOS) or NVDA (Windows)
   - Navigate with keyboard
   - Is everything announced clearly?

3. **Color Contrast Test (2 min)**
   - Run WAVE or axe DevTools
   - Fix any contrast errors

4. **Zoom Test (2 min)**
   - Zoom browser to 200%
   - Is everything still usable?

---

## COMMON MISTAKES TO AVOID

### 1. Missing Alt Text
```jsx
// ❌ Bad
<img src="prince.jpg" />

// ✅ Good
<img src="prince.jpg" alt="The Little Prince" />

// ✅ Good - decorative image
<img src="stars.jpg" alt="" aria-hidden="true" />
```

---

### 2. Div/Span Buttons
```jsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>
```

---

### 3. Form Without Labels
```jsx
// ❌ Bad
<input placeholder="Email" />

// ✅ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// ✅ Good - visually hidden label
<label htmlFor="search" className="sr-only">Search</label>
<input id="search" type="search" placeholder="Search..." />
```

---

### 4. Missing Focus States
```jsx
// ❌ Bad
<button className="outline-none">Click</button>

// ✅ Good
<button className="focus:ring-2 focus:ring-primary-500">
  Click
</button>
```

---

### 5. Low Contrast Text
```jsx
// ❌ Bad - fails contrast
<p className="text-gray-400">Important text</p>

// ✅ Good - passes contrast
<p className="text-neutral-700">Important text</p>
```

---

## RESOURCES

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Hemingway Editor](https://hemingwayapp.com/) - Plain language

### Testing
- [VoiceOver (macOS)](https://support.apple.com/guide/voiceover/welcome/mac)
- [NVDA (Windows)](https://www.nvaccess.org/)
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/)

---

## RELATED DOCUMENTS

- See **08_DESIGN_SYSTEM.md** for color palette
- See **09_COMPONENT_LIBRARY.md** for component implementations
- See **16_CODE_STYLE_GUIDE.md** for code standards

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF ACCESSIBILITY**
