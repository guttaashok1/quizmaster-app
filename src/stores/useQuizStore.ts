import { create } from 'zustand';
import {
  Question,
  Answer,
  Difficulty,
  QuizStatus,
  QuizResult,
  MCQQuestion,
  TrueFalseQuestion,
  FillBlankQuestion,
  MatchingQuestion,
} from '../types/quiz';
import {
  TIME_PER_QUESTION,
  ADAPTIVE_UPGRADE_THRESHOLD,
  ADAPTIVE_DOWNGRADE_THRESHOLD,
  POINTS_WRONG,
} from '../constants/game';
import { calculatePoints, calculateStars } from '../utils/scoring';

interface QuizState {
  questions: Question[];
  currentIndex: number;
  score: number;
  timeRemaining: number;
  answers: Answer[];
  status: QuizStatus;
  difficulty: Difficulty;
  topic: string;
  sessionId: string;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  showExplanation: boolean;
  lastAnswerCorrect: boolean | null;
  adaptiveDifficulty: boolean;
  currentAdaptiveDifficulty: Difficulty;
  customTimePerQuestion: number | null;
  challengeId: string | null;

  startQuiz: (questions: Question[], topic: string, difficulty: Difficulty, adaptive?: boolean, customTime?: number | null, challengeId?: string | null) => void;
  answerQuestion: (answer: Partial<Answer>) => void;
  nextQuestion: () => void;
  tickTimer: () => boolean;
  timeUp: () => void;
  dismissExplanation: () => void;
  getResult: () => QuizResult;
  resetQuiz: () => void;
}

function isCorrect(question: Question, answer: Partial<Answer>): boolean {
  switch (question.type) {
    case 'mcq':
      return answer.selectedIndex === (question as MCQQuestion).correctIndex;
    case 'true_false':
      return answer.selectedBool === (question as TrueFalseQuestion).correctAnswer;
    case 'fill_blank': {
      const fb = question as FillBlankQuestion;
      const userText = (answer.textAnswer || '').trim().toLowerCase();
      return (
        userText === fb.correctAnswer.toLowerCase() ||
        fb.acceptableAnswers.some((a) => a.toLowerCase() === userText)
      );
    }
    case 'matching': {
      const mq = question as MatchingQuestion;
      const order = answer.matchingOrder || [];
      return order.every((val, idx) => val === idx);
    }
    default:
      return false;
  }
}

function getAdaptiveDifficulty(
  current: Difficulty,
  consecutiveCorrect: number,
  consecutiveWrong: number
): Difficulty {
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];
  const idx = levels.indexOf(current);

  if (consecutiveCorrect >= ADAPTIVE_UPGRADE_THRESHOLD && idx < 2) {
    return levels[idx + 1];
  }
  if (consecutiveWrong >= ADAPTIVE_DOWNGRADE_THRESHOLD && idx > 0) {
    return levels[idx - 1];
  }
  return current;
}

