#!/usr/bin/env python3
"""
Content Pipeline: Import Chapter Script

Processes raw Spanish chapter text into clean database entries.
Based on /docs/03_CONTENT_PIPELINE.md specification.

Usage:
    python scripts/import_chapter.py --chapter 1 --input data/chapter1.txt
    python scripts/import_chapter.py --chapter 1 --text "Cuando yo tenía..."
    python scripts/import_chapter.py --translate-only  # Just translate untranslated lemmas
    python scripts/import_chapter.py --validate        # Print SQL validation queries
    python scripts/import_chapter.py --validate-ai --chapter 1  # Run AI validation on chapter
    python scripts/import_chapter.py --show-issues --chapter 1  # Show flagged lemmas with AI suggestions

Requirements:
    pip install spacy deepl supabase python-dotenv
    python -m spacy download es_core_news_sm
"""

import os
import re
import sys
import json
import time
import argparse
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

# Lazy imports for optional dependencies
nlp = None
translator = None
supabase = None
anthropic_client = None


def get_nlp():
    """Lazy load spaCy model."""
    global nlp
    if nlp is None:
        import spacy
        try:
            nlp = spacy.load("es_core_news_sm")
        except OSError:
            print("ERROR: spaCy Spanish model not found.")
            print("Install with: python -m spacy download es_core_news_sm")
            sys.exit(1)
    return nlp


def get_translator():
    """Lazy load DeepL translator."""
    global translator
    if translator is None:
        import deepl
        api_key = os.getenv('VITE_DEEPL_API_KEY') or os.getenv('DEEPL_API_KEY')
        if not api_key:
            print("ERROR: DEEPL_API_KEY not found in environment")
            sys.exit(1)
        translator = deepl.Translator(api_key)
    return translator


def get_supabase():
    """Lazy load Supabase client."""
    global supabase
    if supabase is None:
        from supabase import create_client, Client
        url = os.getenv('VITE_SUPABASE_URL')
        # Use service role key for admin operations (bypasses RLS)
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
        if not url or not key:
            print("ERROR: Supabase credentials not found in environment")
            sys.exit(1)
        supabase = create_client(url, key)
    return supabase


def get_anthropic():
    """Lazy load Anthropic client."""
    global anthropic_client
    if anthropic_client is None:
        import anthropic
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            print("ERROR: ANTHROPIC_API_KEY not found in environment")
            sys.exit(1)
        anthropic_client = anthropic.Anthropic(api_key=api_key)
    return anthropic_client


# =============================================================================
# PRIORITY 1: TRANSLATION PREFIX NORMALIZATION
# =============================================================================

def normalize_translation(translation: str, pos: str) -> str:
    """Enforce proper prefixes on all translations."""
    translation = translation.strip().lower()

    if pos == 'VERB':
        # Must start with "to "
        if not translation.startswith('to '):
            translation = f"to {translation}"

    elif pos == 'NOUN':
        # Must start with "the "
        if not translation.startswith('the '):
            translation = f"the {translation}"

    return translation


# =============================================================================
# PRIORITY 2: VERB LEMMATIZATION VALIDATION
# =============================================================================

# Verbs that are inherently reflexive (must have -se suffix)
REFLEXIVE_VERBS = {
    'abstener': 'abstenerse',
    'arrepentir': 'arrepentirse',
    'atrever': 'atreverse',
    'jactar': 'jactarse',
    'quejar': 'quejarse',
    'suicidar': 'suicidarse',
    'apoderar': 'apoderarse',
    'dignar': 'dignarse',
    'adueñar': 'adueñarse',
    'empecinar': 'empecinarse',
    'ufanar': 'ufanarse',
}

# Verbs commonly used reflexively (context-dependent)
COMMONLY_REFLEXIVE = {
    'poner': 'ponerse',      # ponerse = to put on, to become
    'ir': 'irse',            # irse = to leave
    'quedar': 'quedarse',    # quedarse = to stay
    'dormir': 'dormirse',    # dormirse = to fall asleep
    'sentar': 'sentarse',    # sentarse = to sit down
    'levantar': 'levantarse', # levantarse = to get up
    'llamar': 'llamarse',    # llamarse = to be called
    'encontrar': 'encontrarse', # encontrarse = to find oneself
}


def extract_gerund_base(word_form: str) -> Optional[Tuple[str, bool]]:
    """
    Extract infinitive from gerund forms.
    Returns (infinitive, is_reflexive) or None if not a gerund.

    Examples:
    - poniéndome → (poner, True)  # reflexive
    - hablando → (hablar, False)
    - comiendo → (comer, False)
    - poniéndose → (poner, True)
    """
    word = word_form.lower()

    # Words that end in -ando/-iendo but are NOT gerunds
    NOT_GERUNDS = {
        'cuando',      # when (conjunction)
        'bando',       # edict, faction
        'mando',       # command
        'blando',      # soft
        'orlando',     # proper name
        'fernando',    # proper name
        'orlando',     # proper name
        'normando',    # Norman
        'comando',     # command
        'contrabando', # contraband
        'dando',       # actual gerund of dar, but dar is irregular
    }

    if word in NOT_GERUNDS:
        return None

    # Check for reflexive gerund endings: -ándome, -iéndome, -ándose, -iéndose, etc.
    reflexive_endings = ('ándome', 'iéndome', 'ándote', 'iéndote',
                         'ándose', 'iéndose', 'ándonos', 'iéndonos',
                         'ándoos', 'iéndoos', 'ándoles', 'iéndoles')

    for ending in reflexive_endings:
        if word.endswith(ending):
            # Extract base
            if 'ánd' in ending:
                base = word[:-len(ending)]
                return (base + 'ar', True)
            elif 'iénd' in ending:
                base = word[:-len(ending)]
                # Could be -er or -ir verb
                return (base + 'er', True)  # Default to -er, will be corrected if needed

    # Non-reflexive gerunds: -ando, -iendo
    # Must have at least 2 characters before the suffix to be a valid gerund
    # This prevents false matches like "cuando" (when) which isn't a gerund
    if word.endswith('ando') and len(word) > 5:
        base = word[:-4]
        # Check that base is a plausible verb stem (at least 2 chars)
        if len(base) >= 2:
            return (base + 'ar', False)
    elif word.endswith('iendo') and len(word) > 6:
        base = word[:-5]
        if len(base) >= 2:
            return (base + 'er', False)  # Could be -er or -ir
    elif word.endswith('yendo'):  # ir → yendo, leer → leyendo
        return None  # These need special handling

    return None


def validate_verb_lemma(word_form: str, spacy_lemma: str, pos: str) -> str:
    """
    Ensure verbs are infinitives, not conjugations.
    Handles reflexive verbs, gerunds, and common spaCy lemmatization errors.
    """
    if pos != 'VERB':
        return spacy_lemma

    # Clean up the lemma
    lemma = spacy_lemma.lower().strip()
    word = word_form.lower().strip()

    # =========================================================================
    # PATTERN 0a: Known spaCy lemmatization errors (hardcoded fixes)
    # =========================================================================
    LEMMA_CORRECTIONS = {
        # -ir verbs incorrectly lemmatized
        'conocir': 'conocer',
        'parecierar': 'parecer',
        'pareciera': 'parecer',
        # Missing accents
        'oir': 'oír',
        'reir': 'reír',
        # Conjugation forms that slip through
        'rehíce': 'rehacer',
        'rehícer': 'rehacer',
        'píntamir': 'pintar',
        'píntame': 'pintar',
        'imagínense': 'imaginar',
        'haz': 'hacer',
    }

    if lemma in LEMMA_CORRECTIONS:
        return LEMMA_CORRECTIONS[lemma]

    # Also check word form for imperative/conjugated forms mistaken as lemmas
    if word in LEMMA_CORRECTIONS:
        return LEMMA_CORRECTIONS[word]

    # =========================================================================
    # PATTERN 0b: Fix -mir/-ir garbage endings
    # =========================================================================
    # píntamir → pintar (garbage 'mir' suffix)
    if lemma.endswith('mir') and len(lemma) > 4:
        return lemma[:-3] + 'r'

    # =========================================================================
    # PATTERN 0c: Conjugated forms used as lemmas (1st person preterite)
    # =========================================================================
    # These often slip through: viví, miré, saqué, etc.
    PRETERITE_TO_INFINITIVE = {
        'viví': 'vivir',
        'miré': 'mirar',
        'saqué': 'sacar',
        'logré': 'lograr',
        'dibujé': 'dibujar',
        'recordé': 'recordar',
        'quedé': 'quedar',
        'crees': 'creer',
        'quieres': 'querer',
        'ves': 'ver',
        # Chapter 3 additions
        'esforcé': 'esforzar',
    }
    if lemma in PRETERITE_TO_INFINITIVE:
        return PRETERITE_TO_INFINITIVE[lemma]
    if word in PRETERITE_TO_INFINITIVE:
        return PRETERITE_TO_INFINITIVE[word]

    # =========================================================================
    # PATTERN 0: Gerund handling (-ando, -iendo with pronouns)
    # =========================================================================
    gerund_result = extract_gerund_base(word)
    if gerund_result:
        base_infinitive, is_reflexive = gerund_result

        # Check if this is a known reflexive verb
        if base_infinitive in REFLEXIVE_VERBS:
            return REFLEXIVE_VERBS[base_infinitive]
        elif is_reflexive and base_infinitive in COMMONLY_REFLEXIVE:
            return COMMONLY_REFLEXIVE[base_infinitive]
        elif is_reflexive:
            # Generic reflexive: add -se
            return base_infinitive + 'se'
        else:
            return base_infinitive

    # =========================================================================
    # PATTERN 1: Garbage lemmas with "él" or spaces
    # =========================================================================
    if 'él' in lemma or ' ' in lemma:
        # Try to extract base verb
        base = lemma.split()[0]
        # If base still doesn't end in infinitive, try to fix
        if not base.endswith(('ar', 'er', 'ir')):
            # Try common patterns
            if base.endswith('a') or base.endswith('o'):
                base = base[:-1] + 'ar'
            elif base.endswith('e'):
                base = base[:-1] + 'er'
        lemma = base

    # =========================================================================
    # PATTERN 2: Past tense first person singular (é, í endings)
    # =========================================================================
    if lemma.endswith('é') and not lemma.endswith(('qué',)):
        lemma = lemma[:-1] + 'ar'  # abandoné → abandonar
    elif lemma.endswith('í') and len(lemma) > 2:
        lemma = lemma[:-1] + 'ir'  # viví → vivir

    # =========================================================================
    # PATTERN 3: Past tense third person (ó ending)
    # =========================================================================
    if lemma.endswith('ó') and len(lemma) > 2:
        # Could be -ar or -er verb, default to -ar
        lemma = lemma[:-1] + 'ar'

    # =========================================================================
    # PATTERN 4: Check for inherently reflexive verbs
    # =========================================================================
    if lemma in REFLEXIVE_VERBS:
        return REFLEXIVE_VERBS[lemma]

    # =========================================================================
    # PATTERN 5: Already infinitive (-ar, -er, -ir endings)
    # =========================================================================
    if lemma.endswith(('ar', 'er', 'ir', 'ír')):
        return lemma

    # =========================================================================
    # PATTERN 6: Present tense forms
    # =========================================================================
    if lemma.endswith('a') and len(lemma) > 2:
        # Try -ar infinitive
        return lemma[:-1] + 'ar'
    if lemma.endswith('e') and len(lemma) > 2:
        # Try -er infinitive
        return lemma[:-1] + 'er'

    # If unsure, return cleaned lemma but flag for review
    print(f"  WARNING: Verb lemma may be incorrect: {word_form} → {lemma}")
    return lemma


