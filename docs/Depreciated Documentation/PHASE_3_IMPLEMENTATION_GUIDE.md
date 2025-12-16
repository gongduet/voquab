# PHASE 3 IMPLEMENTATION GUIDE
## Daily Package System for Voquab

**Date:** November 9, 2025  
**Phase:** 3 of 4  
**Status:** Ready for Implementation  
**Dependencies:** Phase 1 (Health System) âœ…, Phase 2 (Time Gates) â³ In Progress

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Database Changes](#database-changes)
3. [New Utility Functions](#new-utility-functions)
4. [Package Selection UI](#package-selection-ui)
5. [Package Management Logic](#package-management-logic)
6. [Badge System](#badge-system)
7. [Integration Points](#integration-points)
8. [Testing Checklist](#testing-checklist)
9. [Success Criteria](#success-criteria)

---

## OVERVIEW

### What Phase 3 Delivers

The Daily Package System transforms Voquab from session-based reviewing to structured daily commitments. Users choose their learning intensity (50/100/150/250 words) and the system creates a balanced learning journey with progress tracking, expiration timers, and badge rewards.

### Key Features

1. **Package Selection Screen**
   - Four package types: Foundation, Standard, Immersion, Mastery
   - Clear time estimates and badge previews
   - Personalized recommendations based on available words

2. **Smart Package Composition**
   - Balanced mix of critical/mastery-ready/exposure/new words
   - Uses existing Priority Scoring Algorithm
   - Category distribution aligned with Algorithm Bible

3. **24-Hour Expiration Timer**
   - Packages expire 24 hours after creation
   - Auto-cleanup of expired packages
   - Prevents stale word selections

4. **Badge System**
   - Completion badges (Foundation â†' Mastery)
   - Streak badges (7/30/100 days)
   - Achievement badges (accuracy, speed, timing)
   - Badge showcase display

5. **Progress Tracking**
   - Words completed vs. total
   - Performance breakdown (Don't Know/Hard/Medium/Easy)
   - Time invested tracking
   - Streak maintenance

### What Phase 3 Does NOT Include

- **Waypoint System** (Phase 4) - Breaking packages into themed chunks
- **XP and Leveling** (Future) - Points-based progression
- **Leaderboards** (Future) - Social comparison features
- **Advanced Streak Protection** (Future) - Streak freezes, etc.

---

## DATABASE CHANGES

### Step 1: Create user_packages Table

```sql
-- Migration: add-package-system.sql

-- Drop existing table if re-running migration (development only)
-- DROP TABLE IF EXISTS user_packages CASCADE;

-- Create user_packages table
CREATE TABLE user_packages (
  package_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- PACKAGE DETAILS
  package_type VARCHAR(20) NOT NULL CHECK (package_type IN ('foundation', 'standard', 'immersion', 'mastery')),
  total_words INTEGER NOT NULL CHECK (total_words > 0),
  words_completed INTEGER DEFAULT 0 CHECK (words_completed >= 0 AND words_completed <= total_words),
  
  -- STATUS
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  
  -- PERFORMANCE TRACKING
  dont_know_count INTEGER DEFAULT 0 CHECK (dont_know_count >= 0),
  hard_count INTEGER DEFAULT 0 CHECK (hard_count >= 0),
  medium_count INTEGER DEFAULT 0 CHECK (medium_count >= 0),
  easy_count INTEGER DEFAULT 0 CHECK (easy_count >= 0),
  
  -- TIME TRACKING
  estimated_minutes INTEGER, -- Estimated completion time
  actual_minutes INTEGER, -- Actual time spent (calculated on completion)
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- CONSTRAINTS
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_user_packages_user_status ON user_packages(user_id, status);
CREATE INDEX idx_user_packages_user_date ON user_packages(user_id, created_at DESC);
CREATE INDEX idx_user_packages_expires ON user_packages(expires_at) WHERE status = 'active';

-- Add RLS policies
ALTER TABLE user_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own packages"
  ON user_packages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own packages"
  ON user_packages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own packages"
  ON user_packages FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_packages_updated_at
  BEFORE UPDATE ON user_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Create package_words Junction Table

```sql
-- Junction table linking packages to specific words
CREATE TABLE package_words (
  package_id UUID NOT NULL REFERENCES user_packages(package_id) ON DELETE CASCADE,
  vocab_id UUID NOT NULL REFERENCES vocabulary(vocab_id) ON DELETE CASCADE,
  
  -- ORDER AND CATEGORIZATION
  word_order INTEGER NOT NULL, -- Order within package (1-250)
  category VARCHAR(20) NOT NULL CHECK (category IN ('critical', 'mastery_ready', 'exposure', 'new')),
  
  -- REVIEW TRACKING
  reviewed BOOLEAN DEFAULT FALSE,
  review_response VARCHAR(20) CHECK (review_response IN ('dont_know', 'hard', 'medium', 'easy')),
  reviewed_at TIMESTAMPTZ,
  
  -- METADATA
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (package_id, vocab_id)
);

-- Indexes
CREATE INDEX idx_package_words_package ON package_words(package_id, word_order);
CREATE INDEX idx_package_words_reviewed ON package_words(package_id, reviewed);

-- RLS policies
ALTER TABLE package_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own package words"
  ON package_words FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own package words"
  ON package_words FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_packages
    WHERE user_packages.package_id = package_words.package_id
    AND user_packages.user_id = auth.uid()
  ));
```

### Step 3: Create user_badges Table

```sql
-- Tracks earned badges
CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id VARCHAR(50) NOT NULL,
  
  -- BADGE INFO
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon VARCHAR(10) NOT NULL,
  badge_tier VARCHAR(20) NOT NULL CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'diamond')),
  badge_category VARCHAR(30) NOT NULL CHECK (badge_category IN ('completion', 'streak', 'achievement', 'milestone')),
  
  -- METADATA
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (user_id, badge_id)
);

-- Indexes
CREATE INDEX idx_user_badges_user_date ON user_badges(user_id, earned_at DESC);
CREATE INDEX idx_user_badges_category ON user_badges(user_id, badge_category);

-- RLS policies
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert badges"
  ON user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Step 4: Update user_settings Table

```sql
-- Add package preferences to existing user_settings table
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS default_package VARCHAR(20) DEFAULT 'standard' 
    CHECK (default_package IN ('foundation', 'standard', 'immersion', 'mastery')),
  ADD COLUMN IF NOT EXISTS show_package_recommendations BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_create_daily_package BOOLEAN DEFAULT FALSE;

-- Update existing rows
UPDATE user_settings 
SET default_package = 'standard' 
WHERE default_package IS NULL;
```

### Step 5: Add Streak Tracking to user_daily_stats

```sql
-- Enhance existing user_daily_stats table for package tracking
ALTER TABLE user_daily_stats
  ADD COLUMN IF NOT EXISTS package_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(20) 
    CHECK (package_type IN ('foundation', 'standard', 'immersion', 'mastery')),
  ADD COLUMN IF NOT EXISTS streak_maintained BOOLEAN DEFAULT FALSE;
```

---

## NEW UTILITY FUNCTIONS

### File: src/utils/packageCalculations.js

```javascript
/**
 * Package Calculations Utility
 * Handles package composition, selection, and management
 */

// Package definitions from Algorithm Bible
export const PACKAGE_TYPES = {
  foundation: {
    name: 'Foundation',
    words: 50,
    estimatedMinutes: { min: 15, max: 20 },
    badge: 'ðŸ¥‰',
    badgeName: 'Consistent Learner',
    description: 'Busy days, maintain progress',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  standard: {
    name: 'Standard',
    words: 100,
    estimatedMinutes: { min: 30, max: 40 },
    badge: 'ðŸ¥ˆ',
    badgeName: 'Dedicated Student',
    description: 'Balanced learning',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  immersion: {
    name: 'Immersion',
    words: 150,
    estimatedMinutes: { min: 45, max: 60 },
    badge: 'ðŸ¥‡',
    badgeName: 'Language Champion',
    description: 'Rapid advancement',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  },
  mastery: {
    name: 'Mastery',
    words: 250,
    estimatedMinutes: { min: 75, max: 100 },
    badge: 'ðŸ'Ž',
    badgeName: 'Elite Polyglot',
    description: 'Maximum progress',
    composition: {
      critical: 0.30,
      mastery_ready: 0.25,
      exposure: 0.25,
      new: 0.20
    }
  }
};

const MAX_NEW_WORDS_PER_PACKAGE = {
  foundation: 5,
  standard: 10,
  immersion: 15,
  mastery: 20
};

/**
 * Select words for a package using priority scoring
 * @param {Array} allUserWords - All user vocabulary progress records
 * @param {string} packageType - 'foundation' | 'standard' | 'immersion' | 'mastery'
 * @param {Object} options - Additional options (chapterFocusMode, currentChapter)
 * @returns {Object} - Selected words categorized and ordered
 */
export function selectWordsForPackage(allUserWords, packageType, options = {}) {
  const packageConfig = PACKAGE_TYPES[packageType];
  const totalWords = packageConfig.words;
  const composition = packageConfig.composition;
  
  // Calculate target counts for each category
  const targets = {
    critical: Math.round(totalWords * composition.critical),
    mastery_ready: Math.round(totalWords * composition.mastery_ready),
    exposure: Math.round(totalWords * composition.exposure),
    new: Math.min(
      MAX_NEW_WORDS_PER_PACKAGE[packageType],
      Math.round(totalWords * composition.new)
    )
  };
  
  // Import priority calculations
  const { calculateCurrentHealth, calculatePriorityScore } = 
    require('./priorityCalculations');
  
  // Categorize all words
  const categorized = {
    critical: [],
    mastery_ready: [],
    exposure: [],
    new: [],
    other: []
  };
  
  allUserWords.forEach(word => {
    const currentHealth = calculateCurrentHealth(word);
    const priorityScore = calculatePriorityScore(word, {
      currentHealth,
      ...options
    });
    
    const enrichedWord = {
      ...word,
      currentHealth,
      priorityScore
    };
    
    // Categorize
    if (currentHealth < 20) {
      categorized.critical.push(enrichedWord);
    } else if (word.time_gate_met && word.mastery_level < 100) {
      categorized.mastery_ready.push(enrichedWord);
    } else if (word.total_reviews < 10) {
      categorized.exposure.push(enrichedWord);
    } else if (word.total_reviews === 0) {
      categorized.new.push(enrichedWord);
    } else {
      categorized.other.push(enrichedWord);
    }
  });
  
  // Sort each category by priority score
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => b.priorityScore - a.priorityScore);
  });
  
  // Select words from each category
  const selected = {
    critical: [],
    mastery_ready: [],
    exposure: [],
    new: []
  };
  
  // Fill critical words
  selected.critical = categorized.critical.slice(0, targets.critical);
  
  // Fill mastery-ready words
  selected.mastery_ready = categorized.mastery_ready.slice(0, targets.mastery_ready);
  
  // Fill exposure words (exclude new words)
  selected.exposure = categorized.exposure
    .filter(w => w.total_reviews > 0)
    .slice(0, targets.exposure);
  
  // Fill new words
  selected.new = categorized.new.slice(0, targets.new);
  
  // Calculate how many words we have so far
  const currentTotal = 
    selected.critical.length +
    selected.mastery_ready.length +
    selected.exposure.length +
    selected.new.length;
  
  // Fill remaining slots with highest priority words from 'other'
  if (currentTotal < totalWords) {
    const remaining = totalWords - currentTotal;
    const fillWords = categorized.other.slice(0, remaining);
    
    // Distribute fill words into exposure category
    selected.exposure = [...selected.exposure, ...fillWords];
  }
  
  // Flatten and shuffle to avoid predictable patterns
  const allSelected = [
    ...selected.critical.map(w => ({ ...w, category: 'critical' })),
    ...selected.mastery_ready.map(w => ({ ...w, category: 'mastery_ready' })),
    ...selected.exposure.map(w => ({ ...w, category: 'exposure' })),
    ...selected.new.map(w => ({ ...w, category: 'new' }))
  ];
  
  // Shuffle
  const shuffled = shuffleArray(allSelected);
  
  // Add order
  const ordered = shuffled.map((word, index) => ({
    ...word,
    word_order: index + 1
  }));
  
  return {
    words: ordered,
    breakdown: {
      total: ordered.length,
      critical: selected.critical.length,
      mastery_ready: selected.mastery_ready.length,
      exposure: selected.exposure.length,
      new: selected.new.length
    },
    metadata: {
      packageType,
      estimatedMinutes: packageConfig.estimatedMinutes,
      averagePriority: calculateAverage(ordered.map(w => w.priorityScore))
    }
  };
}

/**
 * Check if package has expired (24 hours)
 */
export function isPackageExpired(package_) {
  const now = new Date();
  const expiresAt = new Date(package_.expires_at);
  return now > expiresAt && package_.status === 'active';
}

/**
 * Calculate package progress percentage
 */
export function calculatePackageProgress(package_) {
  if (package_.total_words === 0) return 0;
  return Math.round((package_.words_completed / package_.total_words) * 100);
}

/**
 * Calculate accuracy from package performance
 */
export function calculatePackageAccuracy(package_) {
  const total = 
    package_.dont_know_count +
    package_.hard_count +
    package_.medium_count +
    package_.easy_count;
  
  if (total === 0) return 0;
  
  const correct = package_.hard_count + package_.medium_count + package_.easy_count;
  return Math.round((correct / total) * 100);
}

/**
 * Determine if streak should be maintained
 * Requires completing at least Foundation 50 equivalent
 */
export function shouldMaintainStreak(package_) {
  return package_.words_completed >= 50 && package_.status === 'completed';
}

/**
 * Get recommended package based on user history
 */
export function getRecommendedPackage(userStats, availableWords) {
  // Check user's recent patterns
  const recentAverage = userStats.recent_daily_average || 100;
  
  // Check available critical words
  const criticalCount = availableWords.filter(w => w.currentHealth < 20).length;
  
  // Default to Standard
  let recommended = 'standard';
  
  // Adjust based on critical words
  if (criticalCount > 100) {
    recommended = 'immersion'; // Need more time for critical words
  } else if (criticalCount > 50) {
    recommended = 'standard';
  } else if (criticalCount < 20) {
    recommended = 'foundation'; // Maintenance mode
  }
  
  // Consider user's typical commitment
  if (recentAverage >= 150) {
    recommended = 'immersion';
  } else if (recentAverage >= 100) {
    recommended = 'standard';
  } else if (recentAverage >= 50) {
    recommended = 'foundation';
  }
  
  return recommended;
}

// Helper functions
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
```

### File: src/utils/badgeCalculations.js

```javascript
/**
 * Badge Calculations Utility
 * Defines badges and checks eligibility
 */

// Badge definitions from Algorithm Bible
export const BADGE_DEFINITIONS = {
  // COMPLETION BADGES
  foundation_complete: {
    id: 'foundation_complete',
    name: 'Consistent Learner',
    description: 'Complete a Foundation package (50 words)',
    icon: 'ðŸ¥‰',
    tier: 'bronze',
    category: 'completion'
  },
  standard_complete: {
    id: 'standard_complete',
    name: 'Dedicated Student',
    description: 'Complete a Standard package (100 words)',
    icon: 'ðŸ¥ˆ',
    tier: 'silver',
    category: 'completion'
  },
  immersion_complete: {
    id: 'immersion_complete',
    name: 'Language Champion',
    description: 'Complete an Immersion package (150 words)',
    icon: 'ðŸ¥‡',
    tier: 'gold',
    category: 'completion'
  },
  mastery_complete: {
    id: 'mastery_complete',
    name: 'Elite Polyglot',
    description: 'Complete a Mastery package (250 words)',
    icon: 'ðŸ'Ž',
    tier: 'diamond',
    category: 'completion'
  },
  
  // STREAK BADGES
  week_warrior: {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: 'ðŸ"¥',
    tier: 'bronze',
    category: 'streak'
  },
  month_master: {
    id: 'month_master',
    name: 'Month Master',
    description: 'Maintain a 30-day learning streak',
    icon: 'ðŸ"¥',
    tier: 'silver',
    category: 'streak'
  },
  century_scholar: {
    id: 'century_scholar',
    name: 'Century Scholar',
    description: 'Maintain a 100-day learning streak',
    icon: 'ðŸ"¥',
    tier: 'gold',
    category: 'streak'
  },
  
  // ACHIEVEMENT BADGES
  perfectionist: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete a package with 95%+ accuracy',
    icon: 'ðŸŽ¯',
    tier: 'gold',
    category: 'achievement'
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a package after 10 PM',
    icon: 'ðŸŒ™',
    tier: 'bronze',
    category: 'achievement'
  },
  early_bird: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a package before 7 AM',
    icon: 'ðŸŒ…',
    tier: 'bronze',
    category: 'achievement'
  },
  speed_demon: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 150 words in under 45 minutes',
    icon: 'âš¡',
    tier: 'silver',
    category: 'achievement'
  },
  
  // MILESTONE BADGES
  words_1000: {
    id: 'words_1000',
    name: '1,000 Words',
    description: 'Review 1,000 total words',
    icon: 'ðŸ"–',
    tier: 'bronze',
    category: 'milestone'
  },
  words_5000: {
    id: 'words_5000',
    name: '5,000 Words',
    description: 'Review 5,000 total words',
    icon: 'ðŸ"š',
    tier: 'silver',
    category: 'milestone'
  },
  words_10000: {
    id: 'words_10000',
    name: '10,000 Words',
    description: 'Review 10,000 total words',
    icon: 'ðŸ"–',
    tier: 'gold',
    category: 'milestone'
  },
  words_50000: {
    id: 'words_50000',
    name: '50,000 Words',
    description: 'Review 50,000 total words',
    icon: 'ðŸ†',
    tier: 'diamond',
    category: 'milestone'
  }
};

/**
 * Check which badges should be awarded on package completion
 */
export function checkBadgesOnPackageComplete(package_, userStats) {
  const badges = [];
  const completedAt = new Date(package_.completed_at);
  const hours = completedAt.getHours();
  
  // Completion badges
  const packageBadgeMap = {
    foundation: 'foundation_complete',
    standard: 'standard_complete',
    immersion: 'immersion_complete',
    mastery: 'mastery_complete'
  };
  
  const completionBadge = packageBadgeMap[package_.package_type];
  if (completionBadge) {
    badges.push(BADGE_DEFINITIONS[completionBadge]);
  }
  
  // Achievement badges
  const accuracy = calculatePackageAccuracy(package_);
  if (accuracy >= 95) {
    badges.push(BADGE_DEFINITIONS.perfectionist);
  }
  
  // Time-based achievements
  if (hours >= 22 || hours < 4) { // After 10 PM or before 4 AM
    badges.push(BADGE_DEFINITIONS.night_owl);
  }
  
  if (hours >= 4 && hours < 7) { // 4 AM - 7 AM
    badges.push(BADGE_DEFINITIONS.early_bird);
  }
  
  // Speed demon
  if (
    package_.total_words >= 150 &&
    package_.actual_minutes &&
    package_.actual_minutes < 45
  ) {
    badges.push(BADGE_DEFINITIONS.speed_demon);
  }
  
  // Milestone badges
  const totalReviews = userStats.total_words_reviewed || 0;
  if (totalReviews >= 50000 && totalReviews < 50000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_50000);
  } else if (totalReviews >= 10000 && totalReviews < 10000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_10000);
  } else if (totalReviews >= 5000 && totalReviews < 5000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_5000);
  } else if (totalReviews >= 1000 && totalReviews < 1000 + package_.total_words) {
    badges.push(BADGE_DEFINITIONS.words_1000);
  }
  
  return badges;
}

/**
 * Check streak badges
 */
export function checkStreakBadges(currentStreak) {
  const badges = [];
  
  if (currentStreak >= 100) {
    badges.push(BADGE_DEFINITIONS.century_scholar);
  } else if (currentStreak >= 30) {
    badges.push(BADGE_DEFINITIONS.month_master);
  } else if (currentStreak >= 7) {
    badges.push(BADGE_DEFINITIONS.week_warrior);
  }
  
  return badges;
}

// Helper
function calculatePackageAccuracy(package_) {
  const total = 
    package_.dont_know_count +
    package_.hard_count +
    package_.medium_count +
    package_.easy_count;
  
  if (total === 0) return 0;
  
  const correct = package_.hard_count + package_.medium_count + package_.easy_count;
  return Math.round((correct / total) * 100);
}
```

---

## PACKAGE SELECTION UI

### File: src/pages/PackageSelection.jsx

```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PACKAGE_TYPES, getRecommendedPackage, selectWordsForPackage } from '../utils/packageCalculations';
import { calculateCurrentHealth } from '../utils/healthCalculations';

export default function PackageSelection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userWords, setUserWords] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [activePackage, setActivePackage] = useState(null);
  const [recommendedPackage, setRecommendedPackage] = useState('standard');
  
  useEffect(() => {
    loadData();
  }, []);
  
  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      
      // Check for active package
      const { data: packages } = await supabase
        .from('user_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (packages && packages.length > 0) {
        setActivePackage(packages[0]);
      }
      
      // Load user words
      const { data: words } = await supabase
        .from('user_vocabulary_progress')
        .select(`
          *,
          vocabulary (*)
        `)
        .eq('user_id', user.id);
      
      setUserWords(words || []);
      
      // Load user stats
      const today = new Date().toISOString().split('T')[0];
      const { data: stats } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('review_date', today)
        .single();
      
      setUserStats(stats);
      
      // Calculate recommendation
      const wordsWithHealth = words.map(w => ({
        ...w,
        currentHealth: calculateCurrentHealth(w)
      }));
      
      const recommended = getRecommendedPackage(stats || {}, wordsWithHealth);
      setRecommendedPackage(recommended);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }
  
  async function createPackage(packageType) {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get user settings for options
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      // Select words for package
      const selection = selectWordsForPackage(userWords, packageType, {
        chapterFocusMode: settings?.chapter_focus_mode || false,
        currentChapter: settings?.current_focus_chapter || null
      });
      
      // Create package record
      const packageConfig = PACKAGE_TYPES[packageType];
      const { data: package_, error: packageError } = await supabase
        .from('user_packages')
        .insert({
          user_id: user.id,
          package_type: packageType,
          total_words: selection.words.length,
          estimated_minutes: (packageConfig.estimatedMinutes.min + packageConfig.estimatedMinutes.max) / 2
        })
        .select()
        .single();
      
      if (packageError) throw packageError;
      
      // Insert package words
      const packageWords = selection.words.map(word => ({
        package_id: package_.package_id,
        vocab_id: word.vocab_id,
        word_order: word.word_order,
        category: word.category
      }));
      
      const { error: wordsError } = await supabase
        .from('package_words')
        .insert(packageWords);
      
      if (wordsError) throw wordsError;
      
      // Navigate to package page
      navigate(`/package/${package_.package_id}`);
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Failed to create package. Please try again.');
      setLoading(false);
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }
  
  // If active package exists, show resume option
  if (activePackage) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Active Package Found</h2>
          <p className="mb-4">
            You have an active {PACKAGE_TYPES[activePackage.package_type].name} package 
            with {activePackage.words_completed}/{activePackage.total_words} words completed.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate(`/package/${activePackage.package_id}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Resume Package →
            </button>
            <button
              onClick={() => setActivePackage(null)}
              className="bg-gray-300 px-6 py-3 rounded-lg hover:bg-gray-400"
            >
              Start New Package
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Package selection screen
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2">Good {getTimeOfDay()}, {user?.name || 'Learner'}!</h1>
        <p className="text-gray-600 mb-6">Choose Your Learning Journey Today</p>
        
        {/* User stats summary */}
        {userStats && (
          <div className="bg-blue-50 rounded-lg p-4 mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  ðŸ"¥ {userStats.current_streak}
                </div>
                <div className="text-sm text-gray-600">Day Streak</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  âš ï¸ {userWords.filter(w => calculateCurrentHealth(w) < 20).length}
                </div>
                <div className="text-sm text-gray-600">Need Attention</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  â­ {userWords.filter(w => w.time_gate_met && w.mastery_level < 100).length}
                </div>
                <div className="text-sm text-gray-600">Ready to Level Up</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Package options */}
        <div className="space-y-4">
          {Object.entries(PACKAGE_TYPES).map(([type, config]) => (
            <div
              key={type}
              className={`border-2 rounded-lg p-6 transition-all hover:shadow-lg cursor-pointer ${
                type === recommendedPackage
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => createPackage(type)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl">{config.badge}</span>
                    <div>
                      <h3 className="text-xl font-bold">
                        {config.name.toUpperCase()} ({config.words} words)
                      </h3>
                      {type === recommendedPackage && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          â­ RECOMMENDED
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                    <div>
                      â±ï¸ {config.estimatedMinutes.min}-{config.estimatedMinutes.max} minutes
                    </div>
                    <div>
                      ðŸ… Badge: {config.badgeName}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-3">
                    Perfect for: {config.description}
                  </p>
                </div>
                
                <button
                  className="ml-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold whitespace-nowrap"
                >
                  Select →
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Yesterday: {userStats?.words_reviewed || 0} words reviewed</p>
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}
```

---

## PACKAGE MANAGEMENT LOGIC

### File: src/pages/PackageView.jsx

```javascript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PACKAGE_TYPES, calculatePackageProgress, isPackageExpired } from '../utils/packageCalculations';

export default function PackageView() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const [package_, setPackage] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadPackage();
    
    // Check expiration every minute
    const interval = setInterval(checkExpiration, 60000);
    return () => clearInterval(interval);
  }, [packageId]);
  
  async function loadPackage() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      
      // Load package
      const { data: pkg } = await supabase
        .from('user_packages')
        .select('*')
        .eq('package_id', packageId)
        .eq('user_id', user.id)
        .single();
      
      if (!pkg) {
        navigate('/');
        return;
      }
      
      setPackage(pkg);
      
      // Load package words
      const { data: pkgWords } = await supabase
        .from('package_words')
        .select(`
          *,
          vocabulary (*)
        `)
        .eq('package_id', packageId)
        .order('word_order');
      
      setWords(pkgWords || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading package:', error);
      setLoading(false);
    }
  }
  
  async function checkExpiration() {
    if (!package_) return;
    
    if (isPackageExpired(package_) && package_.status === 'active') {
      // Mark as expired
      await supabase
        .from('user_packages')
        .update({ status: 'expired' })
        .eq('package_id', package_.package_id);
      
      // Reload
      await loadPackage();
    }
  }
  
  function startReview() {
    // Find first unreviewed word
    const firstUnreviewed = words.find(w => !w.reviewed);
    if (firstUnreviewed) {
      navigate(`/flashcards?package=${packageId}&start=${firstUnreviewed.word_order}`);
    } else {
      navigate(`/flashcards?package=${packageId}`);
    }
  }
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!package_) {
    return <div className="flex items-center justify-center min-h-screen">Package not found</div>;
  }
  
  const config = PACKAGE_TYPES[package_.package_type];
  const progress = calculatePackageProgress(package_);
  const isExpired = package_.status === 'expired';
  const isCompleted = package_.status === 'completed';
  
  // Time remaining
  const now = new Date();
  const expiresAt = new Date(package_.expires_at);
  const hoursRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60)) % 60);
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{config.badge}</span>
            <div>
              <h1 className="text-3xl font-bold">
                {config.name} Package
              </h1>
              <p className="text-gray-600">{config.words} words</p>
            </div>
          </div>
          
          {!isCompleted && !isExpired && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Time Remaining</div>
              <div className="text-2xl font-bold text-orange-600">
                {hoursRemaining}h {minutesRemaining}m
              </div>
            </div>
          )}
        </div>
        
        {/* Status banner */}
        {isExpired && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold">
              âš ï¸ This package has expired after 24 hours.
            </p>
          </div>
        )}
        
        {isCompleted && (
          <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">
              âœ… Package completed! Great work!
            </p>
          </div>
        )}
        
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-medium">
              {package_.words_completed}/{package_.total_words} words ({progress}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Performance stats */}
        {package_.words_completed > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">
                {package_.dont_know_count}
              </div>
              <div className="text-sm text-gray-600">Don't Know</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">
                {package_.hard_count}
              </div>
              <div className="text-sm text-gray-600">Hard</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {package_.medium_count}
              </div>
              <div className="text-sm text-gray-600">Medium</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">
                {package_.easy_count}
              </div>
              <div className="text-sm text-gray-600">Easy</div>
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-4">
          {!isCompleted && !isExpired && (
            <button
              onClick={startReview}
              className="flex-1 bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-semibold text-lg"
            >
              {package_.words_completed > 0 ? 'Continue Review →' : 'Begin Package →'}
            </button>
          )}
          
          <button
            onClick={() => navigate('/')}
            className="bg-gray-200 py-4 px-6 rounded-lg hover:bg-gray-300"
          >
            Back to Home
          </button>
        </div>
        
        {/* Words breakdown (optional detail view) */}
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-bold mb-4">Package Contents</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">âš¡ Critical:</span>{' '}
              {words.filter(w => w.category === 'critical').length} words
            </div>
            <div>
              <span className="font-semibold">â­ Mastery Ready:</span>{' '}
              {words.filter(w => w.category === 'mastery_ready').length} words
            </div>
            <div>
              <span className="font-semibold">ðŸ"„ Exposure:</span>{' '}
              {words.filter(w => w.category === 'exposure').length} words
            </div>
            <div>
              <span className="font-semibold">ðŸ†• New:</span>{' '}
              {words.filter(w => w.category === 'new').length} words
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## BADGE SYSTEM

### File: src/components/BadgeNotification.jsx

```javascript
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Badge earned notification component
 * Shows animated celebration when badge is earned
 */
export default function BadgeNotification({ badge, onClose }) {
  if (!badge) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          className="bg-white rounded-2xl p-8 max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            {/* Animated badge icon */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{
                duration: 0.5,
                repeat: 2
              }}
              className="text-8xl mb-4"
            >
              {badge.icon}
            </motion.div>
            
            <h2 className="text-3xl font-bold mb-2">Badge Earned!</h2>
            <h3 className="text-2xl font-semibold text-blue-600 mb-4">
              {badge.name}
            </h3>
            
            <p className="text-gray-600 mb-6">
              {badge.description}
            </p>
            
            <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-6">
              {badge.tier.toUpperCase()} TIER
            </div>
            
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Awesome! →
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

### File: src/components/BadgeShowcase.jsx

```javascript
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BADGE_DEFINITIONS } from '../utils/badgeCalculations';

/**
 * Badge showcase component
 * Displays all earned badges
 */
export default function BadgeShowcase({ userId }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  useEffect(() => {
    loadBadges();
  }, [userId]);
  
  async function loadBadges() {
    try {
      const { data } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });
      
      setBadges(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading badges:', error);
      setLoading(false);
    }
  }
  
  const categories = ['all', 'completion', 'streak', 'achievement', 'milestone'];
  const filteredBadges = filter === 'all'
    ? badges
    : badges.filter(b => b.badge_category === filter);
  
  if (loading) {
    return <div className="text-center py-4">Loading badges...</div>;
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Badge Collection</h2>
      
      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              filter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Badge grid */}
      {filteredBadges.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No badges earned yet in this category.
          <br />
          Keep learning to unlock badges!
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBadges.map(badge => (
            <div
              key={badge.badge_id}
              className="border-2 border-gray-200 rounded-lg p-4 text-center hover:shadow-lg transition-all"
            >
              <div className="text-5xl mb-2">{badge.badge_icon}</div>
              <h3 className="font-bold mb-1">{badge.badge_name}</h3>
              <p className="text-xs text-gray-600 mb-2">{badge.badge_description}</p>
              <div className="text-xs text-gray-500">
                {new Date(badge.earned_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Stats */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-2xl font-bold text-blue-600">{badges.length}</div>
            <div className="text-gray-600">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {badges.filter(b => b.badge_category === 'completion').length}
            </div>
            <div className="text-gray-600">Completion</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {badges.filter(b => b.badge_category === 'streak').length}
            </div>
            <div className="text-gray-600">Streak</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {badges.filter(b => b.badge_category === 'achievement').length}
            </div>
            <div className="text-gray-600">Achievement</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## INTEGRATION POINTS

### Update Flashcards.jsx

Add package tracking to the existing flashcard review system:

```javascript
// In Flashcards.jsx, add at the top:
import { useSearchParams } from 'react-router-dom';

// In component:
const [searchParams] = useSearchParams();
const packageId = searchParams.get('package');
const [packageData, setPackageData] = useState(null);

// Load package data if in package mode
useEffect(() => {
  if (packageId) {
    loadPackageData();
  }
}, [packageId]);

async function loadPackageData() {
  const { data } = await supabase
    .from('user_packages')
    .select('*')
    .eq('package_id', packageId)
    .single();
  
  setPackageData(data);
  
  // Load package words instead of regular selection
  const { data: words } = await supabase
    .from('package_words')
    .select(`
      *,
      vocabulary (*)
    `)
    .eq('package_id', packageId)
    .eq('reviewed', false)
    .order('word_order');
  
  // Use these words for session
  setCurrentDeck(words.map(w => w.vocabulary));
}

// After each card review, update package progress
async function handleCardResponse(response) {
  // ... existing review logic ...
  
  if (packageId && currentCard) {
    // Update package word as reviewed
    await supabase
      .from('package_words')
      .update({
        reviewed: true,
        review_response: response,
        reviewed_at: new Date().toISOString()
      })
      .eq('package_id', packageId)
      .eq('vocab_id', currentCard.vocab_id);
    
    // Update package performance counters
    const updateField = `${response.replace('-', '_')}_count`;
    await supabase
      .from('user_packages')
      .update({
        words_completed: packageData.words_completed + 1,
        [updateField]: packageData[updateField] + 1
      })
      .eq('package_id', packageId);
    
    // Check if package complete
    if (packageData.words_completed + 1 >= packageData.total_words) {
      await completePackage();
    }
  }
}

async function completePackage() {
  const completedAt = new Date();
  const startedAt = new Date(packageData.started_at);
  const actualMinutes = Math.round((completedAt - startedAt) / (1000 * 60));
  
  // Mark package as completed
  await supabase
    .from('user_packages')
    .update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      actual_minutes: actualMinutes
    })
    .eq('package_id', packageId);
  
  // Check for badges
  const { checkBadgesOnPackageComplete } = require('../utils/badgeCalculations');
  const newBadges = checkBadgesOnPackageComplete(
    { ...packageData, completed_at: completedAt, actual_minutes: actualMinutes },
    userStats
  );
  
  // Award badges
  for (const badge of newBadges) {
    await supabase
      .from('user_badges')
      .insert({
        user_id: user.id,
        badge_id: badge.id,
        badge_name: badge.name,
        badge_description: badge.description,
        badge_icon: badge.icon,
        badge_tier: badge.tier,
        badge_category: badge.category
      });
    
    // Show badge notification
    setEarnedBadge(badge);
  }
  
  // Update streak
  await updateStreak();
  
  // Navigate to completion screen
  navigate(`/package/${packageId}/complete`);
}
```

### Update Home Dashboard

Add package CTA to dashboard:

```javascript
// In Home.jsx or Dashboard.jsx
import { Link } from 'react-router-dom';

// Add to dashboard:
<div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white mb-6">
  <h2 className="text-2xl font-bold mb-2">Ready to learn today?</h2>
  <p className="mb-4">Choose your daily package and start your learning journey!</p>
  <Link
    to="/package-selection"
    className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100"
  >
    Start Today's Package →
  </Link>
</div>
```

---

## TESTING CHECKLIST

### Database Tests

- [ ] Create user_packages table successfully
- [ ] Create package_words junction table
- [ ] Create user_badges table
- [ ] RLS policies work (users can only see own data)
- [ ] Foreign key constraints working
- [ ] Cascading deletes work (delete package → deletes package_words)

### Package Selection Tests

- [ ] Package selection screen loads
- [ ] Shows correct user stats (streak, critical words, etc.)
- [ ] Recommendation algorithm suggests appropriate package
- [ ] Can select each package type (Foundation/Standard/Immersion/Mastery)
- [ ] Package creation succeeds
- [ ] Words are selected using priority algorithm
- [ ] Category distribution matches targets
- [ ] Active package detection works
- [ ] Resume functionality works

### Package Progress Tests

- [ ] Package view loads correctly
- [ ] Progress bar updates after reviews
- [ ] Performance stats update (Don't Know/Hard/Medium/Easy)
- [ ] Expiration timer displays correctly
- [ ] Package expires after 24 hours
- [ ] Can complete package
- [ ] Words marked as reviewed
- [ ] Package marked as completed

### Badge System Tests

- [ ] Completion badges awarded correctly
- [ ] Streak badges awarded at milestones
- [ ] Achievement badges work (accuracy, time-based)
- [ ] Milestone badges awarded
- [ ] Badge notification displays
- [ ] Badge showcase displays all badges
- [ ] Category filtering works
- [ ] No duplicate badges awarded

### Integration Tests

- [ ] Flashcards integrate with package system
- [ ] Package words flow through review correctly
- [ ] Streak updates on package completion
- [ ] Daily stats updated
- [ ] Chapter progress still works
- [ ] Health system still functions
- [ ] Time gates still enforced
- [ ] Priority scoring still works

### Edge Cases

- [ ] Creating package with insufficient words
- [ ] Expired package cannot be resumed
- [ ] Multiple packages cannot be active
- [ ] Package completion with 0 words
- [ ] Badge already earned (no duplicate)
- [ ] User with no words cannot create package

---

## SUCCESS CRITERIA

### Phase 3 is complete when:

1. **âœ… Database Schema**
   - All tables created successfully
   - RLS policies working
   - Indexes in place

2. **âœ… Package Selection**
   - User can choose from 4 package types
   - Recommendations working
   - Words selected intelligently
   - Active package detection working

3. **âœ… Package Lifecycle**
   - Package creation works
   - Progress tracking functional
   - 24-hour expiration working
   - Completion flow complete

4. **âœ… Badge System**
   - Badges defined and documented
   - Badge awarding logic working
   - Badge notifications displaying
   - Badge showcase functional

5. **âœ… Integration**
   - Flashcards work with packages
   - Streak tracking integrated
   - Daily stats updated
   - No regressions in existing features

6. **âœ… User Experience**
   - Clear navigation flow
   - Intuitive UI
   - Helpful feedback messages
   - No confusing states

---

## NEXT STEPS AFTER PHASE 3

Once Phase 3 is complete, the foundation is set for:

**Phase 4: Waypoint System**
- Break packages into themed chunks
- Dynamic waypoint generation
- Learning trail visualization
- Pause/resume between waypoints

**Future Enhancements:**
- XP and leveling system
- More badge types
- Streak protection mechanisms
- Social features (leaderboards)

---

**END OF PHASE 3 IMPLEMENTATION GUIDE**

This guide provides everything needed to implement the Daily Package System. Follow the steps sequentially, test thoroughly, and Phase 3 will be complete!
