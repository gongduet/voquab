# Flashcard Final Fixes + Phrases Integration
## 3 Polish Issues + Critical Feature Addition

**Date:** December 13, 2025  
**Priority:** 3 UX fixes + Phrases integration (user hasn't seen any phrases yet)

---

## 🔴 CRITICAL ISSUES

### Issue #1: "Again" Button Increments Progress Incorrectly

**Problem:**
- User at card 2/15
- Clicks "Again" (don't know)
- Counter shows 3/16 (wrong!)
- Should stay at 2/15 (card requeued to end)

**Root Cause:**
In `src/pages/Flashcards.jsx`, the handleDifficulty function always increments currentIndex regardless of button pressed.

**Fix:**

```javascript
async function handleDifficulty(difficulty) {
  const card = cards[currentIndex];
  
  // Update progress
  const result = await updateProgress(card, difficulty, card.is_exposure);
  
  // Show floating feedback
  const intervals = {
    'again': '10 min',
    'hard': '2 days',
    'got-it': '5 days'
  };
  setFeedbackMessage(`+${intervals[difficulty]}`);
  setShowFeedback(true);
  setTimeout(() => setShowFeedback(false), 2000);
  
  // CHANGE THIS LOGIC:
  if (difficulty === 'again') {
    // Requeue card to end (don't increment progress)
    const requeued = [...cards];
    const currentCard = requeued[currentIndex];
    requeued.splice(currentIndex, 1);  // Remove from current position
    requeued.push(currentCard);  // Add to end
    setCards(requeued);
    
    // DON'T increment currentIndex
    // Stay at same position (next card slides into place)
    setIsFlipped(false);
  } else {
    // Hard or Got It - advance normally
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setSessionComplete(true);
    }
  }
}
```

**Test:**
- Start session: 1/15
- Review card, click "Got It": 2/15 ✓
- Review card, click "Again": still 2/15 ✓
- Card should appear again at end of deck
- Complete all cards: session ends when all cards reviewed at least once

---

### Issue #2: Part of Speech Placement & Format

**Problem:**
- Currently: Shows "ADJ" under Spanish word (front of card)
- Should: Show "adjective" on English card (back) in soft gray, full word

**Location:** `src/components/flashcard/FlashcardDisplay.jsx`

**Fix:**

**Front of card (Spanish) - REMOVE part of speech:**
```jsx
{/* Spanish word */}
<h2 style={{
  fontSize: '48px',
  fontWeight: '700',
  color: '#1e293b',
  fontFamily: 'Montserrat, sans-serif',
  marginBottom: '8px'
}}>
  {displayLemma}
</h2>

{/* REMOVE THIS: */}
{/* <p style={{ color: '#94a3b8', fontSize: '14px' }}>
  ({card.part_of_speech})
</p> */}
```

**Back of card (English) - ADD part of speech (formatted):**
```jsx
{/* English translation */}
<h2 style={{
  fontSize: '36px',
  fontWeight: '600',
  color: '#1e293b',
  fontFamily: 'Montserrat, sans-serif',
  marginBottom: '8px'
}}>
  {card.english_definition}
</h2>

{/* ADD THIS - Part of speech in full word */}
<p style={{ 
  color: '#94a3b8', 
  fontSize: '14px',
  fontWeight: '500',
  fontFamily: 'Inter, sans-serif',
  marginTop: '4px'
}}>
  {formatPartOfSpeech(card.part_of_speech)}
</p>
```

**Helper function to format part of speech:**
```javascript
function formatPartOfSpeech(pos) {
  const posMap = {
    'NOUN': 'noun',
    'VERB': 'verb',
    'ADJ': 'adjective',
    'ADV': 'adverb',
    'PRON': 'pronoun',
    'DET': 'determiner',
    'ADP': 'preposition',
    'CONJ': 'conjunction',
    'NUM': 'number',
    'PHRASE': 'phrase'  // For when phrases are added
  };
  
  return posMap[pos] || pos.toLowerCase();
}
```

**Test:**
- Front of card: Only Spanish word (no POS label)
- Back of card: English word + "adjective" in soft gray below

---

### Issue #3: Animation Position

**Problem:**
Floating "+2 days" appears over the sentence (awkward position).

**Should:**
- Ideal: Appear over the button that was clicked
- Fallback: Appear at top of card (in white space)

**Location:** `src/components/flashcard/FloatingFeedback.jsx`

**Fix Option A: Over Clicked Button (Preferred)**

Update Flashcards.jsx to pass button position:

```javascript
const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 });

async function handleDifficulty(difficulty, event) {
  // Get button position
  const rect = event.target.getBoundingClientRect();
  setFeedbackPosition({
    x: rect.left + rect.width / 2,
    y: rect.top
  });
  
  // Rest of logic...
  setFeedbackMessage(`+${intervals[difficulty]}`);
  setShowFeedback(true);
}

// Pass to FloatingFeedback:
<FloatingFeedback 
  message={feedbackMessage} 
  visible={showFeedback}
  position={feedbackPosition}
/>
```

Update FloatingFeedback.jsx:

```javascript
export function FloatingFeedback({ message, visible, position }) {
  if (!message) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -80 }}
          exit={{ opacity: 0, y: -120 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translateX(-50%)',
            fontSize: '24px',
            fontWeight: '700',
            fontFamily: 'Inter, sans-serif',
            color: '#b5838d',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Update button handlers in DifficultyButtons.jsx:

```jsx
<button onClick={(e) => onDifficulty('again', e)}>Again</button>
<button onClick={(e) => onDifficulty('hard', e)}>Hard</button>
<button onClick={(e) => onDifficulty('got-it', e)}>Got It</button>
```

**Fix Option B: Top of Card (Simpler Fallback)**

If Option A is complex, use fixed position at top center:

```javascript
style={{
  position: 'fixed',
  top: '25%',  // Top quarter of screen (over white space of card)
  left: '50%',
  transform: 'translateX(-50%)',
  // ... rest same
}}
```

**Test:**
- Click "Again" → "+10 min" appears over Again button (or top of card)
- Click "Hard" → "+2 days" appears over Hard button
- Click "Got It" → "+5 days" appears over Got It button
- Animation floats up from button position

---

## 🚀 CRITICAL FEATURE: Phrases Integration

### Problem

User has completed phrases learning but NO phrases are appearing in flashcard sessions.

### Requirements

**From previous decision:**
- Mix phrases in after **20% of chapter lemmas** introduced
- Ratio: **80% lemmas, 20% phrases** per session
- Phrases use same FSRS scheduling as lemmas

### Implementation

**Step 1: Check Phrase Data Available**

```sql
-- How many phrases exist?
SELECT COUNT(*) FROM phrases WHERE chapter_number = 1;

-- Do phrases have chapter_number column?
-- If not, we need to link via phrase_occurrences → sentences → chapters
```

**Step 2: Modify sessionBuilder.js**

Location: `src/services/sessionBuilder.js`

**Update buildLearnSession to include phrases:**

```javascript
async function buildLearnSession(supabase, userId, sessionSize) {
  const unlockedChapters = await getUnlockedChapters(supabase, userId);
  
  // Check chapter progress (% of lemmas introduced)
  const { data: progressData } = await supabase.rpc('get_chapter_progress', {
    p_user_id: userId
  });
  
  // For each chapter, check if 20% lemmas introduced
  const chaptersReadyForPhrases = progressData?.filter(ch => 
    ch.introduced_pct >= 20 && unlockedChapters.includes(ch.chapter_number)
  ).map(ch => ch.chapter_number) || [];
  
  // Calculate lemma vs phrase count
  const lemmaCount = Math.ceil(sessionSize * 0.8);  // 80%
  const phraseCount = Math.floor(sessionSize * 0.2);  // 20%
  
  // Fetch unintroduced lemmas
  const { data: newLemmas } = await supabase
    .from('lemmas')
    .select(`
      lemma_id,
      lemma_text,
      definitions,
      part_of_speech,
      words!inner (
        word_id,
        word_text,
        sentence_id,
        sentences!inner (
          sentence_text,
          sentence_translation
        )
      )
    `)
    .in('chapter_number', unlockedChapters)
    .eq('is_stop_word', false)
    .not('lemma_id', 'in', `(
      SELECT lemma_id FROM user_lemma_progress WHERE user_id = '${userId}'
    )`)
    .order('chapter_number', { ascending: true })
    .order('frequency', { ascending: false })
    .limit(lemmaCount);
  
  // Fetch unintroduced phrases (if chapter ready)
  let newPhrases = [];
  if (chaptersReadyForPhrases.length > 0) {
    const { data: phrasesData } = await supabase
      .from('phrases')
      .select(`
        phrase_id,
        phrase_text,
        definitions,
        phrase_type,
        phrase_occurrences!inner (
          sentence_id,
          sentences!inner (
            sentence_text,
            sentence_translation,
            chapter_id,
            chapters!inner (
              chapter_number
            )
          )
        )
      `)
      .in('phrase_occurrences.sentences.chapters.chapter_number', chaptersReadyForPhrases)
      .not('phrase_id', 'in', `(
        SELECT phrase_id FROM user_phrase_progress WHERE user_id = '${userId}'
      )`)
      .limit(phraseCount);
    
    newPhrases = phrasesData || [];
  }
  
  // Transform lemmas to card format
  const lemmaCards = (newLemmas || []).map(lemma => ({
    lemma_id: lemma.lemma_id,
    lemma: lemma.lemma_text,
    english_definition: Array.isArray(lemma.definitions) ? lemma.definitions[0] : lemma.definitions,
    part_of_speech: lemma.part_of_speech,
    word_in_sentence: lemma.words?.[0]?.word_text,
    example_sentence: lemma.words?.[0]?.sentences?.sentence_text,
    example_sentence_translation: lemma.words?.[0]?.sentences?.sentence_translation,
    stability: null,
    difficulty: 5.0,
    fsrs_state: 0,
    reps: 0,
    lapses: 0,
    is_new: true,
    card_type: 'lemma'
  }));
  
  // Transform phrases to card format
  const phraseCards = newPhrases.map(phrase => ({
    phrase_id: phrase.phrase_id,
    lemma: phrase.phrase_text,  // Use lemma field for consistency
    english_definition: Array.isArray(phrase.definitions) ? phrase.definitions[0] : phrase.definitions,
    part_of_speech: 'PHRASE',  // Special type
    word_in_sentence: phrase.phrase_text,  // Phrase appears as-is
    example_sentence: phrase.phrase_occurrences?.[0]?.sentences?.sentence_text,
    example_sentence_translation: phrase.phrase_occurrences?.[0]?.sentences?.sentence_translation,
    stability: null,
    difficulty: 5.0,
    fsrs_state: 0,
    reps: 0,
    lapses: 0,
    is_new: true,
    card_type: 'phrase'
  }));
  
  // Combine and shuffle
  const allCards = [...lemmaCards, ...phraseCards];
  return shuffleArray(allCards).slice(0, sessionSize);
}
```

**Step 3: Update Progress Tracking**

Location: `src/hooks/flashcard/useProgressTracking.js`

**Handle both lemma and phrase progress:**

```javascript
const updateProgress = async (card, difficulty, isExposure = false) {
  if (!user?.id) return;

  // Determine if lemma or phrase
  const isPhrase = card.card_type === 'phrase';
  const tableName = isPhrase ? 'user_phrase_progress' : 'user_lemma_progress';
  const idField = isPhrase ? 'phrase_id' : 'lemma_id';
  const cardId = isPhrase ? card.phrase_id : card.lemma_id;

  if (isExposure) {
    await supabase
      .from(tableName)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq(idField, cardId);
    return { success: true, exposure: true };
  }

  // Map button to FSRS rating
  const ratingMap = {
    'again': FSRSRating.Again,
    'hard': FSRSRating.Hard,
    'got-it': FSRSRating.Good
  };
  const rating = ratingMap[difficulty];

  // Calculate new FSRS state
  const updatedState = scheduleCard(card, rating);

  // Update database (same for lemmas and phrases)
  const { error } = await supabase
    .from(tableName)
    .upsert({
      user_id: user.id,
      [idField]: cardId,
      stability: updatedState.stability,
      difficulty: updatedState.difficulty,
      due_date: updatedState.due_date,
      fsrs_state: updatedState.fsrs_state,
      reps: updatedState.reps,
      lapses: updatedState.lapses,
      last_reviewed_at: updatedState.last_reviewed_at,
      last_seen_at: updatedState.last_seen_at,
      updated_at: new Date().toISOString()
    }, {
      onConflict: `user_id,${idField}`
    });

  if (error) {
    console.error('Failed to update progress:', error);
    return { success: false, error };
  }

  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('user_daily_stats')
    .upsert({
      user_id: user.id,
      date: today,
      words_reviewed: supabase.raw('words_reviewed + 1'),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date',
      ignoreDuplicates: false
    });

  return { success: true, updatedState, exposure: false };
};
```

**Step 4: Update Review Mode**

Also update `buildReviewSession` to include due phrases:

```javascript
async function buildReviewSession(supabase, userId, sessionSize) {
  // ... existing logic for due lemmas ...
  
  // Also get due phrases
  const { data: duePhrases } = await supabase
    .from('user_phrase_progress')
    .select(`
      *,
      phrases!inner (
        phrase_id,
        phrase_text,
        definitions,
        phrase_type
      )
    `)
    .eq('user_id', userId)
    .lte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true });
  
  // Transform phrases to card format and combine with lemmas
  // ...
}
```

**Step 5: Visual Distinction (Optional)**

Show phrase badge instead of part of speech:

In FlashcardDisplay.jsx:
```jsx
{card.card_type === 'phrase' && (
  <span style={{
    position: 'absolute',
    top: '12px',
    left: '12px',  // Left side for phrases
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#7c3aed',  // Purple for phrases
  }}>
    Phrase
  </span>
)}
```

---

## Testing Checklist

### Polish Fixes
- [ ] "Again" button doesn't increment progress (stays at 2/15)
- [ ] Card requeued to end of deck
- [ ] Part of speech removed from Spanish card
- [ ] Part of speech shows on English card as full word (adjective, not ADJ)
- [ ] Soft gray color (#94a3b8)
- [ ] Animation appears over clicked button (or top of card)
- [ ] Animation smooth and positioned correctly

### Phrases Integration
- [ ] User has 20%+ of Chapter 1 lemmas introduced
- [ ] Learn New session includes phrases
- [ ] Ratio approximately 80% lemmas, 20% phrases (12 lemmas, 3 phrases in 15-card session)
- [ ] Phrase cards display correctly
- [ ] "phrase" shows on back instead of "noun/verb"
- [ ] Phrase progress tracked in user_phrase_progress table
- [ ] Review mode includes due phrases
- [ ] FSRS scheduling works for phrases

---

## Implementation Order

**Hour 1: Critical Fixes**
1. Fix "Again" button behavior (Issue #1) - 30 min
2. Move part of speech to English card (Issue #2) - 15 min
3. Fix animation position (Issue #3) - 15 min

**Hour 2-3: Phrases Integration**
4. Update buildLearnSession for phrase queries - 45 min
5. Update progress tracking for phrases - 30 min
6. Update buildReviewSession for phrases - 30 min
7. Test end-to-end - 15 min

**Total: ~3 hours**

---

## Files to Modify

**Polish Fixes:**
- `src/pages/Flashcards.jsx` - "Again" button logic, animation position
- `src/components/flashcard/FlashcardDisplay.jsx` - Part of speech placement
- `src/components/flashcard/FloatingFeedback.jsx` - Animation positioning
- `src/components/flashcard/DifficultyButtons.jsx` - Pass event to handlers

**Phrases Integration:**
- `src/services/sessionBuilder.js` - Add phrase queries to both modes
- `src/hooks/flashcard/useProgressTracking.js` - Handle phrase progress
- `src/components/flashcard/FlashcardDisplay.jsx` - Optional phrase badge

---

## Database Schema Check

Before implementing, verify:

```sql
-- Check phrase_occurrences links to sentences
SELECT * FROM phrase_occurrences LIMIT 1;

-- Check if phrases can be filtered by chapter
SELECT p.*, po.*, s.chapter_id, c.chapter_number
FROM phrases p
JOIN phrase_occurrences po ON p.phrase_id = po.phrase_id
JOIN sentences s ON po.sentence_id = s.sentence_id
JOIN chapters c ON s.chapter_id = c.chapter_id
LIMIT 5;
```

If phrases don't have direct chapter_number, we join through:
phrases → phrase_occurrences → sentences → chapters

---

**Ready for implementation!**
