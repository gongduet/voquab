# 24_ANALYTICS_STRATEGY.md

**Last Updated:** December 15, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Key Metrics](#key-metrics)
3. [User Behavior Tracking](#user-behavior-tracking)
4. [Conversion Funnels](#conversion-funnels)
5. [Retention Analysis](#retention-analysis)
6. [A/B Testing](#ab-testing)
7. [Privacy-First Analytics](#privacy-first-analytics)

---

## OVERVIEW

Analytics help us understand how users engage with Voquab and where to focus development efforts.

**Goals:**
- Measure learning effectiveness
- Understand user engagement
- Identify drop-off points
- Validate product decisions
- Respect user privacy

**Tools:**
- **Plausible Analytics** (privacy-focused, GDPR-compliant)
- **Supabase Analytics** (database queries)
- **Netlify Analytics** (traffic, performance)

**Philosophy:** Collect minimum necessary data, never sell user data, full transparency.

---

## KEY METRICS

### North Star Metric

**Definition:** Number of words mastered to Level 5+ per active user per week

**Why:** Measures actual learning (not just activity). Aligns with Voquab's mission.

**Target:** 20 words/week average by 3 months post-launch

---

### Primary Metrics

#### 1. Active Users

**Daily Active Users (DAU):**
- Users who complete at least one study session per day
- Target: 50 DAU by month 1, 200 DAU by month 6

**Weekly Active Users (WAU):**
- Users who complete at least one session per week
- Target: 100 WAU by month 1, 500 WAU by month 6

**Monthly Active Users (MAU):**
- Users who complete at least one session per month
- Target: 200 MAU by month 1, 1,000 MAU by month 6

**Stickiness Ratio:**
```
DAU / MAU = Engagement health
```
- Good: >20% (users come back frequently)
- Target: 25% by month 3

---

#### 2. Retention

**Day 1 Retention:**
- % of users who return day after signup
- Target: 40%

**Day 7 Retention:**
- % of users who return within 7 days
- Target: 30%

**Day 30 Retention:**
- % of users who return within 30 days
- Target: 20%

**Cohort Analysis:**
Track retention by signup week to identify trends

---

#### 3. Learning Metrics

**Words Mastered:**
- Total words at Level 5+ per user
- Average: 100 words by month 1, 300 by month 3

**Study Sessions:**
- Average sessions per active user per week
- Target: 4 sessions/week

**Session Completion Rate:**
- % of sessions completed (not abandoned)
- Target: 80%

**Accuracy:**
- % Medium + Easy responses
- Healthy range: 60-80%
- <60% = too hard (adjust difficulty)
- >80% = too easy (advance faster)

---

#### 4. Engagement Metrics

**Time in App:**
- Average session duration
- Target: 10-15 minutes per session

**Chapter Progression:**
- Average chapters unlocked per user
- Target: 3 chapters by month 1

**Feature Usage:**
- % users who use reading mode
- % users who use flashcards
- % users who check progress page

---

### Secondary Metrics

**Sign Up Conversion:**
```
Sign Ups / Landing Page Visits = Conversion Rate
```
- Target: 5-10%

**Email Verification Rate:**
```
Verified Emails / Sign Ups = Verification Rate
```
- Target: 80%

**Referral Rate:**
```
Referred Users / Total Users = Viral Coefficient
```
- Target: 10% (1 in 10 users refers someone)

---

## USER BEHAVIOR TRACKING

### Critical Events

**Authentication:**
```javascript
trackEvent('signup', { method: 'email' });
trackEvent('signin', { method: 'email' });
trackEvent('signout');
```

**Study Sessions:**
```javascript
trackEvent('session_start', {
  deck_size: 25,
  chapter_focus: true
});

trackEvent('session_complete', {
  words_reviewed: 25,
  duration_seconds: 420,
  accuracy: 0.75,
  dont_know: 3,
  hard: 6,
  medium: 10,
  easy: 6
});

trackEvent('session_abandoned', {
  words_reviewed: 12,
  duration_seconds: 180
});
```

**Learning Progress:**
```javascript
trackEvent('level_up', {
  lemma: 'vivir',
  from_level: 4,
  to_level: 5
});

trackEvent('chapter_unlock', {
  chapter_number: 2,
  days_to_unlock: 7,
  total_reviews: 150
});
```

**Reading:**
```javascript
trackEvent('chapter_read', {
  chapter_number: 1
});

trackEvent('word_lookup', {
  chapter_number: 1,
  lemma: 'tenía'
});

trackEvent('word_add_to_queue', {
  chapter_number: 1,
  lemma: 'bosque'
});
```

**Engagement:**
```javascript
trackEvent('streak_milestone', {
  days: 7
});

trackEvent('badge_earned', {
  badge_id: 'week_warrior'
});
```

### Streak Calculation

Streaks are calculated from consecutive days of activity, not stored values.

**How it works:**

```javascript
// In Dashboard.jsx fetchStreakData()
async function calculateStreakFromActivity(activityMap) {
  let streak = 0
  const today = new Date()

  // Check each day going backwards
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateStr = checkDate.toISOString().split('T')[0]

    // Day has activity if count > 0
    if ((activityMap.get(dateStr) || 0) > 0) {
      streak++
    } else {
      break // Streak broken
    }
  }

  return streak
}
```

**Key points:**
- `user_daily_stats.current_streak` is now properly maintained during `updateDailyStats()`
- Streak increments when today's activity is logged and previous day had activity
- Longest streak tracking updates `longest_streak`, `longest_streak_start`, `longest_streak_end` columns
- Both Dashboard header pill and ActivityHeatmap display the calculated streak

---

### User Properties

**Track user attributes:**

```javascript
// Set user properties (no PII)
setUserProperties({
  signup_date: '2025-11-30',
  current_chapter: 3,
  total_words_mastered: 127,
  study_streak: 12,
  preferred_session_size: 'standard'
});
```

**Don't track:**
- Email addresses
- Names
- IP addresses (beyond country)
- Detailed device info

---

## CONVERSION FUNNELS

### Sign Up Funnel

```
Landing Page → Sign Up Form → Email Verification → First Session
100%         → 10%           → 8%                → 6%
```

**Key Drop-offs:**
1. Landing → Sign up (90% drop)
2. Sign up → Email verification (20% drop)
3. Email verification → First session (25% drop)

**Optimization Focus:**
- Improve landing page conversion
- Streamline signup flow
- Reduce friction to first session

---

### Onboarding Funnel

```
First Session → Complete Session → Return Day 2 → Week 1 Retention
100%          → 80%              → 40%          → 30%
```

**Critical Points:**
- First session completion (80% target)
- Day 2 return (40% target)
- Week 1 active (30% target)

**Metrics to Track:**
```javascript
// First session
trackEvent('onboarding_start');
trackEvent('first_card_reviewed');
trackEvent('first_session_complete');

// Early engagement
trackEvent('day_2_return');
trackEvent('week_1_session_count', { sessions: 3 });
```

---

### Feature Adoption Funnel

**Reading Mode:**
```
User → Opens Book → Reads Chapter → Clicks Word → Adds to Queue
100% → 60%        → 40%          → 20%        → 10%
```

**Metrics:**
```javascript
trackEvent('feature_discovered', { feature: 'reading' });
trackEvent('feature_used', { feature: 'reading' });
trackEvent('feature_mastered', { feature: 'reading', sessions: 5 });
```

---

## RETENTION ANALYSIS

### Cohort Analysis

**Group users by signup week:**

```
Cohort: Nov 25-Dec 1, 2025
Week 0: 100 users (baseline)
Week 1:  40 users (40% retention)
Week 2:  30 users (30% retention)
Week 3:  25 users (25% retention)
Week 4:  22 users (22% retention)
```

**Compare cohorts to identify:**
- Product changes that improved retention
- Seasonal patterns
- User acquisition quality by channel

---

### Churn Analysis

**Identify churn signals:**

**Early Churn Indicators (Week 1):**
- No session in first 48 hours
- First session <5 minutes
- First session abandoned
- No email verification

**Mid-term Churn Indicators (Week 2-4):**
- <2 sessions per week
- Declining session frequency
- Decreasing session duration
- No progress (stuck on same chapter)

**Churn Prevention:**
```javascript
// Detect at-risk users
if (daysSinceLastSession > 3 && totalSessions < 5) {
  // Send re-engagement email
  sendEmail('come_back_gentle_reminder');
}
```

---

### Win-Back Campaigns

**For churned users:**

**30-day inactive:**
- Email: "We miss you! Here's what's new"
- Incentive: Badge for returning

**90-day inactive:**
- Email: "Your progress is waiting"
- Show: Words mastered count

**Never engaged:**
- Email: "Ready to start learning?"
- CTA: "Complete your first session"

---

## A/B TESTING

### Testing Framework (Post-MVP)

**Tool:** Netlify Edge Functions + feature flags

**What to Test:**
- Onboarding flow variations
- Session size options (15 vs 25 cards)
- Time gate strictness
- UI variations (colors, layouts)

---

### Example Tests

#### Test 1: Onboarding Flow

**Hypothesis:** Guided tutorial increases day 1 retention

**Variants:**
- Control: No tutorial, dive right in
- Treatment: 3-step guided tutorial

**Metric:** Day 1 retention rate

**Sample size:** 100 users per variant

**Success criteria:** >10% lift in retention

---

#### Test 2: Default Session Size

**Hypothesis:** Smaller default (15 cards) increases completion rate

**Variants:**
- Control: 25 cards default
- Treatment: 15 cards default

**Metric:** Session completion rate

**Sample size:** 200 users per variant

**Success criteria:** >5% lift in completion

---

#### Test 3: Streak Reminder Timing

**Hypothesis:** Evening reminder (8 PM) > morning (9 AM)

**Variants:**
- Control: 9 AM reminder
- Treatment: 8 PM reminder

**Metric:** Streak maintenance rate

**Sample size:** 150 users per variant

**Success criteria:** >15% lift in streak maintenance

---

### A/B Testing Best Practices

**Do:**
- Test one variable at a time
- Run test until statistical significance
- Have clear success metric
- Document results

**Don't:**
- Test on small samples (<100 per variant)
- Stop test early
- Test multiple variables simultaneously
- Change test mid-run

---

## PRIVACY-FIRST ANALYTICS

### What We Track

**Allowed:**
- Page views (no personal info)
- Events (anonymized)
- Aggregate metrics
- Country-level geography
- Device type (mobile/desktop)

**Forbidden:**
- Personal email addresses
- IP addresses (beyond country)
- Precise location
- Cross-site tracking
- Selling data to third parties

---

### Cookie-Free Tracking

**Plausible uses:**
- No cookies
- No personal data collection
- GDPR compliant by default
- No consent banner needed

**Implementation:**

```html
<!-- In index.html -->
<script defer data-domain="voquab.app" src="https://plausible.io/js/script.js"></script>
```

---

### Data Retention

**Analytics data:**
- Keep: 2 years
- After 2 years: Aggregate only (delete individual events)

**User data:**
- Active accounts: Indefinite
- Deleted accounts: 30 days (for recovery), then permanent deletion

---

### User Control

**Users can:**
- Opt out of analytics (respects Do Not Track)
- Export their data (JSON format)
- Delete their account and data

**We provide:**
- Clear privacy policy
- Transparency about data collection
- No hidden tracking

---

## DASHBOARDS

### Executive Dashboard

**Daily view:**
```
┌─────────────────────────────────────────┐
│  VOQUAB ANALYTICS                       │
│  November 30, 2025                      │
├─────────────────────────────────────────┤
│                                         │
│  📊 GROWTH                              │
│    DAU: 127 (+5 from yesterday)         │
│    WAU: 456                             │
│    MAU: 892                             │
│    New signups: 12                      │
│                                         │
│  💪 ENGAGEMENT                          │
│    Sessions today: 89                   │
│    Avg session time: 12 min             │
│    Completion rate: 82%                 │
│                                         │
│  📚 LEARNING                            │
│    Words reviewed: 2,234                │
│    Level-ups: 45                        │
│    Chapters unlocked: 8                 │
│                                         │
│  🔄 RETENTION                           │
│    Day 1: 38%                           │
│    Day 7: 28%                           │
│    Day 30: 19%                          │
│                                         │
└─────────────────────────────────────────┘
```

---

### Weekly Report

**Key trends:**
- User growth (week over week)
- Retention by cohort
- Top performing features
- Areas of concern

**Automated email every Monday**

---

## ANALYTICS CHECKLIST

### Before Launch

- [ ] Plausible Analytics installed
- [ ] Key events defined
- [ ] Event tracking implemented
- [ ] Privacy policy updated
- [ ] Cookie-free tracking verified

### Weekly

- [ ] Review dashboard
- [ ] Check retention metrics
- [ ] Identify churn signals
- [ ] Analyze feature usage

### Monthly

- [ ] Cohort analysis
- [ ] Compare to goals
- [ ] Identify A/B test opportunities
- [ ] Update strategy based on data

---

## RELATED DOCUMENTS

- See **19_MONITORING.md** for technical monitoring
- See **25_MARKETING_PLAN.md** for growth tactics
- See **27_FEATURE_PRIORITIZATION.md** for product decisions

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- 2025-12-15: Added Streak Calculation section documenting consecutive-days logic (Claude)
- Status: Active

---

**END OF ANALYTICS STRATEGY**
