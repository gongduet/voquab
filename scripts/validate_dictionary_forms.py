#!/usr/bin/env python3
"""
Validate that all lemmas are in their canonical dictionary form.

This script uses Claude AI to check each lemma and identify:
1. Conjugated verb forms that should be infinitives
2. Adjective/noun variants that should be singular/masculine
3. Misspelled or garbage lemmas
4. Duplicate lemmas with the same meaning

For each issue found, it suggests the correct canonical form.
"""

import os
import sys
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import anthropic

# Load environment
load_dotenv()

# Initialize clients
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)
claude = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

BATCH_SIZE = 30  # Lemmas per API call


def get_all_lemmas():
    """Fetch all lemmas with pagination."""
    all_lemmas = []
    offset = 0
    while True:
        batch = db.table('lemmas').select('*').range(offset, offset + 999).execute()
        all_lemmas.extend(batch.data)
        if len(batch.data) < 1000:
            break
        offset += 1000
    return all_lemmas


def validate_batch_with_ai(lemmas_batch):
    """Use Claude to validate a batch of lemmas for dictionary form correctness."""

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
- VERBS: Always listed as infinitives ending in -ar, -er, or -ir (NOT conjugations like "compro", "hablas", "duermen")
- ADJECTIVES: Listed as masculine singular (bueno, not buena/buenos/buenas)
- NOUNS: Listed as singular (perro, not perros). With appropriate article (el/la).
- NUMBERS: Cardinal forms (ciento, not cien which is apocopated)

Also identify:
- GARBAGE: Misspelled words that don't exist in Spanish (like "llevarter", "trabajer")
- DUPLICATES: Multiple lemmas that should be merged (same meaning, one is a variant)

LEMMAS TO VALIDATE:
{lemmas_text}

Return a JSON array with objects for ONLY problematic lemmas. Skip lemmas that are correct.
Each object should have:
- "lemma": the problematic lemma text
- "issue_type": one of "conjugation", "variant", "garbage", "duplicate", "misspelling"
- "canonical_form": the correct dictionary form (null if garbage/should delete)
- "explanation": brief explanation
- "confidence": 0-100

Example response:
[
  {{"lemma": "compran", "issue_type": "conjugation", "canonical_form": "comprar", "explanation": "conjugated form (3rd person plural present) of comprar", "confidence": 99}},
  {{"lemma": "llevarter", "issue_type": "garbage", "canonical_form": null, "explanation": "not a Spanish word, likely OCR/processing error", "confidence": 95}},
  {{"lemma": "buenas", "issue_type": "variant", "canonical_form": "bueno", "explanation": "feminine plural of bueno, should merge", "confidence": 98}}
]

If ALL lemmas in this batch are correct dictionary forms, return an empty array: []

