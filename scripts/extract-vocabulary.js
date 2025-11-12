#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

if (!TRANSLATE_API_KEY) {
  console.error('Error: Missing GOOGLE_TRANSLATE_API_KEY in .env file');
  process.exit(1);
}

// Translation cache
const translationCache = new Map();

// Common Spanish words that are important even if short
const IMPORTANT_SHORT_WORDS = new Set([
  'yo', 'tú', 'él', 'en', 'un', 'la', 'el', 'lo', 'mi', 'tu', 'su',
  'me', 'te', 'se', 'le', 'ya', 'no', 'si', 'sí', 'es', 'ha', 'he',
  'al', 'del', 'por', 'para', 'con', 'sin', 'que', 'más', 'muy'
]);

// Spanish stop words - ONLY super basic words that should be marked as is_common_word
const STOP_WORDS = new Set([
  // Articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // Basic prepositions
  'de', 'a', 'en',
  // Basic conjunctions
  'y', 'o',
  // Basic pronouns
  'me', 'te', 'se', 'le', 'lo',
  // Very common words
  'es', 'no', 'sí',
]);

/**
 * Translate a word using Google Translate API
 */
async function translateWord(word) {
  if (translationCache.has(word.toLowerCase())) {
    return translationCache.get(word.toLowerCase());
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: word,
        source: 'es',
        target: 'en',
        format: 'text',
      }),
    });

    if (!response.ok) {
      console.warn(`Translation failed for "${word}"`);
      return word;
    }

    const data = await response.json();
    const translation = data.data.translations[0].translatedText;

    translationCache.set(word.toLowerCase(), translation);
    return translation;
  } catch (error) {
    console.warn(`Translation error for "${word}":`, error.message);
    return word;
  }
}

/**
 * Simple heuristic to determine part of speech
 * This is a simplified version - we can refine later
 */
function guessPartOfSpeech(word, translation) {
  const lowerWord = word.toLowerCase();
  const lowerTranslation = translation.toLowerCase();

  // Common verb endings in Spanish
  if (lowerWord.match(/(ar|er|ir|ado|ido|ando|iendo)$/)) {
    return 'verb';
  }

  // Common adjective patterns
  if (lowerWord.match(/(oso|osa|able|ible|ante|ente)$/)) {
    return 'adjective';
  }

  // Articles and pronouns
  if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(lowerWord)) {
    return 'article';
  }

  if (['yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te', 'se', 'le'].includes(lowerWord)) {
    return 'pronoun';
  }

  // Prepositions
  if (['en', 'de', 'a', 'por', 'para', 'con', 'sin', 'sobre', 'entre'].includes(lowerWord)) {
    return 'preposition';
  }

  // Conjunctions
  if (['y', 'o', 'pero', 'porque', 'que', 'si', 'cuando'].includes(lowerWord)) {
    return 'conjunction';
  }

  // Adverbs
  if (lowerWord.endsWith('mente')) {
    return 'adverb';
  }

  // Default to noun
  return 'noun';
}

/**
 * Extract words from text
 */
