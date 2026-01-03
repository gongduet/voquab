#!/usr/bin/env python3
"""
Backfill Phrase and Slang Occurrences

Detects phrase and slang positions within song lines and populates
song_line_phrase_occurrences and song_line_slang_occurrences tables.

Usage:
    python3 scripts/backfill_phrase_slang_occurrences.py
"""

import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
import requests


def load_env_file(env_path: Path) -> None:
    """Load environment variables from .env file."""
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
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            os.environ.setdefault(key, value)


# Load environment variables
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
load_env_file(PROJECT_ROOT / '.env')

# Supabase config
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')


class SupabaseClient:
    """Simple Supabase REST API client."""

    def __init__(self, url: str, key: str):
        self.base_url = f"{url}/rest/v1"
        self.headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }

    def insert(self, table: str, data: dict | list) -> Tuple[bool, dict | list | str]:
        """Insert row(s) into table."""
        url = f"{self.base_url}/{table}"
        response = requests.post(url, headers=self.headers, json=data)

        if response.status_code in (200, 201):
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    def select(self, table: str, columns: str = "*", filters: dict = None,
               order: str = None) -> Tuple[bool, list | str]:
        """Select rows from table."""
        url = f"{self.base_url}/{table}"
        params = {"select": columns}

        if filters:
            for k, v in filters.items():
                params[k] = f"eq.{v}"

        if order:
            params["order"] = order

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"

    def select_in(self, table: str, columns: str, field: str,
                  values: List[str]) -> Tuple[bool, list | str]:
        """Select rows where field is in values list."""
        if not values:
            return True, []

        url = f"{self.base_url}/{table}"
        values_str = ','.join(f'"{v}"' for v in values)
        params = {
            "select": columns,
            field: f"in.({values_str})"
        }

        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"


def normalize_text(text: str) -> str:
    """Normalize text for matching (lowercase, normalize unicode)."""
    text = text.lower().strip()
    # Normalize unicode characters
    text = unicodedata.normalize('NFC', text)
    return text


def normalize_for_search(text: str) -> str:
    """
    Normalize text for fuzzy matching.
    Handle apostrophes and special characters in slang.
    """
    text = normalize_text(text)
    # Remove apostrophes for matching (pa' -> pa)
    text = text.replace("'", "").replace("'", "")
    # Remove common punctuation
    text = re.sub(r'[¿¡.,!?;:]', '', text)
    return text


def phrase_exists_in_line(line_text: str, phrase_text: str) -> bool:
    """
    Check if phrase exists in line using word boundary matching.
    Handles apostrophes and contractions.
    """
    line_lower = normalize_text(line_text)
    phrase_lower = normalize_text(phrase_text)

    # Build regex pattern with word boundaries
    # Escape special regex characters in phrase
    escaped_phrase = re.escape(phrase_lower)

    # Replace escaped apostrophes with optional apostrophe pattern
    # This handles pa' matching pa or pa'
    escaped_phrase = escaped_phrase.replace(r"\'", r"'?")
    escaped_phrase = escaped_phrase.replace(r"'", r"'?")

    # Use word boundaries - \b doesn't work well with apostrophes,
    # so we use a custom pattern
    # Match: start of string or non-word char, then phrase, then end or non-word char
    pattern = r'(?:^|[^\w])' + escaped_phrase + r'(?:$|[^\w])'

    return bool(re.search(pattern, line_lower, re.IGNORECASE))


