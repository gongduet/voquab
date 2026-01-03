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
    target_lang: 'EN-US',
    formality: 'prefer_less'
  });

  const response = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.translations[0].text;
}

async function main() {
  console.log('='.repeat(60));
  console.log('TRANSLATING DTMF LYRICS WITH DEEPL');
  console.log('='.repeat(60));
  console.log('');

  // Get all sections for this song
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_id')
    .eq('song_id', SONG_ID);

  const sectionIds = sections.map(s => s.section_id);

  // Get learnable lines that need translation
  const { data: lines, error } = await supabase
    .from('song_lines')
    .select('line_id, line_order, line_text, translation')
    .in('section_id', sectionIds)
    .eq('is_skippable', false)
    .eq('translation', '')
    .order('line_order');

  if (error) {
    console.error('ERROR fetching lines:', error.message);
    return;
  }

  console.log(`Found ${lines.length} lines to translate`);
  console.log('');

  const errors = [];
  let successCount = 0;

  // Translate each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    process.stdout.write(`Translating line ${line.line_order}... `);

    try {
      const translation = await translateText(line.line_text);

      // Update in database
      const { error: updateError } = await supabase
        .from('song_lines')
        .update({ translation })
        .eq('line_id', line.line_id);

      if (updateError) {
        throw new Error(`DB update failed: ${updateError.message}`);
      }

      line.translation = translation; // Store for report
      successCount++;
      console.log('✓');

      // Small delay to avoid rate limiting
      if (i < lines.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.log('✗');
      errors.push({ line_order: line.line_order, line_text: line.line_text, error: err.message });
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Total lines translated: ${successCount}`);
  console.log('');

  // Sample translations (lines 2, 8, 15, 22, 30, 38, 45, 50, 55, 58)
  const sampleOrders = [2, 8, 15, 22, 30, 38, 45, 50, 55, 58];
  console.log('SAMPLE TRANSLATIONS:');
  console.log('-'.repeat(60));

  for (const order of sampleOrders) {
    const line = lines.find(l => l.line_order === order);
    if (line && line.translation) {
      console.log(`Line ${order}:`);
      console.log(`  ES: ${line.line_text}`);
      console.log(`  EN: ${line.translation}`);
      console.log('');
    }
  }

  // Report errors
  if (errors.length > 0) {
    console.log('ERRORS:');
    console.log('-'.repeat(60));
    for (const err of errors) {
      console.log(`  Line ${err.line_order}: ${err.error}`);
      console.log(`    Text: ${err.line_text}`);
    }
  } else {
    console.log('No errors encountered.');
  }

  console.log('');
  console.log('='.repeat(60));
}

main().catch(console.error);
