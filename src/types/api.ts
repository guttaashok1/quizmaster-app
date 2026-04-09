import { Difficulty, Question, QuestionType, ContentSource } from './quiz';

export interface GenerateQuizRequest {
  topic: string;
  count: number;
  difficulty: Difficulty;
  questionTypes?: QuestionType[];
  contentSource?: ContentSource;
  sourceContent?: string; // URL, pasted text, or extracted PDF text
}

export interface GenerateQuizResponse {
  questions: Question[];
  metadata: {
    topic: string;
    generatedAt: string;
    model: string;
  };
}

export interface AskTutorRequest {
  question: string;
  userAnswer: string;
  correctAnswer: string;
  topic: string;
  explanation: string;
}

export interface AskTutorResponse {
  deepExplanation: string;
  relatedConcepts: string[];
  followUpQuestion?: string;
}

export interface ApiError {
  message: string;
  code: string;
}
