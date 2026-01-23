# CLAUDE CODE PROMPT: Sentence Fragment Flashcard System

## Task

Build a parallel flashcard system for sentence fragments that bridges vocabulary learning and reading comprehension. This is a major feature with two modes: Read Mode (sequential chapter reading) and Review Mode (spaced repetition of challenging fragments).

## Context

- Users learn words → phrases → **fragments** → full reading
- Fragments unlock when 95% of chapter vocabulary is introduced
- Full read mode unlocks after completing one pass through all chapter fragments
- Same UI/UX as existing word/phrase flashcards (4 buttons, flip animation, etc.)

## Critical: Reuse Existing Patterns

Before building, examine:
1. `src/pages/Flashcards.jsx` - existing flashcard page
2. `src/components/Flashcard.jsx` or similar - card component
3. `src/hooks/flashcard/useFlashcardSession.js` - session management
4. `src/services/sessionBuilder.js` - how sessions are built

**Goal:** Reuse as much existing code as possible. Fragment cards should look identical to word/phrase cards, just with different content.

---

## Phase 1: Database

Create migration `supabase/migrations/YYYYMMDD_fragment_progress.sql`:

```sql
-- User progress on individual fragments
CREATE TABLE user_fragment_progress (
  progress_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fragment_id UUID NOT NULL REFERENCES sentence_fragments(fragment_id) ON DELETE CASCADE,
  
  -- Simplified FSRS fields
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning', 'graduated')),
  
  -- Review scheduling
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  
  -- Mastery tracking
  mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 100),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, fragment_id)
);

-- Chapter-level fragment progress (for read mode tracking)
CREATE TABLE user_chapter_fragment_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  
  fragments_seen INTEGER DEFAULT 0,
  total_fragments INTEGER NOT NULL,
  last_fragment_order INTEGER DEFAULT 0,
  is_read_complete BOOLEAN DEFAULT FALSE,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, chapter_id)
);

-- Add indexes
CREATE INDEX idx_fragment_progress_user ON user_fragment_progress(user_id);
CREATE INDEX idx_fragment_progress_next_review ON user_fragment_progress(user_id, next_review_at);
CREATE INDEX idx_fragment_progress_state ON user_fragment_progress(user_id, state);
CREATE INDEX idx_chapter_fragment_progress_user ON user_chapter_fragment_progress(user_id);

-- RLS policies
ALTER TABLE user_fragment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chapter_fragment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fragment progress" ON user_fragment_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own chapter fragment progress" ON user_chapter_fragment_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Phase 2: Fragment Card Component

Create `src/components/flashcard/FragmentCard.jsx`:

**Card Front (Spanish):**
- Fragment text (large, centered)
- "Tap card to reveal translation"
- Divider line
- Full sentence with fragment portion **bolded**
- Feedback prompt at bottom

**Card Back (English):**
- Fragment translation (large, centered)
- Divider line
- Full sentence translation
- 4 rating buttons (Again, Hard, Good, Easy)

**Props needed:**
```javascript
{
  fragment: {
    fragment_id,
    fragment_text,        // Spanish fragment
    fragment_translation, // English fragment
    sentence_text,        // Full Spanish sentence
    sentence_translation, // Full English sentence
    fragment_start,       // Position in sentence for bolding
    fragment_end
  },
  onRate: (rating) => {},
  isFlipped: boolean,
  onFlip: () => {}
}
```

**Reuse:** Copy styling from existing Flashcard component. Same animations, same button styles.

---

## Phase 3: Session Management

### Read Mode Session Builder

Create or extend `src/services/fragmentSessionBuilder.js`:

```javascript
async function buildFragmentReadSession(userId, chapterId, targetSize = 15) {
  // 1. Get or create chapter fragment progress record
  // 2. Get fragments starting from last_fragment_order
  // 3. If ends mid-paragraph, extend to paragraph end
  // 4. Return session object
}
```

**Chunking Logic:**
- Target ~15 fragments
- Check if last fragment's sentence has `is_paragraph_start = false` on next sentence
- If so, keep adding fragments until next paragraph break
- Use sentence.is_paragraph_start to detect breaks

### Review Mode Session Builder

```javascript
async function buildFragmentReviewSession(userId, bookId, sessionSize) {
  // 1. Get all fragments where next_review_at <= now AND state != 'graduated'
  // 2. Sort by most overdue first
  // 3. Take sessionSize fragments
  // 4. Mix from all unlocked chapters
}
```

### Simplified Interval Logic

```javascript
function calculateFragmentNextReview(rating, reps) {
  const now = new Date();
  
  if (rating === 'again') {
    return { nextReview: addDays(now, 1), state: 'relearning' };
  }
  if (rating === 'hard') {
    return { nextReview: addDays(now, 2.5), state: 'review' };
  }
  if (rating === 'good') {
    return { 
      nextReview: addDays(now, reps === 0 ? 7 : 28), 
      state: 'review' 
    };
  }
  if (rating === 'easy') {
    return { nextReview: null, state: 'graduated' };
  }
}
```

---

## Phase 4: Fragment Flashcard Page

Create `src/pages/FragmentFlashcards.jsx`:

**URL patterns:**
- `/fragments/read/:chapterId` - Read mode for specific chapter
- `/fragments/review/:bookId` - Review mode for book

**Features:**
- Reuse existing flashcard page layout
- Show mode indicator (Read Mode / Review Mode)
- Show progress: "Fragment 12 of 45" or "Section 2 of 5"
- Handle session completion
- Save progress on exit
- End-of-session summary

**Session Flow:**
1. Load session (read or review)
2. Show fragments one at a time
3. On rate: update progress, calculate next review, advance
4. On complete: show summary, update chapter progress
5. If read mode complete: mark `is_read_complete = true`

---

## Phase 5: Dashboard Integration

### Book Dashboard (`src/pages/BookDashboard.jsx` or similar)

**Add new button** below Review/Learn New:
```jsx
{fragmentsDue > 0 && (
  <Button onClick={() => navigate(`/fragments/review/${bookId}`)}>
    📖 Fragments Due ({fragmentsDue})
  </Button>
)}
```

### Chapter Cards

**Add fragment progress bar** below existing word progress bar:
- Use warm gold colors: `#64748b`, `#d4a574`, `#c4875a`, `#7a5c1a`
- Show: "Fragments: 45/120" or "✓ Complete"

