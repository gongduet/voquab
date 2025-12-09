#!/usr/bin/env python3
"""
Fix validation issues identified by exhaustive AI validation.
This script processes the validation_results.json and applies fixes.
"""

import json
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

# Map of garbage lemmas to canonical forms
GARBAGE_TO_CANONICAL = {
    'abrer': 'abrir',
    'aburrer': 'aburrir',
    'alcancer': 'alcanzar',
    'aplauder': 'aplaudir',
    'apresurir': 'apresurar',
    # arrepinteír and atreveír handled in SPELLING_CORRECTIONS
    'bebierar': 'beber',
    'cabrir': 'caber',
    'caminarir': 'caminar',
    'char': None,  # Delete - not a Spanish word
    'comar': 'comer',
    'comuníquenr': 'comunicar',
    'crir': None,  # Delete
    'cump': 'cumplir',
    'demá': None,  # Delete
    'demar': None,  # Delete
    'deshollinir': 'deshollinar',
    'deténgansar': 'detener',
    'dicer': 'decir',
    'dicerse': 'decir',  # Reflexive form, merge to base verb
    # 'digierar' - handled in SPELLING_CORRECTIONS (digerir doesn't exist)
    'dijistir': 'decir',
    'distir': None,  # Delete
    'domestícamar': 'domesticar',
    'domestícamer': 'domesticar',
    'domestiquser': 'domesticar',
    'dorr': 'dormir',
    # 'ejecutasir' - handled in SPELLING_CORRECTIONS (ejecutar doesn't exist)
    'encer': 'encender',
    'enrojeceír': 'enrojecer',
    # 'gimeír' - handled in SPELLING_CORRECTIONS (gemir doesn't exist)
    'juzgartar': 'juzgar',
    'paseabar': 'pasear',
    'perdóner': 'perdonar',
    # 'persigar', 'persiguer' - handled in SPELLING_CORRECTIONS (perseguir doesn't exist)
    'podrar': 'poder',
    'ponérmelar': None,  # Complex - delete
    'repiter': 'repetir',
    'sentarer': 'sentar',
    'sigar': 'seguir',
    'siguiar': 'seguir',
    'sugierir': 'sugerir',
    'volvir': 'volver',
    'admíramar': 'admirar',
}

# Simple spelling corrections (just update lemma_text)
SPELLING_CORRECTIONS = {
    'déjar': 'dejar',  # Wrong accent
    'paquet': 'paquete',  # Missing letter
    # Misspelled verbs that don't have a canonical form to merge into
    'arrepinteír': 'arrepentir',
    'atreveír': 'atrever',
    'digierar': 'digerir',
    'gimeír': 'gemir',
    'persigar': 'perseguir',
    'persiguer': 'perseguir',
    'ejecutasir': 'ejecutar',
}

# Translation fixes
TRANSLATION_FIXES = {
    'abismar': ['to overwhelm'],
    'aburrir': ['to bore'],
    'acercar': ['to approach'],
    'acordar': ['to agree', 'to remember'],
    'adelantar': ['to advance'],
    'adorar': ['to adore'],
    'al': ['to the'],
    'alegrar': ['to make happy'],
    'amontonar': ['to pile up'],
    'ante': ['before', 'in front of'],
    'antes': ['before'],
    'aparte': ['aside', 'apart'],
    'bajar': ['to go down', 'to lower'],
    'bastar': ['to suffice', 'to be enough'],
    'brillar': ['to shine'],
    'buscar': ['to look for', 'to search'],
    'caber': ['to fit'],
    'callar': ['to be quiet', 'to shut up'],
    'callejear': ['to wander the streets'],
    'cesar': ['to cease', 'to stop'],
    'coger': ['to take', 'to grab'],
    'colorado': ['red', 'reddish'],
    'cometer': ['to commit'],
    'conocer': ['to know', 'to meet'],
    'consiguiente': ['consequent'],
    'consultar': ['to consult'],
    'creer': ['to believe'],
    'desayunar': ['to have breakfast'],
    'descender': ['to descend'],
    'deshollinar': ['to sweep chimneys'],
    'divisar': ['to make out', 'to spot'],
    'domesticar': ['to tame'],
    'dorado': ['golden'],
    'echar': ['to throw', 'to put'],
    'embargo': ['embargo', 'seizure'],
    'emocionar': ['to move', 'to touch'],
    'en': ['in', 'on'],
    'encender': ['to light', 'to turn on'],
    'encoger': ['to shrink'],
    'enrojecer': ['to blush', 'to redden'],
    'enternecer': ['to move', 'to touch'],
    'entre': ['between', 'among'],
    'equivocar': ['to mistake', 'to be wrong'],
    'escurrir': ['to drain', 'to drip'],
    'faltar': ['to lack', 'to be missing'],
    'grande': ['big', 'large'],
    'grandioso': ['grandiose', 'magnificent'],
    'guardar': ['to keep', 'to save'],
}

