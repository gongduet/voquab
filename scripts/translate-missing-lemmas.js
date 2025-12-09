#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEEPL_API_KEY = process.env.VITE_DEEPL_API_KEY;

// DeepL has two endpoints - try both
const DEEPL_ENDPOINTS = [
  'https://api-free.deepl.com/v2/translate',  // Free tier
  'https://api.deepl.com/v2/translate'         // Pro tier
];

/**
 * Try DeepL translation with both endpoints
 */
async function translateWithDeepL(texts, endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      source_lang: 'ES',
      target_lang: 'EN-US',
    }),
  });

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.translations.map(t => t.text);
}

/**
 * Batch translate with retry logic
 */
async function batchTranslate(texts) {
  // Try each endpoint
  for (const endpoint of DEEPL_ENDPOINTS) {
    try {
      console.log(`  Trying: ${endpoint.includes('free') ? 'Free' : 'Pro'} tier...`);
      const translations = await translateWithDeepL(texts, endpoint);
      console.log(`  ✓ Success with ${endpoint.includes('free') ? 'Free' : 'Pro'} tier`);
      return translations;
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}`);
    }
  }

  // If both fail, return null (we'll handle fallback)
  return null;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('🌐 BATCH TRANSLATING MISSING LEMMAS');
  console.log('='.repeat(60));

  try {
    // Step 1: Find all untranslated lemmas
    console.log('\n📖 Finding untranslated lemmas...');

    // Fetch all lemmas and filter client-side for better matching
    const { data: allLemmas, error: lemmasError } = await supabase
      .from('vocabulary_lemmas')
      .select('lemma_id, lemma, english_definition, part_of_speech')
      .eq('language_code', 'es')
      .order('lemma');

    if (lemmasError) throw lemmasError;

    // Filter lemmas where:
    // 1. english_definition is null
    // 2. english_definition equals the lemma
    // 3. english_definition equals the lemma without article
    const allUntranslated = allLemmas.filter(l => {
      if (!l.english_definition) return true;
      if (l.english_definition === l.lemma) return true;

      // Check if definition equals lemma without article
      const withoutArticle = l.lemma.replace(/^(el|la|los|las) /, '');
      if (l.english_definition === withoutArticle) return true;

      return false;
    });

    console.log(`✓ Found ${allUntranslated.length} untranslated lemmas (out of ${allLemmas.length} total)`);

    // Step 2: Batch translate (50 at a time to avoid rate limits)
    console.log('\n🔄 Translating in batches...');

    const BATCH_SIZE = 50;
    let translated = 0;
    let failed = 0;

    for (let i = 0; i < allUntranslated.length; i += BATCH_SIZE) {
      const batch = allUntranslated.slice(i, i + BATCH_SIZE);
      const textsToTranslate = batch.map(l => l.lemma);

      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allUntranslated.length / BATCH_SIZE)}`);
      console.log(`  Translating ${batch.length} lemmas...`);

      // Try translation
      const translations = await batchTranslate(textsToTranslate);

      if (!translations) {
        console.log(`  ❌ Batch failed - skipping`);
        failed += batch.length;
        continue;
      }

      // Update database
      for (let j = 0; j < batch.length; j++) {
        const lemma = batch[j];
        const translation = translations[j];

        const { error: updateError } = await supabase
          .from('vocabulary_lemmas')
          .update({ english_definition: translation })
          .eq('lemma_id', lemma.lemma_id);

        if (updateError) {
          console.log(`    ✗ Failed to update "${lemma.lemma}": ${updateError.message}`);
          failed++;
        } else {
          translated++;
        }
      }

      console.log(`  ✓ Updated ${batch.length} lemmas`);
      console.log(`  Progress: ${translated}/${allUntranslated.length} translated, ${failed} failed`);

      // Rate limit safety - wait 1 second between batches
      if (i + BATCH_SIZE < allUntranslated.length) {
        await sleep(1000);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TRANSLATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  Successfully translated: ${translated}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total processed: ${allUntranslated.length}`);

    // Show samples
    console.log('\n📋 Sample translations:');
    const { data: samples } = await supabase
      .from('vocabulary_lemmas')
      .select('lemma, english_definition, part_of_speech')
      .eq('language_code', 'es')
      .in('lemma', ['contestar', 'el libro', 'la casa', 'hablar', 'comer'])
      .limit(10);

    samples?.forEach(s => {
      console.log(`  ${s.lemma} → ${s.english_definition}`);
    });

  } catch (error) {
    console.error('\n❌ Translation failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
