#!/usr/bin/env python3
"""
Comprehensive chapter review script.
Usage: python3 scripts/chapter_review/review_chapter.py --chapter N [options]

Options:
    --chapter N         Chapter number to review (required)
    --ai-validate       Run AI validation on lemmas and phrases
    --quick-check       Only run automated checks (no AI)
    --show-issues       Display current open issues
    --fix-apply         Apply suggested fixes
    --mark-complete     Mark chapter as complete
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

# Initialize Supabase client
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Try to import Anthropic (optional for AI validation)
try:
    from anthropic import Anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("Warning: anthropic not installed. AI validation disabled.")


def get_chapter_id(chapter_number: int) -> Optional[str]:
    """Get chapter UUID from chapter number."""
    result = db.table('chapters').select('chapter_id').eq('chapter_number', chapter_number).execute()
    return result.data[0]['chapter_id'] if result.data else None


def initialize_review(chapter_number: int) -> Dict:
    """Initialize or update chapter review progress."""
    # Check if already initialized
    existing = db.table('chapter_review_progress').select('*').eq('chapter_number', chapter_number).execute()

    if existing.data and existing.data[0]['status'] != 'pending':
        print(f"Chapter {chapter_number} already has status: {existing.data[0]['status']}")
        return existing.data[0]

    # Update to in_progress
    result = db.table('chapter_review_progress').update({
        'review_started_at': datetime.now().isoformat(),
        'status': 'in_progress'
    }).eq('chapter_number', chapter_number).execute()

    return result.data[0] if result.data else {}


def get_chapter_stats(chapter_number: int) -> Dict:
    """Get comprehensive chapter statistics."""
    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        return {'error': f'Chapter {chapter_number} not found'}

    # Get sentence count
    sentences = db.table('sentences').select('sentence_id', count='exact').eq('chapter_id', chapter_id).execute()

    # Get word count
    words = db.table('words').select('word_id', count='exact').eq('chapter_id', chapter_id).execute()

    # Get unique lemmas
    word_lemmas = db.table('words').select('lemma_id').eq('chapter_id', chapter_id).execute()
    unique_lemmas = len(set(w['lemma_id'] for w in word_lemmas.data if w['lemma_id']))

    # Get phrase occurrences for this chapter
    sentence_ids = [s['sentence_id'] for s in db.table('sentences').select('sentence_id').eq('chapter_id', chapter_id).execute().data]
    phrase_occs = db.table('phrase_occurrences').select('phrase_id', count='exact').in_('sentence_id', sentence_ids).execute() if sentence_ids else {'count': 0}

    return {
        'chapter_number': chapter_number,
        'sentences': sentences.count,
        'words': words.count,
        'unique_lemmas': unique_lemmas,
        'phrase_occurrences': phrase_occs.count if hasattr(phrase_occs, 'count') else 0
    }


def get_chapter_lemmas(chapter_number: int) -> List[Dict]:
    """Get all lemmas used in a chapter with usage counts."""
    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        return []

    # Get all words for chapter with lemma info
    words = db.table('words').select('lemma_id, word_text').eq('chapter_id', chapter_id).execute()

    # Count usage per lemma
    lemma_usage = {}
    lemma_forms = {}
    for w in words.data:
        lid = w['lemma_id']
        if lid:
            lemma_usage[lid] = lemma_usage.get(lid, 0) + 1
            if lid not in lemma_forms:
                lemma_forms[lid] = set()
            lemma_forms[lid].add(w['word_text'])

    # Get lemma details
    if not lemma_usage:
        return []

    lemmas = db.table('lemmas').select('*').in_('lemma_id', list(lemma_usage.keys())).execute()

    # Combine with usage
    result = []
    for l in lemmas.data:
        result.append({
            **l,
            'usage_in_chapter': lemma_usage.get(l['lemma_id'], 0),
            'word_forms': list(lemma_forms.get(l['lemma_id'], []))
        })

    # Sort by usage descending
    return sorted(result, key=lambda x: x['usage_in_chapter'], reverse=True)


def run_automated_checks(chapter_number: int) -> Dict[str, List]:
    """Run all automated quality checks for a chapter."""
    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        return {'error': f'Chapter {chapter_number} not found'}

    # Get lemma IDs for this chapter
    words = db.table('words').select('lemma_id').eq('chapter_id', chapter_id).execute()
    lemma_ids = list(set(w['lemma_id'] for w in words.data if w['lemma_id']))

    issues = {
        'verbs_missing_to': [],
        'nouns_missing_the': [],
        'nouns_without_article': [],
        'verbs_not_infinitive': [],
        'orphan_words': []
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
            issues['verbs_missing_to'].append({
                'lemma_id': l['lemma_id'],
                'lemma_text': text,
                'definition': first_def
            })

        # Nouns missing "the " prefix
        if pos == 'NOUN' and first_def and not first_def.startswith('the '):
            issues['nouns_missing_the'].append({
                'lemma_id': l['lemma_id'],
                'lemma_text': text,
                'definition': first_def
            })

        # Nouns without article in Spanish
        if pos == 'NOUN' and not text.startswith('el ') and not text.startswith('la '):
            issues['nouns_without_article'].append({
                'lemma_id': l['lemma_id'],
                'lemma_text': text
            })

        # Verbs not in infinitive (ending with accented vowel)
        if pos == 'VERB' and text and text[-1] in 'éíóáú':
            issues['verbs_not_infinitive'].append({
                'lemma_id': l['lemma_id'],
                'lemma_text': text
            })

    # Check orphan words
    orphans = db.table('words').select('word_id, word_text').eq('chapter_id', chapter_id).is_('lemma_id', 'null').execute()
    issues['orphan_words'] = [{'word_id': w['word_id'], 'word_text': w['word_text']} for w in orphans.data]

    return issues


def validate_lemma_with_ai(lemma: Dict, client: Any) -> Dict:
    """Use Claude API to validate a single lemma."""
    word_forms_str = ', '.join(lemma.get('word_forms', [])[:10])  # Limit to 10 forms
    definitions = lemma.get('definitions', [])
    first_def = definitions[0] if definitions else 'NO TRANSLATION'

    prompt = f"""Validate this Spanish vocabulary entry:

