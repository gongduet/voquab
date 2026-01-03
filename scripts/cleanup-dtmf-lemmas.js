import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

async function main() {
  console.log('='.repeat(60));
  console.log('DTMF LEMMA CLEANUP');
  console.log('='.repeat(60));
  console.log('');

  // Track results
  const results = {
    deletedLemmas: [],
    movedToSlang: [],
    fixedTranslations: [],
    errors: []
  };

  // ============================================================
  // STEP 1: Delete duplicates (already in slang_terms)
  // ============================================================
  console.log('STEP 1: Delete duplicates (corillo, cabrón)');
  console.log('-'.repeat(40));

  const duplicates = ['corillo', 'cabrón'];

  for (const lemmaText of duplicates) {
    // Get lemma_id
    const { data: lemma } = await supabase
      .from('lemmas')
      .select('lemma_id')
      .eq('lemma_text', lemmaText)
      .single();

    if (!lemma) {
      console.log(`  ${lemmaText}: not found in lemmas, skipping`);
      continue;
    }

    // Delete song_lemmas link
    const { error: linkError } = await supabase
      .from('song_lemmas')
      .delete()
      .eq('lemma_id', lemma.lemma_id)
      .eq('song_id', SONG_ID);

    if (linkError) {
      results.errors.push(`song_lemmas delete for ${lemmaText}: ${linkError.message}`);
    }

    // Delete lemma
    const { error: lemmaError } = await supabase
      .from('lemmas')
      .delete()
      .eq('lemma_id', lemma.lemma_id);

    if (lemmaError) {
      results.errors.push(`lemma delete for ${lemmaText}: ${lemmaError.message}`);
    } else {
      results.deletedLemmas.push(lemmaText);
      console.log(`  ✓ ${lemmaText} deleted from lemmas`);
    }
  }
  console.log('');

  // ============================================================
  // STEP 2: Move to slang_terms (cojón, blanquito)
  // ============================================================
  console.log('STEP 2: Move to slang_terms (cojón, blanquito)');
  console.log('-'.repeat(40));

  const moveToSlang = [
    {
      lemma_text: 'cojón',
      slang: {
        term: 'cojón',
        definition: 'balls, testicles',
        formality: 'vulgar',
        region: 'Puerto Rico',
        part_of_speech: 'noun',
        is_approved: false
      }
    },
    {
      lemma_text: 'blanquito',
      slang: {
        term: 'blanquito',
        definition: 'little white one (term of endearment)',
        formality: 'informal',
        region: 'Puerto Rico',
        standard_equivalent: 'blanco',
        part_of_speech: 'noun',
        is_approved: false
      }
    }
  ];

  for (const item of moveToSlang) {
    // Get lemma_id
    const { data: lemma } = await supabase
      .from('lemmas')
      .select('lemma_id')
      .eq('lemma_text', item.lemma_text)
      .single();

    if (!lemma) {
      console.log(`  ${item.lemma_text}: not found in lemmas, skipping`);
      continue;
    }

    // Insert into slang_terms
    const { data: newSlang, error: slangError } = await supabase
      .from('slang_terms')
      .insert(item.slang)
      .select('slang_id')
      .single();

    if (slangError) {
      results.errors.push(`slang insert for ${item.lemma_text}: ${slangError.message}`);
      continue;
    }

    // Create song_slang link
    const { error: linkError } = await supabase
      .from('song_slang')
      .insert({
        song_id: SONG_ID,
        slang_id: newSlang.slang_id,
        occurrence_count: 1
      });

    if (linkError) {
      results.errors.push(`song_slang insert for ${item.lemma_text}: ${linkError.message}`);
    }

    // Delete song_lemmas link
    await supabase
      .from('song_lemmas')
      .delete()
      .eq('lemma_id', lemma.lemma_id)
      .eq('song_id', SONG_ID);

    // Delete from lemmas
    const { error: deleteError } = await supabase
      .from('lemmas')
      .delete()
      .eq('lemma_id', lemma.lemma_id);

    if (deleteError) {
      results.errors.push(`lemma delete for ${item.lemma_text}: ${deleteError.message}`);
    } else {
      results.movedToSlang.push(item.lemma_text);
      console.log(`  ✓ ${item.lemma_text} → slang_terms (${item.slang.formality})`);
    }
  }
  console.log('');

  // ============================================================
  // STEP 3: Fix translations
  // ============================================================
  console.log('STEP 3: Fix translations');
  console.log('-'.repeat(40));

  const fixes = [
    { lemma_text: 'bomba', definition: 'bomba (Puerto Rican folk music/dance)' },
    { lemma_text: 'plena', definition: 'plena (Puerto Rican folk music)' },
    { lemma_text: 'cerquito', definition: 'nearby, close by' },
    { lemma_text: 'perreo', definition: 'perreo (reggaeton dancing style)' },
    { lemma_text: 'güiro', definition: 'güiro (gourd percussion instrument)' },
    { lemma_text: 'nene', definition: 'baby, kid' }
  ];

  for (const fix of fixes) {
    const { error } = await supabase
      .from('lemmas')
      .update({ definitions: [fix.definition] })
      .eq('lemma_text', fix.lemma_text);

    if (error) {
      results.errors.push(`translation fix for ${fix.lemma_text}: ${error.message}`);
    } else {
      results.fixedTranslations.push(fix.lemma_text);
      console.log(`  ✓ ${fix.lemma_text} → "${fix.definition}"`);
    }
  }
  console.log('');

  // ============================================================
  // STEP 4: Delete erroneous lemma (alle)
  // ============================================================
  console.log('STEP 4: Delete erroneous lemma (alle)');
  console.log('-'.repeat(40));

  const { data: alleLemma } = await supabase
    .from('lemmas')
    .select('lemma_id')
    .eq('lemma_text', 'alle')
    .single();

  if (alleLemma) {
    // Delete song_lemmas link
    await supabase
      .from('song_lemmas')
      .delete()
      .eq('lemma_id', alleLemma.lemma_id)
      .eq('song_id', SONG_ID);

    // Delete lemma
    const { error } = await supabase
      .from('lemmas')
      .delete()
      .eq('lemma_id', alleLemma.lemma_id);

    if (error) {
      results.errors.push(`delete alle: ${error.message}`);
    } else {
      results.deletedLemmas.push('alle');
      console.log(`  ✓ alle deleted (extraction error)`);
    }
  } else {
    console.log(`  alle not found, skipping`);
  }
  console.log('');

  // ============================================================
  // STEP 5: Update counts
  // ============================================================
  console.log('STEP 5: Update counts');
  console.log('-'.repeat(40));

  // Count song_lemmas
  const { count: lemmaCount } = await supabase
    .from('song_lemmas')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', SONG_ID);

  // Count song_slang
  const { count: slangCount } = await supabase
    .from('song_slang')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', SONG_ID);

  // Update songs table
  const { error: updateError } = await supabase
    .from('songs')
    .update({
      unique_lemmas: lemmaCount,
      unique_slang_terms: slangCount
    })
    .eq('song_id', SONG_ID);

  if (updateError) {
    results.errors.push(`update counts: ${updateError.message}`);
  } else {
    console.log(`  ✓ unique_lemmas: ${lemmaCount}`);
    console.log(`  ✓ unique_slang_terms: ${slangCount}`);
  }
  console.log('');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Deleted from lemmas:      ${results.deletedLemmas.length} (${results.deletedLemmas.join(', ')})`);
  console.log(`Moved to slang_terms:     ${results.movedToSlang.length} (${results.movedToSlang.join(', ')})`);
  console.log(`Fixed translations:       ${results.fixedTranslations.length}`);
  console.log(`Errors:                   ${results.errors.length}`);
  console.log('');
  console.log('FINAL COUNTS FOR DTMF:');
  console.log(`  unique_lemmas:          ${lemmaCount}`);
  console.log(`  unique_slang_terms:     ${slangCount}`);

  if (results.errors.length > 0) {
    console.log('');
    console.log('ERRORS:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(60));
}

main().catch(console.error);
