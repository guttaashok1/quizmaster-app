import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question, Answer, QuizResult, Difficulty } from '../types/quiz';

export interface QuizHistoryEntry {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: Question[];
  answers: Answer[];
  result: QuizResult;
  completedAt: string;
}

interface QuizHistoryState {
  entries: QuizHistoryEntry[];
  saveQuiz: (entry: Omit<QuizHistoryEntry, 'id' | 'completedAt'>) => string;
  getEntry: (id: string) => QuizHistoryEntry | undefined;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

const MAX_HISTORY = 50;

export const useQuizHistoryStore = create<QuizHistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      saveQuiz: (entry) => {
        const id = `hist_${Date.now().toString(36)}`;
        const full: QuizHistoryEntry = {
          ...entry,
          id,
          completedAt: new Date().toISOString(),
        };
        set((state) => ({
          entries: [full, ...state.entries].slice(0, MAX_HISTORY),
        }));
        return id;
      },

      getEntry: (id) => get().entries.find((e) => e.id === id),

      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),

      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'quiz-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
