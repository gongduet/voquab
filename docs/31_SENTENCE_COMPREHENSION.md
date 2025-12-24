# 31_SENTENCE_COMPREHENSION.md

**Last Updated:** December 23, 2025
**Status:** ✅ Implemented
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [The Comprehension Gap](#the-comprehension-gap)
3. [Two Reading Experiences](#two-reading-experiences)
4. [Fragment Design Philosophy](#fragment-design-philosophy)
5. [Reading Mode Specification](#reading-mode-specification)
6. [Sentence Review Mode](#sentence-review-mode)
7. [Unlock Logic](#unlock-logic)
8. [Database Schema](#database-schema)
9. [Fragment Generation Pipeline](#fragment-generation-pipeline)
10. [UI Components](#ui-components)
11. [FSRS Integration](#fsrs-integration)
12. [Implementation Phases](#implementation-phases)

---

## OVERVIEW

Sentence Comprehension is the bridge between vocabulary knowledge and actual reading ability. Users who have learned individual words and phrases need a structured way to practice combining those elements into understood sentences.

**The Core Insight:** Knowing every word in a sentence doesn't guarantee understanding the sentence. Reading comprehension requires synthesizing vocabulary, grammar, word order, and context into coherent meaning.

**The Solution:** Two complementary experiences:
1. **Reading Mode** - Sequential chapter reading with fragment-by-fragment comprehension checks
2. **Sentence Review** - FSRS-scheduled review of sentences that need reinforcement

---

## THE COMPREHENSION GAP

### The Hierarchy of Language Mastery

```
Level 4: CHAPTER COMPREHENSION
         "What happened in this chapter?"
         ↑
Level 3: SENTENCE COMPREHENSION  ← THIS DOCUMENT
         "What does this complete sentence mean?"
         ↑
Level 2: PHRASE RECOGNITION
         "personas mayores" = grown-ups
         ↑
Level 1: WORD RECOGNITION
         "tenía" = I had/was
```

Voquab has solid Level 1-2 coverage through flashcards. This document addresses Level 3, which naturally builds toward Level 4.

### Why Sentences Are Hard (Even When You Know The Words)

1. **Word order differences** - Spanish syntax differs from English
2. **Implied subjects** - "Vivía en una planeta" - who lived?
3. **Idiomatic constructions** - Patterns that aren't literal
4. **Grammatical complexity** - Tenses, moods, pronouns
5. **Cognitive load** - Holding pieces in working memory while parsing

---

## TWO READING EXPERIENCES

### Reading Mode

**Purpose:** Read the chapter sequentially, sentence by sentence

**Characteristics:**
- Linear progression through chapter
- Can't skip ahead
- Sentences appear as you complete them
- Position saved for resume
- Chapter completion unlocks next chapter

**When Available:** After 100% of chapter's lemmas and phrases are introduced

### Sentence Review Mode

**Purpose:** Reinforce comprehension of sentences via spaced repetition

**Characteristics:**
- FSRS-scheduled individual sentences
- Sentences from any completed chapter
- Flashcard-style sessions
- Prioritizes weak sentences

**When Available:** After completing a chapter in Reading Mode

---

## FRAGMENT DESIGN PHILOSOPHY

### What Makes a Good Fragment

Fragments are meaningful chunks of a sentence - larger than phrases, smaller than full sentences. Each fragment must:

1. **Translate sensibly in isolation** - The English meaning should be clear without context
2. **Follow natural reading rhythm** - Break at clause boundaries, not mid-phrase
3. **Be substantial** - Target 4-10 words (prefer 5-8)
4. **Be few** - Target 2-4 fragments per sentence

### Fragment vs. Phrase

| Aspect | Phrase (Flashcards) | Fragment (Reading) |
|--------|--------------------|--------------------|
| Length | 2-4 words | 4-10 words |
| Purpose | Idiomatic expressions | Reading comprehension chunks |
| Example | "dar miedo" | "vi una magnífica lámina" |
| Quantity | ~20-40 per chapter | ~80-120 per chapter |

### Example: Good Fragmentation

**Sentence:**
```
"Cuando yo tenía seis años, vi una magnífica lámina en un libro sobre la selva virgen que se titulaba Historias Vividas."
```

**Good Fragments (4):**
```
1. "Cuando yo tenía seis años," → "When I was six years old,"
2. "vi una magnífica lámina" → "I saw a magnificent illustration"
3. "en un libro sobre la selva virgen" → "in a book about the virgin forest"
4. "que se titulaba Historias Vividas." → "called 'True Stories.'"
```

**Bad Fragments (too granular):**
```
1. "Cuando yo tenía" → "When I had" (incomplete thought)
2. "seis años," → "six years," (depends on previous)
3. "vi" → "I saw" (too short)
...
```

### Edge Cases

| Sentence Type | Approach |
|---------------|----------|
| Very short (< 5 words) | Single fragment, no splitting |
| Dialogue ("Sí," dijo el principito.) | Keep as 1-2 fragments max |
| Very long (20+ words) | Allow up to 5-6 fragments |
| Contains quoted text | Keep quotes intact within fragment |

---

## READING MODE SPECIFICATION

### ✅ Implementation Status

Reading Mode is fully implemented with the following differences from original spec:

| Original Design | Actual Implementation |
|-----------------|----------------------|
| Three-button interaction (Need Help/Hard/Got It) | Single check button with tap-to-peek |
| Translation reveal modal | Inline peek tooltip on fragment tap |
| Sentence completion screen | Seamless transition to next sentence |
| Full book loading | Chapter-only view for performance |

### User Flow (As Implemented)

1. User opens Reading Mode (via `/reading` route)
2. Session loads current chapter's completed sentences + current position
3. Completed sentences appear as flowing paragraphs (grouped by `is_paragraph_start`)
4. Current sentence shows with fragments: completed (normal), active (bold), upcoming (blurred)
5. User taps active fragment to peek translation (records as "peeked")
6. User taps green check button to confirm understanding
7. If peeked: score = 0.7, else score = 1.0
8. Sentence completes → added to completed list → next sentence loads
9. At chapter boundary: blurred "Capítulo II" preview appears
10. Chapter complete: "Fin" screen with return to dashboard

### UI Layout: The Growing Document

```
┌─────────────────────────────────────────────────────────────┐
│  Chapter 1                                         3/26     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cuando yo tenía seis años, vi una magnífica lámina        │
│  en un libro sobre la selva virgen que se titulaba         │
│  Historias Vividas.                                         │
│                                              ✓              │
│                                                             │
│  Representaba una serpiente boa tragándose a una fiera.    │
│                                              ✓              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  En el libro [decía:] "Las serpientes boas tragan          │
│  enteras a sus presas, sin masticarlas..."                  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│        [Need Help]      [Hard]      [Got It]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Visual States:**
- **Completed sentences:** Normal text, subtle checkmark
- **Current sentence:** Full sentence visible, active fragment in bold/highlighted
- **Future sentences:** Hidden completely
- **Scroll behavior:** Auto-scroll to keep current sentence in view

### ✅ Single-Button Interaction (Implemented)

| Action | Meaning | Score |
|--------|---------|-------|
| **Tap fragment** | Peek translation (optional) | Records peeked state |
| **Tap green check** | "I understand, continue" | 1.0 if not peeked, 0.7 if peeked |

### Peek Tooltip State (Implemented)

When user taps active fragment:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  En el libro [decía:] "Las serpientes boas...              │
│                  ↑                                          │
│            ┌──────────────────┐                            │
│            │  it said: / read: │  ← Peek tooltip           │
│            └──────────────────┘                            │
│                                                             │
│                                          [✓]  ← Check btn   │
└─────────────────────────────────────────────────────────────┘
```

**Key behaviors:**
- Tooltip appears on tap, dismisses on tap elsewhere
- `wasCurrentFragmentPeeked()` exposed via ref to parent
- Peeked fragments tracked in local `Set` for session

### Sentence Completion

After final fragment of a sentence:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  En el libro decía: "Las serpientes boas tragan enteras    │
│  a sus presas, sin masticarlas..."                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  "In the book it said: 'Boa constrictors swallow their     │
│  prey whole, without chewing...'"                           │
│                                                             │
│  You understood: 3/4 fragments (75%)                        │
│  ●●●○                                                       │
│                                                             │
│                   [Next Sentence →]                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Always show:** Full English translation after completing sentence
**Show score:** Visual indicator of fragment performance

### Resume and Navigation

**On Return to Chapter:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Welcome back to Chapter 1                                  │
│                                                             │
│  You've read 12 of 26 sentences.                           │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Continue from sentence 13 →]                              │
│                                                             │
│  [Start from beginning]                                     │
│                                                             │
│  [Jump to sentence...]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**
- Can jump to any sentence from 1 to `furthest_sentence_reached`
- Cannot skip ahead past furthest reached
- "Start from beginning" resets position but preserves sentence scores

### Chapter Completion

After final sentence:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🎉 Chapter 1 Complete!                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Sentences: 26/26                                           │
│  First-try accuracy: 87%                                    │
│  Fragments understood: 94/108                               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Continue to Chapter 2 →]                                  │
│                                                             │
│  [Review Chapter 1 Sentences]                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ CHAPTER-ONLY VIEW ARCHITECTURE

### Overview

For performance, Reading Mode loads only the current chapter's sentences instead of the entire book history. This prevents performance degradation as the user progresses.

### Data Flow

```
initializeSession()
  → fetchBookProgress() → get current_sentence_id
  → fetchChapterInfo(sentence.chapter_id) → set currentChapter
  → fetchChapterSentences(chapter_id, current_sentence_id) → completed sentences BEFORE current
  → fetchFurthestPosition() → for navigation permissions
```

### State Shape

```javascript
const [currentChapter, setCurrentChapter] = useState(null)
// { chapter_id, chapter_number, title, book_id }

const [completedSentences, setCompletedSentences] = useState([])
// Only contains current chapter's sentences

const [furthestPosition, setFurthestPosition] = useState(null)
// { sentenceId, sentenceOrder, chapterId, chapterNumber }
```

### Chapter Transitions

When crossing a chapter boundary:
1. `handleSentenceComplete` detects `nextSentencePreview.chapter_id !== currentChapter.chapter_id`
2. Sets `nextChapterPreview` to next chapter number
3. Blurred "Capítulo N" preview shown instead of sentence preview
4. On confirm, fetches first sentence of next chapter via `fetchChapterFirstSentence()`
5. Resets `completedSentences` to `[]` (fresh start for new chapter)
6. Updates `currentChapter` state

---

## ✅ NAVIGATION CONTROLS

### Tape Deck Navigation (Implemented)

Fixed-position controls on right side of content area:

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                [^^]    │
│  Content area                                                  [^]     │
│  (max-width: 768px)                                                    │
│                                                                [v]     │
│                                                                [vv]    │
└────────────────────────────────────────────────────────────────────────┘
```

### Navigation Actions

| Button | Icon | Action | Enabled When |
|--------|------|--------|--------------|
| `^^` | ChevronsUp | Previous chapter | `currentChapterNumber > 1` |
| `^` | ChevronUp | Previous sentence | `completedSentences.length > 0` |
| `v` | ChevronDown | Next sentence | Within `furthestPosition` |
| `vv` | ChevronsDown | Next chapter | `furthestPosition.chapterNumber > currentChapterNumber` |

### Seamless Navigation

Navigation is instant (no loading screens):

```javascript
// goToPreviousSentence - moves last completed to current
setCompletedSentences(prev => prev.slice(0, -1))
setCurrentSentence(prevSentence)

// goToNextSentence - moves current to completed, fetches next
setCompletedSentences(prev => [...prev, currentSentence])
setCurrentSentence(nextSentence)

// Position updates happen in background (no await)
progress.updatePosition(bookId, sentence.sentence_id, 1)
```

---

## ✅ HIGHLIGHT FEATURE

### User Flow

1. Tap any completed sentence to show tooltip
2. Tooltip shows translation + highlight toggle
3. Toggle on: sentence gets amber underline/background
4. Persisted to `user_sentence_progress.is_highlighted`

### Implementation

```javascript
// In ReadingPage.jsx
const handleToggleHighlight = useCallback(async () => {
  // Optimistic update
  setActiveTooltipSentence(prev => ({ ...prev, is_highlighted: newValue }))

  // Persist to database
  await supabase
    .from('user_sentence_progress')
    .upsert({
      user_id: user.id,
      sentence_id: activeTooltipSentence.sentence_id,
      is_highlighted: newValue
    }, { onConflict: 'user_id,sentence_id' })
}, [activeTooltipSentence, user?.id])
```

---

## SENTENCE REVIEW MODE

### Purpose

FSRS-scheduled review of sentences from completed chapters. Strengthens comprehension of sentences the user found difficult.

### When Available

After completing a chapter in Reading Mode, its sentences become available for Sentence Review.

### Session Flow

1. User opens Sentence Review
2. System selects due sentences (FSRS scheduling)
3. Individual sentence appears with first fragment highlighted
4. Same three-button interaction as Reading Mode
5. After sentence complete: score calculated, FSRS updated
6. Next sentence appears
7. After session complete: summary screen

### Session Composition

```javascript
function selectSentencesForReview(userId, sessionSize = 15) {
  // 1. Get all due sentences from completed chapters
  const dueSentences = await supabase
    .from('user_sentence_progress')
    .select('*, sentences(*)')
    .eq('user_id', userId)
    .lte('due_date', new Date())
    .order('due_date', { ascending: true });
  
  // 2. Take top N by due date (most overdue first)
  return dueSentences.slice(0, sessionSize);
}
```

### Default Session Size

- Default: 15 sentences
- User-configurable in Settings (same pattern as flashcard session size)
- Stored in `user_settings.sentence_review_session_size`

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sentence Review                                   3/15     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Chapter 1, Sentence 7                                      │
│                                                             │
│  [En el libro decía:] "Las serpientes boas tragan          │
│  enteras a sus presas, sin masticarlas."                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│        [Need Help]      [Hard]      [Got It]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## UNLOCK LOGIC

### Reading Mode Unlock

**Criteria:** 100% of chapter's lemmas AND phrases have been introduced (reps >= 1)

```javascript
async function isReadingModeUnlocked(userId, chapterId) {
  // Get total learnable items (excluding stop words)
  const totalLemmas = await countChapterLemmas(chapterId, { excludeStopWords: true });
  const totalPhrases = await countChapterPhrases(chapterId);
  
  // Get introduced items
  const introducedLemmas = await countIntroducedLemmas(userId, chapterId);
  const introducedPhrases = await countIntroducedPhrases(userId, chapterId);
  
  // Check if all introduced
  const lemmasComplete = introducedLemmas >= totalLemmas;
  const phrasesComplete = introducedPhrases >= totalPhrases;
  
  return lemmasComplete && phrasesComplete;
}
```

**No stability requirement** - Just get through the words, then start reading. Don't hold users back.

### Next Chapter Reading Unlock

**Criteria:** Previous chapter completed in Reading Mode

```javascript
async function canAccessChapterReading(userId, chapterId) {
  // Chapter 1 always accessible if vocab complete
  if (chapterId === CHAPTER_1_ID) {
    return await isReadingModeUnlocked(userId, chapterId);
  }
  
  // For Chapter N (N > 1):
  // 1. Chapter N vocab must be introduced
  // 2. Chapter N-1 Reading must be complete
  const vocabReady = await isReadingModeUnlocked(userId, chapterId);
  const previousChapterId = await getPreviousChapterId(chapterId);
  const previousComplete = await isChapterReadingComplete(userId, previousChapterId);
  
  return vocabReady && previousComplete;
}
```

### Sentence Review Unlock

**Criteria:** Chapter completed in Reading Mode

```javascript
async function canReviewChapterSentences(userId, chapterId) {
  return await isChapterReadingComplete(userId, chapterId);
}
```

### Dashboard Display

```
Chapter 1: El Principito
├── Vocabulary: 100% introduced ✓
├── Reading: Available [Start Reading →]
└── Sentence Review: Locked (complete reading first)

Chapter 2: Un cordero
├── Vocabulary: 85% introduced (need 100%)
├── Reading: Locked (need vocab complete)
└── Sentence Review: Locked

Chapter 3: El planeta del principito
├── Vocabulary: Locked (complete Chapter 2 reading)
├── Reading: Locked
└── Sentence Review: Locked
```

---

## DATABASE SCHEMA

### sentence_fragments

Stores the fragment breakdown for each sentence.

```sql
CREATE TABLE sentence_fragments (
  fragment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  
  -- Ordering and position
  fragment_order INTEGER NOT NULL,           -- 1, 2, 3, 4...
  start_word_position INTEGER NOT NULL,      -- Word index start (for highlighting)
  end_word_position INTEGER NOT NULL,        -- Word index end
  
  -- Content
  fragment_text TEXT NOT NULL,               -- "Cuando yo tenía seis años,"
  fragment_translation TEXT NOT NULL,        -- "When I was six years old,"
  context_note TEXT,                         -- Optional grammar/usage note
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sentence_id, fragment_order)
);

-- Index for fetching fragments by sentence
CREATE INDEX idx_fragments_sentence ON sentence_fragments(sentence_id, fragment_order);

COMMENT ON TABLE sentence_fragments IS 'Meaningful chunks of sentences for reading comprehension practice';
COMMENT ON COLUMN sentence_fragments.context_note IS 'Optional note explaining grammar patterns or idiomatic usage';
```

### user_sentence_progress

Tracks user's comprehension progress per sentence (FSRS-scheduled).

```sql
CREATE TABLE user_sentence_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentence_id UUID NOT NULL REFERENCES sentences(sentence_id) ON DELETE CASCADE,
  
  -- FSRS scheduling columns (same pattern as lemma/phrase progress)
  stability REAL,
  difficulty REAL,
  due_date TIMESTAMPTZ,
  fsrs_state SMALLINT DEFAULT 0,            -- 0=New, 1=Learning, 2=Review, 3=Relearning
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  
  -- Comprehension-specific data
  last_score REAL,                           -- 0.0 to 1.0 (most recent attempt)
  best_score REAL,                           -- Highest score achieved
  last_fragment_results JSONB,               -- ['got-it', 'hard', 'need-help', 'got-it']
  times_completed INTEGER DEFAULT 0,         -- How many times fully reviewed
  
  -- Source tracking
  first_seen_in TEXT DEFAULT 'reading',      -- 'reading' or 'review'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, sentence_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_sentence_progress_due ON user_sentence_progress(user_id, due_date);
CREATE INDEX idx_sentence_progress_state ON user_sentence_progress(user_id, fsrs_state);

COMMENT ON TABLE user_sentence_progress IS 'FSRS-scheduled sentence comprehension progress';
```

### user_chapter_reading_progress

Tracks position and completion status for Reading Mode.

```sql
CREATE TABLE user_chapter_reading_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(chapter_id) ON DELETE CASCADE,
  
  -- Position tracking
  current_sentence_order INTEGER DEFAULT 1,  -- Which sentence user is on (1-indexed)
  current_fragment_order INTEGER DEFAULT 1,  -- Which fragment within sentence
  furthest_sentence_reached INTEGER DEFAULT 1, -- Highest sentence accessed (can't skip past)
  
  -- Completion status
  is_complete BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  
  -- Aggregate stats
  total_sentences INTEGER,                   -- Total sentences in chapter
  sentences_completed INTEGER DEFAULT 0,     -- Sentences fully reviewed
  total_fragments_seen INTEGER DEFAULT 0,
  fragments_got_it INTEGER DEFAULT 0,
  fragments_hard INTEGER DEFAULT 0,
  fragments_need_help INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, chapter_id)
);

COMMENT ON TABLE user_chapter_reading_progress IS 'Tracks Reading Mode position and completion per chapter';
```

### user_settings addition

Add sentence review session size to existing settings table.

```sql
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS sentence_review_session_size INTEGER DEFAULT 15;

COMMENT ON COLUMN user_settings.sentence_review_session_size IS 'Number of sentences per Sentence Review session (default 15)';
```

---

## FRAGMENT GENERATION PIPELINE

### Overview

Use Claude API to intelligently segment sentences into meaningful fragments during content import.

### Pipeline Integration

```
Existing Pipeline:
  Paste chapter → Split sentences → Lemmatize → Translate sentences → Validate

New Step (after sentence translation):
  → Generate fragments (Claude API) → Store fragments → Human QA flag
```

### Claude API Prompt

```python
FRAGMENT_GENERATION_PROMPT = """You are helping create a Spanish reading comprehension tool for learners. Break this sentence into meaningful fragments.

RULES:
1. Each fragment should be 4-10 words (prefer 5-8 words)
2. Each fragment MUST translate meaningfully on its own
3. Follow natural reading rhythm and clause boundaries
4. Never split: verb phrases, noun phrases, prepositional phrases
5. Prefer FEWER, LONGER fragments (target 2-4 per sentence)
6. If sentence is very short (< 5 words), return it as a single fragment
7. Keep quoted text intact within a fragment when possible

SPANISH SENTENCE:
{sentence_spanish}

FULL ENGLISH TRANSLATION:
{sentence_english}

Return a JSON array of fragments. Each fragment needs:
- "es": the Spanish text
- "en": a translation that makes sense independently (may differ slightly from full translation)
- "note": optional grammar/usage note (only if there's something learners should know)

Example output format:
[
  {{"es": "Cuando yo tenía seis años,", "en": "When I was six years old,", "note": "tenía + age = was X years old"}},
  {{"es": "vi una magnífica lámina", "en": "I saw a magnificent illustration", "note": null}},
  {{"es": "en un libro sobre la selva virgen", "en": "in a book about the virgin forest", "note": null}}
]

IMPORTANT: Fragment translations should be complete thoughts, even if slightly adjusted from the literal full-sentence translation."""
```

### Python Script

```python
import anthropic
import json
from supabase import create_client

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def generate_fragments(sentence_id: str, spanish: str, english: str) -> list:
    """Generate fragments for a sentence using Claude API."""
    
    prompt = FRAGMENT_GENERATION_PROMPT.format(
        sentence_spanish=spanish,
        sentence_english=english
    )
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Parse JSON response
    content = response.content[0].text
    # Handle potential markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    
    fragments = json.loads(content.strip())
    return fragments


def process_chapter_fragments(chapter_id: str):
    """Generate and store fragments for all sentences in a chapter."""
    
    # Get all sentences in chapter
    result = supabase.table('sentences').select('*').eq(
        'chapter_id', chapter_id
    ).order('sentence_order').execute()
    
    sentences = result.data
    
    for sentence in sentences:
        # Skip if fragments already exist
        existing = supabase.table('sentence_fragments').select('fragment_id').eq(
            'sentence_id', sentence['sentence_id']
        ).execute()
        
        if existing.data:
            print(f"  Skipping sentence {sentence['sentence_order']} (fragments exist)")
            continue
        
        # Generate fragments
        fragments = generate_fragments(
            sentence['sentence_id'],
            sentence['sentence_text'],
            sentence['sentence_translation']
        )
        
        # Calculate word positions (simplified - may need refinement)
        current_position = 0
        
        for i, frag in enumerate(fragments):
            # Count words in fragment
            word_count = len(frag['es'].split())
            
            # Insert fragment
            supabase.table('sentence_fragments').insert({
                'sentence_id': sentence['sentence_id'],
                'fragment_order': i + 1,
                'start_word_position': current_position,
                'end_word_position': current_position + word_count - 1,
                'fragment_text': frag['es'],
                'fragment_translation': frag['en'],
                'context_note': frag.get('note')
            }).execute()
            
            current_position += word_count
        
        print(f"  Sentence {sentence['sentence_order']}: {len(fragments)} fragments")
    
    print(f"Chapter {chapter_id} fragment generation complete")


# CLI usage
if __name__ == "__main__":
    import sys
    chapter_id = sys.argv[1]
    process_chapter_fragments(chapter_id)
```

### Quality Checks

After generation, flag for human review if:
- Any fragment is < 3 words (might be too short)
- Any fragment is > 12 words (might be too long)
- Sentence has > 6 fragments (might be over-segmented)
- Sentence has only 1 fragment and is > 10 words (might need splitting)

---

## UI COMPONENTS

### ReadingMode Component

```
src/components/reading/
├── ReadingMode.jsx              # Main container
├── ReadingHeader.jsx            # Chapter title, progress (3/26)
├── CompletedSentence.jsx        # Rendered completed sentences
├── ActiveSentence.jsx           # Current sentence with fragment highlighting
├── FragmentButtons.jsx          # Need Help / Hard / Got It
├── TranslationReveal.jsx        # Translation + Continue button
├── SentenceComplete.jsx         # Score display + Next Sentence button
├── ChapterComplete.jsx          # Celebration screen
├── ResumeModal.jsx              # Continue / Start Over / Jump To
└── hooks/
    ├── useReadingProgress.js    # Position tracking, save/resume
    └── useFragmentSession.js    # Fragment state machine
```

### SentenceReview Component

```
src/components/sentenceReview/
├── SentenceReview.jsx           # Main container
├── SentenceReviewHeader.jsx     # Progress (3/15)
├── ReviewSentence.jsx           # Sentence + fragment interaction
├── SessionSummary.jsx           # End of session stats
└── hooks/
    └── useSentenceReviewSession.js
```

### Shared Components

```
src/components/shared/
├── FragmentHighlight.jsx        # Highlights active fragment in sentence
└── FragmentScore.jsx            # Visual score indicator (●●●○)
```

---

## FSRS INTEGRATION

### Scoring Formula

```javascript
function calculateSentenceScore(fragmentResults) {
  const scores = {
    'got-it': 1.0,
    'hard': 0.5,
    'need-help': 0.0
  };
  
  const total = fragmentResults.reduce((sum, r) => sum + scores[r], 0);
  const maxPossible = fragmentResults.length;
  
  return total / maxPossible;  // 0.0 to 1.0
}
```

### FSRS Rating Mapping

| Score | FSRS Rating | Description |
|-------|-------------|-------------|
| 90-100% | 3 (Good) | Strong comprehension |
| 60-89% | 2 (Hard) | Partial comprehension |
| < 60% | 1 (Again) | Needs review soon |

### Update Flow

```javascript
async function completeSentence(userId, sentenceId, fragmentResults) {
  const score = calculateSentenceScore(fragmentResults);
  const fsrsRating = score >= 0.9 ? 3 : score >= 0.6 ? 2 : 1;
  
  // Get current progress (or create new)
  const progress = await getSentenceProgress(userId, sentenceId);
  
  // Calculate new FSRS values
  const fsrs = new FSRS();
  const card = progress ? progressToCard(progress) : createNewCard();
  const scheduled = fsrs.repeat(card, new Date())[fsrsRating];
  
  // Update database
  await supabase.from('user_sentence_progress').upsert({
    user_id: userId,
    sentence_id: sentenceId,
    stability: scheduled.card.stability,
    difficulty: scheduled.card.difficulty,
    due_date: scheduled.card.due,
    fsrs_state: scheduled.card.state,
    reps: scheduled.card.reps,
    lapses: scheduled.card.lapses,
    last_seen_at: new Date().toISOString(),
    last_score: score,
    best_score: Math.max(score, progress?.best_score || 0),
    last_fragment_results: fragmentResults,
    times_completed: (progress?.times_completed || 0) + 1
  });
  
  return { score, fsrsRating, nextDue: scheduled.card.due };
}
```

---

## IMPLEMENTATION PHASES

### Phase 1: Content Pipeline (Fragment Generation)

**Goal:** Generate fragments for all 815 sentences

**Tasks:**
1. Create `sentence_fragments` table
2. Write Claude API fragment generation script
3. Process Chapter 1-3 as test
4. Review output quality, refine prompt if needed
5. Process remaining chapters
6. Flag low-quality fragments for human review

**Output:** All sentences have fragments in database

**Estimated effort:** 3-5 hours (mostly API processing time)

---

### Phase 2: Reading Mode Core

**Goal:** Users can read chapters with fragment interaction

**Tasks:**
1. Create database tables:
   - `user_sentence_progress`
   - `user_chapter_reading_progress`
2. Build UI components:
   - ReadingMode container
   - ActiveSentence with fragment highlighting
   - FragmentButtons (Need Help / Hard / Got It)
   - TranslationReveal with Continue button
   - SentenceComplete with score
   - CompletedSentence (rendered above)
3. Implement hooks:
   - useReadingProgress (position tracking)
   - useFragmentSession (fragment state machine)
4. Build Reading Mode page route

**Output:** Can read Chapter 1 from start to finish

**Estimated effort:** 2-3 days

---

### Phase 3: Progress and Resume

**Goal:** Position saving, resume, and chapter completion

**Tasks:**
1. Save position after each fragment
2. Resume modal (Continue / Start Over / Jump To)
3. Jump to previous sentence functionality
4. Chapter completion detection
5. Chapter completion celebration screen
6. Update dashboard to show reading progress

**Output:** Full Reading Mode experience with save/resume

**Estimated effort:** 1-2 days

---

### Phase 4: Unlock Logic

**Goal:** Reading Mode unlocks correctly based on vocabulary progress

**Tasks:**
1. Implement `isReadingModeUnlocked()` check
2. Implement `canAccessChapterReading()` for chapter N
3. Update chapter selection UI with lock states
4. Show "Reading Mode Available" notification when unlocked
5. Block navigation to locked chapters

**Output:** Users can only access Reading Mode when ready

**Estimated effort:** 1 day

---

### Phase 5: Sentence Review Mode

**Goal:** FSRS-scheduled sentence review sessions

**Tasks:**
1. Implement FSRS integration for sentences
2. Build sentence selection query (due sentences)
3. Add `sentence_review_session_size` to user settings
4. Build SentenceReview UI components
5. Build session summary screen
6. Add Sentence Review to main navigation

**Output:** Users can review weak sentences via spaced repetition

**Estimated effort:** 2 days

---

### Phase 6: Polish (Future)

**Goal:** Enhanced experience and re-read mode

**Tasks:**
1. Re-read mode (clean text, tap for translation)
2. Animations (sentence appear, fragment transitions)
3. Progress analytics
4. Fragment QA workflow for admin
5. Performance optimization

**Output:** Polished, delightful reading experience

**Estimated effort:** 3-5 days

---

## RELATED DOCUMENTS

- **02_DATABASE_SCHEMA.md** - Base table definitions
- **03_CONTENT_PIPELINE.md** - Sentence import workflow
- **04_LEARNING_ALGORITHM.md** - FSRS scheduling details
- **05_READING_EXPERIENCE.md** - Click-for-definition (word level)
- **30_FSRS_ARCHITECTURE.md** - FSRS implementation details

---

## FUTURE ENHANCEMENTS

### Planned (Not Yet Implemented)

1. **Sentence Review Mode**
   - FSRS-scheduled review of weak sentences from completed chapters
   - Separate from Reading Mode flow
   - Prioritizes sentences with low scores

2. **Virtualized Full-Book View**
   - Seamless scrolling across all chapters
   - Virtual scrolling for performance
   - Chapter headers inline

3. **Session Summary on Exit**
   - Fragments answered
   - Score breakdown
   - Time spent

4. **Chapter Unlock Trigger Refinement**
   - Currently: unlock on completing previous chapter
   - Consider: unlock on chapter entry, not first sentence completion

5. **Re-Read Mode**
   - Clean text without fragment highlighting
   - Tap sentence for translation (not fragment)
   - For reviewing completed chapters

---

## REVISION HISTORY

- 2025-12-23: Updated to reflect actual implementation (Reading Mode sprint complete)
- 2025-12-15: Initial design document (Claude + Peter collaborative design)

---

**END OF SENTENCE COMPREHENSION SPECIFICATION**
