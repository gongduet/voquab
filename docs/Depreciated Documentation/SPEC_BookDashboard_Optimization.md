# BookDashboard Optimization Spec

**Status:** ✅ IMPLEMENTED (December 29, 2025)

> All tasks completed. RPC functions deployed, progressService created, BookDashboard rewritten.
> See `docs/99_LIVING_CHANGELOG.md` for full details.

---

## Problem

`BookDashboard.jsx` throws **431 Request Header Fields Too Large** because it queries `user_lemma_progress` with 1600+ lemma UUIDs in an `.in()` clause, exceeding HTTP header limits.

**Bad code (lines ~85-90):**
```javascript
const { data } = await supabase
  .from('user_lemma_progress')
  .select('lemma_id, mastery_level, due_date, reps')
  .eq('user_id', user.id)
  .in('lemma_id', bookLemmaIds)  // 1600+ UUIDs = 431 error
```

## Solution

Replace direct queries with 2 RPC calls (one existing, one new) and rebuild UI using existing dashboard components.

---

## Architecture

```
BookDashboard.jsx
├── DashboardHeader (reuse from dashboard)
├── Book Title Section (new, simple div)
├── HeroStats (reuse - shows book-level mastery ring)
├── ChapterCarousel (reuse - chapter tiles with expand/collapse)
└── [REMOVE: ActivityHeatmap, ReviewForecast, CategoryPills]
```

---

## Task 1: New RPC Function

Create migration file: `supabase/migrations/20251229_book_chapters_progress.sql`

```sql
-- Get per-chapter progress for a book
CREATE OR REPLACE FUNCTION get_book_chapters_progress(p_user_id UUID, p_book_id UUID)
RETURNS TABLE (
  chapter_number INTEGER,
  title TEXT,
  total_lemmas INTEGER,
  mastered INTEGER,
  familiar INTEGER,
  learning INTEGER,
  not_seen INTEGER,
  is_unlocked BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked_chapters INTEGER[];
BEGIN
  -- First, calculate which chapters are unlocked (95% threshold)
  -- A chapter is unlocked if ALL previous chapters have 95%+ words with reps >= 1
  
  WITH chapter_completion AS (
    SELECT 
      bc.chapter_number,
      COUNT(DISTINCT l.lemma_id) AS total,
      COUNT(DISTINCT CASE 
        WHEN ulp.reps >= 1 THEN l.lemma_id 
      END) AS introduced
    FROM book_chapters bc
    JOIN sentences s ON s.chapter_id = bc.chapter_id
    JOIN words w ON w.sentence_id = s.sentence_id
    JOIN lemmas l ON l.lemma_id = w.lemma_id
    LEFT JOIN user_lemma_progress ulp ON ulp.lemma_id = l.lemma_id AND ulp.user_id = p_user_id
    WHERE bc.book_id = p_book_id
      AND l.is_stop_word = FALSE
    GROUP BY bc.chapter_number
  ),
  unlocked_calc AS (
    SELECT 
      chapter_number,
      CASE 
        WHEN chapter_number = 1 THEN TRUE
        WHEN LAG(introduced::FLOAT / NULLIF(total, 0), 1) OVER (ORDER BY chapter_number) >= 0.95 THEN TRUE
        ELSE FALSE
      END AS is_unlocked
    FROM chapter_completion
  )
  SELECT ARRAY_AGG(chapter_number) INTO v_unlocked_chapters
  FROM unlocked_calc
  WHERE is_unlocked = TRUE;

  -- Return chapter-level stats
  RETURN QUERY
  SELECT 
    bc.chapter_number::INTEGER,
    bc.title::TEXT,
    COUNT(DISTINCT l.lemma_id)::INTEGER AS total_lemmas,
    COUNT(DISTINCT CASE 
      WHEN ulp.state = 2 AND ulp.stability >= 21 THEN l.lemma_id 
    END)::INTEGER AS mastered,
    COUNT(DISTINCT CASE 
      WHEN ulp.state = 2 AND ulp.stability >= 7 AND ulp.stability < 21 THEN l.lemma_id 
    END)::INTEGER AS familiar,
    COUNT(DISTINCT CASE 
      WHEN ulp.reps >= 1 
        AND NOT (ulp.state = 2 AND ulp.stability >= 7) THEN l.lemma_id 
    END)::INTEGER AS learning,
    COUNT(DISTINCT CASE 
      WHEN ulp.lemma_id IS NULL OR ulp.reps = 0 THEN l.lemma_id 
    END)::INTEGER AS not_seen,
    (bc.chapter_number = ANY(v_unlocked_chapters))::BOOLEAN AS is_unlocked
  FROM book_chapters bc
  JOIN sentences s ON s.chapter_id = bc.chapter_id
  JOIN words w ON w.sentence_id = s.sentence_id
  JOIN lemmas l ON l.lemma_id = w.lemma_id
  LEFT JOIN user_lemma_progress ulp ON ulp.lemma_id = l.lemma_id AND ulp.user_id = p_user_id
  WHERE bc.book_id = p_book_id
    AND l.is_stop_word = FALSE
  GROUP BY bc.chapter_number, bc.title
  ORDER BY bc.chapter_number;
END;
$$;
```

**Deploy with:** `supabase db push` or apply via dashboard SQL editor.

---

## Task 2: Update progressService.js

Add this function to `src/services/progressService.js`:

