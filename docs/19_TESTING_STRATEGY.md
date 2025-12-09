# 12_TESTING_STRATEGY.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Testing Philosophy](#testing-philosophy)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Manual Testing](#manual-testing)
7. [Testing Checklist](#testing-checklist)

---

## OVERVIEW

Voquab uses a pragmatic testing approach: test what matters, skip the rest. Focus on user flows and critical business logic.

**Testing Stack:**
- **Unit Tests:** Vitest + React Testing Library
- **E2E Tests:** Playwright (post-MVP)
- **Manual Tests:** Human testing on real devices

**Coverage Goals:**
- Critical paths: 100% (auth, flashcards, progress tracking)
- Utilities: 90%
- Components: 70%
- Overall: 80%

---

## TESTING PHILOSOPHY

### Test the Right Things

**DO Test:**
- Business logic (priority scoring, health calculations)
- User flows (sign in, review flashcard, read chapter)
- Edge cases (empty states, error states)
- Critical utilities (time gates, mastery calculations)

**DON'T Test:**
- Trivial components (pure presentational)
- Third-party libraries (Supabase, React)
- Implementation details (internal state)

---

### Test Pyramid

```
        /\
       /E2E\        Small number of E2E tests
      /------\      (Critical user flows)
     /  INT   \     Some integration tests
    /----------\    (Component + hooks + API)
   /   UNIT     \   Many unit tests
  /--------------\  (Pure functions, utilities)
```

**Distribution:**
- Unit tests: 70%
- Integration tests: 25%
- E2E tests: 5%

---

## UNIT TESTING

### Setup

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Configuration:**

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ]
    }
  }
});
```

**Setup file:**

```javascript
// src/test/setup.js
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

---

### Testing Utilities

**Health Calculations:**

```javascript
// src/utils/healthCalculations.test.js
import { describe, it, expect } from 'vitest';
import { calculateCurrentHealth, getHealthBoost } from './healthCalculations';

describe('calculateCurrentHealth', () => {
  it('calculates health decay correctly for new word', () => {
    const word = {
      health: 100,
      last_reviewed_at: '2025-11-25T00:00:00Z', // 5 days ago
      mastery_level: 0
    };
    
    const currentHealth = calculateCurrentHealth(word);
    
    // Level 0 decay: 25 points/day × 5 days = 125 points
    // 100 - 125 = -25, clamped to 0
    expect(currentHealth).toBe(0);
  });
  
  it('calculates health decay for mastered word', () => {
    const word = {
      health: 100,
      last_reviewed_at: '2025-11-25T00:00:00Z', // 5 days ago
      mastery_level: 70
    };
    
    const currentHealth = calculateCurrentHealth(word);
    
    // Level 7 decay: 1.5 points/day × 5 days = 7.5 points
    // 100 - 7.5 = 92.5, rounded to 93
    expect(currentHealth).toBe(93);
  });
  
  it('returns stored health if reviewed today', () => {
    const word = {
      health: 85,
      last_reviewed_at: new Date().toISOString(),
      mastery_level: 40
    };
    
    const currentHealth = calculateCurrentHealth(word);
    expect(currentHealth).toBe(85);
  });
});

describe('getHealthBoost', () => {
  it('returns correct boost for each difficulty', () => {
    expect(getHealthBoost('dont-know')).toBe(10);
    expect(getHealthBoost('hard')).toBe(30);
    expect(getHealthBoost('medium')).toBe(60);
    expect(getHealthBoost('easy')).toBe(100);
  });
  
  it('throws error for invalid difficulty', () => {
    expect(() => getHealthBoost('invalid')).toThrow();
  });
});
```

---

**Priority Calculations:**

```javascript
// src/utils/priorityCalculations.test.js
import { describe, it, expect } from 'vitest';
import { calculatePriorityScore } from './priorityCalculations';

describe('calculatePriorityScore', () => {
  it('gives high priority to critical health words', () => {
    const word = {
      health: 10,
      mastery_level: 30,
      times_in_book: 20,
      chapter_number: 1
    };
    
    const score = calculatePriorityScore(word);
    
    // Health urgency: (100-10) × 0.5 = 45
    // Critical multiplier: ×1.5 = 67.5
    expect(score).toBeGreaterThan(60);
  });
  
  it('prioritizes high-frequency words', () => {
    const highFreq = {
      health: 50,
      mastery_level: 30,
      times_in_book: 50,
      chapter_number: 1
    };
    
    const lowFreq = {
      health: 50,
      mastery_level: 30,
      times_in_book: 2,
      chapter_number: 1
    };
    
    const highScore = calculatePriorityScore(highFreq);
    const lowScore = calculatePriorityScore(lowFreq);
    
    expect(highScore).toBeGreaterThan(lowScore);
  });
  
  it('boosts chapter focus words', () => {
    const word = {
      health: 50,
      mastery_level: 30,
      times_in_book: 10,
      chapter_number: 3
    };
    
    const normalScore = calculatePriorityScore(word, {
      chapterFocusMode: false
    });
    
    const focusScore = calculatePriorityScore(word, {
      chapterFocusMode: true,
      currentChapter: 3
    });
    
    expect(focusScore).toBeGreaterThan(normalScore);
  });
});
```

