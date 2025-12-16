# FLASHCARD UI REDESIGN - IMPLEMENTATION SPEC

## Overview
Update Voquab flashcard interface with new clean design featuring:
- 3-button system (Again/Hard/Got It) instead of 4 buttons
- Simplified card layout (Spanish → English only, no canonical forms)
- Muted earthy color palette
- Modern fonts (Montserrat + Inter)
- Smooth flip animation with overshoot

## Color Palette
```
Card progress number: #b5838d (muted mauve)
Again button: #6d6875 (dusty purple)
Hard button: #e5989b (dusty rose)  
Got It button: #ffcdb2 (peach)
Background: Keep existing gradient (from-slate-50 to-slate-100)
```

## Font System
```
Main word: Montserrat (600, 700, 800 weights)
UI text: Inter (400, 500, 600 weights)
Import URL: https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap
```

## Button Mapping Logic
Map new 3-button system to existing 4-difficulty backend:
- **Again** → `'dont-know'` (requeue card, lowest mastery impact)
- **Hard** → `'hard'` (near-term review)
- **Got It** → `'easy'` (standard spaced repetition)
- ~~Medium~~ (removed from UI, merge into "Got It")

---

## FILE 1: src/components/flashcard/FlashcardDisplay.jsx

**REPLACE ENTIRE FILE** with this code:

```jsx
export default function FlashcardDisplay({
  card,
  isFlipped,
  onCardClick
}) {
  if (!card) {
    return (
      <div className="text-center text-gray-500">
        No card to display
      </div>
    )
  }

  // Extract display data
  const displayLemma = card.lemma
  const displayTranslation = card.english_definition
  const displayPOS = card.part_of_speech

  // Helper to highlight word in sentence
  const highlightWordInSentence = (sentence, word) => {
    if (!sentence || !word) return sentence
    
    const regex = new RegExp(`\\b(${word})\\b`, 'gi')
    const parts = sentence.split(regex)
    const matches = sentence.match(regex) || []

    return parts.map((part, index) => (
      <span key={index}>
        {part}
        {matches[index] && (
          <span className="font-bold text-gray-800">
            {matches[index]}
          </span>
        )}
      </span>
    ))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        
        .flip-card {
          perspective: 1000px;
        }
        
        .flip-card-inner {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          transform-style: preserve-3d;
          position: relative;
        }
        
        .flip-card-inner.flipped {
          transform: rotateY(180deg);
        }
        
        .flip-card-front, .flip-card-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        
        .flip-card-back {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Card container with flip effect */}
      <div className="flip-card mb-8">
        <div 
          onClick={onCardClick}
          className={`flip-card-inner ${isFlipped ? 'flipped' : ''} cursor-pointer`}
        >
          {/* Front - Spanish Side */}
          <div className="flip-card-front bg-white rounded-3xl shadow-2xl p-8 h-[550px] flex flex-col justify-between border border-slate-100">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-auto"></div>
              <div>
                <h1 
                  className="text-7xl font-bold text-slate-800 mb-4 tracking-tight lowercase"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayLemma}
                </h1>
                <p 
                  className="text-slate-500 text-lg"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  ({displayPOS})
                </p>
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* Spanish sentence at bottom */}
            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p 
                className="text-slate-400 text-base leading-relaxed"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                "{highlightWordInSentence(card.example_sentence, card.lemma)}"
              </p>
            </div>
          </div>

          {/* Back - English Side */}
          <div className="flip-card-back bg-white rounded-3xl shadow-2xl p-8 h-[550px] flex flex-col justify-between border border-slate-100">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-auto"></div>
              <div>
                <h1 
                  className="text-6xl font-bold text-slate-800 mb-4"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {displayTranslation}
                </h1>
              </div>
              <div className="mb-auto"></div>
            </div>

            {/* English sentence at bottom */}
            <div className="mt-6 pt-6 border-t border-slate-200 text-center">
              <p 
                className="text-slate-400 text-base leading-relaxed italic"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                "{card.example_sentence_translation}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hint text */}
      {!isFlipped && (
        <p 
          className="text-center text-slate-400 text-sm mt-4"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Tap card to reveal translation
        </p>
      )}
    </div>
  )
}
```

