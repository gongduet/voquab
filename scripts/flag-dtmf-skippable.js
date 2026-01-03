import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

// Patterns for pure vocalizations
function isVocalization(text) {
  const trimmed = text.trim().toLowerCase();

  // Empty or whitespace
  if (!trimmed) return true;

  // Common vocalization patterns
  const vocalizationPatterns = [
    /^(eh[-\s]*)+$/i,
    /^(oh[-\s]*)+$/i,
    /^(ah[-\s]*)+$/i,
    /^(yeh[-\s]*)+$/i,
    /^(yeah[-\s]*)+$/i,
    /^(la[-\s]*)+$/i,
    /^(na[-\s]*)+$/i,
    /^(uh[-\s]*)+$/i,
    /^(mm[-\s]*)+$/i,
    /^(hmm[-\s]*)+$/i,
    /^shh+$/i,
    /^hum+$/i,
  ];

  // Check exact matches for common vocalizations
  const exactVocalizations = [
    'eh-eh, eh-eh, eh-eh, eh-eh',
    'hum',
  ];

  if (exactVocalizations.includes(trimmed)) {
    return true;
  }

  // Check patterns
  for (const pattern of vocalizationPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log('REVIEWING DTMF LINES FOR SKIPPABLE CONTENT');
  console.log('='.repeat(60));
  console.log('');

  // Get all lines for this song
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_id')
    .eq('song_id', SONG_ID);

  const sectionIds = sections.map(s => s.section_id);

  const { data: lines, error } = await supabase
    .from('song_lines')
    .select('line_id, line_order, line_text')
    .in('section_id', sectionIds)
    .order('line_order');

  if (error) {
    console.error('ERROR fetching lines:', error.message);
    return;
  }

  console.log(`Reviewing ${lines.length} lines...`);
  console.log('');

  // Identify skippable lines
  const skippableLines = [];
  const learnableLines = [];

  for (const line of lines) {
    if (isVocalization(line.line_text)) {
      skippableLines.push(line);
    } else {
      learnableLines.push(line);
    }
  }

  console.log('LINES TO FLAG AS SKIPPABLE:');
  console.log('-'.repeat(60));
  if (skippableLines.length === 0) {
    console.log('  (none found)');
  } else {
    for (const line of skippableLines) {
      console.log(`  ${line.line_order.toString().padStart(2)}. "${line.line_text}"`);
    }
  }
  console.log('');

  // Update skippable lines
  if (skippableLines.length > 0) {
    const skippableIds = skippableLines.map(l => l.line_id);
    const { error: updateError } = await supabase
      .from('song_lines')
      .update({ is_skippable: true })
      .in('line_id', skippableIds);

    if (updateError) {
      console.error('ERROR updating lines:', updateError.message);
      return;
    }
    console.log(`Updated ${skippableLines.length} lines to is_skippable = true`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Skippable (vocalizations): ${skippableLines.length}`);
  console.log(`  Learnable (actual lyrics): ${learnableLines.length}`);
  console.log(`  Total:                     ${lines.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
