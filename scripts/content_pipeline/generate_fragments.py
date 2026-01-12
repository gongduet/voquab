#!/usr/bin/env python3
"""
Content Pipeline: Generate Sentence Fragments

Generates meaningful sentence fragments for the reading comprehension feature.
Uses Claude API to intelligently segment Spanish sentences into 2-4 chunks
that translate meaningfully on their own.

Usage:
    python scripts/content_pipeline/generate_fragments.py --chapters 1 --dry-run
    python scripts/content_pipeline/generate_fragments.py --chapters 1 2 3

Requirements:
    pip install anthropic supabase python-dotenv
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Load environment variables from project root
load_dotenv(Path(__file__).parent.parent.parent / '.env')

# Lazy-loaded clients
supabase_client = None
anthropic_client = None


def get_supabase():
    """Lazy load Supabase client with service role key."""
    global supabase_client
    if supabase_client is None:
        from supabase import create_client
        url = os.getenv('VITE_SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            print("ERROR: Supabase credentials not found in .env")
            print("  Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
            sys.exit(1)
        supabase_client = create_client(url, key)
    return supabase_client


def get_anthropic():
    """Lazy load Anthropic client."""
    global anthropic_client
    if anthropic_client is None:
        import anthropic
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            print("ERROR: ANTHROPIC_API_KEY not found in .env")
            sys.exit(1)
        anthropic_client = anthropic.Anthropic(api_key=api_key)
    return anthropic_client


def get_chapter_id(chapter_number: int) -> Optional[str]:
    """Get chapter_id for a chapter number."""
    supabase = get_supabase()
    result = supabase.table('chapters').select('chapter_id').eq(
        'chapter_number', chapter_number
    ).execute()

    if result.data:
        return result.data[0]['chapter_id']
    return None


def get_sentences_for_chapter(chapter_id: str) -> List[Dict]:
    """Fetch all sentences for a chapter."""
    supabase = get_supabase()
    result = supabase.table('sentences').select(
        'sentence_id, sentence_order, sentence_text, sentence_translation'
    ).eq('chapter_id', chapter_id).order('sentence_order').execute()

    return result.data or []


def has_existing_fragments(sentence_id: str) -> bool:
    """Check if sentence already has fragments."""
    supabase = get_supabase()
    result = supabase.table('sentence_fragments').select(
        'fragment_id'
    ).eq('sentence_id', sentence_id).limit(1).execute()

    return bool(result.data)


def translate_sentence(spanish_text: str) -> str:
    """Use Claude to translate a sentence if translation is missing."""
    client = get_anthropic()

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"""Translate this Spanish sentence to English. Return ONLY the English translation, nothing else.

Spanish: {spanish_text}

English:"""
        }]
    )

    return response.content[0].text.strip()


def generate_fragments(spanish_text: str, english_text: str) -> List[Dict]:
    """
    Use Claude to segment a sentence into meaningful fragments.
    Returns list of {es, en, context_note?} dicts.
    """
    client = get_anthropic()

    prompt = f"""Segment this Spanish sentence into 2-4 meaningful fragments for language learners.

RULES:
1. Each fragment should be 4-10 words (prefer 5-8)
2. Each fragment MUST translate meaningfully on its own
3. Follow natural reading rhythm and clause boundaries
4. NEVER split:
   - Verb phrases (he estado → keep together)
   - Noun phrases with articles (la pequeña rosa → keep together)
   - Prepositional phrases (en el desierto → keep together)
5. If sentence is < 5 words, return it as a single fragment
6. Keep quoted text intact within fragments

Spanish: {spanish_text}
English: {english_text}

Respond with a JSON array of fragments. Each fragment has:
- "es": Spanish text
- "en": English translation
- "context_note": (optional) Brief grammar note if fragment contains tricky pattern

Example response:
[
  {{"es": "Cuando yo tenía seis años,", "en": "When I was six years old,"}},
  {{"es": "vi una magnífica lámina", "en": "I saw a magnificent illustration", "context_note": "magnífica agrees with feminine lámina"}}
]

Return ONLY the JSON array, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": prompt
        }]
    )

    response_text = response.content[0].text.strip()

    # Parse JSON response
    try:
        # Handle potential markdown code blocks
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            # Remove first and last lines (code fence)
            response_text = '\n'.join(lines[1:-1])

        fragments = json.loads(response_text)
        return fragments
    except json.JSONDecodeError as e:
        print(f"    WARNING: Could not parse Claude response as JSON: {e}")
        print(f"    Response was: {response_text[:200]}...")
        return []


