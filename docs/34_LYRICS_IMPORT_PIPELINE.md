# 34_LYRICS_IMPORT_PIPELINE.md

**Last Updated:** January 2, 2026
**Status:** Active
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Input Format](#input-format)
4. [Phase 1: Parse & Write](#phase-1-parse--write)
5. [Phase 2: Translate](#phase-2-translate)
6. [Phase 3: Flag Skippable](#phase-3-flag-skippable)
7. [Phase 4: Analyze Vocabulary](#phase-4-analyze-vocabulary)
8. [Phase 5: Insert Vocabulary](#phase-5-insert-vocabulary)
9. [Phase 7: Extract Words](#phase-7-extract-words)
10. [Phase 8: Detect Occurrences](#phase-8-detect-occurrences)
11. [Phase 9: Fix Translations](#phase-9-fix-translations)
12. [Database Tables](#database-tables)
13. [Quality Checks](#quality-checks)
14. [Manual Review](#manual-review)
15. [Command Reference](#command-reference)
16. [Lessons Learned](#lessons-learned)

---

## OVERVIEW

The lyrics import pipeline (`scripts/import_lyrics.py`) is a 9-phase process for importing song lyrics into Voquab. It handles:

- Parsing structured album text files
- Translating Spanish lyrics to English via DeepL
- Detecting Puerto Rican slang and idiomatic phrases
- Tokenizing lines into words with lemma links and positions
- Detecting phrase/slang occurrences with word positions
- AI-powered translation correction

### Architecture

Lyrics use word-level vocabulary linking (same as books):
- **`song_line_words`** links each word to its lemma via `lemma_id`
- **`song_line_phrase_occurrences`** tracks phrase positions within lines
- **`song_line_slang_occurrences`** tracks slang positions within lines

> **Note:** The `song_lemmas` table is deprecated and no longer created.

### Tools Used

| Tool | Purpose |
|------|---------|
| **spaCy** | Spanish NLP for tokenization and POS tagging |
| **DeepL API** | Bulk translation (Spanish → English) |
| **Claude API** | Slang/phrase detection, translation fixing |
| **Supabase** | Database storage |

### First Import: Bad Bunny "Debí Tirar Más Fotos"

| Metric | Count |
|--------|-------|
| Songs | 17 |
| Total lines | 922 |
| Learnable lines | 909 |
| Word records | 2,019 |
| Slang terms | 215 |
| Phrases | 118 |
| Phrase occurrences | 14 |
| Slang occurrences | 61 |

---

## PREREQUISITES

### Python Packages

```bash
pip3 install spacy requests
python3 -m spacy download es_core_news_sm
```

### API Keys (in `.env`)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
VITE_DEEPL_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

### Database Setup

Songs must exist in the `songs` table before import. Create song entries first, then run:

```bash
# Export song mappings to scripts/song_mappings.json
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('songs').select('song_id,title').then(({data}) => {
  require('fs').writeFileSync('scripts/song_mappings.json', JSON.stringify(data, null, 2));
  console.log('Exported', data.length, 'songs');
});
"
```

---

## INPUT FORMAT

### Album Text File Structure

Located at: `docs/Lyrics/[Album Name].txt`

```
Song Title: Lo Que Le Pasó a Hawaii

[Intro]
Line 1
Line 2

[Verse 1]
Line 3
Line 4
Line 5

[Chorus]
Line 6
Line 7

Song Title: Next Song Name

[Verse 1]
...
```

### Parsing Rules

1. **Song delimiter**: `Song Title: ` prefix starts new song
2. **Section headers**: `[Verse 1]`, `[Chorus]`, `[Bridge]`, `[Outro]`, etc.
3. **Lines**: Non-empty lines within sections
4. **Blank lines**: Ignored (used for visual separation)

### Section Types Detected

- `intro`, `verse`, `pre-chorus`, `chorus`, `post-chorus`
- `bridge`, `outro`, `hook`, `interlude`, `break`

---

## PHASE 1: PARSE & WRITE

**Flag:** `--write` or `-w`

Parses the album file and writes sections/lines to database.

```bash
# Preview only (no database writes)
python3 scripts/import_lyrics.py

# Write to database
python3 scripts/import_lyrics.py --write
```

### What It Does

1. Parses `docs/Lyrics/[Album].txt` for song structure
2. Matches song titles to `scripts/song_mappings.json`
3. Creates `song_sections` entries (verse, chorus, etc.)
4. Creates `song_lines` entries with `line_text` and `line_order`

### Database Tables Affected

- `song_sections`: section_type, section_order, section_label
- `song_lines`: line_text, line_order, section_id

---

## PHASE 2: TRANSLATE

**Flag:** `--translate` or `-t`

Bulk translates Spanish lyrics to English using DeepL API.

```bash
python3 scripts/import_lyrics.py --translate
```

### What It Does

1. Queries all `song_lines` where `translation IS NULL`
2. Batches lines (50 per request) to DeepL API
3. Updates `song_lines.translation` with English text

### Configuration

```python
TRANSLATION_BATCH_SIZE = 50
DEEPL_API_URL = "https://api.deepl.com/v2/translate"
```

### Known Limitations

- DeepL struggles with Puerto Rican slang
- Phonetic contractions often mistranslated
- Phase 9 (Fix Translations) addresses these issues

---

## PHASE 3: FLAG SKIPPABLE

**Flag:** `--flag-skippable` or `-f`

Detects vocalization lines that shouldn't be studied as vocabulary.

```bash
python3 scripts/import_lyrics.py --flag-skippable
```

### What It Does

1. Queries all `song_lines`
2. Detects vocalizations using pattern matching
3. Sets `is_skippable = true` for matching lines

### Vocalization Patterns

```python
VOCALIZATION_PATTERNS = [
    r'^[aeiouáéíóú\s,\-!¡]+$',  # Pure vowel sounds
    r'^(oh|ah|eh|uh|yeah|yeh|ey|ay|hey|la la|na na)+',
    r'^[♪♫\s]+$',  # Musical notes
    # ... more patterns
]
```

### Example Skipped Lines

- "Oh-oh-oh"
- "Yeah, yeah"
- "La la la"
- "Ey, ey, ey"

---

## PHASE 4: ANALYZE VOCABULARY

**Flag:** `--analyze` or `-a`

AI-powered detection of slang terms and idiomatic phrases.

```bash
python3 scripts/import_lyrics.py --analyze
```

### What It Does

1. Loads all learnable lines (is_skippable = false)
2. Sends to Claude API with vocabulary analysis prompt
3. Identifies:
   - **Slang terms**: Non-standard vocabulary (pa', cabrón, bellaqueo)
   - **Phrases**: Multi-word expressions (dar miedo, personas mayores)
4. Saves results to `scripts/vocabulary_analysis.json`

### Output Format

```json
{
  "slang_terms": [
    {
      "term": "pa'",
      "definition": "for/to (contraction of para)",
      "standard_equivalent": "para",
      "region": "Puerto Rico",
      "formality": "informal"
    }
  ],
  "phrases": [
    {
      "phrase": "dar miedo",
      "definition": "to scare, to frighten",
      "literal_translation": "to give fear"
    }
  ]
}
```

### Manual Review

After running, review `scripts/vocabulary_analysis.json`:
- Remove false positives
- Fix definitions
- Flag vulgar terms
- Save as `scripts/vocabulary_analysis_cleaned.json`

---

## PHASE 5: INSERT VOCABULARY

**Flag:** `--insert-vocab`

Inserts cleaned vocabulary to database.

```bash
python3 scripts/import_lyrics.py --insert-vocab
```

### What It Does

1. Loads `scripts/vocabulary_analysis_cleaned.json`
2. Creates `slang_terms` entries (or links existing)
3. Creates `phrases` entries (or links existing)
4. Creates `song_slang` and `song_phrases` junction records
5. Updates `songs.unique_slang_terms` counts

### Duplicate Handling

- Checks for existing terms/phrases by text match
- Links to existing if found
- Creates new only if not found

### Tables Created

- `slang_terms`: term definitions and metadata
- `phrases`: phrase definitions and metadata
- `song_slang`: links slang to songs (song-level)
- `song_phrases`: links phrases to songs (song-level)

> **Note:** `song_slang` and `song_phrases` are used by Phase 8 to detect occurrences at the line level.

---

## PHASE 7: EXTRACT WORDS

**Flag:** `--extract-lemmas`

Tokenizes lines and creates word records with lemma links.

```bash
python3 scripts/import_lyrics.py --extract-lemmas
```

### What It Does

1. Loads spaCy Spanish model (`es_core_news_sm`)
2. Processes each song one at a time (incremental saves)
3. For each learnable line:
   - Tokenizes with spaCy
   - Filters to meaningful POS (NOUN, VERB, ADJ, ADV, PROPN)
   - Skips slang terms (handled separately)
   - Tracks word position (1-indexed)
4. For each word:
   - Formats lemma (`el libro`, `la casa`, `vivir`)
   - Matches existing lemma or creates new
   - Builds grammatical_info JSONB
5. Creates `song_line_words` records

### Word Record Structure

```json
{
  "word_text": "Pensaba",
  "lemma_id": "uuid...",
  "song_id": "uuid...",
  "section_id": "uuid...",
  "line_id": "uuid...",
  "word_position": 1,
  "grammatical_info": {
    "pos": "VERB",
    "lemma_raw": "pensar",
    "morph": {"Mood": "Ind", "Tense": "Imp", ...}
  }
}
```

### Gender Heuristics

```python
def guess_gender_by_ending(noun):
    # Greek -ma words are masculine
    if noun in {'problema', 'sistema', 'tema', ...}:
        return 'M'

    # Feminine endings
    if noun.endswith(('ción', 'sión', 'dad', 'tad', 'tud')):
        return 'F'

    # -a usually feminine, -o usually masculine
    if noun.endswith('a'):
        return 'F'
    if noun.endswith('o'):
        return 'M'

    return 'M'  # Default
```

### Slang Exclusion

Slang terms are excluded from word extraction to prevent duplicates:
- `pa'` stays in slang_terms, not lemmas
- `bellaqueo` stays in slang_terms, not lemmas

---

## PHASE 8: DETECT OCCURRENCES

**Flag:** `--detect-occurrences`

Detects phrase and slang occurrences within lines and records their positions.

```bash
python3 scripts/import_lyrics.py --detect-occurrences
```

### What It Does

1. For each song:
   - Loads phrases linked via `song_phrases`
   - Loads slang terms linked via `song_slang`
2. For each learnable line:
   - Gets word records from `song_line_words`
   - Checks each phrase/slang for occurrence
   - Uses word boundary matching (prevents false positives)
   - Determines start/end word positions
3. Creates occurrence records

### Matching Algorithm

```python
# Word boundary matching for short terms (< 3 chars)
# Prevents "Pa" matching inside "paso"
if len(term) < 3:
    require_exact_word_match()
else:
    use_regex_word_boundaries()
```

### Occurrence Record Structure

```json
{
  "phrase_id": "uuid...",
  "line_id": "uuid...",
  "song_id": "uuid...",
  "section_id": "uuid...",
  "start_position": 2,
  "end_position": 3
}
```

### Tables Created

- `song_line_phrase_occurrences`: phrase positions within lines
- `song_line_slang_occurrences`: slang positions within lines

---

## PHASE 9: FIX TRANSLATIONS

**Flag:** `--fix-translations`

AI-powered translation correction pass.

```bash
python3 scripts/import_lyrics.py --fix-translations
```

### What It Does

1. Loads slang terms and phrases as reference
2. Processes each song one at a time
3. Sends lyrics + translations to Claude API
4. Claude identifies translation errors:
   - Idiomatic phrases translated literally
   - Slang not recognized
   - Phonetic contractions misunderstood
5. Updates `song_lines.translation` with corrections
6. Saves fix log to `scripts/translation_fixes.json`

### Example Fixes

| Spanish | Original (DeepL) | Fixed | Reason |
|---------|------------------|-------|--------|
| año' | on sale' | years | año' = años (dropped 's') |
| cabrón | bastard | awesome | Positive context in PR |
| pa'cá | for here | over here | p'acá = para acá |

### Error Handling

- 60-second timeout per song
- 2-second delay between API calls
- JSON extraction fallback for non-JSON responses
- Continues to next song on error

---

## DATABASE TABLES

### Core Tables

| Table | Purpose |
|-------|---------|
| `songs` | Song metadata (title, artist, album) |
| `albums` | Album metadata for grouping songs |
| `song_sections` | Section structure (verse, chorus, etc.) |
| `song_lines` | Individual lyric lines with translations |

### Word-Level Tables

| Table | Purpose |
|-------|---------|
| `song_line_words` | Tokenized words with positions and lemma links |
| `song_line_phrase_occurrences` | Phrase positions within lines |
| `song_line_slang_occurrences` | Slang positions within lines |

### Vocabulary Tables

| Table | Purpose |
|-------|---------|
| `slang_terms` | Slang/dialect vocabulary definitions |
| `phrases` | Multi-word expressions |
| `song_slang` | Song-level slang links (used by Phase 8) |
| `song_phrases` | Song-level phrase links (used by Phase 8) |

### Deprecated

| Table | Status |
|-------|--------|
| `song_lemmas` | **Deprecated** - no longer created or used |

---

## QUALITY CHECKS

### After Phase 4 (Analyze)

Run diagnostic queries:

```bash
# Check for terms with very short definitions
node scripts/check_slang_issues.cjs

# Export for review
cat scripts/vocabulary_analysis.json | jq '.slang_terms | length'
```

### After Phase 7 (Extract Words)

Check word distribution:

```sql
SELECT COUNT(*) FROM song_line_words;
SELECT song_id, COUNT(*) as word_count FROM song_line_words GROUP BY song_id;
```

### After Phase 8 (Detect Occurrences)

Check occurrence counts:

```sql
SELECT COUNT(*) FROM song_line_phrase_occurrences;
SELECT COUNT(*) FROM song_line_slang_occurrences;

-- Sample to verify positions look correct
SELECT
  p.phrase_text,
  sl.line_text,
  spo.start_position,
  spo.end_position
FROM song_line_phrase_occurrences spo
JOIN phrases p ON spo.phrase_id = p.phrase_id
JOIN song_lines sl ON spo.line_id = sl.line_id
LIMIT 5;
```

### After Phase 9 (Fix Translations)

Review fix quality:

```bash
cat scripts/translation_fixes.json | head -50
```

---

## MANUAL REVIEW

### Admin Dashboard Workflow

After import, use the Admin dashboard to:

1. **Review slang terms**: `/admin` → Slang section
   - Approve terms (set `is_approved = true`)
   - Fix definitions
   - Mark vulgar terms

2. **Review lemmas**: `/admin` → Lemmas section
   - Check POS assignments
   - Verify gender for nouns
   - Add missing definitions

3. **Review phrases**: `/admin` → Phrases section
   - Verify phrase boundaries
   - Check definitions

### Bulk Approval

```sql
-- Approve all slang terms after review
UPDATE slang_terms SET is_approved = true WHERE is_approved = false;
```

---

## COMMAND REFERENCE

### All Flags

```bash
# Preview parsed structure (no writes)
python3 scripts/import_lyrics.py

# Save parsed JSON
python3 scripts/import_lyrics.py --output parsed.json

# Phase 1: Write sections/lines to database
python3 scripts/import_lyrics.py --write

# Phase 2: Translate via DeepL
python3 scripts/import_lyrics.py --translate

# Phase 3: Flag vocalizations
python3 scripts/import_lyrics.py --flag-skippable

# Phase 4: AI vocabulary analysis (preview)
python3 scripts/import_lyrics.py --analyze

# Phase 5: Insert vocabulary to database
python3 scripts/import_lyrics.py --insert-vocab

# Phase 7: Extract words with spaCy
python3 scripts/import_lyrics.py --extract-lemmas

# Phase 8: Detect phrase/slang occurrences
python3 scripts/import_lyrics.py --detect-occurrences

# Phase 9: Fix translations with AI
python3 scripts/import_lyrics.py --fix-translations
```

### Typical Import Sequence

```bash
# 1. Create songs in database first (manual or script)

# 2. Export song mappings
node -e "..." > scripts/song_mappings.json

# 3. Run import phases
python3 scripts/import_lyrics.py --write
python3 scripts/import_lyrics.py --translate
python3 scripts/import_lyrics.py --flag-skippable
python3 scripts/import_lyrics.py --analyze

# 4. Manual review of vocabulary_analysis.json
# Save cleaned version as vocabulary_analysis_cleaned.json

# 5. Continue import
python3 scripts/import_lyrics.py --insert-vocab
python3 scripts/import_lyrics.py --extract-lemmas
python3 scripts/import_lyrics.py --detect-occurrences
python3 scripts/import_lyrics.py --fix-translations

# 6. Review in Admin dashboard
```

---

## LESSONS LEARNED

### DeepL Limitations

- Struggles with Puerto Rican dialect
- Phonetic spellings confuse it (`pa'` → "father" instead of "for")
- Regional slang often mistranslated
- **Solution**: Phase 9 AI correction pass

### Claude API Reliability

- Timeouts occur on complex songs
- Sometimes returns non-JSON responses
- **Solutions**:
  - 60-second timeout
  - JSON extraction fallback
  - 2-second delays between calls
  - Incremental saves per song

### Gender Determination

- spaCy morphology works ~70% of the time
- Heuristics based on word endings catch most remaining cases
- Claude API was too slow and unreliable
- **Solution**: Heuristic-only approach (no API)

### Slang vs Lemma Separation

- Early versions extracted slang as lemmas (duplicates)
- **Solution**: Load slang terms before word extraction, skip matches

### Phonetic Spellings

- 80 of 215 "slang" terms are just dropped-letter pronunciations
- Examples: `año'` (años), `pa'` (para), `to'` (todo)
- Kept in slang_terms for comprehension, but arguably different category
- **Future**: Consider `term_type` column (pronunciation, slang, diminutive)

### Word-Level Architecture Migration

- Originally used `song_lemmas` for song-level vocabulary links
- Migrated to `song_line_words` for word-level positions (like books)
- Enables highlighting vocabulary in context during reading
- Phrase/slang occurrences now have exact positions

### Incremental Processing

- Full-album processing fails on network issues
- **Solution**: Process one song at a time, commit immediately
- Progress survives interruptions

---

## RELATED DOCUMENTS

- **32_LYRICS_DATABASE_SPEC.md** - Database schema for lyrics tables
- **03_CONTENT_PIPELINE.md** - General content pipeline overview
- **02_DATABASE_SCHEMA.md** - Full database schema reference

---

## REVISION HISTORY

- 2026-01-02: Word-level architecture migration (Claude)
  - Phase 7 now creates `song_line_words` instead of `song_lemmas`
  - Added Phase 8: Detect Occurrences (`--detect-occurrences`)
  - Renumbered Fix Translations to Phase 9
  - Added `albums`, `song_line_words`, `song_line_phrase_occurrences`, `song_line_slang_occurrences` tables
  - Deprecated `song_lemmas` table
- 2026-01-02: Initial document created after Bad Bunny album import (Claude)
