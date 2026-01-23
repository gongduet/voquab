# FLASHCARD FEEDBACK FEATURE SPECIFICATION

**Document Type:** Implementation Specification  
**Created:** January 21, 2026  
**For:** Claude Code Implementation  
**Status:** Ready for Development

---

## OVERVIEW

Allow users to submit feedback on specific flashcards when they notice errors in translations, definitions, or sentence context. Admins can review, manage, and resolve feedback through a dedicated admin page.

**Problem:** Peter is a solo developer and not a native Spanish speaker. Translation errors will occur. Users need an easy way to report issues directly from the flashcard they're viewing.

**Solution:** Inline feedback submission on flashcards + admin workflow page to manage submissions.

---

## USER FLOW

### Flashcard Feedback Submission

1. User is reviewing a flashcard (lemma or phrase)
2. User notices an error (wrong translation, typo, incorrect definition, etc.)
3. User sees subtle text at bottom of card: "Something wrong? Let us know."
4. User taps the text
5. Text area slides open inline (no modal)
6. User types their feedback (e.g., "The translation should be 'to stay' not 'to remain'")
7. User taps "Submit" button
8. Confirmation message appears briefly ("Thanks! We'll review this.")
9. Text area collapses, user continues reviewing

### What Gets Captured

- `user_id` - Who submitted the feedback
- `created_at` - When it was submitted
- `lemma_id` - If the card is a lemma (nullable)
- `phrase_id` - If the card is a phrase (nullable)
- `sentence_id` - The sentence/fragment shown as context (nullable)
- `feedback_text` - The user's message
- `card_side` - Which side of the card was shown when feedback was initiated ('front' or 'back')

---

## DATABASE SCHEMA

### New Table: `user_feedback`

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

-- Indexes for common queries
CREATE INDEX idx_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_feedback_lemma ON user_feedback(lemma_id);
CREATE INDEX idx_feedback_phrase ON user_feedback(phrase_id);
CREATE INDEX idx_feedback_status ON user_feedback(resolution_status);
CREATE INDEX idx_feedback_archived ON user_feedback(is_archived);
CREATE INDEX idx_feedback_created ON user_feedback(created_at DESC);

-- RLS Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can submit feedback" ON user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON user_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins have full access" ON user_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_settings 
      WHERE user_id = auth.uid() AND is_admin = TRUE
    )
  );
```

---

## FLASHCARD UI CHANGES

### Location

Update the flashcard component (likely `src/components/Flashcard.jsx` or similar in the flashcard/session components).

### Design

**Default State (collapsed):**
```
┌─────────────────────────────────────┐
│                                     │
│         [Flashcard Content]         │
│                                     │
│     Tap card to reveal answer       │
│                                     │
│   Something wrong? Let us know.     │  ← Subtle gray text, clickable
│                                     │
└─────────────────────────────────────┘
```

**Expanded State (after tap):**
```
┌─────────────────────────────────────┐
│                                     │
│         [Flashcard Content]         │
│                                     │
│     Tap card to reveal answer       │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ What's wrong with this      │   │
│   │ card?                       │   │
│   │                             │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│   [Cancel]              [Submit]    │
│                                     │
└─────────────────────────────────────┘
```

**Submitted State (brief confirmation):**
```
│   ✓ Thanks! We'll review this.      │
```

Then collapses back to default after ~2 seconds.

### Styling

- "Something wrong? Let us know." - `text-sm text-gray-400` or muted color
- Text area - matches existing app styling, ~3 rows height
- Submit button - gold accent color (matches app theme)
- Cancel - text button, muted

### Props Needed

The feedback component needs to receive:
- `lemmaId` (if showing a lemma card)
- `phraseId` (if showing a phrase card)  
- `sentenceId` (the context sentence shown)
- `cardSide` ('front' or 'back')

---

## ADMIN PAGE

### Route

`/admin/feedback` - Add to existing admin navigation

### Layout

**Header:**
```
Feedback Management
[X pending] [X total]

