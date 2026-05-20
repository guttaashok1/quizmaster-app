/**
 * Interview Coach — Admin routes
 *
 * All routes (except feedbackRouter) require a valid JWT with role === 'admin'.
 * Pool is created the same way as interviewAuth.ts — DATABASE_URL env var.
 */
import { Router, Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'ic-dev-secret-change-in-prod';
const PBKDF2_ITERS = 100_000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdminPayload extends jwt.JwtPayload {
  username: string;
  email: string;
  role: string;
  plan: string;
}

// Extend Express Request to carry the verified admin payload
declare global {
  namespace Express {
    interface Request {
      adminPayload?: AdminPayload;
    }
  }
}

// ── PostgreSQL pool ───────────────────────────────────────────────────────────
let _pool: Pool | null = null;
let _feedbackTableReady = false;

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}

async function ensureFeedbackTable(pool: Pool): Promise<void> {
  if (_feedbackTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_feedback (
      id         SERIAL       PRIMARY KEY,
      username   VARCHAR(50),
      type       VARCHAR(50)  NOT NULL DEFAULT 'general',
      message    TEXT         NOT NULL,
      page       VARCHAR(200),
      rating     SMALLINT,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      status     VARCHAR(20)  NOT NULL DEFAULT 'new'
    )
  `);
  _feedbackTableReady = true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pbkdf2(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, 'sha256').toString('hex');
}

// ── requireAdmin middleware ───────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    void res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  let payload: AdminPayload;
  try {
    payload = jwt.verify(auth.slice(7), JWT_SECRET) as AdminPayload;
  } catch {
    void res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  if (payload.role !== 'admin') {
    void res.status(403).json({ error: 'Admin access required' });
    return;
  }

  req.adminPayload = payload;
  next();
}

// ── Admin router ──────────────────────────────────────────────────────────────
const router = Router();

// Apply admin middleware to all routes on this router
router.use(requireAdmin);

// ── GET /users ────────────────────────────────────────────────────────────────
router.get('/users', async (_req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    // Aggregate total questions per user
    const totalsResult = await pool.query<{ username: string; total: string }>(
      `SELECT username, SUM(count) AS total FROM interview_questions_used GROUP BY username`
    );
    const totalsMap = new Map<string, number>();
    for (const row of totalsResult.rows) {
      totalsMap.set(row.username, Number(row.total));
    }

    // Main user query with today's count
    const usersResult = await pool.query(
      `SELECT u.username, u.email, u.role, u.plan, u.beta_expires_at,
              u.stripe_customer_id, u.created_at,
              COALESCE(q.count, 0) AS questions_today
       FROM interview_users u
       LEFT JOIN interview_questions_used q
         ON q.username = u.username AND q.date = CURRENT_DATE
       ORDER BY u.created_at DESC`
    );

    const users = usersResult.rows.map((u) => ({
      username: u.username,
      email: u.email,
      role: u.role,
      plan: u.plan,
      betaExpiresAt: u.beta_expires_at,
      stripeCustomerId: u.stripe_customer_id,
      createdAt: u.created_at,
      questionsToday: Number(u.questions_today),
      questionsTotal: totalsMap.get(u.username) ?? 0,
    }));

    res.json(users);
  } catch (err) {
    console.error('[admin] GET /users error:', err);
    void res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── POST /users/:username/beta ────────────────────────────────────────────────
router.post('/users/:username/beta', async (req: Request, res: Response) => {
  const { username } = req.params;
  const { days } = req.body as { days?: unknown };

  if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 365) {
    return void res.status(400).json({ error: 'days must be an integer between 1 and 365' });
  }

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(
      `UPDATE interview_users
       SET plan = 'beta', beta_expires_at = NOW() + INTERVAL '${days} days'
       WHERE username = $1
       RETURNING username, email, role, plan, beta_expires_at, stripe_customer_id, created_at`,
      [username]
    );

    if (result.rowCount === 0) {
      return void res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      username: u.username,
      email: u.email,
      role: u.role,
      plan: u.plan,
      betaExpiresAt: u.beta_expires_at,
      stripeCustomerId: u.stripe_customer_id,
      createdAt: u.created_at,
    });
  } catch (err) {
    console.error('[admin] POST /users/:username/beta error:', err);
    void res.status(500).json({ error: 'Failed to grant beta access' });
  }
});

// ── DELETE /users/:username/beta ──────────────────────────────────────────────
router.delete('/users/:username/beta', async (req: Request, res: Response) => {
  const { username } = req.params;

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    const result = await pool.query(
      `UPDATE interview_users
       SET plan = 'free', beta_expires_at = NULL
       WHERE username = $1`,
      [username]
    );

    if (result.rowCount === 0) {
      return void res.status(404).json({ error: 'User not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] DELETE /users/:username/beta error:', err);
    void res.status(500).json({ error: 'Failed to revoke beta access' });
  }
});

// ── POST /users/:username/reset-password ──────────────────────────────────────
router.post('/users/:username/reset-password', async (req: Request, res: Response) => {
  const { username } = req.params;
  const { newPassword } = req.body as { newPassword?: unknown };

  if (typeof newPassword !== 'string' || newPassword.length < 1) {
    return void res.status(400).json({ error: 'newPassword is required' });
  }

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = pbkdf2(newPassword, salt);

    const result = await pool.query(
      `UPDATE interview_users SET password_hash = $1, salt = $2 WHERE username = $3`,
      [hash, salt, username]
    );

    if (result.rowCount === 0) {
      return void res.status(404).json({ error: 'User not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /users/:username/reset-password error:', err);
    void res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── GET /stats ────────────────────────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    await ensureFeedbackTable(pool);

    const [
      totalUsersResult,
      todayActiveResult,
      questionsTodayResult,
      questionsWeekResult,
      newUsersWeekResult,
      openFeedbackResult,
      dailyQuestionsResult,
    ] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM interview_users WHERE role != 'admin'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT username) AS count FROM interview_questions_used WHERE date = CURRENT_DATE`
      ),
      pool.query<{ count: string }>(
        `SELECT COALESCE(SUM(count), 0) AS count FROM interview_questions_used WHERE date = CURRENT_DATE`
      ),
      pool.query<{ count: string }>(
        `SELECT COALESCE(SUM(count), 0) AS count FROM interview_questions_used WHERE date >= CURRENT_DATE - INTERVAL '7 days'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM interview_users WHERE created_at >= NOW() - INTERVAL '7 days' AND role != 'admin'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM interview_feedback WHERE status = 'new'`
      ),
      pool.query<{ date: string; total: string }>(
        `SELECT date, SUM(count) AS total
         FROM interview_questions_used
         WHERE date >= CURRENT_DATE - 13
         GROUP BY date
         ORDER BY date`
      ),
    ]);

    res.json({
      totalUsers: Number(totalUsersResult.rows[0].count),
      todayActive: Number(todayActiveResult.rows[0].count),
      questionsToday: Number(questionsTodayResult.rows[0].count),
      questionsThisWeek: Number(questionsWeekResult.rows[0].count),
      newUsersThisWeek: Number(newUsersWeekResult.rows[0].count),
      openFeedback: Number(openFeedbackResult.rows[0].count),
      dailyQuestions: dailyQuestionsResult.rows.map((r) => ({
        date: r.date,
        total: Number(r.total),
      })),
    });
  } catch (err) {
    console.error('[admin] GET /stats error:', err);
    void res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /feedback ─────────────────────────────────────────────────────────────
router.get('/feedback', async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  const validStatuses = ['new', 'reviewed', 'resolved'];

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    await ensureFeedbackTable(pool);

    let queryText: string;
    let queryParams: string[];

    if (status && status !== 'all' && validStatuses.includes(status)) {
      queryText = `SELECT * FROM interview_feedback WHERE status = $1 ORDER BY created_at DESC LIMIT 200`;
      queryParams = [status];
    } else {
      queryText = `SELECT * FROM interview_feedback ORDER BY created_at DESC LIMIT 200`;
      queryParams = [];
    }

    const result = await pool.query(queryText, queryParams);
    res.json(result.rows);
  } catch (err) {
    console.error('[admin] GET /feedback error:', err);
    void res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// ── PATCH /feedback/:id ───────────────────────────────────────────────────────
router.patch('/feedback/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return void res.status(400).json({ error: 'Invalid feedback id' });

  const { status } = req.body as { status?: unknown };
  const validStatuses = ['new', 'reviewed', 'resolved'];

  if (typeof status !== 'string' || !validStatuses.includes(status)) {
    return void res.status(400).json({ error: "status must be 'new', 'reviewed', or 'resolved'" });
  }

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    await ensureFeedbackTable(pool);

    const result = await pool.query(
      `UPDATE interview_feedback SET status = $1 WHERE id = $2`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return void res.status(404).json({ error: 'Feedback item not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] PATCH /feedback/:id error:', err);
    void res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

// ── Public feedback router ────────────────────────────────────────────────────
const feedbackRouter = Router();

const VALID_FEEDBACK_TYPES = ['bug', 'feature', 'general', 'support'] as const;
type FeedbackType = (typeof VALID_FEEDBACK_TYPES)[number];

feedbackRouter.post('/', async (req: Request, res: Response) => {
  const { type, message, page, rating, username } = req.body as {
    type?: unknown;
    message?: unknown;
    page?: unknown;
    rating?: unknown;
    username?: unknown;
  };

  if (typeof message !== 'string' || message.trim().length < 5) {
    return void res.status(400).json({ error: 'message must be at least 5 characters' });
  }

  if (typeof type !== 'string' || !(VALID_FEEDBACK_TYPES as readonly string[]).includes(type)) {
    return void res.status(400).json({
      error: "type must be one of: 'bug', 'feature', 'general', 'support'",
    });
  }

  const feedbackType = type as FeedbackType;
  const feedbackPage = typeof page === 'string' ? page : null;
  const feedbackRating =
    typeof rating === 'number' && Number.isInteger(rating) ? rating : null;
  const feedbackUsername = typeof username === 'string' && username.trim().length > 0
    ? username.trim()
    : null;

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    await ensureFeedbackTable(pool);

    await pool.query(
      `INSERT INTO interview_feedback (username, type, message, page, rating)
       VALUES ($1, $2, $3, $4, $5)`,
      [feedbackUsername, feedbackType, message.trim(), feedbackPage, feedbackRating]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /feedback error:', err);
    void res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;
export { feedbackRouter };
