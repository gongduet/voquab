# 20_ERROR_HANDLING.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Error Categories](#error-categories)
3. [User-Facing Errors](#user-facing-errors)
4. [Error Recovery](#error-recovery)
5. [Error Boundaries](#error-boundaries)
6. [Logging & Reporting](#logging--reporting)
7. [Common Scenarios](#common-scenarios)

---

## OVERVIEW

Good error handling makes Voquab resilient and user-friendly. Users should never see cryptic technical errors.

**Principles:**
- Fail gracefully (don't crash the app)
- Show helpful messages (what went wrong, what to do)
- Log for debugging (but don't expose to users)
- Recover when possible (retry, fallback)

**Error Philosophy:**
- Technical errors → User-friendly messages
- Never blame the user
- Always offer a next step
- Log everything for debugging

---

## ERROR CATEGORIES

### 1. Network Errors

**Cause:** Lost connection, slow network, server down

**Examples:**
- Failed to fetch flashcards
- Can't connect to Supabase
- Request timeout

**User Message:**
> "Connection lost. Check your internet and try again."

**Recovery:** Retry with exponential backoff

---

### 2. Authentication Errors

**Cause:** Invalid credentials, expired session, permissions

**Examples:**
- Wrong password
- Session expired
- Email not verified

**User Message:**
> "Invalid email or password."
> "Your session expired. Please sign in again."

**Recovery:** Redirect to login, clear session

---

### 3. Validation Errors

**Cause:** Invalid user input

**Examples:**
- Password too short
- Invalid email format
- Missing required field

**User Message:**
> "Password must be at least 8 characters."
> "Please enter a valid email address."

**Recovery:** Show inline validation, focus on field

---

### 4. Data Errors

**Cause:** Unexpected data state, database issues

**Examples:**
- Word not found
- Chapter already unlocked
- Progress update failed

**User Message:**
> "Something went wrong. Please try again."
> "We couldn't save your progress. Your answer was recorded."

**Recovery:** Retry, show cached data, graceful degradation

---

### 5. Application Errors

**Cause:** Bugs, unhandled cases, React errors

**Examples:**
- Component crashed
- Null reference error
- Unexpected state

**User Message:**
> "Something went wrong. We've been notified."

**Recovery:** Error boundary, page reload option

---

## USER-FACING ERRORS

### Toast Notifications

**For temporary errors:**

```jsx
import { showToast } from '@/utils/toast';

// Error
showToast({
  type: 'error',
  message: 'Failed to save progress',
  duration: 5000
});

// Success
showToast({
  type: 'success',
  message: 'Progress saved',
  duration: 3000
});

// Warning
showToast({
  type: 'warning',
  message: 'Your session will expire in 5 minutes',
  duration: 5000
});
```

---

### Inline Form Errors

**For validation errors:**

```jsx
function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    // Validate
    const newErrors = {};
    
    if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Submit...
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      
      <Button type="submit">Sign In</Button>
    </form>
  );
}
```

---

### Error Pages

**Full-page errors:**

```jsx
// src/pages/ErrorPage.jsx
export function ErrorPage({ error, resetError }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-4">😕</div>
        
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Something went wrong
        </h1>
        
        <p className="text-neutral-600 mb-6">
          {error?.message || 'An unexpected error occurred'}
        </p>
        
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => window.history.back()}>
            Go Back
          </Button>
          
          <Button variant="primary" onClick={resetError}>
            Try Again
          </Button>
        </div>
        
        {import.meta.env.DEV && error && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm text-neutral-500">
              Error Details (Dev Only)
            </summary>
            <pre className="mt-2 text-xs bg-neutral-100 p-3 rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
```

---

### Empty States

**When data is missing but not an error:**

```jsx
function FlashcardsPage() {
  const { words, isLoading, error } = useFlashcardData(userId);
  
  if (isLoading) return <LoadingSpinner />;
  
  if (error) {
    return <ErrorPage error={error} />;
  }
  
  if (words.length === 0) {
    return (
      <EmptyState
        icon={<GraduationCap className="w-12 h-12 text-neutral-400" />}
        title="No words to review"
        description="Read a chapter to add words to your study queue."
        action={
          <Button href="/book">
            Start Reading
          </Button>
        }
      />
    );
  }
  
  return <FlashcardDisplay words={words} />;
}
```

---

## ERROR RECOVERY

### Retry with Exponential Backoff

**For transient network errors:**

```javascript
async function fetchWithRetry(fn, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry auth errors or validation errors
      if (error.code === 'PGRST301' || error.code === 'PGRST204') {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
const words = await fetchWithRetry(async () => {
  const { data, error } = await supabase.rpc('get_due_words_for_user');
  if (error) throw error;
  return data;
});
```

---

### Optimistic Updates

**Update UI immediately, rollback on error:**

```javascript
function useOptimisticUpdate() {
  const [optimisticData, setOptimisticData] = useState(null);
  
  async function update(newData, applyFn) {
    // Show optimistic update
    setOptimisticData(newData);
    
    try {
      // Apply to server
      await applyFn(newData);
      
      // Success - commit
      setOptimisticData(null);
    } catch (error) {
      // Error - rollback
      setOptimisticData(null);
      
      // Show error
      showToast({
        type: 'error',
        message: 'Failed to save. Please try again.'
      });
      
      throw error;
    }
  }
  
  return { optimisticData, update };
}

// Usage
function FlashcardDisplay({ word }) {
  const { optimisticData, update } = useOptimisticUpdate();
  
  const displayWord = optimisticData || word;
  
  const handleDifficulty = async (difficulty) => {
    const newMastery = calculateNewMastery(word.mastery, difficulty);
    
    await update(
      { ...word, mastery: newMastery },
      async (data) => {
        await supabase.rpc('update_word_progress', {
          p_lemma_id: word.lemma_id,
          p_difficulty: difficulty
        });
      }
    );
  };
  
  return <Flashcard word={displayWord} onDifficulty={handleDifficulty} />;
}
```

---

### Graceful Degradation

**Show partial functionality when something fails:**

```jsx
function ChapterContent({ chapterId }) {
  const { content, isLoading, error } = useChapterContent(chapterId);
  const { translations, error: translationError } = useTranslations(chapterId);
  
  if (isLoading) return <LoadingSpinner />;
  
  if (error) {
    return <ErrorPage error={error} />;
  }
  
  return (
    <div>
      {/* Main content works */}
      <ChapterText content={content} />
      
      {/* Translations failed - show fallback */}
      {translationError ? (
        <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded">
          <p className="text-warning-700">
            Translations temporarily unavailable. Click any word to look it up manually.
          </p>
        </div>
      ) : (
        <TranslationPanel translations={translations} />
      )}
    </div>
  );
}
```

---

### Offline Detection

**Handle offline state:**

```javascript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

// Usage
function App() {
  const isOnline = useOnlineStatus();
  
  return (
    <>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-error-500 text-white p-3 text-center z-50">
          ⚠️ You're offline. Some features may not work.
        </div>
      )}
      
      <Routes />
    </>
  );
}
```

---

## ERROR BOUNDARIES

### React Error Boundary

**Catch React errors:**

```jsx
// src/components/ErrorBoundary.jsx
import React from 'react';
import * as Sentry from '@sentry/react';
import { ErrorPage } from '@/pages/ErrorPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Log to Sentry
    if (import.meta.env.PROD) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
    
    this.setState({ errorInfo });
  }
  
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Wrap app:**

```jsx
// src/App.jsx
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}
```

---

### Route-Level Error Boundaries

**Isolate errors to specific routes:**

```jsx
// src/Router.jsx
import { ErrorBoundary } from 'react-error-boundary';

function Router() {
  return (
    <Routes>
      <Route
        path="/flashcards"
        element={
          <ErrorBoundary FallbackComponent={ErrorPage}>
            <FlashcardsPage />
          </ErrorBoundary>
        }
      />
      
      <Route
        path="/book"
        element={
          <ErrorBoundary FallbackComponent={ErrorPage}>
            <BookPage />
          </ErrorBoundary>
        }
      />
    </Routes>
  );
}
```

---

## LOGGING & REPORTING

### Console Logging

**Development logging:**

```javascript
// src/utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  info: (...args) => {
    if (isDev) console.log('[INFO]', ...args);
  },
  
  warn: (...args) => {
    if (isDev) console.warn('[WARN]', ...args);
  },
  
  error: (...args) => {
    console.error('[ERROR]', ...args);
    
    // Always log errors to Sentry in production
    if (import.meta.env.PROD && args[0] instanceof Error) {
      Sentry.captureException(args[0]);
    }
  },
  
  debug: (...args) => {
    if (isDev) console.debug('[DEBUG]', ...args);
  }
};

// Usage
logger.info('Fetching flashcards for user', userId);
logger.error('Failed to update progress', error);
```

---

### Error Context

**Add context to errors:**

```javascript
try {
  await updateWordProgress(lemmaId, difficulty);
} catch (error) {
  logger.error('Failed to update word progress', {
    error,
    context: {
      lemmaId,
      difficulty,
      userId: user.id,
      timestamp: new Date().toISOString()
    }
  });
  
  // Report to Sentry with context
  Sentry.captureException(error, {
    tags: {
      feature: 'flashcards',
      action: 'update_progress'
    },
    extra: {
      lemmaId,
      difficulty,
      userId: user.id
    }
  });
  
  throw error;
}
```

---

## COMMON SCENARIOS

### Scenario 1: Network Timeout

```javascript
async function fetchWithTimeout(fn, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const result = await fn({ signal: controller.signal });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    
    throw error;
  }
}

// Usage
try {
  const words = await fetchWithTimeout(async ({ signal }) => {
    const { data, error } = await supabase
      .rpc('get_due_words_for_user')
      .abortSignal(signal);
    
    if (error) throw error;
    return data;
  });
} catch (error) {
  showToast({ type: 'error', message: error.message });
}
```

---

### Scenario 2: Session Expired

```javascript
async function handleSupabaseError(error) {
  // Session expired
  if (error.code === 'PGRST301') {
    // Clear session
    await supabase.auth.signOut();
    
    // Show message
    showToast({
      type: 'warning',
      message: 'Your session expired. Please sign in again.'
    });
    
    // Redirect to login
    window.location.href = '/login';
    return;
  }
  
  // Other errors
  throw error;
}

// Usage
try {
  const { data, error } = await supabase
    .from('user_lemma_progress')
    .select('*');
  
  if (error) await handleSupabaseError(error);
  return data;
} catch (error) {
  logger.error('Database error', error);
  showToast({ type: 'error', message: 'Something went wrong' });
}
```

---

### Scenario 3: Concurrent Updates

```javascript
// Optimistic locking with version column
async function updateWithOptimisticLock(lemmaId, updates, currentVersion) {
  const { data, error } = await supabase
    .from('user_lemma_progress')
    .update({
      ...updates,
      version: currentVersion + 1
    })
    .eq('lemma_id', lemmaId)
    .eq('version', currentVersion)
    .select()
    .single();
  
  if (error) {
    // Version mismatch = concurrent update
    if (error.code === 'PGRST116') {
      showToast({
        type: 'warning',
        message: 'Progress updated from another device. Refreshing...'
      });
      
      // Refresh data
      window.location.reload();
      return;
    }
    
    throw error;
  }
  
  return data;
}
```

---

### Scenario 4: File Upload Failure

```javascript
async function uploadWithRetry(file, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(`${userId}/${file.name}`, file);
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry quota errors
      if (error.message?.includes('quota')) {
        throw new Error('Storage quota exceeded. Please contact support.');
      }
      
      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }
  
  throw new Error('Upload failed after multiple attempts. Please try again.');
}
```

---

## ERROR MESSAGE GUIDELINES

### Be Specific

```
❌ "Error"
❌ "Something went wrong"
✅ "Failed to save progress"
✅ "Connection lost. Check your internet."
```

---

### Offer Solutions

```
❌ "Database error"
✅ "We couldn't save your progress. Please try again."

❌ "Authentication failed"
✅ "Invalid email or password. Try again or reset your password."
```

---

### Never Blame User

```
❌ "You entered an invalid email"
✅ "Please enter a valid email address"

❌ "Your connection is too slow"
✅ "Connection timeout. Please check your internet."
```

---

### Keep Technical Details Internal

```
❌ Show to user: "Error: PGRST301 JWT expired"
✅ Show to user: "Your session expired. Please sign in again."
✅ Log internally: "JWT expired - code PGRST301"
```

---

## ERROR HANDLING CHECKLIST

### Before Launch

- [ ] Error boundaries on all routes
- [ ] User-friendly error messages
- [ ] Retry logic for network errors
- [ ] Offline detection
- [ ] Session expiry handling
- [ ] Form validation with inline errors
- [ ] Empty states for all lists
- [ ] Loading states for all async operations
- [ ] Sentry configured (post-MVP)

### After Error Reports

- [ ] Reproduce error
- [ ] Check logs/context
- [ ] Fix root cause
- [ ] Add test to prevent regression
- [ ] Update error handling if needed

---

## RELATED DOCUMENTS

- See **19_MONITORING.md** for error tracking
- See **12_TESTING_STRATEGY.md** for testing errors
- See **18_SECURITY.md** for security errors

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF ERROR HANDLING**
