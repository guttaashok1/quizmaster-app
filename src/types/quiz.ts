export type Difficulty = 'easy' | 'medium' | 'hard';

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'matching';

export interface MCQQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty;
}

export interface TrueFalseQuestion {
  id: string;
  type: 'true_false';
  question: string;
  correctAnswer: boolean;
  explanation: string;
  difficulty: Difficulty;
}

export interface FillBlankQuestion {
  id: string;
  type: 'fill_blank';
  question: string; // contains _____ for the blank
  correctAnswer: string;
  acceptableAnswers: string[]; // alternate spellings/forms
  explanation: string;
  difficulty: Difficulty;
}

export interface MatchingQuestion {
  id: string;
  type: 'matching';
  question: string;
  pairs: { left: string; right: string }[];
  explanation: string;
  difficulty: Difficulty;
}

export type Question = MCQQuestion | TrueFalseQuestion | FillBlankQuestion | MatchingQuestion;

export interface Answer {
  questionId: string;
  questionType: QuestionType;
  selectedIndex: number;       // for MCQ
  selectedBool?: boolean;      // for true/false
  textAnswer?: string;         // for fill-blank
  matchingOrder?: number[];    // for matching
  correct: boolean;
  timeSpent: number;
  pointsEarned: number;
}

export type QuizStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';

export type ContentSource = 'prompt' | 'url' | 'text' | 'pdf';

export interface QuizSession {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: Question[];
  currentIndex: number;
  score: number;
  lives: number;
  timeRemaining: number;
  answers: Answer[];
  status: QuizStatus;
  consecutiveCorrect: number;
  startedAt: string;
  adaptiveDifficulty: boolean;
  currentAdaptiveDifficulty: Difficulty;
}

export interface QuizResult {
  sessionId: string;
  topic: string;
  difficulty: Difficulty;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeTaken: number;
  streakBonus: number;
  stars: 1 | 2 | 3;
}

// Spaced repetition
export interface ReviewCard {
  questionId: string;
  question: Question;
  topic: string;
  nextReviewDate: string;
  interval: number;      // days
  easeFactor: number;    // SM-2 ease factor
  repetitions: number;
  lastReviewDate: string;
  lastResult: 'correct' | 'wrong';
}

// Challenge / Multiplayer
export interface Challenge {
  id: string;
  topic: string;
  difficulty: Difficulty;
  questions: Question[];
  creatorName: string;
  creatorScore: number;
  createdAt: string;
}

// Daily challenge
export interface DailyChallenge {
  date: string;
  topic: string;
  completed: boolean;
  score: number;
  questions: Question[];
}
