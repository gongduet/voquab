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
  console.log('EXTRACTING LEMMAS FROM DTMF LYRICS');
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
    .select('line_text')
    .in('section_id', sectionIds)
    .eq('is_skippable', false)
    .order('line_order');

  const allText = lines.map(l => l.line_text).join('\n');
  console.log(`Processing ${lines.length} lines of lyrics`);
  console.log('');

  // Use Claude to extract lemmas
  const prompt = `Extract all Spanish vocabulary words from these lyrics and return their lemma (dictionary form).

Rules:
- Convert verbs to infinitive form (tengo → tener, estoy → estar, veo → ver)
- Convert nouns/adjectives to singular masculine (fotos → foto, bonitas → bonito)
- Skip: punctuation, numbers, single letters, names of people/places
- Skip: English words and interjections (ey, eh, oh, ah, yeah)
- Include: contractions as their full form (vo'a → ir, pa → para, to → todo)
- Include: slang with their standard lemma if applicable

Return ONLY a JSON array of unique lemmas, lowercase, sorted alphabetically. No explanations.
Example: ["abrazar", "amor", "bailar", "bonito"]

LYRICS:
${allText}`;

  console.log('Asking Claude to extract lemmas...');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  let responseText = message.content[0].text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  let extractedLemmas;
  try {
    extractedLemmas = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Claude response:', responseText.substring(0, 500));
    return;
  }

  console.log(`Claude extracted ${extractedLemmas.length} unique lemmas`);
  console.log('');

  // Fetch existing lemmas from database
  console.log('Checking against existing lemmas table...');
  const { data: existingLemmas, error: lemmaError } = await supabase
    .from('lemmas')
    .select('lemma_id, lemma_text');

  if (lemmaError) {
    console.error('Error fetching lemmas:', lemmaError.message);
    return;
  }

  const existingMap = new Map(
    (existingLemmas || []).map(l => [l.lemma_text.toLowerCase(), l])
  );

  console.log(`Database has ${existingLemmas.length} existing lemmas`);
  console.log('');

  // Categorize lemmas
  const sharedLemmas = [];
  const newLemmas = [];

  for (const lemma of extractedLemmas) {
    const normalized = lemma.toLowerCase().trim();
    if (existingMap.has(normalized)) {
      sharedLemmas.push({ lemma: normalized, lemma_id: existingMap.get(normalized).lemma_id });
    } else {
      newLemmas.push(normalized);
    }
  }

  console.log(`Shared with El Principito: ${sharedLemmas.length}`);
  console.log(`New (song-specific): ${newLemmas.length}`);
  console.log('');

  // Insert new lemmas
  let insertedLemmas = [];
  if (newLemmas.length > 0) {
    console.log('Inserting new lemmas...');
    const toInsert = newLemmas.map(lemma => ({
      lemma_text: lemma,
      language_code: 'es',
      definitions: [],    // To be translated later
      is_reviewed: false
    }));

    const { data, error } = await supabase
      .from('lemmas')
      .insert(toInsert)
      .select('lemma_id, lemma_text');

    if (error) {
      console.error('ERROR inserting lemmas:', error.message);
      // Continue with shared lemmas
    } else {
      insertedLemmas = data;
      console.log(`✓ Inserted ${insertedLemmas.length} new lemmas`);
    }
  }

  // Create song_lemmas links
  console.log('');
  console.log('Creating song_lemmas links...');

  const allLinks = [
    ...sharedLemmas.map(l => ({
      song_id: SONG_ID,
      lemma_id: l.lemma_id,
      occurrence_count: 1
    })),
    ...insertedLemmas.map(l => ({
      song_id: SONG_ID,
      lemma_id: l.lemma_id,
      occurrence_count: 1
    }))
  ];

  const { data: insertedLinks, error: linkError } = await supabase
    .from('song_lemmas')
    .insert(allLinks)
    .select();

  if (linkError) {
    console.error('ERROR creating links:', linkError.message);
  } else {
    console.log(`✓ Created ${insertedLinks.length} song_lemmas links`);
  }

  // Update song stats
  const { error: updateError } = await supabase
    .from('songs')
    .update({ unique_lemmas: allLinks.length })
    .eq('song_id', SONG_ID);

  if (!updateError) {
    console.log('✓ Updated song unique_lemmas count');
  }

  // Report
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total unique lemmas in DTMF:     ${extractedLemmas.length}`);
  console.log(`Shared with El Principito:       ${sharedLemmas.length}`);
  console.log(`New (song-specific):             ${newLemmas.length}`);
  console.log(`song_lemmas links created:       ${insertedLinks?.length || 0}`);
  console.log('='.repeat(60));
  console.log('');

  // Sample shared lemmas
  console.log('SAMPLE SHARED LEMMAS (cross-content learning):');
  console.log('-'.repeat(40));
  sharedLemmas.slice(0, 10).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.lemma}`);
  });
  console.log('');

  // Sample new lemmas
  if (newLemmas.length > 0) {
    console.log('SAMPLE NEW LEMMAS (song-specific):');
    console.log('-'.repeat(40));
    newLemmas.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i+1}. ${l}`);
    });
  }
}

main().catch(console.error);
