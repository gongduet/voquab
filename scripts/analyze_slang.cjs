require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
  const { data: slangTerms, error } = await supabase
    .from('slang_terms')
    .select('slang_id, term, definition, standard_equivalent, formality, is_approved, region, part_of_speech')
    .order('term');

  if (error) {
    console.log('Query error:', error.message);
    return;
  }

  console.log('=== SLANG TERMS REPORT ===\n');
  console.log('1. Total count:', slangTerms.length);

  // Count approved vs not approved
  const approved = slangTerms.filter(s => s.is_approved === true).length;
  const notApproved = slangTerms.filter(s => s.is_approved === false).length;
  console.log('\n2. Approval status:');
  console.log('   Approved (is_approved=true):', approved);
  console.log('   Not approved (is_approved=false):', notApproved);

  // Count by formality
  const byFormality = {};
  slangTerms.forEach(s => {
    const f = s.formality || 'null';
    byFormality[f] = (byFormality[f] || 0) + 1;
  });
  console.log('\n3. By formality:');
  Object.entries(byFormality).sort().forEach(([f, count]) => {
    console.log('   ' + f + ':', count);
  });

  // Export to file
  fs.writeFileSync(
    'scripts/slang_to_review.json',
    JSON.stringify(slangTerms, null, 2)
  );
  console.log('\n4. Exported to scripts/slang_to_review.json');

  // Show first 30 terms
  console.log('\n5. First 30 terms for spot-check:');
  console.log('─'.repeat(90));
  console.log('Term'.padEnd(20), 'Definition'.padEnd(40), 'Std Equiv'.padEnd(15), 'Formality');
  console.log('─'.repeat(90));

  slangTerms.slice(0, 30).forEach(s => {
    const term = (s.term || '').substring(0, 18).padEnd(20);
    const def = (s.definition || '').substring(0, 38).padEnd(40);
    const equiv = (s.standard_equivalent || '-').substring(0, 13).padEnd(15);
    const formality = s.formality || '-';
    console.log(term, def, equiv, formality);
  });
  console.log('─'.repeat(90));
}

analyze().catch(console.error);