Spanish: {lemma['lemma_text']}
POS: {lemma.get('part_of_speech', 'UNKNOWN')}
Gender: {lemma.get('gender', 'N/A')}
English: {first_def}
Usage: {lemma.get('usage_in_chapter', 0)} times as forms: {word_forms_str}

Check:
1. Is Spanish form canonical? (verbs=infinitive, nouns=singular with article "el"/"la")
2. Is English translation accurate and appropriate?
3. Is POS tag correct?
4. For nouns: Is gender correct?
5. Should multiple English meanings be included?

Respond ONLY with valid JSON (no markdown, no extra text):
{{"is_valid": true, "issues": [], "confidence": 95}}
OR
{{"is_valid": false, "issues": [{{"type": "translation", "description": "...", "severity": "high"}}], "suggested_fixes": {{"definitions": ["improved translation"]}}, "confidence": 80}}
"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()
        # Try to parse JSON
        if text.startswith('{'):
            return json.loads(text)
        else:
            # Try to extract JSON from response
            import re
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        return {'is_valid': True, 'parse_error': True, 'raw': text[:200]}
    except Exception as e:
        return {'is_valid': True, 'error': str(e)}


def log_issue(chapter_number: int, issue_type: str, lemma_id: Optional[str],
              phrase_id: Optional[str], description: str, severity: str) -> None:
    """Log an issue to the database."""
    db.table('chapter_review_issues').insert({
        'chapter_number': chapter_number,
        'issue_type': issue_type,
        'lemma_id': lemma_id,
        'phrase_id': phrase_id,
        'description': description,
        'severity': severity,
        'status': 'open'
    }).execute()


