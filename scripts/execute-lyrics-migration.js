#!/usr/bin/env node

/**
 * Execute Lyrics Database Migration
 * Uses Supabase SQL Execution API
 *
 * Usage: node scripts/execute-lyrics-migration.js
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

/**
 * Execute SQL using Supabase Management API
 * This uses the same endpoint as the SQL Editor in the dashboard
 */
async function executeSqlViaManagementApi(sql) {
  // The Management API endpoint for SQL execution
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Try alternative endpoint
    return null;
  }

  return response.json();
}

/**
 * Execute SQL statement by statement using a simple approach
 */
async function executeStatementByStatement(sql) {
  // Remove multi-line comments
  let cleanSql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

  // Split by semicolons (simple approach)
  const statements = cleanSql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/g) // Split on ; not inside strings
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📊 Found ${statements.length} statements to execute`);

  // For verification, show what tables will be created
  const createStatements = statements.filter(s =>
    s.toUpperCase().startsWith('CREATE TABLE') ||
    s.toUpperCase().startsWith('CREATE INDEX')
  );

  console.log('\n📋 CREATE statements:');
  createStatements.forEach((stmt, i) => {
    const firstLine = stmt.split('\n')[0];
    console.log(`  ${i + 1}. ${firstLine}`);
  });

  return statements;
}

async function runMigration() {
  console.log('🎵 Lyrics Database Migration Executor');
  console.log('='.repeat(50));
  console.log(`📍 Project: ${projectRef}`);
  console.log('');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251225_lyrics_database.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    console.log(`📄 Migration: 20251225_lyrics_database.sql`);
    console.log(`📝 Size: ${sql.length} characters`);
    console.log('');

    // Parse and show what will be executed
    await executeStatementByStatement(sql);

    console.log('\n' + '='.repeat(50));
    console.log('');
    console.log('📌 NEXT STEPS:');
    console.log('');
    console.log('Since direct API execution requires additional authentication,');
    console.log('please execute the migration in one of these ways:');
    console.log('');
    console.log('Option 1: Supabase Dashboard SQL Editor');
    console.log(`  🔗 https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log('  - Copy contents of: supabase/migrations/20251225_lyrics_database.sql');
    console.log('  - Paste and click "Run"');
    console.log('');
    console.log('Option 2: Supabase CLI with linked project');
    console.log('  $ npx supabase link --project-ref ' + projectRef);
    console.log('  $ npx supabase db push');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