# =============================================================================
# PRIORITY 3: GENDER CORRECTIONS DICTIONARY
# =============================================================================

GENDER_CORRECTIONS = {
    'serpiente': 'F',  # la serpiente (not el)
    'estrella': 'F',   # la estrella (not el)
    'mano': 'F',       # la mano (not el)
    'foto': 'F',       # la foto (not el)
    'moto': 'F',       # la moto (not el)
    'radio': 'F',      # la radio (not el)
    'día': 'M',        # el día (not la)
    'problema': 'M',   # el problema (not la)
    'clima': 'M',      # el clima (not la)
    'idioma': 'M',     # el idioma (not la)
    'sistema': 'M',    # el sistema (not la)
    'tema': 'M',       # el tema (not la)
    'programa': 'M',   # el programa (not la)
    'planeta': 'M',    # el planeta (not la)
    'mapa': 'M',       # el mapa (not la)
    'poeta': 'M',      # el poeta (can be both)
    'agua': 'F',       # el agua but feminine (special case)
    'águila': 'F',     # el águila but feminine
    'arma': 'F',       # el arma but feminine
    'alma': 'F',       # el alma but feminine
    'hambre': 'F',     # el hambre but feminine
    # Chapter 2 additions
    'cosa': 'F',       # la cosa (not el cosa)
    'sorpresa': 'F',   # la sorpresa (not el sorpresa)
    'sed': 'F',        # la sed (not el sed)
    'boa': 'F',        # la boa
    'balsa': 'F',      # la balsa
    'vocecita': 'F',   # la vocecita
    'arena': 'F',      # la arena
    'avería': 'F',     # la avería
    'reparación': 'F', # la reparación
    'aparición': 'F',  # la aparición
    'admiración': 'F', # la admiración
    'indulgencia': 'F',# la indulgencia
    'paciencia': 'F',  # la paciencia
}

# Words that use "el" despite being feminine (phonetic rule: stressed 'a')
FEMININE_WITH_EL = {'agua', 'águila', 'arma', 'alma', 'hambre', 'área', 'aula'}

# Pronouns and determiners that should NOT be treated as nouns
PRONOUNS_NOT_NOUNS = {
    'conmigo', 'contigo', 'consigo',  # prepositional pronouns
    'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
    'mío', 'mía', 'míos', 'mías',  # possessive pronouns
    'tuyo', 'tuya', 'tuyos', 'tuyas',
    'suyo', 'suya', 'suyos', 'suyas',
    'nuestro', 'nuestra', 'nuestros', 'nuestras',
    'esto', 'eso', 'aquello',  # demonstrative pronouns
    'algo', 'nada', 'alguien', 'nadie',
}


def get_correct_gender(lemma_base: str, spacy_gender: Optional[str]) -> Optional[str]:
    """Use dictionary corrections, fallback to spaCy."""
    # Extract base word without article
    base = lemma_base.lower().strip()

    if base in GENDER_CORRECTIONS:
        return GENDER_CORRECTIONS[base]

    # Map spaCy gender values
    if spacy_gender in ('Masc', 'M'):
        return 'M'
    elif spacy_gender in ('Fem', 'F'):
        return 'F'

    return None


# =============================================================================
# STOP WORDS AND CONJUNCTION VARIANTS
# =============================================================================

# Conjunction variants (phonetic variants of common conjunctions)
# 'e' is used instead of 'y' before words starting with 'i' or 'hi' sound
# 'u' is used instead of 'o' before words starting with 'o' or 'ho' sound
CONJUNCTION_VARIANTS = {
    'e': 'y',   # e invariablemente = y invariablemente (before 'i' sounds)
    'u': 'o',   # siete u ocho = siete o ocho (before 'o' sounds)
}

STOP_WORDS = {
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se',
    'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al',
    'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este',
    'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre',
    'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde',
    'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra',
    'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'u', 'esto', 'mí',
    'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras',
    'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes',
    'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas',
    'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti',
    'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras',
    'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos',
    'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro', 'nuestra',
    'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras',
    'esos', 'esas', 'estoy', 'estás', 'está', 'estamos', 'estáis',
    'están', 'esté', 'estés', 'estemos', 'estéis', 'estén',
    'estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán',
    'estaría', 'estarías', 'estaríamos', 'estaríais', 'estarían',
    'estaba', 'estabas', 'estábamos', 'estabais', 'estaban',
    'estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron',
    'estuviera', 'estuvieras', 'estuviéramos', 'estuvierais', 'estuvieran',
    'estuviese', 'estuvieses', 'estuviésemos', 'estuvieseis', 'estuviesen',
    'estando', 'estado', 'estada', 'estados', 'estadas', 'estad',
    'he', 'has', 'ha', 'hemos', 'habéis', 'han', 'haya', 'hayas',
    'hayamos', 'hayáis', 'hayan', 'habré', 'habrás', 'habrá',
    'habremos', 'habréis', 'habrán', 'habría', 'habrías', 'habríamos',
    'habríais', 'habrían', 'había', 'habías', 'habíamos', 'habíais',
    'habían', 'hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis',
    'hubieron', 'hubiera', 'hubieras', 'hubiéramos', 'hubierais',
    'hubieran', 'hubiese', 'hubieses', 'hubiésemos', 'hubieseis',
    'hubiesen', 'habiendo', 'habido', 'habida', 'habidos', 'habidas',
    'soy', 'eres', 'es', 'somos', 'sois', 'son', 'sea', 'seas',
    'seamos', 'seáis', 'sean', 'seré', 'serás', 'será', 'seremos',
    'seréis', 'serán', 'sería', 'serías', 'seríamos', 'seríais',
    'serían', 'era', 'eras', 'éramos', 'erais', 'eran', 'fui',
    'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron', 'fuera',
    'fueras', 'fuéramos', 'fuerais', 'fueran', 'fuese', 'fueses',
    'fuésemos', 'fueseis', 'fuesen', 'siendo', 'sido',
    'tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen',
    'tenga', 'tengas', 'tengamos', 'tengáis', 'tengan', 'tendré',
    'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán',
    'tendría', 'tendrías', 'tendríamos', 'tendríais', 'tendrían',
    'tenía', 'tenías', 'teníamos', 'teníais', 'tenían', 'tuve',
    'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron', 'tuviera',
    'tuvieras', 'tuviéramos', 'tuvierais', 'tuvieran', 'tuviese',
    'tuvieses', 'tuviésemos', 'tuvieseis', 'tuviesen', 'teniendo',
    'tenido', 'tenida', 'tenidos', 'tenidas', 'tened',
}


# =============================================================================
# GARBAGE DETECTION
# =============================================================================

def is_garbage_lemma(lemma_text: str, word_form: str) -> Tuple[bool, str]:
    """
    Detect garbage/invalid lemmas that should be skipped or deleted.
    Returns (is_garbage, reason).

    Patterns detected:
    - 'l' suffix typos (hablarl, comerl)
    - Pure punctuation
    - Single character (except valid ones)
    - Numbers only
    - Mixed language garbage
    """
    lemma = lemma_text.lower().strip()
    word = word_form.lower().strip()

    # Pattern 1: 'l' suffix typos (common OCR/tokenization error)
    # e.g., "hablarl" instead of "hablar"
    if lemma.endswith('rl') or lemma.endswith('rl '):
        return (True, f"'l' suffix typo: {lemma}")

    # Pattern 2: Lemma ends with 'l' that wasn't in original word
    # e.g., word="hablar" but lemma="hablarl" (extra 'l' added)
    if lemma.endswith('l') and not word.endswith('l'):
        if lemma[:-1] == word or lemma[:-1] + 'r' in word:
            return (True, f"Extra 'l' suffix: {lemma}")

    # Pattern 3: Pure punctuation or symbols
    if all(c in '.,;:!?¿¡-–—\'\"()[]{}«»…' for c in lemma):
        return (True, f"Pure punctuation: {lemma}")

    # Pattern 4: Single character (except valid Spanish words)
    valid_single = {'a', 'e', 'o', 'u', 'y'}  # Conjunctions/prepositions
    if len(lemma) == 1 and lemma not in valid_single:
        return (True, f"Invalid single character: {lemma}")

    # Pattern 5: Numbers only
    if lemma.isdigit():
        return (True, f"Number only: {lemma}")

    # Pattern 6: Contains weird character combinations
    if 'rl' in lemma and 'rl' not in word:
        return (True, f"Suspicious 'rl' in lemma: {lemma}")

    # Pattern 7: Starts with article but has garbage after
    if lemma.startswith(('el ', 'la ')) and len(lemma) > 4:
        base = lemma[3:]
        if base.endswith('l') and not word.endswith('l'):
            return (True, f"Article + garbage: {lemma}")

    return (False, "")


