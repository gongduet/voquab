#!/usr/bin/env python3
"""
Lyrics Import Script

Phase 1: Parse album file and preview what would be imported
Phase 2: Write sections and lines to database (--write flag)
Phase 3: Translate lines via DeepL API (--translate flag)
Phase 4: Flag vocalizations as skippable (--flag-skippable flag)
Phase 5: AI-powered slang & phrase detection (--analyze flag)
Phase 6: Insert cleaned vocabulary to database (--insert-vocab flag)
Phase 7: Extract words with spaCy, create song_line_words (--extract-lemmas flag)
Phase 8: Detect phrase/slang occurrences with positions (--detect-occurrences flag)
Phase 9: AI-powered translation fixing (--fix-translations flag)

Usage:
    python3 scripts/import_lyrics.py                      # Preview only
    python3 scripts/import_lyrics.py --output out.json    # Save parsed JSON
    python3 scripts/import_lyrics.py --write              # Write to database
    python3 scripts/import_lyrics.py --translate          # Translate untranslated lines
    python3 scripts/import_lyrics.py --flag-skippable     # Flag vocalization lines
    python3 scripts/import_lyrics.py --analyze            # Analyze slang & phrases (preview)
    python3 scripts/import_lyrics.py --insert-vocab       # Insert vocabulary to database
    python3 scripts/import_lyrics.py --extract-lemmas     # Extract words with spaCy
    python3 scripts/import_lyrics.py --detect-occurrences # Detect phrase/slang occurrences
    python3 scripts/import_lyrics.py --fix-translations   # Fix translations with Claude AI
"""

import json
import math
import os
import re
import time
import unicodedata
from pathlib import Path
from typing import Dict, List, Tuple
import argparse
import requests


def load_env_file(env_path: Path) -> None:
    """Load environment variables from .env file (simple parser)."""
    if not env_path.exists():
        return
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip()
            # Remove surrounding quotes if present
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            os.environ.setdefault(key, value)


# Load environment variables from project root .env
SCRIPT_DIR_ENV = Path(__file__).parent
PROJECT_ROOT_ENV = SCRIPT_DIR_ENV.parent
load_env_file(PROJECT_ROOT_ENV / '.env')

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
ALBUM_FILE = PROJECT_ROOT / "docs" / "Lyrics" / "Debí Tirar Más Fotos - Album.txt"
SONG_MAPPINGS_FILE = SCRIPT_DIR / "song_mappings.json"
PARSED_LYRICS_FILE = SCRIPT_DIR / "parsed_lyrics.json"

# Supabase config
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# DeepL config
DEEPL_API_KEY = os.getenv('VITE_DEEPL_API_KEY')
DEEPL_API_URL = "https://api.deepl.com/v2/translate"
TRANSLATION_BATCH_SIZE = 50

# Claude API config
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-sonnet-4-20250514"
VOCABULARY_ANALYSIS_FILE = SCRIPT_DIR / "vocabulary_analysis.json"
VOCABULARY_CLEANED_FILE = SCRIPT_DIR / "vocabulary_analysis_cleaned.json"
TRANSLATION_FIXES_FILE = SCRIPT_DIR / "translation_fixes.json"

# Vulgar words for formality detection
VULGAR_WORDS = {'cabrón', 'coño', 'carajo', 'puñeta', 'mierda', 'verga', 'culo',
                'chingar', 'joder', 'puta', 'cojón', 'cojones', 'bicho', 'toto',
                'totito', 'cuero', 'singue', 'putería'}

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: Supabase credentials not found in environment")


class SupabaseClient:
    """Simple Supabase REST API client using requests."""

    def __init__(self, url: str, key: str):
        self.base_url = f"{url}/rest/v1"
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

    def insert(self, table: str, data: dict | list) -> Tuple[bool, dict | list | str]:
        """Insert row(s) into table. Returns (success, data_or_error)."""
        url = f"{self.base_url}/{table}"
        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code in (200, 201):
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    def update(self, table: str, data: dict, filters: dict) -> Tuple[bool, str]:
        """Update rows matching filters. Returns (success, message)."""
        url = f"{self.base_url}/{table}"

        # Build query params for filters
        params = {f"{k}": f"eq.{v}" for k, v in filters.items()}

        response = requests.patch(url, headers=self.headers, json=data, params=params)

        if response.status_code in (200, 204):
            return True, "Updated"
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    def delete(self, table: str, filters: dict) -> Tuple[bool, str]:
        """Delete rows matching filters. Returns (success, message)."""
        url = f"{self.base_url}/{table}"
        params = {f"{k}": f"eq.{v}" for k, v in filters.items()}

        response = requests.delete(url, headers=self.headers, params=params)

        if response.status_code in (200, 204):
            return True, "Deleted"
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    def select(self, table: str, columns: str = "*", filters: dict = None,
               or_filters: List[str] = None) -> Tuple[bool, list | str]:
        """
        Select rows from table. Returns (success, data_or_error).
        or_filters: list of filter strings for OR conditions, e.g. ["translation.eq.", "translation.is.null"]
        """
        url = f"{self.base_url}/{table}"
        params = {"select": columns}

        if filters:
            for k, v in filters.items():
                params[k] = f"eq.{v}"

        if or_filters:
            params["or"] = f"({','.join(or_filters)})"

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"


def normalize_title(title: str) -> str:
    """Normalize title for matching (lowercase, remove accents, strip punctuation)."""
    title = title.lower().strip()
    title = unicodedata.normalize('NFD', title)
    title = ''.join(c for c in title if unicodedata.category(c) != 'Mn')
    title = re.sub(r"[^\w\s]", "", title)
    title = re.sub(r'\s+', ' ', title)
    return title


def load_song_mappings() -> Dict[str, dict]:
    """Load song_id mappings from JSON file."""
    with open(SONG_MAPPINGS_FILE, 'r', encoding='utf-8') as f:
        songs = json.load(f)

    mappings = {}
    for song in songs:
        normalized = normalize_title(song['title'])
        mappings[normalized] = {
            'song_id': song['song_id'],
            'title': song['title']
        }

    return mappings


