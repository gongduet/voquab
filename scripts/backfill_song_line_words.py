#!/usr/bin/env python3
"""
Backfill Song Line Words

Tokenizes all existing song_lines and creates song_line_words records.
Uses spaCy for tokenization and lemmatization, matching existing lemmas
or creating new ones as needed.

Usage:
    python3 scripts/backfill_song_line_words.py
"""

import json
import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple
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

# POS tags that we DON'T create new lemmas for (stop words, function words)
# These will be included but with lemma_id = NULL if no existing match
FUNCTION_POS = {'DET', 'ADP', 'CCONJ', 'SCONJ', 'PRON', 'AUX', 'PART', 'INTJ', 'X'}


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

    def select(self, table: str, columns: str = "*", filters: dict = None,
               order: str = None) -> Tuple[bool, list | str]:
        """Select rows from table. Returns (success, data_or_error)."""
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

    def select_raw(self, table: str, params: dict) -> Tuple[bool, list | str]:
        """Select with raw params. Returns (success, data_or_error)."""
        url = f"{self.base_url}/{table}"
        response = requests.get(url, headers=self.headers, params=params)

        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}: {response.text}"


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
        if noun_lower.endswith('ma') and len(noun_lower) > 3:
            return 'M'
        return 'F'

    # Masculine endings
    if noun_lower.endswith(('o', 'or', 'aje')):
        return 'M'

    if noun_lower.endswith('ón'):
        return 'M'

    if noun_lower.endswith('d'):
        return 'F'

    return 'M'


def format_lemma_text(lemma: str, pos: str, gender: str | None) -> str:
    """
    Format lemma text according to database conventions.
    - NOUN: Add article (el/la) based on gender
    - VERB: Use as-is (infinitive from spaCy)
    - ADJ/ADV: Use as-is
    """
    if pos == 'NOUN' or pos == 'PROPN':
        if gender == 'Fem' or gender == 'F':
            return f"la {lemma}"
        else:
            return f"el {lemma}"
    else:
        return lemma


def get_existing_lemmas_map(client: SupabaseClient) -> Tuple[bool, dict | str]:
    """Get all existing lemmas as a map {lemma_text_lower: lemma_id}."""
    success, data = client.select('lemmas', 'lemma_id,lemma_text')
    if success:
        return True, {l['lemma_text'].lower(): l['lemma_id'] for l in data}
    return False, data


def get_slang_terms_set(client: SupabaseClient) -> Tuple[bool, set | str]:
    """Get all slang terms as lowercase set for filtering."""
    success, data = client.select('slang_terms', 'term')
    if success:
        return True, {t['term'].lower() for t in data}
    return False, data


def get_lines_with_existing_words(client: SupabaseClient) -> Tuple[bool, set | str]:
    """Get set of line_ids that already have song_line_words entries."""
    success, data = client.select('song_line_words', 'line_id')
    if success:
        return True, {w['line_id'] for w in data}
    return False, data


def get_all_songs(client: SupabaseClient) -> Tuple[bool, list | str]:
    """Get all songs with their IDs and titles."""
    return client.select('songs', 'song_id,title', order='title')


def get_song_lines(client: SupabaseClient, song_id: str) -> Tuple[bool, list | str]:
    """
    Get all song_lines for a given song, including section_id.
    Returns lines with: line_id, line_text, section_id, line_order
    """
    # First get sections for this song
    success, sections = client.select('song_sections', 'section_id', {'song_id': song_id})
    if not success:
        return False, sections

    section_ids = [s['section_id'] for s in sections]
    if not section_ids:
        return True, []

    # Get lines for these sections
    # Need to use IN query - build it manually
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


