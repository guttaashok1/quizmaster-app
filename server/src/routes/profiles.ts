/**
 * Job Profiles — CRUD endpoints for saving Resume + JD + Supporting Docs
 * Auth: JWT Bearer (same pattern as interviewAuth.ts)
 * Storage: data/profiles.json keyed by userId
 */
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ic-dev-secret-change-in-prod';
const DATA_DIR = path.resolve(__dirname, '../../data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const MAX_PROFILES_PER_USER = 20;

// ── Types ──────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  userId: string;
  name: string;
  resumeText: string;
  jobDescription: string;
  supportingDocs: Array<{ name: string; text: string }>;
  createdAt: string;
  updatedAt: string;
}

type ProfileStore = Record<string, Profile[]>;

// ── File I/O helpers ───────────────────────────────────────────────────────
function readStore(): ProfileStore {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(PROFILES_FILE)) return {};
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    return JSON.parse(raw) as ProfileStore;
  } catch {
    return {};
  }
}

function writeStore(store: ProfileStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ── Auth helper ────────────────────────────────────────────────────────────
function getUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as jwt.JwtPayload;
    return payload.username as string ?? null;
  } catch {
    return null;
  }
}

// ── Zod schemas ────────────────────────────────────────────────────────────
const supportingDocSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().max(500_000),
});

const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  resumeText: z.string().max(500_000).default(''),
  jobDescription: z.string().max(500_000).default(''),
  supportingDocs: z.array(supportingDocSchema).max(20).default([]),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  resumeText: z.string().max(500_000).optional(),
  jobDescription: z.string().max(500_000).optional(),
  supportingDocs: z.array(supportingDocSchema).max(20).optional(),
});

// ── GET /api/profiles ──────────────────────────────────────────────────────
// Returns lightweight summary list (no full text blobs)
router.get('/', (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const store = readStore();
  const profiles = (store[userId] ?? []).map(p => ({
    id: p.id,
    name: p.name,
    hasResume: p.resumeText.length > 0,
    hasJD: p.jobDescription.length > 0,
    docsCount: p.supportingDocs.length,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  res.json({ profiles });
});

// ── GET /api/profiles/:id ──────────────────────────────────────────────────
// Returns full profile data for loading
router.get('/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const store = readStore();
  const profile = (store[userId] ?? []).find(p => p.id === req.params.id);
  if (!profile) return void res.status(404).json({ error: 'Profile not found' });

  res.json({ profile });
});

// ── POST /api/profiles ─────────────────────────────────────────────────────
// Create a new profile (max 20 per user)
router.post('/', (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const parsed = createProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
  }

  const store = readStore();
  const userProfiles = store[userId] ?? [];

  if (userProfiles.length >= MAX_PROFILES_PER_USER) {
    return void res.status(400).json({
      error: `Maximum ${MAX_PROFILES_PER_USER} profiles reached. Delete one first.`,
      message: `Maximum ${MAX_PROFILES_PER_USER} profiles reached. Delete one first.`,
    });
  }

  const now = new Date().toISOString();
  const profile: Profile = {
    id: crypto.randomUUID(),
    userId,
    name: parsed.data.name,
    resumeText: parsed.data.resumeText,
    jobDescription: parsed.data.jobDescription,
    supportingDocs: parsed.data.supportingDocs,
    createdAt: now,
    updatedAt: now,
  };

  store[userId] = [...userProfiles, profile];
  writeStore(store);

  res.status(201).json({ profile: { id: profile.id, name: profile.name, createdAt: profile.createdAt } });
});

// ── PUT /api/profiles/:id ──────────────────────────────────────────────────
// Update an existing profile
router.put('/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
  }

  const store = readStore();
  const userProfiles = store[userId] ?? [];
  const idx = userProfiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return void res.status(404).json({ error: 'Profile not found' });

  const existing = userProfiles[idx];
  userProfiles[idx] = {
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  store[userId] = userProfiles;
  writeStore(store);

  res.json({ ok: true });
});

// ── DELETE /api/profiles/:id ───────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const store = readStore();
  const userProfiles = store[userId] ?? [];
  const filtered = userProfiles.filter(p => p.id !== req.params.id);

  if (filtered.length === userProfiles.length) {
    return void res.status(404).json({ error: 'Profile not found' });
  }

  store[userId] = filtered;
  writeStore(store);

  res.json({ ok: true });
});

export default router;
