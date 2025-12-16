# Flashcard Remaining Fixes Specification
## Issues from User Testing Feedback

**Date:** December 13, 2025  
**Status:** 4/7 fixes working, 3 styling issues + 1 critical issue remain

---

## 🔴 CRITICAL ISSUE

### Issue #1: Only 6 Cards in Session Instead of 15

**Problem:**
- User has set "Cards Per Session: 15" in settings
- Session shows "1/6 Cards" - only 6 cards loaded
- This is inconsistent and confusing

**Investigation needed:**

**Check 1: How many unintroduced lemmas exist?**
```sql
-- Run this query to check available new words
SELECT COUNT(*) as available_new_words
FROM lemmas l
WHERE l.lemma_id NOT IN (
  SELECT lemma_id FROM user_lemma_progress WHERE user_id = 'YOUR_USER_ID'
)
AND l.is_stop_word = false
AND l.chapter_number = 1;  -- Assuming Chapter 1
```

**Check 2: What's the Learn New query doing?**

Location: `src/services/sessionBuilder.js` - `buildLearnSession()`

Current logic should be:
```javascript
const { data: newWords } = await supabase
  .from('lemmas')
  .select(...)
  .in('chapter_number', unlockedChapters)
  .not('lemma_id', 'in', `(SELECT lemma_id FROM user_lemma_progress WHERE user_id = '${userId}')`)
  .limit(sessionSize);  // Should be 15 from user settings
```

**Possible causes:**
1. Only 6 unintroduced words left in Chapter 1
2. Query filtering incorrectly
3. sessionSize not being passed correctly
4. Unlocked chapters logic broken

**Fix approach:**

**If only 6 words left:**
- This is correct behavior
- User has already learned most of Chapter 1
- Session will naturally be smaller

**If query is broken:**
- Debug the buildLearnSession query
- Log the sessionSize value
- Check unlockedChapters array
- Verify the NOT IN subquery works

**Test:**
```javascript
// Add console.log in buildLearnSession
console.log('Building learn session:', {
  sessionSize,
  unlockedChapters,
  userId
});

// After query:
console.log('New words found:', newWords?.length);
```

---

## 🟡 STYLING FIXES

### Issue #2: "New Word" Badge Styling

**Problem:**
Badge looks different from the rest of the UI. Should match "1/6 Cards" styling.

**Current badge styling:**
```css
.badge-new {
  background: rgba(134, 239, 172, 0.2);
  color: #15803d;
  border: 1px solid rgba(134, 239, 172, 0.4);
}
```

**Change to match header style:**

Location: `src/components/flashcard/FlashcardDisplay.jsx`

```jsx
{card.is_new && (
  <span style={{
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif',
    background: 'rgba(134, 239, 172, 0.15)',  // More subtle
    color: '#15803d',
    border: 'none'  // Remove border for cleaner look
  }}>
    New Word
  </span>
)}
```

**Reference the "1/6 Cards" styling:**
- Font: Inter, sans-serif
- Font weight: 600
- Font size: ~14px
- Clean, minimal look
- No heavy borders

---

### Issue #3: Sentence Italic Consistency

**Problem:**
- Spanish sentence: Regular text (not italic)
- English sentence: Italic text
- Both should be italic for consistency

**Fix:**

Location: `src/components/flashcard/FlashcardDisplay.jsx`

**Spanish sentence (front of card):**
```jsx
<p style={{
  fontSize: '18px',
  lineHeight: 1.6,
  marginTop: '24px',
  color: '#64748b',
  fontFamily: 'Inter, sans-serif',
  fontStyle: 'italic',  // ADD THIS
  textAlign: 'center'
}}>
  {/* Spanish sentence with bolded word */}
</p>
```

**English sentence (back of card):**
```jsx
<p style={{
  fontSize: '18px',
  lineHeight: 1.6,
  marginTop: '24px',
  color: '#64748b',
  fontFamily: 'Inter, sans-serif',
  fontStyle: 'italic',  // KEEP THIS
  textAlign: 'center'
}}>
  {/* English sentence - NO BOLDING */}
</p>
```

---

### Issue #4: Remove English Word Bolding

**Problem:**
English translations aren't always perfect word-for-word matches, so bolding can be confusing or wrong.

**Fix:**

Location: `src/components/flashcard/FlashcardDisplay.jsx`

**Find the English sentence rendering code and comment out bolding:**

