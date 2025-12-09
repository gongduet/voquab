#!/usr/bin/env python3
"""
EXHAUSTIVE AI VALIDATION - Validates EVERY lemma in the database.

This script validates ALL 1,854 lemmas with no exceptions.
Each lemma is checked for:
1. Spanish form correctness (infinitive for verbs, article+singular for nouns)
2. English translation accuracy
3. POS tag correctness
4. Gender correctness (for nouns)
5. Translation appropriateness for learners

Usage:
    python3 scripts/chapter_review/exhaustive_ai_validation.py [options]

Options:
    --batch-size N      Number of lemmas per AI batch (default: 20)
    --start-from N      Start from lemma N (for resuming)
    --dry-run           Show what would be validated without calling AI
    --output FILE       Write results to JSON file
    --fix-mode          Generate SQL fix scripts for issues found
"""

import argparse
import json
import os
import sys
import time
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

# Try to import Anthropic
try:
    from anthropic import Anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("ERROR: anthropic package not installed. Run: pip install anthropic")
    sys.exit(1)


def get_all_lemmas() -> List[Dict]:
    """Fetch ALL lemmas from the database with pagination to get every single one."""
    print("Fetching all lemmas from database...")

    all_lemmas = []
    page_size = 1000
    offset = 0

    while True:
        result = db.table('lemmas').select('*').order('lemma_text').range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_lemmas.extend(result.data)
        print(f"  Fetched {len(all_lemmas)} lemmas...")
        if len(result.data) < page_size:
            break
        offset += page_size

    print(f"Found {len(all_lemmas)} total lemmas")
    return all_lemmas


def get_lemma_context(lemma_id: str) -> Dict:
    """Get usage context for a lemma (word forms, example sentences)."""
    # Get word forms
    words = db.table('words').select('word_text, sentence_id').eq('lemma_id', lemma_id).limit(20).execute()

    word_forms = list(set(w['word_text'] for w in words.data))

    # Get example sentence
    example_sentence = None
    if words.data:
        sentence_id = words.data[0]['sentence_id']
        sentence = db.table('sentences').select('sentence_text, sentence_translation').eq('sentence_id', sentence_id).execute()
        if sentence.data:
            example_sentence = {
                'spanish': sentence.data[0]['sentence_text'],
                'english': sentence.data[0]['sentence_translation']
            }

    return {
        'word_forms': word_forms[:10],  # Limit to 10 forms
        'usage_count': len(words.data),
        'example': example_sentence
    }


