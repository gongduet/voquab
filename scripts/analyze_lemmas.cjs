require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  // 1. Get all song-linked lemma IDs
  const { data: songLemmas } = await supabase
    .from('song_lemmas')
    .select('lemma_id');

  const songLemmaIds = [...new Set(songLemmas.map(sl => sl.lemma_id))];

  // 2. Get all El Principito lemma IDs (via words table)
  const { data: bookWords } = await supabase
    .from('words')
    .select('lemma_id');

  const bookLemmaIds = new Set(bookWords.map(w => w.lemma_id).filter(Boolean));

  // 3. Find songs-only lemmas
  const songsOnlyIds = songLemmaIds.filter(id => !bookLemmaIds.has(id));

  console.log('=== LEMMAS BY SOURCE ===');
  console.log('El Principito (also in songs):', songLemmaIds.length - songsOnlyIds.length);
  console.log('Songs only (NEW):', songsOnlyIds.length);

  // 4. Get details of songs-only lemmas
  if (songsOnlyIds.length > 0) {
    console.log('\nSongs-only lemma IDs:', songsOnlyIds);

    const { data: newLemmas, error } = await supabase
      .from('lemmas')
      .select('lemma_id, lemma_text, part_of_speech, definitions, gender')
      .in('lemma_id', songsOnlyIds);

    if (error) {
      console.log('Query error:', error.message);
      return;
    }

    console.log('\n=== NEW SONG LEMMAS (not in El Principito) ===');
    console.log('Query returned:', newLemmas ? newLemmas.length : 'null');

    if (!newLemmas || newLemmas.length === 0) {
      console.log('No lemmas found for these IDs');
      return;
    }

    // Group by POS
    const byPos = {};
    newLemmas.forEach(l => {
      const pos = l.part_of_speech || 'NULL';
      byPos[pos] = (byPos[pos] || 0) + 1;
    });
    console.log('By POS:', JSON.stringify(byPos));

    console.log('\nLemmas needing review:');
    console.log('----------------------------------------------------------------------');
    newLemmas.forEach(l => {
      const defs = l.definitions || [];
      const def = defs.length > 0 ? defs[0] : 'NO DEFINITION';
      console.log((l.part_of_speech || '???').padEnd(6), (l.lemma_text || '').padEnd(25), def);
    });
    console.log('----------------------------------------------------------------------');

    // Export to file
    fs.writeFileSync(
      'scripts/new_song_lemmas.json',
      JSON.stringify(newLemmas, null, 2)
    );
    console.log('\nExported to scripts/new_song_lemmas.json');
  } else {
    console.log('\nNo new lemmas found (all song lemmas also appear in El Principito)');
    fs.writeFileSync('scripts/new_song_lemmas.json', '[]');
  }
}

analyze().catch(console.error);