def find_phrase_positions(
    line_text: str,
    phrase_text: str,
    line_words: List[dict]
) -> Optional[Tuple[int, int]]:
    """
    Find word positions for a phrase within a line.

    Args:
        line_text: The full line text
        phrase_text: The phrase to find
        line_words: List of {word_text, word_position} ordered by position

    Returns:
        (start_position, end_position) or None if not found
    """
    if not line_words:
        return None

    # Normalize phrase for matching
    phrase_lower = normalize_for_search(phrase_text)
    phrase_words = phrase_lower.split()
    if not phrase_words:
        return None

    # Build normalized word list from line_words
    normalized_words = []
    for w in line_words:
        norm = normalize_for_search(w['word_text'])
        normalized_words.append({
            'norm': norm,
            'original': w['word_text'].lower(),
            'position': w['word_position']
        })

    # For short single-word terms (< 3 chars), require EXACT match
    # from the tokenized words to avoid false positives
    if len(phrase_words) == 1:
        target = phrase_words[0]

        # Short terms: exact match only
        if len(target) < 3:
            for w in normalized_words:
                if w['norm'] == target:
                    return (w['position'], w['position'])
            return None

        # Longer single words: check with word boundaries first
        if not phrase_exists_in_line(line_text, phrase_text):
            return None

        # Find the matching word in our tokenized list
        for w in normalized_words:
            # Exact match
            if w['norm'] == target:
                return (w['position'], w['position'])
            # Handle contractions: pa' matches pa, to' matches to
            if target.rstrip("'") == w['norm'] or w['norm'].rstrip("'") == target:
                return (w['position'], w['position'])

        return None

    # For multi-word phrases, first check if it exists with word boundaries
    if not phrase_exists_in_line(line_text, phrase_text):
        return None

    # Try to find the phrase words in sequence
    for i in range(len(normalized_words)):
        if i + len(phrase_words) > len(normalized_words):
            break

        match = True
        positions = []

        for j, phrase_word in enumerate(phrase_words):
            line_word = normalized_words[i + j]['norm']

            # For short phrase words, require exact match
            if len(phrase_word) < 3:
                if line_word != phrase_word:
                    match = False
                    break
            else:
                # Allow contraction matching for longer words
                if not (line_word == phrase_word or
                        phrase_word.rstrip("'") == line_word or
                        line_word.rstrip("'") == phrase_word):
                    match = False
                    break

            positions.append(normalized_words[i + j]['position'])

        if match and len(positions) == len(phrase_words):
            return (min(positions), max(positions))

    return None


def get_all_songs(client: SupabaseClient) -> Tuple[bool, list | str]:
    """Get all songs."""
    return client.select('songs', 'song_id,title', order='title')


