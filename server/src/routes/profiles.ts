/**
 * Job Profiles — CRUD API backed by PostgreSQL.
 *
 * Requires DATABASE_URL env var (any Postgres provider works: Neon, Supabase, Railway…).
 * Returns HTTP 503 { code: 'NO_DATABASE' } when DATABASE_URL is absent so the client
 * can fall back to localStorage and show a setup banner.
 *
 * Auth: JWT Bearer (same secret as interviewAuth.ts)
 */
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ic-dev-secret-change-in-prod';
const MAX_PROFILES = 20;

// ── Postgres pool (lazy — only created when DATABASE_URL is present) ──────────
let _pool: Pool | null = null;
let _tableReady = false;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // works for Neon, Supabase, Railway, Render
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

async function ensureTable(pool: Pool): Promise<void> {
  if (_tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_profiles (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     VARCHAR(100) NOT NULL,
      name        VARCHAR(100) NOT NULL,
      resume_text TEXT         NOT NULL DEFAULT '',
      job_desc    TEXT         NOT NULL DEFAULT '',
      docs        JSONB        NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ic_profiles_user
    ON interview_profiles(user_id, updated_at DESC)
  `);
  _tableReady = true;
}

// ── Auth helper ───────────────────────────────────────────────────────────────
function getUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as jwt.JwtPayload;
    return (payload.username as string) ?? null;
  } catch {
    return null;
  }
}

// ── Zod schemas ───────────────────────────────────────────────────────────────
const docSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().max(500_000),
});

const createSchema = z.object({
  name:           z.string().min(1, 'Profile name is required').max(100),
  resumeText:     z.string().max(500_000).default(''),
  jobDescription: z.string().max(500_000).default(''),
  supportingDocs: z.array(docSchema).max(20).default([]),
});

const updateSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  resumeText:     z.string().max(500_000).optional(),
  jobDescription: z.string().max(500_000).optional(),
  supportingDocs: z.array(docSchema).max(20).optional(),
});

// ── Helper: send 503 if no DB ─────────────────────────────────────────────────
function requireDb(res: Response): Pool | null {
  const pool = getPool();
  if (!pool) {
    res.status(503).json({
      error: 'Database not configured — add DATABASE_URL to enable cross-device profiles.',
      code:  'NO_DATABASE',
    });
    return null;
  }
  return pool;
}

// ── GET /api/profiles — list (summary, no large text blobs) ───────────────────
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const pool = requireDb(res);
  if (!pool) return;

  try {
    await ensureTable(pool);
    const result = await pool.query(
      `SELECT id, name,
              (LENGTH(resume_text) > 0)  AS has_resume,
              (LENGTH(job_desc) > 0)     AS has_jd,
              jsonb_array_length(docs)   AS docs_count,
              created_at, updated_at
       FROM   interview_profiles
       WHERE  user_id = $1
       ORDER  BY updated_at DESC
       LIMIT  50`,
      [userId]
    );

    res.json({
      profiles: result.rows.map(r => ({
        id:        r.id,
        name:      r.name,
        hasResume: Boolean(r.has_resume),
        hasJD:     Boolean(r.has_jd),
        docsCount: Number(r.docs_count ?? 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    console.error('GET /api/profiles error:', err);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
});

// ── GET /api/profiles/:id — full profile ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const pool = requireDb(res);
  if (!pool) return;

  try {
    await ensureTable(pool);
    const result = await pool.query(
      `SELECT id, name, resume_text, job_desc, docs, created_at, updated_at
       FROM   interview_profiles
       WHERE  id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return void res.status(404).json({ error: 'Profile not found' });
    }

    const r = result.rows[0];
    res.json({
      profile: {
        id:             r.id,
        name:           r.name,
        resumeText:     r.resume_text,
        jobDescription: r.job_desc,
        supportingDocs: r.docs ?? [],
        createdAt:      r.created_at,
        updatedAt:      r.updated_at,
      },
    });
  } catch (err) {
    console.error('GET /api/profiles/:id error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// ── POST /api/profiles — create ───────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const pool = requireDb(res);
  if (!pool) return;

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
  }

  try {
    await ensureTable(pool);

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM interview_profiles WHERE user_id = $1',
      [userId]
    );
    if (Number(countRes.rows[0].count) >= MAX_PROFILES) {
      return void res.status(400).json({
        error: `You have reached the maximum of ${MAX_PROFILES} profiles. Delete one to create a new one.`,
      });
    }

    const { name, resumeText, jobDescription, supportingDocs } = parsed.data;
    const result = await pool.query(
      `INSERT INTO interview_profiles (user_id, name, resume_text, job_desc, docs)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, created_at`,
      [userId, name, resumeText, jobDescription, JSON.stringify(supportingDocs)]
    );

    const r = result.rows[0];
    res.status(201).json({ profile: { id: r.id, name: r.name, createdAt: r.created_at } });
  } catch (err) {
    console.error('POST /api/profiles error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// ── PUT /api/profiles/:id — update ───────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const pool = requireDb(res);
  if (!pool) return;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' });
  }

  try {
    await ensureTable(pool);

    const existing = await pool.query(
      'SELECT id FROM interview_profiles WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (existing.rows.length === 0) {
      return void res.status(404).json({ error: 'Profile not found' });
    }

    const sets: string[] = ['updated_at = NOW()'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
    let idx = 1;

    const d = parsed.data;
    if (d.name           !== undefined) { sets.push(`name = $${idx++}`);        values.push(d.name); }
    if (d.resumeText     !== undefined) { sets.push(`resume_text = $${idx++}`); values.push(d.resumeText); }
    if (d.jobDescription !== undefined) { sets.push(`job_desc = $${idx++}`);    values.push(d.jobDescription); }
    if (d.supportingDocs !== undefined) { sets.push(`docs = $${idx++}`);        values.push(JSON.stringify(d.supportingDocs)); }

    values.push(req.params.id, userId);
    await pool.query(
      `UPDATE interview_profiles SET ${sets.join(', ')}
       WHERE id = $${idx} AND user_id = $${idx + 1}`,
      values
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/profiles/:id error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ── DELETE /api/profiles/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return void res.status(401).json({ error: 'Unauthorized' });

  const pool = requireDb(res);
  if (!pool) return;

  try {
    await ensureTable(pool);
    const result = await pool.query(
      'DELETE FROM interview_profiles WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return void res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/profiles/:id error:', err);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