**Update button logic:**
```jsx
// Determine what to show
if (vocabularyProgress < 0.95) {
  // Fragments locked
  showLockIcon();
} else if (!fragmentsStarted) {
  showButton("Start Reading Fragments", `/fragments/read/${chapterId}`);
} else if (!fragmentsComplete) {
  showButton(`Resume Fragments (${seen}/${total})`, `/fragments/read/${chapterId}`);
} else {
  showButton("Read Chapter", `/read/${chapterId}`);
}
```

---

## Phase 6: Queries Needed

### Get Fragments Due Count
```sql
SELECT COUNT(*) 
FROM user_fragment_progress ufp
JOIN sentence_fragments sf ON ufp.fragment_id = sf.fragment_id
JOIN sentences s ON sf.sentence_id = s.sentence_id
JOIN chapters c ON s.chapter_id = c.chapter_id
WHERE ufp.user_id = $1
  AND c.book_id = $2
  AND ufp.next_review_at <= NOW()
  AND ufp.state != 'graduated';
```

### Get Chapter Fragment Stats
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE ufp.state = 'graduated') as mastered,
  COUNT(*) FILTER (WHERE ufp.state = 'review') as familiar,
  COUNT(*) FILTER (WHERE ufp.state IN ('learning', 'relearning')) as learning
FROM sentence_fragments sf
JOIN sentences s ON sf.sentence_id = s.sentence_id
LEFT JOIN user_fragment_progress ufp ON sf.fragment_id = ufp.fragment_id AND ufp.user_id = $1
WHERE s.chapter_id = $2;
```

### Get Fragments for Read Session
```sql
SELECT 
  sf.*,
  s.sentence_text,
  s.sentence_translation,
  s.sentence_order,
  s.is_paragraph_start
FROM sentence_fragments sf
JOIN sentences s ON sf.sentence_id = s.sentence_id
WHERE s.chapter_id = $1
  AND (s.sentence_order > $2 OR (s.sentence_order = $2 AND sf.fragment_order > $3))
ORDER BY s.sentence_order, sf.fragment_order
LIMIT $4;
```

---

## Routing

Add to `src/App.jsx`:
```jsx
<Route path="/fragments/read/:chapterId" element={<ProtectedRoute><FragmentFlashcards mode="read" /></ProtectedRoute>} />
<Route path="/fragments/review/:bookId" element={<ProtectedRoute><FragmentFlashcards mode="review" /></ProtectedRoute>} />
```

---

## Implementation Order

1. **Database first** - Run migration, verify tables created
2. **FragmentCard component** - Get the card looking right
3. **Session builders** - Read mode, then review mode
4. **FragmentFlashcards page** - Wire it all together
5. **Dashboard integration** - Add buttons and progress bars
6. **Testing** - Test both modes, progress saving, unlock logic
7. **Polish** - Animations, loading states, error handling

---

## Key Questions to Answer Before Starting

1. Where is the existing flashcard card component?
2. How does the existing session builder work?
3. What's the structure of `sentence_fragments` table?
4. How are chapters currently displaying progress?
5. Is there a `is_paragraph_start` field on sentences?

---

## Deliverables

1. Database migration applied
2. FragmentCard component matching existing card style
3. Fragment session builders (read + review)
4. FragmentFlashcards page working
5. Dashboard showing fragments due
6. Chapter cards showing fragment progress
7. Unlock logic implemented
8. Changelog updated

---

**Start by exploring the existing flashcard code to understand patterns, then implement phase by phase. Report back after each phase.**
