import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = [
  'user_song_progress',
  'user_line_progress',
  'user_slang_progress',
  'song_slang',
  'song_lemmas',
  'song_phrases',
  'song_lines',
  'song_sections',
  'songs',
  'slang_terms'
];

async function main() {
  console.log('='.repeat(50));
  console.log('FINAL VERIFICATION - ALL SONG TABLES');
  console.log('='.repeat(50));
  console.log('');

  let allEmpty = true;

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`  ${table.padEnd(25)} ERROR: ${error.message}`);
      allEmpty = false;
    } else {
      const status = count === 0 ? '✓ EMPTY' : `✗ ${count} rows remaining`;
      console.log(`  ${table.padEnd(25)} ${status}`);
      if (count > 0) allEmpty = false;
    }
  }

  console.log('');
  console.log('='.repeat(50));
  if (allEmpty) {
    console.log('SUCCESS: All song-related tables are empty');
  } else {
    console.log('WARNING: Some tables still contain data');
  }
  console.log('='.repeat(50));
}

main().catch(console.error);