```javascript
export async function getBookChaptersProgress(userId, bookId) {
  try {
    const { data, error } = await supabase.rpc('get_book_chapters_progress', {
      p_user_id: userId,
      p_book_id: bookId
    })
    if (error) throw error
    return data.map(ch => ({
      chapterNumber: ch.chapter_number,
      title: ch.title,
      totalLemmas: ch.total_lemmas,
      mastered: ch.mastered,
      familiar: ch.familiar,
      learning: ch.learning,
      notSeen: ch.not_seen,
      isUnlocked: ch.is_unlocked
    }))
  } catch (err) {
    console.error('getBookChaptersProgress failed:', err)
    return []
  }
}
```

---

## Task 3: Rewrite BookDashboard.jsx

### Imports
```javascript
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getBookProgress, getBookChaptersProgress } from '../services/progressService'
import { DashboardHeader, HeroStats, ChapterCarousel } from '../components/dashboard'
```

### Data Loading
```javascript
const { bookId } = useParams()
const { user } = useAuth()
const [loading, setLoading] = useState(true)
const [bookMeta, setBookMeta] = useState(null)
const [bookProgress, setBookProgress] = useState(null)
const [chapters, setChapters] = useState([])
const [streak, setStreak] = useState(0)

useEffect(() => {
  if (!user?.id || !bookId) return
  
  async function fetchData() {
    setLoading(true)
    
    // Parallel fetch: book metadata, progress, chapters, streak
    const [metaResult, progress, chaptersData, streakResult] = await Promise.all([
      supabase
        .from('books')
        .select('title, author')
        .eq('book_id', bookId)
        .single(),
      getBookProgress(user.id, bookId),
      getBookChaptersProgress(user.id, bookId),
      supabase
        .from('user_settings')
        .select('current_streak')
        .eq('user_id', user.id)
        .single()
    ])
    
    setBookMeta(metaResult.data)
    setBookProgress(progress)
    setChapters(chaptersData)
    setStreak(streakResult.data?.current_streak || 0)
    setLoading(false)
  }
  
  fetchData()
}, [user?.id, bookId])
```

### Transform chapters for ChapterCarousel
```javascript
const carouselChapters = chapters.map((ch, idx) => ({
  chapter_number: ch.chapterNumber,
  title: ch.title,
  total_lemmas: ch.totalLemmas,
  introduced: ch.mastered + ch.familiar + ch.learning,
  mastered: ch.mastered,
  familiar: ch.familiar,
  learning: ch.learning,
  notSeen: ch.notSeen,
  isUnlocked: ch.isUnlocked,
  isNextToUnlock: !ch.isUnlocked && (idx === 0 || chapters[idx - 1]?.isUnlocked)
}))

// Find current chapter (first unlocked that's not complete)
const currentChapterIndex = carouselChapters.findIndex(ch => 
  ch.isUnlocked && (ch.introduced / ch.total_lemmas) < 0.95
) || 0
```

### JSX Structure
```jsx
return (
  <div className="min-h-screen bg-neutral-50">
    <DashboardHeader 
      streak={streak}
      username={user?.email?.split('@')[0] || ''}
      loading={loading}
    />
    
    <main className="max-w-lg mx-auto pb-8">
      {/* Book Title Section */}
      <div className="px-4 pt-6 pb-2 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">
          {bookMeta?.title || 'Loading...'}
        </h1>
        {bookMeta?.author && (
          <p className="text-sm text-neutral-500 mt-1">{bookMeta.author}</p>
        )}
      </div>
      
      {/* Hero Stats - Book Level */}
      <HeroStats
        masteredCount={bookProgress?.mastered || 0}
        familiarCount={bookProgress?.familiar || 0}
        learningCount={bookProgress?.learning || 0}
        introducedCount={
          (bookProgress?.mastered || 0) + 
          (bookProgress?.familiar || 0) + 
          (bookProgress?.learning || 0)
        }
        totalCount={bookProgress?.totalVocab || 1}
        loading={loading}
      />
      
      {/* Chapter Carousel */}
      <div className="mt-6">
        <ChapterCarousel
          chapters={carouselChapters}
          totalChapters={bookProgress?.totalChapters || 27}
          currentChapterIndex={currentChapterIndex}
          loading={loading}
        />
      </div>
    </main>
  </div>
)
```

---

## Files Summary

| File | Action |
|------|--------|
| `supabase/migrations/20251229_book_chapters_progress.sql` | CREATE (new RPC) |
| `src/services/progressService.js` | ADD `getBookChaptersProgress()` |
| `src/pages/BookDashboard.jsx` | REWRITE (complete replacement) |

## Files to Reference (do not modify)

| File | Steal From |
|------|------------|
| `src/components/dashboard/DashboardHeader.jsx` | Import and use directly |
| `src/components/dashboard/HeroStats.jsx` | Import and use directly |
| `src/components/dashboard/ChapterCarousel.jsx` | Import and use directly |
| `src/pages/Dashboard.jsx` | Layout patterns, loading states |

---

## Testing Checklist

1. [x] No 431 errors in console
2. [x] HeroStats shows book-level mastery (not global)
3. [x] ChapterCarousel shows 4 chapters initially (centered around current)
4. [x] Expand/collapse shows all 27 chapters
5. [x] Locked chapters appear muted gray
6. [x] Current chapter has ring highlight
7. [x] Completed chapters show checkmark
8. [x] Chapter tiles navigate correctly on click
9. [x] Header streak matches main dashboard
10. [ ] Mobile responsive (2-column grid works) - needs manual verification

---

## FSRS Mastery Thresholds (must match exactly)

These are used in both RPC functions - keep consistent:

| Level | Criteria |
|-------|----------|
| Mastered | `state = 2 AND stability >= 21` |
| Familiar | `state = 2 AND stability >= 7 AND stability < 21` |
| Learning | `reps >= 1 AND NOT (state = 2 AND stability >= 7)` |
| Not Seen | `progress IS NULL OR reps = 0` |
