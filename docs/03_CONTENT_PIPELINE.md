# 03_CONTENT_PIPELINE.md

**Last Updated:** January 2, 2026
**Status:** Active
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Pipeline Flowchart](#pipeline-flowchart)
3. [Prerequisites](#prerequisites)
4. [Step 1: Paste Chapter Text](#step-1-paste-chapter-text)
5. [Step 2: Split Into Sentences](#step-2-split-into-sentences)
6. [Step 3: Tokenize + Lemmatize (spaCy)](#step-3-tokenize--lemmatize-spacy)
7. [Step 4: Get or Create Lemmas](#step-4-get-or-create-lemmas)
8. [Step 5: Insert Word Instances](#step-5-insert-word-instances)
9. [Step 6: Translate Lemmas (DeepL)](#step-6-translate-lemmas-deepl)
10. [Step 7: Translate Sentences (DeepL)](#step-7-translate-sentences-deepl)
11. [Step 8: AI Semantic Validation](#step-8-ai-semantic-validation)
12. [Step 9: Manual Review](#step-9-manual-review)
13. [Step 10: AI Dictionary Form Validation](#step-10-ai-dictionary-form-validation)
14. [Step 11: Apply Dictionary Form Fixes](#step-11-apply-dictionary-form-fixes)
15. [Error Handling](#error-handling)
16. [Quality Metrics](#quality-metrics)
17. [Quick Reference](#quick-reference)

---

## OVERVIEW

The content pipeline transforms raw Spanish text from El Principito into production-ready vocabulary with 99% accurate translations. Each step includes validation checkpoints to ensure quality.

**Core Philosophy:** "Automate what we can, validate everything, make manual review efficient."

**Quality Target:** 99% accuracy before launch

**Tools Used:**
- **spaCy:** Spanish lemmatization and POS tagging
- **DeepL Pro:** High-quality translations
- **Claude API:** Semantic validation
- **Manual Review:** Final quality gate

---

## PIPELINE FLOWCHART

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Admin pastes chapter text                         │
│  Input: "Cuando yo tenía seis años..."                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Split into sentences (Python regex)               │
│  Output: ["Cuando yo tenía seis años...", "Un día..."]     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Tokenize + Lemmatize (spaCy)                      │
│  Output: [{text: "tenía", lemma: "tener", pos: "VERB"}]    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Get or create lemma entries                       │
│  Check: Does "tener" exist? If not, create placeholder     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Insert word instances                             │
│  Store: "tenía" at position 3, links to lemma "tener"      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: Batch translate lemmas (DeepL)                    │
│  Input: ["tener", "vivir"] → ["to have", "to live"]        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Batch translate sentences (DeepL)                 │
│  Input: "Cuando yo tenía..." → "When I was..."             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 8: AI semantic validation (Claude API)               │
│  Check: Do lemmas + definitions match sentence context?    │
│  Flag issues for manual review                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 9: Manual review (Admin dashboard)                   │
│  Review flagged issues, approve or fix                     │
│  Mark chapter as "production ready"                        │
└─────────────────────────────────────────────────────────────┘
```

---

## PREREQUISITES

### Python Environment

```bash
# Install required packages
pip install spacy deepl anthropic supabase psycopg2-binary

# Download Spanish language model
python -m spacy download es_core_news_sm
```

### API Keys Required

```bash
# .env file
DEEPL_API_KEY=your_deepl_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### Database Connection

```python
from supabase import create_client, Client

supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)
```

---

## STEP 1: PASTE CHAPTER TEXT

**Interface:** Admin dashboard text area

**Input Format:**
```
Cuando yo tenía seis años vi una magnífica lámina en un libro sobre el Bosque Virgen que se llamaba "Historias vividas". Representaba una serpiente boa que se tragaba a una fiera. Aquí tienen una copia del dibujo.

En el libro decía: "Las serpientes boas tragan enteras sus presas, sin masticarlas. Luego no pueden moverse y duermen durante los seis meses de su digestión."
```

**Validation:**
- Minimum 100 characters
- Contains Spanish characters (ñ, á, é, í, ó, ú)
- Not empty or just whitespace

**Storage:**
```python
def save_chapter_text(book_id, chapter_number, raw_text):
    """
    Save raw chapter text before processing.
    This allows re-processing if pipeline changes.
    """
    result = supabase.table('raw_chapter_imports').insert({
        'book_id': book_id,
        'chapter_number': chapter_number,
        'raw_text': raw_text,
        'import_status': 'pending',
        'imported_at': 'now()'
    }).execute()
    
    return result.data[0]['import_id']
```

---

## STEP 2: SPLIT INTO SENTENCES

**Goal:** Break chapter text into individual sentences

**Method:** Regex sentence splitter with Spanish punctuation rules

```python
import re

def split_into_sentences(chapter_text):
    """
    Split Spanish text into sentences.
    Handles Spanish punctuation: ., !, ?, ¡, ¿
    """
    
    # Remove excessive whitespace
    text = ' '.join(chapter_text.split())
    
    # Spanish sentence enders: . ! ? (but not ¿ ¡ at start)
    # Split on sentence enders followed by space and capital letter
    pattern = r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"])'
    sentences = re.split(pattern, text)
    
    # Clean and filter
    sentences = [s.strip() for s in sentences if s.strip()]
    
    return sentences

# Example usage
chapter_text = """
Cuando yo tenía seis años vi una magnífica lámina. 
Representaba una serpiente boa. 
¡Era magnífico!
"""

sentences = split_into_sentences(chapter_text)
# Result: [
#   "Cuando yo tenía seis años vi una magnífica lámina.",
#   "Representaba una serpiente boa.",
#   "¡Era magnífico!"
# ]
```

**Insert into Database:**

```python
def insert_sentences(chapter_id, sentences):
    """
    Insert sentences into database with order.
    Returns list of sentence_ids.
    """
    sentence_ids = []
    
    for i, sentence_text in enumerate(sentences):
        result = supabase.table('sentences').insert({
            'chapter_id': chapter_id,
            'sentence_order': i + 1,
            'sentence_text': sentence_text,
            'sentence_translation': None,  # Will translate in Step 7
            'created_at': 'now()'
        }).execute()
        
        sentence_ids.append(result.data[0]['sentence_id'])
    
    return sentence_ids
```

**Error Handling:**
- If sentence splitting produces <10 sentences, flag for manual review
- If any sentence is >500 characters, flag as "unusually long"
- Log sentence count for chapter verification

---

## STEP 3: TOKENIZE + LEMMATIZE (SPACY)

**Goal:** Break sentences into words and find canonical lemmas

**spaCy Configuration:**

```python
import spacy

# Load Spanish model
nlp = spacy.load("es_core_news_sm")

def process_sentence(sentence_text):
    """
    Tokenize sentence and extract lemmas + POS tags.
    Returns list of word data dictionaries.
    """
    doc = nlp(sentence_text)
    
    words = []
    for i, token in enumerate(doc):
        # Skip punctuation
        if token.is_punct:
            continue
        
        # Extract grammatical information
        grammatical_info = {
            'tense': token.morph.get('Tense'),
            'person': token.morph.get('Person'),
            'number': token.morph.get('Number'),
            'gender': token.morph.get('Gender')
        }
        
        # Clean up None values
        grammatical_info = {k: v[0] if v else None 
                           for k, v in grammatical_info.items()}
        
        word_data = {
            'word_text': token.text,
            'lemma_text': token.lemma_,
            'pos': token.pos_,  # VERB, NOUN, ADJ, etc.
            'word_position': i + 1,
            'grammatical_info': grammatical_info
        }
        
        words.append(word_data)
    
    return words

# Example
sentence = "Cuando yo tenía seis años vi una magnífica lámina."
words = process_sentence(sentence)

# Result:
# [
#   {
#     'word_text': 'Cuando',
#     'lemma_text': 'cuando',
#     'pos': 'SCONJ',
#     'word_position': 1,
#     'grammatical_info': {}
#   },
#   {
#     'word_text': 'tenía',
#     'lemma_text': 'tener',
#     'pos': 'VERB',
#     'word_position': 3,
#     'grammatical_info': {
#       'tense': 'Imp',  # Imperfect
#       'person': '1',
#       'number': 'Sing'
#     }
#   }
# ]
```

**Special Handling for Nouns:**

```python
def normalize_noun_lemma(lemma_text, gender):
    """
    Add article prefix to noun lemmas.
    "libro" → "el libro"
    "casa" → "la casa"
    """
    if gender == 'M' or gender == 'Masc':
        return f"el {lemma_text}"
    elif gender == 'F' or gender == 'Fem':
        return f"la {lemma_text}"
    else:
        # If gender unknown, use el as default
        return f"el {lemma_text}"
```

**Special Handling for Verbs:**

```python
def normalize_verb_lemma(lemma_text):
    """
    Ensure verb is in infinitive form.
    spaCy should already return infinitive, but verify.
    """
    # Spanish verb infinitives end in -ar, -er, -ir
    if lemma_text.endswith(('ar', 'er', 'ir')):
        return lemma_text
    else:
        # Log warning - spaCy might have returned non-infinitive
        print(f"Warning: Verb lemma '{lemma_text}' doesn't end in -ar/-er/-ir")
        return lemma_text
```

---

## STEP 4: GET OR CREATE LEMMAS

**Goal:** Ensure lemma entry exists in database

**Logic:**
1. Check if lemma already exists
2. If yes, return lemma_id
3. If no, create new lemma (without definition yet)

```python
def get_or_create_lemma(lemma_text, pos, language_code='es'):
    """
    Get existing lemma or create new one.
    Returns lemma_id.
    """
    
    # Check if lemma exists
    result = supabase.table('lemmas').select('lemma_id').eq(
        'lemma_text', lemma_text
    ).eq(
        'language_code', language_code
    ).execute()
    
    if result.data:
        # Lemma exists
        return result.data[0]['lemma_id']
    
    # Create new lemma
    gender = None
    if pos == 'NOUN':
        # Extract gender from article prefix
        if lemma_text.startswith('el '):
            gender = 'M'
        elif lemma_text.startswith('la '):
            gender = 'F'
    
    new_lemma = supabase.table('lemmas').insert({
        'lemma_text': lemma_text,
        'language_code': language_code,
        'part_of_speech': pos,
        'gender': gender,
        'definitions': [],  # Empty - will translate in Step 6
        'is_stop_word': False,
        'created_at': 'now()'
    }).execute()
    
    return new_lemma.data[0]['lemma_id']
```

**Stop Word Detection:**

```python
# Common Spanish stop words to flag
STOP_WORDS = {
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se',
    'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al',
    'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este',
    'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre'
}

def is_stop_word(lemma_text):
    """Check if lemma is a common stop word."""
    # Remove article if noun
    clean_text = lemma_text.replace('el ', '').replace('la ', '')
    return clean_text.lower() in STOP_WORDS
```

---

## STEP 5: INSERT WORD INSTANCES

**Goal:** Store each word occurrence with sentence context

```python
def insert_word(word_data, sentence_id, chapter_id, book_id, lemma_id):
    """
    Insert word instance into database.
    """
    result = supabase.table('words').insert({
        'word_text': word_data['word_text'],
        'lemma_id': lemma_id,
        'sentence_id': sentence_id,
        'chapter_id': chapter_id,
        'book_id': book_id,
        'word_position': word_data['word_position'],
        'grammatical_info': word_data['grammatical_info'],
        'created_at': 'now()'
    }).execute()
    
    return result.data[0]['word_id']

def process_full_sentence(sentence_id, chapter_id, book_id, sentence_text):
    """
    Complete processing for one sentence.
    """
    # Step 3: Tokenize + lemmatize
    words = process_sentence(sentence_text)
    
    for word_data in words:
        # Normalize lemma based on POS
        if word_data['pos'] == 'NOUN':
            gender = word_data['grammatical_info'].get('gender')
            lemma_text = normalize_noun_lemma(word_data['lemma_text'], gender)
        elif word_data['pos'] == 'VERB':
            lemma_text = normalize_verb_lemma(word_data['lemma_text'])
        else:
            lemma_text = word_data['lemma_text']
        
        # Step 4: Get or create lemma
        lemma_id = get_or_create_lemma(lemma_text, word_data['pos'])
        
        # Step 5: Insert word
        insert_word(word_data, sentence_id, chapter_id, book_id, lemma_id)
```

---

## STEP 6: TRANSLATE LEMMAS (DEEPL)

**Goal:** Add English definitions to lemmas

**DeepL Configuration:**

```python
import deepl
import os

translator = deepl.Translator(os.getenv('DEEPL_API_KEY'))

def translate_lemma(lemma_text, part_of_speech):
    """
    Translate Spanish lemma to English.
    Add "to" prefix for verbs, "the" prefix for nouns.
    """
    
    # Translate via DeepL
    result = translator.translate_text(
        lemma_text,
        source_lang="ES",
        target_lang="EN-US"
    )
    
    translation = result.text
    
    # Add prefixes based on POS
    if part_of_speech == 'VERB':
        # "vivir" → "to live"
        if not translation.lower().startswith('to '):
            translation = f"to {translation}"
    
    elif part_of_speech == 'NOUN':
        # "el libro" → "the book" (DeepL should handle article)
        # But verify and add if missing
        if not translation.lower().startswith('the '):
            translation = f"the {translation}"
    
    return translation

def batch_translate_lemmas():
    """
    Translate all lemmas that have empty definitions.
    Processes in batches for efficiency.
    """
    
    # Get untranslated lemmas
    result = supabase.table('lemmas').select(
        'lemma_id, lemma_text, part_of_speech'
    ).eq(
        'definitions', []
    ).execute()
    
    untranslated = result.data
    
    print(f"Found {len(untranslated)} untranslated lemmas")
    
    for lemma in untranslated:
        try:
            translation = translate_lemma(
                lemma['lemma_text'],
                lemma['part_of_speech']
            )
            
            # Update lemma with definition
            supabase.table('lemmas').update({
                'definitions': [translation],
                'updated_at': 'now()'
            }).eq(
                'lemma_id', lemma['lemma_id']
            ).execute()
            
            print(f"✓ Translated: {lemma['lemma_text']} → {translation}")
            
        except Exception as e:
            print(f"✗ Error translating {lemma['lemma_text']}: {e}")
            # Log error but continue
            continue
```

**Rate Limiting:**

```python
import time

def batch_translate_with_rate_limit(lemmas, calls_per_minute=50):
    """
    Translate lemmas with rate limiting to respect API limits.
    """
    delay = 60 / calls_per_minute  # Seconds between calls
    
    for i, lemma in enumerate(lemmas):
        translate_lemma(lemma['lemma_text'], lemma['part_of_speech'])
        
        # Add delay except for last item
        if i < len(lemmas) - 1:
            time.sleep(delay)
```

---

## STEP 7: TRANSLATE SENTENCES (DEEPL)

**Goal:** Add English translations to sentences

```python
def translate_sentence(sentence_text):
    """
    Translate Spanish sentence to English.
    """
    result = translator.translate_text(
        sentence_text,
        source_lang="ES",
        target_lang="EN-US"
    )
    
    return result.text

def batch_translate_sentences():
    """
    Translate all sentences without translations.
    """
    
    # Get untranslated sentences
    result = supabase.table('sentences').select(
        'sentence_id, sentence_text'
    ).is_(
        'sentence_translation', 'null'
    ).execute()
    
    untranslated = result.data
    
    print(f"Found {len(untranslated)} untranslated sentences")
    
    for sentence in untranslated:
        try:
            translation = translate_sentence(sentence['sentence_text'])
            
            # Update sentence
            supabase.table('sentences').update({
                'sentence_translation': translation
            }).eq(
                'sentence_id', sentence['sentence_id']
            ).execute()
            
            print(f"✓ Translated sentence {sentence['sentence_id'][:8]}...")
            
        except Exception as e:
            print(f"✗ Error translating sentence: {e}")
            continue
```

---

## STEP 8: AI SEMANTIC VALIDATION

**Goal:** Verify lemma assignments and definitions match sentence context

**Claude API Integration:**

```python
import anthropic

client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

def validate_sentence_semantics(sentence_id):
    """
    Use Claude to validate that word lemmas and definitions
    make sense in the context of the sentence.
    """
    
    # Fetch sentence with all words and lemmas
    query = """
        SELECT 
            s.sentence_text,
            s.sentence_translation,
            json_agg(
                json_build_object(
                    'word', w.word_text,
                    'lemma', l.lemma_text,
                    'definitions', l.definitions,
                    'pos', l.part_of_speech,
                    'position', w.word_position
                ) ORDER BY w.word_position
            ) as words
        FROM sentences s
        JOIN words w ON s.sentence_id = w.sentence_id
        JOIN lemmas l ON w.lemma_id = l.lemma_id
        WHERE s.sentence_id = :sentence_id
        GROUP BY s.sentence_id
    """
    
    # Execute via Supabase RPC or direct SQL
    sentence_data = execute_query(query, {'sentence_id': sentence_id})
    
    # Build validation prompt
    prompt = f"""
Validate this Spanish sentence analysis for a language learning app:

**Spanish:** {sentence_data['sentence_text']}
**English:** {sentence_data['sentence_translation']}

**Word Analysis:**
{json.dumps(sentence_data['words'], indent=2)}

**Validation Checks:**
1. Is each lemma correct for the word form in context?
2. Are definitions accurate and appropriate?
3. Are parts of speech correct?
4. Does the English sentence translation match the Spanish?

**Return JSON:**
{{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "issues": [
    {{
      "word": "word_text",
      "issue_type": "wrong_lemma" | "wrong_definition" | "wrong_pos",
      "current_value": "what it shows now",
      "suggested_value": "what it should be",
      "explanation": "why this is wrong",
      "confidence": 0.0-1.0
    }}
  ]
}}

If valid and no issues, return: {{"is_valid": true, "confidence": 1.0, "issues": []}}
    """
    
    # Call Claude API
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Parse response
    validation_result = json.loads(response.content[0].text)
    
    return validation_result

def batch_validate_chapter(chapter_id):
    """
    Validate all sentences in a chapter.
    Flag issues for manual review.
    """
    
    # Get all sentences in chapter
    result = supabase.table('sentences').select(
        'sentence_id'
    ).eq(
        'chapter_id', chapter_id
    ).order('sentence_order').execute()
    
    sentence_ids = [s['sentence_id'] for s in result.data]
    
    issues_found = []
    
    for sentence_id in sentence_ids:
        validation = validate_sentence_semantics(sentence_id)
        
        if not validation['is_valid']:
            # Store issues for manual review
            for issue in validation['issues']:
                supabase.table('validation_issues').insert({
                    'sentence_id': sentence_id,
                    'issue_type': issue['issue_type'],
                    'word_text': issue['word'],
                    'current_value': issue['current_value'],
                    'suggested_value': issue['suggested_value'],
                    'explanation': issue['explanation'],
                    'confidence': issue['confidence'],
                    'status': 'pending',
                    'created_at': 'now()'
                }).execute()
                
                issues_found.append(issue)
    
    return issues_found
```

**Validation Issues Table:**

```sql
CREATE TABLE validation_issues (
  issue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sentence_id UUID REFERENCES sentences(sentence_id),
  issue_type TEXT, -- wrong_lemma, wrong_definition, wrong_pos
  word_text TEXT,
  current_value TEXT,
  suggested_value TEXT,
  explanation TEXT,
  confidence DECIMAL(3,2),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, fixed
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## STEP 8B: DETECT IDIOMATIC PHRASES

**Goal:** Identify multi-word expressions where meaning differs from individual words

**Claude API Integration:**

```python
def detect_phrases_for_chapter(chapter_number):
    """
    Run phrase detection on all sentences in a chapter.
    Uses Claude API to identify idiomatic expressions.
    """
    # For each sentence in chapter:
    # 1. Send sentence to Claude with phrase detection prompt
    # 2. Claude returns phrases with confidence >= 80%
    # 3. Insert into phrases table
    # 4. Link to sentence via phrase_occurrences
```

**Phrase Types Detected:**

| Type | Description | Example |
|------|-------------|---------|
| **Idiom** | Non-literal meaning | "dar miedo" = "to scare" (not "to give fear") |
| **Collocation** | Frequently co-occurring | "tener razón" = "to be right" |
| **Compound** | Multi-word term | "personas mayores" = "grown-ups/adults" |

**Claude API Prompt:**

```python
PHRASE_DETECTION_PROMPT = """
Analyze the Spanish sentence and identify multi-word expressions where:
1. Combined meaning differs from sum of individual word meanings
2. Phrase is commonly used as fixed expression in Spanish

For each phrase, return:
- phrase_text: "personas mayores"
- phrase_type: "compound" (idiom/collocation/compound)
- definition: "grown-ups, adults"
- confidence: 90 (only include if >= 80)
- component_words: ["persona", "mayor"]
- learner_note: "Context-specific meaning for children's literature"
"""
```

**CLI Commands:**

```bash
# Detect phrases in chapter
python scripts/import_chapter.py --detect-phrases --chapter 1

# View detected phrases
python scripts/import_chapter.py --show-phrases --chapter 1
```

**Example Output:**

```
PHRASE DETECTION - Chapter 1
============================================================
Processing 26 sentences...
  [5/26] Found: "personas mayores" (compound) - grown-ups, adults
  [7/26] Found: "dar miedo" (idiom) - to scare, to frighten
  [12/26] Found: "selva virgen" (compound) - primeval forest
  [15/26] Found: "a fin de" (collocation) - in order to

PHRASE DETECTION COMPLETE
============================================================
  Sentences processed: 26
  Sentences with phrases: 8
  Total phrases found: 12

  Phrases by type:
    * compound: 6
    * collocation: 4
    * idiom: 2
```

**Database Storage:**

```sql
-- phrases table stores the expression
INSERT INTO phrases (phrase_text, definitions, phrase_type, component_lemma_ids)
VALUES ('personas mayores', '["grown-ups", "adults"]', 'compound', ARRAY[uuid1, uuid2]);

-- phrase_occurrences links to sentences (includes chapter_id for direct lookups)
INSERT INTO phrase_occurrences (phrase_id, sentence_id, chapter_id, start_word_position, end_word_position)
VALUES (phrase_uuid, sentence_uuid, chapter_uuid, 3, 4);

-- After import, refresh chapter vocabulary stats
SELECT refresh_chapter_vocabulary_stats(chapter_uuid);
```

**Manual Review Required:**

Detected phrases have `is_reviewed = false` until approved by admin:
- Review in admin dashboard
- Verify definition accuracy
- Add learner notes if needed
- Mark as reviewed when approved

**Phrase Deduplication (Cross-Chapter):**

When detecting phrases across multiple chapters, the system handles duplicates:

1. **Phrase exists & is_reviewed = true:** Skip update, just add new occurrence
   - Preserves manual corrections from earlier chapters
   - Approved definitions are not overwritten
2. **Phrase exists & is_reviewed = false:** Update with new AI detection
   - May add alternative definitions if different
3. **New phrase:** Insert with is_reviewed = false

This ensures:
- Approved phrases don't need re-approval in later chapters
- No duplicate phrase entries in database
- Consistent phrase database across book

```python
# Deduplication logic in insert_phrase()
if result.data:
    if result.data[0].get('is_reviewed', False):
        # Already reviewed - don't overwrite
        return phrase_id
    # Not reviewed - safe to update
    ...
```

---

## STEP 9: MANUAL REVIEW

**Admin Dashboard Interface:**

```
┌──────────────────────────────────────────────────────────┐
│  Validation Issues (12 pending)                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue #1 - Chapter 1, Sentence 3                       │
│                                                          │
│  Spanish: "Cuando yo tenía seis años..."                │
│  English: "When I was six years old..."                 │
│                                                          │
│  Word: "tenía"                                           │
│  Issue: Wrong lemma                                      │
│  Current: "tener"                                        │
│  Suggested: "tener" ✓ (correct)                         │
│  Confidence: 95%                                         │
│                                                          │
│  Explanation: The lemma "tener" is correct for the      │
│  imperfect form "tenía" in this context.                │
│                                                          │
│  [✓ Approve AI Suggestion] [✗ Reject] [✏️ Edit Manually]│
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Issue #2 - Chapter 1, Sentence 5                       │
│                                                          │
│  Spanish: "...un libro sobre el Bosque Virgen..."       │
│  English: "...a book about the Virgin Forest..."        │
│                                                          │
│  Word: "Bosque"                                          │
│  Issue: Wrong definition                                 │
│  Current: "the forest"                                   │
│  Suggested: "the forest (proper noun: Virgin Forest)"    │
│  Confidence: 88%                                         │
│                                                          │
│  [✓ Approve] [✗ Reject] [✏️ Edit]                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Manual Review Actions:**

```python
def approve_validation_suggestion(issue_id, user_id):
    """
    User approves AI suggestion.
    Apply the suggested fix automatically.
    """
    
    # Get issue details
    issue = supabase.table('validation_issues').select('*').eq(
        'issue_id', issue_id
    ).execute().data[0]
    
    # Apply fix based on issue type
    if issue['issue_type'] == 'wrong_lemma':
        # Update word to point to different lemma
        update_word_lemma(issue['word_text'], issue['suggested_value'])
    
    elif issue['issue_type'] == 'wrong_definition':
        # Update lemma definition
        update_lemma_definition(issue['current_lemma_id'], issue['suggested_value'])
    
    # Mark issue as fixed
    supabase.table('validation_issues').update({
        'status': 'approved',
        'reviewed_by': user_id,
        'reviewed_at': 'now()'
    }).eq('issue_id', issue_id).execute()

def reject_validation_suggestion(issue_id, user_id, reason):
    """
    User rejects AI suggestion (AI was wrong).
    Keep current value, mark as reviewed.
    """
    supabase.table('validation_issues').update({
        'status': 'rejected',
        'reviewed_by': user_id,
        'reviewed_at': 'now()',
        'admin_notes': reason
    }).eq('issue_id', issue_id).execute()
```

---

## STEP 10: AI DICTIONARY FORM VALIDATION

**Goal:** Ensure ALL lemmas are in canonical dictionary form (infinitives, masculine singular, etc.)

**Problem:** spaCy lemmatization is imperfect. After importing many chapters, the database accumulates:
- Conjugated verb forms stored as lemmas (compran, comprendo instead of comprar, comprender)
- Garbage entries from OCR/processing errors (llevarter, trabajer - fake verbs)
- Adjective variants (alguna instead of alguno)
- Improper capitalization of proper nouns (américa instead of América)

**Solution:** Use Claude API to validate ALL lemmas in batches.

**Script:** `scripts/validate_dictionary_forms.py`

```python
#!/usr/bin/env python3
"""
Validate that all lemmas are in their canonical dictionary form.
Uses Claude AI to check each lemma and identify issues.
"""

import anthropic
from supabase import create_client

BATCH_SIZE = 30  # Lemmas per API call

def validate_batch_with_ai(lemmas_batch):
    """Use Claude to validate a batch of lemmas."""

    # Format lemmas for the prompt
    lemma_list = []
    for l in lemmas_batch:
        defs = l.get('definitions', [])
        first_def = defs[0] if defs else 'NO TRANSLATION'
        gender = l.get('gender', '')
        gender_str = f", gender={gender}" if gender else ""
        lemma_list.append(f"- {l['lemma_text']} (POS={l['part_of_speech']}{gender_str}): \"{first_def}\"")

    lemmas_text = "\n".join(lemma_list)

    prompt = f"""You are a Spanish language expert validating a vocabulary database.

For each lemma below, determine if it is the CANONICAL DICTIONARY FORM. In Spanish dictionaries:
- VERBS: Always listed as infinitives ending in -ar, -er, or -ir (NOT conjugations like "compro", "hablas")
- ADJECTIVES: Listed as masculine singular (bueno, not buena/buenos/buenas)
- NOUNS: Listed as singular with appropriate article (el/la)
- NUMBERS: Cardinal forms (ciento, not cien which is apocopated)

Also identify:
- GARBAGE: Misspelled words that don't exist in Spanish (like "llevarter", "trabajer")
- DUPLICATES: Multiple lemmas that should be merged

LEMMAS TO VALIDATE:
{lemmas_text}

Return a JSON array with objects for ONLY problematic lemmas. Skip lemmas that are correct.
Each object should have:
- "lemma": the problematic lemma text
- "issue_type": one of "conjugation", "variant", "garbage", "duplicate", "misspelling"
- "canonical_form": the correct dictionary form (null if garbage/should delete)
- "explanation": brief explanation
- "confidence": 0-100

If ALL lemmas are correct, return: []
Respond with ONLY the JSON array, no other text."""

    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(response.content[0].text.strip())
```

**CLI Usage:**

```bash
# Run validation (dry run - just identify issues)
python3 scripts/validate_dictionary_forms.py --output dictionary_validation_results.json

# Generate fix script from results
python3 scripts/validate_dictionary_forms.py --output results.json --generate-fixes
```

**Expected Output:**

```
DICTIONARY FORM VALIDATION
================================================================================
Total lemmas: 1800

Batch 1/60 (30 lemmas)... Found 3 issues
Batch 2/60 (30 lemmas)... OK
Batch 3/60 (30 lemmas)... Found 5 issues
...

SUMMARY
================================================================================
Total issues found: 306
  conjugation: 55
  garbage: 81
  misspelling: 77
  variant: 88
  duplicate: 5
```

**Issue Categories Identified:**

| Category | Description | Example |
|----------|-------------|---------|
| **conjugation** | Verb form instead of infinitive | compran → comprar |
| **garbage** | Non-existent Spanish word | llevarter → DELETE |
| **variant** | Adjective not masculine singular | alguna → alguno |
| **misspelling** | Typo or OCR error | américa → América |
| **duplicate** | Same meaning, different entry | gran → grande |

---

## STEP 11: APPLY DICTIONARY FORM FIXES

**Goal:** Apply the fixes identified by AI validation

**Script:** `scripts/apply_dictionary_fixes.py`

**Three Fix Operations:**

1. **Merge to Canonical:** Reassign words from duplicate lemma to canonical, then delete duplicate
2. **Delete Garbage:** Delete lemma and all associated words (non-Spanish entries)
3. **Rename:** Update lemma_text to correct spelling/capitalization

```python
def merge_to_canonical(canonical_text, duplicates, lemma_lookup, stats, dry_run=True):
    """Merge duplicate lemmas into canonical form."""
    canonical = lemma_lookup[canonical_text]

    for dup_text in duplicates:
        if dup_text not in lemma_lookup:
            continue

        dup = lemma_lookup[dup_text]

        # Count words to reassign
        words = db.table('words').select('word_id', count='exact').eq('lemma_id', dup['lemma_id']).execute()
        word_count = words.count or 0

        print(f"  {dup_text} → {canonical_text} ({word_count} words)")

        if not dry_run:
            # Reassign words to canonical lemma
            if word_count > 0:
                db.table('words').update({'lemma_id': canonical['lemma_id']}).eq('lemma_id', dup['lemma_id']).execute()

            # Delete validation report for the duplicate
            db.table('validation_reports').delete().eq('lemma_id', dup['lemma_id']).execute()

            # Delete duplicate lemma
            db.table('lemmas').delete().eq('lemma_id', dup['lemma_id']).execute()

        stats['merged'] += 1
        stats['words_reassigned'] += word_count
```

**Fix Categories in Script:**

```python
# 1. Conjugations to merge into infinitives
conjugation_merges = {
    'comprar': ['compran'],
    'comprender': ['comprendo', 'el comprenderás'],
    'encontrar': ['la encontrara', 'el encontrarlo', 'encontrado'],
    'haber': ['has', 'haber él', 'haberme'],
    # ... 30+ entries
}

# 2. Garbage lemmas to delete
garbage_lemmas = [
    'bridge', 'indulgent',  # English words
    'hablarar', 'har', 'hazmer',  # Fake verbs from OCR
    'el administro', 'el apaga',  # Verb forms with articles
    # ... 78 total
]

# 3. Variants to merge
variant_merges = {
    'alguno': ['alguna'],
    'grande': ['gran'],
    'quién': ['quien'],
    # ... more
}

# 4. Capitalization fixes
capitalization_fixes = {
    'américa': 'América',
    'arizona': 'Arizona',
    'marte': 'Marte',
    # ... 8 total
}
```

**CLI Usage:**

```bash
# Dry run - see what would change
python3 scripts/apply_dictionary_fixes.py

# Apply changes
python3 scripts/apply_dictionary_fixes.py --apply
```

**Expected Output:**

```
APPLYING DICTIONARY FORM FIXES
================================================================================

*** DRY RUN MODE - No changes will be made ***

Total lemmas before: 1808

CONJUGATIONS → INFINITIVES
================================================================================
  compran → comprar (1 words)
  comprendo → comprender (1 words)
  el comprenderás → comprender (1 words)
...

GARBAGE LEMMAS → DELETE
================================================================================
  DELETE: bridge (1 words)
  DELETE: llevarter (0 words)
  DELETE: trabajer (0 words)
...

VARIANTS → CANONICAL FORMS
================================================================================
  alguna → alguno (3 words)
  gran → grande (2 words)
...

CAPITALIZATION FIXES
================================================================================
  RENAME: américa → América
  RENAME: marte → Marte
...

SUMMARY
================================================================================
  Lemmas merged: 64
  Lemmas deleted: 78
  Lemmas renamed: 8
  Words reassigned: 91
  Words deleted: 95
  TOTAL FIXES: 150

  Lemmas before: 1808
  Lemmas after: 1658
  Net reduction: 150
```

**Post-Fix Verification:**

```bash
# Run batch quality check on all chapters
python3 scripts/chapter_review/batch_quick_check.py

# Should show all chapters passing:
# Chapter 1: PASS - 0 issues
# Chapter 2: PASS - 0 issues
# ...
# Chapter 27: PASS - 0 issues
```

---

## KEY LEARNINGS: SPACY LEMMATIZATION ISSUES

During AI validation, we discovered systematic issues with spaCy's Spanish lemmatization:

### 1. Fake Verbs Created
spaCy sometimes creates non-existent verb forms by incorrectly applying conjugation rules:
- `llevarter` (doesn't exist - from "llevarte")
- `trabajer` (doesn't exist - from "trabajar")
- `hazmer` (doesn't exist - from "hacer")

### 2. Conjugations Returned as Lemmas
spaCy sometimes returns conjugated forms instead of infinitives:
- `compran` should be `comprar`
- `comprendo` should be `comprender`
- `duermen` should be `dormir`

### 3. Article + Verb Combinations
spaCy sometimes creates entries like:
- `el es` (should just be `ser`)
- `la va` (should just be `ir`)
- `el decir` (article shouldn't be on verb)

### 4. Reflexive Verbs
Some reflexive forms are valid lemmas, others should merge:
- VALID: `abstenerse`, `quitarse`, `reírse` (commonly listed as reflexive)
- MERGE: `ponerse` → `poner`, `tratarse` → `tratar`

**Recommendation:** After importing ALL chapters, run AI dictionary validation as a final cleanup step. This catches patterns that only become apparent with a complete dataset.

---

## ERROR HANDLING

### Common Errors and Solutions

**1. spaCy Lemmatization Fails**
```python
try:
    doc = nlp(sentence_text)
except Exception as e:
    # Log error
    log_error('spacy_lemmatization_failed', sentence_id, str(e))
    # Flag sentence for manual review
    flag_sentence_for_manual_review(sentence_id, 'spacy_failed')
```

**2. DeepL API Rate Limit**
```python
def translate_with_retry(text, max_retries=3):
    for attempt in range(max_retries):
        try:
            return translator.translate_text(text, source_lang="ES", target_lang="EN-US")
        except deepl.exceptions.QuotaExceededException:
            if attempt < max_retries - 1:
                wait_time = 60 * (attempt + 1)  # Exponential backoff
                time.sleep(wait_time)
            else:
                raise
```

**3. Duplicate Lemma Creation**
```python
# Race condition: Multiple words trying to create same lemma
# Solution: Use UPSERT pattern
def upsert_lemma(lemma_text, language_code, pos):
    result = supabase.table('lemmas').upsert({
        'lemma_text': lemma_text,
        'language_code': language_code,
        'part_of_speech': pos
    }, on_conflict='lemma_text,language_code').execute()
    
    return result.data[0]['lemma_id']
```

**4. Claude API Timeout**
```python
def validate_with_timeout(sentence_id, timeout=30):
    try:
        return validate_sentence_semantics(sentence_id)
    except anthropic.APITimeoutError:
        # Flag for manual review instead
        flag_sentence_for_manual_review(sentence_id, 'ai_validation_timeout')
        return None
```

---

## QUALITY METRICS

### Pipeline Success Metrics

```python
def calculate_chapter_quality(chapter_id):
    """
    Calculate quality metrics for a chapter.
    """
    
    # Total sentences
    total_sentences = count_sentences(chapter_id)
    
    # Translated sentences
    translated = count_translated_sentences(chapter_id)
    
    # Lemmas created
    total_lemmas = count_unique_lemmas(chapter_id)
    
    # Lemmas with definitions
    defined_lemmas = count_defined_lemmas(chapter_id)
    
    # Validation issues
    pending_issues = count_pending_issues(chapter_id)
    
    return {
        'translation_coverage': translated / total_sentences,
        'definition_coverage': defined_lemmas / total_lemmas,
        'validation_status': 'needs_review' if pending_issues > 0 else 'ready',
        'pending_issues': pending_issues,
        'quality_score': calculate_quality_score(...)
    }
```

### Launch Readiness Checklist

```
Chapter is production-ready when:
✓ 100% sentences translated
✓ 100% lemmas have definitions
✓ 0 pending validation issues
✓ Manual review completed by Peter + native speaker
✓ Quality score > 99%
```

---

## QUICK REFERENCE

### Full Pipeline Script

```python
def process_chapter(book_id, chapter_number, chapter_text):
    """
    Complete pipeline for one chapter.
    """
    
    print(f"Processing Chapter {chapter_number}...")
    
    # Step 1: Already have chapter_text from admin input
    
    # Step 2: Split sentences
    sentences = split_into_sentences(chapter_text)
    print(f"  Found {len(sentences)} sentences")
    
    # Create chapter record
    chapter_id = create_chapter(book_id, chapter_number, len(sentences))
    
    # Insert sentences
    sentence_ids = insert_sentences(chapter_id, sentences)
    print(f"  Inserted sentences")
    
    # Step 3-5: Process each sentence
    for sentence_id, sentence_text in zip(sentence_ids, sentences):
        process_full_sentence(sentence_id, chapter_id, book_id, sentence_text)
    
    print(f"  Processed all words")
    
    # Step 6: Batch translate lemmas
    batch_translate_lemmas()
    print(f"  Translated lemmas")
    
    # Step 7: Batch translate sentences
    batch_translate_sentences()
    print(f"  Translated sentences")
    
    # Step 8: AI validation
    issues = batch_validate_chapter(chapter_id)
    print(f"  Found {len(issues)} validation issues")
    
    # Step 9: Manual review (admin dashboard)
    print(f"  Ready for manual review")
    
    return chapter_id
```

### Command Line Usage

```bash
# Process single chapter
python pipeline.py --book "el-principito" --chapter 1 --input chapter1.txt

# Validate existing chapter
python pipeline.py --validate --chapter-id abc-123

# Batch translate untranslated lemmas
python pipeline.py --translate-lemmas

# Export quality report
python pipeline.py --quality-report --chapter 1 --output report.json
```

---

## RELATED DOCUMENTS

- See **02_DATABASE_SCHEMA.md** for table definitions
- See **22_ADMIN_DASHBOARD.md** for manual review interface
- See **21_MIGRATION_PLAN.md** for importing existing content

---

## PHRASE INTEGRATION IN LEARNING

### Threshold for Introduction

Phrases are introduced to users after they've learned 20% of a chapter's individual words.

**Example:**
- Chapter 1 has 52 unique lemmas
- After user learns 11 lemmas (21%), Chapter 1 phrases become available
- This ensures users have vocabulary foundation before tackling complex phrases

### Session Composition with Phrases

**80/20 Split (when phrases available):**
- 80% lemmas (12 cards in 15-card session)
- 20% phrases (3 cards in 15-card session)

**Ratio adjusts based on availability:**
- If fewer than 3 phrases available, use what's there
- If no phrases available (chapter not at 20%), 100% lemmas

### Phrase Selection Logic

```javascript
// Check which chapters are ready for phrases
const chaptersReadyForPhrases = await getChaptersReadyForPhrases(userId, unlockedChapters)

// Calculate split
const hasPhraseChapters = chaptersReadyForPhrases.length > 0
const lemmaCount = hasPhraseChapters ? Math.ceil(sessionSize * 0.8) : sessionSize
const phraseCount = hasPhraseChapters ? Math.floor(sessionSize * 0.2) : 0
```

### Phrase Progress Tracking

**Separate table:** `user_phrase_progress`

**Same FSRS columns as user_lemma_progress:**
- `stability`, `difficulty`, `due_date`
- `fsrs_state`, `reps`, `lapses`
- `last_seen_at`

**Same scheduling algorithm:**
- FSRS determines review intervals
- Same button responses (Again/Hard/Got It)
- Same exposure insurance logic

### Phrase Card Display

**Front (Spanish):**
- Phrase text: "personas mayores"
- Example sentence (phrase highlighted)
- "New Phrase" badge (if first time) or "Phrase" badge (purple)

**Back (English):**
- Definition: "grown-ups, adults"
- Part of speech: "phrase"
- Translated sentence

---

## LYRICS IMPORT PIPELINE

A separate pipeline exists for importing song lyrics. See **34_LYRICS_IMPORT_PIPELINE.md** for full documentation.

### Key Differences from Book Pipeline

| Aspect | Book Pipeline | Lyrics Pipeline |
|--------|---------------|-----------------|
| **Script** | `scripts/import_chapter.py` | `scripts/import_lyrics.py` |
| **Structure** | chapters → sentences → words | songs → sections → lines |
| **Slang** | Standard lemmas only | Separate `slang_terms` table |
| **Translation** | Per-lemma, then sentences | Per-line bulk translation |
| **Validation** | AI semantic validation | AI translation fixing |

### Lyrics-Specific Features

1. **Slang Detection**: AI-powered detection of Puerto Rican slang and phonetic spellings
2. **Section Types**: verse, chorus, bridge, intro, outro (vs chapters)
3. **Vocalization Flagging**: Auto-detect skippable lines ("oh", "eh", etc.)
4. **Gender Heuristics**: Spanish word endings determine article (el/la)

### Vocabulary Overlap

Songs share lemmas and phrases with El Principito:
- `song_lemmas` links songs to existing `lemmas` table
- `song_phrases` links songs to existing `phrases` table
- 17.2% of El Principito vocabulary appears in Bad Bunny album

### Usage

```bash
python3 scripts/import_lyrics.py --write            # Parse and save
python3 scripts/import_lyrics.py --translate        # DeepL translation
python3 scripts/import_lyrics.py --flag-skippable   # Detect vocalizations
python3 scripts/import_lyrics.py --analyze          # AI slang detection
python3 scripts/import_lyrics.py --insert-vocab     # Save vocabulary
python3 scripts/import_lyrics.py --extract-lemmas   # spaCy lemmas
python3 scripts/import_lyrics.py --fix-translations # AI correction
```

---

## REVISION HISTORY

- 2026-01-02: Added lyrics pipeline reference section (Claude)
- 2025-12-30: Updated phrase_occurrences to include chapter_id, added refresh_chapter_vocabulary_stats call
- 2025-12-13: Added "Phrase Integration in Learning" section documenting 20% threshold and 80/20 session split (Claude)
- 2025-12-06: Added Steps 10-11 for AI dictionary form validation (Claude)
- 2025-11-30: Initial draft (Claude)
- Status: Active

---

**END OF CONTENT PIPELINE**
