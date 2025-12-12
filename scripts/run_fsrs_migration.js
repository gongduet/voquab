#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('FSRS MIGRATION - Adding columns and indexes');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Check current columns in user_lemma_progress
  console.log('1. Checking current user_lemma_progress columns...');
  const { data: currentProgress, error: checkError } = await supabase
    .from('user_lemma_progress')
    .select('*')
    .limit(1);

  if (checkError) {
    console.log('   Error checking table:', checkError.message);
  } else if (currentProgress && currentProgress.length > 0) {
    console.log('   Current columns:', Object.keys(currentProgress[0]).join(', '));

    // Check if FSRS columns already exist
    const existingCols = Object.keys(currentProgress[0]);
    const fsrsCols = ['stability', 'difficulty', 'due_date', 'fsrs_state', 'reps', 'lapses', 'last_seen_at'];
    const missingCols = fsrsCols.filter(col => !existingCols.includes(col));

    if (missingCols.length === 0) {
      console.log('   ✅ All FSRS columns already exist!');
    } else {
      console.log('   Missing FSRS columns:', missingCols.join(', '));
    }
  } else {
    console.log('   Table exists but is empty (new columns can be added)');
  }

  // Step 2: Try to add columns using raw SQL via Supabase's rpc
  // Note: Supabase JS client doesn't support raw DDL, so we need to verify manually
  // or use a different approach

  console.log();
  console.log('2. Attempting to verify/add FSRS columns...');
  console.log('   Note: DDL operations (ALTER TABLE) require Supabase Dashboard or');
  console.log('   direct PostgreSQL connection. The JS client has limited DDL support.');

  // Try inserting a test record with FSRS columns to see if they exist
  const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
  const testLemmaId = '00000000-0000-0000-0000-000000000001';

  console.log();
  console.log('3. Testing if FSRS columns accept data...');

  // First, let's try to read a record and see what columns are available
  const { data: sampleData, error: sampleError } = await supabase
    .from('user_lemma_progress')
    .select('stability, difficulty, due_date, fsrs_state, reps, lapses, last_seen_at')
    .limit(1);

  if (sampleError) {
    if (sampleError.message.includes('column') && sampleError.message.includes('does not exist')) {
      console.log('   ❌ FSRS columns do NOT exist yet');
      console.log('   Error:', sampleError.message);
      console.log();
      console.log('='.repeat(60));
      console.log('ACTION REQUIRED: Run the SQL manually in Supabase Dashboard');
      console.log('File: scripts/migration/add_fsrs_columns.sql');
      console.log('='.repeat(60));
      return false;
    } else {
      console.log('   Error:', sampleError.message);
    }
  } else {
    console.log('   ✅ FSRS columns exist and are queryable!');
    if (sampleData && sampleData.length > 0) {
      console.log('   Sample values:', JSON.stringify(sampleData[0], null, 2));
    }
  }

  // Step 4: Verify indexes (can only check via explain, which isn't available via JS client)
  console.log();
  console.log('4. Index verification...');
  console.log('   Note: Index verification requires direct PostgreSQL access.');
  console.log('   Indexes should be created when running the SQL file.');

  // Step 5: Final status
  console.log();
  console.log('='.repeat(60));
  console.log('MIGRATION STATUS');
  console.log('='.repeat(60));

  // Re-check all columns
  const { data: finalCheck } = await supabase
    .from('user_lemma_progress')
    .select('*')
    .limit(1);

  if (finalCheck && finalCheck.length > 0) {
    const cols = Object.keys(finalCheck[0]);
    const fsrsCols = ['stability', 'difficulty', 'due_date', 'fsrs_state', 'reps', 'lapses', 'last_seen_at'];

    console.log('FSRS Columns Status:');
    fsrsCols.forEach(col => {
      const exists = cols.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });

    const allExist = fsrsCols.every(col => cols.includes(col));
    console.log();
    console.log(allExist ? '✅ ALL FSRS COLUMNS PRESENT - Migration complete!' : '❌ Some columns missing - Manual SQL required');
    return allExist;
  }

  return false;
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