def is_stop_word(lemma_text: str) -> bool:
    """Check if lemma is a common stop word."""
    # Remove article if noun
    clean_text = lemma_text.replace('el ', '').replace('la ', '')
    return clean_text.lower() in STOP_WORDS


# =============================================================================
# STEP 2: SPLIT INTO SENTENCES
# =============================================================================

def split_into_sentences(chapter_text: str) -> List[str]:
    """
    Split Spanish text into sentences.
    Handles Spanish punctuation: ., !, ?, and inverted marks.
    """
    # Remove excessive whitespace
    text = ' '.join(chapter_text.split())

    # Spanish sentence enders: . ! ? followed by space and capital/inverted punctuation
    pattern = r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"])'
    sentences = re.split(pattern, text)

    # Clean and filter
    sentences = [s.strip() for s in sentences if s.strip()]

    return sentences


# =============================================================================
# STEP 3: TOKENIZE + LEMMATIZE (SPACY)
# =============================================================================

def normalize_noun_lemma(lemma_text: str, gender: Optional[str]) -> Tuple[str, str]:
    """
    Add article prefix to noun lemmas based on corrected gender.
    Returns (normalized_lemma, corrected_gender)

    Special handling:
    - Feminine words with stressed 'a' use "el" (el agua, el hambre) but remain feminine
    - Pronouns should not be treated as nouns (conmigo, mío, etc.)
    """
    # Get base word (without any existing article)
    base = lemma_text.lower().strip()
    if base.startswith(('el ', 'la ', 'los ', 'las ')):
        base = base.split(' ', 1)[1]

    # Check if this is actually a pronoun (shouldn't be a noun)
    if base in PRONOUNS_NOT_NOUNS:
        # Return without article - this will be handled by POS correction
        return base, None

    # Get corrected gender
    corrected_gender = get_correct_gender(base, gender)

    # Apply correct article with special handling for feminine + stressed 'a'
    if corrected_gender == 'F':
        if base in FEMININE_WITH_EL:
            # Feminine words that use "el" (phonetic rule)
            return f"el {base}", 'F'
        else:
            return f"la {base}", 'F'
    else:
        # Default to masculine
        return f"el {base}", corrected_gender or 'M'


def process_sentence(sentence_text: str) -> List[Dict]:
    """
    Tokenize sentence and extract lemmas + POS tags.
    Returns list of word data dictionaries.
    Filters out garbage lemmas during processing.
    """
    nlp = get_nlp()
    doc = nlp(sentence_text)

    words = []
    position = 0
    garbage_count = 0

    for token in doc:
        # Skip punctuation and whitespace
        if token.is_punct or token.is_space:
            continue

        position += 1

        # Extract grammatical information
        grammatical_info = {}

        if token.morph.get('Tense'):
            grammatical_info['tense'] = token.morph.get('Tense')[0]
        if token.morph.get('Person'):
            grammatical_info['person'] = token.morph.get('Person')[0]
        if token.morph.get('Number'):
            grammatical_info['number'] = token.morph.get('Number')[0]
        if token.morph.get('Gender'):
            grammatical_info['gender'] = token.morph.get('Gender')[0]
        if token.morph.get('Mood'):
            grammatical_info['mood'] = token.morph.get('Mood')[0]

        # Get base lemma from spaCy
        lemma_text = token.lemma_.lower()
        pos = token.pos_
        gender = None
        word_lower = token.text.lower()

        # =====================================================================
        # POS CORRECTION: Fix common spaCy misclassifications
        # =====================================================================

        # Pattern 1: Conjugated verbs tagged as ADJ or PROPN
        VERB_FORMS_MISCLASSIFIED = {
            'logré', 'miré', 'saqué', 'viví', 'dibujé', 'recordé', 'quedé',
            'crees', 'quieres', 'ves', 'imagínense', 'píntame', 'rehíce',
        }
        if word_lower in VERB_FORMS_MISCLASSIFIED or lemma_text in VERB_FORMS_MISCLASSIFIED:
            pos = 'VERB'

        # Pattern 2: ADJ that should be ADV
        ADVERBS_TAGGED_AS_ADJ = {'adentro', 'afuera', 'arriba', 'abajo', 'adelante', 'atrás'}
        if word_lower in ADVERBS_TAGGED_AS_ADJ:
            pos = 'ADV'
            lemma_text = word_lower  # Adverbs don't need normalization

        # Pattern 3: Nouns tagged as PROPN (not proper nouns)
        NOUNS_TAGGED_AS_PROPN = {
            'balsa', 'elefante', 'boa', 'cordero', 'carnero', 'sáhara',
        }
        if word_lower in NOUNS_TAGGED_AS_PROPN or lemma_text in NOUNS_TAGGED_AS_PROPN:
            if word_lower != 'sáhara':  # Keep Sáhara as PROPN
                pos = 'NOUN'

        # Pattern 4: Interjections mislabeled
        INTERJECTIONS = {'eh', 'ah', 'oh', 'ay', 'uy'}
        if word_lower in INTERJECTIONS:
            pos = 'INTJ'
            lemma_text = word_lower

        # Check for gerund forms FIRST (before POS-based normalization)
        # spaCy sometimes mis-tags gerunds as PROPN or other POS
        gerund_result = extract_gerund_base(token.text)
        if gerund_result:
            base_infinitive, is_reflexive = gerund_result
            # Override spaCy's lemma and POS
            if base_infinitive in REFLEXIVE_VERBS:
                lemma_text = REFLEXIVE_VERBS[base_infinitive]
            elif is_reflexive and base_infinitive in COMMONLY_REFLEXIVE:
                lemma_text = COMMONLY_REFLEXIVE[base_infinitive]
            elif is_reflexive:
                lemma_text = base_infinitive + 'se'
            else:
                lemma_text = base_infinitive
            pos = 'VERB'  # Correct the POS tag
            print(f"    Fixed gerund: '{token.text}' → '{lemma_text}' (VERB)")

        # Normalize lemma based on POS with validation
        elif pos == 'NOUN':
            spacy_gender = grammatical_info.get('gender')
            lemma_text, gender = normalize_noun_lemma(lemma_text, spacy_gender)
        elif pos == 'VERB':
            # Validate and fix verb lemma
            lemma_text = validate_verb_lemma(token.text, lemma_text, pos)

        # Check for garbage lemmas AFTER normalization
        is_garbage, garbage_reason = is_garbage_lemma(lemma_text, token.text)
        if is_garbage:
            garbage_count += 1
            print(f"    SKIPPED garbage: '{token.text}' → '{lemma_text}' ({garbage_reason})")
            continue  # Skip this word entirely

        word_data = {
            'word_text': token.text,
            'lemma_text': lemma_text,
            'pos': pos,
            'word_position': position,
            'grammatical_info': grammatical_info,
            'gender': gender  # Store corrected gender
        }

        words.append(word_data)

    if garbage_count > 0:
        print(f"    Filtered out {garbage_count} garbage lemmas")

    return words


# =============================================================================
# STEP 4: GET OR CREATE LEMMAS
# =============================================================================

def get_or_create_lemma(lemma_text: str, pos: str, gender: Optional[str] = None, language_code: str = 'es') -> str:
    """
    Get existing lemma or create new one.
    Returns lemma_id.
    """
    db = get_supabase()

    # Check if lemma exists
    result = db.table('lemmas').select('lemma_id').eq(
        'lemma_text', lemma_text
    ).eq(
        'language_code', language_code
    ).execute()

    if result.data:
        return result.data[0]['lemma_id']

    # Determine gender for nouns
    final_gender = None
    if pos == 'NOUN':
        if gender:
            final_gender = gender
        elif lemma_text.startswith('el '):
            final_gender = 'M'
        elif lemma_text.startswith('la '):
            final_gender = 'F'

    stop_word = is_stop_word(lemma_text)

    new_lemma = db.table('lemmas').insert({
        'lemma_text': lemma_text,
        'language_code': language_code,
        'part_of_speech': pos,
        'gender': final_gender,
        'definitions': [],  # Empty - will translate later
        'is_stop_word': stop_word
    }).execute()

    return new_lemma.data[0]['lemma_id']


# =============================================================================
# STEP 5: INSERT WORD INSTANCES
# =============================================================================

def insert_word(word_data: Dict, sentence_id: str, chapter_id: str, book_id: str, lemma_id: str) -> str:
    """Insert word instance into database."""
    db = get_supabase()

    result = db.table('words').insert({
        'word_text': word_data['word_text'],
        'lemma_id': lemma_id,
        'sentence_id': sentence_id,
        'chapter_id': chapter_id,
        'book_id': book_id,
        'word_position': word_data['word_position'],
        'grammatical_info': word_data['grammatical_info']
    }).execute()

    return result.data[0]['word_id']


# =============================================================================
# PRIORITY 4: TRANSLATE LEMMAS WITH CONTEXT
# =============================================================================

def translate_lemma_with_context(lemma_text: str, pos: str, example_sentence: Optional[str] = None) -> str:
    """
    Translate Spanish lemma to English with sentence context for better accuracy.
    Always applies normalize_translation for proper prefixes.
    """
    trans = get_translator()

    # Remove article for translation (DeepL handles it better)
    text_to_translate = lemma_text
    if lemma_text.startswith(('el ', 'la ')):
        text_to_translate = lemma_text[3:]

    try:
        # DeepL context parameter for better translation
        if example_sentence and pos in ['VERB', 'NOUN']:
            result = trans.translate_text(
                text_to_translate,
                source_lang="ES",
                target_lang="EN-US",
                context=example_sentence
            )
        else:
            result = trans.translate_text(
                text_to_translate,
                source_lang="ES",
                target_lang="EN-US"
            )

        translation = result.text
    except Exception as e:
        print(f"  Translation error for '{lemma_text}': {e}")
        translation = text_to_translate

    # ALWAYS apply prefix normalization
    translation = normalize_translation(translation, pos)

    return translation


