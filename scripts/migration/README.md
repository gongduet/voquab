# Database Migration Scripts

## Overview

These scripts migrate Voquab from the old 4-table vocabulary system to the new 2-table lemma/word system.

## Execution Order

Run these scripts **IN ORDER** in the Supabase SQL Editor:

| Step | File | Purpose | Duration |
|------|------|---------|----------|
| 0a | `00_DISCOVERY.sql` | Understand current database state | 1 min |
| 0b | `01_BACKUP.sql` | Create backup tables | 2 min |
| 1 | `02_CREATE_TABLES.sql` | Create new schema tables | 1 min |
| 2 | `03_MIGRATE_LEMMAS.sql` | Migrate vocabulary → lemmas | 2 min |
| 3 | `04_MIGRATE_WORDS.sql` | Migrate occurrences → words | 5 min |
| 4 | `05_MIGRATE_USER_PROGRESS.sql` | Migrate user progress | 2 min |
| 5 | `06_VALIDATION.sql` | Verify migration success | 1 min |
| 6 | `07_CREATE_INDEXES.sql` | Add performance indexes | 1 min |

## Important Notes

### Before Starting
- [ ] Export database backup from Supabase Dashboard (Settings → Backups)
- [ ] Note current row counts from Discovery script
- [ ] Plan maintenance window (app will work during migration)

### During Migration
- Run each script separately
- Check output after each script
- **STOP if any script shows errors**
- Save all output for reporting

### After Migration
- Run validation script
- Test flashcard queries
- Update frontend code to use new tables
- Monitor for 24 hours before cleanup

## Rollback

If migration fails:
1. Run `08_ROLLBACK.sql` (uncomment statements first)
2. Verify old data is restored
3. Report issue

## Expected Results

After successful migration:

| Table | Expected Count |
|-------|---------------|
| lemmas | ~1,000-1,200 |
| words | ~3,000-5,000 |
| user_lemma_progress | Same as user_vocabulary_progress |

## Files

```
scripts/migration/
├── 00_DISCOVERY.sql      # Phase 0: Understand current state
├── 01_BACKUP.sql         # Phase 0: Create backups
├── 02_CREATE_TABLES.sql  # Phase 1: Create new tables
├── 03_MIGRATE_LEMMAS.sql # Phase 2: Migrate lemmas
├── 04_MIGRATE_WORDS.sql  # Phase 3: Migrate words
├── 05_MIGRATE_USER_PROGRESS.sql  # Phase 4: Migrate progress
├── 06_VALIDATION.sql     # Phase 5: Validate migration
├── 07_CREATE_INDEXES.sql # Phase 6: Add indexes
├── 08_ROLLBACK.sql       # Emergency rollback
└── README.md             # This file
```

## Support

If issues occur, save all SQL output and report to Claude with:
- Which script failed
- Error message
- Current state (run validation script)