export const useQuizStore = create<QuizState>()((set, get) => ({
  questions: [],
  currentIndex: 0,
  score: 0,
  timeRemaining: 0,
  answers: [],
  status: 'idle',
  difficulty: 'easy',
  topic: '',
  sessionId: '',
  consecutiveCorrect: 0,
  consecutiveWrong: 0,
  showExplanation: false,
  lastAnswerCorrect: null,
  adaptiveDifficulty: false,
  currentAdaptiveDifficulty: 'easy',
  challengeId: null,
  customTimePerQuestion: null,

  startQuiz: (questions, topic, difficulty, adaptive = true, customTime = null, challengeId = null) => {
    const timeForQuestion = customTime ?? TIME_PER_QUESTION[difficulty];
    set({
      questions,
      topic,
      difficulty,
      currentIndex: 0,
      score: 0,
      timeRemaining: timeForQuestion,
      answers: [],
      status: 'playing',
      sessionId: Date.now().toString(36),
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      showExplanation: false,
      lastAnswerCorrect: null,
      adaptiveDifficulty: adaptive,
      currentAdaptiveDifficulty: difficulty,
      customTimePerQuestion: customTime,
      challengeId: challengeId,
    });
  },

  answerQuestion: (answerData) => {
    const state = get();
    if (state.status !== 'playing') return;

    const question = state.questions[state.currentIndex];
    const correct = isCorrect(question, answerData);
    const effectiveTime = state.customTimePerQuestion ?? TIME_PER_QUESTION[state.currentAdaptiveDifficulty];
    const timeSpent = effectiveTime - state.timeRemaining;

    let pointsEarned = 0;
    let newConsecutiveCorrect = state.consecutiveCorrect;
    let newConsecutiveWrong = state.consecutiveWrong;

    if (correct) {
      pointsEarned = calculatePoints(
        state.timeRemaining,
        state.currentAdaptiveDifficulty,
        state.consecutiveCorrect
      );
      newConsecutiveCorrect += 1;
      newConsecutiveWrong = 0;
    } else {
      pointsEarned = POINTS_WRONG;
      newConsecutiveCorrect = 0;
      newConsecutiveWrong += 1;
    }

    // Adaptive difficulty
    let newAdaptiveDifficulty = state.currentAdaptiveDifficulty;
    if (state.adaptiveDifficulty) {
      newAdaptiveDifficulty = getAdaptiveDifficulty(
        state.currentAdaptiveDifficulty,
        correct ? newConsecutiveCorrect : 0,
        correct ? 0 : newConsecutiveWrong
      );
    }

    const answer: Answer = {
      questionId: question.id,
      questionType: question.type,
      selectedIndex: answerData.selectedIndex ?? -1,
      selectedBool: answerData.selectedBool,
      textAnswer: answerData.textAnswer,
      matchingOrder: answerData.matchingOrder,
      correct,
      timeSpent,
      pointsEarned,
    };

    const isFinished = state.currentIndex >= state.questions.length - 1;

    set({
      score: state.score + pointsEarned,
      consecutiveCorrect: newConsecutiveCorrect,
      consecutiveWrong: newConsecutiveWrong,
      currentAdaptiveDifficulty: newAdaptiveDifficulty,
      answers: [...state.answers, answer],
      showExplanation: true,
      lastAnswerCorrect: correct,
      status: isFinished ? 'finished' : 'playing',
    });
  },

  nextQuestion: () => {
    const state = get();
    if (state.status === 'finished') return;

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.questions.length) {
      set({ status: 'finished', showExplanation: false });
      return;
    }

    set({
      currentIndex: nextIndex,
      timeRemaining: state.customTimePerQuestion ?? TIME_PER_QUESTION[state.currentAdaptiveDifficulty],
      showExplanation: false,
      lastAnswerCorrect: null,
    });
  },

  tickTimer: () => {
    const state = get();
    if (state.status !== 'playing' || state.showExplanation) return false;

    const newTime = state.timeRemaining - 1;
    if (newTime <= 0) {
      get().timeUp();
      return true;
    }
    set({ timeRemaining: newTime });
    return false;
  },

  timeUp: () => {
    const state = get();
    const question = state.questions[state.currentIndex];
    const isFinished = state.currentIndex >= state.questions.length - 1;
    const effectiveTime = state.customTimePerQuestion ?? TIME_PER_QUESTION[state.currentAdaptiveDifficulty];

    const answer: Answer = {
      questionId: question.id,
      questionType: question.type,
      selectedIndex: -1,
      correct: false,
      timeSpent: effectiveTime,
      pointsEarned: POINTS_WRONG,
    };

    set({
      consecutiveCorrect: 0,
      consecutiveWrong: state.consecutiveWrong + 1,
      answers: [...state.answers, answer],
      showExplanation: true,
      lastAnswerCorrect: false,
      status: isFinished ? 'finished' : 'playing',
      timeRemaining: 0,
    });
  },

  dismissExplanation: () => set({ showExplanation: false }),

  getResult: (): QuizResult => {
    const state = get();
    const correctCount = state.answers.filter((a) => a.correct).length;
    const totalTime = state.answers.reduce((sum, a) => sum + a.timeSpent, 0);
    const streakBonus = 0;

    return {
      sessionId: state.sessionId,
      topic: state.topic,
      difficulty: state.difficulty,
      totalQuestions: state.questions.length,
      correctAnswers: correctCount,
      score: state.score,
      timeTaken: totalTime,
      streakBonus,
      stars: calculateStars(correctCount, state.questions.length),
    };
  },

  resetQuiz: () =>
    set({
      questions: [],
      currentIndex: 0,
      score: 0,
      timeRemaining: 0,
      answers: [],
      status: 'idle',
      topic: '',
      sessionId: '',
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      showExplanation: false,
      lastAnswerCorrect: null,
      adaptiveDifficulty: false,
      currentAdaptiveDifficulty: 'easy',
      customTimePerQuestion: null,
      challengeId: null,
    }),
}));