def batch_translate_lemmas(limit: int = None, delay: float = 0.1):
    """Translate all lemmas that have empty definitions."""
    db = get_supabase()

    # Get untranslated lemmas
    query = db.table('lemmas').select(
        'lemma_id, lemma_text, part_of_speech'
    ).eq('definitions', [])

    if limit:
        query = query.limit(limit)

    result = query.execute()
    untranslated = result.data

    print(f"\nFound {len(untranslated)} untranslated lemmas")

    translated_count = 0
    error_count = 0

    for i, lemma in enumerate(untranslated):
        try:
            # Get an example sentence for context
            example_result = db.table('words').select(
                'sentence_id'
            ).eq('lemma_id', lemma['lemma_id']).limit(1).execute()

            example_sentence = None
            if example_result.data:
                sent_result = db.table('sentences').select(
                    'sentence_text'
                ).eq('sentence_id', example_result.data[0]['sentence_id']).execute()
                if sent_result.data:
                    example_sentence = sent_result.data[0]['sentence_text']

            # Translate with context and prefix normalization
            translation = translate_lemma_with_context(
                lemma['lemma_text'],
                lemma['part_of_speech'],
                example_sentence
            )

            # Update lemma with definition
            db.table('lemmas').update({
                'definitions': [translation]
            }).eq(
                'lemma_id', lemma['lemma_id']
            ).execute()

            translated_count += 1
            print(f"  [{i+1}/{len(untranslated)}] {lemma['lemma_text']} -> {translation}")

            # Rate limiting
            if delay and i < len(untranslated) - 1:
                time.sleep(delay)

        except Exception as e:
            error_count += 1
            print(f"  [{i+1}/{len(untranslated)}] ERROR: {lemma['lemma_text']} - {e}")
            continue

    print(f"\nTranslation complete: {translated_count} translated, {error_count} errors")
    return translated_count, error_count


# =============================================================================
# STEP 7: TRANSLATE SENTENCES (DEEPL)
# =============================================================================

def translate_sentence(sentence_text: str) -> str:
    """Translate Spanish sentence to English."""
    trans = get_translator()

    result = trans.translate_text(
        sentence_text,
        source_lang="ES",
        target_lang="EN-US"
    )

    return result.text


def batch_translate_sentences(chapter_id: str = None, delay: float = 0.1):
    """Translate all sentences without translations."""
    db = get_supabase()

    # Get untranslated sentences
    query = db.table('sentences').select(
        'sentence_id, sentence_text'
    ).is_('sentence_translation', 'null')

    if chapter_id:
        query = query.eq('chapter_id', chapter_id)

    result = query.execute()
    untranslated = result.data

    print(f"\nFound {len(untranslated)} untranslated sentences")

    translated_count = 0

    for i, sentence in enumerate(untranslated):
        try:
            translation = translate_sentence(sentence['sentence_text'])

            db.table('sentences').update({
                'sentence_translation': translation
            }).eq(
                'sentence_id', sentence['sentence_id']
            ).execute()

            translated_count += 1
            print(f"  [{i+1}/{len(untranslated)}] Translated sentence")

            if delay and i < len(untranslated) - 1:
                time.sleep(delay)

        except Exception as e:
            print(f"  [{i+1}/{len(untranslated)}] ERROR: {e}")
            continue

    print(f"\nSentence translation complete: {translated_count} translated")
    return translated_count


# =============================================================================
# MAIN PROCESSING
# =============================================================================

def get_book_id(book_title: str = "El Principito") -> str:
    """Get book ID, create if doesn't exist."""
    db = get_supabase()

    result = db.table('books').select('book_id').eq(
        'title', book_title
    ).execute()

    if result.data:
        return result.data[0]['book_id']

    # Create book
    new_book = db.table('books').insert({
        'title': book_title,
        'author': 'Antoine de Saint-Exupery',
        'language_code': 'es',
        'total_chapters': 27,
        'total_sentences': 0
    }).execute()

    return new_book.data[0]['book_id']


def get_or_create_chapter(book_id: str, chapter_number: int, sentence_count: int) -> str:
    """Get or create chapter record."""
    db = get_supabase()

    result = db.table('chapters').select('chapter_id').eq(
        'book_id', book_id
    ).eq(
        'chapter_number', chapter_number
    ).execute()

    if result.data:
        # Update sentence count
        db.table('chapters').update({
            'total_sentences_in_chapter': sentence_count
        }).eq('chapter_id', result.data[0]['chapter_id']).execute()
        return result.data[0]['chapter_id']

    # Create chapter
    new_chapter = db.table('chapters').insert({
        'book_id': book_id,
        'chapter_number': chapter_number,
        'title': f'Capitulo {chapter_number}',
        'total_sentences_in_chapter': sentence_count
    }).execute()

    return new_chapter.data[0]['chapter_id']


def clear_chapter_data(chapter_id: str):
    """Clear existing words and sentences for a chapter (for re-import)."""
    db = get_supabase()

    # Delete words first (foreign key constraint)
    db.table('words').delete().eq('chapter_id', chapter_id).execute()

    # Delete sentences
    db.table('sentences').delete().eq('chapter_id', chapter_id).execute()

    print(f"  Cleared existing data for chapter")


def truncate_vocabulary_tables():
    """Truncate lemmas and words tables for fresh reimport."""
    db = get_supabase()

    print("\nTruncating vocabulary tables...")

    # Delete in order due to foreign keys
    # First delete user progress that references lemmas
    try:
        db.table('user_lemma_progress').delete().neq('lemma_id', '00000000-0000-0000-0000-000000000000').execute()
        print("  Cleared user_lemma_progress")
    except Exception as e:
        print(f"  Note: Could not clear user_lemma_progress: {e}")

    # Delete words (references lemmas)
    db.table('words').delete().neq('word_id', '00000000-0000-0000-0000-000000000000').execute()
    print("  Cleared words table")

    # Delete lemmas
    db.table('lemmas').delete().neq('lemma_id', '00000000-0000-0000-0000-000000000000').execute()
    print("  Cleared lemmas table")

    print("  Vocabulary tables truncated")


def process_chapter(chapter_number: int, chapter_text: str, clear_existing: bool = True):
    """
    Complete pipeline for one chapter.
    """
    db = get_supabase()

    print(f"\n{'='*60}")
    print(f"Processing Chapter {chapter_number}")
    print(f"{'='*60}")

    # Get book
    book_id = get_book_id()
    print(f"Book ID: {book_id[:8]}...")

    # Step 2: Split sentences
    sentences = split_into_sentences(chapter_text)
    print(f"Found {len(sentences)} sentences")

    # Get or create chapter
    chapter_id = get_or_create_chapter(book_id, chapter_number, len(sentences))
    print(f"Chapter ID: {chapter_id[:8]}...")

    # Clear existing data if requested
    if clear_existing:
        clear_chapter_data(chapter_id)

    # Insert sentences with translations
    print("\nInserting sentences with translations...")
    sentence_ids = []
    for i, sentence_text in enumerate(sentences):
        # Translate sentence immediately (NOT NULL constraint)
        try:
            translation = translate_sentence(sentence_text)
        except Exception as e:
            print(f"  Warning: Could not translate sentence {i+1}: {e}")
            translation = "[Translation pending]"

        result = db.table('sentences').insert({
            'chapter_id': chapter_id,
            'sentence_order': i + 1,
            'sentence_text': sentence_text,
            'sentence_translation': translation
        }).execute()
        sentence_ids.append(result.data[0]['sentence_id'])

        if (i + 1) % 5 == 0:
            print(f"  Inserted {i+1}/{len(sentences)} sentences...")
    print(f"  Inserted {len(sentence_ids)} sentences")

    # Process each sentence
    print("\nProcessing words...")
    total_words = 0
    unique_lemmas = set()

    for i, (sentence_id, sentence_text) in enumerate(zip(sentence_ids, sentences)):
        words = process_sentence(sentence_text)

        for word_data in words:
            # Get or create lemma with corrected gender
            lemma_id = get_or_create_lemma(
                word_data['lemma_text'],
                word_data['pos'],
                word_data.get('gender')
            )
            unique_lemmas.add(lemma_id)

            # Insert word
            insert_word(word_data, sentence_id, chapter_id, book_id, lemma_id)
            total_words += 1

        if (i + 1) % 10 == 0:
            print(f"  Processed {i+1}/{len(sentences)} sentences...")

    print(f"  Total: {total_words} words, {len(unique_lemmas)} unique lemmas")

    # Translate lemmas with context
    print("\nTranslating lemmas with context...")
    translated, errors = batch_translate_lemmas(delay=0.1)

    # Summary
    print(f"\n{'='*60}")
    print("PROCESSING COMPLETE")
    print(f"{'='*60}")
    print(f"  Sentences: {len(sentences)}")
    print(f"  Words: {total_words}")
    print(f"  Unique lemmas: {len(unique_lemmas)}")
    print(f"  Lemmas translated: {translated}")

    return chapter_id


# =============================================================================
# STEP 8: TWO-LAYER AI VALIDATION
# =============================================================================

