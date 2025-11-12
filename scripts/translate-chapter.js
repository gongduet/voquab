#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import pkg from '@google-cloud/translate';
const { Translate } = pkg.v2;

// Initialize Google Cloud Translate client with API key from .env
const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

if (!apiKey) {
  console.error('Error: GOOGLE_TRANSLATE_API_KEY not found in .env file.');
  console.error('Please add your Google Cloud Translation API key to the .env file:');
  console.error('GOOGLE_TRANSLATE_API_KEY=your_api_key_here');
  process.exit(1);
}

let translate;

try {
  translate = new Translate({ key: apiKey });
  console.log('✓ Google Cloud Translate client initialized with API key');
} catch (error) {
  console.error('Error initializing Google Cloud Translate client.');
  console.error(error.message);
  process.exit(1);
}

/**
 * Split text into sentences while properly handling abbreviations and edge cases
 * @param {string} text - The text to split into sentences
 * @returns {string[]} - Array of sentences
 */
function splitIntoSentences(text) {
  // Common Spanish abbreviations that should not be treated as sentence endings
  const abbreviations = [
    'Sr', 'Sra', 'Srta', 'Dr', 'Dra', 'Prof', 'Profa',
    'etc', 'pág', 'págs', 'cap', 'caps', 'vol', 'vols',
    'art', 'num', 'núm', 'aprox', 'tel', 'telef',
    'Ud', 'Vd', 'Uds', 'Vds', 'ej', 'p.ej', 'C', 'Cía'
  ];

  // Create a regex pattern for abbreviations
  const abbrevPattern = abbreviations.join('|');

  // Replace abbreviations temporarily with placeholders
  let processed = text;
  const abbrevMap = new Map();
  let placeholderIndex = 0;

  // Replace abbreviations with periods with temporary placeholders
  const abbrevRegex = new RegExp(`\\b(${abbrevPattern})\\.`, 'gi');
  processed = processed.replace(abbrevRegex, (match, abbrev) => {
    const placeholder = `__ABBREV_${placeholderIndex}__`;
    abbrevMap.set(placeholder, match);
    placeholderIndex++;
    return placeholder;
  });

  // Replace decimal numbers (e.g., "3.14") with placeholders
  processed = processed.replace(/(\d+)\.(\d+)/g, (match) => {
    const placeholder = `__NUMBER_${placeholderIndex}__`;
    abbrevMap.set(placeholder, match);
    placeholderIndex++;
    return placeholder;
  });

  // Split on sentence boundaries (., !, ?, followed by space and capital letter or end of string)
  const sentences = processed
    .split(/([.!?]+)(?=\s+[A-ZÁÉÍÓÚÑ]|\s*$)/)
    .reduce((acc, part, index, array) => {
      if (index % 2 === 0) {
        // Text part
        const sentence = part + (array[index + 1] || '');
        if (sentence.trim()) {
          acc.push(sentence.trim());
        }
      }
      return acc;
    }, []);

  // Restore abbreviations and numbers
  return sentences.map(sentence => {
    let restored = sentence;
    abbrevMap.forEach((original, placeholder) => {
      restored = restored.replace(placeholder, original);
    });
    return restored;
  });
}

/**
 * Translate a single sentence from Spanish to English
 * @param {string} text - The text to translate
 * @returns {Promise<string>} - The translated text
 */
async function translateSentence(text) {
  try {
    const [translation] = await translate.translate(text, {
      from: 'es',
      to: 'en',
    });
    return translation;
  } catch (error) {
    console.error(`Error translating sentence: "${text}"`);
    console.error(error.message);
    throw error;
  }
}

/**
 * Process a chapter: split into sentences and translate each one
 * @param {string} spanishText - The Spanish text to process
 * @param {number} chapterNumber - The chapter number
 * @returns {Promise<Object>} - Object with chapter data
 */
async function processChapter(spanishText, chapterNumber) {
  console.log(`Processing chapter ${chapterNumber}...`);

  // Split into sentences
  const sentences = splitIntoSentences(spanishText);
  console.log(`Found ${sentences.length} sentences.`);

  // Translate each sentence
  const translatedSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    const spanish = sentences[i];
    console.log(`Translating sentence ${i + 1}/${sentences.length}...`);

    try {
      const english = await translateSentence(spanish);
      translatedSentences.push({
        order: i + 1,
        spanish,
        english,
      });

      // Add a small delay to avoid hitting API rate limits
      if (i < sentences.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to translate sentence ${i + 1}. Skipping...`);
      translatedSentences.push({
        order: i + 1,
        spanish,
        english: '[TRANSLATION FAILED]',
      });
    }
  }

  return {
    chapter_number: chapterNumber,
    sentences: translatedSentences,
  };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node translate-chapter.js <input-file> <chapter-number> [output-file]');
    console.log('');
    console.log('Arguments:');
    console.log('  input-file     - Path to the Spanish text file');
    console.log('  chapter-number - Chapter number (integer)');
    console.log('  output-file    - (Optional) Path to output JSON file');
    console.log('                   Default: chapter-<number>-translated.json');
    console.log('');
    console.log('Example:');
    console.log('  node translate-chapter.js chapter1.txt 1 chapter1.json');
    console.log('');
    console.log('Note: Make sure GOOGLE_TRANSLATE_API_KEY is set in your .env file');
    process.exit(1);
  }

  const inputFile = args[0];
  const chapterNumber = parseInt(args[1], 10);
  const outputFile = args[2] || `chapter-${chapterNumber}-translated.json`;

  if (isNaN(chapterNumber)) {
    console.error('Error: Chapter number must be a valid integer.');
    process.exit(1);
  }

  try {
    // Read input file
    console.log(`Reading input file: ${inputFile}`);
    const spanishText = await fs.readFile(inputFile, 'utf-8');

    if (!spanishText.trim()) {
      console.error('Error: Input file is empty.');
      process.exit(1);
    }

    // Process the chapter
    const result = await processChapter(spanishText, chapterNumber);

    // Write output file
    console.log(`Writing output to: ${outputFile}`);
    await fs.writeFile(
      outputFile,
      JSON.stringify(result, null, 2),
      'utf-8'
    );

    console.log('');
    console.log('✓ Translation complete!');
    console.log(`  - Processed ${result.sentences.length} sentences`);
    console.log(`  - Output saved to: ${outputFile}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
