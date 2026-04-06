import { Router, Request, Response } from 'express';
import {
  createChallenge as dbCreateChallenge,
  getChallenge as dbGetChallenge,
  addChallengerResult,
} from '../services/database';

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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { topic, difficulty, questions, creatorName, creatorScore } = req.body;

    if (!topic || !difficulty || !questions || !creatorName || creatorScore == null) {
      res.status(400).json({ message: 'Missing required fields', code: 'VALIDATION_ERROR' });
      return;
    }

    const id = generateId();
    const challenge = await dbCreateChallenge({
      id,
      topic,
      difficulty,
      questions,
      creatorName,
      creatorScore,
      challengers: [],
      createdAt: new Date().toISOString(),
    });

    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Challenge creation error:', errMsg);
    res.status(500).json({ message: 'Failed to create challenge', code: 'CHALLENGE_ERROR' });
  }
});

// Get challenge by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const challenge = await dbGetChallenge(req.params.id);
    if (!challenge) {
      res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Get challenge error:', errMsg);
    res.status(500).json({ message: 'Failed to get challenge', code: 'SERVER_ERROR' });
  }
});

// Add challenger result
router.post('/:id/result', async (req: Request, res: Response) => {
  try {
    const { name, score } = req.body;
    if (!name || score == null) {
      res.status(400).json({ message: 'Missing name or score', code: 'VALIDATION_ERROR' });
      return;
    }

    const challenge = await addChallengerResult(req.params.id, name, score);
    if (!challenge) {
      res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Challenge result error:', errMsg);
    res.status(500).json({ message: 'Failed to add result', code: 'SERVER_ERROR' });
  }
});

export default router;
