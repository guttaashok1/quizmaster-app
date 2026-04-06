import { Router, Request, Response } from 'express';
import {
  createChallenge as dbCreateChallenge,
  getChallenge as dbGetChallenge,
  addChallengerResult,
  joinChallenge as dbJoinChallenge,
  startChallenge as dbStartChallenge,
  getChallengeStatus as dbGetChallengeStatus,
  getPublicChallenges as dbGetPublicChallenges,
  getMyChallenges as dbGetMyChallenges,
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
    const { topic, difficulty, questions, creatorName, creatorScore, visibility } = req.body;

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
      visibility: visibility || 'private',
    });

    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Challenge creation error:', errMsg);
    res.status(500).json({ message: 'Failed to create challenge', code: 'CHALLENGE_ERROR' });
  }
});

// List public waiting challenges
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const challenges = await dbGetPublicChallenges();
    res.json(challenges);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Public challenges error:', errMsg);
    res.status(500).json({ message: 'Failed to get public challenges', code: 'SERVER_ERROR' });
  }
});

// List my challenges
router.get('/mine/:username', async (req: Request, res: Response) => {
  try {
    const challenges = await dbGetMyChallenges(req.params.username);
    res.json(challenges);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('My challenges error:', errMsg);
    res.status(500).json({ message: 'Failed to get challenges', code: 'SERVER_ERROR' });
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

// Join a challenge lobby
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ message: 'Name is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const challenge = await dbJoinChallenge(req.params.id, name);
    if (!challenge) {
      res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Join challenge error:', errMsg);
    res.status(500).json({ message: 'Failed to join challenge', code: 'SERVER_ERROR' });
  }
});

// Start a challenge (host only)
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const challenge = await dbStartChallenge(req.params.id);
    if (!challenge) {
      res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(challenge);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Start challenge error:', errMsg);
    res.status(500).json({ message: 'Failed to start challenge', code: 'SERVER_ERROR' });
  }
});

// Get challenge status (lightweight, for polling)
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await dbGetChallengeStatus(req.params.id);
    if (!status) {
      res.status(404).json({ message: 'Challenge not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(status);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Challenge status error:', errMsg);
    res.status(500).json({ message: 'Failed to get status', code: 'SERVER_ERROR' });
  }
});

export default router;
