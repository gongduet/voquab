#!/usr/bin/env node

/**
 * Verify Supabase Connection and Table Status
 * Checks if lyrics tables exist
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkConnection() {
  console.log('🔍 Checking Supabase connection and table status...\n');

  // Test connection by querying an existing table
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('book_id, title')
    .limit(1);

  if (booksError) {
    console.log('❌ Connection test failed:', booksError.message);
    return;
  }

  console.log('✅ Connection successful - books table accessible');
  console.log(`   Found: ${books.length > 0 ? books[0].title : 'No books'}\n`);

  // Check if lyrics tables exist
  const lyricsTableNames = [
    'songs',
    'song_sections',
    'song_lines',
    'slang_terms',
    'song_slang',
    'song_lemmas',
    'user_slang_progress',
    'user_line_progress',
    'user_song_progress'
  ];

  console.log('📋 Checking lyrics tables:\n');

  for (const tableName of lyricsTableNames) {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log(`   ❌ ${tableName} - NOT FOUND`);
      } else {
        console.log(`   ⚠️  ${tableName} - Error: ${error.message}`);
      }
    } else {
      console.log(`   ✅ ${tableName} - EXISTS`);
    }
  }

  console.log('');
}

checkConnection();
