# 19_MONITORING.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Error Tracking](#error-tracking)
3. [Performance Monitoring](#performance-monitoring)
4. [Analytics](#analytics)
5. [Database Monitoring](#database-monitoring)
6. [Alerting](#alerting)
7. [Dashboards](#dashboards)

---

## OVERVIEW

Monitoring helps us understand how Voquab performs in production and catch issues before users report them.

**Monitoring Goals:**
- Detect errors immediately
- Track performance metrics
- Understand user behavior
- Prevent downtime

**Tools:**
- **Error Tracking:** Sentry (post-MVP)
- **Analytics:** Plausible or Simple Analytics (privacy-focused)
- **Performance:** Netlify Analytics + Lighthouse
- **Database:** Supabase Dashboard

---

## ERROR TRACKING

### Sentry Setup (Post-MVP)

**Installation:**
```bash
npm install @sentry/react @sentry/vite-plugin
```

**Configuration:**

```javascript
// src/main.jsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  enabled: import.meta.env.PROD, // Only in production
  
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions
  
  // Release tracking
  release: import.meta.env.VITE_APP_VERSION,
  
  // Ignore common errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured'
  ],
  
  // User context (no PII)
  beforeSend(event, hint) {
    // Don't send user email
    if (event.user) {
      delete event.user.email;
    }
    return event;
  }
});
```

---

### Error Boundary

```jsx
// src/components/ErrorBoundary.jsx
import React from 'react';
import * as Sentry from '@sentry/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      }
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-neutral-600 mb-6">
              We've been notified and are working on a fix.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;
```

---

### Manual Error Reporting

```javascript
import * as Sentry from '@sentry/react';

// Capture exceptions
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'flashcards',
      action: 'update_progress'
    },
    extra: {
      userId: user.id,
      lemmaId: lemma.id
    }
  });
  
  // Show user-friendly error
  showToast({ type: 'error', message: 'Failed to update progress' });
}

// Capture messages (non-errors)
Sentry.captureMessage('User completed unusual milestone', {
  level: 'info',
  tags: { feature: 'gamification' }
});
```

---

### User Feedback

```javascript
// After error, offer feedback form
if (hasError) {
  const eventId = Sentry.lastEventId();
  
  Sentry.showReportDialog({
    eventId,
    title: 'It looks like we're having issues.',
    subtitle: 'Our team has been notified.',
    subtitle2: 'If you'd like to help, tell us what happened below.',
    labelName: 'Name',
    labelEmail: 'Email',
    labelComments: 'What happened?',
    labelClose: 'Close',
    labelSubmit: 'Submit'
  });
}
```

---

## PERFORMANCE MONITORING

### Core Web Vitals

**Metrics we track:**
- **LCP (Largest Contentful Paint):** <2.5s
- **FID (First Input Delay):** <100ms
- **CLS (Cumulative Layout Shift):** <0.1

**How to measure:**

```javascript
// src/utils/performance.js
import { onCLS, onFID, onLCP } from 'web-vitals';

function sendToAnalytics({ name, delta, value, id }) {
  // Send to analytics service
  if (import.meta.env.PROD) {
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({ name, delta, value, id }),
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Log in development
  if (import.meta.env.DEV) {
    console.log(`${name}: ${value}`);
  }
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
```

---

### Page Load Performance

**Track load times:**

```javascript
// src/utils/performance.js
export function trackPageLoad(pageName) {
  if (!import.meta.env.PROD) return;
  
  // Use Navigation Timing API
  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    
    // Send to analytics
    fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({
        event: 'page_load',
        page: pageName,
        load_time: pageLoadTime,
        dns_time: perfData.domainLookupEnd - perfData.domainLookupStart,
        connection_time: perfData.connectEnd - perfData.connectStart,
        render_time: perfData.domComplete - perfData.domLoading
      })
    });
  });
}
```

---

### API Performance

**Track Supabase query times:**

```javascript
// src/utils/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Wrapper to track query performance
export async function trackedQuery(queryName, queryFn) {
  const startTime = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query: ${queryName} took ${duration}ms`);
      
      // Report to monitoring
      if (import.meta.env.PROD) {
        Sentry.captureMessage(`Slow query: ${queryName}`, {
          level: 'warning',
          extra: { duration, queryName }
        });
      }
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    // Report failed queries
    Sentry.captureException(error, {
      tags: { query: queryName },
      extra: { duration }
    });
    
    throw error;
  }
}

// Usage
const words = await trackedQuery('get_due_words', async () => {
  return supabase.rpc('get_due_words_for_user', { p_user_id: userId });
});
```

---

### Netlify Analytics

**Built-in metrics:**
- Page views
- Unique visitors
- Top pages
- Geographic data
- Bandwidth usage

**Access:** Netlify Dashboard → Site → Analytics

**No configuration needed**

---

## ANALYTICS

### Privacy-Focused Analytics

**Choice:** Plausible or Simple Analytics (no cookies, GDPR-friendly)

**What to track:**
- Page views
- User flows (which pages visited)
- Feature usage (flashcards, reading, etc.)
- Conversion events (sign up, complete session)

**What NOT to track:**
- Personal information
- Specific user actions (respect privacy)
- Detailed behavior (avoid surveillance)

---

### Event Tracking

```javascript
// src/utils/analytics.js
export function trackEvent(eventName, properties = {}) {
  if (!import.meta.env.PROD) {
    console.log('Analytics:', eventName, properties);
    return;
  }
  
  // Send to Plausible
  if (window.plausible) {
    window.plausible(eventName, { props: properties });
  }
}

// Usage
trackEvent('session_complete', {
  words_reviewed: 25,
  avg_difficulty: 'medium',
  chapter: 3
});

trackEvent('chapter_unlock', {
  chapter_number: 2,
  days_to_unlock: 7
});

trackEvent('level_up', {
  word: 'vivir',
  from_level: 4,
  to_level: 5
});
```

---

### Custom Events

**Sign up:**
```javascript
trackEvent('signup', { method: 'email' });
```

**Study session:**
```javascript
trackEvent('session_start', { deck_size: 25 });
trackEvent('session_complete', {
  words_reviewed: 25,
  duration_seconds: 420,
  accuracy: 0.75
});
```

**Reading:**
```javascript
trackEvent('chapter_read', { chapter_number: 1 });
trackEvent('word_lookup', { chapter_number: 1 });
```

---

## DATABASE MONITORING

### Supabase Dashboard

**Built-in metrics:**
- Query performance
- Database size
- Active connections
- Slow queries
- Error logs

**Access:** Supabase Dashboard → Project → Database → Logs

---

### Query Performance

**Monitor slow queries:**

1. Go to Supabase Dashboard → Database → Query Performance
2. Look for queries >1 second
3. Optimize with indexes

**Example optimization:**

```sql
-- Identify slow query
EXPLAIN ANALYZE
SELECT * FROM user_lemma_progress
WHERE user_id = 'user-123'
  AND health < 20;

-- Add index if needed
CREATE INDEX idx_user_health 
  ON user_lemma_progress(user_id, health);
```

---

### Database Alerts

**Set up alerts in Supabase:**
- Database size >80% capacity
- Slow query detected
- Connection pool exhausted
- High error rate

---

## ALERTING

### Alert Channels

**Where alerts go:**
- Email (primary)
- Slack (post-MVP)
- SMS (critical only, post-MVP)

---

### Alert Types

**Critical (immediate action):**
- Site down
- Database connection failed
- Error rate >10%
- Response time >5s

**Warning (investigate soon):**
- Error rate >5%
- Response time >2s
- Database size >70%
- Slow queries detected

**Info (monitor):**
- New sign ups spike
- Unusual traffic pattern
- Feature usage changes

---

### Alert Configuration

**Netlify:**
- Deploy notifications (email)
- Build failures (email)

**Supabase:**
- Database alerts (email)
- Connection issues (email)

**Sentry:**
- Error threshold alerts (email)
- New error types (email)

---

### On-Call Schedule (Post-MVP)

**For production issues:**
- Primary: Peter
- Backup: (TBD if team grows)

**Response times:**
- Critical: 15 minutes
- Warning: 1 hour
- Info: Next business day

---

## DASHBOARDS

### Main Dashboard

**Metrics to display:**

```
┌─────────────────────────────────────────────────────────┐
│  VOQUAB MONITORING DASHBOARD                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🟢 System Status: All Systems Operational              │
│                                                         │
│  📊 TRAFFIC (Last 24h)                                  │
│    Page views: 1,245                                    │
│    Unique users: 342                                    │
│    Avg session: 12 min                                  │
│                                                         │
│  ⚡ PERFORMANCE                                          │
│    Avg load time: 1.2s                                  │
│    LCP: 1.8s ✅                                          │
│    FID: 45ms ✅                                          │
│    CLS: 0.05 ✅                                          │
│                                                         │
│  ❌ ERRORS (Last 24h)                                   │
│    Total errors: 3                                      │
│    Unique errors: 2                                     │
│    Affected users: 2                                    │
│                                                         │
│  💾 DATABASE                                             │
│    Size: 45MB / 500MB (9%)                              │
│    Connections: 12 / 100                                │
│    Avg query time: 23ms                                 │
│                                                         │
│  📈 USER ENGAGEMENT                                      │
│    Daily active users: 127                              │
│    Sessions completed: 89                               │
│    Avg words/session: 23                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Weekly Report

**Automated weekly email:**

```
VOQUAB WEEKLY REPORT
Week of Nov 25 - Dec 1, 2025

GROWTH
✅ +42 new users (15% growth)
✅ 234 daily active users (avg)
📈 User retention: 68% (week-over-week)

PERFORMANCE
✅ 99.8% uptime (4 min downtime)
✅ 1.4s avg page load
⚠️  3 slow queries detected

ERRORS
✅ 12 total errors (0.05% error rate)
❌ 1 new error type (fixed)

TOP FEATURES
1. Flashcards: 1,234 sessions
2. Reading: 567 chapters read
3. Progress: 345 views

ACTION ITEMS
• Optimize slow query on user_lemma_progress
• Investigate new error type (Sentry-123)
• Review traffic spike on Monday
```

---

## MONITORING CHECKLIST

### Daily

- [ ] Check error dashboard (Sentry)
- [ ] Review overnight deployments
- [ ] Check any alerts

### Weekly

- [ ] Review performance metrics
- [ ] Check database size/growth
- [ ] Review slow queries
- [ ] Analyze user engagement

### Monthly

- [ ] Full analytics review
- [ ] Database optimization
- [ ] Update dependencies
- [ ] Security audit

---

## INCIDENT RESPONSE

### When Alert Fires

**1. Acknowledge (within 15 min)**
- Check alert details
- Confirm incident
- Update status page (if applicable)

**2. Investigate (within 30 min)**
- Check logs (Sentry, Netlify, Supabase)
- Reproduce issue if possible
- Identify root cause

**3. Fix (ASAP)**
- Apply immediate fix
- Deploy hotfix if needed
- Verify resolution

**4. Post-Mortem (within 24h)**
- Document what happened
- Identify prevention steps
- Update runbooks

---

## MONITORING TOOLS SUMMARY

| Tool | Purpose | Cost | Setup |
|------|---------|------|-------|
| **Netlify Analytics** | Traffic, performance | Included | Automatic |
| **Supabase Dashboard** | Database monitoring | Included | Automatic |
| **Sentry** | Error tracking | Free tier | Post-MVP |
| **Plausible** | Privacy analytics | $9/month | Post-MVP |
| **Lighthouse** | Performance audits | Free | Manual |

---

## RELATED DOCUMENTS

- See **20_ERROR_HANDLING.md** for error handling
- See **13_DEPLOYMENT.md** for deployment monitoring
- See **18_SECURITY.md** for security monitoring

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF MONITORING**