# LAYER 1: Per-Lemma Validation Prompt
LEMMA_VALIDATION_PROMPT = """You are a Spanish language expert validating vocabulary entries for a language learning app.

IMPORTANT FORMAT CONVENTIONS FOR THIS APP:
- Spanish nouns ARE stored with articles (e.g., "la aventura", "el libro") - this is CORRECT
- English translations for nouns should start with "the " (e.g., "the adventure") - this is CORRECT
- English translations for verbs should start with "to " (e.g., "to live") - this is CORRECT
- If the Spanish lemma has an article AND the English translation has "the", that is CORRECT formatting

For this lemma entry, check:
1. LEMMATIZATION: Is the lemma in correct dictionary form? (verbs: infinitive, nouns: singular with article)
2. TRANSLATION: Is the English translation accurate and natural?
3. GENDER: For nouns, does the article match the gender? (el=masculine, la=feminine)
4. MULTIPLE MEANINGS: Does this word commonly have multiple distinct meanings in different contexts?

DO NOT flag as errors:
- Nouns with articles in Spanish lemma (e.g., "la aventura") - this is CORRECT
- Nouns with "the " prefix in English translation - this is CORRECT
- Verbs with "to " prefix in English translation - this is CORRECT

Return a JSON object with:
{
  "is_valid": true/false,
  "confidence": 0-100,
  "issues": [
    {
      "type": "lemmatization|translation|gender",
      "description": "Brief description of the issue",
      "severity": "error|warning"
    }
  ],
  "suggested_fixes": {
    "lemma_text": "corrected lemma if needed",
    "translation": "corrected translation if needed",
    "gender": "M or F if incorrect"
  },
  "has_multiple_meanings": true/false,
  "alternative_meanings": ["meaning1", "meaning2"] or []
}

Examples of words with multiple meanings:
- "tener" → "to have" but also "to be" (age: tengo 6 años = I am 6 years old)
- "tiempo" → "time" or "weather"
- "derecho" → "right" (direction) or "law" or "straight"

If the entry is correct with no multiple meanings: {"is_valid": true, "confidence": 95, "issues": [], "suggested_fixes": {}, "has_multiple_meanings": false, "alternative_meanings": []}

IMPORTANT: Only flag actual errors. The app's format (article in Spanish, "the" in English) is intentional and correct.
Return ONLY valid JSON, no markdown or explanation."""

# LAYER 2: Sentence-Level Validation Prompt
SENTENCE_VALIDATION_PROMPT = """You are a Spanish language expert validating sentence translations for a language learning app.

For this sentence pair, check:
1. TRANSLATION ACCURACY: Does the English accurately convey the Spanish meaning?
2. NATURAL FLOW: Is the English translation natural and idiomatic?
3. CONTEXT-DEPENDENT MEANINGS: Are any lemmas being used with context-specific meanings?
4. SENTIMENT PRESERVATION: Is the tone/sentiment preserved?

Return a JSON object with:
{
  "is_valid": true/false,
  "translation_quality": "excellent|good|acceptable|poor|incorrect",
  "confidence": 0-100,
  "contextual_issues": [
    {
      "lemma": "word in question",
      "issue": "Description of the context-dependent meaning",
      "suggestion": "How this should be noted for learners"
    }
  ],
  "suggested_translation": "improved translation if needed" or null
}

Common context-dependent meanings to flag:
- "tener" in age expressions (tengo 20 años = I am 20, not "I have 20 years")
- "hacer" in weather (hace frío = it's cold, not "it makes cold")
- "dar" in expressions (dar un paseo = to take a walk)

If the translation is excellent with no issues: {"is_valid": true, "translation_quality": "excellent", "confidence": 95, "contextual_issues": [], "suggested_translation": null}

Return ONLY valid JSON, no markdown or explanation."""


def validate_lemma_with_ai(
    lemma_text: str,
    translation: str,
    pos: str,
    gender: Optional[str],
    example_sentence: Optional[str] = None
) -> Dict:
    """
    LAYER 1: Validate a single lemma using Claude API.
    Returns validation result with issues, suggested fixes, and multiple meanings flag.
    """
    client = get_anthropic()

    # Build context for validation
    context_parts = [
        f"Lemma: {lemma_text}",
        f"Translation: {translation}",
        f"Part of Speech: {pos}",
    ]

    if gender:
        context_parts.append(f"Gender: {gender}")

    if example_sentence:
        context_parts.append(f"Example sentence: {example_sentence}")

    context = "\n".join(context_parts)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": f"{LEMMA_VALIDATION_PROMPT}\n\nValidate this entry:\n{context}"
                }
            ]
        )

        # Parse JSON response
        result_text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
            result_text = result_text.strip()

        result = json.loads(result_text)
        return result

    except json.JSONDecodeError as e:
        print(f"  Warning: Could not parse AI response for '{lemma_text}': {e}")
        return {
            "is_valid": True,
            "confidence": 50,
            "issues": [{"type": "parse_error", "description": "Could not parse AI response", "severity": "warning"}],
            "suggested_fixes": {},
            "has_multiple_meanings": False,
            "alternative_meanings": []
        }
    except Exception as e:
        print(f"  Error validating '{lemma_text}': {e}")
        return {
            "is_valid": True,
            "confidence": 0,
            "issues": [{"type": "api_error", "description": str(e), "severity": "error"}],
            "suggested_fixes": {},
            "has_multiple_meanings": False,
            "alternative_meanings": []
        }


