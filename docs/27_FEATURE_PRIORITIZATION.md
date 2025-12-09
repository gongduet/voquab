# 27_FEATURE_PRIORITIZATION.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Prioritization Framework](#prioritization-framework)
3. [MVP Scope](#mvp-scope)
4. [Post-MVP Features](#post-mvp-features)
5. [Feature Backlog](#feature-backlog)
6. [Decision Log](#decision-log)
7. [Anti-Features](#anti-features)

---

## OVERVIEW

This document defines what to build, what to defer, and what to never build. Clear prioritization prevents scope creep and ensures we ship a great MVP.

**Philosophy:**
- **Ship fast, iterate:** Perfect is the enemy of done
- **Core loop first:** Nail reading + flashcards before adding features
- **User value:** Every feature must serve learning
- **Say no:** Most features don't belong in MVP

---

## PRIORITIZATION FRAMEWORK

### RICE Scoring

**Reach:** How many users impacted?
- 1 = <10% of users
- 2 = 10-50% of users
- 3 = >50% of users

**Impact:** How much will it improve their experience?
- 1 = Minor improvement
- 2 = Moderate improvement
- 3 = Major improvement

**Confidence:** How sure are we this will work?
- 1 = Low confidence (untested idea)
- 2 = Medium confidence (validated with some users)
- 3 = High confidence (proven pattern)

**Effort:** How long to build?
- 1 = <1 week
- 2 = 1-2 weeks
- 3 = 3-4 weeks
- 4 = >4 weeks

**Score = (Reach × Impact × Confidence) / Effort**

**Priority:**
- >3.0 = High priority (build soon)
- 1.5-3.0 = Medium priority (backlog)
- <1.5 = Low priority (probably not)

---

### MoSCoW Method

**Must Have:** MVP doesn't work without this
**Should Have:** Important, but can launch without
**Could Have:** Nice to have, adds polish
**Won't Have:** Explicitly excluded (for now)

---

## MVP SCOPE

### Must Have (MVP)

**For MVP to launch, users must be able to:**

1. **Sign up & authenticate**
   - Email + password signup
   - Email verification
   - Sign in / sign out
   - Password reset

2. **Read the book**
   - View chapter list
   - Read chapter text (Spanish)
   - See English translations
   - Navigate between chapters

3. **Study vocabulary**
   - Start flashcard session
   - See Spanish word + English meaning
   - See example sentence from book
   - Mark difficulty (Don't Know, Hard, Medium, Easy)
   - Complete session
   - Track progress (mastery, health)

4. **Track progress**
   - See words mastered
   - See current streak
   - View chapter unlock status
   - See daily stats

5. **Chapter unlocking**
   - Chapters locked by default
   - Unlock by meeting requirements
   - Clear progress toward unlock

**That's it. Nothing else is required for MVP.**

---

### MVP Feature Details

#### Authentication ✅
**Status:** Core infrastructure
- Supabase Auth (email/password)
- Email verification required
- Password reset flow
- Session management

**Why MVP:**
- Users need accounts
- Security requirement
- Standard practice

---

#### Reading Mode ✅
**Status:** Must have
- Clean reading interface
- Spanish text + English translations
- Chapter navigation
- Responsive (mobile + desktop)

**Why MVP:**
- Core value proposition
- Context for vocabulary
- Users will want to read

---

#### Flashcards ✅
**Status:** Core learning loop
- Priority-based card selection
- Four difficulty buttons
- Health + mastery tracking
- Session completion

**Why MVP:**
- The main learning mechanism
- Validates learning algorithm
- Without this, no product

---

#### Progress Tracking ✅
**Status:** Motivation system
- Words mastered count
- Streak counter
- Chapter progress
- Basic stats

**Why MVP:**
- Users need to see progress
- Motivates continued use
- Transparent learning

---

#### Chapter Unlocking ✅
**Status:** Progression system
- Sequential unlocking
- Dual-path requirements (mastery OR exposure)
- Clear unlock criteria

**Why MVP:**
- Prevents overwhelm
- Creates goals
- Guides progression

---

### Explicitly NOT in MVP

**Daily packages** ❌
- Reason: Adds complexity, can do simple "Start studying" instead
- When: Post-MVP (1-2 months)

**Waypoints** ❌
- Reason: Nice-to-have chunking, not essential
- When: Post-MVP (2-3 months)

**Badges** ❌
- Reason: Gamification polish, not core
- When: Post-MVP (1-2 months)

**XP & levels** ❌
- Reason: Extra gamification, streak is enough
- When: Post-MVP (2-3 months)

**Word audio** ❌
- Reason: Expensive (API costs), not essential for reading-based learning
- When: Post-MVP (3-6 months), if budget allows

**Word lookup in reading** ❌
- Reason: Nice UX, but users can add words to study separately
- When: Post-MVP (1 month)

**Multiple books** ❌
- Reason: One book proves concept
- When: Post-MVP (6-12 months)

**Mobile app** ❌
- Reason: Web works on mobile, native app is huge undertaking
- When: Year 2+

---

## POST-MVP FEATURES

### Phase 1: Polish & Engagement (Months 1-3)

**1. Daily Packages**
**RICE Score:** (3 × 3 × 2) / 2 = **9.0** (HIGH)
- Users choose 50/100/150/250 word commitment
- Themed waypoints
- 24-hour expiration

**Why:** Creates daily ritual, increases engagement

**Effort:** 2 weeks

---

**2. Word Lookup in Reading**
**RICE Score:** (3 × 2 × 3) / 1 = **18.0** (HIGH)
- Click word in chapter → see definition
- Add to study queue
- Mark as known

**Why:** Seamless learning flow, highly requested

**Effort:** 1 week

---

**3. Basic Badges**
**RICE Score:** (2 × 2 × 3) / 1 = **12.0** (HIGH)
- Completion badges (sessions, chapters)
- Streak badges (7, 30, 100 days)
- Milestone badges (100, 500, 1000 words)

**Why:** Recognition, motivation, shareable moments

**Effort:** 1 week

---

**4. Session Summary Improvements**
**RICE Score:** (3 × 2 × 3) / 1 = **18.0** (HIGH)
- Better stats visualization
- Words that leveled up
- Health rescued
- Share to social

**Why:** Celebration, sharing, transparency

**Effort:** 3-5 days

---

### Phase 2: Advanced Learning (Months 4-6)

**5. Spaced Repetition Improvements**
**RICE Score:** (3 × 3 × 2) / 2 = **9.0** (HIGH)
- Optimize intervals based on data
- Predictive "words due" counter
- Review calendar

**Why:** Core algorithm improvements, better learning

**Effort:** 2 weeks

---

**6. Word Notes & Mnemonics**
**RICE Score:** (2 × 3 × 2) / 1 = **12.0** (HIGH)
- Users can add notes to words
- Mnemonic device suggestions (AI)
- Personal context

**Why:** Personalization, helps struggling words

**Effort:** 1 week

---

**7. Audio Pronunciation**
**RICE Score:** (2 × 2 × 2) / 2 = **4.0** (MEDIUM)
- Text-to-speech for words
- Native speaker recordings (curated list)
- Sentence audio

**Why:** Pronunciation practice, accessibility

**Effort:** 2 weeks + API costs ($50-100/month)

---

**8. Weak Word Focus Mode**
**RICE Score:** (2 × 3 × 3) / 1 = **18.0** (HIGH)
- Session of only struggling words
- Extra practice for leeches
- Targeted intervention

**Why:** Helps users overcome plateaus

**Effort:** 3-5 days

---

### Phase 3: Social & Community (Months 7-12)

**9. Friend System**
**RICE Score:** (1 × 2 × 2) / 2 = **2.0** (MEDIUM)
- Add friends
- See friends' progress (opt-in)
- Friendly competition

**Why:** Social motivation, retention

**Effort:** 2 weeks

---

**10. Leaderboards (Optional)**
**RICE Score:** (1 × 2 × 2) / 1 = **4.0** (MEDIUM)
- Weekly leaderboard (words reviewed)
- Regional (city-based)
- Opt-in only

**Why:** Competition motivates some users

**Effort:** 1 week

---

**11. Study Groups**
**RICE Score:** (1 × 2 × 1) / 3 = **0.7** (LOW)
- Invite friends to group
- Shared progress
- Group challenges

**Why:** Community, but low initial demand

**Effort:** 3 weeks

---

### Phase 4: Content Expansion (Year 2)

**12. Book 2**
**RICE Score:** (3 × 3 × 2) / 4 = **4.5** (MEDIUM-HIGH)
- Add second Spanish book
- Different difficulty level
- Validate multi-book system

**Why:** Content variety, broader audience

**Effort:** 4 weeks (content + system changes)

**See:** 26_CONTENT_ROADMAP.md

---

**13. Second Language**
**RICE Score:** (2 × 3 × 1) / 4 = **1.5** (MEDIUM)
- Add French (Le Petit Prince)
- Validate language expansion
- New user segment

**Why:** Market expansion, proof of scalability

**Effort:** 4 weeks

**See:** 26_CONTENT_ROADMAP.md

---

## FEATURE BACKLOG

### High Priority (Next 6 months)
1. Daily packages (RICE: 9.0)
2. Word lookup in reading (RICE: 18.0)
3. Badges (RICE: 12.0)
4. Session summary improvements (RICE: 18.0)
5. Weak word focus mode (RICE: 18.0)
6. Word notes (RICE: 12.0)
7. Spaced repetition optimization (RICE: 9.0)

### Medium Priority (6-12 months)
8. Audio pronunciation (RICE: 4.0)
9. Friend system (RICE: 2.0)
10. Leaderboards (RICE: 4.0)
11. Book 2 (RICE: 4.5)

### Low Priority (Year 2+)
12. Second language (RICE: 1.5)
13. Study groups (RICE: 0.7)
14. Native mobile app (RICE: TBD)
15. Teacher tools (RICE: TBD)

---

## DECISION LOG

### Feature Decisions Made

#### ✅ Included in MVP

**Time-gated mastery:**
- Decision: Include in MVP
- Reason: Core to learning integrity, prevents gaming
- Date: Nov 9, 2025

**Health decay system:**
- Decision: Include in MVP
- Reason: Creates urgency, prioritizes struggling words
- Date: Nov 9, 2025

**Dual-path chapter unlocking:**
- Decision: Include in MVP
- Reason: Rewards both quality and quantity learners
- Date: Nov 8, 2025

---

#### ❌ Deferred from MVP

**Daily packages:**
- Decision: Defer to post-MVP
- Reason: Adds complexity, simple "Start studying" works for launch
- Alternative: "Study 25 words" button
- Date: Nov 9, 2025

**Waypoints:**
- Decision: Defer to post-MVP
- Reason: Nice chunking but not essential, packages can work without them
- Date: Nov 9, 2025

**Badges & XP:**
- Decision: Defer to post-MVP
- Reason: Gamification polish, streak counter is enough motivation for MVP
- Date: Nov 9, 2025

**Word audio:**
- Decision: Defer to post-MVP
- Reason: Expensive (API costs), reading-focused MVP doesn't require audio
- Date: Nov 9, 2025

**Multiple books:**
- Decision: Defer to Year 1
- Reason: Prove concept with one book first, validate demand
- Date: Nov 9, 2025

---

#### 🚫 Rejected (Anti-Features)

**Lives/energy system:**
- Decision: Never implement
- Reason: Dark pattern, artificial constraint, hurts learning
- Date: Nov 9, 2025

**Paid skips/boosts:**
- Decision: Never implement
- Reason: Pay-to-win, compromises learning integrity
- Date: Nov 9, 2025

**Intrusive ads:**
- Decision: Never implement
- Reason: Ruins experience, rather charge subscription
- Date: Nov 9, 2025

**Social pressure notifications:**
- Decision: Never implement
- Reason: Manipulative, creates anxiety, use gentle reminders only
- Date: Nov 9, 2025

**Infinite scrolling:**
- Decision: Never implement
- Reason: Time-wasting, use pagination instead
- Date: Nov 9, 2025

---

## ANTI-FEATURES

### What We Will Never Build

These features are explicitly rejected because they conflict with our values:

**1. Dark Patterns**
- Lives/energy that limit practice
- Artificial wait times
- Pay-to-skip mechanics
- Manipulative notifications

**Why not:** Prioritizes revenue over learning, creates anxiety

---

**2. Attention Manipulation**
- Infinite scroll
- Auto-play next lesson
- Addictive game mechanics
- Clickbait notifications

**Why not:** Learning should be intentional, not compulsive

---

**3. Data Exploitation**
- Selling user data
- Invasive tracking
- Unclear privacy practices
- Advertising user progress to others without permission

**Why not:** Violates trust, wrong ethics

---

**4. Pay-to-Win**
- Purchase mastery points
- Buy chapter unlocks
- Skip time gates with payment
- Premium-only learning features

**Why not:** Learning progress should be earned, not bought

---

**5. Social Pressure**
- Public shaming for missed days
- Forced social sharing
- Competitive stress
- Comparison to "top learners"

**Why not:** Learning should be joyful, not stressful

---

### What We Might Build (If Done Right)

**Subscriptions:**
- ✅ IF: Core learning stays free
- ✅ IF: Premium = extra content, not better learning
- ✅ IF: Transparent pricing

**Social features:**
- ✅ IF: Opt-in
- ✅ IF: Supportive, not competitive
- ✅ IF: Private by default

**Notifications:**
- ✅ IF: Helpful, not nagging
- ✅ IF: Easy to disable
- ✅ IF: Respectful of user time

**Gamification:**
- ✅ IF: Serves learning
- ✅ IF: Progress is earned
- ✅ IF: Can be ignored without penalty

---

## USER FEEDBACK INTEGRATION

### How Users Influence Roadmap

**Feature requests:**
1. Collect via in-app feedback, Discord, email
2. Tag by category
3. Vote on top requests
4. Review quarterly

**Prioritization:**
- User votes: 30%
- Learning value: 30%
- Technical feasibility: 20%
- Strategic fit: 20%

**Response:**
- Acknowledge all requests
- Explain yes/no/later
- Update roadmap based on patterns

---

### User Research

**Monthly surveys:**
- NPS score (would you recommend?)
- Feature satisfaction
- What's missing?
- Open feedback

**User interviews:**
- 5 users per month
- 30-minute calls
- Understand their goals
- Observe their usage

**Usage analytics:**
- Feature adoption rates
- Drop-off points
- Session patterns
- Error rates

**See:** 24_ANALYTICS_STRATEGY.md

---

## ROADMAP VISUALIZATION

### Next 12 Months

```
Month 1-2: MVP Launch
├─ Core features complete
├─ Bug fixes
└─ Initial user feedback

Month 3-4: Quick Wins
├─ Word lookup in reading
├─ Basic badges
└─ Session summary improvements

Month 5-6: Advanced Learning
├─ Daily packages
├─ Word notes & mnemonics
└─ Spaced repetition optimization

Month 7-9: Engagement
├─ Weak word focus mode
├─ Audio pronunciation
└─ Friend system (optional)

Month 10-12: Content
├─ Book 2 (Spanish)
├─ Content pipeline refinement
└─ Year 2 planning
```

---

## RELATED DOCUMENTS

- See **01_MVP_DEFINITION.md** for MVP details
- See **26_CONTENT_ROADMAP.md** for content plans
- See **24_ANALYTICS_STRATEGY.md** for metrics
- See **23_DECISION_LOG.md** for all decisions

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF FEATURE PRIORITIZATION**
