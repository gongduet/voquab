#!/usr/bin/env node

/**
 * Migration Runner Script
 * Executes SQL migration files using Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node run-migration.js <migration-file.sql>');
  process.exit(1);
}

// Initialize Supabase client with service role key (bypasses RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Starting migration...');
    console.log(`📄 File: ${migrationFile}`);

    // Read SQL file
    const migrationPath = join(__dirname, '..', migrationFile);
    const sql = readFileSync(migrationPath, 'utf8');

    console.log(`📝 SQL length: ${sql.length} characters`);
    console.log('⏳ Executing migration...\n');

    // Execute SQL using Supabase REST API
    // Note: Supabase JS client doesn't have direct SQL execution
    // We need to use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      // If RPC doesn't exist, we need to execute via SQL Editor API
      // Let's try the pg_net approach or direct connection
      throw new Error(`Migration failed with status: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Results:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);

    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }

    if (error.details) {
      console.error(`Details: ${error.details}`);
    }

    if (error.hint) {
      console.error(`Hint: ${error.hint}`);
    }

    process.exit(1);
  }
}

// Run the migration
runMigration();
