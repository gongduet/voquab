#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Call Python lemmatizer for a word
 */
async function lemmatizeWord(word) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [
      join(__dirname, 'lemmatize.py'),
      word
    ]);

    let output = '';
    let error = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Lemmatizer failed: ${error}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse lemmatizer output: ${output}`));
        }
      }
    });
  });
}

/**
 * Apply consolidation to database
 */
async function applyConsolidation(lemmaMap, formsMap) {
  console.log('\n💾 Applying consolidation to database...');
  
  let updated = 0;
  const totalWords = formsMap.size;
  
  for (const [vocab_id, info] of formsMap.entries()) {
    const lemma = info.analysis.lemma;
    const canonicalId = lemmaMap.get(lemma);
    const isCanonical = vocab_id === canonicalId;
    
    // Prepare form metadata
    const formMetadata = {
      pos: info.analysis.pos,
      morph: info.analysis.morph
    };
    
    // Update the word
    const { error } = await supabase
      .from('vocabulary')
      .update({
        canonical_vocab_id: isCanonical ? null : canonicalId,
        is_canonical: isCanonical,
        form_metadata: formMetadata
      })
      .eq('vocab_id', vocab_id);
    
    if (error) {
      console.error(`  Error updating ${info.lemma}:`, error.message);
    } else {
      updated++;
      if (updated % 100 === 0) {
        console.log(`  Updated: ${updated}/${totalWords}...`);
      }
    }
  }
  
  console.log(`✓ Updated ${updated} vocabulary records`);
}

/**
 * Main consolidation function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📚 VOCABULARY CONSOLIDATION');
  console.log('='.repeat(60));

  try {
    // Step 1: Get all Spanish vocabulary (with pagination)
    console.log('\n📖 Fetching vocabulary from database...');
    
    let allVocabulary = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('vocabulary')
        .select('vocab_id, lemma, part_of_speech, english_definition')
        .eq('language_code', 'es')
        .order('lemma')
        .range(from, from + batchSize - 1);
      
      if (error) throw error;
      
      if (batch && batch.length > 0) {
        allVocabulary.push(...batch);
        console.log(`  Fetched ${allVocabulary.length} words so far...`);
        from += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    
    const vocabulary = allVocabulary;
    console.log(`✓ Found ${vocabulary.length} total words`);

    // Step 2: Analyze each word with spaCy
    console.log('\n🔍 Analyzing words with spaCy...');
    
    const lemmaMap = new Map(); // lemma -> canonical vocab_id
    const formsMap = new Map(); // vocab_id -> lemma info
    
    let processed = 0;
    
    for (const word of vocabulary) {
      try {
        const analysis = await lemmatizeWord(word.lemma);
        
        formsMap.set(word.vocab_id, {
          ...word,
          analysis
        });
        
        // Track canonical lemmas - prefer the word that IS the lemma
        const lemma = analysis.lemma;
        if (!lemmaMap.has(lemma)) {
            lemmaMap.set(lemma, word.vocab_id);
        } else if (word.lemma === lemma) {
            // If this word IS the actual lemma, make it canonical (override first occurrence)
            lemmaMap.set(lemma, word.vocab_id);
        }
        
        processed++;
        if (processed % 100 === 0) {
          console.log(`  Progress: ${processed}/${vocabulary.length}...`);
        }
      } catch (err) {
        console.error(`  Error analyzing "${word.lemma}":`, err.message);
      }
    }
    
    console.log(`✓ Analyzed ${processed} words`);
    console.log(`✓ Found ${lemmaMap.size} unique lemmas`);

    // Step 3: Show sample results
    console.log('\n📊 Sample Results:');
    const samples = ['tener', 'tenía', 'tengo', 'tiene', 'libro', 'libros'];
    
    for (const sample of samples) {
      const word = vocabulary.find(v => v.lemma === sample);
      if (word) {
        const info = formsMap.get(word.vocab_id);
        if (info && info.analysis) {
          const morph = info.analysis.morph;
          let grammaticalInfo = '';
          if (morph.Person) grammaticalInfo += ` Person=${morph.Person}`;
          if (morph.Tense) grammaticalInfo += ` Tense=${morph.Tense}`;
          if (morph.Number) grammaticalInfo += ` Number=${morph.Number}`;
          console.log(`  ${sample} -> ${info.analysis.lemma} (${info.analysis.pos})${grammaticalInfo}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`  Total words: ${vocabulary.length}`);
    console.log(`  Unique lemmas: ${lemmaMap.size}`);
    console.log(`  Duplicate forms: ${vocabulary.length - lemmaMap.size}`);

    // Step 4: Apply to database
    const shouldApply = process.argv.includes('--apply');
    
    if (shouldApply) {
      await applyConsolidation(lemmaMap, formsMap);
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ CONSOLIDATION APPLIED TO DATABASE');
      console.log('='.repeat(60));
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  DRY RUN - No changes made to database');
      console.log('='.repeat(60));
      console.log('\nTo apply these changes, run:');
      console.log('  node scripts/consolidate-vocabulary.js --apply');
    }
    
  } catch (error) {
    console.error('\n❌ Consolidation failed!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();