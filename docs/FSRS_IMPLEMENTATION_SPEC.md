# FSRS Implementation Specification
## Pure FSRS with Exposure Insurance & Chapter Progression

**Version:** 1.0  
**Date:** December 12, 2025  
**Status:** Ready for Implementation

---

## Executive Summary

Replace the current custom mastery/health system with pure FSRS (Free Spaced Repetition Scheduler) while preserving exposure insurance and chapter unlocking gamification.

**Key Changes:**
- Remove Health system entirely
- Replace Mastery with FSRS stability/difficulty  
- Add exposure oversampling for high-stability cards
- Keep chapter unlocking (95% words introduced)
- Simplify to 8 database columns (from 14)

**Benefits:**
- 20-30% fewer reviews for same retention
- Research-backed algorithm (no custom tuning)
- Single source of truth (no dual system complexity)
- Exposure insurance prevents "forgotten easy words"

---

## Database Schema Changes

### New Columns (user_lemma_progress & user_phrase_progress)

```sql
stability        REAL      -- Days until 90% recall probability
difficulty       REAL      -- Item complexity (1-10 scale)
due_date         TIMESTAMP -- When card should be reviewed
fsrs_state       SMALLINT  -- 0=New, 1=Learning, 2=Review, 3=Relearning
reps             INTEGER   -- Total repetitions
lapses           INTEGER   -- Times failed (pressed Again)
last_seen_at     TIMESTAMP -- Last exposure (review OR oversampling)
```

### Columns to Deprecate (remove after 30 days)

- mastery_level (replaced by stability)
- health (replaced by retrievability calculation)
- correct_reviews (use reps - lapses)

---

## Study Modes

### Mode 1: Review Due Cards
- FSRS scheduling (due_date <= NOW)
- Plus exposure oversampling
- High activity: 10 exposure cards  
- Low activity: 2 exposure cards

### Mode 2: Learn New Words
- Unintroduced words from unlocked chapters
- Ordered by chapter, then frequency
- Sequential introduction

### Mode 3: Chapter Focus
- 60% due from target chapter
- 20% exposure from target chapter
- 20% due from other chapters

---

## Exposure Insurance

**Problem:** Easy words disappear for months
**Solution:** Oversample stable cards occasionally

**Logic:**
- Only cards with stability > 30 days
- Only cards in Review state (not Learning)
- Must not have been seen in 7-21 days (depends on activity)
- Shows with buttons (updates FSRS normally)
- Badge indicates "Exposure Check ✓"

**Frequency:**
| Activity | Reviews/Day | Exposure Cards | Days Between |
|----------|-------------|----------------|--------------|
| High | 100+ | 10/session | 7 days |
| Medium | 50-99 | 5/session | 14 days |  
| Low | <50 | 2/session | 21 days |

---

## Chapter Unlocking

**Unlock Criteria:** 95% of previous chapter words introduced