---

### Testing Components

**Button Component:**

```javascript
// src/components/common/Button.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    const button = screen.getByText('Click me');
    expect(button).toBeDisabled();
  });
  
  it('shows loading spinner when loading', () => {
    render(<Button loading>Click me</Button>);
    
    expect(screen.getByText('Click me')).toBeInTheDocument();
    // Check for spinner (implementation depends on your spinner)
    expect(screen.getByRole('button')).toHaveClass('loading');
  });
  
  it('applies correct variant styles', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary-500');
    
    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-neutral-100');
  });
});
```

---

### Testing Custom Hooks

**useFlashcardData Hook:**

```javascript
// src/hooks/flashcard/useFlashcardData.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFlashcardData } from './useFlashcardData';
import * as supabase from '../../supabaseClient';

vi.mock('../../supabaseClient');

describe('useFlashcardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('fetches words on mount', async () => {
    const mockWords = [
      { lemma_id: '1', lemma_text: 'hola' },
      { lemma_id: '2', lemma_text: 'adiós' }
    ];
    
    supabase.supabase.rpc.mockResolvedValue({
      data: mockWords,
      error: null
    });
    
    const { result } = renderHook(() => useFlashcardData('user-123'));
    
    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.words).toEqual(mockWords);
    expect(result.current.error).toBe(null);
  });
  
  it('handles fetch errors', async () => {
    supabase.supabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('Database error')
    });
    
    const { result } = renderHook(() => useFlashcardData('user-123'));
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    
    expect(result.current.words).toEqual([]);
    expect(result.current.error).toBe('Database error');
  });
});
```

---

## INTEGRATION TESTING

### Testing Components + Hooks

**Flashcard Session:**

```javascript
// src/pages/Flashcards.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlashcardsPage } from './Flashcards';
import * as authContext from '../contexts/AuthContext';
import * as supabase from '../supabaseClient';

vi.mock('../contexts/AuthContext');
vi.mock('../supabaseClient');

describe('FlashcardsPage', () => {
  it('displays flashcards for logged-in user', async () => {
    authContext.useAuth.mockReturnValue({
      user: { id: 'user-123' }
    });
    
    supabase.supabase.rpc.mockResolvedValue({
      data: [
        {
          lemma_id: '1',
          lemma_text: 'vivir',
          definitions: ['to live'],
          example_sentence: 'Vivo en Madrid.'
        }
      ],
      error: null
    });
    
    render(<FlashcardsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('vivir')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Vivo en Madrid.')).toBeInTheDocument();
  });
  
  it('updates progress when difficulty selected', async () => {
    const user = userEvent.setup();
    
    authContext.useAuth.mockReturnValue({
      user: { id: 'user-123' }
    });
    
    supabase.supabase.rpc
      .mockResolvedValueOnce({
        data: [
          { lemma_id: '1', lemma_text: 'vivir', definitions: ['to live'] }
        ],
        error: null
      })
      .mockResolvedValueOnce({ error: null }); // update_word_progress
    
    render(<FlashcardsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('vivir')).toBeInTheDocument();
    });
    
    // Click "Medium" button
    await user.click(screen.getByText('Medium'));
    
    await waitFor(() => {
      expect(supabase.supabase.rpc).toHaveBeenCalledWith(
        'update_word_progress',
        expect.objectContaining({
          p_lemma_id: '1',
          p_difficulty: 'medium'
        })
      );
    });
  });
});
```

---

## END-TO-END TESTING

### Setup (Post-MVP)

```bash
npm install --save-dev @playwright/test
```

**Configuration:**

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

### Critical User Flows

**Flow 1: Sign Up & Study:**

```javascript
// e2e/signup-and-study.spec.js
import { test, expect } from '@playwright/test';

test('user can sign up and study flashcards', async ({ page }) => {
  // Navigate to home
  await page.goto('/');
  
  // Click sign up
  await page.click('text=Sign Up');
  
  // Fill form
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'SecurePassword123');
  await page.click('button[type="submit"]');
  
  // Should redirect to home
  await expect(page).toHaveURL('/');
  await expect(page.locator('text=Welcome')).toBeVisible();
  
  // Start studying
  await page.click('text=Study Now');
  
  // Should see flashcard
  await expect(page.locator('[data-testid="flashcard"]')).toBeVisible();
  
  // Select difficulty
  await page.click('text=Medium');
  
  // Should show next card or completion
  await expect(
    page.locator('[data-testid="flashcard"], text=Session Complete')
  ).toBeVisible();
});
```

