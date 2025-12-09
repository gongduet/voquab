# 17_STATE_MANAGEMENT.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [State Categories](#state-categories)
3. [Context Providers](#context-providers)
4. [Custom Hooks](#custom-hooks)
5. [Data Fetching](#data-fetching)
6. [Performance Optimization](#performance-optimization)
7. [Best Practices](#best-practices)

---

## OVERVIEW

Voquab uses React's built-in state management tools (Context API, hooks) rather than external libraries like Redux. This keeps the stack simple while providing sufficient state management for the application's needs.

**Philosophy:** Use the simplest state management solution that works.

**Tools:**
- `useState` for component-local state
- `useReducer` for complex component state
- Context API for shared global state
- Custom hooks for reusable state logic

---

## STATE CATEGORIES

### 1. Local Component State

State used only within a single component.

**Tool:** `useState`

**Examples:**
- Form input values
- Modal open/closed
- Accordion expanded/collapsed
- Loading states for component-specific actions

```javascript
function FlashcardDisplay() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  
  return (
    <div onClick={() => setIsFlipped(!isFlipped)}>
      {/* ... */}
    </div>
  );
}
```

---

### 2. Shared Component State

State shared between parent and child components.

**Tool:** Props (lift state up)

**Example:**
```javascript
function FlashcardsPage() {
  const [currentWord, setCurrentWord] = useState(null);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0 });
  
  return (
    <>
      <FlashcardDisplay 
        word={currentWord}
        onAnswer={(isCorrect) => {
          setSessionStats(prev => ({
            total: prev.total + 1,
            correct: prev.correct + (isCorrect ? 1 : 0)
          }));
        }}
      />
      <SessionStats stats={sessionStats} />
    </>
  );
}
```

---

### 3. Global Application State

State needed across many components.

**Tool:** Context API

**Examples:**
- User authentication state
- Current user data
- Theme/preferences
- Global loading state

```javascript
// AuthContext provides user state globally
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes />
      </Router>
    </AuthProvider>
  );
}
```

---

### 4. Server State

Data fetched from Supabase that represents server state.

**Tool:** Custom hooks with `useState` + `useEffect`

**Examples:**
- User vocabulary progress
- Chapter content
- Session history

```javascript
function useFlashcardData(userId) {
  const [words, setWords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchWords(userId).then(setWords);
  }, [userId]);
  
  return { words, isLoading };
}
```

---

## CONTEXT PROVIDERS

### AuthContext

Provides authentication state and user data globally.

```javascript
// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  const value = {
    user,
    loading,
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      return data;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Usage:**
```javascript
function Header() {
  const { user, signOut } = useAuth();
  
  return (
    <header>
      {user && (
        <>
          <span>Welcome, {user.email}</span>
          <button onClick={signOut}>Sign Out</button>
        </>
      )}
    </header>
  );
}
```

---

### ThemeContext (Future)

For theme/appearance settings.

```javascript
// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

---

## CUSTOM HOOKS

### Flashcard Data Hook

Fetches and manages flashcard data.

```javascript
// src/hooks/flashcard/useFlashcardData.js
import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export function useFlashcardData(userId, deckSize = 25) {
  const [words, setWords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchWords() {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .rpc('get_due_words_for_user', {
            p_user_id: userId,
            p_limit: deckSize
          });
        
        if (fetchError) throw fetchError;
        
        setWords(data);
      } catch (err) {
        console.error('Failed to fetch words:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (userId) {
      fetchWords();
    }
  }, [userId, deckSize]);
  
  const refetch = () => {
    // Trigger re-fetch by updating a dependency
    setIsLoading(true);
  };
  
  return {
    words,
    isLoading,
    error,
    refetch
  };
}
```

**Usage:**
```javascript
function FlashcardsPage() {
  const { user } = useAuth();
  const { words, isLoading, error, refetch } = useFlashcardData(user?.id);
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!words.length) return <EmptyState onRefetch={refetch} />;
  
  return <FlashcardDisplay words={words} />;
}
```

---

### Session Management Hook

Manages flashcard session state.

```javascript
// src/hooks/flashcard/useFlashcardSession.js
import { useState, useCallback } from 'react';

export function useFlashcardSession(words) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    dontKnow: 0,
    hard: 0,
    medium: 0,
    easy: 0
  });
  const [reviewedWords, setReviewedWords] = useState(new Set());
  
  const currentWord = words[currentIndex];
  const isComplete = currentIndex >= words.length;
  const progress = Math.round((currentIndex / words.length) * 100);
  
  const handleDifficulty = useCallback((difficulty) => {
    // Update stats
    setSessionStats(prev => ({
      total: prev.total + 1,
      [difficulty.replace('-', '')]: prev[difficulty.replace('-', '')] + 1
    }));
    
    // Mark as reviewed
    setReviewedWords(prev => new Set([...prev, currentWord.lemma_id]));
    
    // Move to next word
    setCurrentIndex(prev => prev + 1);
  }, [currentWord]);
  
  const reset = useCallback(() => {
    setCurrentIndex(0);
    setSessionStats({
      total: 0,
      dontKnow: 0,
      hard: 0,
      medium: 0,
      easy: 0
    });
    setReviewedWords(new Set());
  }, []);
  
  return {
    currentWord,
    currentIndex,
    progress,
    isComplete,
    sessionStats,
    handleDifficulty,
    reset
  };
}
```

**Usage:**
```javascript
function FlashcardSession({ words }) {
  const {
    currentWord,
    progress,
    isComplete,
    sessionStats,
    handleDifficulty
  } = useFlashcardSession(words);
  
  if (isComplete) {
    return <SessionComplete stats={sessionStats} />;
  }
  
  return (
    <>
      <ProgressBar progress={progress} />
      <FlashcardDisplay 
        word={currentWord}
        onDifficultySelect={handleDifficulty}
      />
    </>
  );
}
```

---

### Progress Tracking Hook

Tracks and updates user progress.

```javascript
// src/hooks/flashcard/useProgressTracking.js
import { useCallback } from 'react';
import { supabase } from '../../supabaseClient';

export function useProgressTracking(userId) {
  const updateProgress = useCallback(async (lemmaId, difficulty) => {
    const masteryChanges = {
      'dont-know': -5,
      'hard': 3,
      'medium': 6,
      'easy': 10
    };
    
    const healthBoosts = {
      'dont-know': 10,
      'hard': 30,
      'medium': 60,
      'easy': 100
    };
    
    try {
      const { error } = await supabase.rpc('update_word_progress', {
        p_user_id: userId,
        p_lemma_id: lemmaId,
        p_difficulty: difficulty,
        p_mastery_change: masteryChanges[difficulty],
        p_health_boost: healthBoosts[difficulty]
      });
      
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update progress:', err);
      throw err;
    }
  }, [userId]);
  
  return { updateProgress };
}
```

**Usage:**
```javascript
function FlashcardDisplay({ word, onComplete }) {
  const { user } = useAuth();
  const { updateProgress } = useProgressTracking(user?.id);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const handleDifficulty = async (difficulty) => {
    setIsUpdating(true);
    
    try {
      await updateProgress(word.lemma_id, difficulty);
      onComplete(difficulty);
    } catch (err) {
      console.error('Failed to update:', err);
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <DifficultyButtons 
      onSelect={handleDifficulty}
      disabled={isUpdating}
    />
  );
}
```

---

## DATA FETCHING

### Fetching Pattern

**Standard Pattern:**
```javascript
function useData(dependencies) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await fetchFromAPI();
        
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    
    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, dependencies);
  
  return { data, isLoading, error };
}
```

---

### Real-time Subscriptions

For live updates from Supabase:

```javascript
function useRealtimeProgress(userId, lemmaId) {
  const [progress, setProgress] = useState(null);
  
  useEffect(() => {
    // Initial fetch
    fetchProgress(userId, lemmaId).then(setProgress);
    
    // Subscribe to changes
    const subscription = supabase
      .channel(`progress:${lemmaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_lemma_progress',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setProgress(payload.new);
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [userId, lemmaId]);
  
  return progress;
}
```

---

## PERFORMANCE OPTIMIZATION

### Memoization

**useMemo for expensive calculations:**
```javascript
function FlashcardList({ words }) {
  const sortedWords = useMemo(() => {
    return [...words].sort((a, b) => b.priority - a.priority);
  }, [words]);
  
  return (
    <ul>
      {sortedWords.map(word => (
        <li key={word.id}>{word.lemma}</li>
      ))}
    </ul>
  );
}
```

**useCallback for stable function references:**
```javascript
function FlashcardDisplay({ word, onComplete }) {
  const handleDifficulty = useCallback((difficulty) => {
    updateProgress(word.id, difficulty);
    onComplete();
  }, [word.id, onComplete]);
  
  return (
    <DifficultyButtons onSelect={handleDifficulty} />
  );
}
```

---

### Context Optimization

**Split contexts to prevent unnecessary re-renders:**

```javascript
// ❌ Bad - everything re-renders when any value changes
const AppContext = createContext({
  user: null,
  theme: 'light',
  settings: {},
  // ... many more values
});

// ✅ Good - separate contexts
const UserContext = createContext(null);
const ThemeContext = createContext('light');
const SettingsContext = createContext({});
```

**Use context selectors (custom hook pattern):**
```javascript
function useUserEmail() {
  const { user } = useAuth();
  return user?.email;
}

// Component only re-renders when email changes
function Header() {
  const email = useUserEmail();
  return <span>{email}</span>;
}
```

---

### Reduce Re-renders

**React.memo for expensive components:**
```javascript
const FlashcardDisplay = React.memo(function FlashcardDisplay({ word }) {
  return (
    <div className="flashcard">
      {word.lemma}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if word changed
  return prevProps.word.id === nextProps.word.id;
});
```

---

## BEST PRACTICES

### 1. Collocate State

Keep state as close as possible to where it's used.

```javascript
// ✅ Good - state lives in parent component
function FlashcardsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  return (
    <FlashcardDisplay 
      index={currentIndex}
      onNext={() => setCurrentIndex(i => i + 1)}
    />
  );
}

// ❌ Bad - state lives in global context unnecessarily
function FlashcardsPage() {
  const { currentIndex, setCurrentIndex } = useAppContext();
  // ...
}
```

---

### 2. Avoid Prop Drilling

Use Context when passing props through many levels.

```javascript
// ❌ Bad - prop drilling
<App>
  <Page user={user}>
    <Section user={user}>
      <Component user={user}>
        <DeepComponent user={user} />
      </Component>
    </Section>
  </Page>
</App>

// ✅ Good - use Context
<AuthProvider value={user}>
  <App>
    <Page>
      <Section>
        <Component>
          <DeepComponent />  {/* uses useAuth() */}
        </Component>
      </Section>
    </Page>
  </App>
</AuthProvider>
```

---

### 3. Separate Data Fetching from UI

```javascript
// ✅ Good - data fetching in custom hook
function useChapterContent(chapterId) {
  const [content, setContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchChapter(chapterId).then(setContent);
  }, [chapterId]);
  
  return { content, isLoading };
}

function ChapterPage({ chapterId }) {
  const { content, isLoading } = useChapterContent(chapterId);
  
  if (isLoading) return <Loading />;
  return <ChapterDisplay content={content} />;
}
```

---

### 4. Handle Loading and Error States

```javascript
function DataDisplay() {
  const { data, isLoading, error } = useData();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <EmptyState />;
  
  return <Content data={data} />;
}
```

---

### 5. Avoid Stale Closures

```javascript
// ❌ Bad - stale closure
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);  // Always logs initial count
  }, 1000);
  return () => clearInterval(timer);
}, []);  // Missing dependency

// ✅ Good - include dependency
useEffect(() => {
  const timer = setInterval(() => {
    console.log(count);  // Logs current count
  }, 1000);
  return () => clearInterval(timer);
}, [count]);
```

---

## QUICK REFERENCE

### State Tool Decision Tree

```
Is state used in only one component?
  └─> YES: useState in that component

Is state shared between parent/child?
  └─> YES: Lift state to parent, pass as props

Is state needed across many unrelated components?
  └─> YES: Use Context

Is state fetched from server?
  └─> YES: Custom hook with useState + useEffect

Is component state complex (many related values)?
  └─> YES: useReducer instead of useState
```

---

### Hook Return Patterns

```javascript
// ✅ Good - object destructuring
function useData() {
  return { data, isLoading, error, refetch };
}
const { data, error } = useData();

// ❌ Bad - array destructuring
function useData() {
  return [data, isLoading, error, refetch];
}
const [data, loading, err, fetch] = useData();  // Easy to mix up order
```

---

## RELATED DOCUMENTS

- See **16_CODE_STYLE_GUIDE.md** for coding standards
- See **15_API_DOCUMENTATION.md** for Supabase queries
- See **04_LEARNING_ALGORITHM.md** for business logic

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF STATE MANAGEMENT**
