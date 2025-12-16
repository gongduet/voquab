# 13_DEPLOYMENT.md

**Last Updated:** December 15, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Environments](#environments)
3. [Build Process](#build-process)
4. [Deployment to Netlify](#deployment-to-netlify)
5. [Database Migrations](#database-migrations)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Rollback Procedures](#rollback-procedures)
8. [Post-Deployment](#post-deployment)

---

## OVERVIEW

Voquab uses modern deployment practices with automatic deployments from GitHub to Netlify.

**Stack:**
- **Frontend Hosting:** Netlify
- **Database:** Supabase (managed PostgreSQL)
- **Version Control:** GitHub
- **CI/CD:** GitHub Actions + Netlify
- **Domain:** (TBD - custom domain post-MVP)

**Deployment Frequency:**
- Development: On every push to `main`
- Production: Manual trigger from `main` (post-MVP)

---

## ENVIRONMENTS

### Development (Local)

**Purpose:** Active development on local machine

**Access:** `http://localhost:5173`

**Database:** Development Supabase project

**Configuration:**
```bash
# .env.local
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=dev_anon_key
VITE_ENVIRONMENT=development
```

**Start:**
```bash
npm run dev
```

---

### Staging (Netlify)

**Purpose:** Testing before production

**URL:** `https://voquab-staging.netlify.app`

**Database:** Staging Supabase project (separate from prod)

**Configuration:** Set in Netlify environment variables

**Deploy:** Automatic on push to `main` branch

---

### Production (Netlify)

**Purpose:** Live app for real users

**URL:** `https://voquab.app` (post-MVP with custom domain)

**Database:** Production Supabase project

**Deploy:** Manual deployment (post-MVP)

**Configuration:** Set in Netlify production environment

---

## BUILD PROCESS

### Local Build

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

**Output:** `/dist` folder with optimized static files

---

### Build Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
```

---

### Environment Variables

**Required for all environments:**

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Optional:**

```bash
VITE_ENVIRONMENT=development|staging|production
VITE_ENABLE_DEBUG=true|false
```

**Never commit:**
- `.env.local` (local development)
- `.env.production` (production secrets)

---

## DEPLOYMENT TO NETLIFY

### Initial Setup

**1. Connect GitHub Repository:**
- Sign in to Netlify
- Click "Add new site" → "Import an existing project"
- Choose GitHub → Select `voquab` repository
- Authorize Netlify

**2. Configure Build Settings:**

```yaml
# Build command
npm run build

# Publish directory
dist

# Environment variables (add in Netlify UI)
VITE_SUPABASE_URL=https://staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=staging_anon_key
```

**3. Deploy Settings:**
- Branch: `main` (auto-deploy)
- Build command: `npm run build`
- Publish directory: `dist`

---

### SPA Routing Configuration

For single-page application routing to work correctly on Netlify (preventing 404 errors on page refresh or direct URL access), a `_redirects` file is required:

**File:** `public/_redirects`
```
/*    /index.html   200
```

This tells Netlify: "For any URL path, serve index.html with a 200 status code." React Router then handles client-side routing.

**Why this is needed:**
- Without it, refreshing `/flashcards` returns a 404 (Netlify looks for a file at that path)
- Direct links shared to routes like `/dashboard` would fail
- Mobile users returning after phone idle would see errors

**Alternative:** The same can be configured in `netlify.toml` (shown below).

---

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

### Deploy Preview

**Netlify automatically creates:**
- Deploy preview for every PR
- Unique URL for each preview
- Isolated environment

**Preview URL format:**
```
https://deploy-preview-123--voquab.netlify.app
```

**Use for:**
- Testing features before merge
- Sharing with stakeholders
- QA testing

---

## DATABASE MIGRATIONS

### Migration Strategy

**Golden Rule:** Never modify production database directly

**Process:**
1. Write migration SQL
2. Test on local database
3. Apply to staging database
4. Verify staging works
5. Apply to production database
6. Verify production works

---

### Creating Migrations

**File naming:** `YYYYMMDD_description.sql`

```sql
-- migrations/20251130_add_health_system.sql

-- Add new columns
ALTER TABLE user_lemma_progress
  ADD COLUMN health INTEGER DEFAULT 100 CHECK (health >= 0 AND health <= 100),
  ADD COLUMN last_correct_review_at TIMESTAMPTZ,
  ADD COLUMN failed_in_last_3_sessions BOOLEAN DEFAULT FALSE;

-- Add index
CREATE INDEX idx_user_lemma_health 
  ON user_lemma_progress(user_id, health);

-- Backfill existing data
UPDATE user_lemma_progress
  SET health = 100
  WHERE health IS NULL;
```

---

### Running Migrations

**Local (Development):**
```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL Editor in Supabase Dashboard
```

**Staging:**
```bash
# Connect to staging project
supabase link --project-ref staging-project-id

# Run migration
supabase db push
```

**Production:**
```bash
# 1. Backup database first!
supabase db dump -f backup-YYYYMMDD.sql

# 2. Link to production
supabase link --project-ref production-project-id

# 3. Run migration
supabase db push

# 4. Verify
# Run test queries to ensure migration successful
```

---

### Migration Checklist

Before running migration:
- [ ] Migration SQL written and reviewed
- [ ] Tested on local database
- [ ] Tested on staging database
- [ ] Backward compatible (doesn't break current code)
- [ ] Production database backed up
- [ ] Rollback plan prepared

---

## CI/CD PIPELINE

### GitHub Actions

**Workflow:** Run tests on every PR

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
```

---

### Deployment Workflow

**Current (MVP):**
```
Developer → Push to main → GitHub → Netlify (auto-deploy) → Live
```

**Post-MVP (with staging):**
```
Developer → Push to main → GitHub → Netlify Staging (auto)
                                        ↓
                          Manual approval
                                        ↓
                          Netlify Production (manual trigger)
```

---

### Deployment Steps

**1. Development:**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Push to GitHub
git push origin feature/new-feature
```

**2. Create Pull Request:**
- GitHub creates deploy preview
- CI runs tests
- Review code changes

**3. Merge to Main:**
```bash
# Merge PR via GitHub UI
# Or via command line:
git checkout main
git merge feature/new-feature
git push origin main
```

**4. Automatic Deployment:**
- Netlify detects push to `main`
- Runs build command
- Deploys to staging
- ✅ Live at `voquab-staging.netlify.app`

---

## ROLLBACK PROCEDURES

### Instant Rollback (Netlify)

**Via Netlify Dashboard:**
1. Go to Deploys
2. Find last working deploy
3. Click "Publish deploy"
4. ✅ Site reverted in seconds

**No downtime required**

---

### Database Rollback

**If migration fails:**

```sql
-- Rollback migration (example)
-- migrations/20251130_rollback_health_system.sql

ALTER TABLE user_lemma_progress
  DROP COLUMN health,
  DROP COLUMN last_correct_review_at,
  DROP COLUMN failed_in_last_3_sessions;

DROP INDEX idx_user_lemma_health;
```

**Process:**
1. Stop accepting new writes (maintenance mode)
2. Run rollback SQL
3. Deploy previous frontend version
4. Verify system working
5. Resume normal operations

---

### Emergency Procedures

**Site completely down:**

1. **Check Netlify status**
   - Netlify status page
   - Build logs

2. **Check Supabase status**
   - Supabase dashboard
   - Database connection

3. **Rollback to last working deploy**
   - Netlify → Deploys → Publish previous

4. **Notify users**
   - Status page (post-MVP)
   - Twitter/social (if significant)

---

## POST-DEPLOYMENT

### Smoke Testing

**After every deployment, manually test:**

- [ ] Home page loads
- [ ] User can sign in
- [ ] Flashcards load
- [ ] Study session works
- [ ] Reading works
- [ ] Progress saves
- [ ] No console errors

**Takes 2-3 minutes**

---

### Monitoring

**Check these metrics:**
- Error rate (should be low)
- Load time (should be <2s)
- API response time (should be <500ms)

**Tools:**
- Netlify Analytics (built-in)
- Supabase Dashboard (query performance)
- Browser DevTools (manual testing)

---

### Deployment Log

**Record every deployment:**

```markdown
## 2025-11-30 - Deploy #42

**Changes:**
- Added health system to flashcards
- Fixed chapter unlock bug
- Updated design system colors

**Database Migrations:**
- `20251130_add_health_system.sql` - Added health columns

**Testing:**
- ✅ All unit tests pass
- ✅ Manual smoke test complete
- ✅ Mobile tested on iPhone

**Deployed by:** Peter  
**Deployed at:** 2025-11-30 14:30 PST  
**Deploy URL:** https://voquab-staging.netlify.app/deploys/abc123
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed
- [ ] No console errors/warnings
- [ ] Database migrations ready (if needed)
- [ ] Environment variables set correctly
- [ ] Tested on staging

### During Deployment

- [ ] Monitor build logs
- [ ] Watch for build errors
- [ ] Check deploy preview URL
- [ ] Run smoke tests

### Post-Deployment

- [ ] Verify production site loads
- [ ] Run smoke tests on production
- [ ] Check error monitoring
- [ ] Monitor for 15 minutes
- [ ] Document deployment in changelog

---

## DOMAIN SETUP (POST-MVP)

### Custom Domain

**Goal:** `voquab.app`

**Steps:**
1. Purchase domain (Namecheap, Google Domains)
2. Add to Netlify
3. Configure DNS records
4. Enable HTTPS (automatic with Netlify)
5. Force HTTPS redirect

**DNS Records:**
```
A     @    104.198.14.52      (Netlify)
CNAME www  voquab.netlify.app
```

**SSL Certificate:** Automatic with Let's Encrypt

---

## BACKUP STRATEGY

### Database Backups

**Supabase automatic backups:**
- Daily backups (last 7 days)
- Point-in-time recovery

**Manual backups before migrations:**
```bash
supabase db dump -f backup-$(date +%Y%m%d).sql
```

**Store backups:**
- Local machine (temporary)
- Cloud storage (S3, Google Drive)

---

### Code Backups

**Git is the backup:**
- All code in GitHub
- Every commit is a restore point
- Tags for releases

**Create release tags:**
```bash
git tag -a v1.0.0 -m "Version 1.0.0 - Initial launch"
git push origin v1.0.0
```

---

## TROUBLESHOOTING

### Build Fails

**Check:**
- Build logs in Netlify
- Environment variables set correctly
- Dependencies installed (`package-lock.json` committed)
- Node version matches local

**Common fixes:**
```bash
# Clear cache and rebuild
netlify build --clear-cache

# Update dependencies
npm update
npm audit fix
```

---

### Deploy Succeeds but Site Broken

**Check:**
- Browser console for errors
- Network tab for failed requests
- Supabase connection (API keys correct?)
- Environment variables in Netlify

---

### Database Connection Fails

**Check:**
- Supabase project status
- API keys correct
- RLS policies allow access
- Network tab in browser

---

## RELATED DOCUMENTS

- See **12_TESTING_STRATEGY.md** for testing before deploy
- See **19_MONITORING.md** for post-deploy monitoring
- See **20_ERROR_HANDLING.md** for production errors

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- 2025-12-15: Added SPA Routing Configuration section for public/_redirects (Claude)
- Status: Active

---

**END OF DEPLOYMENT**
