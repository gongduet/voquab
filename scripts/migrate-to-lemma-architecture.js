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

const DEEPL_API_KEY = process.env.VITE_DEEPL_API_KEY;

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

/**
 * Translate using DeepL
 */
async function translateWithDeepL(text, sourceLang = 'ES', targetLang = 'EN') {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: text,
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error) {
    console.error(`DeepL translation failed for "${text}":`, error.message);
    return text; // Fallback to original
  }
}

/**
 * Main migration
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📚 MIGRATING TO LEMMA ARCHITECTURE');
  console.log('='.repeat(60));

  try {
    // Step 1: Fetch all vocabulary with consolidation data
    console.log('\n📖 Fetching vocabulary...');
    let allVocab = [];
    let from = 0;
    const batchSize = 1000;
    
    while (true) {
      const { data: batch, error } = await supabase
        .from('vocabulary')
        .select('vocab_id, lemma, english_definition, part_of_speech, gender, frequency, canonical_vocab_id, is_canonical, form_metadata')
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

    // Step 2: Group by lemma using spaCy analysis
    console.log('\n🔍 Analyzing and grouping by lemma...');
    const lemmaGroups = new Map(); // lemma -> [words]
    
    for (let i = 0; i < allVocab.length; i++) {
      const word = allVocab[i];
      
      // Get lemma from form_metadata if available, otherwise analyze
      let lemma;
      let pos;
      
      if (word.form_metadata && word.form_metadata.pos) {
        // Use spaCy lemma from consolidation
        const analysis = await lemmatizeWord(word.lemma);
        lemma = analysis.lemma;
        pos = analysis.pos;
      } else {
        // Re-analyze
        const analysis = await lemmatizeWord(word.lemma);
        lemma = analysis.lemma;
        pos = analysis.pos;
      }
      
      if (!lemmaGroups.has(lemma)) {
        lemmaGroups.set(lemma, []);
      }
      
      lemmaGroups.get(lemma).push({
        ...word,
        analyzed_lemma: lemma,
        analyzed_pos: pos
      });
      
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${allVocab.length}...`);
      }
    }
    
    console.log(`✓ Found ${lemmaGroups.size} unique lemmas`);

    // Step 3: Create lemmas in vocabulary_lemmas
    console.log('\n💾 Creating lemma entries...');
    let lemmasCreated = 0;
    let lemmasAlreadyExist = 0;
    const lemmaIdMap = new Map(); // lemma_text -> lemma_id
    
    for (const [lemmaText, words] of lemmaGroups.entries()) {
      // Find the canonical word (the one that IS the lemma)
      const canonicalWord = words.find(w => w.lemma === lemmaText) || words[0];
      
      // Check if lemma already exists
      const { data: existingLemma } = await supabase
        .from('vocabulary_lemmas')
        .select('lemma_id')
        .eq('lemma', lemmaText)
        .eq('language_code', 'es')
        .maybeSingle();
      
      if (existingLemma) {
        lemmaIdMap.set(lemmaText, existingLemma.lemma_id);
        lemmasAlreadyExist++;
        continue;
      }
      
      // Translate the lemma if needed
      let englishDefinition = canonicalWord.english_definition;
      
      // If the canonical word doesn't exist in book, translate the lemma
      if (!words.find(w => w.lemma === lemmaText)) {
        console.log(`  Creating missing lemma: ${lemmaText}`);
        englishDefinition = await translateWithDeepL(lemmaText);
      }
      
      // Insert lemma
      const { data: newLemma, error: insertError } = await supabase
        .from('vocabulary_lemmas')
        .insert([{
          lemma: lemmaText,
          language_code: 'es',
          part_of_speech: canonicalWord.analyzed_pos,
          english_definition: englishDefinition,
          gender: canonicalWord.gender,
        }])
        .select('lemma_id')
        .single();
      
      if (insertError) {
        console.error(`  Error creating lemma "${lemmaText}":`, insertError.message);
        continue;
      }
      
      lemmaIdMap.set(lemmaText, newLemma.lemma_id);
      lemmasCreated++;
      
      if (lemmasCreated % 50 === 0) {
        console.log(`  Created: ${lemmasCreated}/${lemmaGroups.size}...`);
      }
    }
    
    console.log(`✓ Created ${lemmasCreated} new lemmas`);
    if (lemmasAlreadyExist > 0) {
      console.log(`  (${lemmasAlreadyExist} already existed)`);
    }

    // Step 4: Create vocabulary_forms entries
    console.log('\n🔗 Creating vocabulary forms...');
    let formsCreated = 0;
    
    for (let i = 0; i < allVocab.length; i++) {
      const word = allVocab[i];
      const analysis = await lemmatizeWord(word.lemma);
      const lemmaId = lemmaIdMap.get(analysis.lemma);
      
      if (!lemmaId) {
        console.error(`  No lemma_id found for "${word.lemma}" -> "${analysis.lemma}"`);
        continue;
      }
      
      // Check if form already exists
      const { data: existingForm } = await supabase
        .from('vocabulary_forms')
        .select('form_id')
        .eq('vocab_id', word.vocab_id)
        .maybeSingle();
      
      if (existingForm) continue;
      
      // Create form
      const { error: formError } = await supabase
        .from('vocabulary_forms')
        .insert([{
          vocab_id: word.vocab_id,
          lemma_id: lemmaId,
          word_form: word.lemma,
          form_type: word.lemma === analysis.lemma ? 'canonical' : 'inflected',
          grammatical_info: word.form_metadata || analysis.morph,
        }]);
      
      if (formError) {
        console.error(`  Error creating form for "${word.lemma}":`, formError.message);
        continue;
      }
      
      formsCreated++;
      
      if ((i + 1) % 100 === 0) {
        console.log(`  Created: ${formsCreated}/${allVocab.length}...`);
      }
    }
    
    console.log(`✓ Created ${formsCreated} vocabulary forms`);

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  Lemmas created: ${lemmasCreated}`);
    console.log(`  Forms created: ${formsCreated}`);
    console.log(`  Total vocabulary: ${allVocab.length}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();