require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  const { data: allSlang, error } = await supabase
    .from('slang_terms')
    .select('slang_id, term, definition, standard_equivalent')
    .order('term');

  if (error) {
    console.log('Query error:', error.message);
    return;
  }

  // 1. Short definitions
  console.log('=== 1. TERMS WITH SHORT DEFINITIONS (< 10 chars) ===\n');
  const shortDefs = allSlang.filter(s => (s.definition || '').length < 10);
  console.log('Count:', shortDefs.length);
  console.log('─'.repeat(60));
  console.log('Term'.padEnd(25), 'Definition');
  console.log('─'.repeat(60));
  shortDefs.forEach(s => {
    console.log((s.term || '').padEnd(25), s.definition || '(empty)');
  });

  // 2. Missing standard_equivalent (excluding known unique terms)
  console.log('\n\n=== 2. MISSING STANDARD_EQUIVALENT (first 20) ===\n');
  const knownUnique = ['Acho', 'bellaqueo', 'bichote', 'bichota', 'perreo', 'perrear',
    'reggaetón', 'dembow', 'safaera', 'yales', 'frontear', 'janguear', 'jangueo',
    'guillar', 'vacilón', 'gufear', 'broki', 'pana', 'corillo'];
  const missingEquiv = allSlang.filter(s =>
    !s.standard_equivalent && !knownUnique.includes(s.term)
  );
  console.log('Total missing standard_equivalent:', missingEquiv.length);
  console.log('(excluding known unique PR terms)');
  console.log('─'.repeat(70));
  console.log('Term'.padEnd(25), 'Definition');
  console.log('─'.repeat(70));
  missingEquiv.slice(0, 20).forEach(s => {
    const def = (s.definition || '').substring(0, 42);
    console.log((s.term || '').padEnd(25), def);
  });
  if (missingEquiv.length > 20) {
    console.log(`... and ${missingEquiv.length - 20} more`);
  }

  // 3. Duplicates
  console.log('\n\n=== 3. DUPLICATE TERMS ===\n');
  const termCounts = {};
  allSlang.forEach(s => {
    const term = s.term || '';
    termCounts[term] = (termCounts[term] || 0) + 1;
  });
  const duplicates = Object.entries(termCounts).filter(([_, count]) => count > 1);
  if (duplicates.length === 0) {
    console.log('No duplicates found.');
  } else {
    console.log('Count:', duplicates.length);
    duplicates.forEach(([term, count]) => {
      console.log(`  "${term}": ${count} entries`);
    });
  }

  // 4. Bonus: Terms that are just phonetic spellings (end with apostrophe)
  console.log('\n\n=== 4. PHONETIC SPELLINGS (end with apostrophe) ===\n');
  const phonetic = allSlang.filter(s => (s.term || '').endsWith("'"));
  console.log('Count:', phonetic.length);
  console.log('These are dropped-letter pronunciations, not true slang.');
  console.log('First 15:');
  phonetic.slice(0, 15).forEach(s => {
    const equiv = s.standard_equivalent || '?';
    console.log(`  ${s.term} → ${equiv}`);
  });
  if (phonetic.length > 15) {
    console.log(`  ... and ${phonetic.length - 15} more`);
  }
}

analyze().catch(console.error);
