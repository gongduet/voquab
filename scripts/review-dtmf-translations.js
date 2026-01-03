import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

async function main() {
  console.log('='.repeat(60));
  console.log('REVIEWING DTMF TRANSLATIONS WITH CLAUDE');
  console.log('='.repeat(60));
  console.log('');

  // Fetch lines
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_id')
    .eq('song_id', SONG_ID);

  const sectionIds = sections.map(s => s.section_id);

  const { data: lines } = await supabase
    .from('song_lines')
    .select('line_id, line_order, line_text, translation')
    .in('section_id', sectionIds)
    .eq('is_skippable', false)
    .order('line_order');

  console.log(`Fetched ${lines.length} learnable lines`);

  // Fetch slang terms for this song
  const { data: slangData } = await supabase
    .from('song_slang')
    .select(`
      slang_terms (
        term,
        definition,
        standard_equivalent
      )
    `)
    .eq('song_id', SONG_ID);

  const slangTerms = slangData.map(s => s.slang_terms);
  console.log(`Fetched ${slangTerms.length} slang terms`);

  // Fetch phrases for this song
  const { data: phraseData } = await supabase
    .from('song_phrases')
    .select(`
      phrases (
        phrase_text,
        definitions
      )
    `)
    .eq('song_id', SONG_ID);

  const phrases = phraseData.map(p => p.phrases);
  console.log(`Fetched ${phrases.length} phrases`);
  console.log('');

  // Format data for Claude
  const linesText = lines.map(l =>
    `${l.line_order}. ES: "${l.line_text}"\n   EN: "${l.translation}"`
  ).join('\n\n');

  const slangText = slangTerms.map(s =>
    `- "${s.term}" → ${s.definition}${s.standard_equivalent ? ` (standard: ${s.standard_equivalent})` : ''}`
  ).join('\n');

  const phrasesText = phrases.map(p =>
    `- "${p.phrase_text}" → ${p.definitions[0]}`
  ).join('\n');

  const prompt = `Review these Spanish lyrics and their English translations. Fix any translations that are wrong due to:
1. Idiomatic phrases translated literally
2. Puerto Rican slang not recognized
3. Phonetic contractions misunderstood

SLANG TERMS TO WATCH FOR:
${slangText}

IDIOMATIC PHRASES:
${phrasesText}

For each line, respond with:
- line_order
- needs_fix: true/false
- corrected_translation: (only if needs_fix is true)
- fix_reason: brief explanation (only if needs_fix is true)

Return ONLY a JSON array, no markdown formatting or explanation. Example:
[{"line_order": 1, "needs_fix": false}, {"line_order": 2, "needs_fix": true, "corrected_translation": "...", "fix_reason": "..."}]

LYRICS TO REVIEW:
${linesText}`;

  console.log('Sending to Claude API...');
  console.log('');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  });

  let responseText = message.content[0].text.trim();

  // Remove markdown code blocks if present
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  let reviews;
  try {
    reviews = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Claude response as JSON:');
    console.error(responseText.substring(0, 500));
    return;
  }

  // Process fixes
  const fixes = reviews.filter(r => r.needs_fix);
  const unchanged = reviews.filter(r => !r.needs_fix);

  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Total lines reviewed: ${reviews.length}`);
  console.log(`Lines needing fixes:  ${fixes.length}`);
  console.log(`Lines unchanged:      ${unchanged.length}`);
  console.log('');

  if (fixes.length > 0) {
    console.log('FIXES TO APPLY:');
    console.log('-'.repeat(60));

    for (const fix of fixes) {
      const originalLine = lines.find(l => l.line_order === fix.line_order);
      if (!originalLine) continue;

      console.log(`Line ${fix.line_order}:`);
      console.log(`  ES: ${originalLine.line_text}`);
      console.log(`  BEFORE: ${originalLine.translation}`);
      console.log(`  AFTER:  ${fix.corrected_translation}`);
      console.log(`  REASON: ${fix.fix_reason}`);
      console.log('');

      // Update in database
      const { error } = await supabase
        .from('song_lines')
        .update({ translation: fix.corrected_translation })
        .eq('line_id', originalLine.line_id);

      if (error) {
        console.log(`  ERROR updating: ${error.message}`);
      } else {
        console.log(`  ✓ Updated in database`);
      }
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log(`COMPLETE: ${fixes.length} translations fixed`);
  console.log('='.repeat(60));
}

main().catch(console.error);
