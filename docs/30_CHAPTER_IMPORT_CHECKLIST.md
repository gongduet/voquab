# 30_CHAPTER_IMPORT_CHECKLIST.md

**Last Updated:** December 4, 2025
**Status:** Active
**Owner:** Peter + Claude

---

## OVERVIEW

This checklist ensures consistent, high-quality chapter imports for El Principito. Follow this process for each chapter (2-27).

---

## PRE-IMPORT CHECKLIST

### 0. Split Combined Chapter Files (if needed)

If chapters are in combined files, split them first:

```bash
# Split chapters 3-10 (Chapter 2 already imported separately)
python3 scripts/split_chapters.py --input data/chapters-2-10-spanish.txt --chapters 3-10

# Split chapters 11-20
python3 scripts/split_chapters.py --input data/chapters-11-20-spanish.txt --chapters 11-20

# Split chapters 21-27
python3 scripts/split_chapters.py --input data/chapters-21-27-spanish.txt --chapters 21-27
```

This creates individual files: `data/chapter3-spanish.txt`, `data/chapter4-spanish.txt`, etc.

### 1. Verify Prerequisites

- [ ] Chapter text file ready (UTF-8 encoded)
- [ ] Previous chapter(s) successfully imported
- [ ] Database connection working
- [ ] API keys valid (DeepL, Anthropic)

### 2. Check System Status

```bash
# Verify database connectivity
python3 scripts/import_chapter.py --validate

# Check existing chapters
python3 -c "
from supabase import create_client
import os
from dotenv import load_dotenv
load_dotenv()
db = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
result = db.table('chapters').select('chapter_number').order('chapter_number').execute()
print('Existing chapters:', [c['chapter_number'] for c in result.data])
"
```

---

## IMPORT PROCESS

### Step 1: Import Chapter Content

```bash
# Full import with all features
python3 scripts/import_chapter.py \
  --chapter N \
  --input /path/to/chapter_N.txt
```

**Expected output:**
- Sentences split and inserted
- Words tokenized and linked to lemmas
- New lemmas created with translations
- Grammatical info captured

### Step 2: Run AI Validation

```bash
# Validate lemmas and sentences
python3 scripts/import_chapter.py \
  --validate-ai \
  --chapter N
```

**Expected output:**
- Lemma validation: X/Y valid
- Sentence validation: X/Y valid
- Issues flagged for review

### Step 3: Detect Phrases

```bash
# Detect idiomatic phrases
python3 scripts/import_chapter.py \
  --detect-phrases \
  --chapter N
```

**Expected output:**
- Phrases detected with confidence >= 80
- Linked to sentences
- Component lemmas identified

### Step 4: Review Issues

```bash
# Show flagged issues
python3 scripts/import_chapter.py \
  --show-issues \
  --chapter N
```

**Review each issue:**
- Fix true errors via SQL or re-import
- Mark false positives as reviewed
- Document any patterns for future improvement

### Step 5: Review Phrases

```bash
# Show detected phrases
python3 scripts/import_chapter.py \
  --show-phrases \
  --chapter N
```

**For each phrase:**
- Verify definition is accurate
- Mark as reviewed (is_reviewed = true) if correct
- Delete or fix incorrect phrases

---

## POST-IMPORT VALIDATION

### Run Validation Queries

```sql
-- 1. Content counts
SELECT
    'Lemmas' as type, COUNT(DISTINCT lemma_id) as count
FROM words WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N)
UNION ALL
SELECT 'Words', COUNT(*) FROM words
WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N)
UNION ALL
SELECT 'Sentences', COUNT(*) FROM sentences
WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N);

-- 2. Translation quality (should be 0)
SELECT COUNT(*) as verbs_missing_to
FROM lemmas WHERE part_of_speech = 'VERB'
AND definitions->>0 NOT LIKE 'to %'
AND lemma_id IN (SELECT DISTINCT lemma_id FROM words
    WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N));

SELECT COUNT(*) as nouns_missing_the
FROM lemmas WHERE part_of_speech = 'NOUN'
AND definitions->>0 NOT LIKE 'the %'
AND lemma_id IN (SELECT DISTINCT lemma_id FROM words
    WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N));

-- 3. Data integrity (should be 0)
SELECT COUNT(*) as orphan_words
FROM words WHERE lemma_id IS NULL
AND chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N);
```

