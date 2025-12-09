# 26_CONTENT_ROADMAP.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Current Content](#current-content)
3. [Content Expansion Strategy](#content-expansion-strategy)
4. [Book Selection Criteria](#book-selection-criteria)
5. [Language Expansion](#language-expansion)
6. [Content Pipeline](#content-pipeline)
7. [Quality Standards](#quality-standards)
8. [Timeline](#timeline)

---

## OVERVIEW

Content is the heart of Voquab. This document outlines our strategy for expanding beyond "El Principito" while maintaining quality and pedagogical value.

**Principles:**
- **Quality over quantity:** 10 great books > 100 mediocre ones
- **Literary value:** Classic, beloved books only
- **Proper licensing:** Respect copyright, use public domain
- **Pedagogical fit:** Right difficulty progression
- **Cultural significance:** Books that matter

---

## CURRENT CONTENT

### El Principito (The Little Prince)

**Status:** ✅ Complete (MVP foundation)

**Stats:**
- 10 chapters
- 463 sentences
- 1,500+ unique vocabulary words
- 1,172 unique lemmas
- Translation accuracy: 99%+

**Why it works:**
- Beloved worldwide (140 million copies sold)
- Simple yet profound language
- Perfect length for learners
- Public domain (published 1943)
- Emotionally resonant

**Learner level:** A2-B1 (intermediate beginner)

---

## CONTENT EXPANSION STRATEGY

### Phase 1: Perfect Single Book (Months 1-6)
**Focus:** El Principito only

**Why:**
- Validate learning algorithm
- Perfect content pipeline
- Build engaged user base
- Prove concept before scaling

**Success metrics:**
- 1,000 active users
- 80%+ content quality rating
- Users completing book

---

### Phase 2: Spanish Expansion (Months 7-12)
**Add:** 2-3 more Spanish books

**Difficulty progression:**

**Beginner (A1-A2):**
- "La Tortuga" by Pablo Neruda (poetry, simple language)
- Children's fables collection

**Intermediate (B1-B2):**
- "El Principito" ✅ (already have)
- "Cien Años de Soledad" (abridged) by Gabriel García Márquez
- "Cuentos de Eva Luna" by Isabel Allende

**Advanced (C1-C2):**
- "Don Quijote" (selected chapters) by Cervantes
- "Crónica de una Muerte Anunciada" by García Márquez

---

### Phase 3: Language Expansion (Year 2)
**Add:** French, Italian, or Portuguese

**Criteria:**
- Demand validated (user surveys)
- Resources available (translation APIs)
- Similar to Spanish (Romance languages first)

**French candidates:**
- "Le Petit Prince" (obviously!)
- "L'Étranger" by Albert Camus
- "Le Petit Nicolas" by René Goscinny

**Italian candidates:**
- "Il Piccolo Principe"
- "Pinocchio" by Carlo Collodi
- "Se Questo è un Uomo" by Primo Levi

---

### Phase 4: User-Generated Content (Year 3)
**Enable:** Teachers/creators to add content

**Model:**
- Curated marketplace
- Quality review process
- Revenue share (future)

**Requirements:**
- Admin approval required
- Must meet quality standards
- Proper licensing verified

---

## BOOK SELECTION CRITERIA

### Must-Have Criteria

**1. Public Domain or Licensed**
- Published before 1928 (US public domain)
- Or: Explicit permission from rights holder
- Or: Creative Commons licensed

**2. Literary Merit**
- Recognized classic or beloved work
- Cultural significance
- Timeless themes

**3. Pedagogical Value**
- Appropriate difficulty level
- Rich vocabulary
- Engaging narrative
- Reasonable length (10,000-50,000 words)

**4. Emotional Resonance**
- Stories people love
- Characters worth caring about
- Makes learning enjoyable

---

### Evaluation Rubric

**Score each book 1-5 on:**

| Criteria | Weight | Notes |
|----------|--------|-------|
| Literary merit | 25% | Classic status, cultural impact |
| Learner appeal | 25% | Will people want to read it? |
| Difficulty fit | 20% | Right level for target audience |
| Length | 15% | Not too short, not too long |
| Licensing | 10% | Clear public domain or license |
| Vocabulary richness | 5% | Diverse, useful words |

**Minimum score to add:** 4.0/5.0

---

### Example Evaluation

**"Cien Años de Soledad" (abridged):**
- Literary merit: 5/5 (Nobel Prize winner)
- Learner appeal: 4/5 (famous, but challenging)
- Difficulty fit: 4/5 (B2 level, good progression)
- Length: 3/5 (full book too long, need abridged)
- Licensing: 5/5 (can negotiate)
- Vocabulary: 5/5 (extremely rich)

**Total: 4.3/5 - ADD to roadmap**

---

## LANGUAGE EXPANSION

### Target Languages (Priority Order)

**Tier 1: Romance Languages**
1. **French** (highest demand, similar to Spanish)
2. **Italian** (romantic, music/art appeal)
3. **Portuguese** (Brazilian market)

**Tier 2: Germanic Languages**
4. **German** (business value, precision)
5. **Dutch** (smaller but dedicated learners)

**Tier 3: Other**
6. **Japanese** (high demand, very different)
7. **Mandarin** (business value)

---

### Language Launch Checklist

**Before adding new language:**

- [ ] 1,000+ users in current language
- [ ] Translation API supports language
- [ ] Lemmatization tool available (spaCy)
- [ ] Content sourced (3+ books ready)
- [ ] Native speaker for QA
- [ ] Demand validated (user surveys)

**Resources needed per language:**
- Translation API: $50-100/month
- Native QA reviewer: $500 contract
- Lemmatization setup: 10 hours
- Content processing: 20 hours per book

---

## CONTENT PIPELINE

### Step-by-Step Process

**For each new book:**

#### 1. Source & Rights (Week 1)
- [ ] Verify public domain status
- [ ] OR obtain rights/license
- [ ] Get clean digital text (UTF-8)
- [ ] Verify text accuracy (compare editions)

#### 2. Processing (Week 2)
- [ ] Chapter segmentation
- [ ] Sentence splitting
- [ ] spaCy lemmatization
- [ ] Generate word list

**See 03_CONTENT_PIPELINE.md for details**

#### 3. Translation (Week 3)
- [ ] DeepL API translation (all sentences)
- [ ] Word definitions (DeepL API)
- [ ] AI validation (Claude for context)
- [ ] Flag uncertain translations

#### 4. Quality Review (Week 4)
- [ ] Native speaker review (20% sample)
- [ ] Fix flagged translations
- [ ] Verify context accuracy
- [ ] Spot-check random sentences

#### 5. Database Import (Week 5)
- [ ] Run import script
- [ ] Verify counts (sentences, words, lemmas)
- [ ] Check relationships (words → lemmas)
- [ ] Test on staging

#### 6. Testing (Week 6)
- [ ] Read-through (full book)
- [ ] Flashcard testing (random sample)
- [ ] Verify difficulty progression
- [ ] Check for errors

#### 7. Launch
- [ ] Deploy to production
- [ ] Announce to users
- [ ] Monitor feedback
- [ ] Fix issues quickly

---

### Automation (Future)

**Automate steps 2-5:**
- Script: Text → Database (end-to-end)
- Human review: Only step 4 & 6
- Time savings: 6 weeks → 2 weeks

---

## QUALITY STANDARDS

### Translation Accuracy

**Target:** 99%+ accuracy

**How we measure:**
- Random sample: 100 sentences per book
- Native speaker review
- Context verification

**Acceptable errors:**
- <1% factual errors (wrong meaning)
- <5% style differences (valid alternatives)

**Unacceptable:**
- Wrong meaning
- Unnatural phrasing (not valid Spanish)
- Missing context

---

### Difficulty Progression

**Within a book:**
- Chapters should increase in difficulty
- Or maintain consistent level (beginners)
- No sudden spikes

**Across books:**
- Clear progression path
- A1 → A2 → B1 → B2 → C1

**Measurement:**
- Average word frequency
- Sentence complexity
- Unique words per chapter

---

### User Satisfaction

**Target metrics:**
- 4.5/5 average rating
- <5% content quality complaints
- 80%+ would recommend

**Feedback collection:**
- Post-chapter survey (optional)
- Book completion survey
- Translation flagging system

---

## TIMELINE

### Year 1 (2025-2026)

**Q1 (Jan-Mar 2026):**
- Focus: Perfect El Principito
- Launch MVP
- 200-500 users

**Q2 (Apr-Jun 2026):**
- Focus: Algorithm refinement
- 500-1,000 users
- Start evaluating next books

**Q3 (Jul-Sep 2026):**
- **Book 2 launch:** "Cuentos de Eva Luna" (B1 level)
- Process book end-to-end
- Validate content pipeline

**Q4 (Oct-Dec 2026):**
- **Book 3 launch:** Children's fables (A2 level)
- 1,000-2,000 users
- Prepare for language expansion

---

### Year 2 (2027)

**Q1:**
- **French launch:** Le Petit Prince
- Validate multi-language system
- 2,000-3,000 users (Spanish)
- 200-500 users (French)

**Q2:**
- Spanish book 4: Advanced level
- French book 2
- 5,000 total users

**Q3:**
- Italian or Portuguese launch
- 10,000 total users

**Q4:**
- Plan user-generated content
- 15,000 total users

---

### Year 3 (2028)

**Q1-Q2:**
- User-generated content beta
- Teacher tools
- 20,000 users

**Q3-Q4:**
- Scale to 50,000 users
- 5+ languages
- 20+ books total

---

## CONTENT METRICS

### Track for Each Book

**Engagement:**
- % users who start book
- % users who finish book
- Average chapters completed
- Time to complete

**Learning effectiveness:**
- Words mastered per chapter
- Retention rates
- User ratings

**Quality:**
- Translation accuracy score
- User-reported errors
- Content rating

---

### Success Criteria

**For a book to stay:**
- >50% start rate
- >20% completion rate
- >4.0/5 average rating
- <10 reported errors per 1000 sentences

**If below criteria:**
- Review and improve
- OR deprecate and remove

---

## CONTENT WISHLIST

### High Priority (Next 3 Books)

1. **"Cuentos de Eva Luna" by Isabel Allende**
   - B1 level
   - Short stories (flexible length)
   - Magical realism
   - Modern Spanish

2. **Spanish Fables Collection**
   - A2 level
   - Short, bite-sized
   - Moral lessons
   - Cultural touchstones

3. **"Crónica de una Muerte Anunciada" by García Márquez**
   - B2 level
   - Gripping mystery
   - Beautiful prose
   - Colombian Spanish

---

### Medium Priority (Year 2)

4. **"Don Quijote" (selected chapters)**
   - C1 level
   - Literary landmark
   - Challenge for advanced learners
   - Cultural prestige

5. **"La Casa de los Espíritus" by Isabel Allende**
   - B2-C1 level
   - Family saga
   - Rich vocabulary

---

### French Expansion

6. **"Le Petit Prince"** (obvious choice)
7. **"L'Étranger" by Albert Camus**
8. **"Le Petit Nicolas"** (easier level)

---

## USER INPUT

### Voting System (Future)

**Let users vote:**
- Which books to add next
- Which languages to prioritize
- Feature requests

**How:**
- In-app voting
- Discord polls
- Annual survey

**Weight:**
- User votes: 40%
- Pedagogical value: 30%
- Resource availability: 20%
- Strategic fit: 10%

---

## RELATED DOCUMENTS

- See **03_CONTENT_PIPELINE.md** for technical details
- See **00_PROJECT_OVERVIEW.md** for vision
- See **25_MARKETING_PLAN.md** for launch strategy

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF CONTENT ROADMAP**