def process_song(
    client: SupabaseClient,
    nlp,
    song_id: str,
    song_title: str,
    existing_lemmas: Dict[str, str],
    slang_terms: Set[str],
    lines_with_words: Set[str]
) -> dict:
    """
    Process all lines for a single song, creating song_line_words records.
    Returns stats dict.
    """
    stats = {
        'title': song_title,
        'lines_processed': 0,
        'lines_skipped': 0,
        'words_created': 0,
        'lemmas_matched': 0,
        'lemmas_created': 0,
        'errors': []
    }

    # Get lines for this song
    success, lines = get_song_lines(client, song_id)
    if not success:
        stats['errors'].append(f"Failed to get lines: {lines}")
        return stats

    if not lines:
        return stats

    # Process each line
    word_records = []

    for line in lines:
        line_id = line['line_id']
        line_text = line['line_text']
        section_id = line['section_id']

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
            # Skip punctuation, digits, spaces
            if token.is_punct or token.is_digit or token.is_space:
                continue
            # Skip pure punctuation tokens (spaCy sometimes misses these)
            if not any(c.isalpha() for c in token.text):
                continue

            word_position += 1
            word_text = token.text
            lemma = token.lemma_.lower()
            pos = token.pos_

            # Skip slang terms (they have their own table)
            if lemma in slang_terms or word_text.lower() in slang_terms:
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

            # Look up existing lemma
            lemma_id = None
            if formatted_lower in existing_lemmas:
                lemma_id = existing_lemmas[formatted_lower]
                stats['lemmas_matched'] += 1
            elif pos not in FUNCTION_POS:
                # Only create new lemmas for content words (NOUN, VERB, ADJ, ADV, PROPN, NUM)
                # Function words (DET, ADP, PRON, etc.) get lemma_id = NULL if not found
                db_gender = None
                if pos in ('NOUN', 'PROPN'):
                    db_gender = 'F' if gender in ('Fem', 'F') else 'M'

                lemma_record = {
                    'lemma_text': formatted_lemma,
                    'language_code': 'es',
                    'definitions': ["(no definition)"],
                    'part_of_speech': pos,  # uppercase: NOUN, VERB, etc.
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
                    stats['errors'].append(f"Failed to create lemma '{formatted_lemma}': {result}")
                    # Still create word record with NULL lemma_id
                    lemma_id = None

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

            # Build word record (lemma_id may be NULL for function words)
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
                stats['errors'].append(f"Failed to insert batch: {result}")

    return stats


def main():
    print()
    print("=" * 60)
    print("BACKFILL SONG LINE WORDS")
    print("=" * 60)
    print()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: Supabase credentials not found in environment.")
        return

    client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)

    # Load spaCy model
    print("Loading spaCy model... ", end='', flush=True)
    nlp = load_spacy_model()
    if not nlp:
        return
    print("OK")

    # Load existing lemmas
    print("Loading existing lemmas... ", end='', flush=True)
    success, existing_lemmas = get_existing_lemmas_map(client)
    if not success:
        print(f"FAILED: {existing_lemmas}")
        return
    print(f"{len(existing_lemmas)} lemmas")

    # Load slang terms
    print("Loading slang terms... ", end='', flush=True)
    success, slang_terms = get_slang_terms_set(client)
    if not success:
        print(f"FAILED: {slang_terms}")
        return
    print(f"{len(slang_terms)} terms")

    # Load lines that already have words (for resume)
    print("Checking existing word records... ", end='', flush=True)
    success, lines_with_words = get_lines_with_existing_words(client)
    if not success:
        print(f"FAILED: {lines_with_words}")
        return
    print(f"{len(lines_with_words)} lines already processed")

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
        'total_lines': 0,
        'total_words': 0,
        'lemmas_matched': 0,
        'lemmas_created': 0,
        'errors': []
    }

    print("PROCESSING SONGS:")
    print("-" * 60)

    for i, song in enumerate(songs, 1):
        song_id = song['song_id']
        song_title = song['title']

        print(f"Processing song {i} of {len(songs)}: {song_title}... ", end='', flush=True)

        stats = process_song(
            client=client,
            nlp=nlp,
            song_id=song_id,
            song_title=song_title,
            existing_lemmas=existing_lemmas,
            slang_terms=slang_terms,
            lines_with_words=lines_with_words
        )

        if stats['errors']:
            print(f"ERRORS: {len(stats['errors'])}")
            total_stats['errors'].extend(stats['errors'])
        else:
            print(f"Created {stats['words_created']} word records for {song_title}")

        total_stats['songs_processed'] += 1
        total_stats['total_lines'] += stats['lines_processed']
        total_stats['total_words'] += stats['words_created']
        total_stats['lemmas_matched'] += stats['lemmas_matched']
        total_stats['lemmas_created'] += stats['lemmas_created']

        if stats['lines_skipped'] > 0:
            print(f"  (skipped {stats['lines_skipped']} lines already processed)")

    # Print summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Songs processed:    {total_stats['songs_processed']}")
    print(f"  Total lines:        {total_stats['total_lines']}")
    print(f"  Total words:        {total_stats['total_words']}")
    print(f"  Lemmas matched:     {total_stats['lemmas_matched']}")
    print(f"  Lemmas created:     {total_stats['lemmas_created']}")

    if total_stats['errors']:
        print()
        print(f"  Errors: {len(total_stats['errors'])}")
        for err in total_stats['errors'][:10]:
            print(f"    - {err[:80]}...")

    print()
    print("Verification queries:")
    print("  SELECT COUNT(*) FROM song_line_words;")
    print("  SELECT song_id, COUNT(*) as word_count FROM song_line_words GROUP BY song_id;")


if __name__ == '__main__':
    main()
