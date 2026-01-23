# SENTENCE FRAGMENT FLASHCARD SYSTEM SPECIFICATION

**Document Type:** Implementation Specification  
**Created:** January 22, 2026  
**For:** Claude Code Implementation  
**Status:** Ready for Development

---

## OVERVIEW

Create a parallel flashcard system for sentence fragments that bridges the gap between vocabulary knowledge and reading comprehension. Users progress from learning words/phrases → reviewing fragments → reading full text.

**The Learning Progression:**
```
Words (lemmas) → Phrases → Sentence Fragments → Full Reading Mode
```

**Why This Matters:**
Users may know individual words but struggle to comprehend full sentences. Fragments provide an intermediate step where users practice understanding text chunks in context before tackling full chapters.

---

## TWO MODES

### 1. Read Mode (Sequential)

**Purpose:** First exposure to chapter text, fragment by fragment, in order.

**Behavior:**
- Fragments presented in chapter order (by sentence_order, then fragment_order)
- User sees Spanish fragment, flips to see English translation
- Rates each fragment (Again, Hard, Good, Easy)
- Progress saved so user can resume later
- Completes when user has seen all fragments once (regardless of ratings)

**Chunking Logic:**
- Load ~10-15 fragments per mini-session
- If chunk ends mid-paragraph, extend to include remaining fragments until paragraph break
- Show progress: "Section 2 of 5 - Fragments 16-32"
- Save position when user exits

### 2. Review Mode (Spaced Repetition)

**Purpose:** Reinforce challenging fragments using simplified spaced repetition.

**Behavior:**
- Pulls fragments due for review (based on simplified FSRS intervals)
- Mixes fragments across all unlocked chapters
- Uses user's session size preference (15/25 cards)
- Same UI as Read Mode, just different fragment selection

**Simplified Intervals:**
| Rating | Next Review |
|--------|-------------|
| Again | Tomorrow (1 day) |
| Hard | 2-3 days |
| Good | 1 week |
| Good (2nd time) | 4 weeks |
| Easy | Graduated (no more reviews) |

---

## UNLOCK LOGIC

### Fragment Unlock
- **Trigger:** 95% of chapter vocabulary (words + phrases) introduced
- **Same threshold as next chapter unlock**
- When Chapter 1 hits 95%, both Chapter 2 AND Chapter 1 fragments become available

### Full Read Mode Unlock
- **Trigger:** User completes one full pass through all chapter fragments in Read Mode
- **"Complete" = seen all fragments once, regardless of rating**
- This unlocks the existing full chapter reading experience

---

## USER PRIORITY FLOW

Recommended study order (coach users toward this):

1. **Review due words/phrases** (always first priority)
2. **Review due fragments** (get into the text)
3. **Read new fragments** (continue chapter progress)
4. **Learn new words** (expand vocabulary last)

---

## FLASHCARD UI

### Card Layout (Same as Word/Phrase Cards)

**Front (Spanish):**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│         "Cuando yo tenía seis años"             │  ← Fragment in Spanish
│                                                 │
│                                                 │
│         Tap card to reveal translation          │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  "Cuando yo tenía seis años, vi una vez una     │  ← Full sentence, fragment BOLD
│   magnífica imagen en un libro..."              │
│                                                 │
│       Something wrong? Let us know.             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Back (English):**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│         "When I was six years old"              │  ← Fragment translation
│                                                 │
│                                                 │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  "When I was six years old, I once saw a        │  ← Full sentence translation
│   magnificent image in a book..."               │
│                                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │Again│ │Hard │ │Good │ │Easy │               │  ← Same 4 buttons
│  └─────┘ └─────┘ └─────┘ └─────┘               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key UI Elements

- **Fragment text:** Large, centered, primary focus
- **Full sentence context:** Below divider, smaller text
- **Fragment portion bolded** in full sentence display
- **Same flip animation** as word/phrase cards
- **Same 4 rating buttons** (Again, Hard, Good, Easy)
- **Feedback prompt** at bottom (reuse FeedbackPrompt component)

---

## DATABASE SCHEMA

### New Table: `user_fragment_progress`

```sql
CREATE TABLE user_fragment_progress (
  progress_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fragment_id UUID NOT NULL REFERENCES sentence_fragments(fragment_id) ON DELETE CASCADE,
  
  -- FSRS-like fields (simplified)
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning', 'graduated')),
  
  -- Review scheduling
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  
  -- Mastery tracking (matches word/phrase pattern)
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, fragment_id)
);

-- Indexes
CREATE INDEX idx_fragment_progress_user ON user_fragment_progress(user_id);
CREATE INDEX idx_fragment_progress_next_review ON user_fragment_progress(user_id, next_review_at);
CREATE INDEX idx_fragment_progress_state ON user_fragment_progress(user_id, state);

-- RLS
ALTER TABLE user_fragment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fragment progress" ON user_fragment_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### New Table: `user_chapter_fragment_progress`

Track read mode completion per chapter.

```sql
CREATE TABLE user_chapter_fragment_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  
  -- Read mode progress
  fragments_seen INTEGER DEFAULT 0,
  total_fragments INTEGER NOT NULL,
  last_fragment_order INTEGER DEFAULT 0,  -- For resume functionality
  is_read_complete BOOLEAN DEFAULT FALSE,  -- One full pass done
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, chapter_id)
);