def parse_album_file(filepath: Path) -> List[dict]:
    """Parse the album file and extract songs with sections."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    song_pattern = re.compile(r'^Song Title:\s*(.+)$', re.MULTILINE)
    matches = list(song_pattern.finditer(content))

    parsed_songs = []

    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start_pos = match.end()
        end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(content)

        lyrics_text = content[start_pos:end_pos].strip()
        raw_sections = re.split(r'\n\s*\n', lyrics_text)

        sections = []
        for section_text in raw_sections:
            lines = [line.strip() for line in section_text.strip().split('\n') if line.strip()]
            if lines:
                sections.append(lines)

        total_lines = sum(len(s) for s in sections)

        parsed_songs.append({
            'parsed_title': title,
            'sections': sections,
            'total_sections': len(sections),
            'total_lines': total_lines
        })

    return parsed_songs


def match_songs_to_database(parsed_songs: List[dict], mappings: Dict[str, dict]) -> Tuple[List[dict], List[str]]:
    """Match parsed songs to database entries."""
    matched = []
    unmatched = []

    for song in parsed_songs:
        normalized = normalize_title(song['parsed_title'])

        if normalized in mappings:
            db_song = mappings[normalized]
            matched.append({
                'title': db_song['title'],
                'song_id': db_song['song_id'],
                'parsed_title': song['parsed_title'],
                'sections': [
                    {'section_order': i + 1, 'lines': lines}
                    for i, lines in enumerate(song['sections'])
                ],
                'total_sections': song['total_sections'],
                'total_lines': song['total_lines']
            })
        else:
            unmatched.append(song['parsed_title'])

    return matched, unmatched


def import_song_to_database(client: SupabaseClient, song: dict) -> Tuple[bool, str]:
    """
    Import a single song's sections and lines to database.
    Returns (success, message).
    """
    song_id = song['song_id']
    sections_imported = 0
    lines_imported = 0

    try:
        # Insert each section
        for section_data in song['sections']:
            section_order = section_data['section_order']
            lines = section_data['lines']

            # Insert section
            section_record = {
                'song_id': song_id,
                'section_type': 'stanza',
                'section_order': section_order,
                'section_label': None,
                'is_skippable': False,
                'total_lines': len(lines)
            }

            success, result = client.insert('song_sections', section_record)
            if not success:
                return False, f"Section {section_order} insert failed: {result}"

            section_id = result[0]['section_id']
            sections_imported += 1

            # Insert lines for this section
            line_records = [
                {
                    'section_id': section_id,
                    'line_order': i + 1,
                    'line_text': line_text,
                    'translation': '',
                    'is_skippable': False
                }
                for i, line_text in enumerate(lines)
            ]

            if line_records:
                success, result = client.insert('song_lines', line_records)
                if not success:
                    return False, f"Lines for section {section_order} insert failed: {result}"

                lines_imported += len(line_records)

        # Update song counts
        success, msg = client.update('songs', {
            'total_sections': sections_imported,
            'total_lines': lines_imported
        }, {'song_id': song_id})

        if not success:
            return False, f"Song update failed: {msg}"

        return True, f"{sections_imported} sections, {lines_imported} lines"

    except Exception as e:
        return False, str(e)


def rollback_song(client: SupabaseClient, song_id: str) -> None:
    """Delete any partially imported data for a song."""
    # Get section IDs
    # Note: For a proper rollback, we'd need to track what was inserted
    # For now, we'll rely on the fact that we clear data before import
    pass


def write_to_database(songs: List[dict]) -> dict:
    """Write all songs to database. Returns summary."""
    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    results = {
        'success': [],
        'failed': [],
        'total_sections': 0,
        'total_lines': 0
    }

    print()
    print("=" * 60)
    print("PHASE 2: DATABASE IMPORT")
    print("=" * 60)
    print()

    for song in songs:
        title = song['title']
        print(f"Importing {title}... ", end='', flush=True)

        success, message = import_song_to_database(client, song)

        if success:
            print(f"{message} ✓")
            results['success'].append(title)
            results['total_sections'] += song['total_sections']
            results['total_lines'] += song['total_lines']
        else:
            print(f"✗ {message}")
            results['failed'].append({'title': title, 'error': message})

    return results


# ============================================================
# PHASE 3: Translation via DeepL
# ============================================================

def translate_batch_deepl(texts: List[str]) -> Tuple[bool, List[str] | str, int]:
    """
    Translate a batch of texts using DeepL API.
    Returns (success, translations_or_error, characters_used).
    """
    if not texts:
        return True, [], 0

    headers = {
        'Authorization': f'DeepL-Auth-Key {DEEPL_API_KEY}',
        'Content-Type': 'application/json'
    }

    payload = {
        'text': texts,
        'source_lang': 'ES',
        'target_lang': 'EN-US',
        'formality': 'prefer_less'
    }

    # Count characters for cost tracking
    chars_used = sum(len(t) for t in texts)

    try:
        response = requests.post(DEEPL_API_URL, headers=headers, json=payload)

        if response.status_code == 200:
            result = response.json()
            translations = [t['text'] for t in result['translations']]
            return True, translations, chars_used
        else:
            return False, f"HTTP {response.status_code}: {response.text}", chars_used

    except Exception as e:
        return False, str(e), chars_used


def get_untranslated_lines(client: SupabaseClient) -> Tuple[bool, list | str]:
    """
    Query all song_lines where translation is empty or NULL.
    Returns (success, lines_or_error).
    """
    url = f"{client.base_url}/song_lines"
    params = {
        "select": "line_id,line_text",
        "or": "(translation.eq.,translation.is.null)",
        "order": "line_id"
    }

    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        return True, response.json()
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def translate_lines() -> dict:
    """Translate all untranslated song lines via DeepL. Returns summary."""
    if not DEEPL_API_KEY:
        print("ERROR: DEEPL_API_KEY not found in environment.")
        return {'error': 'Missing API key'}

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 3: BULK TRANSLATION (DeepL)")
    print("=" * 60)
    print()

    # Get untranslated lines
    print("Querying untranslated lines... ", end='', flush=True)
    success, lines = get_untranslated_lines(client)

    if not success:
        print(f"✗ {lines}")
        return {'error': lines}

    total_lines = len(lines)
    print(f"{total_lines} lines found")

    if total_lines == 0:
        print("All lines already translated!")
        return {
            'translated': 0,
            'batches': 0,
            'errors': 0,
            'characters': 0
        }

    # Calculate batches
    total_batches = math.ceil(total_lines / TRANSLATION_BATCH_SIZE)
    print(f"Translating in {total_batches} batches of {TRANSLATION_BATCH_SIZE}...")
    print()

    results = {
        'translated': 0,
        'batches': 0,
        'errors': 0,
        'characters': 0,
        'failed_lines': []
    }

    # Process in batches
    for batch_num in range(total_batches):
        start_idx = batch_num * TRANSLATION_BATCH_SIZE
        end_idx = min(start_idx + TRANSLATION_BATCH_SIZE, total_lines)
        batch_lines = lines[start_idx:end_idx]
        batch_size = len(batch_lines)

        print(f"Translating batch {batch_num + 1}/{total_batches}... ", end='', flush=True)

        # Extract texts for translation
        texts = [line['line_text'] for line in batch_lines]
        line_ids = [line['line_id'] for line in batch_lines]

        # Call DeepL
        success, translations, chars = translate_batch_deepl(texts)
        results['characters'] += chars

        if not success:
            print(f"✗ {translations}")
            results['errors'] += 1
            results['failed_lines'].extend(line_ids)
            # Continue with next batch
            time.sleep(1)
            continue

        # Update database with translations
        update_errors = 0
        for i, (line_id, translation) in enumerate(zip(line_ids, translations)):
            success, msg = client.update('song_lines', {'translation': translation}, {'line_id': line_id})
            if not success:
                update_errors += 1
                results['failed_lines'].append(line_id)

        if update_errors > 0:
            print(f"{batch_size - update_errors} lines ✓ ({update_errors} update errors)")
            results['errors'] += update_errors
        else:
            print(f"{batch_size} lines ✓")

        results['translated'] += batch_size - update_errors
        results['batches'] += 1

        # Delay between batches (if not last batch)
        if batch_num < total_batches - 1:
            time.sleep(1)

    return results


# ============================================================
# PHASE 4: Flag Skippable Lines (Vocalizations)
# ============================================================

# Common vocalization syllables
VOCALIZATION_SYLLABLES = [
    'eh', 'oh', 'ah', 'uh', 'yeh', 'yeah', 'la', 'na', 'da', 'ra',
    've', 'pa', 'ta', 'ba', 'ma', 'wa', 'ya', 'hey', 'ay', 'ey',
    'ooh', 'aah', 'uuh', 'hmm', 'mmm', 'mm', 'shh', 'ssh'
]

# Standalone interjections (case insensitive)
STANDALONE_INTERJECTIONS = [
    'shh', 'hmm', 'uh', 'ah', 'oh', 'eh', 'mmm', 'ooh', 'aah',
    'hey', 'ay', 'ey', 'yeah', 'yeh', 'woo', 'woo-hoo', 'woohoo'
]


def is_vocalization_line(line_text: str) -> bool:
    """
    Determine if a line is a pure vocalization (no real Spanish words).
    Returns True if the line should be flagged as skippable.
    """
    if not line_text:
        return True

    text = line_text.strip().lower()

    # Empty or whitespace only
    if not text:
        return True

    # Remove punctuation for analysis but keep hyphens for syllable patterns
    # First, let's normalize the text
    cleaned = re.sub(r'[,.\'"!?¿¡()[\]{}]', '', text)
    cleaned = cleaned.strip()

    if not cleaned:
        return True

    # Check if it's a single standalone interjection
    if cleaned in STANDALONE_INTERJECTIONS:
        return True

    # Check for repeated syllable patterns like "eh-eh-eh" or "la la la" or "ve-ve-ve-ve"
    # Split by spaces and hyphens
    parts = re.split(r'[\s\-]+', cleaned)

    # Filter out empty parts
    parts = [p for p in parts if p]

    if not parts:
        return True

    # Check if ALL parts are vocalization syllables
    all_vocalizations = all(
        part in VOCALIZATION_SYLLABLES or
        # Also check for doubled syllables like "ohoh" or "eheh"
        (len(part) <= 6 and any(part == syl * 2 or part == syl * 3 for syl in VOCALIZATION_SYLLABLES))
        for part in parts
    )

    if all_vocalizations:
        return True

    # Check for pattern: single syllable repeated many times
    # e.g., "ve-ve-ve-ve-ve-ve-ve-ve-ve-ve-ve"
    if len(parts) >= 3:
        unique_parts = set(parts)
        # Only flag if the repeated part is a known vocalization syllable
        if len(unique_parts) == 1 and parts[0] in VOCALIZATION_SYLLABLES:
            return True

    return False


def get_all_lines(client: SupabaseClient) -> Tuple[bool, list | str]:
    """Query all song_lines. Returns (success, lines_or_error)."""
    url = f"{client.base_url}/song_lines"
    params = {
        "select": "line_id,line_text,is_skippable",
        "order": "line_id"
    }

    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        return True, response.json()
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def flag_skippable_lines() -> dict:
    """Flag vocalization lines as skippable. Returns summary."""
    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 4: FLAG SKIPPABLE LINES")
    print("=" * 60)
    print()

    # Get all lines
    print("Querying all song lines... ", end='', flush=True)
    success, lines = get_all_lines(client)

    if not success:
        print(f"✗ {lines}")
        return {'error': lines}

    total_lines = len(lines)
    print(f"{total_lines} lines found")
    print()

    # Analyze lines
    to_flag = []
    for line in lines:
        if is_vocalization_line(line['line_text']):
            to_flag.append(line)

    print(f"Detected {len(to_flag)} vocalization lines")
    print()

    if not to_flag:
        print("No lines to flag!")
        return {
            'flagged': 0,
            'learnable': total_lines,
            'flagged_lines': []
        }

    # Show what will be flagged
    print("LINES TO FLAG AS SKIPPABLE:")
    print("-" * 60)
    for line in to_flag:
        text = line['line_text'][:50] if line['line_text'] else "(empty)"
        already = " (already)" if line['is_skippable'] else ""
        print(f"  • {text}{already}")
    print()

    # Update database
    print("Updating database... ", end='', flush=True)
    flagged_count = 0
    errors = []

    for line in to_flag:
        if not line['is_skippable']:  # Only update if not already flagged
            success, msg = client.update(
                'song_lines',
                {'is_skippable': True},
                {'line_id': line['line_id']}
            )
            if success:
                flagged_count += 1
            else:
                errors.append({'line_id': line['line_id'], 'error': msg})
        else:
            flagged_count += 1  # Count already flagged

    if errors:
        print(f"✗ {len(errors)} errors")
    else:
        print("✓")

    return {
        'flagged': len(to_flag),
        'newly_flagged': flagged_count - sum(1 for l in to_flag if l['is_skippable']),
        'learnable': total_lines - len(to_flag),
        'flagged_lines': [l['line_text'] for l in to_flag],
        'errors': errors
    }


# ============================================================
# PHASE 5: AI-Powered Slang & Phrase Detection
# ============================================================

SLANG_ANALYSIS_PROMPT = """Analyze these Puerto Rican Spanish lyrics and identify:

1. SLANG TERMS - Non-standard vocabulary
   - Phonetic contractions (pa', to', -ao/-á endings, Toy, etc.)
   - Regional expressions (Acho, Dime, corillo, etc.)
   - Format: {"term": "...", "standard": "...", "meaning": "..."}

2. IDIOMATIC PHRASES - Multi-word expressions where literal translation fails
   - Format: {"phrase": "...", "literal": "...", "actual": "..."}

Return JSON only, no explanation:
{
  "slang": [...],
  "phrases": [...]
}

LYRICS:
"""


def call_claude_api(prompt: str, timeout: int = 30) -> Tuple[bool, dict | str]:
    """
    Call Claude API with a prompt.
    Returns (success, response_json_or_error).
    """
    headers = {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
    }

    payload = {
        'model': CLAUDE_MODEL,
        'max_tokens': 4096,
        'messages': [
            {'role': 'user', 'content': prompt}
        ]
    }

    try:
        response = requests.post(ANTHROPIC_API_URL, headers=headers, json=payload, timeout=timeout)

        if response.status_code == 200:
            result = response.json()
            # Extract text from response
            text = result['content'][0]['text']
            # Parse JSON from response (handle potential markdown code blocks)
            text = text.strip()
            if text.startswith('```'):
                # Remove markdown code block
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])

            # Try to find JSON object in response if direct parse fails
            try:
                return True, json.loads(text)
            except json.JSONDecodeError:
                # Try to extract JSON from the text (find { ... })
                start = text.find('{')
                end = text.rfind('}')
                if start != -1 and end != -1 and end > start:
                    json_str = text[start:end + 1]
                    return True, json.loads(json_str)
                # If no JSON found, return empty fixes
                return True, {"fixes": []}
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    except requests.exceptions.Timeout:
        return False, "Request timeout (30s)"
    except json.JSONDecodeError as e:
        return False, f"JSON parse error: {e}"
    except Exception as e:
        return False, str(e)


def get_learnable_lines_by_song(client: SupabaseClient) -> Tuple[bool, dict | str]:
    """
    Query all learnable lines grouped by song.
    Returns (success, {song_id: {title, lines}} or error).
    """
    # Get songs with their IDs and titles
    url = f"{client.base_url}/songs"
    params = {"select": "song_id,title", "order": "title"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    songs = {s['song_id']: {'title': s['title'], 'lines': []} for s in response.json()}

    # Get all learnable lines with section info to map to songs
    url = f"{client.base_url}/song_lines"
    params = {
        "select": "line_id,line_text,section_id",
        "is_skippable": "eq.false",
        "order": "line_id"
    }
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    lines = response.json()

    # Get sections to map lines to songs
    url = f"{client.base_url}/song_sections"
    params = {"select": "section_id,song_id"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    section_to_song = {s['section_id']: s['song_id'] for s in response.json()}

    # Group lines by song
    for line in lines:
        song_id = section_to_song.get(line['section_id'])
        if song_id and song_id in songs:
            songs[song_id]['lines'].append(line['line_text'])

    return True, songs


def get_existing_slang_terms(client: SupabaseClient) -> Tuple[bool, set | str]:
    """Get all existing slang terms (lowercase for matching)."""
    url = f"{client.base_url}/slang_terms"
    params = {"select": "term"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        terms = {t['term'].lower() for t in response.json()}
        return True, terms
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def get_existing_phrases(client: SupabaseClient) -> Tuple[bool, set | str]:
    """Get all existing phrases (lowercase for matching)."""
    url = f"{client.base_url}/phrases"
    params = {"select": "phrase_text"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        phrases = {p['phrase_text'].lower() for p in response.json()}
        return True, phrases
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def analyze_vocabulary() -> dict:
    """Analyze all songs for slang and phrases using Claude API. Returns summary."""
    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not found in environment.")
        return {'error': 'Missing API key'}

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 5: SLANG & PHRASE DETECTION (Claude API)")
    print("=" * 60)
    print()

    # Get existing vocabulary
    print("Loading existing vocabulary... ", end='', flush=True)
    success, existing_slang = get_existing_slang_terms(client)
    if not success:
        print(f"✗ {existing_slang}")
        return {'error': existing_slang}

    success, existing_phrases = get_existing_phrases(client)
    if not success:
        print(f"✗ {existing_phrases}")
        return {'error': existing_phrases}

    print(f"{len(existing_slang)} slang, {len(existing_phrases)} phrases")

    # Get learnable lines by song
    print("Loading learnable lines... ", end='', flush=True)
    success, songs = get_learnable_lines_by_song(client)
    if not success:
        print(f"✗ {songs}")
        return {'error': songs}

    total_songs = len([s for s in songs.values() if s['lines']])
    total_lines = sum(len(s['lines']) for s in songs.values())
    print(f"{total_lines} lines across {total_songs} songs")
    print()

    # Results aggregation
    results = {
        'existing_slang_matched': [],
        'new_slang_to_create': [],
        'existing_phrases_matched': [],
        'new_phrases_to_create': [],
        'songs_analyzed': 0,
        'errors': []
    }

    # Analyze each song
    for song_id, song_data in songs.items():
        if not song_data['lines']:
            continue

        title = song_data['title']
        print(f"Analyzing {title}... ", end='', flush=True)

        # Build prompt with lyrics
        lyrics_text = '\n'.join(song_data['lines'])
        prompt = SLANG_ANALYSIS_PROMPT + lyrics_text

        # Call Claude API
        success, analysis = call_claude_api(prompt)

        if not success:
            print(f"✗ {analysis}")
            results['errors'].append({'song': title, 'error': analysis})
            time.sleep(2)
            continue

        # Process slang terms
        slang_count = 0
        for item in analysis.get('slang', []):
            term = item.get('term', '').lower()
            if not term:
                continue

            if term in existing_slang:
                if term not in [s['term'] for s in results['existing_slang_matched']]:
                    results['existing_slang_matched'].append({
                        'term': item.get('term'),
                        'found_in': title
                    })
            else:
                # Check if we've already added this new term
                existing_new = [s['term'].lower() for s in results['new_slang_to_create']]
                if term not in existing_new:
                    results['new_slang_to_create'].append({
                        'term': item.get('term'),
                        'standard': item.get('standard'),
                        'meaning': item.get('meaning'),
                        'found_in': title
                    })
                    slang_count += 1

        # Process phrases
        phrase_count = 0
        for item in analysis.get('phrases', []):
            phrase = item.get('phrase', '').lower()
            if not phrase:
                continue

            if phrase in existing_phrases:
                if phrase not in [p['phrase'] for p in results['existing_phrases_matched']]:
                    results['existing_phrases_matched'].append({
                        'phrase': item.get('phrase'),
                        'found_in': title
                    })
            else:
                # Check if we've already added this new phrase
                existing_new = [p['phrase'].lower() for p in results['new_phrases_to_create']]
                if phrase not in existing_new:
                    results['new_phrases_to_create'].append({
                        'phrase': item.get('phrase'),
                        'literal': item.get('literal'),
                        'actual': item.get('actual'),
                        'found_in': title
                    })
                    phrase_count += 1

        results['songs_analyzed'] += 1
        print(f"✓ ({slang_count} new slang, {phrase_count} new phrases)")

        # Delay between API calls
        time.sleep(2)

    # Save results to file
    print()
    print(f"Saving analysis to {VOCABULARY_ANALYSIS_FILE}... ", end='', flush=True)
    with open(VOCABULARY_ANALYSIS_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("✓")

    return results


# ============================================================
# PHASE 6: Insert Cleaned Vocabulary
# ============================================================

def is_vulgar_term(text: str) -> bool:
    """Check if text contains vulgar words."""
    text_lower = text.lower()
    return any(word in text_lower for word in VULGAR_WORDS)


def get_song_id_by_title(client: SupabaseClient, title: str) -> str | None:
    """Look up song_id by title."""
    url = f"{client.base_url}/songs"
    params = {"select": "song_id", "title": f"eq.{title}"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        data = response.json()
        return data[0]['song_id'] if data else None
    return None


def get_slang_id_by_term(client: SupabaseClient, term: str) -> str | None:
    """Look up slang_id by term (case-insensitive)."""
    url = f"{client.base_url}/slang_terms"
    params = {"select": "slang_id", "term": f"ilike.{term}"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        data = response.json()
        return data[0]['slang_id'] if data else None
    return None


def get_phrase_id_by_text(client: SupabaseClient, phrase_text: str) -> str | None:
    """Look up phrase_id by phrase_text (case-insensitive)."""
    url = f"{client.base_url}/phrases"
    params = {"select": "phrase_id", "phrase_text": f"ilike.{phrase_text}"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        data = response.json()
        return data[0]['phrase_id'] if data else None
    return None


def link_exists(client: SupabaseClient, table: str, filters: dict) -> bool:
    """Check if a link already exists."""
    url = f"{client.base_url}/{table}"
    params = {f"{k}": f"eq.{v}" for k, v in filters.items()}
    params["select"] = "song_id"
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return len(response.json()) > 0
    return False


def insert_vocabulary() -> dict:
    """Insert cleaned vocabulary into database. Returns summary."""
    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 6: INSERT VOCABULARY")
    print("=" * 60)
    print()

    # Load cleaned vocabulary
    print(f"Loading {VOCABULARY_CLEANED_FILE}... ", end='', flush=True)
    if not VOCABULARY_CLEANED_FILE.exists():
        print("✗ File not found")
        print("Run --analyze first, then review vocabulary_analysis_cleaned.json")
        return {'error': 'File not found'}

    with open(VOCABULARY_CLEANED_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print("✓")

    # Load song mappings for ID lookup
    print("Loading song mappings... ", end='', flush=True)
    with open(SONG_MAPPINGS_FILE, 'r', encoding='utf-8') as f:
        songs = json.load(f)
    song_id_map = {s['title']: s['song_id'] for s in songs}
    print(f"{len(song_id_map)} songs")
    print()

    results = {
        'slang_created': 0,
        'slang_linked_existing': 0,
        'phrases_created': 0,
        'phrases_linked_existing': 0,
        'skipped_flagged': 0,
        'errors': []
    }

    # --------------------------------------------------------
    # Insert NEW slang terms
    # --------------------------------------------------------
    print("INSERTING NEW SLANG TERMS:")
    print("-" * 40)

    new_slang = [s for s in data['new_slang_to_create'] if '_flag' not in s]
    flagged_slang = [s for s in data['new_slang_to_create'] if '_flag' in s]
    results['skipped_flagged'] += len(flagged_slang)

    for slang in new_slang:
        term = slang['term']
        song_title = slang.get('found_in', '')
        song_id = song_id_map.get(song_title)

        if not song_id:
            results['errors'].append(f"No song_id for '{song_title}'")
            continue

        # Determine formality
        formality = 'vulgar' if is_vulgar_term(term) or is_vulgar_term(slang.get('meaning', '')) else 'informal'

        # Insert slang term
        slang_record = {
            'term': term,
            'definition': slang.get('meaning', ''),
            'standard_equivalent': slang.get('standard', ''),
            'region': 'Puerto Rico',
            'formality': formality,
            'is_approved': False
        }

        success, result = client.insert('slang_terms', slang_record)
        if not success:
            if 'duplicate' in str(result).lower():
                # Term already exists, just link it
                slang_id = get_slang_id_by_term(client, term)
                if slang_id and not link_exists(client, 'song_slang', {'song_id': song_id, 'slang_id': slang_id}):
                    client.insert('song_slang', {'song_id': song_id, 'slang_id': slang_id})
                    results['slang_linked_existing'] += 1
            else:
                results['errors'].append(f"Slang '{term}': {result}")
            continue

        slang_id = result[0]['slang_id']
        results['slang_created'] += 1

        # Create song_slang link
        client.insert('song_slang', {'song_id': song_id, 'slang_id': slang_id})

        print(f"  + {term} [{formality}]")

    print(f"  Created: {results['slang_created']}, Skipped flagged: {len(flagged_slang)}")
    print()

    # --------------------------------------------------------
    # Link EXISTING slang matches
    # --------------------------------------------------------
    print("LINKING EXISTING SLANG:")
    print("-" * 40)

    for match in data.get('existing_slang_matched', []):
        term = match['term']
        song_title = match.get('found_in', '')
        song_id = song_id_map.get(song_title)

        if not song_id:
            continue

        slang_id = get_slang_id_by_term(client, term)
        if slang_id and not link_exists(client, 'song_slang', {'song_id': song_id, 'slang_id': slang_id}):
            success, _ = client.insert('song_slang', {'song_id': song_id, 'slang_id': slang_id})
            if success:
                results['slang_linked_existing'] += 1
                print(f"  → {term} → {song_title}")

    print(f"  Linked: {results['slang_linked_existing']}")
    print()

    # --------------------------------------------------------
    # Insert NEW phrases
    # --------------------------------------------------------
    print("INSERTING NEW PHRASES:")
    print("-" * 40)

    new_phrases = [p for p in data['new_phrases_to_create'] if '_flag' not in p]
    flagged_phrases = [p for p in data['new_phrases_to_create'] if '_flag' in p]
    results['skipped_flagged'] += len(flagged_phrases)

    for phrase in new_phrases:
        phrase_text = phrase['phrase']
        song_title = phrase.get('found_in', '')
        song_id = song_id_map.get(song_title)

        if not song_id:
            results['errors'].append(f"No song_id for '{song_title}'")
            continue

        # Build definition combining actual and literal meanings
        actual_meaning = phrase.get('actual', '')
        literal_meaning = phrase.get('literal', '')
        definitions = []
        if actual_meaning:
            definitions.append(actual_meaning)
        if literal_meaning and literal_meaning != actual_meaning:
            definitions.append(f"(lit: {literal_meaning})")

        # Insert phrase
        phrase_record = {
            'phrase_text': phrase_text,
            'definitions': definitions,
            'phrase_type': 'idiom',
            'is_reviewed': False,
            'component_lemmas': []
        }

        success, result = client.insert('phrases', phrase_record)
        if not success:
            if 'duplicate' in str(result).lower():
                # Phrase already exists, just link it
                phrase_id = get_phrase_id_by_text(client, phrase_text)
                if phrase_id and not link_exists(client, 'song_phrases', {'song_id': song_id, 'phrase_id': phrase_id}):
                    client.insert('song_phrases', {'song_id': song_id, 'phrase_id': phrase_id})
                    results['phrases_linked_existing'] += 1
            else:
                results['errors'].append(f"Phrase '{phrase_text}': {result}")
            continue

        phrase_id = result[0]['phrase_id']
        results['phrases_created'] += 1

        # Create song_phrases link
        client.insert('song_phrases', {'song_id': song_id, 'phrase_id': phrase_id})

        print(f"  + {phrase_text[:40]}...")

    print(f"  Created: {results['phrases_created']}, Skipped flagged: {len(flagged_phrases)}")
    print()

    # --------------------------------------------------------
    # Link EXISTING phrase matches
    # --------------------------------------------------------
    print("LINKING EXISTING PHRASES:")
    print("-" * 40)

    existing_phrase_links = 0
    for match in data.get('existing_phrases_matched', []):
        phrase_text = match['phrase']
        song_title = match.get('found_in', '')
        song_id = song_id_map.get(song_title)

        if not song_id:
            continue

        phrase_id = get_phrase_id_by_text(client, phrase_text)
        if phrase_id and not link_exists(client, 'song_phrases', {'song_id': song_id, 'phrase_id': phrase_id}):
            success, _ = client.insert('song_phrases', {'song_id': song_id, 'phrase_id': phrase_id})
            if success:
                existing_phrase_links += 1
                print(f"  → {phrase_text} → {song_title}")

    print(f"  Linked: {existing_phrase_links}")
    print()

    # --------------------------------------------------------
    # Update song counts
    # --------------------------------------------------------
    print("UPDATING SONG COUNTS:")
    print("-" * 40)

    for song in songs:
        song_id = song['song_id']
        title = song['title']

        # Count slang for this song
        url = f"{client.base_url}/song_slang"
        params = {"select": "slang_id", "song_id": f"eq.{song_id}"}
        response = requests.get(url, headers=client.headers, params=params)
        slang_count = len(response.json()) if response.status_code == 200 else 0

        # Update song
        success, _ = client.update('songs', {'unique_slang_terms': slang_count}, {'song_id': song_id})
        if success:
            print(f"  {title}: {slang_count} slang terms")

    print()
    return results


# ============================================================
# PHASE 7: Lemma Extraction with spaCy
# ============================================================

# POS tags to include (spaCy Universal POS tags)
INCLUDE_POS = {'NOUN', 'VERB', 'ADJ', 'ADV', 'PROPN'}

# Gender prompt for Claude API
GENDER_DETERMINATION_PROMPT = """Determine the grammatical gender of these Spanish nouns.
Return JSON only with the gender for each word: {"word": "M" or "F"}