def validate_sentence_with_ai(
    spanish_text: str,
    english_translation: str,
    lemmas_used: List[str]
) -> Dict:
    """
    LAYER 2: Validate a sentence translation using Claude API.
    Checks for context-dependent meanings and translation quality.
    """
    client = get_anthropic()

    context = f"""Spanish: {spanish_text}
English translation: {english_translation}
Lemmas in sentence: {', '.join(lemmas_used)}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": f"{SENTENCE_VALIDATION_PROMPT}\n\nValidate this sentence:\n{context}"
                }
            ]
        )

        # Parse JSON response
        result_text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
            result_text = result_text.strip()

        result = json.loads(result_text)
        return result

    except json.JSONDecodeError as e:
        print(f"  Warning: Could not parse AI response for sentence: {e}")
        return {
            "is_valid": True,
            "translation_quality": "acceptable",
            "confidence": 50,
            "contextual_issues": [],
            "suggested_translation": None
        }
    except Exception as e:
        print(f"  Error validating sentence: {e}")
        return {
            "is_valid": True,
            "translation_quality": "acceptable",
            "confidence": 0,
            "contextual_issues": [{"lemma": "unknown", "issue": str(e), "suggestion": "API error"}],
            "suggested_translation": None
        }


def batch_validate_lemmas(chapter_number: int = None, limit: int = None, delay: float = 0.5) -> Dict:
    """
    LAYER 1: Validate all lemmas for a chapter using AI.
    Returns summary statistics including multiple meanings tracking.
    """
    db = get_supabase()

    print(f"\n{'='*60}")
    print("LAYER 1: LEMMA VALIDATION")
    print(f"{'='*60}")

    # Build query to get lemmas with example sentences
    if chapter_number:
        # Get chapter ID
        chapter_result = db.table('chapters').select('chapter_id').eq(
            'chapter_number', chapter_number
        ).execute()

        if not chapter_result.data:
            print(f"Chapter {chapter_number} not found")
            return {}

        chapter_id = chapter_result.data[0]['chapter_id']

        # Get unique lemma IDs for this chapter
        words_result = db.table('words').select('lemma_id').eq(
            'chapter_id', chapter_id
        ).execute()

        lemma_ids = list(set(w['lemma_id'] for w in words_result.data))

        # Get lemma details
        lemmas_query = db.table('lemmas').select(
            'lemma_id, lemma_text, definitions, part_of_speech, gender'
        ).in_('lemma_id', lemma_ids)
    else:
        lemmas_query = db.table('lemmas').select(
            'lemma_id, lemma_text, definitions, part_of_speech, gender'
        ).eq('language_code', 'es')

    if limit:
        lemmas_query = lemmas_query.limit(limit)

    lemmas_result = lemmas_query.execute()
    lemmas = lemmas_result.data

    print(f"Validating {len(lemmas)} lemmas...")

    # Statistics
    stats = {
        "total": len(lemmas),
        "valid": 0,
        "flagged": 0,
        "multiple_meanings": 0,
        "issues_by_type": {},
        "avg_confidence": 0
    }

    total_confidence = 0

    for i, lemma in enumerate(lemmas):
        # Get example sentence
        example_sentence = None
        word_result = db.table('words').select(
            'sentence_id'
        ).eq('lemma_id', lemma['lemma_id']).limit(1).execute()

        if word_result.data:
            sent_result = db.table('sentences').select(
                'sentence_text'
            ).eq('sentence_id', word_result.data[0]['sentence_id']).execute()

            if sent_result.data:
                example_sentence = sent_result.data[0]['sentence_text']

        # Get translation
        definitions = lemma.get('definitions', [])
        translation = definitions[0] if definitions else ""

        # Validate with AI
        result = validate_lemma_with_ai(
            lemma['lemma_text'],
            translation,
            lemma['part_of_speech'],
            lemma.get('gender'),
            example_sentence
        )

        # Update statistics
        if result.get('is_valid', True):
            stats['valid'] += 1
        else:
            stats['flagged'] += 1

        if result.get('has_multiple_meanings', False):
            stats['multiple_meanings'] += 1

        total_confidence += result.get('confidence', 0)

        for issue in result.get('issues', []):
            issue_type = issue.get('type', 'unknown')
            stats['issues_by_type'][issue_type] = stats['issues_by_type'].get(issue_type, 0) + 1

        # Store result in database with multiple meanings
        db.table('validation_reports').upsert({
            'lemma_id': lemma['lemma_id'],
            'is_valid': result.get('is_valid', True),
            'issues': result.get('issues', []),
            'suggested_fixes': result.get('suggested_fixes', {}),
            'confidence': result.get('confidence', 0),
            'has_multiple_meanings': result.get('has_multiple_meanings', False),
            'alternative_meanings': result.get('alternative_meanings', []),
            'reviewed_by_human': False
        }, on_conflict='lemma_id').execute()

        # Progress indicator
        status = "✓" if result.get('is_valid', True) else "✗"
        multi = " [MULTI]" if result.get('has_multiple_meanings', False) else ""
        print(f"  [{i+1}/{len(lemmas)}] {status} {lemma['lemma_text']}{multi}")

        # Rate limiting
        if delay and i < len(lemmas) - 1:
            time.sleep(delay)

    # Calculate averages
    stats['avg_confidence'] = round(total_confidence / len(lemmas)) if lemmas else 0
    stats['valid_pct'] = round(stats['valid'] / stats['total'] * 100) if stats['total'] else 0
    stats['flagged_pct'] = round(stats['flagged'] / stats['total'] * 100) if stats['total'] else 0

    # Print summary
    print(f"\n  Lemma Validation Complete:")
    print(f"    Total: {stats['total']}")
    print(f"    Valid: {stats['valid']} ({stats['valid_pct']}%)")
    print(f"    Flagged: {stats['flagged']} ({stats['flagged_pct']}%)")
    print(f"    Multiple meanings: {stats['multiple_meanings']}")
    print(f"    Avg confidence: {stats['avg_confidence']}%")

    if stats['issues_by_type']:
        print(f"\n  Issues by type:")
        for issue_type, count in sorted(stats['issues_by_type'].items(), key=lambda x: -x[1]):
            print(f"    * {issue_type}: {count}")

    return stats


def batch_validate_sentences(chapter_number: int = None, limit: int = None, delay: float = 0.5) -> Dict:
    """
    LAYER 2: Validate all sentences for a chapter using AI.
    Checks translation quality and context-dependent meanings.
    """
    db = get_supabase()

    print(f"\n{'='*60}")
    print("LAYER 2: SENTENCE VALIDATION")
    print(f"{'='*60}")

    # Build query
    if chapter_number:
        chapter_result = db.table('chapters').select('chapter_id').eq(
            'chapter_number', chapter_number
        ).execute()

        if not chapter_result.data:
            print(f"Chapter {chapter_number} not found")
            return {}

        chapter_id = chapter_result.data[0]['chapter_id']
        sentences_query = db.table('sentences').select(
            'sentence_id, sentence_text, sentence_translation'
        ).eq('chapter_id', chapter_id).order('sentence_order')
    else:
        sentences_query = db.table('sentences').select(
            'sentence_id, sentence_text, sentence_translation'
        )

    if limit:
        sentences_query = sentences_query.limit(limit)

    sentences_result = sentences_query.execute()
    sentences = sentences_result.data

    print(f"Validating {len(sentences)} sentences...")

    # Statistics
    stats = {
        "total": len(sentences),
        "valid": 0,
        "flagged": 0,
        "quality_distribution": {},
        "contextual_issues_count": 0,
        "avg_confidence": 0
    }

    total_confidence = 0

    for i, sentence in enumerate(sentences):
        # Get lemmas used in this sentence
        words_result = db.table('words').select(
            'lemma_id, lemmas(lemma_text)'
        ).eq('sentence_id', sentence['sentence_id']).execute()

        lemmas_used = list(set(
            w['lemmas']['lemma_text']
            for w in words_result.data
            if w.get('lemmas')
        ))

        # Validate with AI
        result = validate_sentence_with_ai(
            sentence['sentence_text'],
            sentence['sentence_translation'] or "",
            lemmas_used
        )

        # Update statistics
        if result.get('is_valid', True):
            stats['valid'] += 1
        else:
            stats['flagged'] += 1

        quality = result.get('translation_quality', 'acceptable')
        stats['quality_distribution'][quality] = stats['quality_distribution'].get(quality, 0) + 1

        contextual_issues = result.get('contextual_issues', [])
        stats['contextual_issues_count'] += len(contextual_issues)

        total_confidence += result.get('confidence', 0)

        # Store result in database
        db.table('sentence_validation_reports').upsert({
            'sentence_id': sentence['sentence_id'],
            'is_valid': result.get('is_valid', True),
            'translation_quality': quality,
            'contextual_issues': contextual_issues,
            'confidence': result.get('confidence', 0),
            'reviewed_by_human': False
        }, on_conflict='sentence_id').execute()

        # Progress indicator
        status = "✓" if result.get('is_valid', True) else "✗"
        ctx_flag = f" [{len(contextual_issues)} ctx]" if contextual_issues else ""
        preview = sentence['sentence_text'][:40] + "..." if len(sentence['sentence_text']) > 40 else sentence['sentence_text']
        print(f"  [{i+1}/{len(sentences)}] {status} [{quality}]{ctx_flag} {preview}")

        # Rate limiting
        if delay and i < len(sentences) - 1:
            time.sleep(delay)

    # Calculate averages
    stats['avg_confidence'] = round(total_confidence / len(sentences)) if sentences else 0
    stats['valid_pct'] = round(stats['valid'] / stats['total'] * 100) if stats['total'] else 0
    stats['flagged_pct'] = round(stats['flagged'] / stats['total'] * 100) if stats['total'] else 0

    # Print summary
    print(f"\n  Sentence Validation Complete:")
    print(f"    Total: {stats['total']}")
    print(f"    Valid: {stats['valid']} ({stats['valid_pct']}%)")
    print(f"    Flagged: {stats['flagged']} ({stats['flagged_pct']}%)")
    print(f"    Contextual issues found: {stats['contextual_issues_count']}")
    print(f"    Avg confidence: {stats['avg_confidence']}%")

    if stats['quality_distribution']:
        print(f"\n  Quality distribution:")
        for quality, count in sorted(stats['quality_distribution'].items()):
            print(f"    * {quality}: {count}")

    return stats


def run_full_validation(chapter_number: int = None, limit: int = None, delay: float = 0.5) -> Dict:
    """
    Run both Layer 1 (lemma) and Layer 2 (sentence) validation.
    Returns combined statistics.
    """
    print(f"\n{'='*60}")
    print("TWO-LAYER AI VALIDATION")
    print(f"{'='*60}")

    if chapter_number:
        print(f"Validating Chapter {chapter_number}")
    else:
        print("Validating all content")

    # Run Layer 1: Lemma validation
    lemma_stats = batch_validate_lemmas(chapter_number, limit, delay)

    # Run Layer 2: Sentence validation
    sentence_stats = batch_validate_sentences(chapter_number, limit, delay)

    # Combined report
    print(f"\n{'='*60}")
    print("COMBINED VALIDATION REPORT")
    print(f"{'='*60}")

    print(f"\n  LAYER 1 - Lemma Validation:")
    print(f"    {lemma_stats.get('valid', 0)}/{lemma_stats.get('total', 0)} valid ({lemma_stats.get('valid_pct', 0)}%)")
    print(f"    {lemma_stats.get('flagged', 0)} flagged")
    print(f"    {lemma_stats.get('multiple_meanings', 0)} words with multiple meanings")

    print(f"\n  LAYER 2 - Sentence Validation:")
    print(f"    {sentence_stats.get('valid', 0)}/{sentence_stats.get('total', 0)} valid ({sentence_stats.get('valid_pct', 0)}%)")
    print(f"    {sentence_stats.get('flagged', 0)} flagged")
    print(f"    {sentence_stats.get('contextual_issues_count', 0)} contextual issues")

    return {
        "lemma_validation": lemma_stats,
        "sentence_validation": sentence_stats
    }


# =============================================================================
# STEP 8B: PHRASE DETECTION SYSTEM
# =============================================================================

PHRASE_DETECTION_PROMPT = """You are a Spanish language expert identifying idiomatic phrases and expressions in text.

Analyze the given Spanish sentence and identify any multi-word expressions where:
1. The combined meaning differs from the sum of individual word meanings
2. The phrase is commonly used as a fixed expression in Spanish

Types to detect:
- IDIOMS: Fixed expressions with non-literal meaning (e.g., "dar miedo" = "to scare", not "to give fear")
- COLLOCATIONS: Words that frequently appear together (e.g., "tener razón" = "to be right")
- COMPOUND EXPRESSIONS: Multi-word terms (e.g., "personas mayores" = "grown-ups/adults", "selva virgen" = "primeval forest")

For each phrase found, return:
{
  "phrases": [
    {
      "phrase_text": "personas mayores",
      "phrase_type": "compound",
      "definition": "grown-ups, adults",
      "literal_meaning": "older people",
      "confidence": 90,
      "component_words": ["persona", "mayor"],
      "start_position": 3,
      "end_position": 4,
      "learner_note": "In context of children's literature, refers specifically to adults/grown-ups"
    }
  ]
}

Rules:
- Only include phrases with confidence >= 80
- Phrase must be at least 2 words
- Only detect phrases that a Spanish learner would benefit from knowing as fixed expressions
- Include position indices (0-based word positions in sentence, excluding punctuation)

If no idiomatic phrases found: {"phrases": []}

Return ONLY valid JSON, no markdown or explanation."""


def detect_phrases_in_sentence(
    sentence_text: str,
    sentence_id: str,
    tokens: List[Dict],
    lemma_mapping: Dict[str, str]
) -> List[Dict]:
    """
    Use Claude API to detect idiomatic phrases in a sentence.
    Returns list of phrase objects with metadata.
    """
    client = get_anthropic()

    # Build token list for context
    token_list = [{"position": i, "word": t['word_text'], "lemma": t['lemma_text']}
                  for i, t in enumerate(tokens)]

    context = f"""Sentence: {sentence_text}

Tokens (with positions):
{json.dumps(token_list, ensure_ascii=False, indent=2)}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[
                {
                    "role": "user",
                    "content": f"{PHRASE_DETECTION_PROMPT}\n\nAnalyze this sentence:\n{context}"
                }
            ]
        )

        # Parse JSON response
        result_text = response.content[0].text.strip()

        # Handle potential markdown code blocks
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
            result_text = result_text.strip()

        result = json.loads(result_text)
        phrases = result.get('phrases', [])

        # Filter by confidence threshold
        phrases = [p for p in phrases if p.get('confidence', 0) >= 80]

        return phrases

    except json.JSONDecodeError as e:
        print(f"  Warning: Could not parse phrase detection response: {e}")
        return []
    except Exception as e:
        print(f"  Error detecting phrases: {e}")
        return []