# POS fixes
POS_FIXES = {
    'adentro': 'ADV',
    'añadí': 'VERB',
    'aquélla': 'PRON',
    'cortésmente': 'ADV',
    'donde': 'ADV',
    'dónde': 'ADV',
    'doscientos': 'NUM',
    'eres': 'VERB',
    'estar': 'VERB',
    'explorador': 'NOUN',
    'farolero': 'NOUN',
    'frente': 'NOUN',
    'gallina': 'NOUN',
    'gobernante': 'NOUN',
}

# Gender fixes for nouns
GENDER_FIXES = {
    'el agua': 'F',  # Uses el for phonetic reasons but is feminine
    'el flor': 'F',  # Should be la flor
    'el manera': 'F',
    'el miel': 'F',
    'el muerte': 'F',
    'el presencia': 'F',
    'el puesta': 'F',
    'el realidad': 'F',
    'el relación': 'F',
    'el rosa': 'F',
    'el casualidad': 'F',
    'el causa': 'F',
    'el cosita': 'F',
    'el dirección': 'F',
    'el duda': 'F',
    'el erupción': 'F',
    'el carroza': 'F',
    'el vez': 'F',
    'el veces': 'F',
}

# Proper noun capitalization fixes
CAPITALIZATION_FIXES = {
    'áfrica': 'África',
    'america': 'América',
    'australia': 'Australia',
    'europa': 'Europa',
    'francia': 'Francia',
    'zelanda': 'Zelanda',
    'dios': 'Dios',
}


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


def fix_garbage_lemmas(dry_run=True):
    """Delete garbage lemmas and reassign their words to canonical lemmas."""
    print("\n" + "="*80)
    print("FIXING GARBAGE LEMMAS")
    print("="*80)

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l['lemma_id'] for l in all_lemmas}

    fixed = 0
    deleted = 0

    for garbage, canonical in GARBAGE_TO_CANONICAL.items():
        if garbage not in lemma_lookup:
            continue

        garbage_id = lemma_lookup[garbage]

        # Count words assigned to this garbage lemma
        words = db.table('words').select('word_id', count='exact').eq('lemma_id', garbage_id).execute()
        word_count = words.count or 0

        if canonical and canonical in lemma_lookup:
            canonical_id = lemma_lookup[canonical]
            print(f"  {garbage} → {canonical} ({word_count} words)")

            if not dry_run:
                # Reassign words to canonical lemma
                if word_count > 0:
                    db.table('words').update({'lemma_id': canonical_id}).eq('lemma_id', garbage_id).execute()

                # Delete validation report for garbage lemma
                db.table('validation_reports').delete().eq('lemma_id', garbage_id).execute()

                # Delete garbage lemma
                db.table('lemmas').delete().eq('lemma_id', garbage_id).execute()

            fixed += 1
        else:
            print(f"  {garbage} → DELETE ({word_count} words will be deleted)")

            if not dry_run:
                # Delete words associated with this garbage lemma
                if word_count > 0:
                    db.table('words').delete().eq('lemma_id', garbage_id).execute()

                # Delete validation report
                db.table('validation_reports').delete().eq('lemma_id', garbage_id).execute()

                # Delete garbage lemma
                db.table('lemmas').delete().eq('lemma_id', garbage_id).execute()

            deleted += 1

    print(f"\n  Total: {fixed} merged, {deleted} deleted")
    return fixed, deleted