**Example:**
- Chapter 1: 52/52 words (100%) → Chapter 2 UNLOCKED
- Chapter 2: 38/40 words (95%) → Chapter 3 UNLOCKED
- Chapter 3: 30/35 words (86%) → Chapter 4 LOCKED

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION get_chapter_progress(p_user_id uuid)
RETURNS TABLE (
  chapter_number integer,
  total_words bigint,
  introduced_words bigint,
  introduced_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.chapter_number,
    COUNT(*) as total_words,
    COUNT(ulp.lemma_id) as introduced_words,
    ROUND((COUNT(ulp.lemma_id)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) as introduced_pct
  FROM lemmas l
  LEFT JOIN user_lemma_progress ulp 
    ON l.lemma_id = ulp.lemma_id AND ulp.user_id = p_user_id
  WHERE l.is_stop_word = false
  GROUP BY l.chapter_number
  ORDER BY l.chapter_number;
END;
$$ LANGUAGE plpgsql;
```

---

## FSRS Button Mapping

| Button | User Sees | FSRS Rating | Effect |
|--------|-----------|-------------|--------|
| Again | "Again" | 1 | Stability reset ~0.2-2 days, lapses +1 |
| Hard | "Hard" | 2 | Stability × 0.6, difficulty +0.5 |
| Got It | "Got It" | 3 (Good) | Stability × 1.5-3.0, difficulty -0.2 |

**No "Easy" button** - Using 3-button interface, not 4-button

---

## Complete Testing Checklist

### Database Tests
- [ ] FSRS columns exist in user_lemma_progress
- [ ] FSRS columns exist in user_phrase_progress  
- [ ] Indexes created (due_date, exposure)
- [ ] get_chapter_progress function works
- [ ] Migration preserves user data

### FSRS Service Tests
- [ ] scheduleCard(card, 1) updates correctly (Again)
- [ ] scheduleCard(card, 2) updates correctly (Hard)
- [ ] scheduleCard(card, 3) updates correctly (Good)
- [ ] isCardDue() identifies due cards
- [ ] shouldIncludeForExposure() filters correctly
- [ ] getUserActivityLevel() calculates correctly
- [ ] stabilityToMastery() maps 0-100
- [ ] calculateRetrievability() returns 0-100%

### Session Builder Tests
- [ ] Review mode returns due + exposure cards
- [ ] Learn mode returns unintroduced words
- [ ] Chapter mode returns 60/20/20 split
- [ ] High activity users get 10 exposure cards
- [ ] Low activity users get 2 exposure cards
- [ ] Session respects size limit
- [ ] Unlocked chapters calculated correctly (95%)

### Progress Tracking Tests  
- [ ] updateProgress('again') updates FSRS state
- [ ] updateProgress('hard') updates FSRS state
- [ ] updateProgress('got-it') updates FSRS state
- [ ] Exposure cards only update last_seen_at
- [ ] Daily stats increment correctly
- [ ] No duplicate records created

### UI Tests
- [ ] Mode selector switches sessions
- [ ] Progress shows "X/25 Cards"
- [ ] Exposure badge appears correctly
- [ ] Flashcard flips on click
- [ ] Buttons work
- [ ] Session complete screen shows
- [ ] Chapter progress displays
- [ ] Locked chapters show 🔒

### Integration Tests
- [ ] Complete review session end-to-end
- [ ] Complete learn session end-to-end
- [ ] Complete chapter focus session end-to-end
- [ ] Chapter unlocks at 95% introduction
- [ ] Stable words appear for exposure after gap
- [ ] Due cards always appear

### Performance Tests
- [ ] Session loads in <2 seconds
- [ ] Progress update <500ms
- [ ] Chapter progress <1 second
- [ ] Indexes being used (check EXPLAIN)

### Edge Cases
- [ ] Brand new user can start learning
- [ ] User with all mastered cards gets exposure
- [ ] 6-month break user gets correct due cards
- [ ] Missing sentence data doesn't crash
- [ ] Null last_seen_at handled
- [ ] FSRS state transitions correctly
- [ ] Stability never negative
- [ ] Difficulty stays 1-10
- [ ] Due date never in past

---

## Success Metrics (After 1 Week)

Track these metrics:

```sql
-- Average reviews per user per day (should decrease 20-30%)
SELECT AVG(words_reviewed) as avg_reviews_per_day
FROM user_daily_stats
WHERE date >= '2025-12-12';

-- Card stability distribution
SELECT 
  CASE 
    WHEN stability < 7 THEN 'Learning'
    WHEN stability < 30 THEN 'Review'
    WHEN stability < 120 THEN 'Mastering'
    ELSE 'Mastered'
  END as category,
  COUNT(*) as cards
FROM user_lemma_progress
WHERE user_id = ?
GROUP BY category;
```

---

## Rollback Plan

If issues arise:

1. **Revert code:** `git revert`
2. **Keep FSRS columns:** Don't drop (no harm)
3. **Re-enable old logic:** Switch back temporarily
4. **Investigate:** Fix and retry

Migration preserves old data - rollback is safe.

---

## Documentation Updates

After implementation:

1. Update 02_DATABASE_SCHEMA.md
2. Update 04_LEARNING_ALGORITHM.md
3. Add 99_LIVING_CHANGELOG.md entry
4. Update 29_FAQ.md for users
5. Create 30_FSRS_ARCHITECTURE.md

---

## Timeline Estimate

| Phase | Time | 
|-------|------|
| Phase 1: Database | 30 min |
| Phase 2: Services | 2 hours |
| Phase 3: Progress | 1 hour |
| Phase 4: UI | 1 hour |
| Phase 5: Migration | 1 hour |
| Phase 6: Testing | 2-3 hours |
| Phase 7: Docs | 30 min |
| **Total** | **6-8 hours** |

---

**END OF SPECIFICATION**

For complete implementation code for each phase, refer to the uploaded research document and this spec. Claude Code should implement phase by phase, testing thoroughly at each step.
