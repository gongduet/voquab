# 01_MVP_DEFINITION.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [MVP Philosophy](#mvp-philosophy)
3. [What's IN the MVP](#whats-in-the-mvp)
4. [What's NOT in the MVP](#whats-not-in-the-mvp)
5. [Launch Criteria](#launch-criteria)
6. [Success Metrics](#success-metrics)
7. [Beta Testing Plan](#beta-testing-plan)
8. [Post-MVP Roadmap](#post-mvp-roadmap)

---

## OVERVIEW

This document defines the **Minimum Viable Product (MVP)** for Voquab - the smallest feature set that delivers a complete, valuable learning experience.

**MVP Goal:** A beautiful, mobile-optimized Spanish learning companion for El Principito that works flawlessly with 99% translation accuracy.

**Target Users:** Spanish learners who love The Little Prince  
**Launch Timeline:** When complete (quality over speed)  
**Initial Audience:** Friends beta → Small test group → Public launch

---

## MVP PHILOSOPHY

### What Makes This an MVP

**Minimum:**
- One book (El Principito)
- One language pair (Spanish → English)
- Core learning features only
- No advanced gamification

**Viable:**
- Complete learning experience (read → study → progress)
- 99% translation accuracy
- Beautiful mobile interface
- No crashes or major bugs

**Product:**
- Ready for real users
- Complete enough to validate concept
- Foundation for future expansion

### What We're Validating

1. **Does contextual learning work?** Users learn better through literature than isolated flashcards
2. **Is lemma-based mastery intuitive?** Users understand studying "vivir" not 50 conjugations
3. **Does the dual-track system make sense?** Mastery + health metrics guide learning effectively
4. **Is the mobile experience delightful?** Beautiful design drives daily engagement
5. **Will users complete the book?** Sequential chapter progression keeps users motivated

---

## WHAT'S IN THE MVP

### ✅ Content

**El Principito (Complete):**
- All 27 chapters imported
- All ~463 sentences with translations
- All ~1,500 vocabulary words
- All ~1,172 unique lemmas with definitions
- 99% translation accuracy verified

**Quality Standards:**
- Every lemma correctly assigned
- Every definition semantically accurate
- Every sentence translation natural
- Manual review by native speakers complete

---

### ✅ Core Learning Features

**1. Flashcard System**
- Intelligent card selection (priority scoring)
- 4 difficulty levels (Don't Know, Hard, Medium, Easy)
- Dual-track progression (mastery + health)
- Time-gated mastery (prevents gaming)
- Health decay system (words need regular practice)
- Spaced repetition intervals
- Session analytics and progress tracking

**2. Chapter System**
- Sequential chapter unlock (must encounter 100% of words)
- Chapter-focused study mode
- Progress tracking per chapter
- Chapter completion celebrations

**3. Reading Mode**
- Full Spanish text of El Principito
- Click words for instant definitions
- Add words to study queue
- Track reading progress

**4. Learning Algorithm**
- Priority scoring (health, frequency, chapter position, mastery readiness)
- Dynamic deck composition (balanced mix of critical/new/mastery-ready)
- Prevents deck flooding (one card per lemma, not per form)
- Smart sentence selection (most recent or relevant)

---

### ✅ User Experience

**1. Authentication**
- Sign up / Log in (Supabase auth)
- User profiles
- Data isolation (RLS policies)

**2. Dashboard / Home**
- Daily stats (words reviewed, streak)
- Current progress summary
- Quick access to study/read
- Chapter unlock status

**3. Progress Tracking**
- Daily review counts
- Streak tracking (basic)
- Calendar heat map (activity visualization)
- Per-word mastery and health display
- Chapter progress percentages

**4. Mobile-First UI**
- Optimized for phone screens
- Touch-friendly interactions
- Fast load times (<2 seconds)
- Responsive design (works on tablet/desktop too)

**5. Beautiful Design**
- Little Prince themed aesthetics
- Clean, actionable interfaces
- Smooth animations
- Professional visual polish

---

### ✅ Admin Features

**1. Admin Dashboard**
- Search and edit lemmas
- Update definitions (support arrays)
- Change part of speech, gender
- Mark stop words
- Bulk operations

**2. Content Management**
- View all lemmas and words
- Filter by chapter, POS, etc.
- Manual override for misclassifications

**3. Validation Queue**
- Review AI-flagged translation issues
- Approve/reject/edit suggestions
- Track manual review progress

---

### ✅ Technical Foundation

**1. Database**
- Clean schema (lemmas + words)
- Proper foreign keys and indexes
- User progress tables
- RLS security policies

**2. Content Pipeline**
- Automated chapter import
- spaCy lemmatization
- DeepL translation
- AI semantic validation
- Manual review workflow

**3. Deployment**
- Netlify hosting (frontend)
- Supabase hosting (database)
- Environment variables managed
- GitHub version control

---

## WHAT'S NOT IN THE MVP

### ❌ Deferred to v2.0

**Advanced Gamification:**
- Badges and achievements (no visual badges)
- XP and leveling system (no XP points)
- Daily packages (Foundation/Standard/Immersion system)
- Waypoint system (themed mini-decks)
- Leaderboards (no competitive features)
- Streak bonuses or rewards

**Additional Content:**
- Multiple books beyond El Principito
- Other languages (French, Italian, etc.)
- User-generated content
- Community translations

**Advanced Features:**
- Audio pronunciation
- Speech recognition
- Spaced repetition visualization
- Word etymology/notes
- Mnemonic device creation
- Custom study decks
- Export/import progress
- Social sharing

**Advanced Analytics:**
- Learning velocity tracking
- Predicted completion dates
- Difficulty analysis
- Personal weak areas identification
- Detailed performance graphs

**Mobile Apps:**
- React Native iOS app
- React Native Android app
- Offline mode
- Push notifications

**Monetization:**
- Payment processing
- Premium features
- Subscription system

---

### ⚠️ Simplified in MVP

**Streak Tracking:**
- Basic streak counter (yes)
- Streak protection mechanisms (no)
- Streak recovery (no)
- Streak rewards (no)

**Session Analytics:**
- Basic stats (words reviewed, accuracy) (yes)
- Advanced metrics (time per card, confidence scores) (no)
- Comparison to past sessions (no)

**Reading Mode:**
- Click for definition (yes)
- Sentence-by-sentence rating (no)
- Reading comprehension tests (no)
- Chapter "boss battles" (no)

---

## LAUNCH CRITERIA

### Non-Negotiable Requirements

**1. Content Quality ✅**
- [ ] All 27 chapters imported
- [ ] 99% translation accuracy verified
- [ ] Native speaker review complete
- [ ] Zero placeholder or missing definitions

**2. Core Functionality ✅**
- [ ] Flashcard system works flawlessly
- [ ] Chapter unlock logic correct
- [ ] Reading mode functional
- [ ] Admin dashboard operational
- [ ] User authentication secure

**3. User Experience ✅**
- [ ] Mobile interface beautiful and smooth
- [ ] Load time <2 seconds on 4G
- [ ] No crashes or critical bugs
- [ ] Intuitive navigation
- [ ] Clear onboarding flow

**4. Data Integrity ✅**
- [ ] User progress saves correctly
- [ ] No data loss scenarios
- [ ] Proper error handling
- [ ] Database backups configured

**5. Testing ✅**
- [ ] 10+ beta testers complete feedback
- [ ] All major user flows tested
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Mobile device testing (iOS, Android)

---

### Nice-to-Have (But Not Blocking)

- Social media integration
- Email notifications
- Advanced animations
- Easter eggs or hidden features
- Perfect scores in accessibility audits

---

## SUCCESS METRICS

### Quantitative Metrics

**User Engagement:**
- Daily Active Users (DAU)
- Average session length
- Words reviewed per user per day
- Completion rate (% users who finish Chapter 1)

**Learning Effectiveness:**
- Average mastery gain per word
- Retention rate (come back next day)
- Chapter unlock rate
- Time to complete book

**Technical Performance:**
- Average page load time
- Crash rate (target: <0.1%)
- API error rate
- Database query performance

**Target Numbers (First Month):**
- 100+ total users
- 50+ daily active users
- 80%+ users complete Chapter 1
- 4+ average sessions per week per active user

---

### Qualitative Metrics

**User Satisfaction:**
- Net Promoter Score (NPS) target: 8+/10
- User testimonials and reviews
- Feature request themes
- Pain points identified

**Questions to Validate:**
- "Do users understand the lemma system?"
- "Does the mobile experience feel native?"
- "Is the learning effective (users feel progress)?"
- "Is the design beautiful and engaging?"
- "Would users recommend to friends?"

---

## BETA TESTING PLAN

### Phase 1: Friends & Family (Week 1)

**Participants:** 5-10 people  
**Goal:** Find obvious bugs and usability issues

**Tasks:**
- Complete onboarding
- Study Chapter 1 (20-30 words)
- Read Chapter 1
- Provide feedback

**Success Criteria:**
- No crashes
- All core features work
- Positive overall sentiment

---

### Phase 2: Expanded Beta (Week 2-3)

**Participants:** 20-30 Spanish learners  
**Goal:** Validate learning effectiveness

**Tasks:**
- Use app daily for 2 weeks
- Complete at least 3 chapters
- Track learning progress

**Feedback Collection:**
- Weekly surveys
- In-app feedback button
- 1-on-1 interviews with 5 users

**Success Criteria:**
- 70%+ retention (come back Day 2)
- 50%+ complete Chapter 3
- Positive learning outcomes reported

---

### Phase 3: Refinement (Week 4)

**Goal:** Fix issues, polish experience

**Tasks:**
- Implement critical fixes
- Address major feedback themes
- Improve pain points
- Final QA pass

**Decision Point:** 
- If success criteria met → Public launch
- If not → Another beta iteration

---

## POST-MVP ROADMAP

### Version 1.1 (1 Month Post-Launch)

**Focus:** Polish based on user feedback

- Fix reported bugs
- Improve onboarding based on user confusion
- Add most-requested small features
- Performance optimization

---

### Version 2.0 (3 Months Post-Launch)

**Focus:** Gamification & engagement

- Daily package system (Foundation/Standard/Immersion)
- Badges and achievements
- XP and leveling system
- Streak bonuses
- Leaderboards (optional)

---

### Version 2.5 (6 Months Post-Launch)

**Focus:** Reading experience

- Sentence-by-sentence rating
- Reading comprehension tests
- Chapter completion challenges
- Reading mode improvements

---

### Version 3.0 (9 Months Post-Launch)

**Focus:** Content expansion

- Second Spanish book
- French language launch
- User-contributed content (curated)

---

### Version 4.0 (12+ Months)

**Focus:** Platform expansion

- Mobile apps (React Native)
- Offline mode
- Audio features
- Premium tier

---

## SCOPE CREEP PREVENTION

### When Someone Suggests a Feature

**Ask:**
1. Is this MVP-critical?
2. Does this align with core value prop?
3. Does this add meaningful value vs complexity?
4. Can this wait until post-MVP?

**Default Answer:** "Great idea for v2.0!"

### Common Feature Requests to Defer

- "Can we add audio pronunciation?" → v4.0
- "What about user-created decks?" → v3.0
- "Daily challenge system?" → v2.0
- "Social features?" → v3.0+
- "Multiple books?" → v3.0

### What Changes ARE Allowed

- Bug fixes (always)
- Critical usability issues
- Translation accuracy improvements
- Performance optimization
- Security fixes

---

## QUICK REFERENCE

### MVP Checklist

**Content:**
- [ ] El Principito complete (27 chapters)
- [ ] 99% translation accuracy

**Features:**
- [ ] Flashcard system
- [ ] Chapter unlock
- [ ] Reading mode
- [ ] Admin dashboard

**Quality:**
- [ ] Mobile-optimized UI
- [ ] Beautiful design
- [ ] No crashes
- [ ] Fast load times

**Validation:**
- [ ] Beta testing complete
- [ ] Positive user feedback
- [ ] Native speaker approval

**Launch Ready:**
- [ ] All launch criteria met
- [ ] Deployment configured
- [ ] Monitoring in place

---

## RELATED DOCUMENTS

- See **00_PROJECT_OVERVIEW.md** for project vision
- See **02_DATABASE_SCHEMA.md** for technical foundation
- See **03_CONTENT_PIPELINE.md** for content quality process
- See **DOCUMENTATION_ROADMAP.md** for full project plan

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF MVP DEFINITION**
