require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function investigate() {
  console.log('CHECKING ALL SONGS FOR TRANSLATION ACCURACY\n');

  // Get all songs
  const { data: songs } = await supabase.from('songs').select('song_id, title').order('title');

  const keywordPairs = [
    ['sunset', 'sunset'],
    ['bernie', 'bernie'],
    ['loco', 'crazy'],
    ['café', 'coffee'],
    ['ron', 'rum'],
    ['corazón', 'heart'],
    ['amor', 'love'],
    ['noche', 'night'],
    ['día', 'day'],
    ['ojos', 'eye'],
    ['besos', 'kiss'],
    ['nena', 'girl'],
    ['nene', 'boy'],
  ];

  const results = [];

  for (const song of songs) {
    const { data: sections } = await supabase
      .from('song_sections')
      .select('section_id')
      .eq('song_id', song.song_id);

    const sectionIds = sections.map(s => s.section_id);

    const { data: lines } = await supabase
      .from('song_lines')
      .select('line_text, translation')
      .in('section_id', sectionIds);

    let matchCount = 0;
    let mismatchCount = 0;
    const mismatches = [];

    for (const line of lines || []) {
      const spanish = (line.line_text || '').toLowerCase();
      const trans = (line.translation || '').toLowerCase();

      for (const [spanishWord, englishWord] of keywordPairs) {
        const hasSpanish = spanish.includes(spanishWord);
        const hasEnglish = trans.includes(englishWord);

        if (hasSpanish && hasEnglish) {
          matchCount++;
          break;
        } else if (hasSpanish && !hasEnglish) {
          mismatchCount++;
          mismatches.push({
            spanish: line.line_text.substring(0, 40),
            trans: line.translation.substring(0, 40),
            missing: englishWord
          });
          break;
        }
      }
    }

    results.push({
      song: song.title,
      totalLines: lines?.length || 0,
      matches: matchCount,
      mismatches: mismatchCount,
      examples: mismatches.slice(0, 2)
    });
  }

  // Sort by mismatch count descending
  results.sort((a, b) => b.mismatches - a.mismatches);

  console.log('SONGS RANKED BY TRANSLATION ISSUES:');
  console.log('='.repeat(80));

  for (const r of results) {
    const status = r.mismatches === 0 ? '✓' : (r.mismatches > 2 ? '✗✗' : '✗');
    console.log(`\n${status} ${r.song}`);
    console.log(`   Lines: ${r.totalLines}, Matches: ${r.matches}, Mismatches: ${r.mismatches}`);

    if (r.examples.length > 0) {
      for (const ex of r.examples) {
        console.log(`   - ES: "${ex.spanish}..."`);
        console.log(`     EN: "${ex.trans}..."`);
        console.log(`     Missing: "${ex.missing}"`);
      }
    }
  }

  // Summary
  const problemSongs = results.filter(r => r.mismatches > 0);
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log(`Songs with issues: ${problemSongs.length}/${results.length}`);
  console.log(`Problem songs: ${problemSongs.map(s => s.song).join(', ')}`);
}

investigate();
