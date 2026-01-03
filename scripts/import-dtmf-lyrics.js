import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';
const LYRICS_FILE = 'docs/Lyrics/Debí Tirar Más Fotos - Album.txt';

async function main() {
  console.log('='.repeat(60));
  console.log('IMPORTING DTMF LYRICS');
  console.log('='.repeat(60));
  console.log('');

  // Read the file
  const content = readFileSync(LYRICS_FILE, 'utf-8');
  const allLines = content.split('\n');

  // Find DTMF section (starts with "Song Title: DTMF")
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim() === 'Song Title: DTMF') {
      startLine = i + 2; // Skip the title line and blank line after it
    }
    if (startLine > 0 && allLines[i].trim().startsWith('Song Title:') && i > startLine) {
      endLine = i - 1; // Line before next song title
      break;
    }
  }

  // If no next song, go to end of file
  if (endLine === -1) {
    endLine = allLines.length - 1;
  }

  // Extract lyrics lines (skip empty lines at start/end)
  let lyrics = allLines.slice(startLine, endLine + 1);

  // Trim trailing empty lines
  while (lyrics.length > 0 && lyrics[lyrics.length - 1].trim() === '') {
    lyrics.pop();
  }

  // Filter out completely empty lines but keep the content
  lyrics = lyrics.filter(line => line.trim() !== '');

  console.log(`Found ${lyrics.length} lyric lines`);
  console.log('');

  // Step 1: Create section
  console.log('Step 1: Creating section...');
  const { data: section, error: sectionError } = await supabase
    .from('song_sections')
    .insert({
      song_id: SONG_ID,
      section_type: 'full_song',
      section_order: 1,
      section_label: 'Full Lyrics (pending section split)',
      is_skippable: false,
      total_lines: lyrics.length
    })
    .select()
    .single();

  if (sectionError) {
    console.error('ERROR creating section:', sectionError.message);
    return;
  }

  console.log(`  Section created: ${section.section_id}`);
  console.log('');

  // Step 2: Insert lines
  console.log('Step 2: Inserting lines...');
  const linesToInsert = lyrics.map((line, index) => ({
    section_id: section.section_id,
    line_order: index + 1,
    line_text: line,
    translation: '',
    is_skippable: false
  }));

  const { data: insertedLines, error: linesError } = await supabase
    .from('song_lines')
    .insert(linesToInsert)
    .select('line_id, line_order, line_text');

  if (linesError) {
    console.error('ERROR inserting lines:', linesError.message);
    return;
  }

  console.log(`  Inserted ${insertedLines.length} lines`);
  console.log('');

  // Step 3: Update song stats
  console.log('Step 3: Updating song stats...');
  const { error: updateError } = await supabase
    .from('songs')
    .update({
      total_sections: 1,
      total_lines: insertedLines.length
    })
    .eq('song_id', SONG_ID);

  if (updateError) {
    console.error('ERROR updating song:', updateError.message);
    return;
  }

  console.log('  Song stats updated');
  console.log('');

  // Report results
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Section ID: ${section.section_id}`);
  console.log(`Total lines imported: ${insertedLines.length}`);
  console.log('');

  console.log('FIRST 5 LINES:');
  console.log('-'.repeat(40));
  insertedLines.slice(0, 5).forEach(line => {
    console.log(`  ${line.line_order}. ${line.line_text}`);
  });

  console.log('');
  console.log('LAST 5 LINES:');
  console.log('-'.repeat(40));
  insertedLines.slice(-5).forEach(line => {
    console.log(`  ${line.line_order}. ${line.line_text}`);
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('SUCCESS');
  console.log('='.repeat(60));
}

main().catch(console.error);
