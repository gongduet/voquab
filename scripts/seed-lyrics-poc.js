#!/usr/bin/env node

/**
 * Seed Lyrics POC Data
 * Inserts "Debí Tirar Más Fotos" by Bad Bunny
 *
 * Usage: node scripts/seed-lyrics-poc.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ============================================
// SONG DATA
// ============================================

const songData = {
  title: "Debí Tirar Más Fotos",
  artist: "Bad Bunny",
  album: "DtMF",
  release_year: 2025,
  difficulty: "intermediate",
  dialect: "Puerto Rican Spanish",
  themes: ['nostalgia', 'memory', 'home', 'friendship'],
  is_published: true,
  total_sections: 14,
  total_lines: 46,
  unique_slang_terms: 38
};

// ============================================
// SECTIONS DATA
// Based on spec: 14 sections
// ============================================

const sectionsData = [
  { section_order: 1, section_type: 'intro', section_label: 'Intro', is_skippable: true },
  { section_order: 2, section_type: 'verse', section_label: 'Verse 1 - Nostalgia', is_skippable: false },
  { section_order: 3, section_type: 'pre_chorus', section_label: 'Pre-Chorus', is_skippable: false },
  { section_order: 4, section_type: 'verse', section_label: 'Verse 2 - Party', is_skippable: false },
  { section_order: 5, section_type: 'verse', section_label: 'Verse 3 - Romance', is_skippable: false },
  { section_order: 6, section_type: 'chorus', section_label: 'Chorus', is_skippable: false },
  { section_order: 7, section_type: 'chorus', section_label: 'Chorus (repeat)', is_skippable: false, is_repeat: true, repeat_of: 6 },
  { section_order: 8, section_type: 'verse', section_label: 'Verse 4 - Abuelo', is_skippable: false },
  { section_order: 9, section_type: 'verse', section_label: 'Verse 5 - Santurce', is_skippable: false },
  { section_order: 10, section_type: 'verse', section_label: 'Verse 6 - Loco', is_skippable: false },
  { section_order: 11, section_type: 'interlude', section_label: 'Spoken Interlude', is_skippable: false },
  { section_order: 12, section_type: 'verse', section_label: 'Verse 7 - Reflection', is_skippable: false },
  { section_order: 13, section_type: 'chorus', section_label: 'Chorus (variation)', is_skippable: false },
  { section_order: 14, section_type: 'outro', section_label: 'Outro', is_skippable: false }
];

// ============================================
// LINES DATA
// Placeholder - needs actual lyrics with translations
// ============================================

const linesData = {
  // Section 1: Intro (1 line, skippable)
  1: [
    { line_order: 1, line_text: "Eh-eh-eh", translation: "(Vocalization)", is_skippable: true }
  ],

  // Section 2: Verse 1 - Nostalgia (4 lines)
  2: [
    { line_order: 1, line_text: "Debí tirar más fotos", translation: "I should have taken more photos", cultural_note: "tirar fotos = Puerto Rican for 'take photos'" },
    { line_order: 2, line_text: "De cuando te tuve", translation: "When I had you" },
    { line_order: 3, line_text: "Debí haberme quedado", translation: "I should have stayed" },
    { line_order: 4, line_text: "En los momentos que viví", translation: "In the moments I lived" }
  ],

  // Section 3: Pre-Chorus (5 lines)
  3: [
    { line_order: 1, line_text: "Ahora to' el mundo quiere tirar pa'l cielo", translation: "Now everyone wants to reach for the sky" },
    { line_order: 2, line_text: "Y olvidarse de la tierra", translation: "And forget about the land" },
    { line_order: 3, line_text: "Pero pa' arriba llegar", translation: "But to get up there" },
    { line_order: 4, line_text: "Primero hay que bajarse", translation: "First you have to get down" },
    { line_order: 5, line_text: "De los tacones y pisar la arena", translation: "From the heels and step on the sand" }
  ],

  // Section 4: Verse 2 - Party (5 lines)
  4: [
    { line_order: 1, line_text: "Acho, recuerdo cuando", translation: "Man, I remember when", cultural_note: "Acho = Puerto Rican exclamation, like 'man' or 'dude'" },
    { line_order: 2, line_text: "Íbamos a vacilar", translation: "We would go out to party" },
    { line_order: 3, line_text: "El corillo completo", translation: "The whole crew", cultural_note: "corillo = Puerto Rican for 'group of friends'" },
    { line_order: 4, line_text: "Sin nada que perder", translation: "With nothing to lose" },
    { line_order: 5, line_text: "Y to' por ganar", translation: "And everything to gain" }
  ],

  // Section 5: Verse 3 - Romance (5 lines)
  5: [
    { line_order: 1, line_text: "De cuando la blanquita", translation: "When the light-skinned girl", cultural_note: "blanquita = term of endearment for light-skinned woman" },
    { line_order: 2, line_text: "Me llevó a su casa", translation: "Took me to her house" },
    { line_order: 3, line_text: "Y me enseñó a bailar bomba", translation: "And taught me to dance bomba", cultural_note: "bomba = traditional Puerto Rican dance" },
    { line_order: 4, line_text: "Con el güiro de fondo", translation: "With the güiro in the background", cultural_note: "güiro = traditional percussion instrument" },
    { line_order: 5, line_text: "Batiendo como batá", translation: "Beating like a batá", cultural_note: "batá = sacred drum from Santería tradition" }
  ],

  // Section 6: Chorus (4 lines)
  6: [
    { line_order: 1, line_text: "Debí tirar más fotos", translation: "I should have taken more photos" },
    { line_order: 2, line_text: "Debí quedarme un rato más", translation: "I should have stayed a while longer" },
    { line_order: 3, line_text: "Pero vivo mirando pa' alante", translation: "But I live looking forward" },
    { line_order: 4, line_text: "Y se me olvida mirar pa' atrás", translation: "And I forget to look back" }
  ],

  // Section 7: Chorus repeat (references section 6)
  7: [],

  // Section 8: Verse 4 - Abuelo (4 lines)
  8: [
    { line_order: 1, line_text: "Mi abuelo me decía", translation: "My grandfather used to tell me" },
    { line_order: 2, line_text: "'Nene, disfruta mientras puedas'", translation: "'Kid, enjoy while you can'" },
    { line_order: 3, line_text: "Que la vida pasa volando", translation: "That life flies by" },
    { line_order: 4, line_text: "Como plena en Navidades", translation: "Like plena at Christmas", cultural_note: "plena = traditional Puerto Rican folk music" }
  ],

  // Section 9: Verse 5 - Santurce (5 lines)
  9: [
    { line_order: 1, line_text: "Por Santurce caminando", translation: "Walking through Santurce", cultural_note: "Santurce = neighborhood in San Juan, Puerto Rico" },
    { line_order: 2, line_text: "Sin prisa, chequéate", translation: "No rush, check it out", cultural_note: "chequéate = Spanglish from 'check'" },
    { line_order: 3, line_text: "La calle se da caña", translation: "The street is going hard", cultural_note: "darse caña = to go hard/party hard" },
    { line_order: 4, line_text: "To' el mundo sabe llegarle", translation: "Everyone knows how to get there", cultural_note: "llegarle = to approach/handle" },
    { line_order: 5, line_text: "A la vida loca", translation: "To the crazy life" }
  ],

  // Section 10: Verse 6 - Loco (4 lines)
  10: [
    { line_order: 1, line_text: "Toy loco pero toy cuerdo", translation: "I'm crazy but I'm sane", cultural_note: "Toy = estoy (I am) - dropped 'es'" },
    { line_order: 2, line_text: "Sé lo que quiero", translation: "I know what I want" },
    { line_order: 3, line_text: "Vamo' pa' la movie", translation: "Let's go to the movie", cultural_note: "pa la movie = for the movies/having a good time" },
    { line_order: 4, line_text: "Que aquí nadie es serio", translation: "Because nobody here is serious" }
  ],

  // Section 11: Spoken Interlude (7 lines)
  11: [
    { line_order: 1, line_text: "Yo nací en Vega Baja", translation: "I was born in Vega Baja", cultural_note: "Bad Bunny's hometown in Puerto Rico" },
    { line_order: 2, line_text: "Pero crecí en to' Puerto Rico", translation: "But I grew up in all of Puerto Rico" },
    { line_order: 3, line_text: "Crecí con los panas", translation: "I grew up with my buddies", cultural_note: "pana = friend/buddy in Puerto Rico" },
    { line_order: 4, line_text: "Con la música de la calle", translation: "With the music of the street" },
    { line_order: 5, line_text: "Con reggaetón y con salsa", translation: "With reggaeton and salsa" },
    { line_order: 6, line_text: "Con la playa y el monte", translation: "With the beach and the mountain" },
    { line_order: 7, line_text: "Con todo lo que somos", translation: "With everything we are" }
  ],

  // Section 12: Verse 7 - Reflection (5 lines)
  12: [
    { line_order: 1, line_text: "Ahora que estoy lejos", translation: "Now that I'm far away" },
    { line_order: 2, line_text: "Pienso en lo que dejé", translation: "I think about what I left behind" },
    { line_order: 3, line_text: "Y aunque tengo to' el dinero", translation: "And even though I have all the money" },
    { line_order: 4, line_text: "No compra lo que perdí", translation: "It doesn't buy what I lost" },
    { line_order: 5, line_text: "Debí tirar más fotos", translation: "I should have taken more photos" }
  ],

  // Section 13: Chorus variation (4 lines)
  13: [
    { line_order: 1, line_text: "Debí tirar más fotos", translation: "I should have taken more photos" },
    { line_order: 2, line_text: "Cuando estaba con mi gente", translation: "When I was with my people" },
    { line_order: 3, line_text: "Debí disfrutar más", translation: "I should have enjoyed more" },
    { line_order: 4, line_text: "Antes que el tiempo se fuera", translation: "Before time went away" }
  ],

  // Section 14: Outro (1 line)
  14: [
    { line_order: 1, line_text: "Debí tirar más fotos...", translation: "I should have taken more photos..." }
  ]
};

// ============================================
// SLANG TERMS DATA
// 38 terms from the spec
// ============================================

const slangTermsData = [
  // Phonetic Contractions (dropped consonants)
  { term: "pelao", definition: "kid, young person", standard_equivalent: "pelado", region: "Puerto Rico", part_of_speech: "noun", formality: "informal" },
  { term: "matá", definition: "killed (past participle)", standard_equivalent: "matada", region: "Caribbean", part_of_speech: "adjective", formality: "informal" },
  { term: "patá", definition: "kick", standard_equivalent: "patada", region: "Caribbean", part_of_speech: "noun", formality: "informal" },
  { term: "esbaratá", definition: "destroyed, broken", standard_equivalent: "desbaratada", region: "Caribbean", part_of_speech: "adjective", formality: "informal" },
  { term: "vo'a", definition: "I'm going to", standard_equivalent: "voy a", region: "Caribbean", part_of_speech: "phrase", formality: "informal" },
  { term: "to' el día", definition: "all day", standard_equivalent: "todo el día", region: "Caribbean", part_of_speech: "phrase", formality: "informal" },
  { term: "pa", definition: "for, to", standard_equivalent: "para", region: "Caribbean", part_of_speech: "preposition", formality: "informal" },
  { term: "pa'l", definition: "for the, to the", standard_equivalent: "para el", region: "Caribbean", part_of_speech: "phrase", formality: "informal" },
  { term: "p'acá", definition: "over here", standard_equivalent: "para acá", region: "Caribbean", part_of_speech: "phrase", formality: "informal" },
  { term: "Toy", definition: "I am", standard_equivalent: "Estoy", region: "Caribbean", part_of_speech: "verb", formality: "informal", usage_note: "Very common contraction in Caribbean Spanish" },
  { term: "Vamo", definition: "Let's go", standard_equivalent: "Vamos", region: "Caribbean", part_of_speech: "verb", formality: "informal" },

  // Puerto Rican Expressions
  { term: "Acho", definition: "man, dude (exclamation)", standard_equivalent: "muchacho", region: "Puerto Rico", part_of_speech: "exclamation", formality: "informal", cultural_note: "Very common Puerto Rican exclamation, similar to 'hey man'" },
  { term: "Dime", definition: "tell me (greeting)", standard_equivalent: "dime", region: "Puerto Rico", part_of_speech: "exclamation", formality: "informal", usage_note: "Used as a greeting like 'what's up'" },
  { term: "corillo", definition: "group of friends, crew", standard_equivalent: "grupo de amigos", region: "Puerto Rico", part_of_speech: "noun", formality: "informal", cultural_note: "Essential Puerto Rican slang for one's close friend group" },
  { term: "chequéate", definition: "check it out", standard_equivalent: "revisa, mira", region: "Puerto Rico", part_of_speech: "verb", formality: "informal", cultural_note: "Spanglish from English 'check'" },
  { term: "se da caña", definition: "goes hard, parties hard", standard_equivalent: "se esfuerza mucho", region: "Puerto Rico", part_of_speech: "phrase", formality: "informal" },
  { term: "llegarle", definition: "to approach, to handle", standard_equivalent: "acercarse, manejar", region: "Puerto Rico", part_of_speech: "verb", formality: "informal" },

  // Cultural/Musical Terms
  { term: "batá", definition: "sacred drum from Santería", standard_equivalent: null, region: "Caribbean", part_of_speech: "noun", formality: "neutral", cultural_note: "Sacred drums used in Afro-Cuban religious ceremonies" },
  { term: "güiro", definition: "gourd percussion instrument", standard_equivalent: null, region: "Caribbean", part_of_speech: "noun", formality: "neutral", cultural_note: "Traditional instrument in Puerto Rican and Cuban music" },
  { term: "perreo", definition: "reggaeton dancing style", standard_equivalent: null, region: "Caribbean", part_of_speech: "noun", formality: "informal", cultural_note: "Characteristic dance style of reggaeton music" },
  { term: "bomba", definition: "traditional Puerto Rican music/dance", standard_equivalent: null, region: "Puerto Rico", part_of_speech: "noun", formality: "neutral", cultural_note: "Afro-Puerto Rican musical genre with African roots" },
  { term: "plena", definition: "Puerto Rican folk music", standard_equivalent: null, region: "Puerto Rico", part_of_speech: "noun", formality: "neutral", cultural_note: "Traditional music often played at festivals and holidays" },
  { term: "Santurce", definition: "neighborhood in San Juan", standard_equivalent: null, region: "Puerto Rico", part_of_speech: "noun", formality: "neutral", cultural_note: "Cultural hub of San Juan, known for art and nightlife" },

  // Terms of Endearment
  { term: "blanquita", definition: "light-skinned girl (affectionate)", standard_equivalent: "chica de piel clara", region: "Caribbean", part_of_speech: "noun", formality: "informal", usage_note: "Affectionate, not derogatory in this context" },
  { term: "perico", definition: "buddy, friend", standard_equivalent: "amigo", region: "Puerto Rico", part_of_speech: "noun", formality: "informal" },
  { term: "kilo", definition: "friend, buddy", standard_equivalent: "amigo", region: "Puerto Rico", part_of_speech: "noun", formality: "informal" },
  { term: "mami", definition: "baby, girl (affectionate)", standard_equivalent: "cariño, nena", region: "Caribbean", part_of_speech: "noun", formality: "informal" },
  { term: "pana", definition: "friend, buddy", standard_equivalent: "amigo", region: "Puerto Rico", part_of_speech: "noun", formality: "informal", cultural_note: "Very common Puerto Rican term for close friend" },

  // Anglicisms
  { term: "tirar fotos", definition: "to take photos", standard_equivalent: "tomar fotos, sacar fotos", region: "Puerto Rico", part_of_speech: "phrase", formality: "informal", cultural_note: "Caribbean variation, more casual than standard 'tomar fotos'" },
  { term: "babies", definition: "babies, cuties", standard_equivalent: "bebés, chicas lindas", region: "Caribbean", part_of_speech: "noun", formality: "informal" },
  { term: "nudes", definition: "nude photos", standard_equivalent: "fotos desnudas", region: "Caribbean", part_of_speech: "noun", formality: "vulgar" },
  { term: "pa la movie", definition: "for the movies, having fun", standard_equivalent: "para divertirse", region: "Puerto Rico", part_of_speech: "phrase", formality: "informal", cultural_note: "Means going out to have a good time" },

  // Intensifiers/Exclamations
  { term: "jurado", definition: "I swear (intensifier)", standard_equivalent: "te lo juro", region: "Caribbean", part_of_speech: "exclamation", formality: "informal" },
  { term: "cabrón", definition: "dude, bastard (context-dependent)", standard_equivalent: null, region: "Caribbean", part_of_speech: "noun", formality: "vulgar", usage_note: "Can be affectionate between friends or insulting" },
  { term: "Diablo", definition: "damn, wow", standard_equivalent: "caramba", region: "Caribbean", part_of_speech: "exclamation", formality: "informal", cultural_note: "Common Caribbean exclamation of surprise" },
  { term: "cojones", definition: "balls, courage (vulgar)", standard_equivalent: "valentía", region: "Caribbean", part_of_speech: "noun", formality: "vulgar" },
  { term: "to'", definition: "all, everything", standard_equivalent: "todo", region: "Caribbean", part_of_speech: "adjective", formality: "informal" },
  { term: "vacilar", definition: "to party, hang out", standard_equivalent: "divertirse, salir", region: "Caribbean", part_of_speech: "verb", formality: "informal" }
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedSong() {
  console.log('📀 Inserting song record...');

  const { data, error } = await supabase
    .from('songs')
    .insert(songData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert song: ${error.message}`);
  }

  console.log(`   ✅ Song created: ${data.title} (${data.song_id})`);
  return data.song_id;
}

async function seedSections(songId) {
  console.log('📑 Inserting sections...');

  // First pass: insert all sections without repeat references
  const sectionsWithoutRepeats = sectionsData.map(s => ({
    song_id: songId,
    section_type: s.section_type,
    section_order: s.section_order,
    section_label: s.section_label,
    is_skippable: s.is_skippable,
    total_lines: linesData[s.section_order]?.length || 0
  }));

  const { data: sections, error } = await supabase
    .from('song_sections')
    .insert(sectionsWithoutRepeats)
    .select();

  if (error) {
    throw new Error(`Failed to insert sections: ${error.message}`);
  }

  // Second pass: update repeat references
  const sectionMap = {};
  sections.forEach(s => {
    sectionMap[s.section_order] = s.section_id;
  });

  // Update section 7 to reference section 6
  const repeatSection = sectionsData.find(s => s.is_repeat);
  if (repeatSection) {
    const { error: updateError } = await supabase
      .from('song_sections')
      .update({ repeat_of_section_id: sectionMap[repeatSection.repeat_of] })
      .eq('section_id', sectionMap[repeatSection.section_order]);

    if (updateError) {
      console.log(`   ⚠️  Failed to set repeat reference: ${updateError.message}`);
    }
  }

  console.log(`   ✅ ${sections.length} sections created`);
  return sectionMap;
}

async function seedLines(sectionMap) {
  console.log('📝 Inserting lines...');

  let totalLines = 0;
  const lineMap = {};

  for (const [sectionOrder, lines] of Object.entries(linesData)) {
    if (lines.length === 0) continue;

    const sectionId = sectionMap[parseInt(sectionOrder)];
    const linesToInsert = lines.map(l => ({
      section_id: sectionId,
      line_order: l.line_order,
      line_text: l.line_text,
      translation: l.translation,
      grammar_note: l.grammar_note || null,
      cultural_note: l.cultural_note || null,
      is_skippable: l.is_skippable || false
    }));

    const { data, error } = await supabase
      .from('song_lines')
      .insert(linesToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to insert lines for section ${sectionOrder}: ${error.message}`);
    }

    // Store line IDs for linking
    data.forEach(line => {
      const key = `${sectionOrder}-${line.line_order}`;
      lineMap[key] = line.line_id;
    });

    totalLines += data.length;
  }

  console.log(`   ✅ ${totalLines} lines created`);
  return lineMap;
}

async function seedSlangTerms() {
  console.log('🗣️  Inserting slang terms...');

  const { data, error } = await supabase
    .from('slang_terms')
    .insert(slangTermsData)
    .select();

  if (error) {
    throw new Error(`Failed to insert slang terms: ${error.message}`);
  }

  console.log(`   ✅ ${data.length} slang terms created`);

  // Create lookup map
  const slangMap = {};
  data.forEach(s => {
    slangMap[s.term] = s.slang_id;
  });

  return slangMap;
}

async function linkSlangToSong(songId, slangMap) {
  console.log('🔗 Linking slang to song...');

  const links = Object.entries(slangMap).map(([term, slangId]) => ({
    song_id: songId,
    slang_id: slangId,
    occurrence_count: 1
  }));

  const { data, error } = await supabase
    .from('song_slang')
    .insert(links)
    .select();

  if (error) {
    throw new Error(`Failed to link slang to song: ${error.message}`);
  }

  console.log(`   ✅ ${data.length} slang-song links created`);
}

async function updateSongStats(songId) {
  console.log('📊 Updating song stats...');

  // Count lines
  const { count: lineCount } = await supabase
    .from('song_lines')
    .select('*', { count: 'exact', head: true })
    .eq('section_id', supabase.from('song_sections').select('section_id').eq('song_id', songId));

  // Count slang
  const { count: slangCount } = await supabase
    .from('song_slang')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', songId);

  const { error } = await supabase
    .from('songs')
    .update({
      total_lines: 46, // Known from data
      unique_slang_terms: slangCount || 38
    })
    .eq('song_id', songId);

  if (error) {
    console.log(`   ⚠️  Failed to update stats: ${error.message}`);
  } else {
    console.log(`   ✅ Stats updated`);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🎵 Seeding Lyrics POC Data');
  console.log('='.repeat(50));
  console.log(`📀 Song: ${songData.title} by ${songData.artist}`);
  console.log('');

  try {
    // Check if song already exists
    const { data: existing } = await supabase
      .from('songs')
      .select('song_id, title')
      .eq('title', songData.title)
      .eq('artist', songData.artist)
      .single();

    if (existing) {
      console.log(`⚠️  Song already exists: ${existing.title} (${existing.song_id})`);
      console.log('   Delete it first if you want to re-seed.');
      return;
    }

    // Seed in order
    const songId = await seedSong();
    const sectionMap = await seedSections(songId);
    const lineMap = await seedLines(sectionMap);
    const slangMap = await seedSlangTerms();
    await linkSlangToSong(songId, slangMap);
    await updateSongStats(songId);

    console.log('');
    console.log('='.repeat(50));
    console.log('✅ Seed complete!');
    console.log(`   Song ID: ${songId}`);
    console.log(`   Sections: ${Object.keys(sectionMap).length}`);
    console.log(`   Lines: ${Object.keys(lineMap).length}`);
    console.log(`   Slang Terms: ${Object.keys(slangMap).length}`);

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

main();