**KEY CHANGES:**
- Removed all canonical form logic
- Removed chapter badge
- Removed grammatical context
- Simplified to: Spanish word + POS + sentence → English translation + sentence
- Added flip animation CSS with overshoot
- Added Google Fonts import
- Lowercase Spanish word display
- Fixed height (550px) to prevent button jumping

---

## FILE 2: src/components/flashcard/DifficultyButtons.jsx

**REPLACE ENTIRE FILE** with this code:

```jsx
import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'

export default function DifficultyButtons({
  onDifficulty,
  disabled = false,
  timeGateMessage = null
}) {
  return (
    <div className="max-w-2xl mx-auto mt-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        .button-hover {
          transition: transform 0.3s ease-out, opacity 0.3s ease-out;
        }
        
        .button-hover:hover {
          transform: scale(1.25);
        }
        
        .button-hover:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* Time gate message */}
      {timeGateMessage && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <div className="text-sm text-yellow-800" style={{ fontFamily: 'Inter, sans-serif' }}>
            ⏰ {timeGateMessage}
          </div>
          <div className="text-xs text-yellow-600 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Health will still improve, but mastery points require more time.
          </div>
        </div>
      )}

      {/* Icon Buttons - 3 buttons with muted earthy colors */}
      <div className="grid grid-cols-3 gap-8 px-2">
        {/* Again Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('again'); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <RotateCcw 
            size={36} 
            strokeWidth={2.5} 
            style={{ color: '#6d6875' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-300"
          />
          <span 
            className="text-sm font-semibold transition-all duration-300"
            style={{ color: '#6d6875' }}
          >
            Again
          </span>
        </button>

        {/* Hard Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('hard'); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <AlertCircle 
            size={36} 
            strokeWidth={2.5} 
            style={{ color: '#e5989b' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-300"
          />
          <span 
            className="text-sm font-semibold transition-all duration-300"
            style={{ color: '#e5989b' }}
          >
            Hard
          </span>
        </button>

        {/* Got It Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDifficulty('got-it'); }}
          disabled={disabled}
          className="py-3 button-hover flex flex-col items-center justify-center gap-2 group disabled:opacity-30"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          <CheckCircle 
            size={36} 
            strokeWidth={2.5} 
            style={{ color: '#ffcdb2' }}
            className="group-hover:opacity-100 opacity-60 transition-opacity duration-300"
          />
          <span 
            className="text-sm font-semibold transition-all duration-300"
            style={{ color: '#ffcdb2' }}
          >
            Got It
          </span>
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-4 text-center text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
        💡 Use keyboard: 1 (Again) • 2 (Hard) • 3 (Got It) • Space (Flip)
      </div>
    </div>
  )
}
```

**KEY CHANGES:**
- 3 buttons instead of 4
- New button values: 'again', 'hard', 'got-it'
- Muted color palette
- Icons from lucide-react (already in project)
- Hover scale animation
- Keyboard shortcuts updated (1/2/3)
- Removed emoji icons, using lucide icons instead

---

## FILE 3: src/components/flashcard/SessionStats.jsx

**UPDATE** the progress number color:

**FIND** (around line 78):
```jsx
<div className="text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
  <span className="text-amber-600">{currentCard}</span>
```

**REPLACE WITH:**
```jsx
<div className="text-lg font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
  <span style={{ color: '#b5838d' }}>{currentCard}</span>
```

**NO OTHER CHANGES** to this file.

---

## FILE 4: src/hooks/flashcard/useFlashcardSession.js

**UPDATE** keyboard shortcuts section:

**FIND** (around line 30-40):
```jsx
function handleKeyPress(e) {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    handleCardClick()
  } else if (isFlipped) {
    if (e.key === '1') handleDifficulty('dont-know')
    else if (e.key === '2') handleDifficulty('hard')
    else if (e.key === '3') handleDifficulty('medium')
    else if (e.key === '4') handleDifficulty('easy')
  }
}
```