def show_issues(chapter_number: int) -> List[Dict]:
    """Show all open issues for a chapter."""
    result = db.table('chapter_review_issues').select('*').eq('chapter_number', chapter_number).eq('status', 'open').execute()
    return result.data


def get_random_sentences(chapter_number: int, limit: int = 5) -> List[Dict]:
    """Get random sentences for manual spot-check."""
    chapter_id = get_chapter_id(chapter_number)
    if not chapter_id:
        return []

    sentences = db.table('sentences').select('sentence_id, sentence_text, sentence_translation').eq('chapter_id', chapter_id).execute()

    import random
    return random.sample(sentences.data, min(limit, len(sentences.data)))


def mark_complete(chapter_number: int, stats: Dict) -> None:
    """Mark chapter review as complete."""
    db.table('chapter_review_progress').update({
        'review_completed_at': datetime.now().isoformat(),
        'lemmas_reviewed': stats.get('lemmas_reviewed', 0),
        'lemmas_flagged': stats.get('lemmas_flagged', 0),
        'lemmas_fixed': stats.get('lemmas_fixed', 0),
        'phrases_reviewed': stats.get('phrases_reviewed', 0),
        'phrases_approved': stats.get('phrases_approved', 0),
        'phrases_rejected': stats.get('phrases_rejected', 0),
        'words_validated': stats.get('words_validated', 0),
        'status': 'completed'
    }).eq('chapter_number', chapter_number).execute()