Respond with ONLY the JSON array, no other text."""

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse the response
        response_text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])

        issues = json.loads(response_text)
        return issues

    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e}")
        print(f"  Response: {response_text[:500]}")
        return []
    except Exception as e:
        print(f"  API error: {e}")
        return []


def run_validation(output_file=None, dry_run=True):
    """Run dictionary form validation on all lemmas."""
    print("=" * 80)
    print("DICTIONARY FORM VALIDATION")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    if dry_run:
        print("\n*** DRY RUN MODE - Identifying issues only ***")

    # Get all lemmas
    print("\nFetching lemmas...")
    all_lemmas = get_all_lemmas()
    print(f"Total lemmas: {len(all_lemmas)}")

    # Build lookup for finding canonical forms
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    all_issues = []

    # Process in batches
    total_batches = (len(all_lemmas) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(all_lemmas), BATCH_SIZE):
        batch = all_lemmas[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1

        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} lemmas)...", end=" ", flush=True)

        issues = validate_batch_with_ai(batch)

        if issues:
            print(f"Found {len(issues)} issues")
            for issue in issues:
                # Enrich with additional info
                lemma_text = issue.get('lemma')
                if lemma_text and lemma_text in lemma_lookup:
                    issue['lemma_id'] = lemma_lookup[lemma_text]['lemma_id']

                    # Check if canonical form exists
                    canonical = issue.get('canonical_form')
                    if canonical and canonical in lemma_lookup:
                        issue['canonical_exists'] = True
                        issue['canonical_id'] = lemma_lookup[canonical]['lemma_id']
                    else:
                        issue['canonical_exists'] = False

                all_issues.append(issue)
        else:
            print("OK")

        # Rate limiting
        time.sleep(0.5)

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    # Categorize issues
    by_type = {}
    for issue in all_issues:
        issue_type = issue.get('issue_type', 'unknown')
        if issue_type not in by_type:
            by_type[issue_type] = []
        by_type[issue_type].append(issue)

    print(f"\nTotal issues found: {len(all_issues)}")
    for issue_type, issues in sorted(by_type.items()):
        print(f"  {issue_type}: {len(issues)}")

    # Show details by category
    for issue_type, issues in sorted(by_type.items()):
        print(f"\n{'='*80}")
        print(f"{issue_type.upper()} ({len(issues)})")
        print("=" * 80)

        for issue in sorted(issues, key=lambda x: x.get('lemma', '')):
            canonical = issue.get('canonical_form', 'DELETE')
            exists_marker = "✓" if issue.get('canonical_exists') else "NEW"
            confidence = issue.get('confidence', 0)

            if canonical:
                print(f"  {issue['lemma']} → {canonical} [{exists_marker}] ({confidence}%)")
            else:
                print(f"  {issue['lemma']} → DELETE ({confidence}%)")
            print(f"    {issue.get('explanation', '')}")

    # Save results
    if output_file:
        with open(output_file, 'w') as f:
            json.dump({
                'generated': datetime.now().isoformat(),
                'total_lemmas': len(all_lemmas),
                'total_issues': len(all_issues),
                'by_type': {k: len(v) for k, v in by_type.items()},
                'issues': all_issues
            }, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to: {output_file}")

    return all_issues


def generate_fix_script(issues, output_file):
    """Generate a Python script to apply fixes."""

    # Categorize fixes
    merges = {}  # canonical -> [duplicates]
    deletes = []
    renames = {}  # old -> new (when canonical doesn't exist)

    for issue in issues:
        lemma = issue.get('lemma')
        canonical = issue.get('canonical_form')
        issue_type = issue.get('issue_type')

        if not lemma:
            continue

        if canonical is None or issue_type == 'garbage':
            deletes.append(lemma)
        elif issue.get('canonical_exists'):
            # Merge into existing canonical
            if canonical not in merges:
                merges[canonical] = []
            merges[canonical].append(lemma)
        else:
            # Rename to canonical (or create new)
            renames[lemma] = canonical

    # Generate script
    script = '''#!/usr/bin/env python3
"""
AUTO-GENERATED: Apply dictionary form fixes.
Generated: {timestamp}

This script merges/deletes/renames lemmas based on AI validation.
Review before running!
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)


def get_lemma(text):
    """Get lemma by text."""
    result = db.table('lemmas').select('*').eq('lemma_text', text).execute()
    return result.data[0] if result.data else None


def merge_to_canonical(canonical_text, duplicates):
    """Merge duplicate lemmas into canonical form."""
    canonical = get_lemma(canonical_text)
    if not canonical:
        print(f"  WARNING: Canonical '{canonical_text}' not found")
        return 0

    merged = 0
    for dup_text in duplicates:
        dup = get_lemma(dup_text)
        if not dup:
            print(f"  {dup_text}: already merged or not found")
            continue

        # Count and reassign words
        words = db.table('words').select('word_id', count='exact').eq('lemma_id', dup['lemma_id']).execute()
        word_count = words.count or 0

        if word_count > 0:
            db.table('words').update({{'lemma_id': canonical['lemma_id']}}).eq('lemma_id', dup['lemma_id']).execute()

        # Delete validation report
        db.table('validation_reports').delete().eq('lemma_id', dup['lemma_id']).execute()

        # Delete duplicate
        db.table('lemmas').delete().eq('lemma_id', dup['lemma_id']).execute()

        print(f"  {dup_text} → {canonical_text} ({word_count} words)")
        merged += 1

    return merged


