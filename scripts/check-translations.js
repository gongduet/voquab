#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('vocabulary_lemmas')
    .select('lemma_id, lemma, english_definition, part_of_speech')
    .eq('language_code', 'es')
    .limit(1000);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter where definition equals lemma or lemma without article
  const untranslated = data.filter(l => {
    const withoutArticle = l.lemma.replace(/^(el|la|los|las) /, '');
    return l.english_definition === l.lemma ||
           l.english_definition === withoutArticle ||
           !l.english_definition;
  });

  console.log(`Found ${untranslated.length} lemmas needing translation:`);
  untranslated.slice(0, 30).forEach(l => {
    console.log(`  ${l.lemma} → ${l.english_definition}`);
  });
}

main();