def calculate_word_positions(sentence_text: str, fragment_text: str, start_from: int = 0) -> tuple:
    """
    Calculate start and end word positions for a fragment within a sentence.
    Returns (start_position, end_position, next_start).
    """
    sentence_words = sentence_text.split()
    fragment_words = fragment_text.split()

    # Find where fragment starts in sentence
    fragment_start = None
    for i in range(start_from, len(sentence_words)):
        # Check if fragment matches starting at position i
        matches = True
        for j, frag_word in enumerate(fragment_words):
            if i + j >= len(sentence_words):
                matches = False
                break
            # Normalize for comparison (remove punctuation for matching)
            sent_word = sentence_words[i + j].rstrip('.,;:!?»"\'').lstrip('«"\'¿¡')
            frag_word_clean = frag_word.rstrip('.,;:!?»"\'').lstrip('«"\'¿¡')
            if sent_word.lower() != frag_word_clean.lower():
                matches = False
                break
        if matches:
            fragment_start = i
            break

    if fragment_start is None:
        # Fallback: use sequential positioning
        return (start_from, start_from + len(fragment_words) - 1, start_from + len(fragment_words))

    start_pos = fragment_start
    end_pos = fragment_start + len(fragment_words) - 1
    next_start = end_pos + 1

    return (start_pos, end_pos, next_start)


def insert_fragments(sentence_id: str, fragments: List[Dict], sentence_text: str) -> int:
    """Insert fragments into database. Returns count inserted."""
    supabase = get_supabase()

    current_position = 0
    inserted = 0

    for i, frag in enumerate(fragments):
        # Calculate word positions
        start_pos, end_pos, next_pos = calculate_word_positions(
            sentence_text, frag['es'], current_position
        )
        current_position = next_pos

        # Build insert data
        insert_data = {
            'sentence_id': sentence_id,
            'fragment_order': i + 1,
            'start_word_position': start_pos,
            'end_word_position': end_pos,
            'fragment_text': frag['es'],
            'fragment_translation': frag['en'],
        }

        if frag.get('context_note'):
            insert_data['context_note'] = frag['context_note']

        supabase.table('sentence_fragments').insert(insert_data).execute()
        inserted += 1

    return inserted


def process_chapter(chapter_number: int, dry_run: bool = False) -> Dict:
    """
    Process all sentences in a chapter.
    Returns stats dict.
    """
    print(f"\nProcessing Chapter {chapter_number}")
    print("=" * 40)

    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        print(f"  ERROR: Chapter {chapter_number} not found in database")
        return {'sentences': 0, 'processed': 0, 'fragments': 0, 'skipped': 0, 'errors': 0}

    sentences = get_sentences_for_chapter(chapter_id)

    stats = {
        'sentences': len(sentences),
        'processed': 0,
        'fragments': 0,
        'skipped': 0,
        'errors': 0,
        'translations_generated': 0
    }

    for sentence in sentences:
        sentence_id = sentence['sentence_id']
        sentence_order = sentence['sentence_order']
        spanish = sentence['sentence_text']
        english = sentence['sentence_translation']

        # Skip if fragments already exist
        if has_existing_fragments(sentence_id):
            print(f"  [{sentence_order}] SKIPPED (fragments exist)")
            stats['skipped'] += 1
            continue

        # Generate translation if missing
        if not english or english.strip() == '':
            print(f"  [{sentence_order}] Generating translation...")
            english = translate_sentence(spanish)
            stats['translations_generated'] += 1

            # Update sentence with translation if not dry run
            if not dry_run:
                supabase = get_supabase()
                supabase.table('sentences').update({
                    'sentence_translation': english
                }).eq('sentence_id', sentence_id).execute()

        # Generate fragments
        fragments = generate_fragments(spanish, english)

        if not fragments:
            print(f"  [{sentence_order}] ERROR: No fragments generated")
            stats['errors'] += 1
            continue

        # Display fragments
        print(f"  [{sentence_order}] {len(fragments)} fragments:")
        for frag in fragments:
            has_note = '*' if frag.get('context_note') else ''
            print(f"       → \"{frag['es']}\" = \"{frag['en']}\"{has_note}")

        # Insert if not dry run
        if not dry_run:
            try:
                insert_fragments(sentence_id, fragments, spanish)
            except Exception as e:
                print(f"       ERROR inserting: {e}")
                stats['errors'] += 1
                continue

        stats['processed'] += 1
        stats['fragments'] += len(fragments)

    return stats


