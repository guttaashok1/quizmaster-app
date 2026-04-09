import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeaderboardEntry } from '../types/user';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  addEntry: (entry: Omit<LeaderboardEntry, 'id' | 'updatedAt'>) => void;
  updateEntry: (username: string, score: number, streak: number) => void;
  getTopEntries: (limit?: number) => LeaderboardEntry[];
}

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry) => {
        const newEntry: LeaderboardEntry = {
          ...entry,
          id: Date.now().toString(36),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          entries: [...state.entries, newEntry].sort(
            (a, b) => b.score - a.score
          ),
        }));
      },

      updateEntry: (username, score, streak) => {
        set((state) => {
          const existing = state.entries.find(
            (e) => e.username === username
          );
          if (existing) {
            return {
              entries: state.entries
                .map((e) =>
                  e.username === username
                    ? {
                        ...e,
                        score,
                        streak,
                        gamesPlayed: e.gamesPlayed + 1,
                        updatedAt: new Date().toISOString(),
                      }
                    : e
                )
                .sort((a, b) => b.score - a.score),
            };
          }
          return {
            entries: [
              ...state.entries,
              {
                id: Date.now().toString(36),
                username,
                score,
                streak,
                gamesPlayed: 1,
                updatedAt: new Date().toISOString(),
              },
            ].sort((a, b) => b.score - a.score),
          };
        });
      },

      getTopEntries: (limit = 20) => {
        return get().entries.slice(0, limit);
      },
    }),
    {
      name: 'leaderboard-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