### Validation Criteria

| Check | Expected | Action if Failed |
|-------|----------|------------------|
| Sentences > 10 | Yes | Verify input file |
| All words linked | 0 orphans | Check lemmatization |
| Verbs have "to " | 0 missing | Fix translations |
| Nouns have "the " | 0 missing | Fix translations |
| Validation issues < 20% | Yes | Review flagged items |

---

## MANUAL REVIEW STEPS

### 1. Native Speaker Sample (20%)

Select ~20% of sentences for native speaker review:

```sql
SELECT sentence_text, sentence_translation
FROM sentences
WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N)
ORDER BY random()
LIMIT 5;  -- Adjust based on chapter size
```

**Check:**
- Translation accuracy
- Natural English phrasing
- Context-appropriate meaning

### 2. Phrase Approval

For each detected phrase:

```sql
-- View pending phrases
SELECT phrase_text, definitions, phrase_type, is_reviewed
FROM phrases
WHERE is_reviewed = false
ORDER BY phrase_text;

-- Approve a phrase
UPDATE phrases SET is_reviewed = true WHERE phrase_text = 'phrase text here';

-- Delete incorrect phrase
DELETE FROM phrase_occurrences WHERE phrase_id = 'uuid';
DELETE FROM phrases WHERE phrase_id = 'uuid';
```

---

## CHAPTER COMPLETION CHECKLIST

### Required Before Next Chapter

- [ ] All sentences translated
- [ ] All lemmas have definitions
- [ ] Translation quality checks pass (0 issues)
- [ ] Data integrity checks pass (0 orphans)
- [ ] AI validation issues reviewed (<10% remaining)
- [ ] Phrases reviewed and approved
- [ ] Native speaker sample reviewed (20%)

### Documentation Update

After completing each chapter, update:

```markdown
# In 99_LIVING_CHANGELOG.md

## [DATE] - Chapter N Import

### Added
- Chapter N: X sentences, Y unique lemmas
- Z phrases detected (W approved)

### Issues Resolved
- [List any notable fixes]

### Status
- Chapter N ready for production
```

---

## POST-BOOK AI VALIDATION (After All Chapters Imported)

After importing ALL chapters, run a comprehensive AI validation pass to catch systematic spaCy issues:

### Step 6: AI Dictionary Form Validation

Run after all chapters are imported to validate lemmas are in canonical dictionary form:

```bash
# Validate ALL lemmas across the entire book
python3 scripts/validate_dictionary_forms.py --output dictionary_validation_results.json

# This identifies:
# - Conjugated verb forms (compran → comprar)
# - Garbage entries (fake verbs like llevarter)
# - Adjective variants (alguna → alguno)
# - Capitalization issues (américa → América)
```

**Expected findings:** ~15-20% of lemmas may need fixes. For El Principito (1800 lemmas), we found 306 issues.

### Step 7: Apply Dictionary Form Fixes

Review the identified issues and apply fixes:

```bash
# Dry run - see what would change
python3 scripts/apply_dictionary_fixes.py

# Apply changes
python3 scripts/apply_dictionary_fixes.py --apply
```

**Fix types:**
- **Merge:** Reassign words from duplicate to canonical lemma
- **Delete:** Remove garbage (non-Spanish) entries
- **Rename:** Fix spelling/capitalization

### Step 8: Verify All Chapters Pass

```bash
# Run batch quality check
python3 scripts/chapter_review/batch_quick_check.py

# Should show all chapters passing:
# Chapter 1: PASS - 0 issues
# Chapter 2: PASS - 0 issues
# ...
# Chapter 27: PASS - 0 issues
```

---

## ROLLBACK PROCEDURE

If import fails or needs to be redone:

```sql
-- 1. Delete words for chapter
DELETE FROM words
WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N);

-- 2. Delete sentences for chapter
DELETE FROM sentences
WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N);

-- 3. Delete phrase occurrences for chapter sentences
DELETE FROM phrase_occurrences
WHERE sentence_id IN (
    SELECT sentence_id FROM sentences
    WHERE chapter_id = (SELECT chapter_id FROM chapters WHERE chapter_number = N)
);

-- 4. Optionally delete chapter record
DELETE FROM chapters WHERE chapter_number = N;

-- 5. Clean up orphaned lemmas (optional - only if sure)
DELETE FROM lemmas
WHERE lemma_id NOT IN (SELECT DISTINCT lemma_id FROM words);

-- 6. Clean up orphaned phrases
DELETE FROM phrases
WHERE phrase_id NOT IN (SELECT DISTINCT phrase_id FROM phrase_occurrences);
```