def get_sentences_by_ids(sentence_ids: List[str]) -> List[Dict]:
    """Fetch specific sentences by their IDs."""
    supabase = get_supabase()
    result = supabase.table('sentences').select(
        'sentence_id, sentence_order, sentence_text, sentence_translation'
    ).in_('sentence_id', sentence_ids).order('sentence_order').execute()

    return result.data or []


def process_sentences(sentence_ids: List[str], dry_run: bool = False) -> Dict:
    """
    Process specific sentences by ID.
    Returns stats dict.
    """
    print(f"\nProcessing {len(sentence_ids)} specific sentences")
    print("=" * 40)

    sentences = get_sentences_by_ids(sentence_ids)

    if not sentences:
        print("  ERROR: No sentences found with those IDs")
        return {'sentences': 0, 'processed': 0, 'fragments': 0, 'skipped': 0, 'errors': 0}

    stats = {
        'sentences': len(sentences),
        'processed': 0,
        'fragments': 0,
        'skipped': 0,
        'errors': 0,
        'translations_generated': 0
    }

    for sentence in sentences:
        sentence_id = sentence['sentence_id']
        sentence_order = sentence['sentence_order']
        spanish = sentence['sentence_text']
        english = sentence['sentence_translation']

        # Skip if fragments already exist
        if has_existing_fragments(sentence_id):
            print(f"  [{sentence_order}] SKIPPED (fragments exist)")
            stats['skipped'] += 1
            continue

        # Generate translation if missing
        if not english or english.strip() == '':
            print(f"  [{sentence_order}] Generating translation...")
            english = translate_sentence(spanish)
            stats['translations_generated'] += 1

            # Update sentence with translation if not dry run
            if not dry_run:
                supabase = get_supabase()
                supabase.table('sentences').update({
                    'sentence_translation': english
                }).eq('sentence_id', sentence_id).execute()

        # Generate fragments
        fragments = generate_fragments(spanish, english)

        if not fragments:
            print(f"  [{sentence_order}] ERROR: No fragments generated")
            stats['errors'] += 1
            continue

        # Display fragments
        print(f"  [{sentence_order}] {len(fragments)} fragments:")
        for frag in fragments:
            has_note = '*' if frag.get('context_note') else ''
            print(f"       → \"{frag['es']}\" = \"{frag['en']}\"{has_note}")

        # Insert if not dry run
        if not dry_run:
            try:
                insert_fragments(sentence_id, fragments, spanish)
            except Exception as e:
                print(f"       ERROR inserting: {e}")
                stats['errors'] += 1
                continue

        stats['processed'] += 1
        stats['fragments'] += len(fragments)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Generate sentence fragments for reading comprehension'
    )
    parser.add_argument(
        '--chapters',
        nargs='+',
        type=int,
        help='Chapter numbers to process (e.g., --chapters 1 2 3)'
    )
    parser.add_argument(
        '--sentence-ids',
        nargs='+',
        type=str,
        help='Specific sentence UUIDs to process'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show output without saving to database'
    )

    args = parser.parse_args()

    if not args.chapters and not args.sentence_ids:
        parser.error('Either --chapters or --sentence-ids is required')

    if args.dry_run:
        print("\n" + "=" * 50)
        print("DRY RUN MODE - No database changes will be made")
        print("=" * 50)

    total_stats = {
        'sentences': 0,
        'processed': 0,
        'fragments': 0,
        'skipped': 0,
        'errors': 0,
        'translations_generated': 0
    }

    # Process by sentence IDs if provided
    if args.sentence_ids:
        stats = process_sentences(args.sentence_ids, args.dry_run)
        for key in total_stats:
            total_stats[key] += stats.get(key, 0)
    # Otherwise process by chapters
    elif args.chapters:
        for chapter_num in args.chapters:
            stats = process_chapter(chapter_num, args.dry_run)
            for key in total_stats:
                total_stats[key] += stats.get(key, 0)

    # Print summary
    print("\n")
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    if args.sentence_ids:
        print(f"  Sentences targeted: {len(args.sentence_ids)}")
    else:
        print(f"  Chapters processed: {len(args.chapters)}")
    print(f"  Total sentences: {total_stats['sentences']}")
    print(f"  Processed: {total_stats['processed']}")
    print(f"  Skipped (existing): {total_stats['skipped']}")
    print(f"  Errors: {total_stats['errors']}")
    print(f"  Translations generated: {total_stats['translations_generated']}")
    print()

    if args.dry_run:
        print(f"  Fragments WOULD be created: {total_stats['fragments']}")
        print("\n  (Run without --dry-run to insert into database)")
    else:
        print(f"  Fragments created: {total_stats['fragments']}")

    print()


if __name__ == '__main__':
    main()
