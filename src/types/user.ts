import { Difficulty } from './quiz';

export interface UserProfile {
  username: string;
  avatarEmoji: string;
  totalScore: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  unlockedDifficulties: Difficulty[];
  achievements: Achievement[];
  streakFreezes: number;
  streakFreezeUsedToday: boolean;
  dailyChallengeCompleted: string | null; // date string
  xpLevel: number;
  xpCurrent: number;
  xpToNextLevel: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  gamesPlayed: number;
  streak: number;
  avatarEmoji: string;
  updatedAt: string;
}

export const AVATAR_OPTIONS = [
  '\uD83E\uDDE0', '\uD83E\uDD13', '\uD83E\uDD16', '\uD83E\uDDD9', '\uD83E\uDDD1\u200D\uD83D\uDE80',
  '\uD83E\uDDD1\u200D\uD83D\uDCBB', '\uD83E\uDDD1\u200D\uD83C\uDF93', '\uD83E\uDD8A', '\uD83E\uDD89', '\uD83D\uDC09',
  '\uD83E\uDD84', '\uD83D\uDC27', '\uD83D\uDC2C', '\uD83E\uDD85', '\uD83D\uDC31',
  '\uD83D\uDC3B', '\uD83E\uDD81', '\uD83D\uDC22', '\uD83E\uDD8B', '\uD83C\uDF1F',
];

export const XP_PER_LEVEL = 500;