**Note:** Be careful with lemma/phrase cleanup - they may be used by other chapters.

---

## ESTIMATED TIME PER CHAPTER

| Step | Time | Notes |
|------|------|-------|
| Import | 2-5 min | Automated |
| AI Validation | 3-5 min | Automated |
| Phrase Detection | 2-3 min | Automated |
| Issue Review | 10-20 min | Manual |
| Phrase Approval | 5-10 min | Manual |
| Native Review | 10-15 min | Manual |
| **Total** | **30-60 min** | Per chapter |

---

## TROUBLESHOOTING

### Common Issues

**1. "Lemma already exists"**
- Normal - lemma from previous chapter
- System handles this automatically

**2. "Translation API rate limit"**
- Wait 1 minute and retry
- Or use `--translate-only` flag later

**3. "spaCy model not found"**
```bash
python -m spacy download es_core_news_sm
```

**4. "Database connection failed"**
- Check .env file
- Verify Supabase credentials
- Check network connectivity

**5. "Phrase detection timeout"**
- Reduce batch size
- Check Anthropic API status
- Retry with `--detect-phrases`

---

## CLI REFERENCE

### Chapter Splitting

```bash
# Split combined chapter file into individual files
python3 scripts/split_chapters.py --input data/chapters-X-Y-spanish.txt --chapters X-Y
```

### Batch Import

```bash
# Import multiple chapters at once
./scripts/batch_import_chapters.sh 3 10   # Import chapters 3-10
./scripts/batch_import_chapters.sh 11 20  # Import chapters 11-20
```

### Single Chapter Import

```bash
# Full chapter import
python3 scripts/import_chapter.py --chapter N --input file.txt

# Re-import (clears existing data)
python3 scripts/import_chapter.py --chapter N --input file.txt

# Skip clearing (add to existing)
python3 scripts/import_chapter.py --chapter N --input file.txt --no-clear

# Translation only (for new lemmas)
python3 scripts/import_chapter.py --translate-only

# AI validation
python3 scripts/import_chapter.py --validate-ai --chapter N

# Show validation issues
python3 scripts/import_chapter.py --show-issues --chapter N

# Phrase detection
python3 scripts/import_chapter.py --detect-phrases --chapter N

# Show phrases
python3 scripts/import_chapter.py --show-phrases --chapter N

# Validation queries
python3 scripts/import_chapter.py --validate
```

### Post-Book Validation

```bash
# AI dictionary form validation (run after ALL chapters imported)
python3 scripts/validate_dictionary_forms.py --output dictionary_validation_results.json

# Apply fixes (dry run first)
python3 scripts/apply_dictionary_fixes.py
python3 scripts/apply_dictionary_fixes.py --apply

# Batch quality check all chapters
python3 scripts/chapter_review/batch_quick_check.py

# Exhaustive AI validation (deep check of all lemmas)
python3 scripts/chapter_review/exhaustive_ai_validation.py --output validation_results.json
```

---

## KNOWN SPACY ISSUES

After importing the full El Principito, we identified systematic spaCy lemmatization problems:

| Issue | Example | Fix |
|-------|---------|-----|
| Fake verbs created | llevarter, trabajer, hazmer | Delete |
| Conjugations as lemmas | compran, comprendo, duermen | Merge to infinitive |
| Article + verb | el es, la va, el decir | Remove article |
| Adjective variants | alguna instead of alguno | Merge to masculine singular |
| Missing capitalization | américa, marte | Rename to América, Marte |

**Key insight:** Run AI dictionary validation AFTER importing all chapters to catch patterns that emerge only with complete data.

---

## RELATED DOCUMENTS

- **02_DATABASE_SCHEMA.md** - Table definitions
- **03_CONTENT_PIPELINE.md** - Pipeline details
- **99_LIVING_CHANGELOG.md** - Change tracking

---

**END OF CHAPTER IMPORT CHECKLIST**
