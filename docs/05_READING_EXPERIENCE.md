# 05_READING_EXPERIENCE.md

**Last Updated:** December 23, 2025
**Status:** Partially Implemented
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [✅ Reading Mode](#reading-mode) (Implemented - Sentence Comprehension)
4. [Reading Interface](#reading-interface) (Word-level - Future)
5. [Word Interaction](#word-interaction)
6. [Chapter Navigation](#chapter-navigation)
7. [Progress Tracking](#progress-tracking)
8. [Mobile Optimization](#mobile-optimization)
9. [Implementation Guide](#implementation-guide)

---

## OVERVIEW

The reading experience is where contextual learning happens. Users read El Principito in Spanish while having instant access to definitions, making the story both the curriculum and the learning environment.

**Goal:** Create an immersive, delightful reading experience that encourages users to engage with Spanish text without frustration.

**Core Features:**
- Click/tap words for instant definitions
- Track which words encountered
- Add words to study queue
- Beautiful typography and layout
- Chapter-by-chapter progression

**Note:** This document covers two reading experiences:
1. **Reading Mode** (✅ Implemented) - Fragment-by-fragment comprehension with sentence learning. See [31_SENTENCE_COMPREHENSION.md](31_SENTENCE_COMPREHENSION.md) for details.
2. **Word-Level Reading** (Future) - Tap-for-definition immersive reading. Sections below describe this future feature.

---

## ✅ READING MODE (Implemented)

### Overview

Reading Mode provides structured sentence comprehension practice. Users progress through chapters fragment-by-fragment, confirming understanding of each chunk before advancing.

**Route:** `/reading`
**Entry Point:** Dashboard "Read" button or chapter selection

### Core Features

| Feature | Description |
|---------|-------------|
| **Flowing Paragraphs** | Completed sentences display as continuous text, grouped by `is_paragraph_start` |
| **Fragment-by-Fragment** | Current sentence shows fragments: completed (normal), active (bold), upcoming (blurred) |
| **Tap-to-Peek** | Tap active fragment to see translation; marks fragment as "peeked" for scoring |
| **Single Check Button** | Green check confirms understanding; peeked = 0.7 score, not peeked = 1.0 |
| **Chapter-Only View** | Only loads current chapter's sentences for performance |
| **Blurred Preview** | Next sentence or chapter title shown blurred beneath current sentence |
| **Sentence Highlighting** | Tap completed sentences to toggle highlight for later review |

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Exit               El Principito               Capítulo I            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                           Capítulo I                                    │
│                                                                         │
│    Cuando yo tenía seis años, vi una magnífica lámina en un libro      │
│  sobre la selva virgen que se titulaba Historias Vividas.              │
│                                                                         │
│    Se veía en la lámina una serpiente boa tragándose a una fiera.      │
│                                                                         │
│    [En el libro decía:] "Las serpientes boas tragan enteras a sus      │
│  presas, sin masticarlas."                                              │
│                                              ┌──────────────────┐       │
│  ← Active fragment (bold)                    │ it said: / read:│       │
│                                              └──────────────────┘       │
│                                                                         │
│    Siguiente oración aquí borrosa...  ← Blurred preview                │
│                                                                         │
│                                                               [✓]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Navigation Controls

Fixed-position "tape deck" controls on right side:

| Button | Icon | Action |
|--------|------|--------|
| `^^` | ChevronsUp | Previous chapter |
| `^` | ChevronUp | Previous sentence |
| `v` | ChevronDown | Next sentence (if visited) |
| `vv` | ChevronsDown | Next chapter (if visited) |

### Component Structure

```
src/
├── pages/
│   └── Reading.jsx                    # Route handler
├── components/reading/
│   ├── ReadingPage.jsx                # Main container
│   ├── StickyHeader.jsx               # Exit button, title, chapter
│   ├── ChapterTitle.jsx               # Roman numeral chapter headings
│   ├── FlowingParagraph.jsx           # Completed sentences + inline active
│   ├── ActiveSentenceInline.jsx       # Fragment display with peek
│   ├── SentenceTooltip.jsx            # Translation + highlight toggle
│   └── NavigationControls.jsx         # Tape deck navigation
├── hooks/reading/
│   ├── useReadingSession.js           # Main state management (670+ lines)
│   ├── useReadingProgress.js          # Database operations (950+ lines)
│   └── useScrollToPosition.js         # Scroll behavior management
```

### State Management

```javascript
// useReadingSession state
const [bookId, setBookId] = useState(null)
const [currentChapter, setCurrentChapter] = useState(null)
const [currentSentence, setCurrentSentence] = useState(null)
const [currentFragmentIndex, setCurrentFragmentIndex] = useState(0)
const [completedSentences, setCompletedSentences] = useState([])
const [nextSentencePreview, setNextSentencePreview] = useState(null)
const [nextChapterPreview, setNextChapterPreview] = useState(null)
const [isTransitioning, setIsTransitioning] = useState(false)
const [furthestPosition, setFurthestPosition] = useState(null)
```

### Database Tables

- `user_book_reading_progress` - Position tracking with `current_sentence_id`, `current_fragment_index`, `furthest_sentence_id`
- `user_sentence_progress` - FSRS scheduling + `is_highlighted` flag
- `sentences` - Content with `is_paragraph_start` for paragraph grouping
- `sentence_fragments` - Fragment text and translations

### See Also

For complete implementation details, see [31_SENTENCE_COMPREHENSION.md](31_SENTENCE_COMPREHENSION.md).

---

## DESIGN PHILOSOPHY

### 1. Story First, Learning Second

The primary experience is reading a beloved story. Learning vocabulary is a natural byproduct, not the main focus.

**Implications:**
- Clean, distraction-free reading layout
- Definitions appear on-demand, not automatically
- No interruptions to reading flow
- Typography emphasizes readability

---

### 2. Low-Friction Translation Access

Users should never feel stuck on unknown words.

**Implications:**
- Single tap/click for definition
- No typing or dictionary lookup needed
- Instant response (<100ms)
- Close definition with single action

---

### 3. Gradual Vocabulary Building

As users read, their vocabulary grows naturally through repeated exposure.

**Implications:**
- Track word encounters automatically
- Show encounter count in definition modal
- Visual indicators for studied vs new words
- Encourage adding words to flashcard queue

---

### 4. Mobile-First Reading

Most users will read on phones during downtime.

**Implications:**
- Optimized for small screens
- Touch-friendly tap targets
- Readable font sizes (16px minimum)
- Comfortable line length (45-65 characters)

---

## READING INTERFACE

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Book                          Chapter 1 of 27  ☰ │
├─────────────────────────────────────────────────────┤
│                                                     │
│                  Capitulo I                         │
│                                                     │
│  Cuando yo tenía seis años, vi una vez una         │
│  magnífica lámina en un libro sobre el bosque      │
│  virgen que se llamaba Historias vividas. Se       │
│  veía en la lámina una serpiente boa que se        │
│  tragaba a una fiera.                               │
│                                                     │
│  Meditaba luego mucho sobre las aventuras de la    │
│  selva, y llegué a trazar con un lápiz de colores  │
│  mi primer dibujo. Mi dibujo número 1 era así:     │
│                                                     │
│  [Illustration placeholder]                         │
│                                                     │
│  Enseñé mi obra de arte a las personas grandes     │
│  y les pregunté si mi dibujo les daba miedo.       │
│                                                     │
│  Me contestaron: "¿Por qué habría de asustar un    │
│  sombrero?"                                         │
│                                                     │
│  [Continue reading...]                              │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Progress: 45 of 289 unique words encountered      │
│  [Start Studying Chapter 1 →]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Header

**Left:** Back button (← Book) - returns to chapter selection  
**Center:** Chapter title and number (Chapter 1 of 27)  
**Right:** Menu (☰) - reading options

---

### Typography

**Spanish Text:**
- Font: System serif (Georgia, Times, or native serif)
- Size: 18px on mobile, 20px on tablet/desktop
- Line height: 1.6 (28.8px for 18px text)
- Color: #1a1a1a (near black, easier on eyes than pure black)

**Chapter Titles:**
- Font: System serif
- Size: 24px
- Weight: Bold
- Margin: 32px top, 24px bottom

**Paragraph Spacing:**
- Margin bottom: 16px
- First paragraph: No indent
- Subsequent paragraphs: 2em indent

---

### Color Palette

**Background:**
- Page: #faf9f7 (warm off-white, less harsh than pure white)
- Content area: #ffffff (white)

**Text:**
- Primary: #1a1a1a (Spanish text)
- Secondary: #6b7280 (chapter numbers, metadata)
- Link: #3b82f6 (interactive words)

**Accents:**
- Little Prince blue: #4a90e2
- Star yellow: #f4c430

---

## WORD INTERACTION

### Clickable Words

**Visual States:**

**Default (Unknown Word):**
- No underline
- Cursor: pointer on hover
- Hover effect: Light blue background (#e0f2fe)

**Studied Word:**
- Subtle dot below word (·)
- Color: Current mastery level
  - Green (60-100 mastery)
  - Yellow (30-59 mastery)
  - Orange (10-29 mastery)
  - Red (0-9 mastery)

**Currently Studying:**
- Small star icon (⭐) after word
- Indicates word in active study rotation

---

### Click/Tap Behavior

**On Click:**
1. Word highlights (blue background)
2. Definition modal slides up from bottom (mobile) or appears as popover (desktop)
3. Reading text dims slightly (overlay: rgba(0,0,0,0.3))

**On Second Click (same word):**
- Modal closes
- Highlight removed
- Reading resumes

**On Click Different Word:**
- Previous modal closes
- New modal opens
- Smooth transition (200ms)

---

### Definition Modal

**Mobile (Full Sheet):**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Drag handle]                                      │
│                                                     │
│  el bosque                                          │
│  noun · masculine                                   │
│                                                     │
│  the forest, the woods                              │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Context:                                           │
│  "...un libro sobre el bosque virgen..."           │
│                                                     │
│  Encountered: 3 times                               │
│  Mastery: Level 0 (New)                             │
│                                                     │
│  [Add to Study Queue] [Close]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Desktop (Popover):**
```
     ┌────────────────────────────────┐
     │  el bosque                     │
     │  noun · masculine              │
     │                                │
     │  the forest, the woods         │
     │                                │
     │  Context: "...el bosque..."    │
     │  Encountered: 3 times          │
     │                                │
     │  [Add to Study]  [Close]       │
     └────────────────────────────────┘
```

---

### Modal Contents

**Word Header:**
- Lemma text (canonical form): "vivir"
- If different from clicked form, show: "vivir (vivía)"
- Part of speech and gender: "verb" or "noun · masculine"

**Definitions:**
- Primary definition first
- Additional definitions (if multiple)
- Max 3 shown, [Show All] button if more

**Context:**
- Sentence where word appears
- Word highlighted within sentence

**Progress Indicators:**
- Times encountered count
- Current mastery level (if studying)
- Health bar (if studying)

**Actions:**
- **Add to Study Queue** (if not studying)
- **Already Studying** (disabled, if active)
- **Close** (dismiss modal)

---

### Add to Study Queue

**First Tap:**
```
Button changes:
[Add to Study Queue] → [✓ Added to Queue]

Notification appears:
"el bosque added to study queue"
(disappears after 2 seconds)
```

**Effect:**
- Creates `user_lemma_progress` entry (if doesn't exist)
- Sets health: 0 (needs immediate attention)
- Sets mastery: 0 (new word)
- Word appears in next study session

**Subsequent Encounters:**
- Button shows: [Already Studying]
- Disabled state
- Show current stats instead

---

## CHAPTER NAVIGATION

### Chapter List (Book View)

```
┌─────────────────────────────────────────────────────┐
│  ← Home                  El Principito            ☰ │
├─────────────────────────────────────────────────────┤
│                                                     │
│  By Antoine de Saint-Exupéry                        │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ✅ Chapter 1: Capitulo I                          │
│     109/212 words encountered (51%)                 │
│     [Read Chapter] [Study Words]                    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  🔒 Chapter 2: Capitulo II                         │
│     LOCKED · 72% toward unlock                      │
│     Encounter all Chapter 1 words to unlock         │
│     [Study to Unlock →]                             │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  🔒 Chapter 3: Capitulo III                        │
│     Complete Chapter 2 to unlock                    │
│                                                     │
│  [Chapters 4-27...]                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### Chapter Unlock States

**Unlocked (✅):**
- Full color
- Both buttons active: [Read Chapter] [Study Words]
- Show progress: "109/212 words encountered (51%)"

**Locked (🔒):**
- Grayed out
- Progress bar toward unlock
- Requirement text: "Encounter all Chapter X words"
- [Study to Unlock →] button (starts study session)

**Current Chapter (⭐):**
- Highlighted background
- "Currently Reading" badge
- Auto-expand on load

---

### Chapter Reading Progress

**Within Chapter:**

Bottom progress bar:
```
┌─────────────────────────────────────────────────────┐
│  Chapter 1 Progress                                 │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 45 of 289 words (16%)       │
└─────────────────────────────────────────────────────┘
```

**Metrics:**
- Unique words encountered / Total unique words
- Percentage complete
- Updates live as user clicks words

---

## PROGRESS TRACKING

### What Gets Tracked

**Per Chapter:**
- Unique words encountered
- Total unique words in chapter
- Encounter percentage
- Reading time (optional)

**Per Word:**
- First encountered at (timestamp)
- Times encountered
- Last encountered sentence (for context)

**Per User:**
- Chapters unlocked
- Total reading time
- Words added to study queue

---

### Database Updates

**On Word Click:**
```sql
-- Create or update word encounter
INSERT INTO user_word_encounters (
  encounter_id,
  user_id,
  word_id,
  first_encountered_at,
  times_encountered,
  last_encountered_sentence_id
) VALUES (
  uuid_generate_v4(),
  :user_id,
  :word_id,
  NOW(),
  1,
  :sentence_id
)
ON CONFLICT (user_id, word_id) DO UPDATE
SET 
  times_encountered = user_word_encounters.times_encountered + 1,
  last_encountered_sentence_id = :sentence_id;
```

**Update Chapter Progress:**
```sql
-- Recalculate chapter encounter percentage
UPDATE user_chapter_progress
SET 
  lemmas_encountered = (
    SELECT COUNT(DISTINCT w.lemma_id)
    FROM user_word_encounters uwe
    JOIN words w ON uwe.word_id = w.word_id
    WHERE uwe.user_id = :user_id
      AND w.chapter_id = :chapter_id
  ),
  encounter_percentage = (
    SELECT CAST(COUNT(DISTINCT uwe.lemma_id) AS DECIMAL) / 
           NULLIF(COUNT(DISTINCT w.lemma_id), 0)
    FROM words w
    LEFT JOIN user_word_encounters uwe ON (
      w.word_id = uwe.word_id AND uwe.user_id = :user_id
    )
    WHERE w.chapter_id = :chapter_id
  )
WHERE user_id = :user_id AND chapter_id = :chapter_id;
```

---

## MOBILE OPTIMIZATION

### Touch Targets

**Minimum Size:** 44px × 44px (Apple HIG standard)

**Word Tap Areas:**
- Full word is clickable
- No need to tap exact letter
- Padding: 8px vertical, 4px horizontal

**Buttons:**
- Height: 48px minimum
- Padding: 12px vertical, 24px horizontal
- Rounded corners: 8px

---

### Scroll Behavior

**Reading Text:**
- Natural scroll (momentum on iOS)
- Scroll position saved per chapter
- Resume reading from last position

**Definition Modal:**
- Prevent body scroll when open
- Allow modal content scroll if needed
- Swipe down to dismiss (iOS pattern)

---

### Performance

**Text Rendering:**
- Use native fonts (fastest)
- CSS contain: content (optimize repaints)
- Will-change: transform (for modals)

**Word Highlighting:**
- CSS class toggle (no inline styles)
- Transition: 150ms ease-out
- Hardware-accelerated (transform, opacity only)

**Modal Animation:**
- Slide up from bottom (mobile): 250ms
- Fade in (desktop): 150ms
- Use transform: translateY (GPU-accelerated)

---

### Offline Considerations

**MVP:** Not offline-capable

**Future (Post-MVP):**
- Cache chapter text in localStorage
- Service worker for offline reading
- Sync encounters when back online

---

## IMPLEMENTATION GUIDE

### Component Structure

```
<ReadingPage>
  <Header>
    <BackButton />
    <ChapterTitle />
    <MenuButton />
  </Header>
  
  <ReadingContent>
    <ChapterTitle />
    <Paragraph>
      <Word clickable onClick={handleWordClick}>
        {word.text}
      </Word>
      {' '}
      <Word clickable>...</Word>
    </Paragraph>
  </ReadingContent>
  
  <ProgressBar chapter={chapter} />
  
  {showDefinition && (
    <DefinitionModal
      word={selectedWord}
      onClose={handleClose}
      onAddToQueue={handleAddToQueue}
    />
  )}
</ReadingPage>
```

---

### State Management

**React State:**
```javascript
const [selectedWord, setSelectedWord] = useState(null);
const [showDefinition, setShowDefinition] = useState(false);
const [encounters, setEncounters] = useState(new Set());
const [chapterProgress, setChapterProgress] = useState(null);
```

**Supabase Query:**
```javascript
// Fetch chapter text with words
const { data: chapter } = await supabase
  .from('chapters')
  .select(`
    *,
    sentences (
      sentence_id,
      sentence_order,
      sentence_text,
      words (
        word_id,
        word_text,
        word_position,
        lemma:lemmas (
          lemma_id,
          lemma_text,
          definitions,
          part_of_speech,
          gender
        )
      )
    )
  `)
  .eq('chapter_id', chapterId)
  .single();

// Fetch user's encounters
const { data: userEncounters } = await supabase
  .from('user_word_encounters')
  .select('word_id, times_encountered')
  .eq('user_id', userId)
  .in('word_id', allWordIds);
```

---

### Word Click Handler

```javascript
async function handleWordClick(word) {
  // Show definition modal
  setSelectedWord(word);
  setShowDefinition(true);
  
  // Track encounter
  await trackWordEncounter(userId, word.word_id, sentenceId);
  
  // Update local state
  setEncounters(prev => new Set([...prev, word.lemma.lemma_id]));
  
  // Update chapter progress
  updateChapterProgress();
}

async function trackWordEncounter(userId, wordId, sentenceId) {
  const { error } = await supabase.rpc('track_word_encounter', {
    p_user_id: userId,
    p_word_id: wordId,
    p_sentence_id: sentenceId
  });
  
  if (error) console.error('Failed to track encounter:', error);
}
```

---

### Add to Study Queue

```javascript
async function handleAddToQueue(lemmaId) {
  const { error } = await supabase
    .from('user_lemma_progress')
    .insert({
      user_id: userId,
      lemma_id: lemmaId,
      mastery_level: 0,
      health: 0,  // Critical - appears in next session
      total_reviews: 0,
      correct_reviews: 0
    });
  
  if (error) {
    console.error('Failed to add to queue:', error);
    return;
  }
  
  // Show success notification
  showNotification('Word added to study queue');
  
  // Update UI
  setSelectedWord(prev => ({
    ...prev,
    isStudying: true
  }));
}
```

---

### Responsive Design

**Breakpoints:**
```css
/* Mobile first (default) */
.reading-content {
  padding: 16px;
  font-size: 18px;
  max-width: 100%;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .reading-content {
    padding: 32px;
    font-size: 20px;
    max-width: 680px;
    margin: 0 auto;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .reading-content {
    padding: 48px;
    max-width: 720px;
  }
  
  .definition-modal {
    /* Popover instead of full sheet */
    position: absolute;
    width: 320px;
  }
}
```

---

## RELATED DOCUMENTS

- See **04_LEARNING_ALGORITHM.md** for progress tracking logic
- See **02_DATABASE_SCHEMA.md** for data structure
- See **01_MVP_DEFINITION.md** for scope

---

## REVISION HISTORY

- 2025-12-23: Added Reading Mode section documenting implemented sentence comprehension
- 2025-11-30: Initial draft (Claude)

---

**END OF READING EXPERIENCE**
