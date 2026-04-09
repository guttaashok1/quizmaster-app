import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Challenge, DailyChallenge, Question } from '../types/quiz';
import { getToday } from '../utils/dateUtils';
import { DAILY_CHALLENGE_QUESTIONS } from '../constants/game';

interface ChallengeState {
  challenges: Challenge[];
  dailyChallenge: DailyChallenge | null;
  savedDecks: { id: string; topic: string; questions: Question[]; createdAt: string }[];

  createChallenge: (topic: string, difficulty: string, questions: Question[], creatorName: string, creatorScore: number) => Challenge;
  getChallenge: (id: string) => Challenge | undefined;
  setDailyChallenge: (topic: string, questions: Question[]) => void;
  completeDailyChallenge: (score: number) => void;
  isDailyChallengeCompleted: () => boolean;
  saveDeck: (topic: string, questions: Question[]) => string;
  getSavedDecks: () => typeof ChallengeState.prototype.savedDecks;
  removeDeck: (id: string) => void;
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      challenges: [],
      dailyChallenge: null,
      savedDecks: [],

      createChallenge: (topic, difficulty, questions, creatorName, creatorScore) => {
        const challenge: Challenge = {
          id: `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          topic,
          difficulty: difficulty as any,
          questions,
          creatorName,
          creatorScore,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          challenges: [challenge, ...state.challenges].slice(0, 50),
        }));
        return challenge;
      },

      getChallenge: (id) => get().challenges.find((c) => c.id === id),

      setDailyChallenge: (topic, questions) => {
        set({
          dailyChallenge: {
            date: getToday(),
            topic,
            completed: false,
            score: 0,
            questions: questions.slice(0, DAILY_CHALLENGE_QUESTIONS),
          },
        });
      },

      completeDailyChallenge: (score) => {
        const dc = get().dailyChallenge;
        if (dc) {
          set({ dailyChallenge: { ...dc, completed: true, score } });
        }
      },

      isDailyChallengeCompleted: () => {
        const dc = get().dailyChallenge;
        return dc?.date === getToday() && dc?.completed === true;
      },

      saveDeck: (topic, questions) => {
        const id = `deck_${Date.now().toString(36)}`;
        set((state) => ({
          savedDecks: [
            { id, topic, questions, createdAt: new Date().toISOString() },
            ...state.savedDecks,
          ].slice(0, 30),
        }));
        return id;
      },

      getSavedDecks: () => get().savedDecks,

      removeDeck: (id) => {
        set((state) => ({
          savedDecks: state.savedDecks.filter((d) => d.id !== id),
        }));
      },
    }),
    {
      name: 'challenge-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