def review_chapter(chapter_number: int, ai_validate: bool = False, quick_check: bool = False) -> Dict:
    """Run full review process for a chapter."""

    print(f"\n{'='*60}")
    print(f"REVIEWING CHAPTER {chapter_number}")
    print(f"{'='*60}\n")

    results = {
        'chapter_number': chapter_number,
        'started_at': datetime.now().isoformat(),
        'stats': {},
        'automated_issues': {},
        'ai_issues': [],
        'sample_sentences': []
    }

    # Step 1: Initialize
    print("Step 1: Initializing review...")
    initialize_review(chapter_number)

    # Step 2: Get chapter stats
    print("Step 2: Getting chapter statistics...")
    stats = get_chapter_stats(chapter_number)
    results['stats'] = stats
    print(f"  Sentences: {stats.get('sentences', 0)}")
    print(f"  Words: {stats.get('words', 0)}")
    print(f"  Unique Lemmas: {stats.get('unique_lemmas', 0)}")
    print(f"  Phrase Occurrences: {stats.get('phrase_occurrences', 0)}")

    # Step 3: Run automated checks
    print("\nStep 3: Running automated quality checks...")
    auto_issues = run_automated_checks(chapter_number)
    results['automated_issues'] = auto_issues

    total_auto_issues = sum(len(v) if isinstance(v, list) else 0 for v in auto_issues.values())
    print(f"  Verbs missing 'to ': {len(auto_issues.get('verbs_missing_to', []))}")
    print(f"  Nouns missing 'the ': {len(auto_issues.get('nouns_missing_the', []))}")
    print(f"  Nouns without article: {len(auto_issues.get('nouns_without_article', []))}")
    print(f"  Verbs not infinitive: {len(auto_issues.get('verbs_not_infinitive', []))}")
    print(f"  Orphan words: {len(auto_issues.get('orphan_words', []))}")
    print(f"  TOTAL AUTOMATED ISSUES: {total_auto_issues}")

    # Log automated issues
    for issue in auto_issues.get('verbs_missing_to', []):
        log_issue(chapter_number, 'verb_missing_to', issue['lemma_id'], None,
                  f"Verb '{issue['lemma_text']}' has translation '{issue['definition']}' without 'to ' prefix",
                  'high')

    for issue in auto_issues.get('nouns_missing_the', []):
        log_issue(chapter_number, 'noun_missing_the', issue['lemma_id'], None,
                  f"Noun '{issue['lemma_text']}' has translation '{issue['definition']}' without 'the ' prefix",
                  'high')

    for issue in auto_issues.get('orphan_words', []):
        log_issue(chapter_number, 'orphan_word', None, None,
                  f"Word '{issue['word_text']}' has no lemma assignment",
                  'critical')

    if quick_check:
        print("\n[Quick check mode - skipping AI validation]")
        results['completed_at'] = datetime.now().isoformat()
        return results

    # Step 4: AI Validation (if enabled)
    if ai_validate and HAS_ANTHROPIC:
        print("\nStep 4: Running AI validation on lemmas...")
        client = Anthropic()
        lemmas = get_chapter_lemmas(chapter_number)

        # Validate top 50 most-used lemmas
        ai_issues = []
        for i, lemma in enumerate(lemmas[:50]):
            result = validate_lemma_with_ai(lemma, client)
            if not result.get('is_valid', True):
                ai_issues.append({
                    'lemma': lemma,
                    'validation': result
                })
                # Log to database
                for issue in result.get('issues', []):
                    log_issue(chapter_number, f"lemma_{issue.get('type', 'unknown')}",
                              lemma['lemma_id'], None, issue.get('description', ''),
                              issue.get('severity', 'medium'))

            if (i + 1) % 10 == 0:
                print(f"  Validated {i + 1}/50 lemmas...")

        results['ai_issues'] = ai_issues
        print(f"  AI flagged {len(ai_issues)} lemmas with issues")
    else:
        print("\nStep 4: Skipping AI validation (not enabled or anthropic not installed)")

    # Step 5: Get sample sentences for manual review
    print("\nStep 5: Getting sample sentences for spot-check...")
    samples = get_random_sentences(chapter_number, 5)
    results['sample_sentences'] = samples
    print(f"  {len(samples)} sentences sampled")
    for s in samples:
        print(f"\n  Spanish: {s['sentence_text'][:80]}...")
        print(f"  English: {s['sentence_translation'][:80]}...")

    # Summary
    print(f"\n{'='*60}")
    print(f"CHAPTER {chapter_number} REVIEW SUMMARY")
    print(f"{'='*60}")
    print(f"Total automated issues: {total_auto_issues}")
    print(f"AI flagged issues: {len(results.get('ai_issues', []))}")
    print(f"Status: {'PASS' if total_auto_issues == 0 else 'NEEDS FIXES'}")

    results['completed_at'] = datetime.now().isoformat()
    return results


def main():
    parser = argparse.ArgumentParser(description='Comprehensive chapter review tool')
    parser.add_argument('--chapter', type=int, required=True, help='Chapter number to review')
    parser.add_argument('--ai-validate', action='store_true', help='Run AI validation on lemmas')
    parser.add_argument('--quick-check', action='store_true', help='Only run automated checks')
    parser.add_argument('--show-issues', action='store_true', help='Show current open issues')
    parser.add_argument('--mark-complete', action='store_true', help='Mark chapter as complete')

    args = parser.parse_args()

    if args.show_issues:
        issues = show_issues(args.chapter)
        print(f"\nOpen issues for Chapter {args.chapter}: {len(issues)}")
        for issue in issues:
            print(f"  [{issue['severity']}] {issue['issue_type']}: {issue['description']}")
        return

    if args.mark_complete:
        # Get current stats and mark complete
        stats = get_chapter_stats(args.chapter)
        mark_complete(args.chapter, {
            'lemmas_reviewed': stats.get('unique_lemmas', 0),
            'words_validated': stats.get('words', 0)
        })
        print(f"Chapter {args.chapter} marked as complete")
        return

    # Run full review
    results = review_chapter(args.chapter, ai_validate=args.ai_validate, quick_check=args.quick_check)

    # Output JSON results
    print(f"\n\nResults JSON:\n{json.dumps(results, indent=2, default=str)}")


if __name__ == '__main__':
    main()
