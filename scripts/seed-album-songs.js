import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tracklist from file header (proper casing)
// Format: title or "title: (feat. artist)" - we extract just the title
const tracklist = [
  "Nuevayol",
  "Voy a Llevarte Pa' PR",
  "Baile Inolvidable",
  "Perfumito Nuevo",      // feat. RaiNao
  "Weltita",              // feat. Chuwi
  "Veldá",                // feat. Dei V, Omar Courtz
  "El Clúb",
  "Ketu Tecré",
  "Bokete",
  "Kloufrens",
  "Turista",
  "Café con Ron",         // feat. Los Pleneros de la Cresta
  "Pitorro de Coco",
  "Lo Que Le Pasó a Hawaii",
  "Eoo",
  "DTMF",
  "La Mudanza"
];

async function main() {
  console.log('='.repeat(60));
  console.log('CREATING SONG RECORDS FOR DTMF ALBUM');
  console.log('='.repeat(60));
  console.log('');

  const songsToInsert = tracklist.map((title, index) => ({
    title,
    artist: "Bad Bunny",
    album: "Debí Tirar Más Fotos",
    release_year: 2025,
    difficulty: "intermediate",
    dialect: "Puerto Rican Spanish",
    is_published: false,
    // We'll set these stats later when we import lyrics
    total_sections: 0,
    total_lines: 0,
    unique_lemmas: 0,
    unique_slang_terms: 0
  }));

  console.log(`Inserting ${songsToInsert.length} songs...`);
  console.log('');

  const { data: songs, error } = await supabase
    .from('songs')
    .insert(songsToInsert)
    .select('song_id, title');

  if (error) {
    console.error('ERROR inserting songs:', error.message);
    return;
  }

  console.log('SONGS CREATED:');
  console.log('-'.repeat(60));
  songs.forEach((song, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${song.title.padEnd(30)} ${song.song_id}`);
  });

  console.log('');
  console.log('='.repeat(60));
  console.log(`SUCCESS: ${songs.length} songs created`);
  console.log('='.repeat(60));

  // Verify count
  const { count } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal songs in database: ${count}`);
}

main().catch(console.error);
