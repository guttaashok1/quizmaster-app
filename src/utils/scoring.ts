import {
  POINTS_CORRECT,
  STARS_THRESHOLDS,
} from '../constants/game';
import { Difficulty } from '../types/quiz';

export function calculatePoints(
  _timeRemaining: number,
  _difficulty: Difficulty,
  _consecutiveCorrect: number
): number {
  return POINTS_CORRECT;
}

export function calculateStars(
  correctAnswers: number,
  totalQuestions: number
): 1 | 2 | 3 {
  const ratio = correctAnswers / totalQuestions;
  if (ratio >= STARS_THRESHOLDS.three) return 3;
  if (ratio >= STARS_THRESHOLDS.two) return 2;
  return 1;
}