**REPLACE WITH:**
```jsx
function handleKeyPress(e) {
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    handleCardClick()
  }
  // Allow keyboard shortcuts regardless of flip state
  if (e.key === '1') handleDifficulty('again')
  else if (e.key === '2') handleDifficulty('hard')
  else if (e.key === '3') handleDifficulty('got-it')
}
```

**UPDATE** handleDifficulty function to map new button values:

**FIND** (around line 70-75):
```jsx
function handleDifficulty(difficulty) {
  // REMOVED: if (!isFlipped) return - allow rating before flipping
  console.log('🎴 Session handleDifficulty:', { difficulty, isFlipped, currentIndex })

  // Update session ratings
  setSessionRatings(prev => ({
    ...prev,
    [difficulty]: (prev[difficulty] || 0) + 1
  }))
```

**REPLACE WITH:**
```jsx
function handleDifficulty(difficulty) {
  console.log('🎴 Session handleDifficulty:', { difficulty, isFlipped, currentIndex })

  // Map new button values to session tracking
  const trackingKey = difficulty === 'again' ? 'dont-know' : 
                      difficulty === 'got-it' ? 'easy' : 
                      difficulty // 'hard' stays 'hard'

  // Update session ratings
  setSessionRatings(prev => ({
    ...prev,
    [trackingKey]: (prev[trackingKey] || 0) + 1
  }))
```

**UPDATE** the requeue logic:

**FIND** (around line 85):
```jsx
// Handle "Don't Know" - requeue card
if (difficulty === 'dont-know') {
  requeueCard()
```

**REPLACE WITH:**
```jsx
// Handle "Again" - requeue card
if (difficulty === 'again') {
  requeueCard()
```

**NO OTHER CHANGES** to this file.

---

## FILE 5: src/pages/Flashcards.jsx

**UPDATE** handleDifficulty function to map button values to backend:

**FIND** (around line 56-75):
```jsx
async function handleDifficulty(difficulty) {
  console.log('🎯 Button clicked:', { difficulty, currentCard: currentCard?.lemma })

  if (!currentCard) {
    console.error('❌ No current card!')
    return
  }

  console.log('📤 Calling updateProgress...')

  // Update progress in database
  const result = await updateProgress(currentCard, difficulty)
```

**REPLACE WITH:**
```jsx
async function handleDifficulty(difficulty) {
  console.log('🎯 Button clicked:', { difficulty, currentCard: currentCard?.lemma })

  if (!currentCard) {
    console.error('❌ No current card!')
    return
  }

  // Map new button values to existing backend difficulty system
  const backendDifficulty = difficulty === 'again' ? 'dont-know' :
                            difficulty === 'got-it' ? 'easy' :
                            difficulty // 'hard' stays 'hard'

  console.log('📤 Calling updateProgress with:', backendDifficulty)

  // Update progress in database
  const result = await updateProgress(currentCard, backendDifficulty)
```

**UPDATE** session complete summary to show 3 ratings:

**FIND** (around line 290-310 in session complete screen):
```jsx
<div className="grid grid-cols-2 gap-4 text-sm">
  <div>
    <div className="text-gray-600">Don't Know</div>
    <div className="text-xl font-bold text-red-600">{sessionRatings['dont-know']}</div>
  </div>
  <div>
    <div className="text-gray-600">Hard</div>
    <div className="text-xl font-bold text-orange-600">{sessionRatings.hard}</div>
  </div>
  <div>
    <div className="text-gray-600">Medium</div>
    <div className="text-xl font-bold text-yellow-600">{sessionRatings.medium}</div>
  </div>
  <div>
    <div className="text-gray-600">Easy</div>
    <div className="text-xl font-bold text-green-600">{sessionRatings.easy}</div>
  </div>
</div>
```

**REPLACE WITH:**
```jsx
<div className="grid grid-cols-3 gap-4 text-sm">
  <div>
    <div className="text-gray-600">Again</div>
    <div className="text-xl font-bold" style={{ color: '#6d6875' }}>
      {sessionRatings['dont-know'] || 0}
    </div>
  </div>
  <div>
    <div className="text-gray-600">Hard</div>
    <div className="text-xl font-bold" style={{ color: '#e5989b' }}>
      {sessionRatings.hard || 0}
    </div>
  </div>
  <div>
    <div className="text-gray-600">Got It</div>
    <div className="text-xl font-bold" style={{ color: '#ffcdb2' }}>
      {sessionRatings.easy || 0}
    </div>
  </div>
</div>
```

