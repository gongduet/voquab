-- ============================================
-- PHASE 0.5: BACKUP - Run BEFORE any changes
-- ============================================
-- Purpose: Create backup tables of all data
-- This allows rollback if migration fails
-- ============================================

-- ============================================
-- STEP 1: Create backup of vocabulary
-- ============================================
CREATE TABLE IF NOT EXISTS vocabulary_backup_20251130 AS
SELECT * FROM vocabulary;

-- Verify backup
SELECT 'vocabulary_backup_20251130' as table_name, COUNT(*) as rows FROM vocabulary_backup_20251130;

-- ============================================
-- STEP 2: Create backup of vocabulary_occurrences
-- ============================================
CREATE TABLE IF NOT EXISTS vocabulary_occurrences_backup_20251130 AS
SELECT * FROM vocabulary_occurrences;

-- Verify backup
SELECT 'vocabulary_occurrences_backup_20251130' as table_name, COUNT(*) as rows FROM vocabulary_occurrences_backup_20251130;

-- ============================================
-- STEP 3: Create backup of user_vocabulary_progress
-- ============================================
CREATE TABLE IF NOT EXISTS user_vocabulary_progress_backup_20251130 AS
SELECT * FROM user_vocabulary_progress;

-- Verify backup
SELECT 'user_vocabulary_progress_backup_20251130' as table_name, COUNT(*) as rows FROM user_vocabulary_progress_backup_20251130;

-- ============================================
-- STEP 4: Create backup of chapters
-- ============================================
CREATE TABLE IF NOT EXISTS chapters_backup_20251130 AS
SELECT * FROM chapters;

-- Verify backup
SELECT 'chapters_backup_20251130' as table_name, COUNT(*) as rows FROM chapters_backup_20251130;

-- ============================================
-- STEP 5: Create backup of sentences
-- ============================================
CREATE TABLE IF NOT EXISTS sentences_backup_20251130 AS
SELECT * FROM sentences;

-- Verify backup
SELECT 'sentences_backup_20251130' as table_name, COUNT(*) as rows FROM sentences_backup_20251130;

-- ============================================
-- STEP 6: Create backup of user_daily_stats
-- ============================================
CREATE TABLE IF NOT EXISTS user_daily_stats_backup_20251130 AS
SELECT * FROM user_daily_stats;

-- Verify backup
SELECT 'user_daily_stats_backup_20251130' as table_name, COUNT(*) as rows FROM user_daily_stats_backup_20251130;

-- ============================================
-- VERIFICATION: Show all backup tables created
-- ============================================
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE information_schema.columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%_backup_20251130'
ORDER BY table_name;

-- ============================================
-- BACKUP COMPLETE!
-- Record these counts before proceeding to Phase 1
-- ============================================
