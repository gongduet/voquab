#!/usr/bin/env python3
"""
Fragment Generation Audit Script

Analyzes the current state of sentence fragment generation.
Read-only - does not modify any data.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root
load_dotenv(Path(__file__).parent.parent.parent / '.env')

def get_supabase():
    """Get Supabase client."""
    from supabase import create_client
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: Supabase credentials not found in .env")
        sys.exit(1)
    return create_client(url, key)


def run_audit():
    supabase = get_supabase()

    print("\n" + "=" * 70)
    print("FRAGMENT GENERATION AUDIT")
    print("=" * 70)

    # 1. Fragment Coverage by Chapter
    print("\n1. FRAGMENT COVERAGE BY CHAPTER")
    print("-" * 70)
    print(f"{'Ch':>3} | {'Total':>6} | {'With':>6} | {'Without':>7} | {'Frags':>6} | {'Coverage':>8}")
    print("-" * 70)

    # Get all chapters
    chapters_result = supabase.table('chapters').select('chapter_id, chapter_number').order('chapter_number').execute()
    chapters = chapters_result.data

    total_sentences_all = 0
    total_with_fragments = 0
    total_without_fragments = 0
    total_fragments = 0
    complete_chapters = 0
    partial_chapters = 0
    not_started_chapters = 0

    chapter_stats = []

    for ch in chapters:
        ch_id = ch['chapter_id']
        ch_num = ch['chapter_number']

        # Get all sentences for this chapter
        sentences_result = supabase.table('sentences').select('sentence_id').eq('chapter_id', ch_id).execute()
        sentence_ids = [s['sentence_id'] for s in sentences_result.data]
        total_sentences = len(sentence_ids)

        if total_sentences == 0:
            continue

        # Get sentences that have fragments
        with_frags = 0
        frag_count = 0

        if sentence_ids:
            # Count sentences with fragments
            frags_result = supabase.table('sentence_fragments').select('sentence_id, fragment_id').in_('sentence_id', sentence_ids).execute()
            sentences_with_frags = set(f['sentence_id'] for f in frags_result.data)
            with_frags = len(sentences_with_frags)
            frag_count = len(frags_result.data)

        without_frags = total_sentences - with_frags
        coverage = (with_frags / total_sentences * 100) if total_sentences > 0 else 0

        # Track totals
        total_sentences_all += total_sentences
        total_with_fragments += with_frags
        total_without_fragments += without_frags
        total_fragments += frag_count

        # Categorize chapter
        if coverage == 100:
            complete_chapters += 1
        elif coverage > 0:
            partial_chapters += 1
        else:
            not_started_chapters += 1

        chapter_stats.append({
            'num': ch_num,
            'total': total_sentences,
            'with': with_frags,
            'without': without_frags,
            'frags': frag_count,
            'coverage': coverage
        })

        print(f"{ch_num:>3} | {total_sentences:>6} | {with_frags:>6} | {without_frags:>7} | {frag_count:>6} | {coverage:>7.1f}%")

    print("-" * 70)
    print(f"{'TOT':>3} | {total_sentences_all:>6} | {total_with_fragments:>6} | {total_without_fragments:>7} | {total_fragments:>6} | {(total_with_fragments/total_sentences_all*100):>7.1f}%")

    # 2. Identify Missing Sentences
    print("\n\n2. MISSING SENTENCES (No Fragments)")
    print("-" * 70)

    missing_sentences = []

    for ch in chapters:
        ch_id = ch['chapter_id']
        ch_num = ch['chapter_number']

        # Get sentences for this chapter
        sentences_result = supabase.table('sentences').select(
            'sentence_id, sentence_order, sentence_text, sentence_translation'
        ).eq('chapter_id', ch_id).order('sentence_order').execute()

        for sent in sentences_result.data:
            # Check if has fragments
            frag_check = supabase.table('sentence_fragments').select('fragment_id').eq('sentence_id', sent['sentence_id']).limit(1).execute()

            if not frag_check.data:
                missing_sentences.append({
                    'chapter': ch_num,
                    'order': sent['sentence_order'],
                    'text': sent['sentence_text'][:50] + '...' if len(sent['sentence_text']) > 50 else sent['sentence_text'],
                    'has_translation': 'yes' if sent.get('sentence_translation') else 'no',
                    'length': len(sent['sentence_text'])
                })

    if missing_sentences:
        # Group by chapter
        current_chapter = None
        for ms in missing_sentences:
            if ms['chapter'] != current_chapter:
                current_chapter = ms['chapter']
                print(f"\nChapter {current_chapter}:")
            print(f"  [{ms['order']:>3}] {ms['text']} (trans: {ms['has_translation']})")
    else:
        print("No missing sentences found!")

    # 3. Check for Duplicates
    print("\n\n3. DUPLICATE FRAGMENT CHECK")
    print("-" * 70)

    # Get all fragments grouped by sentence_id and fragment_order
    all_frags = supabase.table('sentence_fragments').select('sentence_id, fragment_order').execute()

    # Count duplicates
    seen = {}
    duplicates = []
    for f in all_frags.data:
        key = (f['sentence_id'], f['fragment_order'])
        if key in seen:
            seen[key] += 1
        else:
            seen[key] = 1

    for key, count in seen.items():
        if count > 1:
            duplicates.append({'sentence_id': key[0], 'fragment_order': key[1], 'count': count})

    if duplicates:
        print(f"Found {len(duplicates)} duplicate entries:")
        for d in duplicates:
            print(f"  sentence_id: {d['sentence_id']}, fragment_order: {d['fragment_order']}, count: {d['count']}")
    else:
        print("No duplicates found!")

    # 4. Last Successfully Processed
    print("\n\n4. LAST SUCCESSFULLY PROCESSED")
    print("-" * 70)

    # Find the latest fragment by looking at sentences with fragments in highest chapters
    for ch in reversed(chapters):
        ch_id = ch['chapter_id']
        ch_num = ch['chapter_number']

        sentences_result = supabase.table('sentences').select(
            'sentence_id, sentence_order, sentence_text'
        ).eq('chapter_id', ch_id).order('sentence_order', desc=True).execute()

        for sent in sentences_result.data:
            frag_check = supabase.table('sentence_fragments').select('fragment_id').eq('sentence_id', sent['sentence_id']).limit(1).execute()
            if frag_check.data:
                print(f"Chapter: {ch_num}")
                print(f"Sentence Order: {sent['sentence_order']}")
                print(f"Text: {sent['sentence_text'][:80]}...")
                break
        else:
            continue
        break

    # 5. Error Pattern Analysis
    print("\n\n5. ERROR PATTERN ANALYSIS")
    print("-" * 70)

    if missing_sentences:
        # Check for patterns
        chapters_with_missing = set(ms['chapter'] for ms in missing_sentences)
        missing_without_trans = sum(1 for ms in missing_sentences if ms['has_translation'] == 'no')
        avg_length = sum(ms['length'] for ms in missing_sentences) / len(missing_sentences)

        print(f"Missing sentences appear in {len(chapters_with_missing)} chapters: {sorted(chapters_with_missing)}")
        print(f"Missing without translation: {missing_without_trans} / {len(missing_sentences)}")
        print(f"Average length of missing sentences: {avg_length:.0f} characters")

        # Check for long sentences
        long_missing = [ms for ms in missing_sentences if ms['length'] > 200]
        if long_missing:
            print(f"Long sentences (>200 chars) missing: {len(long_missing)}")
    else:
        print("No missing sentences to analyze.")

    # 6. Summary Report
    print("\n\n" + "=" * 70)
    print("SUMMARY REPORT")
    print("=" * 70)
    print(f"Total chapters: {len(chapters)}")
    print(f"Chapters complete (100%): {complete_chapters}")
    print(f"Chapters partial: {partial_chapters}")
    print(f"Chapters not started: {not_started_chapters}")
    print()
    print(f"Total sentences in book: {total_sentences_all}")
    print(f"Sentences with fragments: {total_with_fragments}")
    print(f"Sentences missing fragments: {total_without_fragments}")
    print()
    print(f"Duplicates found: {len(duplicates)}")
    print()
    print("RECOMMENDATION:")

    if total_without_fragments == 0:
        print("All sentences have fragments! Job complete.")
    else:
        # Find chapters that need work
        incomplete = [s for s in chapter_stats if s['coverage'] < 100]
        if incomplete:
            chapters_to_run = [s['num'] for s in incomplete]
            print(f"Re-run fragment generation for chapters: {' '.join(map(str, chapters_to_run))}")
            print(f"Command: python scripts/content_pipeline/generate_fragments.py --chapters {' '.join(map(str, chapters_to_run))}")

    print("\n")


if __name__ == '__main__':
    run_audit()
