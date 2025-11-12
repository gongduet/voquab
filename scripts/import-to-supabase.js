#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key (bypasses RLS for admin operations)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✓ Connected to Supabase with service role key (admin access)');

/**
 * Get or create a book
 * @param {Object} bookData - Book information
 * @returns {Promise<Object>} Book record with id
 */
async function getOrCreateBook(bookData) {
  console.log(`\nChecking if book "${bookData.title}" exists...`);

  // Check if book exists
  const { data: existingBook, error: fetchError } = await supabase
    .from('books')
    .select('*')
    .eq('title', bookData.title)
    .eq('language_code', bookData.language_code)
    .single();

  if (existingBook) {
    console.log('Existing book data:', JSON.stringify(existingBook, null, 2));

    console.log(`✓ Book found with ID: ${existingBook.book_id}`);
    return existingBook;
  }

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 is "not found" which is expected
    throw fetchError;
  }

  // Create new book
  console.log('Creating new book...');
  const { data: newBook, error: insertError } = await supabase
    .from('books')
    .insert([bookData])
    .select()
    .single();

  if (insertError) {
    console.error('Insert error:', insertError);
    throw insertError;
  }

  if (!newBook) {
    throw new Error('Book was created but no data was returned');
  }

  console.log('Book data returned:', JSON.stringify(newBook, null, 2));
  console.log(`✓ Book created with ID: ${newBook.book_id}`);
  return newBook;
}

/**
 * Create a chapter
 * @param {Object} chapterData - Chapter information
 * @returns {Promise<Object>} Chapter record with id
 */
async function createChapter(chapterData) {
  console.log(`\nCreating Chapter ${chapterData.chapter_number}...`);

  // Check if chapter already exists
  const { data: existingChapter } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', chapterData.book_id)
    .eq('chapter_number', chapterData.chapter_number)
    .single();

  if (existingChapter) {
    console.log(`⚠ Chapter ${chapterData.chapter_number} already exists. Deleting and recreating...`);

    // Delete existing sentences first (due to foreign key constraints)
    const { error: deleteSentencesError } = await supabase
      .from('sentences')
      .delete()
      .eq('chapter_id', existingChapter.chapter_id);

    if (deleteSentencesError) throw deleteSentencesError;

    // Delete the chapter
    const { error: deleteChapterError } = await supabase
      .from('chapters')
      .delete()
      .eq('chapter_id', existingChapter.chapter_id);

    if (deleteChapterError) throw deleteChapterError;
  }

  const { data: newChapter, error: insertError } = await supabase
    .from('chapters')
    .insert([chapterData])
    .select()
    .single();

  if (insertError) throw insertError;

  console.log(`✓ Chapter created with ID: ${newChapter.chapter_id}`);
  return newChapter;
}

/**
 * Insert sentences in batches
 * @param {Array} sentences - Array of sentence objects
 * @param {number} chapterId - Chapter ID
 */
async function insertSentences(sentences, chapterId) {
  console.log(`\nInserting ${sentences.length} sentences...`);

  const sentenceRecords = sentences.map(sentence => ({
    chapter_id: chapterId,
    sentence_order: sentence.order,
    sentence_text: sentence.spanish,
    sentence_translation: sentence.english,
  }));

  // Insert in batches of 50 to avoid payload size limits
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < sentenceRecords.length; i += batchSize) {
    const batch = sentenceRecords.slice(i, i + batchSize);

    const { error } = await supabase
      .from('sentences')
      .insert(batch);

    if (error) throw error;

    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${sentenceRecords.length} sentences...`);
  }

  console.log(`✓ All ${sentences.length} sentences inserted successfully`);
}

/**
 * Main import function
 */
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || 'chapter-1-translated.json';

  console.log('='.repeat(50));
  console.log('📚 Importing Chapter Data to Supabase');
  console.log('='.repeat(50));

  try {
    // Read the JSON file
    console.log(`\nReading file: ${inputFile}`);
    const fileContent = await fs.readFile(inputFile, 'utf-8');
    const chapterData = JSON.parse(fileContent);

    if (!chapterData.chapter_number || !chapterData.sentences) {
      throw new Error('Invalid JSON format. Expected chapter_number and sentences fields.');
    }

    console.log(`✓ Loaded chapter ${chapterData.chapter_number} with ${chapterData.sentences.length} sentences`);

    // Step 1: Get or create the book
    const book = await getOrCreateBook({
      title: 'El Principito',
      author: 'Antoine de Saint-Exupéry',
      language_code: 'es',
      total_chapters: 27,
      total_sentences: chapterData.sentences.length, // Will be updated as we add more chapters
    });

    // Step 2: Create the chapter
    const chapter = await createChapter({
      book_id: book.book_id,
      chapter_number: chapterData.chapter_number,
      title: `Capítulo ${chapterData.chapter_number}`,
      total_sentences_in_chapter: chapterData.sentences.length,
    });

    // Step 3: Insert all sentences
    await insertSentences(chapterData.sentences, chapter.chapter_id);

    // Success summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Import Complete!');
    console.log('='.repeat(50));
    console.log(`📖 Book: ${book.title} (ID: ${book.book_id})`);
    console.log(`📄 Chapter: ${chapter.chapter_number} (ID: ${chapter.chapter_id})`);
    console.log(`📝 Sentences: ${chapterData.sentences.length} inserted`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Import failed!');
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  }
}

// Run the import
main();
