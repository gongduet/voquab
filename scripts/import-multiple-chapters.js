#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Spanish stop words
const STOP_WORDS = new Set([
  // Articles
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  // Prepositions
  'de', 'a', 'en', 'con', 'por', 'para', 'sobre', 'entre', 'sin', 'bajo', 'desde', 'hasta',
  // Pronouns
  'yo', 'tú', 'él', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas',
  'me', 'te', 'se', 'le', 'lo', 'nos', 'os', 'les', 'que', 'quien', 'cual',
  'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'este', 'esta', 'estos', 'estas',
  'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
  // Conjunctions
  'y', 'o', 'pero', 'ni', 'sino', 'pues', 'porque',
  // Common verbs (to be)
  'es', 'son', 'ser', 'está', 'están', 'estar',
  // Common adverbs
  'muy', 'más', 'menos', 'también', 'tampoco', 'sí', 'no', 'ya', 'como',
  // Other common words
  'del', 'al', 'ésta', 'éstas', 'éste', 'éstos', 'ésa', 'ésas',
]);

// Important short words
const IMPORTANT_SHORT_WORDS = new Set([
  'yo', 'tú', 'él', 'en', 'un', 'la', 'el', 'lo', 'mi', 'tu', 'su',
  'me', 'te', 'se', 'le', 'ya', 'no', 'si', 'sí', 'es', 'ha', 'he',
  'al', 'del', 'por', 'para', 'con', 'sin', 'que', 'más', 'muy'
]);

/**
 * Translate text using Google Translate API
 */
async function translateText(text) {
  const cacheKey = text.toLowerCase().substring(0, 100);

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'es',
        target: 'en',
        format: 'text',
      }),
    });

    if (!response.ok) {
      console.warn(`Translation failed for text: ${text.substring(0, 50)}...`);
      return text;
    }

    const data = await response.json();
    const translation = data.data.translations[0].translatedText;

    translationCache.set(cacheKey, translation);
    return translation;
  } catch (error) {
    console.warn(`Translation error:`, error.message);
    return text;
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
  // Split by period, exclamation, or question mark followed by space or newline
  const sentences = text
    .split(/([.!?])\s+/)
    .reduce((acc, part, i, arr) => {
      if (i % 2 === 0 && part.trim()) {
        const punctuation = arr[i + 1] || '';
        acc.push((part + punctuation).trim());
      }
      return acc;
    }, [])
    .filter(s => s.length > 0);

  return sentences;
}

/**
 * Extract words from text
 */
