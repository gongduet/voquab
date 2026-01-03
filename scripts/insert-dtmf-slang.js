import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

const slangTerms = [
  {
    term: "toda'",
    definition: "all (feminine plural) - dropped 's' ending",
    standard_equivalent: "todas",
    part_of_speech: "adjective",
    formality: "informal"
  },
  {
    term: "Acho",
    definition: "Puerto Rican exclamation expressing surprise or emphasis",
    standard_equivalent: null,
    part_of_speech: "exclamation",
    formality: "informal"
  },
  {
    term: "pelao",
    definition: "bare/exposed - dropped 'd' ending",
    standard_equivalent: "pelado",
    part_of_speech: "adjective",
    formality: "informal"
  },
  {
    term: "matá",
    definition: "beating/hit - dropped 'd' ending",
    standard_equivalent: "matada",
    part_of_speech: "noun",
    formality: "informal"
  },
  {
    term: "patá'",
    definition: "kicks - contracted form",
    standard_equivalent: "patadas",
    part_of_speech: "noun",
    formality: "informal"
  },
  {
    term: "Pa",
    definition: "to/for - phonetic contraction",
    standard_equivalent: "Para",
    part_of_speech: "preposition",
    formality: "informal"
  },
  {
    term: "esbaratá",
    definition: "destroyed/messed up - Puerto Rican variant",
    standard_equivalent: "desbaratada",
    part_of_speech: "adjective",
    formality: "informal"
  },
  {
    term: "cabrón",
    definition: "dude/man - can be positive or negative depending on context",
    standard_equivalent: null,
    part_of_speech: "noun",
    formality: "vulgar"
  },
  {
    term: "blanquita",
    definition: "little white girl - term of endearment",
    standard_equivalent: null,
    part_of_speech: "noun",
    formality: "informal"
  },
  {
    term: "vo'a",
    definition: "I'm going to - phonetic contraction",
    standard_equivalent: "voy a",
    part_of_speech: "phrase",
    formality: "informal"
  },
  {
    term: "to",
    definition: "all - shortened form",
    standard_equivalent: "todo",
    part_of_speech: "adjective",
    formality: "informal"
  },
  {
    term: "Toy",
    definition: "I am - phonetic contraction",
    standard_equivalent: "Estoy",
    part_of_speech: "verb",
    formality: "informal"
  },
  {
    term: "pa",
    definition: "for/to - phonetic contraction (lowercase variant)",
    standard_equivalent: "para",
    part_of_speech: "preposition",
    formality: "informal"
  },
  {
    term: "Vamo",
    definition: "let's go - dropped 's' ending",
    standard_equivalent: "Vamos",
    part_of_speech: "verb",
    formality: "informal"
  },
  {
    term: "corillo",
    definition: "crew/group of friends - Puerto Rican slang",
    standard_equivalent: null,
    part_of_speech: "noun",
    formality: "informal"
  },
  {
    term: "p'acá",
    definition: "over here - phonetic contraction",
    standard_equivalent: "para acá",
    part_of_speech: "phrase",
    formality: "informal"
  },
  {
    term: "pa'l",
    definition: "for the - phonetic contraction",
    standard_equivalent: "para el",
    part_of_speech: "phrase",
    formality: "informal"
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('INSERTING DTMF SLANG TERMS');
  console.log('='.repeat(60));
  console.log('');

  // Check for existing terms to avoid duplicates
  const { data: existingTerms } = await supabase
    .from('slang_terms')
    .select('term, slang_id');

  const existingSet = new Set(existingTerms?.map(t => t.term.toLowerCase()) || []);

  const toInsert = [];
  const duplicates = [];

  for (const slang of slangTerms) {
    if (existingSet.has(slang.term.toLowerCase())) {
      duplicates.push(slang.term);
    } else {
      toInsert.push({
        ...slang,
        region: "Puerto Rico",
        is_approved: false
      });
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate terms (skipping):`);
    duplicates.forEach(d => console.log(`  - ${d}`));
    console.log('');
  }

  // Insert new slang terms
  console.log(`Inserting ${toInsert.length} slang terms...`);

  const { data: insertedTerms, error: insertError } = await supabase
    .from('slang_terms')
    .insert(toInsert)
    .select('slang_id, term');

  if (insertError) {
    console.error('ERROR inserting slang terms:', insertError.message);
    return;
  }

  console.log(`✓ Inserted ${insertedTerms.length} slang terms`);
  console.log('');

  // Link to song via song_slang
  console.log('Creating song_slang links...');

  const songSlangLinks = insertedTerms.map(term => ({
    song_id: SONG_ID,
    slang_id: term.slang_id,
    occurrence_count: 1
  }));

  const { data: insertedLinks, error: linkError } = await supabase
    .from('song_slang')
    .insert(songSlangLinks)
    .select();

  if (linkError) {
    console.error('ERROR creating song_slang links:', linkError.message);
    return;
  }

  console.log(`✓ Created ${insertedLinks.length} song_slang links`);
  console.log('');

  // Update song stats
  const { error: updateError } = await supabase
    .from('songs')
    .update({ unique_slang_terms: insertedTerms.length })
    .eq('song_id', SONG_ID);

  if (updateError) {
    console.error('ERROR updating song stats:', updateError.message);
  } else {
    console.log('✓ Updated song unique_slang_terms count');
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  slang_terms created:  ${insertedTerms.length}`);
  console.log(`  song_slang links:     ${insertedLinks.length}`);
  console.log(`  duplicates skipped:   ${duplicates.length}`);
  console.log('='.repeat(60));
  console.log('');

  // List all inserted terms
  console.log('INSERTED TERMS:');
  console.log('-'.repeat(60));
  insertedTerms.forEach((t, i) => {
    console.log(`  ${(i+1).toString().padStart(2)}. ${t.term.padEnd(15)} ${t.slang_id}`);
  });
}

main().catch(console.error);
