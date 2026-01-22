# CLAUDE CODE PROMPT: Flashcard Feedback Feature

## Task

Implement a user feedback system for flashcards. Users can report errors on any flashcard, and admins can manage these reports through a dedicated admin page.

## Context

- Peter is a solo developer and not a native Spanish speaker
- Translation errors will occur and users need an easy way to report them
- Feedback should be tied to the specific lemma/phrase/sentence being viewed
- Admins need a workflow to review, resolve, and track feedback

## Implementation Phases

### Phase 1: Database

Create a new migration file `supabase/migrations/YYYYMMDD_user_feedback.sql`:

```sql
CREATE TABLE user_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who submitted
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What they're reporting (one of these will be populated)
  lemma_id UUID REFERENCES lemmas(lemma_id) ON DELETE SET NULL,
  phrase_id UUID REFERENCES phrases(phrase_id) ON DELETE SET NULL,
  sentence_id UUID REFERENCES sentences(sentence_id) ON DELETE SET NULL,
  
  -- The feedback
  feedback_text TEXT NOT NULL,
  card_side TEXT CHECK (card_side IN ('front', 'back')),
  
  -- Resolution status
  resolution_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (resolution_status IN ('pending', 'fixed', 'wont_fix')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Admin response (optional)
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes and RLS policies (see full spec for details)
```

Run the migration in Supabase.

---

### Phase 2: Flashcard UI Component

Create `src/components/flashcard/FeedbackPrompt.jsx`:

**Props:**
- `lemmaId` (optional) - UUID if showing a lemma card
- `phraseId` (optional) - UUID if showing a phrase card
- `sentenceId` (optional) - UUID of context sentence
- `cardSide` - 'front' or 'back'

**Behavior:**
1. Default: Show subtle text "Something wrong? Let us know." (muted gray, small)
2. On tap: Slide open a text area (~3 rows) with Cancel and Submit buttons
3. On submit: POST to Supabase, show "✓ Thanks! We'll review this." for 2 seconds
4. Collapse back to default state

**Styling:**
- Match existing app theme
- Muted gray for the prompt text
- Gold accent for Submit button
- Smooth slide animation for expand/collapse

**Integration:**
Find the flashcard component(s) and add `<FeedbackPrompt />` at the bottom of the card, below "Tap card to reveal answer" or similar text. Pass the appropriate IDs based on what type of card is being displayed.

---

### Phase 3: Admin Page

Create `src/pages/AdminFeedback.jsx`:

**Header:**
- Title: "Feedback Management"
- Stats: "X pending" and "X total" counts

**Filters/Controls:**
- Tabs: Active | Archived | All
- Status dropdown: All / Pending / Fixed / Won't Fix
- Sort dropdown: Newest / Oldest / By User
- Search input (searches lemma text, phrase text, feedback content)

**List View (each item shows):**
- Status badge (Pending=amber, Fixed=green, Won't Fix=gray)
- Timestamp (formatted nicely)
- Lemma or Phrase name with link to admin edit page
- Sentence context if available
- User email who submitted
- Feedback text (the user's message)
- Admin notes field (optional, expandable/inline)
- Action buttons: [Mark Fixed] [Won't Fix] [Archive/Unarchive]

**Actions:**
- Mark Fixed: Set `resolution_status='fixed'`, `resolved_at=now()`, `resolved_by=current_user`
- Won't Fix: Set `resolution_status='wont_fix'`, `resolved_at=now()`, `resolved_by=current_user`
- Archive: Set `is_archived=true`
- Unarchive: Set `is_archived=false`

**Linking:**
- "View Lemma →" links to `/admin/lemmas?id={lemma_id}` or wherever lemma editing happens
- "View Phrase →" links to `/admin/phrases?id={phrase_id}` or wherever phrase editing happens

**Empty States:**
- No feedback: "No feedback submissions yet. When users report issues with flashcards, they'll appear here."
- No filter results: "No feedback matches your filters. [Clear filters]"

**Add to Admin Navigation:**
Add "Feedback" link to the admin sidebar/navigation (wherever other admin links are).

---

### Phase 4: Polish

- Loading states for all async operations
- Error handling with user-friendly messages
- Responsive design (works on mobile admin view)
- Update `docs/99_LIVING_CHANGELOG.md`

---

## Key Files to Examine First

Before implementing, check:
1. Current flashcard component structure - where cards are rendered
2. Existing admin page patterns - follow same layout/styling
3. Admin navigation - where to add new link
4. How other admin pages handle list views, filters, actions

---

## Questions to Answer Before Starting

1. What's the main flashcard component file?
2. How are lemma vs phrase cards differentiated in the current code?
3. What's the pattern for admin pages (layout component, styling)?
4. Where is admin navigation defined?

---

## Deliverables

1. Database migration file created and documented
2. `FeedbackPrompt.jsx` component integrated into flashcard display
3. `AdminFeedback.jsx` page with full functionality
4. Admin navigation updated
5. Changelog updated

---

**Start by exploring the flashcard and admin code structure, then implement phase by phase. Report back after each phase.**
