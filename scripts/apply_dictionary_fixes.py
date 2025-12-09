#!/usr/bin/env python3
"""
Apply dictionary form fixes based on AI validation.

This script fixes:
1. Conjugations - merge conjugated verb forms into infinitives
2. Garbage - delete non-Spanish words and processing errors
3. Variants - merge adjective/noun variants into canonical forms
4. Misspellings - correct or delete misspelled lemmas

Generated from dictionary_validation_results.json
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
db = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)


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


def merge_to_canonical(canonical_text, duplicates, lemma_lookup, stats, dry_run=True):
    """Merge duplicate lemmas into canonical form."""
    if canonical_text not in lemma_lookup:
        print(f"  WARNING: Canonical '{canonical_text}' not found, skipping merge")
        return

    canonical = lemma_lookup[canonical_text]

    for dup_text in duplicates:
        if dup_text not in lemma_lookup:
            continue

        dup = lemma_lookup[dup_text]

        # Count words
        words = db.table('words').select('word_id', count='exact').eq('lemma_id', dup['lemma_id']).execute()
        word_count = words.count or 0

        print(f"  {dup_text} → {canonical_text} ({word_count} words)")

        if not dry_run:
            # Reassign words to canonical lemma
            if word_count > 0:
                db.table('words').update({'lemma_id': canonical['lemma_id']}).eq('lemma_id', dup['lemma_id']).execute()

            # Delete validation report
            db.table('validation_reports').delete().eq('lemma_id', dup['lemma_id']).execute()

            # Delete duplicate lemma
            db.table('lemmas').delete().eq('lemma_id', dup['lemma_id']).execute()

        stats['merged'] += 1
        stats['words_reassigned'] += word_count


def delete_garbage(lemma_text, lemma_lookup, stats, dry_run=True):
    """Delete garbage lemma and its words."""
    if lemma_text not in lemma_lookup:
        return

    lemma = lemma_lookup[lemma_text]

    # Count words
    words = db.table('words').select('word_id', count='exact').eq('lemma_id', lemma['lemma_id']).execute()
    word_count = words.count or 0

    print(f"  DELETE: {lemma_text} ({word_count} words)")

    if not dry_run:
        # Delete words
        if word_count > 0:
            db.table('words').delete().eq('lemma_id', lemma['lemma_id']).execute()

        # Delete validation report
        db.table('validation_reports').delete().eq('lemma_id', lemma['lemma_id']).execute()

        # Delete lemma
        db.table('lemmas').delete().eq('lemma_id', lemma['lemma_id']).execute()

    stats['deleted'] += 1
    stats['words_deleted'] += word_count


def rename_lemma(old_text, new_text, lemma_lookup, stats, dry_run=True):
    """Rename a lemma, merging if target exists."""
    if old_text not in lemma_lookup:
        return

    # Check if new form exists - merge instead of rename
    if new_text in lemma_lookup:
        merge_to_canonical(new_text, [old_text], lemma_lookup, stats, dry_run)
        return

    print(f"  RENAME: {old_text} → {new_text}")

    if not dry_run:
        lemma = lemma_lookup[old_text]
        db.table('lemmas').update({'lemma_text': new_text}).eq('lemma_id', lemma['lemma_id']).execute()

    stats['renamed'] += 1


def main():
    dry_run = '--apply' not in sys.argv

    print("=" * 80)
    print("APPLYING DICTIONARY FORM FIXES")
    print("=" * 80)

    if dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***")
        print("    Use --apply to apply changes\n")
    else:
        print("\n*** APPLYING CHANGES ***\n")

    # Build lemma lookup - refresh for each section
    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}
    print(f"Total lemmas before: {len(all_lemmas)}")

    stats = {
        'merged': 0,
        'deleted': 0,
        'renamed': 0,
        'words_reassigned': 0,
        'words_deleted': 0
    }

    # =========================================================================
    # SECTION 1: Conjugations to merge into infinitives
    # =========================================================================
    print("\n" + "=" * 80)
    print("CONJUGATIONS → INFINITIVES")
    print("=" * 80)

    conjugation_merges = {
        'ayudar': ['ayudarte'],
        'beber': ['bebo'],
        'buscar': ['la busca'],
        'caminar': ['caminarás'],
        'comer': ['la come'],
        'comprar': ['compran'],
        'comprender': ['comprendo', 'el comprenderás'],
        'correr': ['corro'],
        'decir': ['el decir'],
        'dejar': ['dejabas'],
        'descubrir': ['el descubre'],
        'dormir': ['duermen'],
        'encontrar': ['la encontrara', 'el encontrarlo', 'encontrado'],
        'estar': ['el estarás'],
        'haber': ['has', 'haber él', 'haberme'],
        'hacer': ['el hacerte'],
        'ir': ['el vete', 'la va', 'van'],
        'juzgar': ['el juzgarás'],
        'mirar': ['la mire', 'la miró', 'el mira', 'miren'],
        'parecer': ['pareceré'],
        'partir': ['el partir'],
        'poder': ['podrás', 'el podrás'],
        'preguntar': ['pregúntense'],
        'saber': ['sepa', 'sabré'],
        'sentar': ['sentarte', 'sentarás'],
        'ser': ['el es'],
        'venir': ['ven'],
        'ver': ['visto', 'la verte', 'veréis'],
        'visitar': ['visitarlo'],
        'volver': ['volvía'],
    }

    for canonical, dups in conjugation_merges.items():
        # Refresh lookup
        all_lemmas = get_all_lemmas()
        lemma_lookup = {l['lemma_text']: l for l in all_lemmas}
        merge_to_canonical(canonical, dups, lemma_lookup, stats, dry_run)

    # =========================================================================
    # SECTION 2: Garbage lemmas to delete
    # =========================================================================
    print("\n" + "=" * 80)
    print("GARBAGE LEMMAS → DELETE")
    print("=" * 80)

    garbage_lemmas = [
        # English words
        'bridge',
        'indulgent',

        # Processing errors - fake verbs
        'hablarar', 'har', 'hazmer', 'humillarmer', 'irr',
        'llevarter', 'mater', 'metar', 'mir', 'ocaber', 'oer',
        'respondierar', 'respondir', 'ruger', 'servirir', 'simulacer',
        'soporter', 'tendrar', 'toseer', 'tosiar', 'trabajer',
        'traigar', 'tuvierar', 'vayar', 'viesar', 'viesir', 'volviar',

        # Corrupted/incomplete
        'prís', 'pusieram', 'semillo', 'herrumbrós', 'pregunt',

        # Malformed nouns (verb forms incorrectly as nouns)
        'el administro', 'el apaga', 'el ata', 'el atárselo', 'el bajarme',
        'el consiguiente', 'el cuanto', 'el cuatrocienta', 'el cuatrociento',
        'el dame', 'el descans', 'el esperarme', 'el exacto', 'el exigiré',
        'el hacerlo', 'el hum', 'el juiciosamente', 'el ligera', 'el mirarás',
        'el moverme', 'el noveciento', 'el obstante', 'el pasarlo',
        'el perdonármelo', 'el perdóname', 'el siquiera', 'el tal', 'el tan',
        'el te', 'el temo', 'el vas', 'el viste', 'haber yo',

        # Malformed feminine nouns
        'la acaba', 'la amarilla', 'la beb', 'la llevármela', 'la mirarla',
        'la morderte', 'la olerla', 'la oía', 'la parta', 'la poseerla',
        'la vend', 'la volvía',
    ]

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    for garbage in garbage_lemmas:
        delete_garbage(garbage, lemma_lookup, stats, dry_run)

    # =========================================================================
    # SECTION 3: Variants to merge or rename
    # =========================================================================
    print("\n" + "=" * 80)
    print("VARIANTS → CANONICAL FORMS")
    print("=" * 80)

    variant_merges = {
        # Adjective variants to masculine singular
        'alguno': ['alguna'],
        'bello': ['el bello'],
        'encantador': ['la encantadora'],
        'grande': ['gran'],
        'mismo': ['la misma'],
        'tonto': ['la tonta'],
        'tuyo': ['tuya'],
        'vacío': ['la vacía'],

        # Number variants
        'ciento': ['el cien'],

        # Noun variants - fix article
        'el arbusto': ['arbusto'],
        'el vestido': ['vestido'],
        'la boa': ['el boas'],
        'la erupción': ['el erupción'],
        'la gracia': ['el gracias'],
        'la rosa': ['el rosa'],
        'la verdad': ['verdad'],

        # Reflexive verbs to base
        'poner': ['ponerse'],
        'tratar': ['tratarse'],

        # Interrogatives
        'quién': ['quien'],
    }

    for canonical, dups in variant_merges.items():
        all_lemmas = get_all_lemmas()
        lemma_lookup = {l['lemma_text']: l for l in all_lemmas}
        merge_to_canonical(canonical, dups, lemma_lookup, stats, dry_run)

    # =========================================================================
    # SECTION 4: Capitalization fixes for proper nouns
    # =========================================================================
    print("\n" + "=" * 80)
    print("CAPITALIZATION FIXES")
    print("=" * 80)

    capitalization_fixes = {
        'américa': 'América',
        'arizona': 'Arizona',
        'china': 'China',
        'india': 'India',
        'marte': 'Marte',
        'pacífico': 'Pacífico',
        'rusia': 'Rusia',
        'siberia': 'Siberia',
    }

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    for wrong, correct in capitalization_fixes.items():
        rename_lemma(wrong, correct, lemma_lookup, stats, dry_run)

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Lemmas merged: {stats['merged']}")
    print(f"  Lemmas deleted: {stats['deleted']}")
    print(f"  Lemmas renamed: {stats['renamed']}")
    print(f"  Words reassigned: {stats['words_reassigned']}")
    print(f"  Words deleted: {stats['words_deleted']}")
    print(f"  TOTAL FIXES: {stats['merged'] + stats['deleted'] + stats['renamed']}")

    # Final count
    if not dry_run:
        final_lemmas = get_all_lemmas()
        print(f"\n  Lemmas before: {len(all_lemmas)}")
        print(f"  Lemmas after: {len(final_lemmas)}")
        print(f"  Net reduction: {len(all_lemmas) - len(final_lemmas)}")

    if dry_run:
        print("\n*** DRY RUN - Use --apply to make changes ***")


if __name__ == '__main__':
    main()
