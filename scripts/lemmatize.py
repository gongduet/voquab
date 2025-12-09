#!/usr/bin/env python3
"""
Spanish word lemmatization and grammatical analysis using spaCy
"""
import sys
import json
import spacy

# Load Spanish model
nlp = spacy.load('es_core_news_sm')

def analyze_word(word):
    """Analyze a Spanish word and return lemma + grammatical info"""
    doc = nlp(word)
    token = doc[0]

    result = {
        'word': word,
        'lemma': token.lemma_,
        'pos': token.pos_,  # VERB, NOUN, ADJ, etc.
        'tag': token.tag_,  # Detailed tag
        'morph': {}
    }

    # Extract morphological features
    for feat in token.morph:
        key, value = feat.split('=')
        result['morph'][key] = value

    # Add article for nouns based on gender
    if token.pos_ == 'NOUN':
        gender = result['morph'].get('Gender')
        if gender:
            article = 'el' if gender == 'Masc' else 'la'
            result['lemma'] = f"{article} {token.lemma_}"

    return result

if __name__ == '__main__':
    # Read words from stdin (one per line) or from argument
    if len(sys.argv) > 1:
        word = sys.argv[1]
        result = analyze_word(word)
        print(json.dumps(result, ensure_ascii=False))
    else:
        # Batch mode: read from stdin
        for line in sys.stdin:
            word = line.strip()
            if word:
                result = analyze_word(word)
                print(json.dumps(result, ensure_ascii=False))