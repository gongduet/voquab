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

async function main() {
  console.log('='.repeat(60));
  console.log('📝 Updating is_common_word flags for all vocabulary');
  console.log('='.repeat(60));

  try {
    // Step 1: Get all vocabulary
    console.log('\n📖 Fetching all vocabulary...');
    const { data: allVocab, error: fetchError } = await supabase
      .from('vocabulary')
      .select('vocab_id, lemma, is_common_word')
      .eq('language_code', 'es');

    if (fetchError) throw fetchError;

    console.log(`✓ Found ${allVocab.length} vocabulary words`);

    // Step 2: Categorize words
    const wordsToMarkCommon = [];
    const wordsToMarkNotCommon = [];

    for (const word of allVocab) {
      const isStopWord = STOP_WORDS.has(word.lemma.toLowerCase());

      if (isStopWord && word.is_common_word !== true) {
        wordsToMarkCommon.push(word.vocab_id);
      } else if (!isStopWord && word.is_common_word !== false) {
        wordsToMarkNotCommon.push(word.vocab_id);
      }
    }

    console.log(`\n📊 Analysis:`);
    console.log(`   Words to mark as common: ${wordsToMarkCommon.length}`);
    console.log(`   Words to mark as NOT common: ${wordsToMarkNotCommon.length}`);
    console.log(`   Already correct: ${allVocab.length - wordsToMarkCommon.length - wordsToMarkNotCommon.length}`);

    // Step 3: Update words to mark as common
    if (wordsToMarkCommon.length > 0) {
      console.log('\n🔄 Marking words as common...');
      const { error: updateCommonError } = await supabase
        .from('vocabulary')
        .update({ is_common_word: true })
        .in('vocab_id', wordsToMarkCommon);

      if (updateCommonError) throw updateCommonError;
      console.log(`✓ Marked ${wordsToMarkCommon.length} words as common`);
    }

    // Step 4: Update words to mark as NOT common
    if (wordsToMarkNotCommon.length > 0) {
      console.log('\n🔄 Marking words as NOT common...');
      const { error: updateNotCommonError } = await supabase
        .from('vocabulary')
        .update({ is_common_word: false })
        .in('vocab_id', wordsToMarkNotCommon);

      if (updateNotCommonError) throw updateNotCommonError;
      console.log(`✓ Marked ${wordsToMarkNotCommon.length} words as NOT common`);
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Update Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total vocabulary: ${allVocab.length}`);
    console.log(`   Common words (stop words): ${wordsToMarkCommon.length + allVocab.filter(w => w.is_common_word === true && STOP_WORDS.has(w.lemma.toLowerCase())).length}`);
    console.log(`   Learning words: ${allVocab.length - STOP_WORDS.size}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Update failed!');
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
    process.exit(1);
  }
}

// Run the update
main();
