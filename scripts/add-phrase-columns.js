/**
 * Add missing columns to user_phrase_progress using Supabase Admin API
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to user_phrase_progress...\n')

  // Try to use supabase.rpc to run SQL
  // First check if there's an execute_sql function
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      ALTER TABLE user_phrase_progress
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    `
  })

  if (error) {
    console.log('❌ RPC execute_sql not available:', error.message)
    console.log('\n📝 Please run the following SQL in Supabase SQL Editor:')
    console.log('=' .repeat(60))
    console.log(`
-- Add missing columns to user_phrase_progress to match user_lemma_progress
ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS correct_reviews INTEGER DEFAULT 0;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS last_correct_review_at TIMESTAMPTZ;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS review_due BOOLEAN DEFAULT TRUE;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS failed_in_last_3_sessions BOOLEAN DEFAULT FALSE;

ALTER TABLE user_phrase_progress
ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT '[]'::jsonb;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_phrase_progress'
ORDER BY ordinal_position;
    `)
    console.log('=' .repeat(60))

    // Alternative: Modify the code to only upsert columns that exist
    console.log('\n🔄 ALTERNATIVE FIX:')
    console.log('Modify useProgressTracking.js to only upsert columns that exist in user_phrase_progress')
  } else {
    console.log('✅ SQL executed successfully:', data)
  }
}

addMissingColumns().catch(console.error)
