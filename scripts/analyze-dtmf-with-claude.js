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
  console.log('ANALYZING DTMF LYRICS WITH CLAUDE');
  console.log('='.repeat(60));
  console.log('');

  // Get all sections for this song
  const { data: sections } = await supabase
    .from('song_sections')
    .select('section_id')
    .eq('song_id', SONG_ID);

  const sectionIds = sections.map(s => s.section_id);

  // Get learnable lines
  const { data: lines, error } = await supabase
    .from('song_lines')
    .select('line_order, line_text')
    .in('section_id', sectionIds)
    .eq('is_skippable', false)
    .order('line_order');

  if (error) {
    console.error('ERROR fetching lines:', error.message);
    return;
  }

  console.log(`Fetched ${lines.length} learnable lines`);
  console.log('');

  // Format lyrics for Claude
  const lyricsText = lines.map(l => `${l.line_order}. ${l.line_text}`).join('\n');

  const prompt = `Analyze these Puerto Rican Spanish lyrics and identify:

1. SLANG TERMS - Non-standard vocabulary
   - Phonetic contractions (pa', to', -ao/-á endings, Toy, etc.)
   - Regional expressions (Acho, Dime, corillo, etc.)
   - Include: term, standard equivalent, meaning

2. IDIOMATIC PHRASES - Multi-word expressions where literal translation fails
   - Include: phrase, literal meaning, actual meaning
   - Example: "tirar fotos" literally "throw photos" actually "take photos"

3. CULTURAL REFERENCES - Places, names, or concepts needing context
   - Include: reference, brief explanation

Format as JSON:
{
  "slang": [{"term": "...", "standard": "...", "meaning": "..."}],
  "phrases": [{"phrase": "...", "literal": "...", "actual": "..."}],
  "cultural": [{"reference": "...", "explanation": "..."}]
}

LYRICS:
${lyricsText}`;

  console.log('Sending to Claude API...');
  console.log('');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const response = message.content[0].text;

    console.log('='.repeat(60));
    console.log('CLAUDE ANALYSIS');
    console.log('='.repeat(60));
    console.log('');
    console.log(response);
    console.log('');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('Claude API error:', err.message);
  }
}

main().catch(console.error);
