# 22_ADMIN_DASHBOARD.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Core Features](#core-features)
4. [Lemma Management](#lemma-management)
5. [Validation Queue](#validation-queue)
6. [Content Review](#content-review)
7. [Bulk Operations](#bulk-operations)
8. [UI/UX Requirements](#uiux-requirements)
9. [Database Operations](#database-operations)
10. [Implementation Notes](#implementation-notes)

---

## OVERVIEW

The Admin Dashboard is a critical MVP component that enables manual content curation, translation review, and quality control. It's the interface Peter and native speakers use to achieve 99% translation accuracy.

**Primary Users:** Peter, native Spanish speakers (fiancée + reviewers)  
**Primary Purpose:** Manual editing and quality control  
**Access Level:** Admin-only (RLS policy based on user role)

---

## USER ROLES

### Admin User

**Who:** Peter  
**Permissions:** Full access to all features  
**Can:**
- Edit lemmas (text, definitions, POS, gender)
- Approve/reject AI validation suggestions
- Manage stop words
- Bulk operations
- Delete entries (with confirmation)
- View all statistics

---

### Reviewer User

**Who:** Native Spanish speakers  
**Permissions:** Limited to translation review  
**Can:**
- View lemmas and definitions
- Suggest definition changes
- Flag incorrect lemmas
- Comment on translations

**Cannot:**
- Delete entries
- Change database structure
- Bulk operations

---

## CORE FEATURES

### 1. Dashboard Home

**Display:**
- Quality metrics summary
- Pending validation issues count
- Translation coverage statistics
- Recent activity log

**Metrics Widget:**
```
┌─────────────────────────────────────────────────────┐
│  Quality Overview                                   │
├─────────────────────────────────────────────────────┤
│  📊 Total Lemmas: 1,172                             │
│  ✅ With Definitions: 1,165 (99.4%)                  │
│  ⚠️  Pending Issues: 23                              │
│  📖 Sentences Translated: 463/463 (100%)            │
│  🎯 Quality Score: 98.8%                             │
│                                                     │
│  [View Pending Issues →]                            │
└─────────────────────────────────────────────────────┘
```

**Recent Activity:**
```
┌─────────────────────────────────────────────────────┐
│  Recent Changes                                     │
├─────────────────────────────────────────────────────┤
│  • 2 hours ago: Peter approved AI suggestion for    │
│    "desilusionado" → link to "desilusionar"        │
│  • 5 hours ago: Maria flagged "el asteroide" def    │
│  • Yesterday: Peter added definition for "cordero"  │
│  • 2 days ago: Batch update: 15 verbs marked        │
└─────────────────────────────────────────────────────┘
```

---

### 2. Navigation

**Main Menu:**
- 🏠 Dashboard (home)
- 📚 Lemma Manager
- ⚠️ Validation Queue (with badge showing count)
- 📖 Sentence Review
- 🔧 Bulk Operations
- 📊 Statistics
- ⚙️ Settings

---

## LEMMA MANAGEMENT

### Search & Filter Interface

**Search Bar:**
- Search by lemma text (Spanish)
- Search by definition (English)
- Search by chapter
- Autocomplete suggestions

**Filters:**
- Part of Speech (NOUN, VERB, ADJ, ADV, etc.)
- Gender (M, F, N/A)
- Has Definition (Yes/No)
- Is Stop Word (Yes/No)
- Chapter (1-27)
- Times in Book (range slider: 1-100+)

**Example UI:**
```
┌─────────────────────────────────────────────────────┐
│  Lemma Manager                                      │
├─────────────────────────────────────────────────────┤
│  Search: [vivir____________] 🔍                     │
│                                                     │
│  Filters:                                           │
│  POS: [All ▼] Gender: [All ▼] Chapter: [All ▼]    │
│  □ Has Definition  □ Stop Words Only                │
│                                                     │
│  [Apply Filters] [Clear]                            │
└─────────────────────────────────────────────────────┘
```

---

### Lemma List View

**Table Columns:**
- Lemma Text (Spanish)
- Definitions (first definition shown, +2 more indicator)
- Part of Speech
- Gender (if noun)
- Times in Book
- Actions (Edit, Delete)

**Example:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Results: 1 lemma                                                 │
├──────────────┬─────────────┬─────┬────────┬───────┬──────────────┤
│ Lemma        │ Definition  │ POS │ Gender │ Count │ Actions      │
├──────────────┼─────────────┼─────┼────────┼───────┼──────────────┤
│ vivir        │ to live,    │VERB │  -     │  42   │ [Edit] [Del] │
│              │ to reside   │     │        │       │              │
└──────────────┴─────────────┴─────┴────────┴───────┴──────────────┘
```

**Sorting:**
- Click column headers to sort
- Default: Alphabetical by lemma text

**Pagination:**
- 25 results per page
- Page navigation at bottom

---

### Lemma Edit Modal

**Triggered By:** Click "Edit" button  
**Modal Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Edit Lemma                                    [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Lemma Text (Spanish):                              │
│  [vivir_____________________]                       │
│                                                     │
│  Part of Speech:                                    │
│  [VERB ▼]                                           │
│                                                     │
│  Gender (for nouns):                                │
│  [Not Applicable ▼]                                 │
│                                                     │
│  Definitions (max 5):                               │
│  1. [to live___________________] [Remove]           │
│  2. [to reside_________________] [Remove]           │
│  [+ Add Definition]                                 │
│                                                     │
│  □ Mark as stop word                                │
│                                                     │
│  Admin Notes:                                       │
│  [Optional notes for future reference_________]     │
│  [_____________________________________________]    │
│                                                     │
│  Times in Book: 42 (read-only)                      │
│  Last Modified: 2025-11-28 (read-only)              │
│                                                     │
│  [Cancel]  [Save Changes]                           │
└─────────────────────────────────────────────────────┘
```

**Validation:**
- Lemma text required
- At least one definition required
- Gender required for nouns
- Definitions max 5 items
- Show character count (max 200 per definition)

**Save Behavior:**
- Update lemmas table
- Timestamp updated_at field
- Log change to audit log
- Show success message

---

### View Word Instances

**Feature:** Click lemma to see all word instances  
**Purpose:** Understand how word appears in context

**Modal:**
```
┌─────────────────────────────────────────────────────┐
│  Word Instances for: vivir                     [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Found in 42 sentences across 8 chapters            │
│                                                     │
│  Chapter 1, Sentence 3:                             │
│  "Cuando yo tenía seis años, vi una vez una        │
│   magnífica lámina en un libro sobre el bosque     │
│   virgen que se llamaba Historias vividas."        │
│                                                     │
│   Form: vividas (past participle, feminine plural)  │
│   Position: Word 23 of 25                           │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Chapter 2, Sentence 5:                             │
│  "Viví solo, sin nadie con quien poder hablar      │
│   verdaderamente..."                                │
│                                                     │
│   Form: Viví (preterite, first person singular)    │
│   Position: Word 1 of 10                            │
│                                                     │
│  [Showing 2 of 42] [Load More]                      │
│                                                     │
│  [Close]                                            │
└─────────────────────────────────────────────────────┘
```

---

## VALIDATION QUEUE

### Purpose

Review AI-flagged translation issues from content pipeline (Step 8 of 03_CONTENT_PIPELINE.md).

**Issue Types:**
- `wrong_lemma`: spaCy assigned incorrect canonical form
- `wrong_definition`: DeepL translation inaccurate for context
- `wrong_pos`: Part of speech tag incorrect

---

### Queue View

**Filter Options:**
- All Issues
- Wrong Lemma
- Wrong Definition
- Wrong POS
- High Confidence Only (≥80%)
- By Chapter

**List Display:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Validation Queue (23 pending)                                    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Issue #1 - Wrong Definition (Confidence: 85%)                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                   │
│  Spanish Sentence:                                                │
│  "El cordero se comió la flor."                                   │
│                                                                   │
│  English Translation:                                             │
│  "The lamb ate the flower."                                       │
│                                                                   │
│  Word in Question: el cordero                                     │
│  Current Definition: "the rope"                                   │
│  AI Suggestion: "the lamb"                                        │
│                                                                   │
│  AI Explanation:                                                  │
│  "In this context, 'cordero' refers to a young sheep (lamb),      │
│   not a rope (cuerda). The sentence talks about an animal eating  │
│   a flower, confirming this is the animal meaning."               │
│                                                                   │
│  [Approve AI Suggestion] [Reject] [Edit Manually]                │
│  ───────────────────────────────────────────────────────────────  │
└───────────────────────────────────────────────────────────────────┘
```

---

### Actions

**Approve AI Suggestion:**
- Updates definition in lemmas table
- Marks issue as `approved` in validation_issues
- Shows success message
- Moves to next issue

**Reject:**
- Keeps current definition
- Marks issue as `rejected` in validation_issues
- Requires reason (text field)
- Moves to next issue

**Edit Manually:**
- Opens lemma edit modal
- Pre-fills with AI suggestion (editable)
- Save updates lemma and marks issue as `fixed`
- Moves to next issue

---

### Statistics

**Display at top:**
```
Total Issues: 23
  ✅ Approved: 0
  ❌ Rejected: 0
  ✏️  Manually Fixed: 0
  ⏳ Pending: 23

Progress: ▓▓▓░░░░░░░ 0% complete
```

---

## CONTENT REVIEW

### Sentence Review Table

**Purpose:** Review all sentences and translations  
**Filter:** By chapter, by translation status

**Display:**
```
┌───────────────────────────────────────────────────────────────────┐
│  Sentence Review - Chapter 1                                      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sentence 1:                                                      │
│  ES: "Cuando yo tenía seis años, vi una vez una magnífica        │
│       lámina en un libro sobre el bosque virgen..."               │
│                                                                   │
│  EN: "When I was six years old, I once saw a magnificent         │
│       picture in a book about the virgin forest..."               │
│                                                                   │
│  [Edit Translation] [Flag Issue] ✓ Verified                      │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  Sentence 2:                                                      │
│  ...                                                              │
└───────────────────────────────────────────────────────────────────┘
```

**Edit Translation Button:**
- Opens modal with editable text area
- Save updates sentences table
- Logs change

**Flag Issue:**
- Creates validation issue manually
- Requires description
- Appears in validation queue

**Verified Checkmark:**
- Manually mark sentence as reviewed
- Updates sentence metadata

---

## BULK OPERATIONS

### Purpose

Efficient mass updates for specific scenarios.

**Available Operations:**

---

### 1. Bulk Mark Stop Words

**Use Case:** Mark common Spanish words as stop words

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  Bulk Mark Stop Words                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Enter lemmas (one per line):                       │
│  ┌──────────────────────────────────────────────┐  │
│  │ de                                           │  │
│  │ la                                           │  │
│  │ el                                           │  │
│  │ que                                          │  │
│  │ y                                            │  │
│  │ en                                           │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Preview: 6 lemmas will be updated                  │
│                                                     │
│  [Cancel]  [Mark as Stop Words]                     │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Finds each lemma by text
- Sets `is_stop_word = true`
- Shows confirmation
- Logs action

---

### 2. Bulk Update Definitions

**Use Case:** Add "the" or "to" prefix to many definitions

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  Bulk Update Definitions                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Filter lemmas:                                     │
│  POS: [VERB ▼]                                      │
│  Missing prefix: [to]                               │
│                                                     │
│  Found: 42 verbs with definitions missing "to"      │
│                                                     │
│  Action: Prepend "to " to first definition          │
│                                                     │
│  Preview:                                           │
│  • "live" → "to live"                               │
│  • "eat" → "to eat"                                 │
│  • "see" → "to see"                                 │
│  [Show all 42]                                      │
│                                                     │
│  [Cancel]  [Update All]                             │
└─────────────────────────────────────────────────────┘
```

---

### 3. Bulk Delete Lemmas

**Use Case:** Remove entries created by mistake

**Caution:** Destructive operation  
**Requires:** Confirmation + admin password re-entry

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Bulk Delete Lemmas                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  WARNING: This will permanently delete lemmas       │
│  and all associated user progress.                  │
│                                                     │
│  Enter lemma IDs or texts (one per line):           │
│  ┌──────────────────────────────────────────────┐  │
│  │ [UUID or text]                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Preview: 0 lemmas will be deleted                  │
│                                                     │
│  Confirm your password:                             │
│  [••••••••]                                         │
│                                                     │
│  [Cancel]  [Delete Permanently]                     │
└─────────────────────────────────────────────────────┘
```

---

## UI/UX REQUIREMENTS

### Design Principles

**1. Mobile-Responsive**
- Admin dashboard should work on tablet/desktop
- Mobile not primary use case (complex operations)
- Minimum width: 768px (tablet)

**2. Clear Visual Hierarchy**
- Important actions prominent (Approve/Reject)
- Destructive actions require confirmation
- Success/error states obvious

**3. Efficient Workflow**
- Keyboard shortcuts for common actions
- Batch operations accessible
- Minimal clicks to complete tasks

**4. Data Preservation**
- Auto-save drafts
- Confirm before destructive actions
- Undo capability for recent changes

---

### Visual Design

**Color Scheme:**
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)
- Info: Blue (#3b82f6)
- Neutral: Gray (#6b7280)

**Typography:**
- Spanish text: Clear, readable font (Inter or similar)
- Definitions: Slightly smaller, gray
- Actions: Bold, colored

**Spacing:**
- Generous padding for readability
- Clear separation between issues
- Grouped related fields

---

### Accessibility

**Requirements:**
- Keyboard navigation throughout
- Focus indicators visible
- Screen reader compatible (ARIA labels)
- Sufficient color contrast (WCAG AA)

---

## DATABASE OPERATIONS

### Read Operations

**Lemma Search:**
```sql
SELECT 
  l.lemma_id,
  l.lemma_text,
  l.definitions,
  l.part_of_speech,
  l.gender,
  l.is_stop_word,
  COUNT(w.word_id) as times_in_book
FROM lemmas l
LEFT JOIN words w ON l.lemma_id = w.lemma_id
WHERE 
  l.lemma_text ILIKE '%' || :search || '%'
  AND (:pos IS NULL OR l.part_of_speech = :pos)
  AND (:gender IS NULL OR l.gender = :gender)
GROUP BY l.lemma_id
ORDER BY l.lemma_text ASC
LIMIT 25 OFFSET :offset;
```

**Validation Queue:**
```sql
SELECT 
  vi.issue_id,
  vi.sentence_id,
  vi.word_text,
  vi.issue_type,
  vi.current_value,
  vi.suggested_value,
  vi.explanation,
  vi.confidence,
  s.sentence_text,
  s.sentence_translation
FROM validation_issues vi
JOIN sentences s ON vi.sentence_id = s.sentence_id
WHERE vi.status = 'pending'
ORDER BY vi.confidence DESC, vi.created_at ASC;
```

---

### Write Operations

**Update Lemma:**
```sql
UPDATE lemmas
SET 
  lemma_text = :lemma_text,
  definitions = :definitions,
  part_of_speech = :pos,
  gender = :gender,
  is_stop_word = :is_stop_word,
  admin_notes = :admin_notes,
  updated_at = NOW()
WHERE lemma_id = :lemma_id;
```

**Approve AI Suggestion:**
```sql
-- Update lemma
UPDATE lemmas
SET definitions = jsonb_set(
  definitions,
  '{0}',  -- Update first definition
  to_jsonb(:suggested_value)
)
WHERE lemma_id = (
  SELECT w.lemma_id FROM words w WHERE w.word_text = :word_text LIMIT 1
);

-- Mark issue as approved
UPDATE validation_issues
SET status = 'approved', resolved_at = NOW()
WHERE issue_id = :issue_id;
```

---

## IMPLEMENTATION NOTES

### Technology

**Frontend:**
- React component in `/src/pages/Admin.jsx`
- Sub-components in `/src/components/admin/`
- State management with React hooks

**Backend:**
- Supabase RLS policies (admin role required)
- SQL functions for complex operations
- Audit logging

---

### Security

**RLS Policies:**
```sql
-- Only admins can access admin tables
CREATE POLICY "Admins only" ON lemmas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
```

**Admin Role:**
- Stored in `user_roles` table
- Peter's user_id has role='admin'
- Reviewers have role='reviewer' (limited permissions)

---

### Audit Logging

**Track All Changes:**
```sql
CREATE TABLE admin_audit_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50),  -- 'update_lemma', 'approve_issue', etc.
  table_name VARCHAR(50),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- Track who changed what and when
- Rollback capability
- Debugging data issues

---

### Performance

**Optimizations:**
- Index on lemma_text for search
- Pagination (25 results per page)
- Lazy load word instances
- Cache frequent queries

**Expected Load:**
- 1-2 concurrent admin users
- Not high-traffic
- Can tolerate some latency (<500ms)

---

## QUICK REFERENCE

### Admin Dashboard Checklist

**Core Features:**
- [ ] Lemma search and filter
- [ ] Lemma edit modal
- [ ] View word instances
- [ ] Validation queue interface
- [ ] Approve/reject AI suggestions
- [ ] Sentence review table
- [ ] Bulk stop word marking
- [ ] Bulk definition updates

**Quality Metrics:**
- [ ] Translation coverage
- [ ] Definition coverage
- [ ] Pending issues count
- [ ] Quality score calculation

**Security:**
- [ ] Admin RLS policies
- [ ] Role-based access
- [ ] Audit logging
- [ ] Confirmation for destructive actions

---

## RELATED DOCUMENTS

- See **03_CONTENT_PIPELINE.md** for validation issue generation
- See **02_DATABASE_SCHEMA.md** for database structure
- See **01_MVP_DEFINITION.md** for MVP scope

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF ADMIN DASHBOARD SPECIFICATION**