def delete_garbage(lemma_text):
    """Delete garbage lemma and its words."""
    lemma = get_lemma(lemma_text)
    if not lemma:
        return False

    # Delete words
    db.table('words').delete().eq('lemma_id', lemma['lemma_id']).execute()

    # Delete validation report
    db.table('validation_reports').delete().eq('lemma_id', lemma['lemma_id']).execute()

    # Delete lemma
    db.table('lemmas').delete().eq('lemma_id', lemma['lemma_id']).execute()

    print(f"  DELETED: {lemma_text}")
    return True


def rename_lemma(old_text, new_text):
    """Rename a lemma to its correct form."""
    lemma = get_lemma(old_text)
    if not lemma:
        return False

    # Check if new form exists
    existing = get_lemma(new_text)
    if existing:
        # Merge instead
        return merge_to_canonical(new_text, [old_text])

    # Rename
    db.table('lemmas').update({{'lemma_text': new_text}}).eq('lemma_id', lemma['lemma_id']).execute()
    print(f"  RENAMED: {old_text} → {new_text}")
    return True


def main():
    print("=" * 80)
    print("APPLYING DICTIONARY FORM FIXES")
    print("=" * 80)

    total_merged = 0
    total_deleted = 0
    total_renamed = 0

'''.format(timestamp=datetime.now().isoformat())

    # Add merge operations
    if merges:
        script += "    # MERGES\n"
        script += "    print('\\nMERGING DUPLICATES...')\n"
        for canonical, dups in sorted(merges.items()):
            dups_str = str(dups)
            script += f"    total_merged += merge_to_canonical('{canonical}', {dups_str})\n"
        script += "\n"

    # Add delete operations
    if deletes:
        script += "    # DELETES\n"
        script += "    print('\\nDELETING GARBAGE LEMMAS...')\n"
        for lemma in sorted(deletes):
            script += f"    if delete_garbage('{lemma}'): total_deleted += 1\n"
        script += "\n"

    # Add rename operations
    if renames:
        script += "    # RENAMES\n"
        script += "    print('\\nRENAMING LEMMAS...')\n"
        for old, new in sorted(renames.items()):
            script += f"    if rename_lemma('{old}', '{new}'): total_renamed += 1\n"
        script += "\n"

    script += '''
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Merged: {total_merged}")
    print(f"  Deleted: {total_deleted}")
    print(f"  Renamed: {total_renamed}")
    print(f"  TOTAL: {total_merged + total_deleted + total_renamed}")


if __name__ == '__main__':
    main()
'''

    with open(output_file, 'w') as f:
        f.write(script)

    print(f"\nFix script generated: {output_file}")
    print(f"  Merges: {sum(len(v) for v in merges.values())}")
    print(f"  Deletes: {len(deletes)}")
    print(f"  Renames: {len(renames)}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Validate lemmas are in dictionary form')
    parser.add_argument('--output', '-o', default='dictionary_validation_results.json',
                        help='Output JSON file for results')
    parser.add_argument('--generate-fixes', action='store_true',
                        help='Generate a Python script to apply fixes')
    parser.add_argument('--fix-script', default='apply_dictionary_fixes.py',
                        help='Output file for fix script')

    args = parser.parse_args()

    issues = run_validation(output_file=args.output)

    if args.generate_fixes and issues:
        generate_fix_script(issues, args.fix_script)


if __name__ == '__main__':
    main()