-- Indexes
CREATE INDEX idx_chapter_fragment_progress_user ON user_chapter_fragment_progress(user_id);
CREATE INDEX idx_chapter_fragment_progress_complete ON user_chapter_fragment_progress(user_id, is_read_complete);

-- RLS
ALTER TABLE user_chapter_fragment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chapter fragment progress" ON user_chapter_fragment_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## DASHBOARD INTEGRATION

### Book Dashboard Changes

**Add new button row (below Review/Learn New):**
```
┌──────────────────────────────────────────────────────────────┐
│  [🔄 Review (117)]      [✨ Learn New (77)]                  │  ← Existing
├──────────────────────────────────────────────────────────────┤
│  [📖 Fragments Due (23)]                                     │  ← NEW: Shows when fragments due > 0
├──────────────────────────────────────────────────────────────┤
│  [📚 Continue Reading — Chapter 9]                           │  ← Existing (or modify)
└──────────────────────────────────────────────────────────────┘
```

### Chapter Card Changes

**Current chapter card shows:**
- Progress bar (words/phrases)
- Review button or Continue button

**Add below existing progress bar:**
- Second progress bar for fragments (different color scheme)
- Fragment status text: "Fragments: 45/120" or "Fragments: Complete ✓"

**Button logic per chapter:**
```
If chapter vocabulary < 95%:
  → Show: [Continue] or [Review] for words/phrases
  → Fragments: Locked (show lock icon or "Complete vocabulary to unlock")

If chapter vocabulary >= 95% AND fragments not started:
  → Show: [Start Reading Fragments]
  
If chapter vocabulary >= 95% AND fragments in progress:
  → Show: [Resume Fragments (45/120)]
  
If fragments complete AND read mode not unlocked:
  → Show: [Read Chapter] (unlocks full read mode)
  
If read mode unlocked:
  → Show: [Read Chapter] (links to full reading experience)
```

### Progress Bar Colors (Fragments)

Use warm gold/coral tones to differentiate from word progress (blue):
```
Not Seen:  #64748b (gray)
Learning:  #d4a574 (warm gold - main accent)
Familiar:  #c4875a (deeper coral)
Mastered:  #7a5c1a (rich deep gold)
```

---

## SESSION BUILDING LOGIC

### Read Mode Session Builder

```javascript
async function buildFragmentReadSession(userId, chapterId, targetSize = 15) {
  // 1. Get user's progress for this chapter
  const progress = await getChapterFragmentProgress(userId, chapterId);
  
  // 2. Get next unseen fragments starting from last position
  let fragments = await getFragmentsFromPosition(
    chapterId, 
    progress.last_fragment_order,
    targetSize
  );
  
  // 3. Extend to paragraph boundary if needed
  const lastFragment = fragments[fragments.length - 1];
  if (!lastFragment.is_paragraph_end) {
    const remaining = await getFragmentsUntilParagraphEnd(
      chapterId,
      lastFragment.sentence_order,
      lastFragment.fragment_order
    );
    fragments = [...fragments, ...remaining];
  }
  
  // 4. Return session with metadata
  return {
    mode: 'read',
    chapterId,
    fragments,
    totalInChapter: progress.total_fragments,
    currentPosition: progress.last_fragment_order,
    sectionInfo: calculateSectionInfo(fragments, progress)
  };
}
```

### Review Mode Session Builder

```javascript
async function buildFragmentReviewSession(userId, bookId, sessionSize = 15) {
  // 1. Get all fragments due for review across unlocked chapters
  const dueFragments = await getDueFragments(userId, bookId);
  
  // 2. Sort by priority (most overdue first)
  dueFragments.sort((a, b) => a.next_review_at - b.next_review_at);
  
  // 3. Take session size
  const sessionFragments = dueFragments.slice(0, sessionSize);
  
  // 4. Return session
  return {
    mode: 'review',
    fragments: sessionFragments,
    totalDue: dueFragments.length
  };
}
```

### Interval Calculation (Simplified FSRS)

```javascript
function calculateNextReview(rating, currentState, reps) {
  const now = new Date();
  
  switch (rating) {
    case 'again':
      return {
        nextReview: addDays(now, 1),
        state: 'relearning'
      };
    
    case 'hard':
      return {
        nextReview: addDays(now, 2 + Math.random()), // 2-3 days
        state: 'review'
      };
    
    case 'good':
      if (reps === 0) {
        return {
          nextReview: addDays(now, 7),
          state: 'review'
        };
      } else {
        return {
          nextReview: addDays(now, 28), // 4 weeks on second "good"
          state: 'review'
        };
      }
    
    case 'easy':
      return {
        nextReview: null, // No more reviews
        state: 'graduated'
      };
  }
}
```