**UPDATE** FlashcardDisplay component call (remove unused props):

**FIND** (around line 350):
```jsx
<FlashcardDisplay
  card={currentCard}
  isFlipped={isFlipped}
  onCardClick={handleCardClick}
  chapterInfo={chapterInfo}
  formatGrammaticalContext={formatGrammaticalContext}
  highlightWordInSentence={highlightWordInSentence}
/>
```

**REPLACE WITH:**
```jsx
<FlashcardDisplay
  card={currentCard}
  isFlipped={isFlipped}
  onCardClick={handleCardClick}
/>
```

**NO OTHER CHANGES** to this file.

---

## TESTING CHECKLIST

After implementation, test the following:

### Visual Tests
- [ ] Card displays Spanish word in lowercase with Montserrat font
- [ ] Card shows part of speech below word
- [ ] Sentence at bottom with bolded target word
- [ ] Card flips smoothly with slight overshoot animation
- [ ] English side shows translation + English sentence
- [ ] Card maintains 550px height (buttons don't jump on flip)
- [ ] 3 buttons display with correct icons and colors
- [ ] Button hover: grows to 125% scale, icons brighten
- [ ] Progress number (1/15) uses #b5838d color

### Functional Tests
- [ ] Click card to flip (space bar also works)
- [ ] Click "Again" button → card requeues later in session
- [ ] Click "Hard" button → progresses to next card
- [ ] Click "Got It" button → progresses to next card
- [ ] Keyboard shortcuts work: 1 (Again), 2 (Hard), 3 (Got It), Space (Flip)
- [ ] Time gate message displays when applicable
- [ ] Session complete screen shows 3-column rating summary
- [ ] All buttons work before AND after flipping card

### Database Tests
- [ ] "Again" button updates as `'dont-know'` in database
- [ ] "Hard" button updates as `'hard'` in database  
- [ ] "Got It" button updates as `'easy'` in database
- [ ] Mastery and health values update correctly
- [ ] Session stats track correctly (dont-know, hard, easy counts)

### Edge Cases
- [ ] Missing sentence displays gracefully
- [ ] Long Spanish words don't overflow card
- [ ] Long translations don't overflow card
- [ ] Rapid clicking doesn't break flip animation
- [ ] Button disabled state works correctly

---

## IMPLEMENTATION STEPS

1. **Backup current files** (optional but recommended)
2. **Install lucide-react** (if not already installed):
   ```bash
   npm install lucide-react
   ```
3. **Update FlashcardDisplay.jsx** - Replace entire file
4. **Update DifficultyButtons.jsx** - Replace entire file
5. **Update SessionStats.jsx** - Change one line (progress color)
6. **Update useFlashcardSession.js** - Keyboard shortcuts + mapping logic
7. **Update Flashcards.jsx** - Button mapping + session summary
8. **Test in browser** - Run through testing checklist
9. **Commit changes** with message: "Redesign flashcard UI with 3-button system and muted color palette"

---

## ROLLBACK PLAN

If issues arise, revert files in this order:
1. Flashcards.jsx (restore button mapping)
2. useFlashcardSession.js (restore keyboard shortcuts)
3. DifficultyButtons.jsx (restore 4-button layout)
4. FlashcardDisplay.jsx (restore canonical form logic)
5. SessionStats.jsx (restore amber color)

---

## NOTES

- **Backend compatibility**: New UI maps to existing difficulty system (dont-know/hard/easy)
- **Medium removed**: "Medium" difficulty merged into "Got It" (easy)
- **Canonical forms**: Removed from UI but still in database - can be restored later if needed
- **Fonts**: Loaded via Google Fonts CDN (no build changes needed)
- **Icons**: Using lucide-react (already in package.json)
- **Animation**: Pure CSS, no additional libraries

---

**END OF SPEC**
