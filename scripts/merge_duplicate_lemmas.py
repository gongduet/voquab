#!/usr/bin/env python3
"""
Merge duplicate lemmas (inflected forms) into canonical dictionary forms.

In Spanish dictionaries, you find:
- Adjectives: masculine singular (bueno, not buena/buenos/buenas)
- Numbers: full form (ciento, with note about cien)

This script merges inflected forms into their canonical lemmas.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

# Initialize Supabase client
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Merge definitions: canonical_lemma -> [duplicates_to_merge]
# Also includes translation fixes where needed
LEMMA_MERGES = {
    # Adjectives - merge to masculine singular
    'bueno': {
        'merge': ['buen', 'buenas', 'buenos'],
        'translation': 'good',  # was "well" which is adverb
    },
    'malo': {
        'merge': ['mal', 'mala'],
        'translation': 'bad',
    },
    'largo': {
        'merge': ['larga'],
        'translation': 'long',  # was "length" which is noun
    },
    'nuevo': {
        'merge': ['nueva'],
        'translation': 'new',
    },
    'precioso': {
        'merge': ['preciosa'],
        'translation': 'precious',  # or "beautiful"
    },
    'tercero': {
        'merge': ['tercer'],
        'translation': 'third',
    },
    'rosa': {
        'merge': ['rosas'],  # Only ADJ forms, not "la rosa" noun
        'translation': 'pink',
        'pos_filter': 'ADJ',  # Only merge ADJ, keep NOUN separate
    },

    # Numbers - merge apocopated forms
    'ciento': {
        'merge': ['cien'],
        'translation': 'one hundred',
    },
}


def get_lemma(lemma_text, pos_filter=None):
    """Get lemma by text, optionally filtering by POS."""
    query = db.table('lemmas').select('*').eq('lemma_text', lemma_text)
    if pos_filter:
        query = query.eq('part_of_speech', pos_filter)
    result = query.execute()
    return result.data[0] if result.data else None


def merge_lemmas(dry_run=True):
    """Merge duplicate lemmas into canonical forms."""
    print("=" * 80)
    print("LEMMA DEDUPLICATION - MERGE INFLECTED FORMS")
    print("=" * 80)

    if dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***")
        print("    Use --apply to apply changes\n")
    else:
        print("\n*** APPLYING CHANGES ***\n")

    total_merged = 0
    total_words_reassigned = 0

    for canonical_text, config in LEMMA_MERGES.items():
        duplicates = config['merge']
        new_translation = config.get('translation')
        pos_filter = config.get('pos_filter')

        # Get canonical lemma
        canonical = get_lemma(canonical_text, pos_filter)
        if not canonical:
            print(f"\n  WARNING: Canonical lemma '{canonical_text}' not found, skipping")
            continue

        canonical_id = canonical['lemma_id']

        print(f"\n{canonical_text} (canonical)")

        # Update translation if specified
        if new_translation and canonical.get('definitions', [''])[0] != new_translation:
            old_trans = canonical.get('definitions', [''])[0]
            print(f"  Translation: {old_trans} -> {new_translation}")
            if not dry_run:
                db.table('lemmas').update({'definitions': [new_translation]}).eq('lemma_id', canonical_id).execute()

        # Process duplicates
        for dup_text in duplicates:
            dup = get_lemma(dup_text, pos_filter)
            if not dup:
                print(f"  {dup_text}: not found (already merged?)")
                continue

            dup_id = dup['lemma_id']

            # Count words
            words = db.table('words').select('word_id', count='exact').eq('lemma_id', dup_id).execute()
            word_count = words.count or 0

            print(f"  {dup_text} -> merge ({word_count} words)")

            if not dry_run:
                # Reassign words to canonical lemma
                if word_count > 0:
                    db.table('words').update({'lemma_id': canonical_id}).eq('lemma_id', dup_id).execute()

                # Delete validation report
                db.table('validation_reports').delete().eq('lemma_id', dup_id).execute()

                # Delete duplicate lemma
                db.table('lemmas').delete().eq('lemma_id', dup_id).execute()

            total_merged += 1
            total_words_reassigned += word_count

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Lemmas merged: {total_merged}")
    print(f"  Words reassigned: {total_words_reassigned}")

    if dry_run:
        print("\n*** DRY RUN - Use --apply to make changes ***")

    return total_merged, total_words_reassigned


def main():
    dry_run = '--apply' not in sys.argv
    merge_lemmas(dry_run)


if __name__ == '__main__':
    main()
