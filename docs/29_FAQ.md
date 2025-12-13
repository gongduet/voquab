# 29_FAQ.md

**Document Type:** LIVING DOCUMENT (Updated Continuously)
**Last Updated:** December 13, 2025
**Maintainer:** Peter + Claude

---

## TABLE OF CONTENTS

1. [General Questions](#general-questions)
2. [Learning Methodology](#learning-methodology)
3. [Technical Questions](#technical-questions)
4. [Content & Translation](#content--translation)
5. [Privacy & Security](#privacy--security)
6. [Pricing & Business Model](#pricing--business-model)
7. [Roadmap & Features](#roadmap--features)
8. [Troubleshooting](#troubleshooting)

---

## GENERAL QUESTIONS

### What is Voquab?

Voquab is a Spanish vocabulary learning app that teaches through "El Principito" (The Little Prince). Every word is learned in context through actual sentences from the story.

**Different from other apps:**
- Real literature, not artificial examples
- Context-based learning (see words in sentences)
- Beautiful reading experience
- Honest progress tracking (no dark patterns)
- Built by a learner, for learners

---

### Who is Voquab for?

**Perfect for:**
- Spanish learners (A2-B1 level, intermediate beginner)
- Literature lovers who want to read classics
- People frustrated with shallow vocabulary apps
- Learners who value context over rote memorization
- Anyone who loves "The Little Prince"

**Not ideal for:**
- Complete beginners (A1)
- Advanced speakers (C1-C2) - though more books coming
- People who prefer conversation-focused learning
- Those wanting rapid-fire gamification

---

### Why "The Little Prince"?

**It's the perfect learning text:**
- Beloved worldwide (140M+ copies sold)
- Simple yet profound language
- Perfect length (not too short, not too long)
- Emotionally resonant (makes learning memorable)
- Public domain (published 1943)
- Rich vocabulary (1,500+ unique words)
- A2-B1 level (intermediate beginner sweet spot)

---

### Is Voquab free?

**MVP (initial launch):** Yes, completely free

**Future (Year 2+):** Freemium model
- Core learning: Free forever
- Premium features: Subscription ($5-10/month)
  - Additional books
  - Audio pronunciation
  - Advanced analytics
  - Priority support

**Promise:** You'll never have to pay to learn vocabulary. Premium is extra content, not better learning.

---

### How is Voquab different from Duolingo?

**Voquab:**
- Real literature (The Little Prince)
- Context-based (every word in a sentence)
- Depth over speed (true mastery)
- No dark patterns (no hearts/lives)
- Reading-focused
- Quality over quantity

**Duolingo:**
- Artificial sentences ("The duck drinks milk")
- Gamification-heavy
- Conversation-focused
- Lives system (limit practice)
- Broader language coverage
- More languages available

**Both can work together!** Use Duolingo for conversation practice, Voquab for reading vocabulary.

---

### What level of Spanish do I need?

**Recommended:** A2-B1 (intermediate beginner)

**You should know:**
- Basic grammar (present, past tense)
- ~300-500 common words
- How to read simple sentences

**Too easy if:**
- You can read "El Principito" comfortably without help

**Too hard if:**
- You're a complete beginner (can't read simple Spanish)

**Don't worry if you're not sure:** The app adapts to you! Start slow, build up.

---

### Can I use Voquab on mobile?

**Yes!** Voquab is mobile-first web app.

**Works on:**
- iPhone/iPad (Safari)
- Android phones/tablets (Chrome)
- Desktop (any modern browser)

**Native app:**
- Not yet, but web app works great on mobile
- Add to home screen for app-like experience
- Native app: Maybe Year 2+

---

## LEARNING METHODOLOGY

### How does the spaced repetition algorithm work?

Voquab uses **FSRS (Free Spaced Repetition Scheduler)**, a research-backed algorithm that optimizes when you review each word:

**How it works:**
- **Again**: Resets the word to review soon (also requeues to end of current session)
- **Hard**: Schedule for review in ~1-2 days
- **Got It**: Schedule for review in ~5+ days (interval increases each time)

**The science:**
- FSRS models memory decay mathematically
- Predicts the optimal time to review (right before you'd forget)
- Adapts to your personal learning patterns
- Research shows 20-30% fewer reviews for same retention

**Two key numbers tracked:**
- **Stability**: How long until you might forget (measured in days)
- **Difficulty**: How hard this word is for you personally (1-10 scale)

---

### Why am I seeing the same word multiple times in one session?

If you press **"Again"** (don't know), the word moves to the end of your current session for another attempt. This ensures you get immediate practice without counting it as "progress."

**What happens:**
- Card goes to back of queue
- Progress counter stays the same (e.g., stays at "2/15")
- You'll see it again before the session ends
- Gets another chance to stick in memory

---

### What are "exposure" cards?

To prevent forgetting, Voquab occasionally shows you words you've mastered (even if not due for review). This keeps them fresh in your memory.

**How it works:**
- Only for well-learned words (30+ day stability)
- Appears with amber **"Exposure"** badge
- Still uses the three buttons (affects scheduling)
- More active users get more exposure cards

**Why it matters:**
- Pure scheduling can leave gaps of months
- Exposure catches potential forgetting early
- No surprises when a "mastered" word suddenly feels unfamiliar

---

### When do phrases appear in my learning?

**Phrases** (multi-word expressions like "personas mayores" = "grown-ups") appear after you've learned 20% of a chapter's individual words.

**Why wait?**
- You need vocabulary foundation first
- Individual words help you understand phrase components
- Prevents overwhelm for new learners

**Session composition (when phrases available):**
- 80% individual words (12 cards in 15-card session)
- 20% phrases (3 cards in 15-card session)

**Visual indicator:**
- Purple **"Phrase"** badge on phrase cards
- **"New Phrase"** badge if it's your first time seeing it

---

### How many cards should I study per day?

You can set this in Settings. Recommendations:

| Level | Cards/Day | Time |
|-------|-----------|------|
| Light | 15-25 | 5-10 min |
| Regular | 25-50 | 10-20 min |
| Intensive | 50-100 | 20-40 min |

**The algorithm adapts:**
- More active = more exposure cards to keep words fresh
- Less active = focused on most important reviews
- Consistency beats volume (better to do 15 cards daily than 100 once a week)

---

### How do chapters unlock?

**Requirement:** Introduce 95% of previous chapter's words

**Example:**
- Chapter 1 has 52 words
- You've learned 50 words (96%)
- Chapter 2 unlocks!

**What "introduced" means:**
- You've seen the word at least once
- It has a progress record in the system
- Doesn't require mastery, just exposure

**Track progress:** See unlock percentage on Book page

---

### Can I study words from later chapters?

**Not yet.** Chapters are locked to prevent overwhelm and ensure progression.

**Future feature (post-MVP):** Unlock all chapters option for advanced users

---

### How many words should I study per day?

**It depends on you!**

**Recommended:**
- **Busy days:** 25-50 words (10-15 minutes)
- **Normal days:** 50-100 words (20-30 minutes)
- **Intensive:** 150+ words (45-60 minutes)

**MVP:** Simple session sizes (15, 20, 25 cards)

**Post-MVP:** Daily packages (50/100/150/250 word commitments)

**Our advice:** Consistency > volume. Better to do 25 words daily than 200 words once a week.

---

### What if I forget a word?

**Press "Again"** - it's okay!

**What happens:**
- Word moves to end of current session (you'll see it again)
- Progress counter stays the same (doesn't advance)
- Stability resets to short interval (~0.5-2 days)
- Difficulty increases slightly (+1.0)
- Word will appear more frequently until you know it

**Don't worry:** Forgetting is part of learning. The FSRS algorithm adapts to show struggling words more often.

---

### How long to complete the book?

**Depends on:**
- Your current level
- Study frequency
- Session size

**Estimates:**
- **Intensive (150 words/day, 5x/week):** 2-3 months
- **Standard (100 words/day, 4x/week):** 4-6 months
- **Relaxed (50 words/day, 3x/week):** 8-12 months

**No rush!** Focus on mastery, not speed.

---

## TECHNICAL QUESTIONS

### What technology does Voquab use?

**Frontend:**
- React 19 (UI framework)
- Vite (build tool)
- TailwindCSS (styling)

**Backend:**
- Supabase (PostgreSQL database + auth)
- Row Level Security (RLS) for data protection

**Hosting:**
- Netlify (frontend)
- Supabase (database, managed)

**APIs:**
- DeepL API (translations - 99%+ accuracy)
- spaCy (Spanish lemmatization)

**See:** `08_ARCHITECTURE.md` for details

---

### Is Voquab open source?

**Not yet, but maybe!**

**Current:** Proprietary (private code)

**Future (under consideration):**
- Open-source learning algorithm
- Open-source UI components
- Closed-source content pipeline

**Why not fully open source:**
- Content licensing complexities
- Want to validate business model first
- May open-source parts later

---

### How does the algorithm work?

**FSRS (Free Spaced Repetition Scheduler):**

Voquab uses FSRS, a research-backed algorithm that models human memory mathematically.

**Key concepts:**
- **Stability**: Days until 90% recall probability
- **Difficulty**: How hard the item is for you (1-10)
- **Due date**: Calculated from stability

**The formula:**
```
Retrievability = 0.9^(days_since_review / stability)
```

**Button effects:**
| Button | Stability Change | Difficulty Change |
|--------|------------------|-------------------|
| Again | Reset to ~0.5-2 days | +1.0 |
| Hard | ×0.6 | +0.5 |
| Got It | ×1.5-3.0 | -0.2 |

**Session composition:**
- Due cards (scheduled by FSRS)
- Exposure cards (oversampling stable words)
- New cards (unlearned vocabulary)

**See:** `04_LEARNING_ALGORITHM.md` for complete documentation

---

### Does Voquab work offline?

**Not yet (MVP).**

**Future (post-MVP):**
- Service worker for offline reading
- Cache flashcards for offline study
- Sync when back online

---

### What browsers are supported?

**Fully supported:**
- Chrome/Edge (latest)
- Safari (latest)
- Firefox (latest)
- Mobile browsers (iOS Safari, Android Chrome)

**Requirements:**
- Modern browser (ES2020+ JavaScript)
- JavaScript enabled
- Cookies enabled (for auth)

**Not supported:**
- Internet Explorer (never)
- Very old browsers (pre-2020)

---

### Can I export my data?

**Yes! (Post-launch)**

**You can export:**
- Your vocabulary progress (JSON/CSV)
- Your review history
- Your settings

**How:** Profile → Settings → Export Data

**Privacy:** Your data is yours. Delete anytime.

**See:** `18_SECURITY.md` for details

---

## CONTENT & TRANSLATION

### How accurate are the translations?

**Target: 99%+ accuracy**

**Our process:**
1. DeepL API translation (very high quality)
2. AI validation (Claude checks context)
3. Native speaker review (20% sample)
4. User feedback (flag errors)

**Quality checks:**
- Meaning accuracy (is it correct?)
- Context fit (does it make sense in sentence?)
- Natural phrasing (is it good Spanish?)

**If you find errors:** Please report! We fix quickly.

---

### Why lemmas instead of word forms?

**Lemma = canonical form of word**

**Example:**
- Lemma: **tener** (to have)
- Word forms: tenía, tengo, tiene, tuvo, etc.

**Why lemmas:**
- Master one concept, not 20 conjugations
- Prevents deck flooding with similar forms
- More efficient learning
- Still see all forms in context!

**You learn:**
- Lemma: tener (primary flashcard)
- But see: "tenía miedo" in sentences
- Understand: All forms link to same concept

**See:** `02_DATABASE_SCHEMA.md` for architecture

---

### Will you add more books?

**Yes! (Post-MVP)**

**Spanish (Year 1):**
- Book 2: "Cuentos de Eva Luna" (B1 level)
- Book 3: Spanish fables (A2 level)
- Book 4: "Crónica de una Muerte Anunciada" (B2 level)

**Other languages (Year 2+):**
- French: Le Petit Prince
- Italian: Il Piccolo Principe
- Portuguese: O Pequeno Príncipe

**See:** `26_CONTENT_ROADMAP.md` for plans

---

### Can I suggest a book?

**Yes! (Post-launch)**

**Requirements:**
- Must be public domain OR we can get rights
- Literary merit (classic or beloved)
- Appropriate length (10K-50K words)
- Good for language learning

**How to suggest:** Discord / email (post-launch)

**We'll evaluate:** Literary merit, learner appeal, difficulty fit, licensing

---

### What about audio pronunciation?

**Not in MVP.**

**Post-MVP (if budget allows):**
- Text-to-speech for words
- Native speaker recordings (curated)
- Sentence audio

**Cost:** ~$50-100/month for API

**Priority:** Medium (not essential for reading-focused app)

**See:** `27_FEATURE_PRIORITIZATION.md`

---

## PRIVACY & SECURITY

### What data do you collect?

**We collect:**
- Email (for authentication)
- Learning progress (words mastered, reviews)
- Usage analytics (anonymized page views)
- Error logs (to fix bugs)

**We DON'T collect:**
- Real names (optional only)
- Addresses
- Payment info (no payments yet)
- Cross-site tracking
- Precise location

**See:** `18_SECURITY.md` for details

---

### Is my data secure?

**Yes.**

**Security measures:**
- HTTPS everywhere (TLS 1.2+)
- Passwords hashed (bcrypt)
- Database encryption (AES-256)
- Row Level Security (users can't access others' data)
- Regular backups
- SOC 2 compliant hosting (Supabase)

**Your data is safe.**

---

### Do you sell user data?

**Never. Ever. Period.**

**We promise:**
- No selling data to third parties
- No advertising your progress without permission
- No dark patterns
- Full transparency

**Revenue model:** Freemium (premium features), NOT data sales

---

### Can I delete my account?

**Yes!**

**What happens:**
- Account deleted within 30 days
- All personal data removed
- Progress data anonymized (for analytics)
- Email removed from database

**How:** Profile → Settings → Delete Account

**GDPR compliant:** Right to be forgotten

---

### Do you use cookies?

**Minimal cookies (authentication only)**

**We use:**
- Session cookies (stay logged in)
- No tracking cookies
- No advertising cookies

**Analytics:** Cookie-free (Plausible)

**No consent banner needed!**

---

## PRICING & BUSINESS MODEL

### How will Voquab make money?

**MVP (Year 1):** Free (validation phase)

**Future (Year 2+):** Freemium
- **Free tier:** Core learning, "El Principito", basic features
- **Premium ($5-10/month):** Extra books, audio, advanced analytics

**Never:**
- Pay-to-win (buy mastery)
- Intrusive ads
- Data sales
- Lives/energy system

**Goal:** Sustainable, not extractive

---

### Will I have to pay eventually?

**Core learning: Always free**

**You'll always be able to:**
- Study "El Principito"
- Use flashcards
- Track progress
- Unlock chapters
- Access basic features

**Premium (optional):**
- Additional books
- Audio pronunciation
- Advanced analytics
- Priority support

**If you help validate product: Early supporter perks (lifetime premium?)**

---

### What if I can't afford premium?

**Options:**
1. Free tier is fully functional (not crippled)
2. Student discounts (future)
3. Scholarships (case-by-case)
4. Open-source alternatives (some components)

**Goal:** Learning should be accessible

---

## ROADMAP & FEATURES

### When will Voquab launch?

**Target: Q1 2026 (Jan-Mar)**

**Current status (Nov 2025):** Foundation phase
- Documentation complete ✅
- Database redesign in progress
- Content pipeline in progress
- MVP build: Starting soon

**See:** `28_CHANGELOG.md` for updates

---

### What features are coming?

**MVP (Q1 2026):**
- Reading mode
- Flashcards
- Progress tracking
- Chapter unlocking

**Post-MVP (Q2-Q4 2026):**
- Word lookup in reading
- Daily packages (50/100/150/250)
- Badges & achievements
- Word notes & mnemonics
- Book 2

**Year 2+:**
- Audio pronunciation
- Friends & leaderboards
- Additional languages
- Mobile app (maybe)

**See:** `27_FEATURE_PRIORITIZATION.md` for details

---

### Can I request a feature?

**Yes! (Post-launch)**

**How:**
- In-app feedback button
- Discord (post-launch)
- Email: feedback@voquab.app (future)

**We'll:**
- Review all requests
- Vote on popular ones
- Update roadmap quarterly

**Can't promise:** Every feature, but we listen!

---

### Will there be a mobile app?

**Not in MVP.**

**Web app works great on mobile:**
- Responsive design
- Mobile-first
- Add to home screen

**Native app (Year 2+ maybe):**
- If demand validates
- If resources allow
- React Native (share code with web)

**Current focus:** Perfect web experience first

---

## TROUBLESHOOTING

### I can't sign up / sign in

**Check:**
1. Email format correct?
2. Email already used? (try password reset)
3. Check spam folder (verification email)
4. Internet connection working?
5. Try different browser

**Still stuck:** Contact support (post-launch)

---

### Flashcards aren't loading

**Try:**
1. Refresh page (Ctrl/Cmd + R)
2. Clear browser cache
3. Check internet connection
4. Try different browser
5. Check browser console for errors (F12)

**If persistent:** Report bug (post-launch)

---

### My progress isn't saving

**Check:**
1. Are you signed in?
2. Internet connection stable?
3. Session completed? (don't close mid-session)
4. Try refreshing page

**Data persistence:** Auto-saves after each flashcard

---

### A translation looks wrong

**Please report it!**

**How:**
1. Take screenshot
2. Note the word and sentence
3. Submit via feedback form (post-launch)

**We'll:**
- Review within 48 hours
- Fix if confirmed error
- Credit you for finding it

---

### The app is slow

**Check:**
1. Internet speed (speedtest.net)
2. Too many browser tabs?
3. Old device? (we optimize for performance)
4. Try clearing cache

**Our targets:**
- Load time: <2 seconds
- Lighthouse score: 90+

**See:** `19_MONITORING.md`

---

### I found a bug!

**Thank you!**

**Report:**
1. What happened?
2. What did you expect?
3. Steps to reproduce
4. Browser & device
5. Screenshot (if possible)

**Where:** Feedback form / Discord / Email (post-launch)

**We'll:** Fix critical bugs within 24-48 hours

---

## ADDITIONAL QUESTIONS

### How can I help?

**Before launch:**
- Join beta testing (coming Q4 2025)
- Spread the word
- Give feedback on prototypes

**After launch:**
- Use the app, give honest feedback
- Report bugs
- Suggest features
- Share with friends
- Write a review

**Future:**
- Become a content contributor
- Help with translations
- Join the community

---

### How do I stay updated?

**Follow:**
- Twitter/X: @VoquabApp (post-launch)
- Discord: discord.gg/voquab (post-launch)
- Email newsletter: Sign up on website

**Changelog:** `28_CHANGELOG.md` (this repo)

---

### Who built Voquab?

**Peter** - Founder, developer, Spanish learner

**Built with:**
- Claude (AI assistant for development)
- Lots of coffee ☕
- Love for "The Little Prince" 📚

**Background:**
- Built previous version in PHP
- Rebuilding in modern stack (React + Supabase)
- Learning Spanish through "El Principito"
- Frustrated with existing apps → built own

---

### Can I contribute?

**Not yet (MVP is closed development)**

**Future:**
- Open-source some components
- Community content contributions
- Beta testing program
- Translation help

**Interested?** Join Discord (post-launch) or email

---

### Where can I learn more?

**Documentation:**
- `00_PROJECT_OVERVIEW.md` - Vision & philosophy
- `04_LEARNING_ALGORITHM.md` - How learning works
- `27_FEATURE_PRIORITIZATION.md` - Roadmap

**Website:** voquab.app (coming Q1 2026)

**Contact:** hello@voquab.app (post-launch)

---

## UPDATE THIS FAQ

**When to add:**
- Users ask same question 3+ times
- New feature launches
- Important changes

**Format:**
```markdown
### Question?

**Short answer.**

**Details:**
- Point 1
- Point 2

**See:** Link to detailed doc
```

---

**END OF FAQ**

*This is a living document. It will be updated as questions arise.*