def find_phrase_positions(phrase_text: str, tokens: List[Dict]) -> Tuple[int, int]:
    """
    Find start and end positions of a phrase in the token list.
    Returns (start_position, end_position) or (-1, -1) if not found.
    """
    phrase_words = phrase_text.lower().split()
    token_texts = [t['word_text'].lower() for t in tokens]

    for i in range(len(token_texts) - len(phrase_words) + 1):
        match = True
        for j, phrase_word in enumerate(phrase_words):
            if token_texts[i + j] != phrase_word:
                match = False
                break
        if match:
            return (i, i + len(phrase_words) - 1)

    return (-1, -1)


def get_component_lemma_ids(component_words: List[str], language_code: str = 'es') -> List[str]:
    """
    Get lemma IDs for the component words of a phrase.
    """
    db = get_supabase()
    lemma_ids = []

    for word in component_words:
        # Try with and without article
        for prefix in ['', 'el ', 'la ']:
            result = db.table('lemmas').select('lemma_id').eq(
                'lemma_text', f"{prefix}{word}"
            ).eq('language_code', language_code).execute()

            if result.data:
                lemma_ids.append(result.data[0]['lemma_id'])
                break

    return lemma_ids


def insert_phrase(phrase_data: Dict, language_code: str = 'es') -> str:
    """
    Insert or update a phrase in the database.
    Returns phrase_id.

    IMPORTANT: If phrase already exists and is_reviewed=True, we DON'T overwrite
    the definitions. This preserves manual corrections from earlier chapters.
    """
    db = get_supabase()

    phrase_text = phrase_data['phrase_text'].lower().strip()

    # Check if phrase already exists
    result = db.table('phrases').select('phrase_id, is_reviewed, definitions').eq(
        'phrase_text', phrase_text
    ).execute()

    if result.data:
        # Phrase already exists - check if reviewed
        phrase_id = result.data[0]['phrase_id']
        is_reviewed = result.data[0].get('is_reviewed', False)
        existing_defs = result.data[0].get('definitions', [])

        if is_reviewed:
            # Already reviewed - DON'T overwrite definitions
            # Just return the existing phrase_id for occurrence linking
            print(f"    Phrase '{phrase_text}' already reviewed - skipping update")
            return phrase_id

        # Not reviewed - safe to update with new AI detection
        new_def = phrase_data.get('definition', '')
        if new_def and new_def not in existing_defs:
            # Add new definition if it's different
            existing_defs.append(new_def)

        db.table('phrases').update({
            'definitions': existing_defs if existing_defs else [new_def],
            'phrase_type': phrase_data.get('phrase_type', 'idiom')
        }).eq('phrase_id', phrase_id).execute()
        return phrase_id

    # Get component lemma IDs
    component_words = phrase_data.get('component_words', [])
    component_lemma_ids = get_component_lemma_ids(component_words, language_code)

    # Insert new phrase (using actual schema column names)
    new_phrase = db.table('phrases').insert({
        'phrase_text': phrase_text,
        'definitions': [phrase_data.get('definition', '')],
        'component_lemmas': component_lemma_ids,  # Schema uses 'component_lemmas' not 'component_lemma_ids'
        'phrase_type': phrase_data.get('phrase_type', 'idiom'),
        'is_reviewed': False
    }).execute()

    return new_phrase.data[0]['phrase_id']


def insert_phrase_occurrence(phrase_id: str, sentence_id: str, start_pos: int, end_pos: int):
    """
    Link a phrase occurrence to a sentence.
    """
    db = get_supabase()

    # Check if occurrence already exists
    result = db.table('phrase_occurrences').select('occurrence_id').eq(
        'phrase_id', phrase_id
    ).eq('sentence_id', sentence_id).execute()

    if result.data:
        return result.data[0]['occurrence_id']

    # Insert new occurrence (using actual schema column names)
    new_occurrence = db.table('phrase_occurrences').insert({
        'phrase_id': phrase_id,
        'sentence_id': sentence_id,
        'start_position': start_pos,  # Schema uses 'start_position' not 'start_word_position'
        'end_position': end_pos       # Schema uses 'end_position' not 'end_word_position'
    }).execute()

    return new_occurrence.data[0]['occurrence_id']


def detect_phrases_for_chapter(chapter_number: int, delay: float = 0.5) -> Dict:
    """
    Run phrase detection on all sentences in a chapter.
    Returns summary statistics.
    """
    db = get_supabase()

    print(f"\n{'='*60}")
    print(f"PHRASE DETECTION - Chapter {chapter_number}")
    print(f"{'='*60}")

    # Get chapter
    chapter_result = db.table('chapters').select('chapter_id').eq(
        'chapter_number', chapter_number
    ).execute()

    if not chapter_result.data:
        print(f"Chapter {chapter_number} not found")
        return {}

    chapter_id = chapter_result.data[0]['chapter_id']

    # Get all sentences
    sentences_result = db.table('sentences').select(
        'sentence_id, sentence_text, sentence_order'
    ).eq('chapter_id', chapter_id).order('sentence_order').execute()

    sentences = sentences_result.data
    print(f"Processing {len(sentences)} sentences...")

    # Statistics
    stats = {
        "total_sentences": len(sentences),
        "sentences_with_phrases": 0,
        "total_phrases": 0,
        "phrases_by_type": {},
        "phrases_found": []
    }

    for i, sentence in enumerate(sentences):
        # Get words for this sentence
        words_result = db.table('words').select(
            'word_text, lemma_id, word_position, lemmas(lemma_text)'
        ).eq('sentence_id', sentence['sentence_id']).order('word_position').execute()

        if not words_result.data:
            continue

        # Build token list and lemma mapping
        tokens = []
        lemma_mapping = {}
        for w in words_result.data:
            tokens.append({
                'word_text': w['word_text'],
                'lemma_text': w['lemmas']['lemma_text'] if w.get('lemmas') else '',
                'word_position': w['word_position']
            })
            lemma_mapping[w['word_text'].lower()] = w['lemmas']['lemma_text'] if w.get('lemmas') else ''

        # Detect phrases
        phrases = detect_phrases_in_sentence(
            sentence['sentence_text'],
            sentence['sentence_id'],
            tokens,
            lemma_mapping
        )

        if phrases:
            stats['sentences_with_phrases'] += 1

            for phrase in phrases:
                # Find positions
                start_pos, end_pos = find_phrase_positions(phrase['phrase_text'], tokens)
                if start_pos == -1:
                    # Use AI-provided positions if available
                    start_pos = phrase.get('start_position', 0)
                    end_pos = phrase.get('end_position', 0)

                # Insert phrase
                phrase_id = insert_phrase(phrase)

                # Insert occurrence
                insert_phrase_occurrence(phrase_id, sentence['sentence_id'], start_pos, end_pos)

                # Update stats
                stats['total_phrases'] += 1
                phrase_type = phrase.get('phrase_type', 'unknown')
                stats['phrases_by_type'][phrase_type] = stats['phrases_by_type'].get(phrase_type, 0) + 1
                stats['phrases_found'].append({
                    'phrase_text': phrase['phrase_text'],
                    'definition': phrase.get('definition', ''),
                    'type': phrase_type,
                    'confidence': phrase.get('confidence', 0),
                    'sentence_order': sentence['sentence_order']
                })

                print(f"  [{i+1}/{len(sentences)}] Found: \"{phrase['phrase_text']}\" ({phrase_type}) - {phrase.get('definition', '')}")

        # Rate limiting
        if delay and i < len(sentences) - 1:
            time.sleep(delay)

    # Print summary
    print(f"\n{'='*60}")
    print("PHRASE DETECTION COMPLETE")
    print(f"{'='*60}")
    print(f"  Sentences processed: {stats['total_sentences']}")
    print(f"  Sentences with phrases: {stats['sentences_with_phrases']}")
    print(f"  Total phrases found: {stats['total_phrases']}")

    if stats['phrases_by_type']:
        print(f"\n  Phrases by type:")
        for ptype, count in sorted(stats['phrases_by_type'].items()):
            print(f"    * {ptype}: {count}")

    return stats


def show_phrases_for_chapter(chapter_number: int):
    """
    Display all phrases found in a chapter.
    """
    db = get_supabase()

    print(f"\n{'='*60}")
    print(f"PHRASES IN CHAPTER {chapter_number}")
    print(f"{'='*60}")

    # Get chapter
    chapter_result = db.table('chapters').select('chapter_id').eq(
        'chapter_number', chapter_number
    ).execute()

    if not chapter_result.data:
        print(f"Chapter {chapter_number} not found")
        return

    chapter_id = chapter_result.data[0]['chapter_id']

    # Get sentences for this chapter
    sentences_result = db.table('sentences').select('sentence_id').eq(
        'chapter_id', chapter_id
    ).execute()

    if not sentences_result.data:
        print("No sentences found in chapter")
        return

    sentence_ids = [s['sentence_id'] for s in sentences_result.data]

    # Get phrase occurrences for these sentences (using actual schema columns)
    occurrences_result = db.table('phrase_occurrences').select(
        '*, phrases(phrase_text, definitions, phrase_type, is_reviewed)'
    ).in_('sentence_id', sentence_ids).execute()

    if not occurrences_result.data:
        print("\nNo phrases found in this chapter.")
        print("Run --detect-phrases --chapter N to detect phrases.")
        return

    # Count occurrences per phrase
    phrase_counts = {}
    phrase_data = {}
    for occ in occurrences_result.data:
        phrase = occ.get('phrases', {})
        phrase_text = phrase.get('phrase_text', 'Unknown')

        if phrase_text not in phrase_counts:
            phrase_counts[phrase_text] = 0
            phrase_data[phrase_text] = phrase

        phrase_counts[phrase_text] += 1

    # Display
    print(f"\nFound {len(phrase_counts)} unique phrases:\n")
    print(f"{'Phrase':<25} {'Definition':<30} {'Type':<12} {'Count':<6} {'Reviewed'}")
    print("-" * 85)

    for phrase_text in sorted(phrase_counts.keys()):
        phrase = phrase_data[phrase_text]
        definitions = phrase.get('definitions', [])
        definition = definitions[0][:28] + '..' if definitions and len(definitions[0]) > 30 else (definitions[0] if definitions else '-')
        ptype = phrase.get('phrase_type', '-')
        count = phrase_counts[phrase_text]
        reviewed = "✓" if phrase.get('is_reviewed') else "✗"

        print(f"{phrase_text:<25} {definition:<30} {ptype:<12} {count:<6} {reviewed}")