---

**Flow 2: Reading & Clicking Words:**

```javascript
// e2e/reading-experience.spec.js
import { test, expect } from '@playwright/test';

test('user can read chapter and look up words', async ({ page }) => {
  // Sign in first (test helper)
  await signIn(page, 'test@example.com', 'password');
  
  // Navigate to book
  await page.click('text=Book');
  
  // Open Chapter 1
  await page.click('text=Chapter 1');
  
  // Should see Spanish text
  await expect(page.locator('text=Cuando yo tenía')).toBeVisible();
  
  // Click a word
  await page.click('text=tenía');
  
  // Should see definition modal
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('text=to have')).toBeVisible();
  
  // Add to study queue
  await page.click('text=Add to Study Queue');
  
  // Should see confirmation
  await expect(page.locator('text=Added to queue')).toBeVisible();
  
  // Close modal
  await page.keyboard.press('Escape');
  
  // Modal should close
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
```

---

## MANUAL TESTING

### Pre-Launch Checklist

**Authentication:**
- [ ] Sign up with email/password
- [ ] Sign in with valid credentials
- [ ] Sign in fails with invalid credentials
- [ ] Sign out works
- [ ] Password reset email sent

**Flashcards:**
- [ ] Cards load for new user
- [ ] Difficulty buttons work
- [ ] "Don't Know" re-queues card
- [ ] Session completes after all cards
- [ ] Progress updates in database
- [ ] Stats display correctly

**Reading:**
- [ ] Chapter list loads
- [ ] Locked chapters show lock icon
- [ ] Click word shows definition
- [ ] Add to study queue works
- [ ] Encounter tracking works
- [ ] Progress toward unlock updates

**Chapter Unlocking:**
- [ ] Chapter unlocks when requirements met
- [ ] Unlock celebration shows
- [ ] Next chapter becomes available
- [ ] Progress persists after refresh

**Mobile:**
- [ ] Works on iPhone
- [ ] Works on Android
- [ ] Touch targets tappable
- [ ] No horizontal scroll
- [ ] Modals work properly
- [ ] Navigation works

---

### Browser Testing

**Test in:**
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iPhone)
- [ ] Mobile Chrome (Android)

**Don't test:**
- Internet Explorer (not supported)
- Old browser versions (>2 years old)

---

### Device Testing

**Minimum devices:**
- [ ] iPhone (any recent model)
- [ ] Android phone (any recent model)
- [ ] iPad or Android tablet
- [ ] Desktop/laptop (Mac or Windows)

---

## TESTING CHECKLIST

### Before Every PR

- [ ] All unit tests pass (`npm test`)
- [ ] No console errors
- [ ] Code formatted (`npm run format`)
- [ ] Linter passes (`npm run lint`)
- [ ] New features have tests

---

### Before Every Deploy

- [ ] All tests pass (unit + integration)
- [ ] Manual smoke test on staging
- [ ] Tested on mobile device
- [ ] No breaking changes to API
- [ ] Database migrations tested

---

### Before Launch

- [ ] All critical flows tested (E2E)
- [ ] Performance tested (Lighthouse >90)
- [ ] Accessibility tested (axe DevTools)
- [ ] Cross-browser tested
- [ ] Mobile tested on real devices
- [ ] Beta testers completed testing
- [ ] All critical bugs fixed

---

## TEST HELPERS

### Mock Data

```javascript
// src/test/mockData.js
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com'
};

export const mockWord = {
  lemma_id: '1',
  lemma_text: 'vivir',
  definitions: ['to live'],
  part_of_speech: 'verb',
  mastery_level: 30,
  health: 75,
  times_in_book: 20
};

export const mockWords = [
  mockWord,
  {
    lemma_id: '2',
    lemma_text: 'casa',
    definitions: ['house', 'home'],
    part_of_speech: 'noun',
    gender: 'f',
    mastery_level: 50,
    health: 60,
    times_in_book: 35
  }
];
```

---

### Test Utilities

```javascript
// src/test/testUtils.jsx
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

export function renderWithProviders(ui, options = {}) {
  const {
    user = null,
    ...renderOptions
  } = options;
  
  function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider initialUser={user}>
          {children}
        </AuthProvider>
      </BrowserRouter>
    );
  }
  
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
```

---

## RELATED DOCUMENTS

- See **16_CODE_STYLE_GUIDE.md** for code standards
- See **13_DEPLOYMENT.md** for CI/CD pipeline
- See **20_ERROR_HANDLING.md** for error scenarios

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF TESTING STRATEGY**
