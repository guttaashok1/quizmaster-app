import { Router, Request, Response } from 'express';
import { createUser, findUser, updateUserScore, getPublicProfile } from '../services/database';

const router = Router();

// Register a new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, avatarEmoji } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      res.status(400).json({ message: 'Username must be at least 2 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      res.status(400).json({ message: 'Password must be at least 4 characters', code: 'VALIDATION_ERROR' });
      return;
    }

    // Check if username already exists
    const existing = await findUser(username);
    if (existing) {
      res.status(409).json({ message: 'Username already taken', code: 'USERNAME_TAKEN' });
      return;
    }

    const user = await createUser(username.trim(), password, avatarEmoji);
    res.json(user);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Registration error:', errMsg);
    res.status(500).json({ message: 'Failed to register user', code: 'SERVER_ERROR' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'Username and password are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const user = await findUser(username);

    if (!user || user.password !== password) {
      res.status(401).json({ message: 'Invalid username or password', code: 'AUTH_ERROR' });
      return;
    }

    res.json({ username: user.username, avatarEmoji: user.avatarEmoji, totalScore: user.totalScore });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Login error:', errMsg);
    res.status(500).json({ message: 'Failed to login', code: 'SERVER_ERROR' });
  }
});

// Update score
router.post('/score', async (req: Request, res: Response) => {
  try {
    const { username, score } = req.body;

    if (!username || score == null) {
      res.status(400).json({ message: 'Username and score are required', code: 'VALIDATION_ERROR' });
      return;
    }

    const user = await updateUserScore(username, score);

    if (!user) {
      res.status(404).json({ message: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(user);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Score update error:', errMsg);
    res.status(500).json({ message: 'Failed to update score', code: 'SERVER_ERROR' });
  }
});

// Get public profile
router.get('/user/:username', async (req: Request, res: Response) => {
  try {
    const user = await getPublicProfile(req.params.username);

    if (!user) {
      res.status(404).json({ message: 'User not found', code: 'NOT_FOUND' });
      return;
    }

    res.json(user);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Profile error:', errMsg);
    res.status(500).json({ message: 'Failed to get profile', code: 'SERVER_ERROR' });
  }
});

export default router;
