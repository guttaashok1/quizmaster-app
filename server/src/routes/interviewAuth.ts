/**
 * Server-side auth for Interview Coach
 * Passwords are hashed server-side with PBKDF2 — never stored in the browser.
 * Sessions are signed JWTs stored in localStorage (token only, no credentials).
 */
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ic-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';
const PBKDF2_ITERS = 100_000;

// ── In-memory user store (persists within a serverless instance) ─────────────
interface IUser {
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro';
  createdAt: string;
  questionsUsed: Record<string, number>; // { 'YYYY-MM-DD': count }
}

const users = new Map<string, IUser>(); // keyed by lowercase username

// Seed admin account on cold start
function seedAdmin() {
  if (users.has('admin')) return;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = pbkdf2Sync('Admin@2026', salt);
  users.set('admin', {
    username: 'admin',
    email: 'admin@interviewcoach.ai',
    passwordHash: hash,
    salt,
    role: 'admin',
    plan: 'pro',
    createdAt: new Date().toISOString(),
    questionsUsed: {},
  });
}
seedAdmin();

// ── Helpers ──────────────────────────────────────────────────────────────────
function pbkdf2Sync(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, 'sha256').toString('hex');
}

function issueToken(user: IUser): string {
  return jwt.sign(
    { username: user.username, email: user.email, role: user.role, plan: user.plan },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token: string): jwt.JwtPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload; }
  catch { return null; }
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

// ── POST /api/interview-auth/register ────────────────────────────────────────
router.post('/register', (req: Request, res: Response) => {
  const { username, email, password } = req.body as Record<string, string>;

  if (!username || username.trim().length < 3)
    return void res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return void res.status(400).json({ error: 'Please enter a valid email address' });
  if (!password || password.length < 8)
    return void res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!/[A-Z]/.test(password))
    return void res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  if (!/[0-9]/.test(password))
    return void res.status(400).json({ error: 'Password must contain at least one number' });

  const key = username.trim().toLowerCase();
  if (users.has(key))
    return void res.status(409).json({ error: 'Username already taken' });
  if ([...users.values()].some(u => u.email === email.trim().toLowerCase()))
    return void res.status(409).json({ error: 'Email already registered' });

  const salt = crypto.randomBytes(16).toString('hex');
  const user: IUser = {
    username: username.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: pbkdf2Sync(password, salt),
    salt,
    role: 'user',
    plan: 'free',
    createdAt: new Date().toISOString(),
    questionsUsed: {},
  };
  users.set(key, user);
  res.json({ token: issueToken(user), username: user.username, role: user.role, plan: user.plan });
});

// ── POST /api/interview-auth/login ───────────────────────────────────────────
router.post('/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body as Record<string, string>;
  if (!identifier || !password)
    return void res.status(400).json({ error: 'Please enter your username and password' });

  const id = identifier.trim().toLowerCase();
  const user = users.get(id) ?? [...users.values()].find(u => u.email === id);
  if (!user)
    return void res.status(401).json({ error: 'Invalid username or password' });

  const hash = pbkdf2Sync(password, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash)))
    return void res.status(401).json({ error: 'Invalid username or password' });

  res.json({ token: issueToken(user), username: user.username, role: user.role, plan: user.plan });
});

// ── GET /api/interview-auth/session ──────────────────────────────────────────
router.get('/session', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return void res.status(401).json({ error: 'No session' });
  const payload = verifyToken(auth.slice(7));
  if (!payload)
    return void res.status(401).json({ error: 'Session expired' });
  res.json({ username: payload.username, role: payload.role, plan: payload.plan });
});

// ── POST /api/interview-auth/question-used ───────────────────────────────────
router.post('/question-used', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return void res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(auth.slice(7));
  if (!payload)
    return void res.status(401).json({ error: 'Session expired' });

  const user = users.get(payload.username.toLowerCase());
  if (!user) return void res.status(404).json({ error: 'User not found' });

  if (user.role !== 'admin' && user.plan !== 'pro') {
    const today = todayKey();
    user.questionsUsed[today] = (user.questionsUsed[today] ?? 0) + 1;
  }

  const today = todayKey();
  const used = user.questionsUsed[today] ?? 0;
  const limit = (user.role === 'admin' || user.plan === 'pro') ? Infinity : 10;
  res.json({ used, remaining: limit === Infinity ? 999 : Math.max(0, limit - used) });
});

// ── GET /api/interview-auth/quota ────────────────────────────────────────────
router.get('/quota', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return void res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(auth.slice(7));
  if (!payload)
    return void res.status(401).json({ error: 'Session expired' });

  const user = users.get(payload.username.toLowerCase());
  const today = todayKey();
  const used = user?.questionsUsed[today] ?? 0;
  const isUnlimited = payload.role === 'admin' || payload.plan === 'pro';
  res.json({ used, remaining: isUnlimited ? 999 : Math.max(0, 10 - used), unlimited: isUnlimited });
});

export default router;
