# 21_MIGRATION_PLAN.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Migration Philosophy](#migration-philosophy)
3. [Current Schema Analysis](#current-schema-analysis)
4. [Target Schema](#target-schema)
5. [Pre-Migration Checklist](#pre-migration-checklist)
6. [Migration Steps](#migration-steps)
7. [Data Transformation Logic](#data-transformation-logic)
8. [Validation & Testing](#validation--testing)
9. [Rollback Plan](#rollback-plan)
10. [Post-Migration Cleanup](#post-migration-cleanup)

---

## OVERVIEW

This document provides the complete plan for migrating from the current database schema (with vocabulary, vocabulary_forms, vocabulary_lemmas, vocabulary_occurrences) to the new simplified schema (lemmas + words).

**Goal:** Preserve all existing data while transitioning to cleaner architecture.

**Timeline:** 1-2 days  
**Risk Level:** Medium (data transformation required)  
**Rollback:** Full backup before migration

---

## MIGRATION PHILOSOPHY

### Core Principles

1. **Safety First:** Complete backup before any changes
2. **Test on Subset:** Verify migration with Chapter 1 data first
3. **Preserve Progress:** All user progress data must be maintained
4. **Validate Everything:** Check data integrity at every step
5. **Rollback Ready:** Documented procedure to undo if needed

### What We're Keeping

- All book, chapter, sentence data (unchanged)
- All user progress (mastery, health, reviews)
- All user settings and profiles
- Daily stats and streaks

### What We're Transforming

- vocabulary → lemmas + words
- vocabulary_forms → words (merged)
- vocabulary_lemmas → lemmas (merged)
- vocabulary_occurrences → words (merged)

### What We're Removing

After successful migration:
- vocabulary table (renamed to vocabulary_old)
- vocabulary_forms (deleted)
- vocabulary_lemmas (deleted)
- vocabulary_occurrences (deleted)

---

## CURRENT SCHEMA ANALYSIS

### Existing Tables and Their Issues

**1. vocabulary (Main table)**
```sql
-- Problems:
-- - Has both canonical and non-canonical entries
-- - canonical_vocab_id self-references (confusing)
-- - Missing many canonical relationships
-- - is_canonical boolean unreliable
```

**2. vocabulary_forms**
```sql
-- Problems:
-- - Duplicates information from vocabulary
-- - lemma_id references vocabulary_lemmas (separate system)
-- - Unclear when to use this vs vocabulary
```

**3. vocabulary_lemmas**
```sql
-- Problems:
-- - Separate from vocabulary but overlaps
-- - Not all lemmas exist here
-- - Inconsistent with vocabulary table
```

**4. vocabulary_occurrences**
```sql
-- Problems:
-- - Has both vocab_id AND form_id (redundant)
-- - Complex joins required for simple queries
-- - Performance issues
```

### Data Quality Issues

**Issue 1: Missing Canonical Relationships**
```sql
-- Many verb forms don't point to infinitives
SELECT COUNT(*) FROM vocabulary 
WHERE part_of_speech = 'VERB' 
  AND is_canonical = false 
  AND canonical_vocab_id IS NULL;
-- Result: ~60% of verbs
```

**Issue 2: Inconsistent Lemma Formats**
```sql
-- Some nouns have articles, some don't
SELECT lemma FROM vocabulary WHERE part_of_speech = 'NOUN' LIMIT 5;
-- Results: "libro", "el casa", "la" (inconsistent)
```

**Issue 3: Duplicate Entries**
```sql
-- Same word might exist in multiple tables
SELECT COUNT(*) FROM vocabulary WHERE lemma = 'vivir';
-- Result: 3 entries (canonical, form, duplicate)
```

---

## TARGET SCHEMA

### New Simplified Structure

**lemmas (Canonical dictionary entries)**
- One entry per unique lemma
- Contains definitions as JSONB array
- Clean, consistent format

**words (Instances in text)**
- Every word occurrence in every sentence
- Points to ONE lemma
- Stores position and grammatical context

**See 02_DATABASE_SCHEMA.md for complete SQL definitions**

---

## PRE-MIGRATION CHECKLIST

### Phase 0: Preparation

```bash
# 1. Full database backup
pg_dump -h your-supabase-host -U postgres voquab > backup_pre_migration_$(date +%Y%m%d).sql

# 2. Export critical tables to CSV (redundant backup)
psql -h your-supabase-host -U postgres voquab -c "\COPY vocabulary TO 'vocabulary_backup.csv' CSV HEADER"
psql -h your-supabase-host -U postgres voquab -c "\COPY user_vocabulary_progress TO 'user_progress_backup.csv' CSV HEADER"

# 3. Document current state
psql -h your-supabase-host -U postgres voquab -c "
  SELECT 'vocabulary' as table_name, COUNT(*) as row_count FROM vocabulary
  UNION ALL
  SELECT 'vocabulary_forms', COUNT(*) FROM vocabulary_forms
  UNION ALL
  SELECT 'vocabulary_lemmas', COUNT(*) FROM vocabulary_lemmas
  UNION ALL
  SELECT 'vocabulary_occurrences', COUNT(*) FROM vocabulary_occurrences
  UNION ALL
  SELECT 'user_vocabulary_progress', COUNT(*) FROM user_vocabulary_progress;
" > pre_migration_counts.txt

# 4. Test database connection
psql -h your-supabase-host -U postgres voquab -c "SELECT NOW();"
```

### Validation Queries

**Check for orphaned records:**
```sql
-- Words without sentences
SELECT COUNT(*) FROM vocabulary_occurrences vo
LEFT JOIN sentences s ON vo.sentence_id = s.sentence_id
WHERE s.sentence_id IS NULL;

-- User progress without vocabulary
SELECT COUNT(*) FROM user_vocabulary_progress uvp
LEFT JOIN vocabulary v ON uvp.vocab_id = v.vocab_id
WHERE v.vocab_id IS NULL;
```

**Check data quality:**
```sql
-- Vocabulary without definitions
SELECT COUNT(*) FROM vocabulary 
WHERE english_definition IS NULL OR english_definition = '';

-- Nouns without gender
SELECT COUNT(*) FROM vocabulary 
WHERE part_of_speech = 'NOUN' AND gender IS NULL;
```

---

## MIGRATION STEPS

### Step 1: Create New Tables

```sql
-- Run complete schema from 02_DATABASE_SCHEMA.md
-- This creates: lemmas, words, user_lemma_progress, user_word_encounters

-- Creates:
-- - lemmas (empty)
-- - words (empty)
-- - user_lemma_progress (empty)
-- - user_word_encounters (empty)
```

### Step 2: Migrate Lemmas

**Strategy:** Create canonical lemmas from vocabulary table

```sql
-- Create lemmas from canonical vocabulary entries
INSERT INTO lemmas (
  lemma_id,
  lemma_text,
  language_code,
  part_of_speech,
  gender,
  definitions,
  is_stop_word,
  admin_notes,
  created_at,
  updated_at
)
SELECT 
  vocab_id as lemma_id,
  -- Normalize lemma text
  CASE 
    WHEN part_of_speech = 'NOUN' AND NOT lemma LIKE 'el %' AND NOT lemma LIKE 'la %' THEN
      CASE 
        WHEN gender = 'M' THEN 'el ' || lemma
        WHEN gender = 'F' THEN 'la ' || lemma
        ELSE 'el ' || lemma  -- Default to masculine
      END
    WHEN part_of_speech = 'VERB' THEN lemma  -- Already infinitive
    ELSE lemma
  END as lemma_text,
  language_code,
  part_of_speech,
  gender,
  -- Convert definition to JSONB array
  CASE 
    WHEN english_definition IS NOT NULL AND english_definition != '' THEN
      jsonb_build_array(
        CASE 
          WHEN part_of_speech = 'VERB' AND NOT english_definition LIKE 'to %' 
            THEN 'to ' || english_definition
          WHEN part_of_speech = 'NOUN' AND NOT english_definition LIKE 'the %'
            THEN 'the ' || english_definition
          ELSE english_definition
        END
      )
    ELSE '[]'::jsonb
  END as definitions,
  is_stop_word,
  admin_notes,
  created_at,
  updated_at
FROM vocabulary
WHERE is_canonical = true
  OR canonical_vocab_id IS NULL;  -- Include orphaned words as lemmas

-- Result: ~1,172 lemmas created
```

**Handle Duplicates:**
```sql
-- If duplicate lemmas found, merge them
WITH duplicates AS (
  SELECT lemma_text, language_code, COUNT(*) as cnt
  FROM lemmas
  GROUP BY lemma_text, language_code
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- Manual review and merge if any found
```

### Step 3: Create Lemma Mapping Table (Temporary)

```sql
-- Create temporary mapping: old vocab_id → new lemma_id
CREATE TEMP TABLE vocab_to_lemma_mapping AS
SELECT 
  v.vocab_id as old_vocab_id,
  COALESCE(v.canonical_vocab_id, v.vocab_id) as canonical_vocab_id,
  l.lemma_id as new_lemma_id
FROM vocabulary v
LEFT JOIN lemmas l ON (
  -- Match by canonical relationship
  CASE 
    WHEN v.is_canonical THEN l.lemma_id = v.vocab_id
    ELSE l.lemma_id = v.canonical_vocab_id
  END
);

-- Verify all vocabulary has a lemma mapping
SELECT COUNT(*) FROM vocabulary v
LEFT JOIN vocab_to_lemma_mapping m ON v.vocab_id = m.old_vocab_id
WHERE m.new_lemma_id IS NULL;
-- Should be 0
```

### Step 4: Migrate Words

**Strategy:** Create word instances from vocabulary_occurrences

```sql
-- Migrate word occurrences to new words table
INSERT INTO words (
  word_id,
  word_text,
  lemma_id,
  book_id,
  chapter_id,
  sentence_id,
  word_position,
  grammatical_info,
  created_at
)
SELECT 
  gen_random_uuid() as word_id,
  v.lemma as word_text,  -- The form as it appears
  m.new_lemma_id as lemma_id,
  s.chapter_id,
  s.chapter_id,
  vo.sentence_id,
  vo.word_position,
  COALESCE(v.form_metadata, '{}'::jsonb) as grammatical_info,
  vo.created_at
FROM vocabulary_occurrences vo
JOIN vocabulary v ON vo.vocab_id = v.vocab_id
JOIN sentences s ON vo.sentence_id = s.sentence_id
JOIN chapters c ON s.chapter_id = c.chapter_id
JOIN vocab_to_lemma_mapping m ON v.vocab_id = m.old_vocab_id
WHERE m.new_lemma_id IS NOT NULL;

-- Verify word count matches
SELECT 
  (SELECT COUNT(*) FROM vocabulary_occurrences) as old_count,
  (SELECT COUNT(*) FROM words) as new_count;
```

### Step 5: Migrate User Progress

**Strategy:** Map user_vocabulary_progress to user_lemma_progress

```sql
-- Migrate user progress to lemma-based tracking
INSERT INTO user_lemma_progress (
  user_id,
  lemma_id,
  mastery_level,
  last_correct_review_at,
  health,
  last_reviewed_at,
  total_reviews,
  correct_reviews,
  review_due,
  failed_in_last_3_sessions,
  review_history,
  created_at,
  updated_at
)
SELECT 
  uvp.user_id,
  m.new_lemma_id as lemma_id,
  uvp.mastery_level,
  uvp.last_correct_review_at,
  uvp.health,
  uvp.last_reviewed_at,
  uvp.total_reviews,
  uvp.correct_reviews,
  uvp.review_due,
  uvp.failed_in_last_3_sessions,
  uvp.review_history,
  uvp.created_at,
  uvp.updated_at
FROM user_vocabulary_progress uvp
JOIN vocab_to_lemma_mapping m ON uvp.vocab_id = m.old_vocab_id
WHERE m.new_lemma_id IS NOT NULL;

-- If user has progress on multiple forms of same lemma, merge them
WITH merged_progress AS (
  SELECT 
    user_id,
    lemma_id,
    MAX(mastery_level) as mastery_level,  -- Keep highest mastery
    MAX(last_reviewed_at) as last_reviewed_at,
    MIN(health) as health,  -- Keep lowest health (more urgent)
    SUM(total_reviews) as total_reviews,  -- Sum reviews
    SUM(correct_reviews) as correct_reviews,
    MIN(review_due) as review_due,  -- Keep earliest due date
    BOOL_OR(failed_in_last_3_sessions) as failed_in_last_3_sessions,
    MAX(created_at) as created_at
  FROM user_lemma_progress
  GROUP BY user_id, lemma_id
  HAVING COUNT(*) > 1
)
-- Update duplicates with merged values
UPDATE user_lemma_progress ulp
SET 
  mastery_level = mp.mastery_level,
  health = mp.health,
  total_reviews = mp.total_reviews,
  correct_reviews = mp.correct_reviews
FROM merged_progress mp
WHERE ulp.user_id = mp.user_id AND ulp.lemma_id = mp.lemma_id;
```

### Step 6: Create User Word Encounters

**Strategy:** Track which forms user has seen

```sql
-- Create encounter records for forms user has studied
INSERT INTO user_word_encounters (
  encounter_id,
  user_id,
  word_id,
  first_encountered_at,
  times_encountered,
  last_encountered_sentence_id,
  created_at
)
SELECT 
  gen_random_uuid() as encounter_id,
  uvp.user_id,
  w.word_id,
  uvp.created_at as first_encountered_at,
  1 as times_encountered,  -- Initial value
  w.sentence_id as last_encountered_sentence_id,
  NOW() as created_at
FROM user_vocabulary_progress uvp
JOIN vocab_to_lemma_mapping m ON uvp.vocab_id = m.old_vocab_id
JOIN words w ON m.new_lemma_id = w.lemma_id
WHERE uvp.total_reviews > 0;  -- Only if user actually reviewed it
```

### Step 7: Update User Chapter Progress

```sql
-- Recalculate chapter progress with new lemma counts
UPDATE user_chapter_progress ucp
SET 
  unique_lemmas_in_chapter = (
    SELECT COUNT(DISTINCT w.lemma_id)
    FROM words w
    WHERE w.chapter_id = ucp.chapter_id
  ),
  lemmas_encountered = (
    SELECT COUNT(DISTINCT ulp.lemma_id)
    FROM user_lemma_progress ulp
    JOIN words w ON ulp.lemma_id = w.lemma_id
    WHERE w.chapter_id = ucp.chapter_id
      AND ulp.user_id = ucp.user_id
      AND ulp.total_reviews > 0
  ),
  encounter_percentage = (
    SELECT CAST(COUNT(DISTINCT ulp.lemma_id) AS DECIMAL) / NULLIF(COUNT(DISTINCT w.lemma_id), 0)
    FROM words w
    LEFT JOIN user_lemma_progress ulp ON (
      w.lemma_id = ulp.lemma_id 
      AND ulp.user_id = ucp.user_id
      AND ulp.total_reviews > 0
    )
    WHERE w.chapter_id = ucp.chapter_id
  );
```

---

## DATA TRANSFORMATION LOGIC

### Handling Edge Cases

**Case 1: Verb Forms Without Canonical**
```sql
-- If verb form doesn't have canonical_vocab_id
-- Use spaCy to find infinitive, or create as lemma
SELECT v.vocab_id, v.lemma, v.part_of_speech
FROM vocabulary v
WHERE v.part_of_speech = 'VERB'
  AND v.is_canonical = false
  AND v.canonical_vocab_id IS NULL;

-- Manual review or re-lemmatize with spaCy
```

**Case 2: Nouns Missing Gender**
```sql
-- Default to masculine if gender unknown
UPDATE lemmas
SET gender = 'M'
WHERE part_of_speech = 'NOUN' AND gender IS NULL;
```

**Case 3: Multiple Definitions**
```sql
-- If vocabulary had "definition1; definition2" format
-- Split into array
UPDATE lemmas
SET definitions = string_to_array(definitions->0, ';')::jsonb
WHERE definitions->0 LIKE '%;%';
```

---

## VALIDATION & TESTING

### Post-Migration Checks

**1. Row Count Verification**
```sql
-- Verify data wasn't lost
SELECT 
  'Old vocabulary entries' as metric,
  COUNT(*) as old_value,
  (SELECT COUNT(*) FROM lemmas) as new_lemmas,
  (SELECT COUNT(*) FROM words) as new_words
FROM vocabulary

UNION ALL

SELECT 
  'Old user progress',
  COUNT(*),
  (SELECT COUNT(*) FROM user_lemma_progress),
  NULL
FROM user_vocabulary_progress;
```

**2. User Progress Integrity**
```sql
-- Every user's mastery should be preserved
SELECT 
  u.user_id,
  COUNT(DISTINCT uvp_old.vocab_id) as old_progress_count,
  COUNT(DISTINCT ulp_new.lemma_id) as new_progress_count
FROM auth.users u
LEFT JOIN user_vocabulary_progress uvp_old ON u.user_id = uvp_old.user_id
LEFT JOIN user_lemma_progress ulp_new ON u.user_id = ulp_new.user_id
GROUP BY u.user_id
HAVING COUNT(DISTINCT uvp_old.vocab_id) != COUNT(DISTINCT ulp_new.lemma_id);
-- Should return 0 rows (or explain differences)
```

**3. Flashcard Query Test**
```sql
-- Test that flashcard queries work
SELECT 
  l.lemma_text,
  l.definitions,
  ulp.mastery_level,
  ulp.health,
  w.word_text as encountered_form
FROM user_lemma_progress ulp
JOIN lemmas l ON ulp.lemma_id = l.lemma_id
LEFT JOIN LATERAL (
  SELECT w.word_text
  FROM words w
  JOIN user_word_encounters uwe ON w.word_id = uwe.word_id
  WHERE w.lemma_id = l.lemma_id
    AND uwe.user_id = ulp.user_id
  ORDER BY uwe.last_encountered_at DESC
  LIMIT 1
) w ON true
WHERE ulp.user_id = 'test-user-id'
ORDER BY ulp.health ASC
LIMIT 10;
```

**4. Chapter Unlock Status**
```sql
-- Verify chapter unlock logic still works
SELECT 
  c.chapter_number,
  ucp.encounter_percentage,
  ucp.is_unlocked,
  CASE 
    WHEN ucp.encounter_percentage >= 1.0 THEN 'should be unlocked'
    ELSE 'correctly locked'
  END as validation
FROM user_chapter_progress ucp
JOIN chapters c ON ucp.chapter_id = c.chapter_id
WHERE ucp.user_id = 'test-user-id'
ORDER BY c.chapter_number;
```

### Test with Real User Account

```bash
# 1. Create test user account
# 2. Import Chapter 1 using old schema
# 3. User studies 10 words
# 4. Run migration
# 5. Verify:
#    - User can still see their progress
#    - Flashcards display correctly
#    - Health/mastery values preserved
#    - No crashes or errors
```

---

## ROLLBACK PLAN

### If Migration Fails

**Step 1: Stop Application**
```bash
# Stop Netlify deployment
netlify deploy --prod --dir=dist --message="Rollback migration"
```

**Step 2: Restore Database**
```bash
# Drop new tables
psql -h your-supabase-host -U postgres voquab -c "
  DROP TABLE IF EXISTS words CASCADE;
  DROP TABLE IF EXISTS lemmas CASCADE;
  DROP TABLE IF EXISTS user_lemma_progress CASCADE;
  DROP TABLE IF EXISTS user_word_encounters CASCADE;
"

# Restore from backup
psql -h your-supabase-host -U postgres voquab < backup_pre_migration_YYYYMMDD.sql
```

**Step 3: Verify Restoration**
```sql
-- Check row counts match pre-migration
SELECT * FROM vocabulary LIMIT 5;
SELECT * FROM user_vocabulary_progress LIMIT 5;
```

**Step 4: Restart Application**
```bash
# Deploy previous working version
git checkout last-working-commit
npm run build
netlify deploy --prod --dir=dist
```

---

## POST-MIGRATION CLEANUP

### After Successful Migration

**Phase 1: Verification (24 hours)**
- Monitor for errors
- Test with multiple users
- Check all features work

**Phase 2: Rename Old Tables (Day 2)**
```sql
-- Keep old tables as backup for 7 days
ALTER TABLE vocabulary RENAME TO vocabulary_old;
ALTER TABLE vocabulary_forms RENAME TO vocabulary_forms_old;
ALTER TABLE vocabulary_lemmas RENAME TO vocabulary_lemmas_old;
ALTER TABLE vocabulary_occurrences RENAME TO vocabulary_occurrences_old;
ALTER TABLE user_vocabulary_progress RENAME TO user_vocabulary_progress_old;
```

**Phase 3: Drop Old Tables (Day 7)**
```sql
-- After 7 days of stable operation
DROP TABLE vocabulary_old CASCADE;
DROP TABLE vocabulary_forms_old CASCADE;
DROP TABLE vocabulary_lemmas_old CASCADE;
DROP TABLE vocabulary_occurrences_old CASCADE;
DROP TABLE user_vocabulary_progress_old CASCADE;

-- Drop temporary mapping table
DROP TABLE IF EXISTS vocab_to_lemma_mapping;
```

**Phase 4: Optimize New Tables**
```sql
-- Analyze new tables for query planner
ANALYZE lemmas;
ANALYZE words;
ANALYZE user_lemma_progress;

-- Vacuum to reclaim space
VACUUM FULL;
```

---

## QUICK REFERENCE

### Migration Checklist

```
Pre-Migration:
☐ Full database backup created
☐ CSV exports of critical tables
☐ Row counts documented
☐ Validation queries run
☐ Test environment prepared

Migration:
☐ New tables created
☐ Lemmas migrated
☐ Words migrated
☐ User progress migrated
☐ Chapter progress updated

Validation:
☐ Row counts verified
☐ User progress intact
☐ Flashcard queries working
☐ Test user account verified
☐ All features tested

Post-Migration:
☐ 24-hour monitoring
☐ Old tables renamed (Day 2)
☐ Old tables dropped (Day 7)
☐ Database optimized
☐ Documentation updated
```

---

## RELATED DOCUMENTS

- See **02_DATABASE_SCHEMA.md** for target schema definition
- See **00_PROJECT_OVERVIEW.md** for project context
- See **03_CONTENT_PIPELINE.md** for future content imports

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF MIGRATION PLAN**
