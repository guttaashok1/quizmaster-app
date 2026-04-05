import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Difficulty } from '../types/quiz';
import { UserProfile, Achievement, XP_PER_LEVEL } from '../types/user';
import { QuizResult } from '../types/quiz';
import { getToday, calculateStreak } from '../utils/dateUtils';
import {
  XP_PER_CORRECT,
  XP_PER_QUIZ_COMPLETE,
  XP_BONUS_PERFECT,
  MAX_STREAK_FREEZES,
  STREAK_FREEZE_COST,
} from '../constants/game';

interface UserState extends UserProfile {
  recentTopics: string[];
  hasCompletedOnboarding: boolean;
  hasReached100Points: boolean;
  updateAfterQuiz: (result: QuizResult, topic: string) => void;
  setUsername: (name: string) => void;
  setAvatar: (emoji: string) => void;
  addAchievement: (achievement: Achievement) => void;
  buyStreakFreeze: () => boolean;
  useStreakFreeze: () => boolean;
  completeDailyChallenge: (score: number) => void;
  addXP: (amount: number) => void;
  checkAchievements: () => Achievement[];
  completeOnboarding: () => void;
}

const ACHIEVEMENT_DEFS = [
  { id: 'first_quiz', title: 'First Steps', description: 'Complete your first quiz', icon: '\uD83C\uDF1F', check: (s: UserProfile) => s.gamesPlayed >= 1 },
  { id: 'ten_quizzes', title: 'Quiz Enthusiast', description: 'Complete 10 quizzes', icon: '\uD83C\uDFAE', check: (s: UserProfile) => s.gamesPlayed >= 10 },
  { id: 'fifty_quizzes', title: 'Quiz Master', description: 'Complete 50 quizzes', icon: '\uD83D\uDC51', check: (s: UserProfile) => s.gamesPlayed >= 50 },
  { id: 'streak_7', title: 'Week Warrior', description: '7-day streak', icon: '\uD83D\uDD25', check: (s: UserProfile) => s.longestStreak >= 7 },
  { id: 'streak_30', title: 'Monthly Legend', description: '30-day streak', icon: '\u2B50', check: (s: UserProfile) => s.longestStreak >= 30 },
  { id: 'score_1000', title: 'Point Collector', description: 'Earn 1,000 points', icon: '\uD83D\uDCB0', check: (s: UserProfile) => s.totalScore >= 1000 },
  { id: 'score_10000', title: 'Point Hoarder', description: 'Earn 10,000 points', icon: '\uD83D\uDCB0', check: (s: UserProfile) => s.totalScore >= 10000 },
  { id: 'perfect', title: 'Perfectionist', description: 'Get 100% on a quiz', icon: '\uD83C\uDFC6', check: (_s: UserProfile) => false }, // checked separately
  { id: 'unlock_medium', title: 'Rising Star', description: 'Unlock Medium difficulty', icon: '\u26A1', check: (s: UserProfile) => s.unlockedDifficulties.includes('medium') },
  { id: 'unlock_hard', title: 'Brave Soul', description: 'Unlock Hard difficulty', icon: '\uD83D\uDD25', check: (s: UserProfile) => s.unlockedDifficulties.includes('hard') },
  { id: 'accuracy_90', title: 'Sharpshooter', description: '90%+ overall accuracy', icon: '\uD83C\uDFAF', check: (s: UserProfile) => s.totalAnswers > 20 && (s.correctAnswers / s.totalAnswers) >= 0.9 },
  { id: 'level_5', title: 'Leveling Up', description: 'Reach level 5', icon: '\uD83D\uDE80', check: (s: UserProfile) => s.xpLevel >= 5 },
  { id: 'level_10', title: 'Veteran', description: 'Reach level 10', icon: '\uD83C\uDF1F', check: (s: UserProfile) => s.xpLevel >= 10 },
];

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      username: 'Player',
      avatarEmoji: '\uD83E\uDDE0',
      totalScore: 0,
      gamesPlayed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastPlayedDate: null,
      unlockedDifficulties: ['easy', 'medium', 'hard'] as Difficulty[],
      achievements: [],
      recentTopics: [],
      hasCompletedOnboarding: false,
      hasReached100Points: false,
      streakFreezes: 1, // start with 1 free freeze
      streakFreezeUsedToday: false,
      dailyChallengeCompleted: null,
      xpLevel: 1,
      xpCurrent: 0,
      xpToNextLevel: XP_PER_LEVEL,

      updateAfterQuiz: (result, topic) => {
        const state = get();
        const { newStreak, streakBroken } = calculateStreak(
          state.lastPlayedDate,
          state.currentStreak
        );

        // If streak would break but we have a freeze
        let finalStreak = newStreak;
        if (streakBroken && state.streakFreezes > 0 && !state.streakFreezeUsedToday) {
          finalStreak = state.currentStreak; // preserve streak
          set({ streakFreezes: state.streakFreezes - 1, streakFreezeUsedToday: true });
        }

        const newTotalScore = Math.max(0, state.totalScore + result.score);

        const recentTopics = [
          topic,
          ...state.recentTopics.filter((t) => t !== topic),
        ].slice(0, 10);

        // XP calculation
        const xpEarned =
          result.correctAnswers * XP_PER_CORRECT +
          XP_PER_QUIZ_COMPLETE +
          (result.correctAnswers === result.totalQuestions ? XP_BONUS_PERFECT : 0);

        let newXP = state.xpCurrent + xpEarned;
        let newLevel = state.xpLevel;
        let newXPToNext = state.xpToNextLevel;

        while (newXP >= newXPToNext) {
          newXP -= newXPToNext;
          newLevel += 1;
          newXPToNext = XP_PER_LEVEL + (newLevel - 1) * 100; // escalating
        }

        const rewardUpdate: Partial<UserState> = {};
        if (!state.hasReached100Points && newTotalScore >= 100) {
          rewardUpdate.hasReached100Points = true;
        }

        set({
          totalScore: newTotalScore,
          gamesPlayed: state.gamesPlayed + 1,
          correctAnswers: state.correctAnswers + result.correctAnswers,
          totalAnswers: state.totalAnswers + result.totalQuestions,
          currentStreak: finalStreak,
          longestStreak: Math.max(state.longestStreak, finalStreak),
          lastPlayedDate: getToday(),
          unlockedDifficulties: ['easy', 'medium', 'hard'] as Difficulty[],
          recentTopics,
          xpCurrent: newXP,
          xpLevel: newLevel,
          xpToNextLevel: newXPToNext,
          ...rewardUpdate,
        });

        // Check achievements after update
        setTimeout(() => get().checkAchievements(), 100);
      },

      setUsername: (name) => set({ username: name }),
      setAvatar: (emoji) => set({ avatarEmoji: emoji }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      addAchievement: (achievement) =>
        set((state) => ({
          achievements: [...state.achievements, achievement],
        })),

      buyStreakFreeze: () => {
        const state = get();
        if (state.totalScore < STREAK_FREEZE_COST) return false;
        if (state.streakFreezes >= MAX_STREAK_FREEZES) return false;
        set({
          totalScore: state.totalScore - STREAK_FREEZE_COST,
          streakFreezes: state.streakFreezes + 1,
        });
        return true;
      },

      useStreakFreeze: () => {
        const state = get();
        if (state.streakFreezes <= 0 || state.streakFreezeUsedToday) return false;
        set({
          streakFreezes: state.streakFreezes - 1,
          streakFreezeUsedToday: true,
        });
        return true;
      },

      completeDailyChallenge: (score) => {
        set({
          dailyChallengeCompleted: getToday(),
          totalScore: get().totalScore + score,
        });
      },

      addXP: (amount) => {
        const state = get();
        let newXP = state.xpCurrent + amount;
        let newLevel = state.xpLevel;
        let newXPToNext = state.xpToNextLevel;

        while (newXP >= newXPToNext) {
          newXP -= newXPToNext;
          newLevel += 1;
          newXPToNext = XP_PER_LEVEL + (newLevel - 1) * 100;
        }

        set({ xpCurrent: newXP, xpLevel: newLevel, xpToNextLevel: newXPToNext });
      },

      checkAchievements: () => {
        const state = get();
        const newAchievements: Achievement[] = [];

        for (const def of ACHIEVEMENT_DEFS) {
          if (state.achievements.some((a) => a.id === def.id)) continue;
          if (def.check(state)) {
            const achievement: Achievement = {
              id: def.id,
              title: def.title,
              description: def.description,
              icon: def.icon,
              unlockedAt: new Date().toISOString(),
            };
            newAchievements.push(achievement);
          }
        }

        if (newAchievements.length > 0) {
          set({
            achievements: [...state.achievements, ...newAchievements],
          });
        }

        return newAchievements;
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export { ACHIEVEMENT_DEFS };
