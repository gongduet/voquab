/**
 * Run Library Dashboard Restructure Migration
 * Adds active_book_id, active_song_id, and allow_explicit_content to user_settings
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  console.log('Running Library Dashboard Restructure Migration...')
  console.log('Checking for columns: active_book_id, active_song_id, allow_explicit_content')

  // Check if the columns already exist by selecting from user_settings
  const { data: testData, error: testError } = await supabase
    .from('user_settings')
    .select('active_book_id, active_song_id, allow_explicit_content')
    .limit(1)

  if (!testError) {
    console.log('Columns already exist! Migration has been applied.')
    console.log('Test query result:', testData)
    return
  }

  console.log('Columns do not exist yet (error:', testError.message, ')')
  console.log('')
  console.log('Please run the following SQL in Supabase Dashboard SQL Editor:')
  console.log('Go to: https://supabase.com/dashboard/project/oaanmdgxuvtjbhxblcnu/sql/new')
  console.log('')
  console.log('-- Copy this SQL:')
  console.log(`
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS active_book_id UUID REFERENCES books(book_id),
ADD COLUMN IF NOT EXISTS active_song_id UUID REFERENCES songs(song_id);

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS allow_explicit_content BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_settings.active_book_id IS 'Currently active book for learning';
COMMENT ON COLUMN user_settings.active_song_id IS 'Currently active song for learning';
COMMENT ON COLUMN user_settings.allow_explicit_content IS 'Allow vulgar slang terms (default false)';
`)
}

runMigration().catch(console.error)
