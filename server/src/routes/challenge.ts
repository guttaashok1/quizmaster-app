import { Router, Request, Response } from 'express';

interface Challenger {
  name: string;
  score: number;
}

interface Challenge {
  id: string;
  topic: string;
  difficulty: string;
  questions: any[];
  creatorName: string;
  creatorScore: number;
  challengers: Challenger[];
  createdAt: string;
}

const challenges = new Map<string, Challenge>();

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ch_${result}`;
}

const router = Router();

// Create a new challenge
router.post('/', (req: Request, res: Response) => {
  try {
    const { topic, difficulty, questions, creatorName, creatorScore } = req.body;

    if (!topic || !difficulty || !questions || !creatorName || creatorScore == null) {
      res.status(400).json({ message: 'Missing required fields', code: 'VALIDATION_ERROR' });
      return;
    }

    const id = generateId();
    const challenge: Challenge = {
      id,
      topic,
      difficulty,
      questions,
      creatorName,
      creatorScore,
      challengers: [],
      createdAt: new Date().toISOString(),
    };

    challenges.set(id, challenge);

    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Challenge creation error:', errMsg);
    res.status(500).json({ message: 'Failed to create challenge', code: 'CHALLENGE_ERROR' });
  }
});

// Get challenge by ID
router.get('/:id', (req: Request, res: Response) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) {
    res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(challenge);
});

// Add challenger result
router.post('/:id/result', (req: Request, res: Response) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) {
    res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
    return;
  }

  const { name, score } = req.body;
  if (!name || score == null) {
    res.status(400).json({ message: 'Missing name or score', code: 'VALIDATION_ERROR' });
    return;
  }

  challenge.challengers.push({ name, score });
  res.json(challenge);
});

export default router;
