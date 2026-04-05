import {
  POINTS_CORRECT,
  SPEED_BONUS_MAX,
  SPEED_BONUS_THRESHOLD,
  STREAK_MULTIPLIER,
  STREAK_MULTIPLIER_THRESHOLD,
  TIME_PER_QUESTION,
  STARS_THRESHOLDS,
} from '../constants/game';
import { Difficulty } from '../types/quiz';

export function calculatePoints(
  timeRemaining: number,
  difficulty: Difficulty,
  consecutiveCorrect: number
): number {
  const totalTime = TIME_PER_QUESTION[difficulty];
  const timeRatio = timeRemaining / totalTime;

  let points = POINTS_CORRECT;

  if (timeRatio >= SPEED_BONUS_THRESHOLD) {
    const bonusRatio =
      (timeRatio - SPEED_BONUS_THRESHOLD) / (1 - SPEED_BONUS_THRESHOLD);
    points += Math.round(SPEED_BONUS_MAX * bonusRatio);
  }

  if (consecutiveCorrect >= STREAK_MULTIPLIER_THRESHOLD) {
    points = Math.round(points * STREAK_MULTIPLIER);
  }

  return points;
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