NOUNS:
"""


def load_spacy_model():
    """Load spaCy Spanish model."""
    try:
        import spacy
        try:
            return spacy.load("es_core_news_sm")
        except OSError:
            print("  Downloading es_core_news_sm model...")
            import subprocess
            subprocess.run(["python3", "-m", "spacy", "download", "es_core_news_sm"], check=True)
            return spacy.load("es_core_news_sm")
    except ImportError:
        print("ERROR: spaCy not installed. Run: pip install spacy")
        return None


def get_learnable_lines_with_songs(client: SupabaseClient) -> Tuple[bool, list | str]:
    """
    Get all learnable lines with their song info.
    Returns (success, [line_data, ...] or error).
    Each line_data includes: line_id, line_text, section_id, song_id, song_title
    """
    # Get sections with their songs
    url = f"{client.base_url}/song_sections"
    params = {"select": "section_id,song_id,songs(title)"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    section_to_song = {}
    for s in response.json():
        section_to_song[s['section_id']] = {
            'song_id': s['song_id'],
            'title': s['songs']['title'] if s['songs'] else 'Unknown'
        }

    # Get learnable lines with line_id
    url = f"{client.base_url}/song_lines"
    params = {
        "select": "line_id,line_text,section_id",
        "is_skippable": "eq.false",
        "order": "line_id"
    }
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    result = []
    for line in response.json():
        song_info = section_to_song.get(line['section_id'], {})
        result.append({
            'line_id': line['line_id'],
            'line_text': line['line_text'],
            'section_id': line['section_id'],
            'song_id': song_info.get('song_id'),
            'song_title': song_info.get('title', 'Unknown')
        })

    return True, result


def get_existing_lemmas_map(client: SupabaseClient) -> Tuple[bool, dict | str]:
    """
    Get all existing lemmas as a map {lemma_text_lower: lemma_id}.
    """
    url = f"{client.base_url}/lemmas"
    params = {"select": "lemma_id,lemma_text"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        return True, {l['lemma_text'].lower(): l['lemma_id'] for l in response.json()}
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def get_slang_terms_set(client: SupabaseClient) -> Tuple[bool, set | str]:
    """Get all slang terms as lowercase set for filtering."""
    url = f"{client.base_url}/slang_terms"
    params = {"select": "term"}
    response = requests.get(url, headers=client.headers, params=params)

    if response.status_code == 200:
        return True, {t['term'].lower() for t in response.json()}
    else:
        return False, f"HTTP {response.status_code}: {response.text}"


def guess_gender_by_ending(noun: str) -> str:
    """
    Guess grammatical gender based on Spanish word endings.
    Returns 'F' for feminine, 'M' for masculine.
    """
    noun_lower = noun.lower()

    # Greek origin -ma words are masculine
    greek_ma_words = {'problema', 'sistema', 'tema', 'clima', 'idioma', 'programa',
                      'telegrama', 'diagrama', 'drama', 'trauma', 'panorama', 'poema'}
    if noun_lower in greek_ma_words:
        return 'M'

    # Feminine endings
    feminine_endings = ('ción', 'sión', 'dad', 'tad', 'tud', 'umbre', 'ie', 'eza')
    if noun_lower.endswith(feminine_endings):
        return 'F'

    # Words ending in -a are usually feminine (except Greek -ma words handled above)
    if noun_lower.endswith('a'):
        # Exception: -ma endings are often masculine (Greek origin)
        if noun_lower.endswith('ma') and len(noun_lower) > 3:
            return 'M'
        return 'F'

    # Masculine endings
    if noun_lower.endswith(('o', 'or', 'aje')):
        return 'M'

    # -ón is masculine (except -ción/-sión already handled)
    if noun_lower.endswith('ón'):
        return 'M'

    # Words ending in consonant are usually masculine (except -d which is often feminine)
    if noun_lower.endswith('d'):
        return 'F'  # -dad, -tad, -tud, etc.

    # Default to masculine for anything unclear
    return 'M'


def determine_genders_heuristic(nouns: List[str]) -> dict:
    """
    Determine gender of nouns using heuristic rules only (no API).
    Returns {noun: 'M' or 'F'}.
    """
    return {noun: guess_gender_by_ending(noun) for noun in nouns}


def format_lemma_text(lemma: str, pos: str, gender: str | None) -> str:
    """
    Format lemma text according to database conventions.
    - NOUN: Add article (el/la) based on gender
    - VERB: Use as-is (infinitive from spaCy)
    - ADJ/ADV: Use as-is (masculine singular from spaCy)
    """
    if pos == 'NOUN' or pos == 'PROPN':
        if gender == 'Fem' or gender == 'F':
            return f"la {lemma}"
        else:
            # Default to masculine if unknown
            return f"el {lemma}"
    else:
        return lemma


def get_songs_with_words(client: SupabaseClient) -> set:
    """Get set of song_ids that already have song_line_words entries."""
    url = f"{client.base_url}/song_line_words"
    params = {"select": "song_id"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return {entry['song_id'] for entry in response.json()}
    return set()


def get_lines_with_words(client: SupabaseClient) -> set:
    """Get set of line_ids that already have song_line_words entries."""
    url = f"{client.base_url}/song_line_words"
    params = {"select": "line_id"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return {entry['line_id'] for entry in response.json()}
    return set()


def process_single_song(
    client: SupabaseClient,
    nlp,
    song_id: str,
    song_title: str,
    song_lines: List[dict],
    existing_lemmas: dict,
    slang_terms: set,
    lines_with_words: set
) -> dict:
    """
    Process a single song: extract tokens, create song_line_words records.
    song_lines is a list of dicts with: line_id, line_text, section_id
    Returns stats dict for this song.
    """
    stats = {
        'title': song_title,
        'lines_processed': 0,
        'lines_skipped': 0,
        'words_created': 0,
        'lemmas_matched': 0,
        'lemmas_created': 0,
        'skipped_slang': 0,
        'error': None
    }

    try:
        word_records = []

        for line_data in song_lines:
            line_id = line_data['line_id']
            line_text = line_data['line_text']
            section_id = line_data['section_id']

            # Skip if line already has words (resume capability)
            if line_id in lines_with_words:
                stats['lines_skipped'] += 1
                continue

            if not line_text or not line_text.strip():
                continue

            # Tokenize with spaCy
            doc = nlp(line_text)

            word_position = 0
            for token in doc:
                # Skip punctuation, digits, spaces, short tokens
                if token.is_punct or token.is_digit or token.is_space:
                    continue
                if len(token.text.strip()) <= 1:
                    continue

                # Only include meaningful POS
                if token.pos_ not in INCLUDE_POS:
                    continue

                word_position += 1
                word_text = token.text
                lemma = token.lemma_.lower()
                pos = token.pos_

                # Skip slang terms
                if lemma in slang_terms or word_text.lower() in slang_terms:
                    stats['skipped_slang'] += 1
                    continue

                # Determine gender for nouns
                gender = None
                if pos in ('NOUN', 'PROPN'):
                    gender_morph = token.morph.get("Gender")
                    if gender_morph:
                        gender = gender_morph[0] if isinstance(gender_morph, list) else gender_morph
                    else:
                        gender = guess_gender_by_ending(lemma)

                # Format lemma text
                formatted_lemma = format_lemma_text(lemma, pos, gender)
                formatted_lower = formatted_lemma.lower()

                # Look up or create lemma
                lemma_id = None
                if formatted_lower in existing_lemmas:
                    lemma_id = existing_lemmas[formatted_lower]
                    stats['lemmas_matched'] += 1
                else:
                    # Create new lemma
                    db_gender = None
                    if pos in ('NOUN', 'PROPN'):
                        db_gender = 'F' if gender in ('Fem', 'F') else 'M'

                    lemma_record = {
                        'lemma_text': formatted_lemma,
                        'language_code': 'es',
                        'definitions': ["(no definition)"],
                        'part_of_speech': pos,
                        'gender': db_gender
                    }

                    success, result = client.insert('lemmas', lemma_record)
                    if success:
                        lemma_id = result[0]['lemma_id']
                        existing_lemmas[formatted_lower] = lemma_id
                        stats['lemmas_created'] += 1
                    elif 'duplicate' in str(result).lower():
                        # Lemma was created by another process, fetch it
                        success2, lemmas = get_existing_lemmas_map(client)
                        if success2 and formatted_lower in lemmas:
                            lemma_id = lemmas[formatted_lower]
                            existing_lemmas[formatted_lower] = lemma_id
                            stats['lemmas_matched'] += 1
                    else:
                        # Skip this word if lemma creation failed
                        continue

                # Build grammatical_info JSONB
                grammatical_info = {
                    'pos': pos,
                    'lemma_raw': token.lemma_,
                }

                # Add morphological features
                if token.morph:
                    morph_dict = token.morph.to_dict()
                    if morph_dict:
                        grammatical_info['morph'] = morph_dict

                if gender:
                    grammatical_info['gender'] = gender

                # Build word record
                word_record = {
                    'word_text': word_text,
                    'lemma_id': lemma_id,
                    'song_id': song_id,
                    'section_id': section_id,
                    'line_id': line_id,
                    'word_position': word_position,
                    'grammatical_info': grammatical_info
                }

                word_records.append(word_record)

            stats['lines_processed'] += 1

        # Batch insert word records for this song
        if word_records:
            # Insert in batches of 100 to avoid payload size issues
            batch_size = 100
            for i in range(0, len(word_records), batch_size):
                batch = word_records[i:i + batch_size]
                success, result = client.insert('song_line_words', batch)
                if success:
                    stats['words_created'] += len(batch)
                else:
                    stats['error'] = f"Failed to insert batch: {result}"
                    break

    except Exception as e:
        stats['error'] = str(e)

    return stats


def extract_lemmas() -> dict:
    """
    Extract lemmas from learnable lines using spaCy.
    Creates song_line_words records with word positions and grammatical info.
    Processes one song at a time with resume capability at line level.
    """
    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 7: WORD EXTRACTION (spaCy)")
    print("=" * 60)
    print()

    # Load spaCy model
    print("Loading spaCy model... ", end='', flush=True)
    nlp = load_spacy_model()
    if not nlp:
        return {'error': 'Failed to load spaCy model'}
    print("OK")

    # Get existing lemmas (shared cache across songs)
    print("Loading existing lemmas... ", end='', flush=True)
    success, existing_lemmas = get_existing_lemmas_map(client)
    if not success:
        print(f"FAILED: {existing_lemmas}")
        return {'error': existing_lemmas}
    print(f"{len(existing_lemmas)} lemmas")

    # Get slang terms to filter out
    print("Loading slang terms... ", end='', flush=True)
    success, slang_terms = get_slang_terms_set(client)
    if not success:
        print(f"FAILED: {slang_terms}")
        return {'error': slang_terms}
    print(f"{len(slang_terms)} terms")

    # Get lines that already have words (for resume capability)
    print("Checking existing word records... ", end='', flush=True)
    lines_with_words = get_lines_with_words(client)
    print(f"{len(lines_with_words)} lines already processed")

    # Get songs that already have words (for skip display)
    completed_songs = get_songs_with_words(client)

    # Get learnable lines grouped by song
    print("Loading learnable lines... ", end='', flush=True)
    success, lines = get_learnable_lines_with_songs(client)
    if not success:
        print(f"FAILED: {lines}")
        return {'error': lines}
    print(f"{len(lines)} lines")
    print()

    # Group lines by song (keeping full line data)
    songs_lines = {}
    for line in lines:
        song_id = line['song_id']
        if song_id not in songs_lines:
            songs_lines[song_id] = {
                'title': line['song_title'],
                'lines': []
            }
        # Keep full line data including line_id and section_id
        songs_lines[song_id]['lines'].append({
            'line_id': line['line_id'],
            'line_text': line['line_text'],
            'section_id': line['section_id']
        })

    # Results tracking
    results = {
        'songs_processed': 0,
        'songs_skipped': 0,
        'words_created': 0,
        'lemmas_matched': 0,
        'lemmas_created': 0,
        'skipped_slang': 0,
        'per_song': [],
        'errors': []
    }

    print("PROCESSING SONGS:")
    print("-" * 60)

    for song_id, song_data in songs_lines.items():
        title = song_data['title']

        # Skip songs that are fully completed
        if song_id in completed_songs:
            # Check if ALL lines for this song have words
            song_line_ids = {l['line_id'] for l in song_data['lines']}
            if song_line_ids.issubset(lines_with_words):
                print(f"  [skip] {title}: already completed")
                results['songs_skipped'] += 1
                continue

        # Process this song
        print(f"  Processing {title}... ", end='', flush=True)

        stats = process_single_song(
            client=client,
            nlp=nlp,
            song_id=song_id,
            song_title=title,
            song_lines=song_data['lines'],
            existing_lemmas=existing_lemmas,
            slang_terms=slang_terms,
            lines_with_words=lines_with_words
        )

        if stats['error']:
            print(f"ERROR: {stats['error']}")
            results['errors'].append(f"{title}: {stats['error']}")
        else:
            skip_msg = f" (skipped {stats['lines_skipped']} lines)" if stats['lines_skipped'] > 0 else ""
            print(f"Created {stats['words_created']} words{skip_msg}")
            results['songs_processed'] += 1
            results['words_created'] += stats['words_created']
            results['lemmas_matched'] += stats['lemmas_matched']
            results['lemmas_created'] += stats['lemmas_created']
            results['skipped_slang'] += stats['skipped_slang']
            results['per_song'].append({
                'title': title,
                'words': stats['words_created'],
                'lines': stats['lines_processed'],
                'lemmas_new': stats['lemmas_created']
            })

            # Update lines_with_words for next song's resume check
            for line_data in song_data['lines']:
                lines_with_words.add(line_data['line_id'])

    print()

    # Print summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Songs processed:    {results['songs_processed']}")
    print(f"  Songs skipped:      {results['songs_skipped']}")
    print(f"  Words created:      {results['words_created']}")
    print(f"  Lemmas matched:     {results['lemmas_matched']}")
    print(f"  Lemmas created:     {results['lemmas_created']}")
    print(f"  Slang skipped:      {results['skipped_slang']}")

    if results['errors']:
        print()
        print(f"  Errors: {len(results['errors'])}")
        for err in results['errors'][:5]:
            print(f"    - {err}")

    return results


# =============================================================================
# PHASE 8: DETECT PHRASE/SLANG OCCURRENCES
# =============================================================================

def normalize_text_for_match(text: str) -> str:
    """Normalize text for matching (lowercase, normalize unicode)."""
    import unicodedata
    text = text.lower().strip()
    text = unicodedata.normalize('NFC', text)
    return text


def normalize_for_search(text: str) -> str:
    """Normalize text for fuzzy matching. Handle apostrophes and punctuation."""
    text = normalize_text_for_match(text)
    text = text.replace("'", "").replace("'", "")
    text = re.sub(r'[¿¡.,!?;:]', '', text)
    return text


def phrase_exists_in_line(line_text: str, phrase_text: str) -> bool:
    """Check if phrase exists in line using word boundary matching."""
    line_lower = normalize_text_for_match(line_text)
    phrase_lower = normalize_text_for_match(phrase_text)

    escaped_phrase = re.escape(phrase_lower)
    escaped_phrase = escaped_phrase.replace(r"\'", r"'?")
    escaped_phrase = escaped_phrase.replace(r"'", r"'?")

    pattern = r'(?:^|[^\w])' + escaped_phrase + r'(?:$|[^\w])'
    return bool(re.search(pattern, line_lower, re.IGNORECASE))


def find_phrase_positions(
    line_text: str,
    phrase_text: str,
    line_words: List[dict]
) -> Tuple[int, int] | None:
    """
    Find word positions for a phrase within a line.
    Returns (start_position, end_position) or None if not found.
    line_words is list of {word_text, word_position}.
    """
    if not line_words:
        return None

    phrase_lower = normalize_for_search(phrase_text)
    phrase_words = phrase_lower.split()
    if not phrase_words:
        return None

    normalized_words = []
    for w in line_words:
        norm = normalize_for_search(w['word_text'])
        normalized_words.append({
            'norm': norm,
            'position': w['word_position']
        })

    # Short single-word terms: exact match only
    if len(phrase_words) == 1:
        target = phrase_words[0]

        if len(target) < 3:
            for w in normalized_words:
                if w['norm'] == target:
                    return (w['position'], w['position'])
            return None

        if not phrase_exists_in_line(line_text, phrase_text):
            return None

        for w in normalized_words:
            if w['norm'] == target:
                return (w['position'], w['position'])
            if target.rstrip("'") == w['norm'] or w['norm'].rstrip("'") == target:
                return (w['position'], w['position'])

        return None

    # Multi-word phrases
    if not phrase_exists_in_line(line_text, phrase_text):
        return None

    for i in range(len(normalized_words)):
        if i + len(phrase_words) > len(normalized_words):
            break

        match = True
        positions = []

        for j, phrase_word in enumerate(phrase_words):
            line_word = normalized_words[i + j]['norm']

            if len(phrase_word) < 3:
                if line_word != phrase_word:
                    match = False
                    break
            else:
                if not (line_word == phrase_word or
                        phrase_word.rstrip("'") == line_word or
                        line_word.rstrip("'") == phrase_word):
                    match = False
                    break

            positions.append(normalized_words[i + j]['position'])

        if match and len(positions) == len(phrase_words):
            return (min(positions), max(positions))

    return None


def get_song_phrases_for_detection(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """Get phrases linked to a song via song_phrases."""
    url = f"{client.base_url}/song_phrases"
    params = {"select": "phrase_id", "song_id": f"eq.{song_id}"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    phrase_ids = [p['phrase_id'] for p in response.json()]
    if not phrase_ids:
        return True, []

    ids_str = ','.join(f'"{pid}"' for pid in phrase_ids)
    url = f"{client.base_url}/phrases"
    params = {"select": "phrase_id,phrase_text", "phrase_id": f"in.({ids_str})"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return True, response.json()
    return False, f"HTTP {response.status_code}: {response.text}"


def get_song_slang_for_detection(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """Get slang terms linked to a song via song_slang."""
    url = f"{client.base_url}/song_slang"
    params = {"select": "slang_id", "song_id": f"eq.{song_id}"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code != 200:
        return False, f"HTTP {response.status_code}: {response.text}"

    slang_ids = [s['slang_id'] for s in response.json()]
    if not slang_ids:
        return True, []

    ids_str = ','.join(f'"{sid}"' for sid in slang_ids)
    url = f"{client.base_url}/slang_terms"
    params = {"select": "slang_id,term", "slang_id": f"in.({ids_str})"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return True, response.json()
    return False, f"HTTP {response.status_code}: {response.text}"


def get_line_words_for_detection(client: SupabaseClient, line_id: str) -> list:
    """Get word records for a line, ordered by position."""
    url = f"{client.base_url}/song_line_words"
    params = {
        "select": "word_text,word_position",
        "line_id": f"eq.{line_id}",
        "order": "word_position"
    }
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return response.json()
    return []


def get_songs_with_occurrences(client: SupabaseClient) -> set:
    """Get song_ids that have occurrence records (for resume)."""
    phrase_songs = set()
    slang_songs = set()

    url = f"{client.base_url}/song_line_phrase_occurrences"
    params = {"select": "song_id"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        phrase_songs = {r['song_id'] for r in response.json()}

    url = f"{client.base_url}/song_line_slang_occurrences"
    params = {"select": "song_id"}
    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        slang_songs = {r['song_id'] for r in response.json()}

    return phrase_songs | slang_songs


def detect_occurrences_for_song(
    client: SupabaseClient,
    song_id: str,
    song_title: str,
    lines: List[dict]
) -> dict:
    """
    Detect phrase and slang occurrences for a single song.
    lines is list of {line_id, line_text, section_id}.
    """
    stats = {
        'title': song_title,
        'phrase_occurrences': 0,
        'slang_occurrences': 0,
        'error': None
    }

    # Get phrases and slang for this song
    success, phrases = get_song_phrases_for_detection(client, song_id)
    if not success:
        stats['error'] = f"Failed to get phrases: {phrases}"
        return stats

    success, slang_terms = get_song_slang_for_detection(client, song_id)
    if not success:
        stats['error'] = f"Failed to get slang: {slang_terms}"
        return stats

    phrase_records = []
    slang_records = []

    for line in lines:
        line_id = line['line_id']
        line_text = line['line_text']
        section_id = line['section_id']

        if not line_text:
            continue

        line_words = get_line_words_for_detection(client, line_id)

        # Check phrases
        for phrase in phrases:
            positions = find_phrase_positions(line_text, phrase['phrase_text'], line_words)
            if positions:
                phrase_records.append({
                    'phrase_id': phrase['phrase_id'],
                    'line_id': line_id,
                    'song_id': song_id,
                    'section_id': section_id,
                    'start_position': positions[0],
                    'end_position': positions[1]
                })

        # Check slang
        for slang in slang_terms:
            positions = find_phrase_positions(line_text, slang['term'], line_words)
            if positions:
                slang_records.append({
                    'slang_id': slang['slang_id'],
                    'line_id': line_id,
                    'song_id': song_id,
                    'section_id': section_id,
                    'start_position': positions[0],
                    'end_position': positions[1]
                })

    # Insert phrase occurrences
    if phrase_records:
        success, result = client.insert('song_line_phrase_occurrences', phrase_records)
        if success:
            stats['phrase_occurrences'] = len(phrase_records)
        else:
            stats['error'] = f"Failed to insert phrase occurrences: {result}"
            return stats

    # Insert slang occurrences
    if slang_records:
        success, result = client.insert('song_line_slang_occurrences', slang_records)
        if success:
            stats['slang_occurrences'] = len(slang_records)
        else:
            stats['error'] = f"Failed to insert slang occurrences: {result}"
            return stats

    return stats


def detect_occurrences() -> dict:
    """
    Detect phrase and slang occurrences in song lines.
    Creates position records in song_line_phrase_occurrences and song_line_slang_occurrences.
    """
    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    print()
    print("=" * 60)
    print("PHASE 8: DETECT PHRASE/SLANG OCCURRENCES")
    print("=" * 60)
    print()

    # Get songs with existing occurrences (for resume)
    print("Checking existing occurrence records... ", end='', flush=True)
    completed_songs = get_songs_with_occurrences(client)
    print(f"{len(completed_songs)} songs already processed")

    # Get all songs
    print("Loading songs... ", end='', flush=True)
    success, songs = client.select('songs', 'song_id,title', order='title')
    if not success:
        print(f"FAILED: {songs}")
        return {'error': songs}
    print(f"{len(songs)} songs")

    # Get learnable lines for all songs
    print("Loading learnable lines... ", end='', flush=True)
    success, all_lines = get_learnable_lines_with_songs(client)
    if not success:
        print(f"FAILED: {all_lines}")
        return {'error': all_lines}
    print(f"{len(all_lines)} lines")
    print()

    # Group lines by song
    songs_lines = {}
    for line in all_lines:
        song_id = line['song_id']
        if song_id not in songs_lines:
            songs_lines[song_id] = []
        songs_lines[song_id].append({
            'line_id': line['line_id'],
            'line_text': line['line_text'],
            'section_id': line['section_id']
        })

    # Results tracking
    results = {
        'songs_processed': 0,
        'songs_skipped': 0,
        'phrase_occurrences': 0,
        'slang_occurrences': 0,
        'errors': []
    }

    print("PROCESSING SONGS:")
    print("-" * 60)

    for song in songs:
        song_id = song['song_id']
        song_title = song['title']

        # Skip if already processed
        if song_id in completed_songs:
            print(f"  [skip] {song_title}: already processed")
            results['songs_skipped'] += 1
            continue

        lines = songs_lines.get(song_id, [])
        if not lines:
            print(f"  [skip] {song_title}: no lines")
            results['songs_skipped'] += 1
            continue

        print(f"  Processing {song_title}... ", end='', flush=True)

        stats = detect_occurrences_for_song(client, song_id, song_title, lines)

        if stats['error']:
            print(f"ERROR: {stats['error']}")
            results['errors'].append(f"{song_title}: {stats['error']}")
        else:
            print(f"{stats['phrase_occurrences']} phrases, {stats['slang_occurrences']} slang")
            results['songs_processed'] += 1
            results['phrase_occurrences'] += stats['phrase_occurrences']
            results['slang_occurrences'] += stats['slang_occurrences']

    print()

    # Print summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Songs processed:      {results['songs_processed']}")
    print(f"  Songs skipped:        {results['songs_skipped']}")
    print(f"  Phrase occurrences:   {results['phrase_occurrences']}")
    print(f"  Slang occurrences:    {results['slang_occurrences']}")

    if results['errors']:
        print()
        print(f"  Errors: {len(results['errors'])}")
        for err in results['errors'][:5]:
            print(f"    - {err}")

    return results


# =============================================================================
# PHASE 9: FIX TRANSLATIONS
# =============================================================================

def fix_translations() -> dict:
    """
    Use Claude AI to fix translation errors caused by:
    - Idiomatic phrases translated literally
    - Puerto Rican slang not recognized
    - Phonetic contractions misunderstood

    Processes songs one at a time with incremental saves.
    """
    print()
    print("=" * 60)
    print("PHASE 9: FIX TRANSLATIONS (Claude AI)")
    print("=" * 60)
    print()

    results = {
        'songs_processed': 0,
        'songs_skipped': 0,
        'total_fixes': 0,
        'total_unchanged': 0,
        'all_fixes': [],
        'errors': []
    }

    if not ANTHROPIC_API_KEY:
        results['error'] = "ANTHROPIC_API_KEY not found in environment"
        print(f"ERROR: {results['error']}")
        return results

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    # Step 1: Load slang terms reference
    print("Loading reference data...")
    success, slang_data = client.select('slang_terms', 'term,definition,standard_equivalent')
    if not success:
        results['error'] = f"Failed to load slang_terms: {slang_data}"
        return results

    slang_reference = []
    for s in slang_data:
        equiv = f" (standard: {s['standard_equivalent']})" if s.get('standard_equivalent') else ""
        slang_reference.append(f"  {s['term']}: {s['definition']}{equiv}")
    print(f"  Loaded {len(slang_data)} slang terms")

    # Step 2: Load phrases linked to songs
    success, phrase_data = client.select(
        'phrases',
        'phrase_text,definitions'
    )
    if not success:
        results['error'] = f"Failed to load phrases: {phrase_data}"
        return results

    phrase_reference = []
    for p in phrase_data:
        defs = p.get('definitions', [])
        if defs:
            phrase_reference.append(f"  {p['phrase_text']}: {defs[0]}")
    print(f"  Loaded {len(phrase_data)} phrases")

    # Step 3: Get all songs
    success, songs = client.select('songs', 'song_id,title')
    if not success:
        results['error'] = f"Failed to load songs: {songs}"
        return results
    print(f"  Found {len(songs)} songs")
    print()

    # Build slang and phrase reference strings (truncate if too long)
    slang_ref_str = "\n".join(slang_reference[:150])  # Limit to prevent token overflow
    phrase_ref_str = "\n".join(phrase_reference[:50])

    print("PROCESSING SONGS (one at a time):")
    print("-" * 40)

    for song in songs:
        song_id = song['song_id']
        song_title = song['title']

        try:
            # Get learnable lines for this song
            url = f"{client.base_url}/song_lines"
            params = {
                "select": "line_id,line_order,line_text,translation,section_id",
                "is_skippable": "eq.false"
            }
            # Need to filter by song through sections
            response = requests.get(url, headers=client.headers, params=params)

            if response.status_code != 200:
                print(f"  → {song_title}... ✗ Error: Failed to load lines")
                results['errors'].append({'song': song_title, 'error': 'Failed to load lines'})
                continue

            all_lines = response.json()

            # Get sections for this song to filter lines
            success, sections = client.select('song_sections', 'section_id', {'song_id': song_id})
            if not success:
                print(f"  → {song_title}... ✗ Error: Failed to load sections")
                results['errors'].append({'song': song_title, 'error': 'Failed to load sections'})
                continue

            section_ids = {s['section_id'] for s in sections}
            song_lines = [l for l in all_lines if l['section_id'] in section_ids]

            if not song_lines:
                print(f"  ⊘ {song_title}: skipped (no learnable lines)")
                results['songs_skipped'] += 1
                continue

            # Sort by line_order
            song_lines.sort(key=lambda x: x['line_order'])

            # Build lyrics for prompt
            lyrics_for_prompt = []
            for line in song_lines:
                lyrics_for_prompt.append({
                    'line_order': line['line_order'],
                    'spanish': line['line_text'],
                    'english': line['translation'] or '(no translation)'
                })

            # Build Claude prompt
            prompt = f"""Review these Spanish lyrics and their English translations. Fix any translations that are wrong due to:
1. Idiomatic phrases translated literally
2. Puerto Rican slang not recognized
3. Phonetic contractions misunderstood (e.g., pa' = para, 'ta = está)

SLANG REFERENCE (Puerto Rican Spanish):
{slang_ref_str}

PHRASE REFERENCE:
{phrase_ref_str}

LYRICS TO REVIEW:
{json.dumps(lyrics_for_prompt, ensure_ascii=False, indent=2)}

For each line that needs fixing, respond with JSON:
{{
  "fixes": [
    {{
      "line_order": 5,
      "original_translation": "the current wrong translation",
      "corrected_translation": "the improved translation",
      "reason": "brief explanation of what was wrong"
    }}
  ]
}}

Only include lines that NEED fixes. If translation is correct, don't include it.
If no fixes needed, return {{"fixes": []}}
"""

            # Call Claude API with 60-second timeout
            success, response_data = call_claude_api(prompt, timeout=60)

            if not success:
                print(f"  → {song_title}... ✗ Error: {str(response_data)[:50]}")
                results['errors'].append({'song': song_title, 'error': str(response_data)[:100]})
                time.sleep(2)  # Still wait before next call
                continue

            # Parse fixes from response
            fixes = response_data.get('fixes', [])

            if not fixes:
                print(f"  ✓ {song_title}: 0 fixes needed")
                results['total_unchanged'] += len(song_lines)
                results['songs_processed'] += 1
                time.sleep(2)
                continue

            # Apply fixes to database
            fixes_applied = 0
            for fix in fixes:
                line_order = fix.get('line_order')
                new_translation = fix.get('corrected_translation')

                if not line_order or not new_translation:
                    continue

                # Find the line_id for this line_order
                matching_line = next((l for l in song_lines if l['line_order'] == line_order), None)
                if not matching_line:
                    continue

                # Update the translation
                update_success, msg = client.update(
                    'song_lines',
                    {'translation': new_translation},
                    {'line_id': matching_line['line_id']}
                )

                if update_success:
                    fixes_applied += 1
                    results['all_fixes'].append({
                        'song': song_title,
                        'line_order': line_order,
                        'spanish': matching_line['line_text'],
                        'original': fix.get('original_translation'),
                        'corrected': new_translation,
                        'reason': fix.get('reason')
                    })

            print(f"  ✓ {song_title}: {fixes_applied} lines fixed")
            results['total_fixes'] += fixes_applied
            results['total_unchanged'] += len(song_lines) - fixes_applied
            results['songs_processed'] += 1

            # 2-second delay between API calls
            time.sleep(2)

        except requests.exceptions.Timeout:
            print(f"  → {song_title}... ✗ Timeout (60s)")
            results['errors'].append({'song': song_title, 'error': 'API timeout'})
            time.sleep(2)
        except Exception as e:
            print(f"  → {song_title}... ✗ Error: {str(e)[:50]}")
            results['errors'].append({'song': song_title, 'error': str(e)[:100]})
            time.sleep(2)

    # Save fix log to file
    with open(TRANSLATION_FIXES_FILE, 'w', encoding='utf-8') as f:
        json.dump(results['all_fixes'], f, ensure_ascii=False, indent=2)

    print()
    print(f"Fix log saved to: {TRANSLATION_FIXES_FILE}")

    return results


def main():
    parser = argparse.ArgumentParser(description='Parse and import lyrics')
    parser.add_argument('--output', '-o', help='Output JSON file path')
    parser.add_argument('--write', '-w', action='store_true', help='Write to database')
    parser.add_argument('--translate', '-t', action='store_true', help='Translate untranslated lines via DeepL')
    parser.add_argument('--flag-skippable', '-f', action='store_true', help='Flag vocalization lines as skippable')
    parser.add_argument('--analyze', '-a', action='store_true', help='Analyze slang & phrases with Claude (preview only)')
    parser.add_argument('--insert-vocab', action='store_true', help='Insert cleaned vocabulary to database')
    parser.add_argument('--extract-lemmas', action='store_true', help='Extract words with spaCy')
    parser.add_argument('--detect-occurrences', action='store_true', help='Detect phrase/slang occurrences')
    parser.add_argument('--fix-translations', action='store_true', help='Fix translations with Claude AI')
    args = parser.parse_args()

    # Phase 9: Fix translations (skip parsing)
    if args.fix_translations:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        if not ANTHROPIC_API_KEY:
            print("ERROR: ANTHROPIC_API_KEY not found.")
            return

        results = fix_translations()

        print()
        print("=" * 60)
        print("PHASE 9 SUMMARY: FIX TRANSLATIONS")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Songs processed:    {results['songs_processed']}/17")
            if results.get('songs_skipped'):
                print(f"  Songs skipped:      {results['songs_skipped']}")
            print(f"  Total lines fixed:  {results['total_fixes']}")
            print(f"  Lines unchanged:    {results['total_unchanged']}")

            if results.get('errors'):
                print()
                print(f"  Errors: {len(results['errors'])}")
                for err in results['errors'][:5]:
                    print(f"    - {err['song']}: {err['error'][:40]}...")

        return results

    # Phase 8: Detect occurrences (skip parsing)
    if args.detect_occurrences:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        results = detect_occurrences()

        print()
        print("=" * 60)
        print("PHASE 8 SUMMARY: DETECT OCCURRENCES")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Songs processed:      {results['songs_processed']}")
            if results.get('songs_skipped'):
                print(f"  Songs skipped:        {results['songs_skipped']}")
            print(f"  Phrase occurrences:   {results['phrase_occurrences']}")
            print(f"  Slang occurrences:    {results['slang_occurrences']}")

            if results.get('errors'):
                print()
                print(f"  Errors: {len(results['errors'])}")
                for err in results['errors'][:5]:
                    print(f"    - {err[:60]}...")

        return results

    # Phase 7: Extract words (skip parsing)
    if args.extract_lemmas:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        results = extract_lemmas()

        print()
        print("=" * 60)
        print("PHASE 7 SUMMARY: WORD EXTRACTION")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Songs processed:      {results['songs_processed']}")
            if results.get('songs_skipped'):
                print(f"  Songs skipped:        {results['songs_skipped']} (already completed)")
            print(f"  Words created:        {results['words_created']}")
            print(f"  Lemmas matched:       {results['lemmas_matched']}")
            print(f"  Lemmas created:       {results['lemmas_created']}")
            print(f"  Skipped (slang):      {results['skipped_slang']}")

            if results.get('errors'):
                print()
                print(f"  Errors: {len(results['errors'])}")
                for err in results['errors'][:5]:
                    print(f"    - {err[:60]}...")

        return results

    # Phase 6: Insert vocabulary (skip parsing)
    if args.insert_vocab:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        results = insert_vocabulary()

        print()
        print("=" * 60)
        print("PHASE 6 SUMMARY: VOCABULARY INSERT")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Slang created:        {results['slang_created']}")
            print(f"  Slang linked (exist): {results['slang_linked_existing']}")
            print(f"  Phrases created:      {results['phrases_created']}")
            print(f"  Phrases linked:       {results['phrases_linked_existing']}")
            print(f"  Skipped (flagged):    {results['skipped_flagged']}")

            if results['errors']:
                print()
                print(f"  Errors: {len(results['errors'])}")
                for err in results['errors'][:5]:
                    print(f"    - {err[:60]}...")

        return results

    # Phase 5: Analyze vocabulary (skip parsing)
    if args.analyze:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        results = analyze_vocabulary()

        print()
        print("=" * 60)
        print("PHASE 5 SUMMARY: VOCABULARY ANALYSIS")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Songs analyzed:         {results['songs_analyzed']}")
            print(f"  Existing slang matched: {len(results['existing_slang_matched'])}")
            print(f"  New slang to create:    {len(results['new_slang_to_create'])}")
            print(f"  Existing phrases:       {len(results['existing_phrases_matched'])}")
            print(f"  New phrases to create:  {len(results['new_phrases_to_create'])}")

            if results['errors']:
                print()
                print(f"  Errors: {len(results['errors'])}")
                for err in results['errors']:
                    print(f"    - {err['song']}: {err['error'][:50]}...")

            print()
            print(f"  Results saved to: {VOCABULARY_ANALYSIS_FILE}")
            print("  Review the file before importing vocabulary.")

        return results

    # Phase 4: Flag skippable lines (skip parsing)
    if args.flag_skippable:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found.")
            return

        results = flag_skippable_lines()

        print()
        print("=" * 60)
        print("PHASE 4 SUMMARY: FLAG SKIPPABLE")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Lines flagged:    {results['flagged']}")
            print(f"  Newly flagged:    {results.get('newly_flagged', 0)}")
            print(f"  Lines learnable:  {results['learnable']}")

            if results.get('errors'):
                print()
                print(f"  Errors: {len(results['errors'])}")

        return results

    # Phase 3: Translation only (skip parsing)
    if args.translate:
        print("=" * 60)
        print("LYRICS IMPORT SCRIPT")
        print("=" * 60)

        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found. Cannot translate.")
            return

        results = translate_lines()

        print()
        print("=" * 60)
        print("PHASE 3 SUMMARY: TRANSLATION")
        print("=" * 60)

        if 'error' in results:
            print(f"  Error: {results['error']}")
        else:
            print(f"  Lines translated: {results['translated']}/922")
            print(f"  Batches:          {results['batches']}")
            print(f"  Errors:           {results['errors']}")
            print(f"  Characters used:  {results['characters']:,}")

            if results.get('failed_lines'):
                print()
                print(f"  Failed line IDs: {results['failed_lines'][:10]}...")

        return results

    print("=" * 60)
    print("LYRICS IMPORT SCRIPT")
    print("=" * 60)
    print()

    # Load song mappings
    print(f"Loading song mappings from: {SONG_MAPPINGS_FILE}")
    mappings = load_song_mappings()
    print(f"  Found {len(mappings)} songs in database")
    print()

    # Parse album file
    print(f"Parsing album file: {ALBUM_FILE}")
    parsed_songs = parse_album_file(ALBUM_FILE)
    print(f"  Found {len(parsed_songs)} songs in file")
    print()

    # Match to database
    print("Matching songs to database...")
    matched, unmatched = match_songs_to_database(parsed_songs, mappings)
    print(f"  Matched: {len(matched)}/{len(parsed_songs)}")
    if unmatched:
        print(f"  Unmatched: {unmatched}")
    print()

    # Build output
    output = {
        'songs': matched,
        'summary': {
            'songs_matched': len(matched),
            'songs_unmatched': len(unmatched),
            'unmatched_titles': unmatched,
            'total_sections': sum(s['total_sections'] for s in matched),
            'total_lines': sum(s['total_lines'] for s in matched)
        }
    }

    # Print summary
    print("=" * 60)
    print("PHASE 1 SUMMARY: PARSING")
    print("=" * 60)
    print(f"  Songs matched:    {output['summary']['songs_matched']}/17")
    if unmatched:
        print(f"  Songs unmatched:  {unmatched}")
    print(f"  Total sections:   {output['summary']['total_sections']}")
    print(f"  Total lines:      {output['summary']['total_lines']}")
    print()

    # Per-song breakdown
    print("PER-SONG BREAKDOWN:")
    print("-" * 60)
    for song in matched:
        print(f"  {song['title'][:30]:<30} {song['total_sections']:>3} sections, {song['total_lines']:>3} lines")
    print()

    # Save parsed output
    if args.output:
        output_path = Path(args.output)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print(f"Parsed output saved to: {output_path}")
        print()

    # Phase 2: Write to database
    if args.write:
        if not SUPABASE_URL or not SUPABASE_KEY:
            print("ERROR: Supabase credentials not found. Cannot write to database.")
            return

        if unmatched:
            print(f"WARNING: {len(unmatched)} songs unmatched. They will be skipped.")
            print()

        results = write_to_database(matched)

        print()
        print("=" * 60)
        print("PHASE 2 SUMMARY: DATABASE IMPORT")
        print("=" * 60)
        print(f"  Songs imported:   {len(results['success'])}/17")
        print(f"  Songs failed:     {len(results['failed'])}")
        print(f"  Total sections:   {results['total_sections']}")
        print(f"  Total lines:      {results['total_lines']}")

        if results['failed']:
            print()
            print("FAILURES:")
            for failure in results['failed']:
                print(f"  - {failure['title']}: {failure['error']}")
    else:
        print("=" * 60)
        print("PHASE 1 COMPLETE - Preview only")
        print("Run with --write flag to import to database")
        print("=" * 60)

    return output


if __name__ == '__main__':
    main()
