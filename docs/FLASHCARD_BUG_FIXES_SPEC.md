# Flashcard Bug Fixes Specification
## Critical UX and Functionality Issues

**Date:** December 13, 2025  
**Priority:** Critical bugs must be fixed before proceeding to features

---

## Issue Summary

FSRS algorithm is working correctly, but several UI/UX bugs are breaking the user experience:
- Word duplication in sentences
- Card counts not respecting user settings
- Verb conjugations not bolding properly
- Mode toggle appearing during active sessions
- Badge placement issues

---

## 🔴 CRITICAL FIXES (Do These First)

### Fix #1: Word Duplication in Sentence

**Problem:** 
Words appear twice in sentences: "el fracaso**el fracaso**" instead of "**el fracaso**"

**Location:** `src/components/flashcard/FlashcardDisplay.jsx`

**Root Cause:**
Likely inserting the word twice when trying to bold it in the sentence.

**Fix:**
```javascript
// FIND the sentence bolding logic (probably in FlashcardDisplay.jsx)
// It's currently doing something like:
const boldedSentence = sentence.replace(word, `<strong>${word}</strong>${word}`);

// CHANGE TO:
const boldedSentence = sentence.replace(
  new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'),
  `<strong>$&</strong>`
);

// Helper function:
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

**Test:**
- Display card with "el fracaso"
- Sentence should show: "Había quedado desilusionado por **el fracaso** de mis dibujos"
- Word should appear exactly once, bolded

---

### Fix #2: Card Counts Not Respecting User Settings

**Problem:**
- User has set "Cards Per Session: 15" in settings
- But sessions show 13, 16, 12 cards randomly

**Location:** `src/services/sessionBuilder.js` + `src/pages/Flashcards.jsx`

**Root Cause:**
Session builder not reading user settings from database.

**Fix:**

**Step 1:** Fetch user settings
```javascript
// In sessionBuilder.js - buildSession() function
export async function buildSession(mode, options, supabase, userId) {
  // ADD: Fetch user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('cards_per_session')
    .eq('user_id', userId)
    .single();
  
  const sessionSize = settings?.cards_per_session || 25; // Default to 25
  
  // Use sessionSize instead of hardcoded values
  // ...
}
```

**Step 2:** Remove hardcoded sessionSize
```javascript
// In Flashcards.jsx - loadSession() function
const options = {
  // REMOVE: sessionSize: 25,
  chapterNumber: sessionMode === 'chapter' ? 1 : undefined
};

// sessionBuilder will now use user settings
```

**Test:**
- Set "Cards Per Session: 20" in settings
- Start learn session
- Should show "1/20 Cards" exactly
- All sessions should respect this setting

---

### Fix #3: Verb Conjugations Not Bolding

**Problem:**
- Lemma: "vivir" (infinitive)
- Sentence: "Cuando yo **vivía** seis años..." (imperfect conjugation)
- Currently: "vivía" is NOT bolded (only works for nouns)

**Location:** `src/hooks/flashcard/useFlashcardData.js` or `FlashcardDisplay.jsx`

**Root Cause:**
Trying to match exact lemma text instead of finding the word instance in the sentence.

**Fix:**

**Proper approach:** Use the words table to find which word in the sentence corresponds to this lemma.

```javascript
// In useFlashcardData.js when building card objects:

// CURRENT (wrong):
const sentencesMap = {}
wordsData?.forEach(w => {
  if (!sentencesMap[w.lemma_id] && w.sentences) {
    sentencesMap[w.lemma_id] = {
      sentence_text: w.sentences.sentence_text,
      sentence_translation: w.sentences.sentence_translation
    }
  }
})

// CHANGE TO (correct):
const sentencesMap = {}
wordsData?.forEach(w => {
  if (!sentencesMap[w.lemma_id] && w.sentences) {
    sentencesMap[w.lemma_id] = {
      sentence_text: w.sentences.sentence_text,
      sentence_translation: w.sentences.sentence_translation,
      word_in_sentence: w.word_text  // ADD THIS - the actual word form
    }
  }
})

// Then when displaying:
// Bold the word_in_sentence (conjugated form) not the lemma
```

**In FlashcardDisplay.jsx:**
```javascript
// Use card.word_in_sentence instead of card.lemma for bolding
const boldWord = card.word_in_sentence || card.lemma;

