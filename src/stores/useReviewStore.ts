import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question, ReviewCard } from '../types/quiz';
import { SM2_INITIAL_INTERVAL, SM2_INITIAL_EASE, SM2_MIN_EASE } from '../constants/game';
import { getToday } from '../utils/dateUtils';

interface ReviewState {
  cards: ReviewCard[];
  addWrongAnswer: (question: Question, topic: string) => void;
  reviewCard: (questionId: string, correct: boolean) => void;
  getDueCards: () => ReviewCard[];
  getDueCount: () => number;
  removeCard: (questionId: string) => void;
}

function calculateNextReview(
  card: ReviewCard,
  correct: boolean
): Partial<ReviewCard> {
  let { interval, easeFactor, repetitions } = card;

  if (correct) {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(SM2_MIN_EASE, easeFactor + 0.1);
  } else {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(SM2_MIN_EASE, easeFactor - 0.2);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    interval,
    easeFactor,
    repetitions,
    lastReviewDate: getToday(),
    nextReviewDate: nextDate.toISOString().split('T')[0],
    lastResult: correct ? 'correct' : 'wrong',
  };
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      cards: [],

      addWrongAnswer: (question, topic) => {
        const existing = get().cards.find((c) => c.questionId === question.id);
        if (existing) return;

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + SM2_INITIAL_INTERVAL);

        const card: ReviewCard = {
          questionId: question.id,
          question,
          topic,
          nextReviewDate: nextDate.toISOString().split('T')[0],
          interval: SM2_INITIAL_INTERVAL,
          easeFactor: SM2_INITIAL_EASE,
          repetitions: 0,
          lastReviewDate: getToday(),
          lastResult: 'wrong',
        };

        set((state) => ({ cards: [...state.cards, card] }));
      },

      reviewCard: (questionId, correct) => {
        set((state) => ({
          cards: state.cards.map((card) => {
            if (card.questionId !== questionId) return card;
            return { ...card, ...calculateNextReview(card, correct) };
          }),
        }));
      },

      getDueCards: () => {
        const today = getToday();
        return get().cards.filter((c) => c.nextReviewDate <= today);
      },

      getDueCount: () => {
        const today = getToday();
        return get().cards.filter((c) => c.nextReviewDate <= today).length;
      },

      removeCard: (questionId) => {
        set((state) => ({
          cards: state.cards.filter((c) => c.questionId !== questionId),
        }));
      },
    }),
    {
      name: 'review-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
