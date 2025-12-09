# 15_API_DOCUMENTATION.md

**Last Updated:** November 30, 2025  
**Status:** Draft  
**Owner:** Claude + Peter

---

## TABLE OF CONTENTS
1. [Overview](#overview)
2. [Database Connection](#database-connection)
3. [Common Query Patterns](#common-query-patterns)
4. [Row Level Security](#row-level-security)
5. [Stored Functions](#stored-functions)
6. [Error Handling](#error-handling)
7. [Performance Optimization](#performance-optimization)

---

## OVERVIEW

Voquab uses Supabase (PostgreSQL) as its backend. This document provides query patterns, best practices, and common operations for interacting with the database.

**Technology:** Supabase JavaScript Client v2  
**Database:** PostgreSQL 15+  
**Security:** Row Level Security (RLS) enforced

---

## DATABASE CONNECTION

### Setup

```javascript
// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

### Environment Variables

```bash
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## COMMON QUERY PATTERNS

### Authentication

#### Sign Up
```javascript
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) throw error;
  return data.user;
}
```

#### Sign In
```javascript
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data.user;
}
```

#### Sign Out
```javascript
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

#### Get Current User
```javascript
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}
```

---

### Flashcard Queries

#### Get User's Due Words
```javascript
async function getDueWords(userId, limit = 25) {
  const { data, error } = await supabase
    .rpc('get_due_words_for_user', {
      p_user_id: userId,
      p_limit: limit
    });
  
  if (error) throw error;
  return data;
}
```

**Stored Function:**
```sql
CREATE OR REPLACE FUNCTION get_due_words_for_user(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  lemma_id UUID,
  lemma_text TEXT,
  definitions JSONB,
  part_of_speech VARCHAR(20),
  mastery_level INTEGER,
  health INTEGER,
  times_in_book BIGINT,
  priority_score DECIMAL,
  encountered_form TEXT,
  example_sentence TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.lemma_id,
    l.lemma_text,
    l.definitions,
    l.part_of_speech,
    ulp.mastery_level,
    ulp.health,
    COUNT(DISTINCT w.word_id) as times_in_book,
    calculate_priority_score(ulp, COUNT(w.word_id)) as priority_score,
    (SELECT w2.word_text FROM user_word_encounters uwe
     JOIN words w2 ON uwe.word_id = w2.word_id
     WHERE uwe.user_id = p_user_id AND w2.lemma_id = l.lemma_id
     ORDER BY uwe.last_encountered_at DESC LIMIT 1
    ) as encountered_form,
    (SELECT s.sentence_text FROM sentences s
     JOIN words w3 ON s.sentence_id = w3.sentence_id
     WHERE w3.lemma_id = l.lemma_id
     ORDER BY RANDOM() LIMIT 1
    ) as example_sentence
  FROM user_lemma_progress ulp
  JOIN lemmas l ON ulp.lemma_id = l.lemma_id
  LEFT JOIN words w ON l.lemma_id = w.lemma_id
  WHERE ulp.user_id = p_user_id
    AND (ulp.health < 60 OR ulp.total_reviews = 0)
  GROUP BY l.lemma_id, ulp.user_id
  ORDER BY priority_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

#### Update Progress After Review
```javascript
async function updateWordProgress(userId, lemmaId, difficulty) {
  const masteryChanges = {
    'dont-know': -5,
    'hard': 3,
    'medium': 6,
    'easy': 10
  };
  
  const healthBoosts = {
    'dont-know': 10,
    'hard': 30,
    'medium': 60,
    'easy': 100
  };
  
  const { error } = await supabase.rpc('update_word_progress', {
    p_user_id: userId,
    p_lemma_id: lemmaId,
    p_difficulty: difficulty,
    p_mastery_change: masteryChanges[difficulty],
    p_health_boost: healthBoosts[difficulty]
  });
  
  if (error) throw error;
}
```

**Stored Function:**
```sql
CREATE OR REPLACE FUNCTION update_word_progress(
  p_user_id UUID,
  p_lemma_id UUID,
  p_difficulty VARCHAR(20),
  p_mastery_change INTEGER,
  p_health_boost INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_time_gate_met BOOLEAN;
  v_actual_mastery_change INTEGER;
BEGIN
  -- Check time gate (only for gains)
  IF p_mastery_change > 0 THEN
    SELECT check_time_gate(p_user_id, p_lemma_id) INTO v_time_gate_met;
    v_actual_mastery_change := CASE WHEN v_time_gate_met 
                                     THEN p_mastery_change 
                                     ELSE 0 END;
  ELSE
    v_actual_mastery_change := p_mastery_change;
  END IF;
  
  -- Update progress
  UPDATE user_lemma_progress
  SET 
    mastery_level = GREATEST(0, LEAST(100, mastery_level + v_actual_mastery_change)),
    health = GREATEST(0, LEAST(100, health + p_health_boost)),
    total_reviews = total_reviews + 1,
    correct_reviews = CASE WHEN p_difficulty != 'dont-know' 
                           THEN correct_reviews + 1 
                           ELSE correct_reviews END,
    last_reviewed_at = NOW(),
    last_correct_review_at = CASE WHEN p_difficulty != 'dont-know'
                                  THEN NOW()
                                  ELSE last_correct_review_at END,
    failed_in_last_3_sessions = (p_difficulty = 'dont-know'),
    review_history = (
      SELECT jsonb_agg(row) FROM (
        SELECT * FROM jsonb_array_elements(review_history)
        UNION ALL
        SELECT jsonb_build_object(
          'timestamp', NOW(),
          'difficulty', p_difficulty,
          'mastery_before', mastery_level,
          'health_before', health,
          'time_gate_met', v_time_gate_met
        )
        ORDER BY (value->>'timestamp')::TIMESTAMPTZ DESC
        LIMIT 20
      ) sub(row)
    )
  WHERE user_id = p_user_id AND lemma_id = p_lemma_id;
END;
$$ LANGUAGE plpgsql;
```

---

### Reading Experience Queries

#### Get Chapter with Words
```javascript
async function getChapterContent(chapterId) {
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      chapter_id,
      chapter_number,
      title,
      sentences (
        sentence_id,
        sentence_order,
        sentence_text,
        sentence_translation,
        words (
          word_id,
          word_text,
          word_position,
          lemma:lemmas (
            lemma_id,
            lemma_text,
            definitions,
            part_of_speech,
            gender
          )
        )
      )
    `)
    .eq('chapter_id', chapterId)
    .order('sentence_order', { foreignTable: 'sentences' })
    .order('word_position', { foreignTable: 'sentences.words' })
    .single();
  
  if (error) throw error;
  return data;
}
```

---

#### Track Word Encounter
```javascript
async function trackWordEncounter(userId, wordId, sentenceId) {
  const { error } = await supabase.rpc('track_word_encounter', {
    p_user_id: userId,
    p_word_id: wordId,
    p_sentence_id: sentenceId
  });
  
  if (error) throw error;
}
```

**Stored Function:**
```sql
CREATE OR REPLACE FUNCTION track_word_encounter(
  p_user_id UUID,
  p_word_id UUID,
  p_sentence_id UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_word_encounters (
    encounter_id,
    user_id,
    word_id,
    first_encountered_at,
    times_encountered,
    last_encountered_sentence_id
  ) VALUES (
    uuid_generate_v4(),
    p_user_id,
    p_word_id,
    NOW(),
    1,
    p_sentence_id
  )
  ON CONFLICT (user_id, word_id) DO UPDATE
  SET 
    times_encountered = user_word_encounters.times_encountered + 1,
    last_encountered_sentence_id = p_sentence_id;
END;
$$ LANGUAGE plpgsql;
```

---

#### Get User's Encounters for Chapter
```javascript
async function getUserEncountersForChapter(userId, chapterId) {
  const { data, error } = await supabase
    .from('user_word_encounters')
    .select(`
      word_id,
      times_encountered,
      words!inner (
        lemma_id,
        chapter_id
      )
    `)
    .eq('user_id', userId)
    .eq('words.chapter_id', chapterId);
  
  if (error) throw error;
  return data;
}
```

---

### Chapter Progress Queries

#### Get Chapter Unlock Status
```javascript
async function getChapterUnlockStatus(userId, chapterId) {
  const { data, error } = await supabase
    .rpc('calculate_chapter_unlock', {
      p_user_id: userId,
      p_chapter_id: chapterId
    });
  
  if (error) throw error;
  return data;
}
```

**Stored Function:**
```sql
CREATE OR REPLACE FUNCTION calculate_chapter_unlock(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS TABLE (
  can_unlock BOOLEAN,
  encounter_rate DECIMAL,
  lemmas_encountered INTEGER,
  total_lemmas INTEGER,
  avg_mastery DECIMAL,
  total_reviews INTEGER,
  path_a_met BOOLEAN,
  path_b_met BOOLEAN,
  path_c_met BOOLEAN
) AS $$
DECLARE
  v_total_lemmas INTEGER;
  v_lemmas_encountered INTEGER;
  v_avg_mastery DECIMAL;
  v_total_reviews INTEGER;
BEGIN
  -- Count total unique lemmas in chapter
  SELECT COUNT(DISTINCT lemma_id) INTO v_total_lemmas
  FROM words
  WHERE chapter_id = p_chapter_id;
  
  -- Count encountered lemmas
  SELECT COUNT(DISTINCT w.lemma_id) INTO v_lemmas_encountered
  FROM user_word_encounters uwe
  JOIN words w ON uwe.word_id = w.word_id
  WHERE uwe.user_id = p_user_id
    AND w.chapter_id = p_chapter_id;
  
  -- Calculate average mastery
  SELECT COALESCE(AVG(ulp.mastery_level), 0) INTO v_avg_mastery
  FROM user_lemma_progress ulp
  JOIN words w ON ulp.lemma_id = w.lemma_id
  WHERE ulp.user_id = p_user_id
    AND w.chapter_id = p_chapter_id;
  
  -- Sum total reviews
  SELECT COALESCE(SUM(ulp.total_reviews), 0) INTO v_total_reviews
  FROM user_lemma_progress ulp
  JOIN words w ON ulp.lemma_id = w.lemma_id
  WHERE ulp.user_id = p_user_id
    AND w.chapter_id = p_chapter_id;
  
  -- Return results
  RETURN QUERY SELECT
    (v_lemmas_encountered::DECIMAL / NULLIF(v_total_lemmas, 0) >= 1.0) AND (
      v_avg_mastery >= 40 OR
      v_total_reviews >= 50 OR
      (v_avg_mastery >= 30 AND v_total_reviews >= 30)
    ) as can_unlock,
    v_lemmas_encountered::DECIMAL / NULLIF(v_total_lemmas, 0) as encounter_rate,
    v_lemmas_encountered as lemmas_encountered,
    v_total_lemmas as total_lemmas,
    v_avg_mastery as avg_mastery,
    v_total_reviews as total_reviews,
    v_avg_mastery >= 40 as path_a_met,
    v_total_reviews >= 50 as path_b_met,
    (v_avg_mastery >= 30 AND v_total_reviews >= 30) as path_c_met;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### Admin Queries

#### Search Lemmas
```javascript
async function searchLemmas(searchTerm, filters = {}) {
  let query = supabase
    .from('lemmas')
    .select(`
      lemma_id,
      lemma_text,
      definitions,
      part_of_speech,
      gender,
      is_stop_word,
      admin_notes,
      words (
        word_id
      )
    `)
    .order('lemma_text', { ascending: true });
  
  if (searchTerm) {
    query = query.or(`lemma_text.ilike.%${searchTerm}%,definitions::text.ilike.%${searchTerm}%`);
  }
  
  if (filters.partOfSpeech) {
    query = query.eq('part_of_speech', filters.partOfSpeech);
  }
  
  if (filters.gender) {
    query = query.eq('gender', filters.gender);
  }
  
  if (filters.isStopWord !== undefined) {
    query = query.eq('is_stop_word', filters.isStopWord);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Calculate times_in_book for each lemma
  return data.map(lemma => ({
    ...lemma,
    times_in_book: lemma.words?.length || 0,
    words: undefined  // Remove words array from response
  }));
}
```

---

#### Update Lemma
```javascript
async function updateLemma(lemmaId, updates) {
  const { error } = await supabase
    .from('lemmas')
    .update({
      lemma_text: updates.lemmaText,
      definitions: updates.definitions,
      part_of_speech: updates.partOfSpeech,
      gender: updates.gender,
      is_stop_word: updates.isStopWord,
      admin_notes: updates.adminNotes,
      updated_at: new Date().toISOString()
    })
    .eq('lemma_id', lemmaId);
  
  if (error) throw error;
}
```

---

## ROW LEVEL SECURITY

### Policies

#### User Lemma Progress
```sql
-- Users can only see their own progress
CREATE POLICY "Users can read own progress"
  ON user_lemma_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
  ON user_lemma_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON user_lemma_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

#### Lemmas (Public Read)
```sql
-- All authenticated users can read lemmas
CREATE POLICY "Authenticated users can read lemmas"
  ON lemmas
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can modify lemmas"
  ON lemmas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

#### Admin Role Check
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

---

## STORED FUNCTIONS

### Calculate Current Health
```sql
CREATE OR REPLACE FUNCTION calculate_current_health(
  stored_health INTEGER,
  last_reviewed_at TIMESTAMPTZ,
  mastery_level INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  decay_rates INTEGER[] := ARRAY[25, 20, 12, 8, 5, 3, 2, 2, 1, 1, 1];
  mastery_bracket INTEGER;
  decay_rate INTEGER;
  days_since_review DECIMAL;
  current_health INTEGER;
BEGIN
  -- Calculate mastery bracket (0-10)
  mastery_bracket := LEAST(10, mastery_level / 10);
  
  -- Get decay rate for this bracket
  decay_rate := decay_rates[mastery_bracket + 1];
  
  -- Calculate days since review
  days_since_review := EXTRACT(EPOCH FROM (NOW() - last_reviewed_at)) / 86400;
  
  -- Calculate current health
  current_health := stored_health - (days_since_review * decay_rate);
  
  -- Ensure bounds
  RETURN GREATEST(0, LEAST(100, current_health::INTEGER));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

---

### Check Time Gate
```sql
CREATE OR REPLACE FUNCTION check_time_gate(
  p_user_id UUID,
  p_lemma_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_last_correct TIMESTAMPTZ;
  v_mastery INTEGER;
  v_time_gates INTEGER[] := ARRAY[0, 4, 12, 24, 72, 168, 336, 720, 1440, 2880, 4320];
  v_time_gate_hours INTEGER;
  v_hours_since_correct DECIMAL;
BEGIN
  SELECT last_correct_review_at, mastery_level
  INTO v_last_correct, v_mastery
  FROM user_lemma_progress
  WHERE user_id = p_user_id AND lemma_id = p_lemma_id;
  
  -- First correct review always allowed
  IF v_last_correct IS NULL THEN
    RETURN true;
  END IF;
  
  -- Get time gate for current mastery level
  v_time_gate_hours := v_time_gates[LEAST(10, v_mastery / 10) + 1];
  
  -- Calculate hours since last correct
  v_hours_since_correct := EXTRACT(EPOCH FROM (NOW() - v_last_correct)) / 3600;
  
  RETURN v_hours_since_correct >= v_time_gate_hours;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## ERROR HANDLING

### Standard Pattern
```javascript
async function safeQuery(queryFunction, errorMessage) {
  try {
    const result = await queryFunction();
    
    if (result.error) {
      console.error(errorMessage, result.error);
      throw new Error(errorMessage);
    }
    
    return result.data;
  } catch (error) {
    console.error(errorMessage, error);
    throw error;
  }
}

// Usage
const words = await safeQuery(
  () => getDueWords(userId),
  'Failed to fetch due words'
);
```

---

### Error Types

**Auth Errors:**
```javascript
if (error.message.includes('Invalid login credentials')) {
  // Show wrong password message
}

if (error.message.includes('Email not confirmed')) {
  // Prompt to check email
}
```

**RLS Errors:**
```javascript
if (error.code === '42501') {
  // Insufficient permissions
  // User might not be authenticated
}
```

---

## PERFORMANCE OPTIMIZATION

### Indexes

**Critical Indexes:**
```sql
-- User progress queries
CREATE INDEX idx_user_lemma_progress_user_health 
  ON user_lemma_progress(user_id, health);

CREATE INDEX idx_user_lemma_progress_user_due 
  ON user_lemma_progress(user_id, review_due);

-- Word lookups
CREATE INDEX idx_words_lemma 
  ON words(lemma_id);

CREATE INDEX idx_words_chapter 
  ON words(chapter_id);

-- Encounters
CREATE INDEX idx_encounters_user_word 
  ON user_word_encounters(user_id, word_id);
```

---

### Query Optimization

**Use Select Specific Columns:**
```javascript
// ❌ Bad - fetches all columns
const { data } = await supabase.from('lemmas').select('*');

// ✅ Good - only needed columns
const { data } = await supabase
  .from('lemmas')
  .select('lemma_id, lemma_text, definitions');
```

**Use RPC for Complex Logic:**
```javascript
// ❌ Bad - multiple round trips
const words = await getWords();
const progress = await getProgress();
const combined = combineData(words, progress);

// ✅ Good - single RPC call
const combined = await supabase.rpc('get_due_words_for_user');
```

**Limit Results:**
```javascript
// Always use limits for lists
const { data } = await supabase
  .from('lemmas')
  .select('*')
  .limit(25);
```

---

## RELATED DOCUMENTS

- See **02_DATABASE_SCHEMA.md** for table structure
- See **04_LEARNING_ALGORITHM.md** for business logic
- See **16_CODE_STYLE_GUIDE.md** for coding standards

---

## REVISION HISTORY

- 2025-11-30: Initial draft (Claude)
- Status: Awaiting Peter's approval

---

**END OF API DOCUMENTATION**
