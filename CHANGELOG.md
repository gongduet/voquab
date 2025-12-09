# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- New 2-table vocabulary architecture: `lemmas` and `words` tables
- New `user_lemma_progress` table for tracking mastery per lemma
- New `user_word_encounters` table for tracking form exposure
- Database indexes for vocabulary queries

### Changed
- Migrated from 4-table system (vocabulary, vocabulary_forms, vocabulary_lemmas, vocabulary_occurrences) to simplified 2-table system (lemmas, words)
- User progress now tracks mastery per lemma instead of per word form
- Multiple verb conjugations (e.g., tenía, tuve, tienen) now consolidate to single lemma (tener)

### Migration Details (2025-12-04)

**Schema Migration Completed:**

| Old Table | Records | New Table | Records | Notes |
|-----------|---------|-----------|---------|-------|
| vocabulary_lemmas | 1,171 | lemmas | 1,171 | 1:1 migration |
| vocabulary_occurrences | 5,406 | words | 5,406 | 1:1 migration |
| user_vocabulary_progress | 151 | user_lemma_progress | 135 | 16 merged (same lemma) |

**Validation Results:**
- All 5,406 words properly linked to lemmas
- All 10 chapters have word data (402-987 words each)
- Verb form consolidation working (e.g., "tener" has 10 forms mapped)
- User progress preserved (135 lemmas, 746 total reviews, 46% avg mastery)

**Old tables retained for rollback:**
- vocabulary
- vocabulary_forms
- vocabulary_lemmas
- vocabulary_occurrences
- user_vocabulary_progress

**Next Steps:**
1. Update frontend to use new tables
2. Fix data quality issues via content pipeline (singular nouns, "to" prefixes)
3. Rename/drop old tables after verification period

---

## [0.1.0] - 2025-11-01

### Added
- Initial project setup
- El Principito content (10 chapters, 463 sentences)
- Basic vocabulary tracking
- Supabase integration
