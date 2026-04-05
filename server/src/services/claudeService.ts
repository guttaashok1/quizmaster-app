import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

function loadApiKey(): string {
  // Try environment variable first
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  // Try loading from .env file
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of envPaths) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/ANTHROPIC_API_KEY=(.+)/);
      if (match) return match[1].trim();
    } catch {}
  }
  throw new Error('ANTHROPIC_API_KEY not found');
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: loadApiKey(),
    });
  }
  return _client;
}

// Schemas for each question type
const MCQSchema = z.object({
  type: z.literal('mcq'),
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().min(0).max(3),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

const TrueFalseSchema = z.object({
  type: z.literal('true_false'),
  question: z.string(),
  correctAnswer: z.boolean(),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

const FillBlankSchema = z.object({
  type: z.literal('fill_blank'),
  question: z.string(),
  correctAnswer: z.string(),
  acceptableAnswers: z.array(z.string()),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

const MatchingSchema = z.object({
  type: z.literal('matching'),
  question: z.string(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(3).max(5),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

const QuestionSchema = z.discriminatedUnion('type', [
  MCQSchema,
  TrueFalseSchema,
  FillBlankSchema,
  MatchingSchema,
]);

const QuestionsArraySchema = z.array(QuestionSchema);

const SYSTEM_PROMPT = `You are a quiz question generator for an educational gaming app. You generate varied question types on any topic.

CRITICAL: Return ONLY a valid JSON array. No markdown, no code fences, no extra text.

You can generate these question types:

1. MCQ (type: "mcq"):
   { "type": "mcq", "question": "...", "options": ["A","B","C","D"], "correctIndex": 0-3, "explanation": "...", "difficulty": "easy|medium|hard" }

2. True/False (type: "true_false"):
   { "type": "true_false", "question": "... (a statement)", "correctAnswer": true|false, "explanation": "...", "difficulty": "easy|medium|hard" }

3. Fill in the Blank (type: "fill_blank"):
   { "type": "fill_blank", "question": "The _____ is the powerhouse of the cell.", "correctAnswer": "mitochondria", "acceptableAnswers": ["mitochondria", "mitochondrion"], "explanation": "...", "difficulty": "easy|medium|hard" }

4. Matching (type: "matching"):
   { "type": "matching", "question": "Match the countries to their capitals:", "pairs": [{"left":"France","right":"Paris"},{"left":"Japan","right":"Tokyo"},...], "explanation": "...", "difficulty": "easy|medium|hard" }

Rules:
- Questions should test genuine understanding, not obscure trivia
- For MCQ: wrong options must be plausible. Never use "all/none of the above"
- For True/False: mix true and false answers roughly equally
- For Fill Blank: use _____ for the blank. Keep acceptable answers reasonable
- For Matching: use 3-5 pairs. Pairs should be clearly related
- Each question must be self-contained
- Explanations should be educational and concise
- Vary the position of correct answers across MCQ questions`;

function buildUserPrompt(
  topic: string,
  count: number,
  difficulty: string,
  questionTypes: string[] = ['mcq', 'true_false', 'fill_blank', 'matching'],
  sourceContent?: string
): string {
  const typeInstructions = questionTypes.length === 1
    ? `Generate ONLY "${questionTypes[0]}" type questions.`
    : `Mix these question types roughly equally: ${questionTypes.join(', ')}.`;

  const sourceContext = sourceContent
    ? `\n\nBase the questions on this content:\n"""\n${sourceContent.slice(0, 6000)}\n"""`
    : '';

  return `Generate ${count} questions about "${topic}" at ${difficulty} difficulty level.

${typeInstructions}${sourceContext}

Return ONLY a JSON array of question objects. No other text.`;
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch {} }
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch {} }
  throw new Error('Could not extract valid JSON from response');
}

export async function generateQuestions(
  topic: string,
  count: number,
  difficulty: string,
  questionTypes?: string[],
  sourceContent?: string
): Promise<(z.infer<typeof QuestionSchema> & { id: string })[]> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(topic, count, difficulty, questionTypes, sourceContent),
      },
    ],
  });

  const responseText =
    message.content[0].type === 'text' ? message.content[0].text : '';

  const parsed = extractJSON(responseText);
  const validated = QuestionsArraySchema.parse(parsed);

  return validated.map((q, i) => ({
    ...q,
    id: `q_${Date.now().toString(36)}_${i}`,
  }));
}

// AI Tutor - deeper explanations
export async function askTutor(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  topic: string,
  explanation: string
): Promise<{ deepExplanation: string; relatedConcepts: string[]; followUpQuestion?: string }> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a friendly, encouraging tutor helping a student learn about ${topic}.
Explain concepts clearly and simply. Be supportive even when they got the answer wrong.
Return ONLY valid JSON with no extra text.`,
    messages: [
      {
        role: 'user',
        content: `The student was asked: "${question}"
Their answer: "${userAnswer}"
Correct answer: "${correctAnswer}"
Brief explanation: "${explanation}"

Provide a deeper explanation. Return JSON:
{
  "deepExplanation": "2-3 paragraphs explaining the concept in depth, why the correct answer is right, and if applicable why their answer was wrong",
  "relatedConcepts": ["concept1", "concept2", "concept3"],
  "followUpQuestion": "An optional follow-up question to test their understanding"
}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === 'text' ? message.content[0].text : '';

  const parsed = extractJSON(responseText) as any;
  return {
    deepExplanation: parsed.deepExplanation || 'No explanation available.',
    relatedConcepts: parsed.relatedConcepts || [],
    followUpQuestion: parsed.followUpQuestion,
  };
}

// Fetch content from URL for quiz generation
export async function summarizeUrlContent(url: string): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Visit this URL and summarize its key educational content that could be used to generate quiz questions. URL: ${url}

If you cannot access the URL, provide a brief note. Return the summary as plain text.`,
      },
    ],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}