def show_validation_issues(chapter_number: int = None, limit: int = 20):
    """
    Display flagged lemmas and sentences with AI suggestions.
    """
    db = get_supabase()

    # =========================================================================
    # FLAGGED LEMMAS
    # =========================================================================
    print(f"\n{'='*60}")
    print("FLAGGED LEMMAS")
    print(f"{'='*60}")

    query = db.table('validation_reports').select(
        '*, lemmas(lemma_text, definitions, part_of_speech, gender)'
    ).eq('is_valid', False).order('confidence', desc=False)

    if limit:
        query = query.limit(limit)

    result = query.execute()
    reports = result.data

    if not reports:
        print("\nNo flagged lemmas found! All entries passed validation.")
    else:
        print(f"\nShowing {len(reports)} flagged lemmas:\n")

        for i, report in enumerate(reports):
            lemma = report.get('lemmas', {})
            issues = report.get('issues', [])
            fixes = report.get('suggested_fixes', {})

            print(f"{i+1}. {lemma.get('lemma_text', 'Unknown')}")
            print(f"   Current translation: {lemma.get('definitions', [''])[0] if lemma.get('definitions') else 'None'}")
            print(f"   POS: {lemma.get('part_of_speech')} | Gender: {lemma.get('gender', '-')}")
            print(f"   Confidence: {report.get('confidence', 0)}%")

            if issues:
                print(f"   Issues:")
                for issue in issues:
                    severity_icon = "🔴" if issue.get('severity') == 'error' else "🟡"
                    print(f"     {severity_icon} [{issue.get('type')}] {issue.get('description')}")

            if fixes:
                print(f"   Suggested fixes:")
                for key, value in fixes.items():
                    if value:
                        print(f"     → {key}: {value}")

            print()

    # =========================================================================
    # WORDS WITH MULTIPLE MEANINGS
    # =========================================================================
    print(f"\n{'='*60}")
    print("WORDS WITH MULTIPLE MEANINGS (for manual review)")
    print(f"{'='*60}")

    multi_query = db.table('validation_reports').select(
        '*, lemmas(lemma_text, definitions, part_of_speech)'
    ).eq('has_multiple_meanings', True).order('confidence', desc=False)

    if limit:
        multi_query = multi_query.limit(limit)

    multi_result = multi_query.execute()
    multi_reports = multi_result.data

    if not multi_reports:
        print("\nNo words with multiple meanings flagged.")
    else:
        print(f"\nShowing {len(multi_reports)} words with multiple meanings:\n")

        for i, report in enumerate(multi_reports):
            lemma = report.get('lemmas', {})
            alt_meanings = report.get('alternative_meanings', [])

            print(f"{i+1}. {lemma.get('lemma_text', 'Unknown')}")
            print(f"   Primary meaning: {lemma.get('definitions', [''])[0] if lemma.get('definitions') else 'None'}")
            if alt_meanings:
                print(f"   Alternative meanings:")
                for alt in alt_meanings:
                    print(f"     • {alt}")
            print()

    # =========================================================================
    # FLAGGED SENTENCES
    # =========================================================================
    print(f"\n{'='*60}")
    print("FLAGGED SENTENCES")
    print(f"{'='*60}")

    sent_query = db.table('sentence_validation_reports').select(
        '*, sentences(sentence_text, sentence_translation)'
    ).eq('is_valid', False).order('confidence', desc=False)

    if limit:
        sent_query = sent_query.limit(limit)

    sent_result = sent_query.execute()
    sent_reports = sent_result.data

    if not sent_reports:
        print("\nNo flagged sentences found! All translations passed validation.")
    else:
        print(f"\nShowing {len(sent_reports)} flagged sentences:\n")

        for i, report in enumerate(sent_reports):
            sentence = report.get('sentences', {})
            ctx_issues = report.get('contextual_issues', [])

            print(f"{i+1}. Spanish: {sentence.get('sentence_text', 'Unknown')[:60]}...")
            print(f"   English: {sentence.get('sentence_translation', 'None')[:60]}...")
            print(f"   Quality: {report.get('translation_quality', '-')} | Confidence: {report.get('confidence', 0)}%")

            if ctx_issues:
                print(f"   Contextual issues:")
                for issue in ctx_issues:
                    print(f"     ⚠️ [{issue.get('lemma')}] {issue.get('issue')}")
                    if issue.get('suggestion'):
                        print(f"        → {issue.get('suggestion')}")

            print()

    # =========================================================================
    # SENTENCES WITH CONTEXTUAL ISSUES
    # =========================================================================
    print(f"\n{'='*60}")
    print("SENTENCES WITH CONTEXTUAL ISSUES")
    print(f"{'='*60}")

    # Get sentences that are valid but have contextual issues
    ctx_query = db.table('sentence_validation_reports').select(
        '*, sentences(sentence_text, sentence_translation)'
    ).neq('contextual_issues', []).order('confidence', desc=False)

    if limit:
        ctx_query = ctx_query.limit(limit)

    ctx_result = ctx_query.execute()
    ctx_reports = ctx_result.data

    if not ctx_reports:
        print("\nNo sentences with contextual issues found.")
    else:
        print(f"\nShowing {len(ctx_reports)} sentences with context-dependent meanings:\n")

        for i, report in enumerate(ctx_reports):
            sentence = report.get('sentences', {})
            ctx_issues = report.get('contextual_issues', [])

            if ctx_issues:
                print(f"{i+1}. {sentence.get('sentence_text', 'Unknown')[:50]}...")
                for issue in ctx_issues:
                    print(f"   📌 {issue.get('lemma')}: {issue.get('issue')}")
                    if issue.get('suggestion'):
                        print(f"      Learner note: {issue.get('suggestion')}")
                print()


def print_validation_queries():
    """Print SQL queries to validate the import."""
    print("\n" + "="*60)
    print("VALIDATION QUERIES")
    print("="*60)
    print("""
-- Count lemmas and words
SELECT
    (SELECT COUNT(*) FROM lemmas WHERE language_code = 'es') as total_lemmas,
    (SELECT COUNT(*) FROM lemmas WHERE definitions != '[]') as translated_lemmas,
    (SELECT COUNT(*) FROM words) as total_words;

-- Sample lemmas
SELECT lemma_text, definitions, part_of_speech, is_stop_word
FROM lemmas
WHERE language_code = 'es'
ORDER BY lemma_text
LIMIT 20;

-- Sample sentences with translations
SELECT sentence_text, sentence_translation
FROM sentences
LIMIT 5;

-- Words per chapter
SELECT c.chapter_number, COUNT(w.word_id) as word_count
FROM chapters c
JOIN words w ON c.chapter_id = w.chapter_id
GROUP BY c.chapter_id, c.chapter_number
ORDER BY c.chapter_number;
""")


def main():
    parser = argparse.ArgumentParser(
        description='Import Spanish chapter text into Voquab database'
    )
    parser.add_argument('--chapter', type=int, help='Chapter number to import')
    parser.add_argument('--input', type=str, help='Path to chapter text file')
    parser.add_argument('--text', type=str, help='Chapter text directly (alternative to --input)')
    parser.add_argument('--translate-only', action='store_true',
                        help='Only translate untranslated lemmas')
    parser.add_argument('--no-clear', action='store_true',
                        help='Do not clear existing chapter data')
    parser.add_argument('--truncate', action='store_true',
                        help='Truncate lemmas and words tables before import')
    parser.add_argument('--validate', action='store_true',
                        help='Print SQL validation queries')
    parser.add_argument('--validate-ai', action='store_true',
                        help='Run AI validation on lemmas (requires ANTHROPIC_API_KEY)')
    parser.add_argument('--show-issues', action='store_true',
                        help='Show flagged lemmas with AI suggestions')
    parser.add_argument('--detect-phrases', action='store_true',
                        help='Detect idiomatic phrases in chapter (requires ANTHROPIC_API_KEY)')
    parser.add_argument('--show-phrases', action='store_true',
                        help='Show detected phrases for chapter')
    parser.add_argument('--limit', type=int, default=None,
                        help='Limit number of lemmas to validate')

    args = parser.parse_args()

    if args.validate:
        print_validation_queries()
        return

    if args.show_issues:
        show_validation_issues(chapter_number=args.chapter, limit=args.limit or 20)
        return

    if args.detect_phrases:
        if not args.chapter:
            parser.error("--chapter is required for phrase detection")
        detect_phrases_for_chapter(args.chapter)
        return

    if args.show_phrases:
        if not args.chapter:
            parser.error("--chapter is required for --show-phrases")
        show_phrases_for_chapter(args.chapter)
        return

    if args.validate_ai:
        if not args.chapter:
            print("Running AI validation on all content...")
        run_full_validation(chapter_number=args.chapter, limit=args.limit)
        return

    if args.translate_only:
        print("Translating untranslated lemmas...")
        batch_translate_lemmas()
        return

    if args.truncate:
        truncate_vocabulary_tables()
        if not args.chapter:
            return

    if not args.chapter:
        parser.error("--chapter is required for import")

    # Get chapter text
    if args.input:
        with open(args.input, 'r', encoding='utf-8') as f:
            chapter_text = f.read()
    elif args.text:
        chapter_text = args.text
    else:
        parser.error("Either --input or --text is required")

    # Process chapter
    process_chapter(
        args.chapter,
        chapter_text,
        clear_existing=not args.no_clear
    )

    print_validation_queries()


if __name__ == '__main__':
    main()
