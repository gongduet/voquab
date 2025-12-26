#!/usr/bin/env node

/**
 * Lyrics Database Migration Runner
 * Executes the lyrics database migration via Supabase Management API
 *
 * Usage: node scripts/run-lyrics-migration.js
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
  console.error('❌ Missing environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

/**
 * Execute SQL via Supabase SQL Query API
 */
async function executeSql(sql) {
  // Use the PostgREST API with a custom RPC or the SQL API
  // The Management API requires a different auth token
  // For now, we'll split into smaller chunks and use individual requests

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SQL execution failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Split SQL into individual statements
 */
function splitSqlStatements(sql) {
  // Remove comments and split by semicolons
  const statements = [];
  let current = '';
  let inComment = false;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    // Handle -- comments
    if (!inString && char === '-' && next === '-') {
      inComment = true;
    }

    // Handle end of line (end of -- comment)
    if (inComment && (char === '\n' || char === '\r')) {
      inComment = false;
      continue;
    }

    if (inComment) continue;

    // Handle strings
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && sql[i - 1] !== '\\') {
      inString = false;
    }

    // Handle statement termination
    if (!inString && char === ';') {
      const statement = current.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add any remaining statement
  const remaining = current.trim();
  if (remaining.length > 0) {
    statements.push(remaining);
  }

  return statements;
}

/**
 * Filter out COMMENT statements (not supported via REST API)
 */
function filterStatements(statements) {
  return statements.filter(stmt => {
    const upper = stmt.toUpperCase().trim();
    // Keep CREATE TABLE, CREATE INDEX statements
    // Filter out COMMENT ON statements
    return !upper.startsWith('COMMENT ON');
  });
}

async function runMigration() {
  console.log('🎵 Lyrics Database Migration');
  console.log('='.repeat(50));
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`📍 Project Ref: ${projectRef}`);
  console.log('');

  try {
    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251225_lyrics_database.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    console.log(`📄 Migration file: ${migrationPath}`);
    console.log(`📝 Total SQL: ${sql.length} characters`);
    console.log('');

    // Parse statements
    const allStatements = splitSqlStatements(sql);
    console.log(`📊 Total statements parsed: ${allStatements.length}`);

    // Filter out COMMENT statements (they work in SQL Editor but not via API)
    const statements = filterStatements(allStatements);
    console.log(`📊 Executable statements: ${statements.length}`);
    console.log('');

    // Group related statements together for execution
    const createTableStatements = statements.filter(s => s.toUpperCase().startsWith('CREATE TABLE'));
    const createIndexStatements = statements.filter(s => s.toUpperCase().startsWith('CREATE INDEX'));

    console.log(`📋 CREATE TABLE statements: ${createTableStatements.length}`);
    console.log(`📋 CREATE INDEX statements: ${createIndexStatements.length}`);
    console.log('');

    // Output the SQL for manual execution
    console.log('⚠️  The Supabase REST API doesn\'t support direct SQL execution.');
    console.log('📋 Please run the following SQL in the Supabase Dashboard SQL Editor:');
    console.log('');
    console.log('🔗 https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('');
    console.log('-'.repeat(50));
    console.log('');

    // Print a summary of what will be created
    console.log('Tables to be created:');
    createTableStatements.forEach(stmt => {
      const match = stmt.match(/CREATE TABLE (\w+)/i);
      if (match) {
        console.log(`  - ${match[1]}`);
      }
    });
    console.log('');

    console.log('Indexes to be created:');
    createIndexStatements.forEach(stmt => {
      const match = stmt.match(/CREATE INDEX (\w+)/i);
      if (match) {
        console.log(`  - ${match[1]}`);
      }
    });
    console.log('');

    console.log('✅ Migration file is ready at:');
    console.log(`   ${migrationPath}`);
    console.log('');
    console.log('📝 Copy the contents and paste into the Supabase SQL Editor to execute.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