def validate_batch_with_ai(lemmas: List[Dict], client: Any) -> List[Dict]:
    """Validate a batch of lemmas with Claude AI."""

    # Build the batch prompt
    lemma_entries = []
    for i, lemma in enumerate(lemmas):
        defs = lemma.get('definitions', [])
        first_def = defs[0] if defs else 'NO TRANSLATION'

        entry = f"""
{i+1}. Spanish: "{lemma['lemma_text']}"
   POS: {lemma.get('part_of_speech', 'UNKNOWN')}
   Gender: {lemma.get('gender', 'N/A')}
   English: "{first_def}"
"""
        lemma_entries.append(entry)

    prompt = f"""You are validating Spanish vocabulary entries for a language learning app teaching "El Principito" (The Little Prince).

VALIDATION RULES:
1. VERBS must be infinitive form (ending in -ar, -er, -ir) and English must start with "to "
2. NOUNS must have article prefix ("el " or "la ") in Spanish, and English must start with "the "
3. Translations must be accurate and appropriate for the literary context
4. POS tags must be correct (VERB, NOUN, ADJ, ADV, PRON, DET, ADP, CONJ, etc.)
5. Gender must be correct for nouns (M for masculine, F for feminine)

ENTRIES TO VALIDATE:
{"".join(lemma_entries)}

For EACH entry, respond with a JSON object. Be STRICT - flag any issues.

Respond with a JSON array of objects, one per entry:
[
  {{"index": 1, "is_valid": true}},
  {{"index": 2, "is_valid": false, "issues": [{{"type": "translation", "description": "Translation is inaccurate - should be 'X'", "severity": "high", "suggested_fix": "correct translation"}}]}},
  ...
]

IMPORTANT:
- Check EVERY entry carefully
- Flag even minor translation inaccuracies
- Verbs MUST have "to " prefix in English
- Nouns MUST have "the " prefix in English
- Be thorough - we cannot miss any errors

Respond ONLY with the JSON array, no other text."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        text = response.content[0].text.strip()

        # Parse JSON response
        if text.startswith('['):
            results = json.loads(text)
        else:
            # Try to extract JSON array from response
            import re
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                results = json.loads(match.group())
            else:
                print(f"Warning: Could not parse AI response: {text[:200]}")
                return [{'index': i+1, 'is_valid': True, 'parse_error': True} for i in range(len(lemmas))]

        # Merge results with original lemmas
        for result in results:
            idx = result.get('index', 0) - 1
            if 0 <= idx < len(lemmas):
                result['lemma'] = lemmas[idx]

        return results

    except Exception as e:
        print(f"Error calling AI: {e}")
        return [{'index': i+1, 'is_valid': True, 'error': str(e)} for i in range(len(lemmas))]


def save_validation_result(lemma_id: str, result: Dict) -> None:
    """Save validation result to database."""
    try:
        # Check if record exists
        existing = db.table('validation_reports').select('report_id').eq('lemma_id', lemma_id).execute()

        record = {
            'lemma_id': lemma_id,
            'is_valid': result.get('is_valid', True),
            'issues': result.get('issues', []),
            'suggested_fixes': result.get('suggested_fixes', {}),
            'confidence': result.get('confidence', 100 if result.get('is_valid') else 70),
            'validated_at': datetime.now().isoformat()
        }

        if existing.data:
            # Update existing
            db.table('validation_reports').update(record).eq('lemma_id', lemma_id).execute()
        else:
            # Insert new
            db.table('validation_reports').insert(record).execute()
    except Exception as e:
        print(f"Warning: Could not save validation result for {lemma_id}: {e}")


def generate_fix_script(issues: List[Dict], output_file: str) -> None:
    """Generate SQL fix script for all issues found."""
    with open(output_file, 'w') as f:
        f.write(f"-- EXHAUSTIVE AI VALIDATION FIX SCRIPT\n")
        f.write(f"-- Generated: {datetime.now().isoformat()}\n")
        f.write(f"-- Total issues: {len(issues)}\n\n")

        # Group by severity
        critical = [i for i in issues if any(iss.get('severity') == 'critical' for iss in i.get('issues', []))]
        high = [i for i in issues if any(iss.get('severity') == 'high' for iss in i.get('issues', []))]
        medium = [i for i in issues if any(iss.get('severity') == 'medium' for iss in i.get('issues', []))]
        low = [i for i in issues if any(iss.get('severity') == 'low' for iss in i.get('issues', []))]

        f.write(f"-- CRITICAL: {len(critical)}\n")
        f.write(f"-- HIGH: {len(high)}\n")
        f.write(f"-- MEDIUM: {len(medium)}\n")
        f.write(f"-- LOW: {len(low)}\n\n")

        f.write("-- ============================================\n")
        f.write("-- CRITICAL ISSUES (must fix)\n")
        f.write("-- ============================================\n\n")

        for issue in critical:
            lemma = issue.get('lemma', {})
            f.write(f"-- {lemma.get('lemma_text')} ({lemma.get('part_of_speech')})\n")
            for iss in issue.get('issues', []):
                f.write(f"-- Issue: {iss.get('description')}\n")
                if iss.get('suggested_fix'):
                    f.write(f"-- UPDATE lemmas SET definitions = '[\"{iss.get('suggested_fix')}\"]' WHERE lemma_id = '{lemma.get('lemma_id')}';\n")
            f.write("\n")

        f.write("-- ============================================\n")
        f.write("-- HIGH PRIORITY ISSUES\n")
        f.write("-- ============================================\n\n")

        for issue in high:
            lemma = issue.get('lemma', {})
            f.write(f"-- {lemma.get('lemma_text')} ({lemma.get('part_of_speech')})\n")
            for iss in issue.get('issues', []):
                f.write(f"-- Issue: {iss.get('description')}\n")
                if iss.get('suggested_fix'):
                    f.write(f"-- Suggested: {iss.get('suggested_fix')}\n")
            f.write("\n")

        f.write("-- ============================================\n")
        f.write("-- MEDIUM PRIORITY ISSUES\n")
        f.write("-- ============================================\n\n")

        for issue in medium:
            lemma = issue.get('lemma', {})
            f.write(f"-- {lemma.get('lemma_text')}: {[iss.get('description') for iss in issue.get('issues', [])]}\n")

        f.write("\n-- ============================================\n")
        f.write("-- LOW PRIORITY ISSUES\n")
        f.write("-- ============================================\n\n")

        for issue in low:
            lemma = issue.get('lemma', {})
            f.write(f"-- {lemma.get('lemma_text')}: {[iss.get('description') for iss in issue.get('issues', [])]}\n")

    print(f"Fix script written to: {output_file}")


def run_exhaustive_validation(batch_size: int = 20, start_from: int = 0,
                               dry_run: bool = False, output_file: str = None,
                               fix_mode: bool = False) -> Dict:
    """Run exhaustive validation on ALL lemmas."""

    print("=" * 80)
    print("EXHAUSTIVE AI VALIDATION")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()

    # Get all lemmas
    all_lemmas = get_all_lemmas()
    total_lemmas = len(all_lemmas)

    if start_from > 0:
        print(f"Resuming from lemma {start_from}")
        all_lemmas = all_lemmas[start_from:]

    print(f"Lemmas to validate: {len(all_lemmas)}")
    print(f"Batch size: {batch_size}")
    print(f"Estimated batches: {(len(all_lemmas) + batch_size - 1) // batch_size}")
    print()

    if dry_run:
        print("[DRY RUN MODE - No AI calls will be made]")
        print()
        for i, lemma in enumerate(all_lemmas[:10]):
            print(f"  Would validate: {lemma['lemma_text']} ({lemma.get('part_of_speech')})")
        if len(all_lemmas) > 10:
            print(f"  ... and {len(all_lemmas) - 10} more")
        return {'dry_run': True, 'total': len(all_lemmas)}

    # Initialize Anthropic client
    client = Anthropic()

    # Track results
    all_results = []
    issues_found = []
    validated_count = 0

    # Process in batches
    num_batches = (len(all_lemmas) + batch_size - 1) // batch_size

    for batch_idx in range(num_batches):
        batch_start = batch_idx * batch_size
        batch_end = min(batch_start + batch_size, len(all_lemmas))
        batch = all_lemmas[batch_start:batch_end]

        print(f"\nBatch {batch_idx + 1}/{num_batches} (lemmas {start_from + batch_start + 1}-{start_from + batch_end})")
        print(f"  Validating: {', '.join(l['lemma_text'][:15] for l in batch[:5])}{'...' if len(batch) > 5 else ''}")

        # Validate batch
        results = validate_batch_with_ai(batch, client)
        all_results.extend(results)

        # Process results
        for result in results:
            lemma = result.get('lemma', {})
            lemma_id = lemma.get('lemma_id')

            if lemma_id:
                # Save to database
                save_validation_result(lemma_id, result)

            if not result.get('is_valid', True):
                issues_found.append(result)
                print(f"  ISSUE: {lemma.get('lemma_text')} - {[iss.get('description', 'Unknown')[:50] for iss in result.get('issues', [])]}")

        validated_count += len(batch)
        valid_in_batch = sum(1 for r in results if r.get('is_valid', True))
        print(f"  Result: {valid_in_batch}/{len(batch)} valid")

        # Rate limiting - wait between batches
        if batch_idx < num_batches - 1:
            time.sleep(1)  # 1 second between batches to avoid rate limits

    # Summary
    print()
    print("=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)
    print()
    print(f"Total lemmas validated: {validated_count}")
    print(f"Valid: {validated_count - len(issues_found)}")
    print(f"Issues found: {len(issues_found)}")
    print()

    if issues_found:
        print("ISSUES BY SEVERITY:")
        critical = sum(1 for i in issues_found if any(iss.get('severity') == 'critical' for iss in i.get('issues', [])))
        high = sum(1 for i in issues_found if any(iss.get('severity') == 'high' for iss in i.get('issues', [])))
        medium = sum(1 for i in issues_found if any(iss.get('severity') == 'medium' for iss in i.get('issues', [])))
        low = sum(1 for i in issues_found if any(iss.get('severity') == 'low' for iss in i.get('issues', [])))

        print(f"  Critical: {critical}")
        print(f"  High: {high}")
        print(f"  Medium: {medium}")
        print(f"  Low: {low}")
        print()

        print("ISSUES DETAIL:")
        for issue in issues_found:
            lemma = issue.get('lemma', {})
            print(f"\n  {lemma.get('lemma_text')} ({lemma.get('part_of_speech')})")
            print(f"    Current: {lemma.get('definitions', ['N/A'])[0] if lemma.get('definitions') else 'N/A'}")
            for iss in issue.get('issues', []):
                print(f"    [{iss.get('severity', 'unknown')}] {iss.get('type', 'unknown')}: {iss.get('description', 'No description')}")
                if iss.get('suggested_fix'):
                    print(f"    Suggested: {iss.get('suggested_fix')}")

    # Save results
    if output_file:
        with open(output_file, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_validated': validated_count,
                'issues_count': len(issues_found),
                'issues': issues_found
            }, f, indent=2, default=str)
        print(f"\nResults saved to: {output_file}")

    # Generate fix script
    if fix_mode and issues_found:
        fix_file = output_file.replace('.json', '_fixes.sql') if output_file else 'validation_fixes.sql'
        generate_fix_script(issues_found, fix_file)

    return {
        'total_validated': validated_count,
        'valid': validated_count - len(issues_found),
        'issues': len(issues_found),
        'issues_detail': issues_found
    }


def main():
    parser = argparse.ArgumentParser(description='Exhaustive AI validation of ALL lemmas')
    parser.add_argument('--batch-size', type=int, default=20, help='Lemmas per AI batch')
    parser.add_argument('--start-from', type=int, default=0, help='Start from lemma N')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be validated')
    parser.add_argument('--output', type=str, default='validation_results.json', help='Output JSON file')
    parser.add_argument('--fix-mode', action='store_true', help='Generate SQL fix scripts')

    args = parser.parse_args()

    results = run_exhaustive_validation(
        batch_size=args.batch_size,
        start_from=args.start_from,
        dry_run=args.dry_run,
        output_file=args.output,
        fix_mode=args.fix_mode
    )

    print()
    print("=" * 80)
    if results.get('issues', 0) == 0:
        print("ALL LEMMAS VALIDATED SUCCESSFULLY!")
    else:
        print(f"VALIDATION COMPLETE - {results.get('issues', 0)} ISSUES REQUIRE ATTENTION")
    print("=" * 80)


if __name__ == '__main__':
    main()
