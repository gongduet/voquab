#!/usr/bin/env python3
"""
Batch quick check for all chapters.
Usage: python3 scripts/chapter_review/batch_quick_check.py
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

# Initialize Supabase client
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)


def get_chapter_id(chapter_number: int):
    """Get chapter UUID from chapter number."""
    result = db.table('chapters').select('chapter_id').eq('chapter_number', chapter_number).execute()
    return result.data[0]['chapter_id'] if result.data else None


def run_automated_checks(chapter_number: int):
    """Run all automated quality checks for a chapter."""
    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        return {'error': f'Chapter {chapter_number} not found'}

    # Get lemma IDs for this chapter
    words = db.table('words').select('lemma_id').eq('chapter_id', chapter_id).execute()
    lemma_ids = list(set(w['lemma_id'] for w in words.data if w['lemma_id']))

    issues = {
        'verbs_missing_to': 0,
        'nouns_missing_the': 0,
        'nouns_without_article': 0,
        'verbs_not_infinitive': 0,
        'orphan_words': 0
    }

    if not lemma_ids:
        return issues

    # Get all lemmas for chapter
    lemmas = db.table('lemmas').select('*').in_('lemma_id', lemma_ids).execute()

    for l in lemmas.data:
        pos = l.get('part_of_speech', '')
        text = l.get('lemma_text', '')
        defs = l.get('definitions', [])
        first_def = defs[0] if defs else ''

        # Verbs missing "to " prefix
        if pos == 'VERB' and first_def and not first_def.startswith('to '):
            issues['verbs_missing_to'] += 1

        # Nouns missing "the " prefix
        if pos == 'NOUN' and first_def and not first_def.startswith('the '):
            issues['nouns_missing_the'] += 1

        # Nouns without article in Spanish
        if pos == 'NOUN' and not text.startswith('el ') and not text.startswith('la '):
            issues['nouns_without_article'] += 1

        # Verbs not in infinitive (ending with accented vowel)
        if pos == 'VERB' and text and text[-1] in 'éíóáú':
            issues['verbs_not_infinitive'] += 1

    # Check orphan words
    orphans = db.table('words').select('word_id', count='exact').eq('chapter_id', chapter_id).is_('lemma_id', 'null').execute()
    issues['orphan_words'] = orphans.count

    return issues


def main():
    print("=" * 80)
    print("BATCH QUICK CHECK - ALL 27 CHAPTERS")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()

    # Header
    print(f"{'Ch':>3} | {'Sentences':>9} | {'Words':>6} | {'Lemmas':>6} | {'V-to':>4} | {'N-the':>5} | {'N-art':>5} | {'V-inf':>5} | {'Orphan':>6} | Status")
    print("-" * 80)

    total_issues = 0
    passed = 0
    failed = 0

    for chapter_num in range(1, 28):
        chapter_id = get_chapter_id(chapter_num)
        if not chapter_id:
            print(f"{chapter_num:>3} | {'NOT FOUND':^60}")
            continue

        # Get stats
        sentences = db.table('sentences').select('sentence_id', count='exact').eq('chapter_id', chapter_id).execute()
        words = db.table('words').select('word_id', count='exact').eq('chapter_id', chapter_id).execute()
        word_lemmas = db.table('words').select('lemma_id').eq('chapter_id', chapter_id).execute()
        unique_lemmas = len(set(w['lemma_id'] for w in word_lemmas.data if w['lemma_id']))

        # Run checks
        issues = run_automated_checks(chapter_num)

        total = sum(issues.values())
        total_issues += total
        status = "PASS" if total == 0 else "FAIL"

        if total == 0:
            passed += 1
        else:
            failed += 1

        print(f"{chapter_num:>3} | {sentences.count:>9} | {words.count:>6} | {unique_lemmas:>6} | "
              f"{issues['verbs_missing_to']:>4} | {issues['nouns_missing_the']:>5} | "
              f"{issues['nouns_without_article']:>5} | {issues['verbs_not_infinitive']:>5} | "
              f"{issues['orphan_words']:>6} | {status}")

    print("-" * 80)
    print()
    print(f"SUMMARY: {passed} passed, {failed} failed, {total_issues} total issues")
    print()

    if total_issues == 0:
        print("ALL CHAPTERS PASS AUTOMATED QUALITY CHECKS!")
    else:
        print("Some chapters have issues that need attention.")


if __name__ == '__main__':
    main()
