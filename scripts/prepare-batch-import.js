import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DTMF_SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

async function main() {
  console.log('='.repeat(60));
  console.log('PREPARING FOR BATCH IMPORT');
  console.log('='.repeat(60));
  console.log('');

  // ============================================================
  // STEP 1: Wipe DTMF song-specific data
  // ============================================================
  console.log('STEP 1: Wipe DTMF song-specific data');
  console.log('-'.repeat(40));

  // Delete song_slang links
  const { data: slangDeleted, error: slangErr } = await supabase
    .from('song_slang')
    .delete()
    .eq('song_id', DTMF_SONG_ID)
    .select();
  console.log(`  song_slang:    ${slangDeleted?.length || 0} deleted ${slangErr ? '✗ ' + slangErr.message : '✓'}`);

  // Delete song_lemmas links
  const { data: lemmasDeleted, error: lemmasErr } = await supabase
    .from('song_lemmas')
    .delete()
    .eq('song_id', DTMF_SONG_ID)
    .select();
  console.log(`  song_lemmas:   ${lemmasDeleted?.length || 0} deleted ${lemmasErr ? '✗ ' + lemmasErr.message : '✓'}`);

  // Delete song_phrases links
  const { data: phrasesDeleted, error: phrasesErr } = await supabase
    .from('song_phrases')
    .delete()
    .eq('song_id', DTMF_SONG_ID)
    .select();
  console.log(`  song_phrases:  ${phrasesDeleted?.length || 0} deleted ${phrasesErr ? '✗ ' + phrasesErr.message : '✓'}`);

  // Get section IDs for DTMF
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_id')
    .eq('song_id', DTMF_SONG_ID);

  const sectionIds = sections?.map(s => s.section_id) || [];

  // Delete song_lines
  let linesDeleted = 0;
  if (sectionIds.length > 0) {
    const { data, error: linesErr } = await supabase
      .from('song_lines')
      .delete()
      .in('section_id', sectionIds)
      .select();
    linesDeleted = data?.length || 0;
    console.log(`  song_lines:    ${linesDeleted} deleted ${linesErr ? '✗ ' + linesErr.message : '✓'}`);
  } else {
    console.log(`  song_lines:    0 deleted (no sections) ✓`);
  }

  // Delete song_sections
  const { data: sectionsDeleted, error: sectionsErr } = await supabase
    .from('song_sections')
    .delete()
    .eq('song_id', DTMF_SONG_ID)
    .select();
  console.log(`  song_sections: ${sectionsDeleted?.length || 0} deleted ${sectionsErr ? '✗ ' + sectionsErr.message : '✓'}`);

  // Reset song counts
  const { error: updateErr } = await supabase
    .from('songs')
    .update({
      total_sections: 0,
      total_lines: 0,
      unique_lemmas: 0,
      unique_slang_terms: 0
    })
    .eq('song_id', DTMF_SONG_ID);
  console.log(`  reset counts:  ${updateErr ? '✗ ' + updateErr.message : '✓'}`);

  console.log('');

  // ============================================================
  // STEP 2: Report current state
  // ============================================================
  console.log('STEP 2: Report current state');
  console.log('-'.repeat(40));

  // Count songs
  const { count: songCount } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true });
  console.log(`  songs:         ${songCount}`);

  // Count sections per song
  const { data: allSections } = await supabase
    .from('song_sections')
    .select('song_id');
  console.log(`  song_sections: ${allSections?.length || 0} total`);

  // Count lines per song
  const { data: allLines } = await supabase
    .from('song_lines')
    .select('line_id');
  console.log(`  song_lines:    ${allLines?.length || 0} total`);

  // Count slang_terms (should still have all 19+)
  const { count: slangCount } = await supabase
    .from('slang_terms')
    .select('*', { count: 'exact', head: true });
  console.log(`  slang_terms:   ${slangCount} (vocabulary preserved)`);

  // Count phrases
  const { count: phraseCount } = await supabase
    .from('phrases')
    .select('*', { count: 'exact', head: true });

  // Count DTMF-related phrases (idiom type)
  const { count: dtmfPhraseCount } = await supabase
    .from('phrases')
    .select('*', { count: 'exact', head: true })
    .eq('phrase_type', 'idiom');
  console.log(`  phrases:       ${phraseCount} total (${dtmfPhraseCount} idioms from DTMF)`);

  console.log('');

  // ============================================================
  // STEP 3: List all songs ready for import
  // ============================================================
  console.log('STEP 3: Songs ready for batch import');
  console.log('-'.repeat(40));

  const { data: songs } = await supabase
    .from('songs')
    .select('song_id, title, total_sections, total_lines')
    .order('title');

  songs.forEach((s, i) => {
    const status = s.total_lines === 0 ? '⏳ needs import' : `✓ ${s.total_lines} lines`;
    console.log(`  ${(i+1).toString().padStart(2)}. ${s.title.padEnd(28)} ${status}`);
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('READY FOR BATCH IMPORT');
  console.log('='.repeat(60));
}

main().catch(console.error);
