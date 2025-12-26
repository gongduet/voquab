#!/usr/bin/env node

/**
 * Verify Lyrics Seed Data
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('🔍 Verifying Lyrics Seed Data\n');

  // Songs
  const { data: songs } = await supabase
    .from('songs')
    .select('song_id, title, artist, total_sections, total_lines, unique_slang_terms');

  console.log('📀 Songs:');
  songs?.forEach(s => {
    console.log(`   - ${s.title} by ${s.artist}`);
    console.log(`     Sections: ${s.total_sections}, Lines: ${s.total_lines}, Slang: ${s.unique_slang_terms}`);
  });

  // Sections
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_order, section_type, section_label, total_lines')
    .order('section_order');

  console.log(`\n📑 Sections: ${sections?.length}`);
  sections?.slice(0, 5).forEach(s => {
    console.log(`   ${s.section_order}. [${s.section_type}] ${s.section_label} (${s.total_lines} lines)`);
  });
  if (sections?.length > 5) console.log(`   ... and ${sections.length - 5} more`);

  // Lines sample
  const { data: lines } = await supabase
    .from('song_lines')
    .select('line_text, translation')
    .limit(5);

  console.log('\n📝 Sample Lines:');
  lines?.forEach(l => {
    console.log(`   "${l.line_text}"`);
    console.log(`    → ${l.translation}`);
  });

  // Slang terms
  const { data: slang } = await supabase
    .from('slang_terms')
    .select('term, definition, region')
    .limit(5);

  console.log('\n🗣️  Sample Slang Terms:');
  slang?.forEach(s => {
    console.log(`   ${s.term}: ${s.definition} (${s.region})`);
  });

  // Links
  const { count: slangLinks } = await supabase
    .from('song_slang')
    .select('*', { count: 'exact', head: true });

  console.log(`\n🔗 Song-Slang Links: ${slangLinks}`);

  console.log('\n✅ Verification complete!');
}

verify();
