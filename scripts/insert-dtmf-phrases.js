import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SONG_ID = 'e7590143-7dbb-4396-9824-00296f021f77';

const phrases = [
  {
    phrase_text: "tirar fotos",
    definitions: ["take photos"],
    literal: "throw photos",
    phrase_type: "idiom"
  },
  {
    phrase_text: "dándome patá'",
    definitions: ["beating fast (heart palpitations)"],
    literal: "giving me kicks",
    phrase_type: "idiom"
  },
  {
    phrase_text: "dejar la calle esbaratá",
    definitions: ["party hard, wreck the streets (with partying)"],
    literal: "leave the street destroyed",
    phrase_type: "idiom"
  },
  {
    phrase_text: "tocar el güiro",
    definitions: ["sexual innuendo (touch intimately)"],
    literal: "touch the güiro (instrument)",
    phrase_type: "idiom"
  },
  {
    phrase_text: "se da caña",
    definitions: ["there's action happening, things are popping off"],
    literal: "cane is given",
    phrase_type: "idiom"
  },
  {
    phrase_text: "hablar mierda",
    definitions: ["talk nonsense, say whatever, shoot the shit"],
    literal: "talk shit",
    phrase_type: "idiom"
  },
  {
    phrase_text: "estar pa la movie",
    definitions: ["living the flashy/glamorous lifestyle"],
    literal: "be for the movie",
    phrase_type: "idiom"
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('INSERTING DTMF IDIOMATIC PHRASES');
  console.log('='.repeat(60));
  console.log('');

  // Check for existing phrases
  const phraseTexts = phrases.map(p => p.phrase_text);
  const { data: existingPhrases } = await supabase
    .from('phrases')
    .select('phrase_id, phrase_text')
    .in('phrase_text', phraseTexts);

  const existingMap = new Map(
    (existingPhrases || []).map(p => [p.phrase_text.toLowerCase(), p])
  );

  const toInsert = [];
  const toLink = [];
  const existingLinks = [];

  for (const phrase of phrases) {
    const existing = existingMap.get(phrase.phrase_text.toLowerCase());
    if (existing) {
      existingLinks.push({ phrase, phrase_id: existing.phrase_id });
    } else {
      toInsert.push({
        phrase_text: phrase.phrase_text,
        definitions: phrase.definitions,
        phrase_type: phrase.phrase_type,
        component_lemmas: [],  // Empty for now, can be populated later
        is_reviewed: false
      });
    }
  }

  console.log(`Existing phrases found: ${existingLinks.length}`);
  console.log(`New phrases to insert: ${toInsert.length}`);
  console.log('');

  // Insert new phrases
  let insertedPhrases = [];
  if (toInsert.length > 0) {
    console.log('Inserting new phrases...');
    const { data, error } = await supabase
      .from('phrases')
      .insert(toInsert)
      .select('phrase_id, phrase_text');

    if (error) {
      console.error('ERROR inserting phrases:', error.message);
      return;
    }

    insertedPhrases = data;
    console.log(`✓ Inserted ${insertedPhrases.length} new phrases`);
  }

  // Prepare all links (existing + new)
  const allLinks = [
    ...existingLinks.map(e => ({
      song_id: SONG_ID,
      phrase_id: e.phrase_id,
      occurrence_count: 1
    })),
    ...insertedPhrases.map(p => ({
      song_id: SONG_ID,
      phrase_id: p.phrase_id,
      occurrence_count: 1
    }))
  ];

  // Insert song_phrases links
  console.log('');
  console.log('Creating song_phrases links...');
  const { data: insertedLinks, error: linkError } = await supabase
    .from('song_phrases')
    .insert(allLinks)
    .select();

  if (linkError) {
    console.error('ERROR creating links:', linkError.message);
    return;
  }

  console.log(`✓ Created ${insertedLinks.length} song_phrases links`);

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  New phrases created:     ${insertedPhrases.length}`);
  console.log(`  Existing phrases linked: ${existingLinks.length}`);
  console.log(`  Total song_phrases:      ${insertedLinks.length}`);
  console.log('='.repeat(60));
  console.log('');

  if (insertedPhrases.length > 0) {
    console.log('NEW PHRASES CREATED:');
    console.log('-'.repeat(60));
    insertedPhrases.forEach((p, i) => {
      const original = phrases.find(x => x.phrase_text === p.phrase_text);
      console.log(`  ${i+1}. "${p.phrase_text}"`);
      console.log(`     Meaning: ${original.definitions[0]}`);
      console.log(`     Literal: ${original.literal}`);
      console.log(`     ID: ${p.phrase_id}`);
      console.log('');
    });
  }

  if (existingLinks.length > 0) {
    console.log('EXISTING PHRASES LINKED:');
    console.log('-'.repeat(60));
    existingLinks.forEach((e, i) => {
      console.log(`  ${i+1}. "${e.phrase.phrase_text}" (${e.phrase_id})`);
    });
  }
}

main().catch(console.error);