---

## FRAGMENT COUNT QUERIES

### Fragments Due (for dashboard)

```sql
SELECT COUNT(*) as due_count
FROM user_fragment_progress ufp
JOIN sentence_fragments sf ON ufp.fragment_id = sf.fragment_id
JOIN sentences s ON sf.sentence_id = s.sentence_id
JOIN chapters c ON s.chapter_id = c.chapter_id
WHERE ufp.user_id = :user_id
  AND c.book_id = :book_id
  AND ufp.next_review_at <= NOW()
  AND ufp.state != 'graduated';
```

### Chapter Fragment Progress

```sql
SELECT 
  c.chapter_id,
  c.chapter_number,
  COUNT(sf.fragment_id) as total_fragments,
  COUNT(ufp.fragment_id) FILTER (WHERE ufp.state = 'graduated') as mastered,
  COUNT(ufp.fragment_id) FILTER (WHERE ufp.state = 'review') as familiar,
  COUNT(ufp.fragment_id) FILTER (WHERE ufp.state IN ('learning', 'relearning')) as learning,
  ucfp.is_read_complete,
  ucfp.last_fragment_order
FROM chapters c
JOIN sentences s ON c.chapter_id = s.chapter_id
JOIN sentence_fragments sf ON s.sentence_id = sf.sentence_id
LEFT JOIN user_fragment_progress ufp ON sf.fragment_id = ufp.fragment_id AND ufp.user_id = :user_id
LEFT JOIN user_chapter_fragment_progress ucfp ON c.chapter_id = ucfp.chapter_id AND ucfp.user_id = :user_id
WHERE c.book_id = :book_id
GROUP BY c.chapter_id, c.chapter_number, ucfp.is_read_complete, ucfp.last_fragment_order
ORDER BY c.chapter_number;
```

---

## FILE STRUCTURE

```
src/
  components/
    flashcard/
      FragmentCard.jsx           # Fragment-specific card display
      FragmentSession.jsx        # Session wrapper for fragments
  pages/
    FragmentFlashcards.jsx       # Main fragment flashcard page
  hooks/
    flashcard/
      useFragmentSession.js      # Fragment session state management
  services/
    fragmentSessionBuilder.js    # Session building logic
    
supabase/
  migrations/
    YYYYMMDD_fragment_progress.sql
```

---

## IMPLEMENTATION PHASES

### Phase 1: Database
- [ ] Create `user_fragment_progress` table
- [ ] Create `user_chapter_fragment_progress` table
- [ ] Add indexes and RLS policies
- [ ] Create helper RPC functions for counts/progress

### Phase 2: Core Flashcard UI
- [ ] Create `FragmentCard.jsx` (reuse existing card styling)
- [ ] Create `FragmentSession.jsx` (session wrapper)
- [ ] Create `useFragmentSession.js` hook
- [ ] Implement flip, rating, and progression logic

### Phase 3: Session Building
- [ ] Implement Read Mode session builder (with chunking)
- [ ] Implement Review Mode session builder
- [ ] Implement simplified interval calculation
- [ ] Handle session save/resume

### Phase 4: Dashboard Integration
- [ ] Add "Fragments Due" button to book dashboard
- [ ] Add fragment progress bar to chapter cards
- [ ] Update chapter button logic (locked → start → resume → complete)
- [ ] Show fragment counts in relevant places

### Phase 5: Unlock Logic
- [ ] Check vocabulary threshold before showing fragment options
- [ ] Track read mode completion
- [ ] Gate full reading mode behind fragment completion

### Phase 6: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Animations matching existing flashcards
- [ ] Responsive design
- [ ] Update changelog and documentation

---

## SUCCESS CRITERIA

The feature is complete when:

- [ ] Users can do fragment Read Mode (sequential, chapter order)
- [ ] Users can do fragment Review Mode (spaced repetition, mixed chapters)
- [ ] Same 4-button rating system as words/phrases
- [ ] Fragments unlock at 95% chapter vocabulary
- [ ] Full read mode unlocks after one fragment pass
- [ ] Progress saves and resumes correctly
- [ ] Dashboard shows fragments due count
- [ ] Chapter cards show fragment progress bars
- [ ] Chunking respects paragraph boundaries
- [ ] Simplified FSRS intervals work correctly

---

## FUTURE ENHANCEMENTS

- Verb conjugation flashcards (another parallel system)
- Fragment difficulty analysis (auto-flag complex fragments)
- Audio playback for fragments
- Highlight learned words within fragments

---

**END OF SPECIFICATION**
