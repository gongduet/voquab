#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('='.repeat(60));
  console.log('📝 ADDING ARTICLES TO NOUN LEMMAS');
  console.log('='.repeat(60));

  try {
    // Step 1: Get all nouns WITHOUT articles
    console.log('\n📖 Fetching nouns...');

    const { data: nouns, error: nounsError } = await supabase
      .from('vocabulary_lemmas')
      .select('lemma_id, lemma, part_of_speech')
      .eq('part_of_speech', 'NOUN')
      .not('lemma', 'like', 'el %')
      .not('lemma', 'like', 'la %')
      .not('lemma', 'like', 'los %')
      .not('lemma', 'like', 'las %');

    if (nounsError) throw nounsError;

    console.log(`✓ Found ${nouns.length} nouns without articles`);

    // Step 2: For each noun, determine gender and add article
    console.log('\n🔍 Determining genders and adding articles...');

    let updated = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < nouns.length; i++) {
      const noun = nouns[i];

      // Get a form to determine gender
      const { data: forms, error: formError } = await supabase
        .from('vocabulary_forms')
        .select('grammatical_info')
        .eq('lemma_id', noun.lemma_id)
        .limit(1);

      if (formError || !forms || forms.length === 0) {
        console.log(`  ⚠️  No forms found for: ${noun.lemma}`);
        skipped++;
        continue;
      }

      // Extract gender from grammatical_info
      const grammarInfo = forms[0].grammatical_info;
      const gender = grammarInfo?.Gender;

      if (!gender) {
        console.log(`  ⚠️  No gender info for: ${noun.lemma}`);
        skipped++;
        continue;
      }

      // Determine article based on gender
      // Note: We use singular articles even for plural lemmas
      let article;
      if (gender === 'Masc') {
        article = 'el';
      } else if (gender === 'Fem') {
        article = 'la';
      } else {
        console.log(`  ⚠️  Unknown gender "${gender}" for: ${noun.lemma}`);
        skipped++;
        continue;
      }

      // Update lemma with article
      const newLemma = `${article} ${noun.lemma}`;

      const { error: updateError } = await supabase
        .from('vocabulary_lemmas')
        .update({ lemma: newLemma })
        .eq('lemma_id', noun.lemma_id);

      if (updateError) {
        console.log(`  ❌ Error updating "${noun.lemma}": ${updateError.message}`);
        errors++;
        continue;
      }

      updated++;

      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${nouns.length} (updated: ${updated}, skipped: ${skipped}, errors: ${errors})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ NOUN ARTICLE FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  Nouns updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total processed: ${nouns.length}`);

    // Show samples
    console.log('\n📋 Sample updated nouns:');
    const { data: samples } = await supabase
      .from('vocabulary_lemmas')
      .select('lemma, part_of_speech')
      .eq('part_of_speech', 'NOUN')
      .or('lemma.like.el %,lemma.like.la %')
      .limit(10);

    samples?.forEach(s => console.log(`  ✓ ${s.lemma}`));

  } catch (error) {
    console.error('\n❌ Fix failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
