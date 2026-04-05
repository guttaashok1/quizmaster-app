import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateQuestions, askTutor } from '../services/claudeService';

const router = Router();

const GenerateRequestSchema = z.object({
  topic: z.string().min(1).max(200),
  count: z.number().int().min(5).max(20).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
  questionTypes: z.array(z.enum(['mcq', 'true_false', 'fill_blank', 'matching'])).optional(),
  sourceContent: z.string().max(10000).optional(),
});

const TutorRequestSchema = z.object({
  question: z.string(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  topic: z.string(),
  explanation: z.string(),
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const body = GenerateRequestSchema.parse(req.body);

    const questions = await generateQuestions(
      body.topic,
      body.count,
      body.difficulty,
      body.questionTypes,
      body.sourceContent
    );

    res.json({
      questions,
      metadata: {
        topic: body.topic,
        generatedAt: new Date().toISOString(),
        model: 'claude-sonnet-4-20250514',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid request',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      });
      return;
    }

    console.error('Quiz generation error:', error);
    res.status(500).json({
      message: 'Failed to generate quiz questions',
      code: 'GENERATION_ERROR',
    });
  }
});

router.post('/tutor', async (req: Request, res: Response) => {
  try {
    const body = TutorRequestSchema.parse(req.body);

    const result = await askTutor(
      body.question,
      body.userAnswer,
      body.correctAnswer,
      body.topic,
      body.explanation
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid request', code: 'VALIDATION_ERROR' });
      return;
    }

    console.error('Tutor error:', error);
    res.status(500).json({ message: 'Failed to get tutor response', code: 'TUTOR_ERROR' });
  }
});

export default router;
