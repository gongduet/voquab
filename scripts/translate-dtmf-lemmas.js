import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEEPL_API_KEY = process.env.VITE_DEEPL_API_KEY;
const DEEPL_API_URL = 'https://api.deepl.com/v2/translate';

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

async function translateText(text) {
  const params = new URLSearchParams({
    auth_key: DEEPL_API_KEY,
    text: text,
    source_lang: 'ES',
    target_lang: 'EN-US'
  });

  const response = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

async function main() {
  console.log('='.repeat(60));
  console.log('TRANSLATING NEW DTMF LEMMAS');
  console.log('='.repeat(60));
  console.log('');

  // Get lemma_ids linked to DTMF
  const { data: songLemmas } = await supabase
    .from('song_lemmas')
    .select('lemma_id')
    .eq('song_id', SONG_ID);

  const lemmaIds = songLemmas.map(sl => sl.lemma_id);
  console.log(`Found ${lemmaIds.length} lemmas linked to DTMF`);

  // Get lemmas that need translation (empty definitions array)
  const { data: lemmas, error } = await supabase
    .from('lemmas')
    .select('lemma_id, lemma_text, definitions')
    .in('lemma_id', lemmaIds);

  if (error) {
    console.error('Error fetching lemmas:', error.message);
    return;
  }

  // Filter to those needing translation
  const needsTranslation = lemmas.filter(l =>
    !l.definitions || l.definitions.length === 0
  );

  console.log(`Lemmas needing translation: ${needsTranslation.length}`);
  console.log('');

  if (needsTranslation.length === 0) {
    console.log('All lemmas already have translations!');
    return;
  }

  const errors = [];
  const translated = [];

  for (let i = 0; i < needsTranslation.length; i++) {
    const lemma = needsTranslation[i];
    process.stdout.write(`Translating "${lemma.lemma_text}"... `);

    try {
      const translation = await translateText(lemma.lemma_text);

      // Update in database
      const { error: updateError } = await supabase
        .from('lemmas')
        .update({ definitions: [translation.toLowerCase()] })
        .eq('lemma_id', lemma.lemma_id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      translated.push({ lemma_text: lemma.lemma_text, translation });
      console.log(`✓ ${translation}`);

      // Small delay to avoid rate limiting
      if (i < needsTranslation.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.log('✗');
      errors.push({ lemma_text: lemma.lemma_text, error: err.message });
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Total lemmas translated: ${translated.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log('');

  // Sample translations
  console.log('SAMPLE TRANSLATIONS (first 15):');
  console.log('-'.repeat(50));
  translated.slice(0, 15).forEach((t, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${t.lemma_text.padEnd(15)} → ${t.translation}`);
  });

  if (errors.length > 0) {
    console.log('');
    console.log('ERRORS:');
    console.log('-'.repeat(50));
    errors.forEach(e => {
      console.log(`  ${e.lemma_text}: ${e.error}`);
    });
  }

  console.log('');
  console.log('='.repeat(60));
}

main().catch(console.error);