```javascript
// BEFORE (with bolding):
const englishWord = card.english_definition?.split(',')[0]?.trim();
const boldedTranslation = highlightWordInSentence(
  card.example_sentence_translation,
  englishWord
);

// Display: {boldedTranslation}

// AFTER (no bolding):
// English word bolding removed - translations aren't always literal matches
// const englishWord = card.english_definition?.split(',')[0]?.trim();
// const boldedTranslation = highlightWordInSentence(
//   card.example_sentence_translation,
//   englishWord
// );

// Display: {card.example_sentence_translation}  // Plain text, no bolding
```

**Keep the Spanish bolding - only remove English bolding.**

---

## 🎨 ANIMATION FIX

### Issue #5: Replace Yellow Notification with Dissolve Animation

**Problem:**
Ugly yellow notification box appears after clicking a button:
```
⏰ Next review: 10 min
Health will still improve, but mastery points require more time.
```

**Replace with:**
Floating "+10 min" text that dissolves upward with animation.

**Implementation:**

**Step 1: Install Framer Motion**
```bash
npm install framer-motion
```

**Step 2: Create FloatingFeedback component**

New file: `src/components/flashcard/FloatingFeedback.jsx`

```javascript
import { motion, AnimatePresence } from 'framer-motion';

export function FloatingFeedback({ message, visible }) {
  if (!message) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: -50 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ duration: 2, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '24px',
            fontWeight: '700',
            fontFamily: 'Inter, sans-serif',
            color: '#b5838d',  // Muted mauve color from design system
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

**Step 3: Integrate into Flashcards.jsx**

```javascript
import { FloatingFeedback } from '../components/flashcard/FloatingFeedback';

export function Flashcards() {
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  async function handleDifficulty(difficulty) {
    const card = cards[currentIndex];
    
    // Update progress
    const result = await updateProgress(card, difficulty, card.is_exposure);
    
    // Calculate interval for feedback
    const intervals = {
      'again': '10 min',
      'hard': '2 days',
      'got-it': '5 days'
    };
    
    // Show floating feedback
    setFeedbackMessage(`+${intervals[difficulty]}`);
    setShowFeedback(true);
    
    // Hide after 2 seconds
    setTimeout(() => setShowFeedback(false), 2000);
    
    // Move to next card (with slight delay so user sees animation)
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        setSessionComplete(true);
      }
    }, 300);
  }

  return (
    <div>
      {/* Existing flashcard UI */}
      
      {/* Floating feedback animation */}
      <FloatingFeedback message={feedbackMessage} visible={showFeedback} />
    </div>
  );
}
```

**Step 4: Remove old yellow notification**

Find and remove the existing time gate notification:
```javascript
// REMOVE this old notification logic:
{timeGateMessage && (
  <div className="time-gate-notification" style={{
    background: 'yellow',
    padding: '12px',
    // ... ugly styling
  }}>
    {timeGateMessage}
  </div>
)}
```

**Visual result:**
- User clicks "Got It"
- "+5 days" appears in muted mauve color
- Floats upward while fading out
- Dissolves completely after 2 seconds
- Smooth, professional animation

---

## Testing Checklist

After implementing fixes:

**Critical:**
- [ ] Session shows correct number of cards (15 if available)
- [ ] If only 6 words available, that's correct behavior
- [ ] Console log shows why (e.g., "Only 6 new words left in Chapter 1")

**Styling:**
- [ ] "New Word" badge matches header styling
- [ ] Both Spanish and English sentences in italic
- [ ] English sentence has NO bolding
- [ ] Spanish sentence still has bolding

**Animation:**
- [ ] Yellow notification box removed
- [ ] Floating "+X days" appears after button click
- [ ] Animation dissolves smoothly upward
- [ ] No jarring transitions

---

## Implementation Order

**Hour 1: Debug Card Count**
1. Add logging to buildLearnSession
2. Check available new words in database
3. Fix if query broken, or confirm behavior correct

**Hour 2: Styling Fixes**
4. Update "New Word" badge styling
5. Make both sentences italic
6. Remove English bolding (comment out)

**Hour 3: Animation**
7. Install framer-motion
8. Create FloatingFeedback component
9. Integrate into Flashcards.jsx
10. Remove old yellow notification

**Total: ~3 hours**

---

## Questions for Implementation

**Card Count Issue:**
- Is this a bug or are we just running out of new words?
- Need to verify with database query

**Animation Timing:**
- Should feedback show before or after card advances?
- Current spec: Show feedback, wait 300ms, advance card

**Framer Motion:**
- Alternative: CSS animations if we want to avoid new dependency
- Framer Motion is cleaner and more powerful

---

**Ready for implementation. Start with debugging the card count issue first.**