def get_song_phrases(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """Get all phrases linked to a song via song_phrases."""
    success, links = client.select('song_phrases', 'phrase_id', {'song_id': song_id})
    if not success or not links:
        return success, links if not success else []

    phrase_ids = [l['phrase_id'] for l in links]
    return client.select_in('phrases', 'phrase_id,phrase_text', 'phrase_id', phrase_ids)


def get_song_slang(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """Get all slang terms linked to a song via song_slang."""
    success, links = client.select('song_slang', 'slang_id', {'song_id': song_id})
    if not success or not links:
        return success, links if not success else []

    slang_ids = [l['slang_id'] for l in links]
    return client.select_in('slang_terms', 'slang_id,term', 'slang_id', slang_ids)


def get_song_lines(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """Get all lines for a song via sections."""
    # Get sections
    success, sections = client.select('song_sections', 'section_id', {'song_id': song_id})
    if not success:
        return False, sections

    if not sections:
        return True, []

    section_ids = [s['section_id'] for s in sections]

    # Get lines for these sections
    url = f"{client.base_url}/song_lines"
    section_list = ','.join(f'"{sid}"' for sid in section_ids)
    params = {
        "select": "line_id,line_text,section_id,line_order",
        "section_id": f"in.({section_list})",
        "is_skippable": "eq.false",
        "order": "line_order"
    }

    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return True, response.json()
    return False, f"HTTP {response.status_code}: {response.text}"


def get_line_words(client: SupabaseClient, line_id: str) -> Tuple[bool, list | str]:
    """Get word records for a line, ordered by position."""
    url = f"{client.base_url}/song_line_words"
    params = {
        "select": "word_text,word_position",
        "line_id": f"eq.{line_id}",
        "order": "word_position"
    }

    response = requests.get(url, headers=client.headers, params=params)
    if response.status_code == 200:
        return True, response.json()
    return False, f"HTTP {response.status_code}: {response.text}"


def get_existing_phrase_occurrences(client: SupabaseClient, song_id: str) -> Set[Tuple[str, str]]:
    """Get existing phrase occurrences for a song as set of (phrase_id, line_id)."""
    success, data = client.select(
        'song_line_phrase_occurrences',
        'phrase_id,line_id',
        {'song_id': song_id}
    )
    if success:
        return {(o['phrase_id'], o['line_id']) for o in data}
    return set()


def get_existing_slang_occurrences(client: SupabaseClient, song_id: str) -> Set[Tuple[str, str]]:
    """Get existing slang occurrences for a song as set of (slang_id, line_id)."""
    success, data = client.select(
        'song_line_slang_occurrences',
        'slang_id,line_id',
        {'song_id': song_id}
    )
    if success:
        return {(o['slang_id'], o['line_id']) for o in data}
    return set()


def process_song(
    client: SupabaseClient,
    song_id: str,
    song_title: str
) -> dict:
    """Process a single song for phrase and slang occurrences."""
    stats = {
        'title': song_title,
        'phrase_occurrences': 0,
        'slang_occurrences': 0,
        'phrases_not_found': [],
        'slang_not_found': [],
        'errors': []
    }

    # Get phrases linked to this song
    success, phrases = get_song_phrases(client, song_id)
    if not success:
        stats['errors'].append(f"Failed to get phrases: {phrases}")
        return stats

    # Get slang linked to this song
    success, slang_terms = get_song_slang(client, song_id)
    if not success:
        stats['errors'].append(f"Failed to get slang: {slang_terms}")
        return stats

    # Get lines for this song
    success, lines = get_song_lines(client, song_id)
    if not success:
        stats['errors'].append(f"Failed to get lines: {lines}")
        return stats

    if not lines:
        return stats

    # Get existing occurrences (for resume capability)
    existing_phrase_occs = get_existing_phrase_occurrences(client, song_id)
    existing_slang_occs = get_existing_slang_occurrences(client, song_id)

    # Track which phrases/slang were found in any line
    phrases_found = set()
    slang_found = set()

    # Collect occurrence records
    phrase_occurrence_records = []
    slang_occurrence_records = []

    for line in lines:
        line_id = line['line_id']
        line_text = line['line_text']
        section_id = line['section_id']

        if not line_text:
            continue

        # Get word records for this line
        success, line_words = get_line_words(client, line_id)
        if not success:
            stats['errors'].append(f"Failed to get words for line: {line_words}")
            continue

        # Check each phrase
        for phrase in phrases:
            phrase_id = phrase['phrase_id']
            phrase_text = phrase['phrase_text']

            # Skip if already exists
            if (phrase_id, line_id) in existing_phrase_occs:
                phrases_found.add(phrase_id)
                continue

            positions = find_phrase_positions(line_text, phrase_text, line_words)
            if positions:
                start_pos, end_pos = positions
                phrase_occurrence_records.append({
                    'phrase_id': phrase_id,
                    'line_id': line_id,
                    'song_id': song_id,
                    'section_id': section_id,
                    'start_position': start_pos,
                    'end_position': end_pos
                })
                phrases_found.add(phrase_id)

        # Check each slang term
        for slang in slang_terms:
            slang_id = slang['slang_id']
            term = slang['term']

            # Skip if already exists
            if (slang_id, line_id) in existing_slang_occs:
                slang_found.add(slang_id)
                continue

            positions = find_phrase_positions(line_text, term, line_words)
            if positions:
                start_pos, end_pos = positions
                slang_occurrence_records.append({
                    'slang_id': slang_id,
                    'line_id': line_id,
                    'song_id': song_id,
                    'section_id': section_id,
                    'start_position': start_pos,
                    'end_position': end_pos
                })
                slang_found.add(slang_id)

    # Insert phrase occurrences
    if phrase_occurrence_records:
        success, result = client.insert('song_line_phrase_occurrences', phrase_occurrence_records)
        if success:
            stats['phrase_occurrences'] = len(phrase_occurrence_records)
        else:
            stats['errors'].append(f"Failed to insert phrase occurrences: {result}")

    # Insert slang occurrences
    if slang_occurrence_records:
        success, result = client.insert('song_line_slang_occurrences', slang_occurrence_records)
        if success:
            stats['slang_occurrences'] = len(slang_occurrence_records)
        else:
            stats['errors'].append(f"Failed to insert slang occurrences: {result}")

    # Track phrases/slang not found in any line
    for phrase in phrases:
        if phrase['phrase_id'] not in phrases_found:
            stats['phrases_not_found'].append(phrase['phrase_text'])

    for slang in slang_terms:
        if slang['slang_id'] not in slang_found:
            stats['slang_not_found'].append(slang['term'])

    return stats


def main():
    print()
    print("=" * 60)
    print("BACKFILL PHRASE AND SLANG OCCURRENCES")
    print("=" * 60)
    print()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not found in environment.")
        return

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    # Get all songs
    print("Loading songs... ", end='', flush=True)
    success, songs = get_all_songs(client)
    if not success:
        print(f"FAILED: {songs}")
        return
    print(f"{len(songs)} songs")
    print()

    # Results tracking
    total_stats = {
        'songs_processed': 0,
        'total_phrase_occurrences': 0,
        'total_slang_occurrences': 0,
        'all_phrases_not_found': [],
        'all_slang_not_found': [],
        'errors': []
    }

    print("PROCESSING SONGS:")
    print("-" * 60)

    for i, song in enumerate(songs, 1):
        song_id = song['song_id']
        song_title = song['title']

        print(f"Processing song {i} of {len(songs)}: {song_title}... ", end='', flush=True)

        stats = process_song(client, song_id, song_title)

        if stats['errors']:
            print(f"ERRORS: {len(stats['errors'])}")
            total_stats['errors'].extend(stats['errors'])
        else:
            print(f"{stats['phrase_occurrences']} phrases, {stats['slang_occurrences']} slang")

        total_stats['songs_processed'] += 1
        total_stats['total_phrase_occurrences'] += stats['phrase_occurrences']
        total_stats['total_slang_occurrences'] += stats['slang_occurrences']

        if stats['phrases_not_found']:
            for p in stats['phrases_not_found']:
                if p not in total_stats['all_phrases_not_found']:
                    total_stats['all_phrases_not_found'].append(p)

        if stats['slang_not_found']:
            for s in stats['slang_not_found']:
                if s not in total_stats['all_slang_not_found']:
                    total_stats['all_slang_not_found'].append(s)

    # Print summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Songs processed:        {total_stats['songs_processed']}")
    print(f"  Phrase occurrences:     {total_stats['total_phrase_occurrences']}")
    print(f"  Slang occurrences:      {total_stats['total_slang_occurrences']}")

    if total_stats['all_phrases_not_found']:
        print()
        print(f"  Phrases not found ({len(total_stats['all_phrases_not_found'])}):")
        for p in total_stats['all_phrases_not_found'][:10]:
            print(f"    - {p}")
        if len(total_stats['all_phrases_not_found']) > 10:
            print(f"    ... and {len(total_stats['all_phrases_not_found']) - 10} more")

    if total_stats['all_slang_not_found']:
        print()
        print(f"  Slang not found ({len(total_stats['all_slang_not_found'])}):")
        for s in total_stats['all_slang_not_found'][:10]:
            print(f"    - {s}")
        if len(total_stats['all_slang_not_found']) > 10:
            print(f"    ... and {len(total_stats['all_slang_not_found']) - 10} more")

    if total_stats['errors']:
        print()
        print(f"  Errors: {len(total_stats['errors'])}")
        for err in total_stats['errors'][:5]:
            print(f"    - {err[:80]}...")

    print()
    print("Verification queries:")
    print("  SELECT COUNT(*) FROM song_line_phrase_occurrences;")
    print("  SELECT COUNT(*) FROM song_line_slang_occurrences;")


if __name__ == '__main__':
    main()
