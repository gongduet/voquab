import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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

async function getRowCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`Error counting ${tableName}:`, error.message);
    return -1;
  }
  return count;
}

async function deleteAllFromTable(tableName) {
  // Use a condition that matches all rows
  const { error } = await supabase
    .from(tableName)
    .delete()
    .gte('created_at', '1970-01-01');

  if (error) {
    console.error(`Error deleting from ${tableName}:`, error.message);
    return false;
  }
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('CLEARING ALL SONG-RELATED DATA');
  console.log('='.repeat(60));
  console.log('');

  // Get counts before
  console.log('BEFORE DELETION:');
  console.log('-'.repeat(40));
  const beforeCounts = {};
  for (const table of tables) {
    const count = await getRowCount(table);
    beforeCounts[table] = count;
    console.log(`  ${table.padEnd(25)} ${count} rows`);
  }
  console.log('');

  // Delete in order
  console.log('DELETING DATA...');
  console.log('-'.repeat(40));
  for (const table of tables) {
    if (beforeCounts[table] === 0) {
      console.log(`  ${table.padEnd(25)} skipped (already empty)`);
      continue;
    }

    const success = await deleteAllFromTable(table);
    if (success) {
      console.log(`  ${table.padEnd(25)} ✓ deleted`);
    } else {
      console.log(`  ${table.padEnd(25)} ✗ FAILED`);
    }
  }
  console.log('');

  // Get counts after
  console.log('AFTER DELETION:');
  console.log('-'.repeat(40));
  const afterCounts = {};
  for (const table of tables) {
    const count = await getRowCount(table);
    afterCounts[table] = count;
    const status = count === 0 ? '✓' : '✗ NOT EMPTY';
    console.log(`  ${table.padEnd(25)} ${count} rows ${status}`);
  }
  console.log('');

  // Summary
  console.log('SUMMARY:');
  console.log('-'.repeat(40));
  let totalDeleted = 0;
  for (const table of tables) {
    const deleted = beforeCounts[table] - afterCounts[table];
    if (deleted > 0) {
      totalDeleted += deleted;
      console.log(`  ${table.padEnd(25)} ${deleted} rows deleted`);
    }
  }
  console.log('');
  console.log(`Total rows deleted: ${totalDeleted}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