[Filter: Status ▾] [Filter: Archived ▾] [Sort: Newest ▾] [Search...]
```

**Toggle Tabs:**
```
[Active] [Archived] [All]
```

**List View:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ ● PENDING                                              Jan 21, 2026 │
│                                                                     │
│ Lemma: "el libro" (the book)                          [View Lemma →]│
│ Context: "Leí el libro ayer."                                       │
│                                                                     │
│ User: user@example.com                                              │
│                                                                     │
│ "The translation should also include 'volume' as a                  │
│  secondary definition."                                             │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Admin notes (optional)                                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Mark Fixed ✓]  [Won't Fix ✗]  [Archive 📁]                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ✓ FIXED                                                Jan 20, 2026 │
│                                                                     │
│ Phrase: "dar miedo" (to scare)                       [View Phrase →]│
│ ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Features

**Filters:**
- Status: All / Pending / Fixed / Won't Fix
- Archived: Active only / Archived only / All
- Search: Search by lemma text, phrase text, or feedback content

**Sorting:**
- Newest first (default)
- Oldest first
- By user
- By status

**Actions per item:**
- **Mark Fixed** - Sets `resolution_status = 'fixed'`, `resolved_at = now()`, `resolved_by = current_admin`
- **Won't Fix** - Sets `resolution_status = 'wont_fix'`, `resolved_at = now()`, `resolved_by = current_admin`
- **Archive** - Sets `is_archived = true`
- **Unarchive** - Sets `is_archived = false`
- **View Lemma/Phrase** - Links to existing admin lemma/phrase edit page
- **Admin Notes** - Optional text field to record why fixed/won't fix

**Status Badges:**
- Pending: Yellow/amber badge
- Fixed: Green badge  
- Won't Fix: Gray badge
- Archived items: Slightly muted/faded appearance

### Empty States

**No feedback yet:**
```
No feedback submissions yet.
When users report issues with flashcards, they'll appear here.
```

**No results for filter:**
```
No feedback matches your filters.
[Clear filters]
```

---

## FILE STRUCTURE

```
src/
  components/
    flashcard/
      FeedbackPrompt.jsx      # The "Something wrong?" expandable component
  pages/
    AdminFeedback.jsx         # Admin feedback management page
    
supabase/
  migrations/
    YYYYMMDD_user_feedback.sql  # Database migration
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Database
- [ ] Create migration for `user_feedback` table
- [ ] Add indexes
- [ ] Add RLS policies
- [ ] Test policies work correctly

### Phase 2: Flashcard UI
- [ ] Create `FeedbackPrompt.jsx` component
- [ ] Integrate into flashcard display
- [ ] Handle submit with loading state
- [ ] Show confirmation message
- [ ] Pass correct lemma/phrase/sentence IDs

### Phase 3: Admin Page
- [ ] Create `AdminFeedback.jsx` page
- [ ] Add route to admin navigation
- [ ] Implement list view with all feedback
- [ ] Add filter controls (status, archived)
- [ ] Add sort controls
- [ ] Add search functionality
- [ ] Implement action buttons (Mark Fixed, Won't Fix, Archive)
- [ ] Add admin notes field
- [ ] Link to lemma/phrase edit pages
- [ ] Add empty states

### Phase 4: Polish
- [ ] Loading states
- [ ] Error handling
- [ ] Responsive design
- [ ] Update changelog

---

## FUTURE ENHANCEMENTS (Post-MVP)

- **User notifications** - Notify user when their feedback is marked as fixed
- **Feedback history** - Let users see their past submissions and status
- **Quick actions** - Inline edit lemma/phrase definition directly from feedback page
- **Analytics** - Track feedback volume, resolution time, common issues

---

## SUCCESS CRITERIA

The feature is complete when:

- [ ] Users can submit feedback on any flashcard (lemma or phrase)
- [ ] Feedback captures user, timestamp, lemma/phrase, sentence context, and text
- [ ] Admins can view all feedback in a dedicated page
- [ ] Admins can filter by status and archived state
- [ ] Admins can sort the list
- [ ] Admins can mark items as Fixed or Won't Fix
- [ ] Admins can archive/unarchive items
- [ ] Admins can add optional notes
- [ ] Admins can quickly navigate to edit the lemma/phrase
- [ ] The UI is clean and matches the app's existing design

---

**END OF SPECIFICATION**