// Then bold this actual word in the sentence
const boldedSentence = card.example_sentence?.replace(
  new RegExp(`\\b${escapeRegex(boldWord)}\\b`, 'gi'),
  '<strong>$&</strong>'
);
```

**Test:**
- Display card with verb lemma "vivir"
- Sentence with "vivía" should bold "vivía" (not try to find "vivir")
- Display card with noun "el libro"
- Sentence should bold "el libro" correctly

---

### Fix #4: Bold English Translation Too

**Problem:**
Spanish sentence bolds "el fracaso" but English translation shows plain "failure"

**Location:** `src/components/flashcard/FlashcardDisplay.jsx`

**Fix:**

**Step 1:** Extract English word from definitions
```javascript
// Get the English equivalent to bold
const englishWord = card.english_definition?.split(',')[0]?.trim(); // Get first definition
```

**Step 2:** Bold it in translation
```javascript
const boldedTranslation = card.example_sentence_translation?.replace(
  new RegExp(`\\b${escapeRegex(englishWord)}\\b`, 'gi'),
  '<strong>$&</strong>'
);
```

**Test:**
- Front: "el fracaso" bolded in Spanish sentence
- Back: "failure" bolded in English translation

---

## 🟡 HIGH PRIORITY FIXES

### Fix #5: Remove Mode Toggle During Session

**Problem:**
"Review Due / Learn New" buttons visible during active session. Clicking them exits current session.

**Location:** `src/pages/Flashcards.jsx`

**Fix:**
```javascript
// ONLY show mode selector when no active session
{sessionComplete || currentIndex === 0 ? (
  <div className="mode-selector">
    <button onClick={() => setSessionMode('review')}>Review Due</button>
    <button onClick={() => setSessionMode('learn')}>Learn New</button>
  </div>
) : null}
```

**Or better:** Show mode selector on session complete screen, not during session.

**Test:**
- Start session
- Mode toggle should disappear
- Complete session
- Mode toggle reappears for next session

---

### Fix #6: Move "+ New Word" Badge Inside Card

**Problem:**
Badge floating above card, disconnected from card design.

**Location:** `src/components/flashcard/FlashcardDisplay.jsx`

**Current:**
```jsx
{card.is_new && (
  <div className="new-word-badge">
    + New Word
  </div>
)}
<div className="flashcard">...</div>
```

**Change to:**
```jsx
<div className="flashcard">
  {/* Badge inside card, top-right corner */}
  {card.is_new && (
    <span className="badge badge-new">
      New Word
    </span>
  )}
  
  {/* Card content */}
  ...
</div>
```

**Styling:**
```css
.badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
}

.badge-new {
  background: rgba(134, 239, 172, 0.2); /* Light green */
  color: #15803d; /* Dark green */
  border: 1px solid rgba(134, 239, 172, 0.4);
}
```

**Test:**
- New word card shows badge in top-right corner
- Badge stays inside card boundaries
- Matches "Exit" and "1/13 Cards" visual style

---

### Fix #7: Increase Sentence Text Size

**Problem:**
Sentences are too small to read comfortably.

**Location:** `src/components/flashcard/FlashcardDisplay.jsx`

**Fix:**
```css
/* Find sentence styling */
.sentence {
  font-size: 16px;  /* CHANGE FROM: 14px or smaller */
  line-height: 1.6;
  margin-top: 24px;
  color: #64748b;
  font-family: 'Inter', sans-serif;
}
```

**Test:**
- Sentences should be clearly readable
- Not overwhelming the card
- Comfortable on mobile

---

## Testing Checklist

After implementing fixes:

**Critical Fixes:**
- [ ] No word duplication in sentences
- [ ] Card counts match user settings exactly (15 cards = 15 cards)
- [ ] Verb conjugations bold correctly (vivía, not vivir)
- [ ] English translations bold matching word

**High Priority:**
- [ ] Mode toggle hidden during active session
- [ ] "+ New Word" badge inside card, top-right
- [ ] Sentence text larger and readable

**Regression Tests:**
- [ ] Cards still flip correctly
- [ ] Buttons still work (Again/Hard/Got It)
- [ ] Progress updates in database
- [ ] Session completes properly

---

## Next Steps After Fixes

Once these critical issues are resolved:

**Phase 2: Enhancements**
1. Floating "+2 days" animation (replace yellow notification)
2. Integrate phrases (after 20% of chapter lemmas introduced)
3. Better session complete screen

**Phase 3: Homepage Dashboard**
1. Chapter progress bars
2. Calendar with streak tracking
3. Review stats and forecasts
4. Move settings to header

---

## Implementation Order

**Hour 1: Critical Bugs**
1. Fix word duplication (Fix #1)
2. Fix card counts (Fix #2)
3. Fix verb bolding (Fix #3)
4. Fix English bolding (Fix #4)

**Hour 2: High Priority**
5. Remove mode toggle during session (Fix #5)
6. Move badge inside card (Fix #6)
7. Increase sentence size (Fix #7)

**Hour 3: Testing**
- Run through checklist
- Test on actual data
- Verify FSRS still working

**Total Time: ~3 hours**

---

## Questions for Implementation

**Verb Bolding:**
- Confirm words table has word_text column with conjugated forms
- If not, we need alternative approach (lemmatization lookup)

**Card Counts:**
- Verify user_settings table has cards_per_session column
- Default should be 25 if user hasn't set preference

**Mode Toggle:**
- Should it appear on session start screen?
- Or only after completing a session?

---

**Ready for implementation. Start with Critical Fixes (#1-4) first.**
