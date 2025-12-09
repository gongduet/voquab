#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Call Python lemmatizer
 */
async function lemmatizeWord(word) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [join(__dirname, 'lemmatize.py'), word]);
    let output = '';
    
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.on('close', (code) => {
      if (code !== 0) reject(new Error('Lemmatizer failed'));
      else {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          reject(new Error(`Failed to parse: ${output}`));
        }
      }
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔗 LINKING VOCABULARY FORMS TO LEMMAS');
  console.log('='.repeat(60));

  try {
    // Step 1: Fetch all vocabulary
    console.log('\n📖 Fetching vocabulary...');
    let allVocab = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from('vocabulary')
        .select('vocab_id, lemma, language_code')
        .eq('language_code', 'es')
        .order('lemma')
        .range(from, from + batchSize - 1);
      
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      
      allVocab.push(...batch);
      from += batchSize;
      if (batch.length < batchSize) break;
    }
    
    console.log(`✓ Found ${allVocab.length} vocabulary words`);

    // Step 2: Fetch all lemmas into a map (with pagination)
    console.log('\n📚 Loading lemmas...');
    let allLemmas = [];
    from = 0;

    while (true) {
    const { data: lemmaBatch, error: lemmaError } = await supabase
        .from('vocabulary_lemmas')
        .select('lemma_id, lemma')
        .eq('language_code', 'es')
        .order('lemma')
        .range(from, from + batchSize - 1);
    
    if (lemmaError) throw lemmaError;
    if (!lemmaBatch || lemmaBatch.length === 0) break;
    
    allLemmas.push(...lemmaBatch);
    from += batchSize;
    
    if (lemmaBatch.length < batchSize) break;
    }

    const lemmaMap = new Map();
    allLemmas.forEach(l => lemmaMap.set(l.lemma, l.lemma_id));
    console.log(`✓ Loaded ${allLemmas.length} lemmas`);

    // Step 3: Link each vocabulary word to its lemma
    console.log('\n🔗 Creating vocabulary_forms entries...');
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allVocab.length; i++) {
      const word = allVocab[i];
      
      // Check if form already exists
      const { data: existing } = await supabase
        .from('vocabulary_forms')
        .select('form_id')
        .eq('vocab_id', word.vocab_id)
        .maybeSingle();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // Get lemma via spaCy
      const analysis = await lemmatizeWord(word.lemma);
      const lemmaId = lemmaMap.get(analysis.lemma);
      
      if (!lemmaId) {
        console.log(`  ⚠️  No lemma found for "${word.lemma}" -> "${analysis.lemma}"`);
        errors++;
        continue;
      }
      
      // Create form entry
      const { error: insertError } = await supabase
        .from('vocabulary_forms')
        .insert([{
          vocab_id: word.vocab_id,
          lemma_id: lemmaId,
          word_form: word.lemma,
          form_type: word.lemma === analysis.lemma ? 'canonical' : 'inflected',
          grammatical_info: analysis.morph || {},
        }]);
      
      if (insertError) {
        console.log(`  ❌ Error for "${word.lemma}": ${insertError.message}`);
        errors++;
        continue;
      }
      
      created++;
      
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${allVocab.length} (created: ${created}, skipped: ${skipped}, errors: ${errors})`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ LINKING COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  Forms created: ${created}`);
    console.log(`  Already existed: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Total processed: ${allVocab.length}`);
    
  } catch (error) {
    console.error('\n❌ Linking failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();