function extractWords(text) {
  const words = text
    .replace(/[.,;:!?¿¡«»\"\"()—\-]/g, ' ')
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
 * Simple heuristic to determine part of speech
 */
function guessPartOfSpeech(word, translation) {
  const lowerWord = word.toLowerCase();

  // Common verb endings in Spanish
  if (lowerWord.match(/(ar|er|ir|ado|ido|ando|iendo)$/)) {
    return 'verb';
  }

  // Common adjective patterns
  if (lowerWord.match(/(oso|osa|able|ible|ante|ente)$/)) {
    return 'adjective';
  }

  // Articles
  if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(lowerWord)) {
    return 'article';
  }

  // Pronouns
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
 * Process a single chapter
 */
async function processChapter(bookId, chapterNumber, chapterText) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📖 Processing Chapter ${chapterNumber}`);
  console.log('='.repeat(60));

  try {
    // Step 1: Split into sentences
    console.log('\n📝 Splitting text into sentences...');
    const sentences = splitIntoSentences(chapterText);
    console.log(`  Found ${sentences.length} sentences`);

    if (sentences.length === 0) {
      console.warn(`  ⚠️ No sentences found, skipping chapter ${chapterNumber}`);
      return;
    }

    // Step 2: Translate sentences
    console.log('\n🌐 Translating sentences...');
    const translatedSentences = [];
    for (let i = 0; i < sentences.length; i++) {
      const spanish = sentences[i];
      const english = await translateText(spanish);
      translatedSentences.push({ spanish, english });

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${sentences.length} sentences translated...`);
      }

      // Delay to avoid rate limiting
      await delay(100);
    }
    console.log(`  ✓ Translated ${translatedSentences.length} sentences`);

    // Step 3: Create chapter entry
    console.log('\n📚 Creating chapter entry...');
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .insert([{
        book_id: bookId,
        chapter_number: chapterNumber,
        title: `Capítulo ${chapterNumber}`,
        total_sentences_in_chapter: translatedSentences.length,
      }])
      .select()
      .single();

    if (chapterError) {
      // Check if chapter already exists
      if (chapterError.code === '23505') {
        console.log(`  ⚠️ Chapter ${chapterNumber} already exists, skipping...`);
        return;
      }
      throw chapterError;
    }

    console.log(`  ✓ Chapter created (ID: ${chapter.chapter_id})`);

    // Step 4: Insert sentences
    console.log('\n📄 Inserting sentences...');
    const sentenceInserts = translatedSentences.map((s, index) => ({
      chapter_id: chapter.chapter_id,
      sentence_order: index + 1,
      sentence_text: s.spanish,
      sentence_translation: s.english,
    }));

    const { data: insertedSentences, error: sentencesError } = await supabase
      .from('sentences')
      .insert(sentenceInserts)
      .select();

    if (sentencesError) throw sentencesError;
    console.log(`  ✓ Inserted ${insertedSentences.length} sentences`);

    // Step 5: Extract vocabulary
    console.log('\n🔍 Extracting vocabulary...');
    const allWords = [];
    const wordToSentences = new Map();

    for (const sentence of insertedSentences) {
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

    const uniqueWords = filterWords(allWords);
    console.log(`  Extracted ${allWords.length} total words`);
    console.log(`  Filtered to ${uniqueWords.length} unique vocabulary words`);

    // Step 6: Insert vocabulary
    console.log('\n💾 Inserting vocabulary...');
    let inserted = 0;
    let skipped = 0;
    const vocabularyMap = new Map();

    for (let i = 0; i < uniqueWords.length; i++) {
      const word = uniqueWords[i];

      // Check if word already exists
      const { data: existingVocab } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('lemma', word)
        .eq('language_code', 'es')
        .maybeSingle();

      if (existingVocab) {
        const vocabId = existingVocab.id || existingVocab.vocabulary_id || existingVocab.vocab_id;
        vocabularyMap.set(word, vocabId);
        skipped++;
        continue;
      }

      // Translate and insert new word
      const translation = await translateText(word);
      const partOfSpeech = guessPartOfSpeech(word, translation);
      const isCommonWord = STOP_WORDS.has(word.toLowerCase());

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

      const vocabId = newVocab.id || newVocab.vocabulary_id || newVocab.vocab_id;
      vocabularyMap.set(word, vocabId);
      inserted++;

      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${uniqueWords.length} words processed...`);
      }

      // Small delay to avoid rate limiting
      await delay(100);
    }

    console.log(`  ✓ Inserted ${inserted} new vocabulary words`);
    if (skipped > 0) {
      console.log(`    (Skipped ${skipped} existing words)`);
    }

    // Step 7: Create vocabulary occurrences
    console.log('\n🔗 Creating vocabulary occurrences...');
    let occurrencesInserted = 0;

    for (const [word, occurrences] of wordToSentences.entries()) {
      const vocabId = vocabularyMap.get(word);
      if (!vocabId) continue;

      for (const occurrence of occurrences) {
        // Check if occurrence already exists
        const { data: existing } = await supabase
          .from('vocabulary_occurrences')
          .select('*')
          .eq('vocab_id', vocabId)
          .eq('sentence_id', occurrence.sentence_id)
          .eq('word_position', occurrence.position)
          .maybeSingle();

        if (existing) continue;

        // Insert occurrence
        const { error: occurrenceError } = await supabase
          .from('vocabulary_occurrences')
          .insert([{
            vocab_id: vocabId,
            sentence_id: occurrence.sentence_id,
            word_position: occurrence.position,
          }]);

        if (!occurrenceError) {
          occurrencesInserted++;
        }
      }
    }

    console.log(`  ✓ Created ${occurrencesInserted} vocabulary occurrences`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Chapter ${chapterNumber} Complete!`);
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Sentences: ${insertedSentences.length}`);
    console.log(`   Total words: ${allWords.length}`);
    console.log(`   Unique vocabulary: ${uniqueWords.length}`);
    console.log(`   New words added: ${inserted}`);
    console.log(`   Existing words: ${skipped}`);
    console.log(`   Occurrences created: ${occurrencesInserted}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`\n❌ Error processing Chapter ${chapterNumber}:`, error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 BATCH IMPORT: El Principito Chapters 2-10');
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
    if (!book) throw new Error('Book "El Principito" not found');

    console.log(`✓ Book found: ${book.title} (ID: ${book.book_id})`);

    // Step 2: Read the chapters file
    console.log('\n📂 Reading chapters file...');
    const filePath = path.join(__dirname, '../data/chapters-2-10-spanish.txt');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    console.log(`✓ File read successfully`);

    // Step 3: Split by "Capítulo" to extract chapters
    console.log('\n✂️ Parsing chapters...');
    const chapters = [];
    const chapterSections = fileContent.split(/Capítulo\s+(\d+)/i).slice(1);

    for (let i = 0; i < chapterSections.length; i += 2) {
      const chapterNumber = parseInt(chapterSections[i]);
      const chapterText = chapterSections[i + 1]?.trim();

      if (chapterNumber && chapterText && chapterText.length > 0) {
        chapters.push({ number: chapterNumber, text: chapterText });
      }
    }

    console.log(`✓ Found ${chapters.length} chapters to import`);
    chapters.forEach(ch => {
      console.log(`   - Chapter ${ch.number} (${ch.text.length} characters)`);
    });

    if (chapters.length === 0) {
      throw new Error('No chapters found in file. Make sure the file contains "Capítulo X" markers.');
    }

    // Step 4: Process each chapter
    for (const chapter of chapters) {
      await processChapter(book.book_id, chapter.number, chapter.text);

      // Delay between chapters
      if (chapter !== chapters[chapters.length - 1]) {
        console.log('\n⏳ Waiting 2 seconds before next chapter...\n');
        await delay(2000);
      }
    }

    // Final summary
    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 BATCH IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Successfully imported ${chapters.length} chapters`);
    console.log(`Chapters: ${chapters.map(ch => ch.number).join(', ')}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Import failed!');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the import
main();