def fix_spelling_corrections(dry_run=True):
    """Apply simple spelling corrections to lemma_text. If target exists, merge instead."""
    print("\n" + "="*80)
    print("FIXING SPELLING ERRORS")
    print("="*80)

    fixed = 0
    merged = 0
    for wrong, correct in SPELLING_CORRECTIONS.items():
        # Refresh lemma lookup each iteration to account for deletions/renames
        all_lemmas = get_all_lemmas()
        lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

        if wrong not in lemma_lookup:
            continue

        wrong_lemma = lemma_lookup[wrong]
        wrong_id = wrong_lemma['lemma_id']

        # Check if correct form already exists
        if correct in lemma_lookup:
            # Merge words to the existing correct lemma
            correct_id = lemma_lookup[correct]['lemma_id']
            words = db.table('words').select('word_id', count='exact').eq('lemma_id', wrong_id).execute()
            word_count = words.count or 0
            print(f"  {wrong} → MERGE to {correct} ({word_count} words)")

            if not dry_run:
                # Reassign words to correct lemma
                if word_count > 0:
                    db.table('words').update({'lemma_id': correct_id}).eq('lemma_id', wrong_id).execute()

                # Delete validation report
                db.table('validation_reports').delete().eq('lemma_id', wrong_id).execute()

                # Delete wrong lemma
                db.table('lemmas').delete().eq('lemma_id', wrong_id).execute()

            merged += 1
        else:
            # Simple rename
            print(f"  {wrong} → {correct}")

            if not dry_run:
                db.table('lemmas').update({'lemma_text': correct}).eq('lemma_id', wrong_id).execute()

            fixed += 1

    print(f"\n  Total: {fixed} renamed, {merged} merged")
    return fixed + merged


def fix_translations(dry_run=True):
    """Fix inaccurate translations."""
    print("\n" + "="*80)
    print("FIXING TRANSLATIONS")
    print("="*80)

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    fixed = 0
    for lemma_text, new_defs in TRANSLATION_FIXES.items():
        if lemma_text in lemma_lookup:
            lemma = lemma_lookup[lemma_text]
            old_def = lemma['definitions'][0] if lemma['definitions'] else 'N/A'
            print(f"  {lemma_text}: {old_def} → {new_defs[0]}")

            if not dry_run:
                db.table('lemmas').update({'definitions': new_defs}).eq('lemma_id', lemma['lemma_id']).execute()

            fixed += 1

    print(f"\n  Total: {fixed} fixed")
    return fixed


def fix_pos_tags(dry_run=True):
    """Fix incorrect POS tags."""
    print("\n" + "="*80)
    print("FIXING POS TAGS")
    print("="*80)

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    fixed = 0
    for lemma_text, correct_pos in POS_FIXES.items():
        if lemma_text in lemma_lookup:
            lemma = lemma_lookup[lemma_text]
            old_pos = lemma['part_of_speech']
            if old_pos != correct_pos:
                print(f"  {lemma_text}: {old_pos} → {correct_pos}")

                if not dry_run:
                    db.table('lemmas').update({'part_of_speech': correct_pos}).eq('lemma_id', lemma['lemma_id']).execute()

                fixed += 1

    print(f"\n  Total: {fixed} fixed")
    return fixed


def fix_capitalization(dry_run=True):
    """Fix proper noun capitalization."""
    print("\n" + "="*80)
    print("FIXING CAPITALIZATION")
    print("="*80)

    all_lemmas = get_all_lemmas()
    lemma_lookup = {l['lemma_text']: l for l in all_lemmas}

    fixed = 0
    for wrong, correct in CAPITALIZATION_FIXES.items():
        if wrong in lemma_lookup:
            lemma = lemma_lookup[wrong]
            print(f"  {wrong} → {correct}")

            if not dry_run:
                db.table('lemmas').update({'lemma_text': correct}).eq('lemma_id', lemma['lemma_id']).execute()

            fixed += 1

    print(f"\n  Total: {fixed} fixed")
    return fixed


def main():
    dry_run = '--apply' not in sys.argv

    print("="*80)
    print("VALIDATION ISSUE FIXER")
    print("="*80)

    if dry_run:
        print("\n*** DRY RUN MODE - No changes will be made ***")
        print("    Use --apply to apply changes\n")
    else:
        print("\n*** APPLYING CHANGES ***\n")

    # Run all fixes
    garbage_fixed, garbage_deleted = fix_garbage_lemmas(dry_run)
    spelling_fixed = fix_spelling_corrections(dry_run)
    translation_fixed = fix_translations(dry_run)
    pos_fixed = fix_pos_tags(dry_run)
    cap_fixed = fix_capitalization(dry_run)

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"  Garbage lemmas merged: {garbage_fixed}")
    print(f"  Garbage lemmas deleted: {garbage_deleted}")
    print(f"  Spelling corrections: {spelling_fixed}")
    print(f"  Translation fixes: {translation_fixed}")
    print(f"  POS tag fixes: {pos_fixed}")
    print(f"  Capitalization fixes: {cap_fixed}")
    print(f"\n  TOTAL FIXES: {garbage_fixed + garbage_deleted + spelling_fixed + translation_fixed + pos_fixed + cap_fixed}")

    if dry_run:
        print("\n*** DRY RUN - Use --apply to make changes ***")


if __name__ == '__main__':
    main()
