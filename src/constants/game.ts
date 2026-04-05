import { Difficulty } from '../types/quiz';

export const INITIAL_LIVES = 3;
export const QUESTIONS_PER_QUIZ = 10;

export const TIME_PER_QUESTION: Record<Difficulty, number> = {
  easy: 30,
  medium: 20,
  hard: 15,
};

export const POINTS_CORRECT = 100;
export const SPEED_BONUS_MAX = 50;
export const SPEED_BONUS_THRESHOLD = 0.5;

export const STREAK_MULTIPLIER = 1.5;
export const STREAK_MULTIPLIER_THRESHOLD = 3;

export const UNLOCK_MEDIUM_THRESHOLD = 500;
export const UNLOCK_HARD_THRESHOLD = 2000;

export const STARS_THRESHOLDS = {
  three: 0.9,
  two: 0.7,
  one: 0,
};

// Adaptive difficulty
export const ADAPTIVE_UPGRADE_THRESHOLD = 3;   // consecutive correct to bump up
export const ADAPTIVE_DOWNGRADE_THRESHOLD = 2;  // consecutive wrong to bump down

// Streak freeze
export const MAX_STREAK_FREEZES = 3;
export const STREAK_FREEZE_COST = 200; // points to buy a freeze

// XP / Level
export const XP_PER_CORRECT = 10;
export const XP_PER_QUIZ_COMPLETE = 50;
export const XP_BONUS_PERFECT = 100;
export const XP_PER_LEVEL = 500;

// Daily challenge
export const DAILY_CHALLENGE_BONUS = 150;
export const DAILY_CHALLENGE_QUESTIONS = 5;

// Spaced repetition (SM-2)
export const SM2_INITIAL_INTERVAL = 1;    // days
export const SM2_INITIAL_EASE = 2.5;
export const SM2_MIN_EASE = 1.3;

// Confetti
export const CONFETTI_PIECE_COUNT = 50;
export const CONFETTI_DURATION = 2000;