function extractWords(text) {
  // Remove punctuation and split into words
  const words = text
    .replace(/[.,;:!?¿¡«»""()—\-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.trim());

  return words;
}

/**
 * Filter words to keep only valid vocabulary
 */
function filterWords(words) {
  const uniqueWords = new Set();

  for (const word of words) {
    const cleaned = word.toLowerCase();

    // Skip very short words unless they're important
    if (cleaned.length < 2 && !IMPORTANT_SHORT_WORDS.has(cleaned)) {
      continue;
    }

    // Skip numbers
    if (/^\d+$/.test(cleaned)) {
      continue;
    }

    uniqueWords.add(cleaned);
  }

  return Array.from(uniqueWords);
}

/**
 * Main extraction function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📚 Extracting Vocabulary from Chapter 1');
  console.log('='.repeat(60));

  try {
    // Step 1: Get the book
    console.log('\n📖 Fetching book "El Principito"...');
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('book_id, title')
      .eq('title', 'El Principito')
      .eq('language_code', 'es')
      .single();

    if (bookError) throw bookError;
    if (!book) throw new Error('Book not found');

    console.log(`✓ Book found: ${book.title} (ID: ${book.book_id})`);

    // Step 2: Get Chapter 1
    console.log('\n📄 Fetching Chapter 1...');
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('chapter_id, chapter_number, title')
      .eq('book_id', book.book_id)
      .eq('chapter_number', 1)
      .single();

    if (chapterError) throw chapterError;
    if (!chapter) throw new Error('Chapter 1 not found');

    console.log(`✓ Chapter found: ${chapter.title} (ID: ${chapter.chapter_id})`);

    // Step 3: Get all sentences from Chapter 1
    console.log('\n📝 Fetching sentences...');
    const { data: sentences, error: sentencesError } = await supabase
      .from('sentences')
      .select('sentence_id, sentence_text')
      .eq('chapter_id', chapter.chapter_id)
      .order('sentence_order', { ascending: true });

    if (sentencesError) throw sentencesError;
    if (!sentences || sentences.length === 0) {
      throw new Error('No sentences found');
    }

    console.log(`✓ Found ${sentences.length} sentences`);

    // Step 4: Extract all words from all sentences
    console.log('\n🔍 Extracting words from sentences...');
    const allWords = [];
    const wordToSentences = new Map(); // Track which sentences contain which words and their positions

    for (const sentence of sentences) {
      const words = extractWords(sentence.sentence_text);
      allWords.push(...words);

      // Track word occurrences with positions
      for (let position = 0; position < words.length; position++) {
        const word = words[position];
        const cleaned = word.toLowerCase();
        if (!wordToSentences.has(cleaned)) {
          wordToSentences.set(cleaned, []);
        }
        wordToSentences.get(cleaned).push({
          sentence_id: sentence.sentence_id,
          position: position
        });
      }
    }

    console.log(`  Extracted ${allWords.length} total words`);

    // Step 5: Filter to unique valid words
    const uniqueWords = filterWords(allWords);
    console.log(`  Filtered to ${uniqueWords.length} unique vocabulary words`);

    // Step 6: Translate and insert vocabulary
    console.log('\n🌐 Translating and inserting vocabulary...');
    let inserted = 0;
    let skipped = 0;
    const vocabularyMap = new Map(); // Map word -> vocabulary_id

    for (let i = 0; i < uniqueWords.length; i++) {
      const word = uniqueWords[i];

      // Check if word already exists in vocabulary
      const { data: existingVocab, error: checkError } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('lemma', word)
        .eq('language_code', 'es')
        .maybeSingle();

      if (existingVocab) {
        // Debug: log the first vocab entry to see column names
        if (skipped === 0 && inserted === 0) {
          console.log('  First vocabulary entry:', JSON.stringify(existingVocab, null, 2));
          console.log('  Available keys:', Object.keys(existingVocab));
        }
        // Try to find the ID field (could be 'id', 'vocabulary_id', or something else)
        const vocabId = existingVocab.id || existingVocab.vocabulary_id || existingVocab.vocab_id;
        vocabularyMap.set(word, vocabId);
        skipped++;
        continue;
      }

      if (checkError) {
        console.error(`  Error checking "${word}":`, checkError.message);
        continue;
      }

      // Translate the word
      const translation = await translateWord(word);
      const partOfSpeech = guessPartOfSpeech(word, translation);

      // Check if this is a common/stop word
      const isCommonWord = STOP_WORDS.has(word.toLowerCase());

      // Insert into vocabulary table
      const { data: newVocab, error: insertError } = await supabase
        .from('vocabulary')
        .insert([{
          lemma: word,
          language_code: 'es',
          part_of_speech: partOfSpeech,
          english_definition: translation,
          is_common_word: isCommonWord,
        }])
        .select()
        .single();

      if (insertError) {
        console.error(`  Error inserting "${word}":`, insertError.message);
        continue;
      }

      // Debug: log the first inserted vocab to see column names
      if (inserted === 0 && skipped === 0) {
        console.log('  First inserted vocabulary:', JSON.stringify(newVocab, null, 2));
        console.log('  Available keys:', Object.keys(newVocab));
      }

      const vocabId = newVocab.id || newVocab.vocabulary_id || newVocab.vocab_id;
      vocabularyMap.set(word, vocabId);
      inserted++;

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${uniqueWords.length} words processed...`);
      }
    }

    console.log(`✓ Inserted ${inserted} new vocabulary words`);
    if (skipped > 0) {
      console.log(`  (Skipped ${skipped} words that already existed)`);
    }

    // Step 7: Create vocabulary_occurrences
    console.log('\n🔗 Creating vocabulary occurrences...');
    let occurrencesInserted = 0;

    for (const [word, occurrences] of wordToSentences.entries()) {
      const vocabId = vocabularyMap.get(word);
      if (!vocabId) continue;

      for (const occurrence of occurrences) {
        // Check if occurrence already exists
        const { data: existingOccurrence } = await supabase
          .from('vocabulary_occurrences')
          .select('*')
          .eq('vocab_id', vocabId)
          .eq('sentence_id', occurrence.sentence_id)
          .eq('word_position', occurrence.position)
          .maybeSingle();

        if (existingOccurrence) continue;

        // Insert occurrence
        const { data: insertedOccurrence, error: occurrenceError } = await supabase
          .from('vocabulary_occurrences')
          .insert([{
            vocab_id: vocabId,
            sentence_id: occurrence.sentence_id,
            word_position: occurrence.position,
          }])
          .select()
          .single();

        if (occurrenceError) {
          if (occurrencesInserted === 0) {
            console.error(`  First occurrence error:`, occurrenceError.message);
          }
          continue;
        }

        if (insertedOccurrence) {
          // Debug: log first occurrence to see column names
          if (occurrencesInserted === 0) {
            console.log('  First occurrence created:', JSON.stringify(insertedOccurrence, null, 2));
          }
          occurrencesInserted++;
        }
      }
    }

    console.log(`✓ Created ${occurrencesInserted} vocabulary occurrences`);

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Vocabulary Extraction Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Total words extracted: ${allWords.length}`);
    console.log(`   Unique vocabulary: ${uniqueWords.length}`);
    console.log(`   New words added: ${inserted}`);
    console.log(`   Existing words: ${skipped}`);
    console.log(`   Occurrences created: ${occurrencesInserted}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Extraction failed!');
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

// Run the extraction
main();
