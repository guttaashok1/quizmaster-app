import { UNLOCK_MEDIUM_THRESHOLD, UNLOCK_HARD_THRESHOLD } from '../constants/game';
import { Difficulty } from '../types/quiz';

export function getUnlockedDifficulties(totalScore: number): Difficulty[] {
  const difficulties: Difficulty[] = ['easy'];
  if (totalScore >= UNLOCK_MEDIUM_THRESHOLD) difficulties.push('medium');
  if (totalScore >= UNLOCK_HARD_THRESHOLD) difficulties.push('hard');
  return difficulties;
}

export function isDifficultyUnlocked(
  difficulty: Difficulty,
  totalScore: number
): boolean {
  return getUnlockedDifficulties(totalScore).includes(difficulty);
}

export function getNextUnlockThreshold(totalScore: number): {
  difficulty: Difficulty;
  pointsNeeded: number;
} | null {
  if (totalScore < UNLOCK_MEDIUM_THRESHOLD) {
    return {
      difficulty: 'medium',
      pointsNeeded: UNLOCK_MEDIUM_THRESHOLD - totalScore,
    };
  }
  if (totalScore < UNLOCK_HARD_THRESHOLD) {
    return {
      difficulty: 'hard',
      pointsNeeded: UNLOCK_HARD_THRESHOLD - totalScore,
    };
  }
  return null;
}
