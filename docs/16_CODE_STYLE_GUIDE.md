# 16_CODE_STYLE_GUIDE.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [File Organization](#file-organization)
3. [Naming Conventions](#naming-conventions)
4. [React Patterns](#react-patterns)
5. [TypeScript (Future)](#typescript-future)
6. [CSS & Styling](#css--styling)
7. [Comments & Documentation](#comments--documentation)
8. [Code Quality](#code-quality)

---

## OVERVIEW

This guide establishes coding standards for Voquab to maintain consistency, readability, and maintainability.

**Goals:**
- Consistent codebase across all files
- Easy onboarding for new contributors
- Reduced cognitive load when reading code
- Fewer bugs through standardization

**Tools:**
- ESLint for linting
- Prettier for formatting
- React 19 with hooks
- TailwindCSS for styling

---

## FILE ORGANIZATION

### Directory Structure

```
src/
├── components/
│   ├── flashcard/
│   │   ├── FlashcardDisplay.jsx
│   │   ├── DifficultyButtons.jsx
│   │   ├── SessionStats.jsx
│   │   └── index.js
│   ├── reading/
│   │   ├── ChapterContent.jsx
│   │   ├── DefinitionModal.jsx
│   │   ├── Word.jsx
│   │   └── index.js
│   ├── common/
│   │   ├── Button.jsx
│   │   ├── Modal.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── index.js
│   └── layout/
│       ├── Header.jsx
│       ├── Footer.jsx
│       └── index.js
├── hooks/
│   ├── flashcard/
│   │   ├── useFlashcardData.js
│   │   ├── useFlashcardSession.js
│   │   └── useProgressTracking.js
│   ├── auth/
│   │   ├── useAuth.js
│   │   └── useUser.js
│   └── reading/
│       ├── useChapterContent.js
│       └── useWordEncounters.js
├── pages/
│   ├── Flashcards.jsx
│   ├── Book.jsx
│   ├── Home.jsx
│   ├── Progress.jsx
│   └── Admin.jsx
├── utils/
│   ├── healthCalculations.js
│   ├── priorityCalculations.js
│   ├── timeGateCalculations.js
│   └── dateHelpers.js
├── contexts/
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── supabaseClient.js
├── App.jsx
└── main.jsx
```

---

### File Naming

**Components:** PascalCase  
`FlashcardDisplay.jsx`, `DifficultyButtons.jsx`

**Hooks:** camelCase with `use` prefix  
`useFlashcardData.js`, `useAuth.js`

**Utils:** camelCase  
`healthCalculations.js`, `dateHelpers.js`

**Pages:** PascalCase  
`Flashcards.jsx`, `Home.jsx`

**Contexts:** PascalCase with `Context` suffix  
`AuthContext.jsx`

---

### Index Files

Use `index.js` to re-export components from a directory:

```javascript
// src/components/flashcard/index.js
export { default as FlashcardDisplay } from './FlashcardDisplay';
export { default as DifficultyButtons } from './DifficultyButtons';
export { default as SessionStats } from './SessionStats';
```

**Import:**
```javascript
import { FlashcardDisplay, DifficultyButtons } from '@/components/flashcard';
```

---

## NAMING CONVENTIONS

### Variables

**camelCase for regular variables:**
```javascript
const userProgress = getUserProgress();
const currentHealth = calculateHealth();
const isLoading = true;
```

**SCREAMING_SNAKE_CASE for constants:**
```javascript
const MASTERY_POINTS = {
  'dont-know': -5,
  'hard': 3,
  'medium': 6,
  'easy': 10
};

const MAX_DECK_SIZE = 30;
const DEFAULT_SESSION_SIZE = 25;
```

---

### Functions

**camelCase:**
```javascript
function calculatePriorityScore(word) {
  // ...
}

async function fetchUserProgress(userId) {
  // ...
}
```

**Prefixes:**
- `get` for retrieval: `getUserWords()`
- `set` for updates: `setMasteryLevel()`
- `calculate` for computations: `calculateHealth()`
- `handle` for event handlers: `handleCardFlip()`
- `is/has/can` for booleans: `isLoading()`, `hasAccess()`

---

### React Components

**PascalCase:**
```javascript
function FlashcardDisplay({ word, onFlip }) {
  return (
    <div className="flashcard">
      {word.lemma}
    </div>
  );
}
```

**Props:** camelCase  
```javascript
<FlashcardDisplay 
  word={currentWord}
  showDefinition={true}
  onDifficultySelect={handleDifficulty}
/>
```

---

### CSS Classes

**kebab-case (Tailwind utilities):**
```javascript
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold text-gray-900">
    Title
  </h1>
</div>
```

**BEM for custom classes (if needed):**
```css
.flashcard {}
.flashcard__content {}
.flashcard__content--flipped {}
```

---

## REACT PATTERNS

### Component Structure

**Standard Order:**
```javascript
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// 1. Imports (external, internal, styles)
// 2. Constants
// 3. Helper functions (if small, otherwise move to utils)
// 4. Component
// 5. PropTypes
// 6. Default export

const DIFFICULTY_LEVELS = ['dont-know', 'hard', 'medium', 'easy'];

function FlashcardDisplay({ word, onDifficultySelect }) {
  // 1. Hooks (state, effects, custom hooks)
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDefinition, setShowDefinition] = useState(false);
  
  useEffect(() => {
    // Effect logic
  }, [word]);
  
  // 2. Event handlers
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  const handleDifficulty = (difficulty) => {
    onDifficultySelect(difficulty);
    setIsFlipped(false);
  };
  
  // 3. Derived values
  const displayText = isFlipped ? word.definition : word.lemma;
  
  // 4. Early returns (loading, errors)
  if (!word) return <LoadingSpinner />;
  
  // 5. Main render
  return (
    <div className="flashcard" onClick={handleFlip}>
      <p className="text-xl">{displayText}</p>
      {isFlipped && (
        <DifficultyButtons 
          onSelect={handleDifficulty}
          levels={DIFFICULTY_LEVELS}
        />
      )}
    </div>
  );
}

FlashcardDisplay.propTypes = {
  word: PropTypes.shape({
    lemma: PropTypes.string.isRequired,
    definition: PropTypes.string.isRequired
  }).isRequired,
  onDifficultySelect: PropTypes.func.isRequired
};

export default FlashcardDisplay;
```

---

### Hooks Best Practices

**Custom Hooks Return Objects (not arrays):**
```javascript
// ✅ Good - named properties
function useFlashcardData(userId) {
  const [words, setWords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  return { words, isLoading, error, refetch };
}

// Usage
const { words, isLoading } = useFlashcardData(userId);

// ❌ Bad - array destructuring
function useFlashcardData(userId) {
  return [words, isLoading, error, refetch];
}
```

**Use `useEffect` Dependency Array Correctly:**
```javascript
// ✅ Good - include all dependencies
useEffect(() => {
  fetchWords(userId);
}, [userId]);

// ❌ Bad - missing dependency
useEffect(() => {
  fetchWords(userId);
}, []);
```

**Cleanup Effects:**
```javascript
useEffect(() => {
  const timer = setTimeout(() => {
    // ...
  }, 1000);
  
  return () => clearTimeout(timer);
}, []);
```

---

### State Management

**useState for component-level state:**
```javascript
const [isOpen, setIsOpen] = useState(false);
const [count, setCount] = useState(0);
```

**useReducer for complex state:**
```javascript
const initialState = {
  words: [],
  currentIndex: 0,
  sessionStats: {
    total: 0,
    correct: 0
  }
};

function sessionReducer(state, action) {
  switch (action.type) {
    case 'NEXT_WORD':
      return {
        ...state,
        currentIndex: state.currentIndex + 1
      };
    case 'RECORD_ANSWER':
      return {
        ...state,
        sessionStats: {
          total: state.sessionStats.total + 1,
          correct: state.sessionStats.correct + (action.isCorrect ? 1 : 0)
        }
      };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(sessionReducer, initialState);
```

---

### Conditional Rendering

**Short-circuit for simple cases:**
```javascript
{isLoading && <LoadingSpinner />}
{error && <ErrorMessage message={error} />}
```

**Ternary for two options:**
```javascript
{isFlipped ? <Definition /> : <Word />}
```

**Function for complex logic:**
```javascript
function renderContent() {
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!words.length) return <EmptyState />;
  return <FlashcardDisplay word={words[currentIndex]} />;
}

return <div>{renderContent()}</div>;
```

---

### Event Handlers

**Name with `handle` prefix:**
```javascript
const handleSubmit = (e) => {
  e.preventDefault();
  // ...
};

const handleInputChange = (e) => {
  setValue(e.target.value);
};
```

**Pass inline for simple callbacks:**
```javascript
<button onClick={() => setCount(count + 1)}>
  Increment
</button>
```

**Use named functions for complex logic:**
```javascript
const handleDifficulty = (difficulty) => {
  updateProgress(word.id, difficulty);
  trackAnalytics('word_reviewed', { difficulty });
  moveToNextCard();
};

<button onClick={() => handleDifficulty('easy')}>Easy</button>
```

---

## TYPESCRIPT (FUTURE)

When migrating to TypeScript:

### Interface Naming

**PascalCase without `I` prefix:**
```typescript
// ✅ Good
interface Word {
  lemma: string;
  definition: string;
}

// ❌ Bad
interface IWord {
  // ...
}
```

### Component Props

```typescript
interface FlashcardDisplayProps {
  word: Word;
  onDifficultySelect: (difficulty: Difficulty) => void;
  showDefinition?: boolean;
}

function FlashcardDisplay({ 
  word, 
  onDifficultySelect,
  showDefinition = false 
}: FlashcardDisplayProps) {
  // ...
}
```

---

## CSS & STYLING

### TailwindCSS Classes

**Order (Prettier will handle this):**
1. Layout (display, position)
2. Box model (width, height, padding, margin)
3. Typography (font, text)
4. Visual (background, border)
5. Misc (cursor, transition)

```javascript
<div className="flex items-center justify-between w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
```

---

### Responsive Design

**Mobile-first:**
```javascript
<div className="text-base md:text-lg lg:text-xl">
  Content
</div>
```

**Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

---

### Custom Classes (Rare)

Only when Tailwind insufficient:

```css
/* src/styles/custom.css */
.flashcard-flip {
  transform-style: preserve-3d;
  transition: transform 0.6s;
}

.flashcard-flip.flipped {
  transform: rotateY(180deg);
}
```

Import in component:
```javascript
import './custom.css';
```

---

## COMMENTS & DOCUMENTATION

### When to Comment

**DO comment:**
- Complex algorithms
- Business logic decisions
- Non-obvious workarounds
- TODO items with context

**DON'T comment:**
- Obvious code
- What code does (code should be self-explanatory)

---

### Comment Style

**Single-line:**
```javascript
// Calculate health decay based on days since review
const decayedHealth = calculateHealthDecay(word);
```

**Multi-line:**
```javascript
/**
 * Calculates priority score for word selection
 * 
 * @param {Object} word - Word object with mastery/health
 * @param {Object} options - Priority calculation options
 * @returns {number} Priority score (0-200+)
 */
function calculatePriorityScore(word, options) {
  // ...
}
```

**TODO comments:**
```javascript
// TODO(peter): Implement time gate check
// TODO: Add error handling for failed API calls
// FIXME: Memory leak in useEffect cleanup
```

---

### JSDoc for Complex Functions

```javascript
/**
 * Updates user progress after reviewing a word
 * 
 * @param {string} userId - User ID
 * @param {string} lemmaId - Lemma ID
 * @param {('dont-know'|'hard'|'medium'|'easy')} difficulty - User's response
 * @returns {Promise<void>}
 * 
 * @example
 * await updateWordProgress(userId, lemmaId, 'medium');
 */
async function updateWordProgress(userId, lemmaId, difficulty) {
  // ...
}
```

---

## CODE QUALITY

### Linting

**ESLint Config:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/prop-types": "warn",
    "no-unused-vars": "warn",
    "no-console": ["warn", { "allow": ["error", "warn"] }]
  }
}
```

---

### Prettier Config

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "always"
}
```

---

### Code Review Checklist

Before committing:

**Functionality:**
- [ ] Code works as intended
- [ ] Edge cases handled
- [ ] Error states handled

**Quality:**
- [ ] No unused imports/variables
- [ ] No console.logs (except error/warn)
- [ ] Follows naming conventions
- [ ] Proper component structure

**Testing:**
- [ ] Tested in browser
- [ ] Tested on mobile viewport
- [ ] No errors in console

**Documentation:**
- [ ] Complex logic commented
- [ ] PropTypes defined (or TypeScript types)
- [ ] README updated if needed

---

### Performance

**Avoid unnecessary re-renders:**
```javascript
// ✅ Good - memoize expensive calculations
const sortedWords = useMemo(() => {
  return words.sort((a, b) => b.priority - a.priority);
}, [words]);

// ✅ Good - memoize callbacks
const handleDifficulty = useCallback((difficulty) => {
  updateProgress(word.id, difficulty);
}, [word.id]);
```

**Lazy load heavy components:**
```javascript
const AdminDashboard = lazy(() => import('./pages/Admin'));

<Suspense fallback={<LoadingSpinner />}>
  <AdminDashboard />
</Suspense>
```

---

### Accessibility

**Semantic HTML:**
```javascript
// ✅ Good
<button onClick={handleClick}>Click me</button>

// ❌ Bad
<div onClick={handleClick}>Click me</div>
```

**ARIA labels:**
```javascript
<button 
  onClick={handleClose}
  aria-label="Close modal"
>
  ×
</button>
```

**Keyboard navigation:**
```javascript
<div 
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
```

---

## QUICK REFERENCE

### Naming Cheat Sheet

| Item | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `FlashcardDisplay` |
| Hook | camelCase + use | `useFlashcardData` |
| Utility function | camelCase | `calculateHealth` |
| Constant | SCREAMING_SNAKE | `MAX_DECK_SIZE` |
| Variable | camelCase | `currentWord` |
| CSS class | kebab-case | `flashcard-content` |
| File (component) | PascalCase.jsx | `FlashcardDisplay.jsx` |
| File (hook) | camelCase.js | `useFlashcardData.js` |

---

## RELATED DOCUMENTS

- See **17_STATE_MANAGEMENT.md** for state patterns
- See **15_API_DOCUMENTATION.md** for database queries
- See **DOCUMENTATION_ROADMAP.md** for all docs

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF CODE STYLE GUIDE**
