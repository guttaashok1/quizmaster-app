/**
 * Interview Coach — Auth routes
 *
 * Primary store : PostgreSQL (DATABASE_URL env var — Supabase / Neon / Railway)
 * Dev fallback  : in-memory Map (no DATABASE_URL) — data lost on restart
 *
 * Rate limits:
 *   /login           → 10 failures per IP per 15 min
 *   /register        → 8 registrations per IP per hour
 *   /forgot-password → 3 requests per IP per hour
 */
import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import rateLimit from 'express-rate-limit';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET  || 'ic-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';
const PBKDF2_ITERS = 100_000;

if (!process.env.JWT_SECRET) {
  console.warn('[interviewAuth] WARNING: JWT_SECRET env var not set — using insecure default. Set it in production!');
}

// ── Auth-specific rate limiters ───────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,    // 15 min window
  max: 10,                       // 10 failures per window per IP
  skipSuccessfulRequests: true,  // only count failed attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed login attempts — please wait 15 minutes and try again.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,    // 1 hour window
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registrations from this IP — please try again later.' },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests — please wait an hour.' },
});

// ── PostgreSQL pool (lazy) ────────────────────────────────────────────────────
let _pool: Pool | null = null;
let _tableReady = false;

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

async function ensureTables(pool: Pool): Promise<void> {
  if (_tableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_users (
      username               VARCHAR(50)   PRIMARY KEY,
      email                  VARCHAR(200)  UNIQUE NOT NULL,
      password_hash          VARCHAR(200)  NOT NULL,
      salt                   VARCHAR(50)   NOT NULL,
      role                   VARCHAR(20)   NOT NULL DEFAULT 'user',
      plan                   VARCHAR(20)   NOT NULL DEFAULT 'free',
      stripe_customer_id     VARCHAR(100),
      stripe_subscription_id VARCHAR(100),
      beta_expires_at        TIMESTAMPTZ,
      created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);
  // Add beta_expires_at if upgrading an existing DB that didn't have it
  await pool.query(`
    ALTER TABLE interview_users ADD COLUMN IF NOT EXISTS beta_expires_at TIMESTAMPTZ
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_questions_used (
      username  VARCHAR(50)  NOT NULL REFERENCES interview_users(username) ON DELETE CASCADE,
      date      DATE         NOT NULL DEFAULT CURRENT_DATE,
      count     INTEGER      NOT NULL DEFAULT 0,
      PRIMARY KEY (username, date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_reset_tokens (
      token      VARCHAR(100) PRIMARY KEY,
      username   VARCHAR(50)  NOT NULL REFERENCES interview_users(username) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ  NOT NULL,
      used       BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await _seedAdmin(pool);
  _tableReady = true;
}

async function _seedAdmin(pool: Pool): Promise<void> {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    console.warn('[interviewAuth] ADMIN_PASSWORD not set — admin account not created/updated. Set ADMIN_PASSWORD env var.');
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = pbkdf2(adminPass, salt);
  // Upsert: create admin if missing OR update password if ADMIN_PASSWORD changed
  await pool.query(
    `INSERT INTO interview_users (username, email, password_hash, salt, role, plan)
     VALUES ('admin', 'admin@interviewcoach.ai', $1, $2, 'admin', 'pro')
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   salt          = EXCLUDED.salt,
                   role          = 'admin',
                   plan          = 'pro'`,
    [hash, salt]
  );
  console.log('[interviewAuth] Admin account synced from ADMIN_PASSWORD env var');
}

// ── In-memory fallback (local dev without DATABASE_URL) ───────────────────────
interface IUser {
  username: string; email: string; passwordHash: string; salt: string;
  role: 'admin' | 'user'; plan: 'free' | 'pro' | 'beta';
  betaExpiresAt?: string;
  createdAt: string; questionsUsed: Record<string, number>;
}
const memUsers = new Map<string, IUser>();

function _memSeedAdmin() {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || memUsers.has('admin')) return;
  const salt = crypto.randomBytes(16).toString('hex');
  memUsers.set('admin', {
    username: 'admin', email: 'admin@interviewcoach.ai',
    passwordHash: pbkdf2(pass, salt), salt,
    role: 'admin', plan: 'pro',
    createdAt: new Date().toISOString(), questionsUsed: {},
  });
}
_memSeedAdmin();

// ── Helpers ───────────────────────────────────────────────────────────────────
function pbkdf2(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, 'sha256').toString('hex');
}

function issueToken(u: { username: string; email: string; role: string; plan: string }): string {
  return jwt.sign(
    { username: u.username, email: u.email, role: u.role, plan: u.plan },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verifyToken(token: string): jwt.JwtPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload; }
  catch { return null; }
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

/** Check DB for whether a user has unlimited quota right now (admin / pro / active beta). */
async function checkUnlimited(pool: Pool | null, payload: jwt.JwtPayload): Promise<boolean> {
  if (payload.role === 'admin' || payload.plan === 'pro') return true;
  if (payload.plan === 'beta' && pool) {
    const r = await pool.query(
      'SELECT beta_expires_at FROM interview_users WHERE username = $1', [payload.username]
    );
    const exp = r.rows[0]?.beta_expires_at;
    return exp != null && new Date(exp) > new Date();
  }
  return false;
}

// ── POST /register ────────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
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

  const pool = getPool();

  if (pool) {
    try {
      await ensureTables(pool);
      const salt = crypto.randomBytes(16).toString('hex');
      const r = await pool.query(
        `INSERT INTO interview_users (username, email, password_hash, salt)
         VALUES ($1, $2, $3, $4) RETURNING username, email, role, plan`,
        [username.trim(), email.trim().toLowerCase(), pbkdf2(password, salt), salt]
      );
      const u = r.rows[0];
      return void res.json({ token: issueToken(u), username: u.username, role: u.role, plan: u.plan });
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505') {
        const msg = pgErr.constraint?.includes('email') ? 'Email already registered' : 'Username already taken';
        return void res.status(409).json({ error: msg });
      }
      console.error('Register error:', err);
      return void res.status(500).json({ error: 'Registration failed — please try again' });
    }
  } else {
    // In-memory fallback
    const key = username.trim().toLowerCase();
    if (memUsers.has(key)) return void res.status(409).json({ error: 'Username already taken' });
    if ([...memUsers.values()].some(u => u.email === email.trim().toLowerCase()))
      return void res.status(409).json({ error: 'Email already registered' });
    const salt = crypto.randomBytes(16).toString('hex');
    const user: IUser = {
      username: username.trim(), email: email.trim().toLowerCase(),
      passwordHash: pbkdf2(password, salt), salt,
      role: 'user', plan: 'free',
      createdAt: new Date().toISOString(), questionsUsed: {},
    };
    memUsers.set(key, user);
    return void res.json({ token: issueToken(user), username: user.username, role: user.role, plan: user.plan });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { identifier, password } = req.body as Record<string, string>;
  if (!identifier || !password)
    return void res.status(400).json({ error: 'Please enter your username and password' });

  const pool = getPool();
  const id = identifier.trim().toLowerCase();

  if (pool) {
    try {
      await ensureTables(pool);
      const r = await pool.query(
        'SELECT * FROM interview_users WHERE username = $1 OR email = $2', [id, id]
      );
      if (!r.rows.length)
        return void res.status(401).json({ error: 'Invalid username or password' });
      const u = r.rows[0];
      const hash = pbkdf2(password, u.salt);
      if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(u.password_hash)))
        return void res.status(401).json({ error: 'Invalid username or password' });
      return void res.json({ token: issueToken(u), username: u.username, role: u.role, plan: u.plan });
    } catch (err) {
      console.error('Login error:', err);
      return void res.status(500).json({ error: 'Login failed — please try again' });
    }
  } else {
    const user = memUsers.get(id) ?? [...memUsers.values()].find(u => u.email === id);
    if (!user) return void res.status(401).json({ error: 'Invalid username or password' });
    const hash = pbkdf2(password, user.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash)))
      return void res.status(401).json({ error: 'Invalid username or password' });
    return void res.json({ token: issueToken(user), username: user.username, role: user.role, plan: user.plan });
  }
});

// ── GET /session ──────────────────────────────────────────────────────────────
router.get('/session', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return void res.status(401).json({ error: 'No session' });
  const payload = verifyToken(auth.slice(7));
  if (!payload) return void res.status(401).json({ error: 'Session expired' });
  res.json({ username: payload.username, role: payload.role, plan: payload.plan });
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  // Always return 200 — never reveal whether the email exists
  const ok = { message: "If that email is registered, a reset link has been sent." };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return void res.json(ok);

  const pool = getPool();
  if (!pool) return void res.json(ok);  // no DB in dev → silently ok

  try {
    await ensureTables(pool);
    const r = await pool.query(
      'SELECT username FROM interview_users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    if (!r.rows.length) return void res.json(ok);

    const { username } = r.rows[0];
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO interview_reset_tokens (token, username, expires_at)
       VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING`,
      [token, username, expires]
    );

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const baseUrl   = process.env.PRODUCTION_URL || 'http://localhost:3001';
      const resetUrl  = `${baseUrl}/reset-password.html?token=${token}`;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@interviewcoach.ai';
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: email.trim().toLowerCase(),
            subject: 'Reset your Interview Coach password',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <div style="font-size:28px;margin-bottom:8px">🎙️</div>
                <h2 style="color:#0ea5e9;margin:0 0 16px">Reset your password</h2>
                <p style="color:#444;line-height:1.6">
                  Click the link below to set a new password.
                  This link expires in <strong>1 hour</strong>.
                </p>
                <a href="${resetUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#a78bfa);
                          color:#fff;padding:13px 28px;border-radius:999px;text-decoration:none;
                          font-weight:700;font-size:15px;margin:20px 0">
                  Reset Password →
                </a>
                <p style="color:#888;font-size:13px;margin-top:24px">
                  If you didn't request this, you can safely ignore this email.
                  Your password won't change.
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
                <p style="color:#bbb;font-size:12px">
                  Interview Coach · AI-Powered Interview Practice
                </p>
              </div>
            `,
          }),
        });
      } catch (mailErr) {
        console.error('[interviewAuth] Failed to send reset email:', mailErr);
        // Token is saved — don't fail the request
      }
    } else {
      // Dev mode: log token to console so developer can test reset flow
      console.log(`[interviewAuth][dev] Reset token for ${username}: ${token}`);
      console.log(`[interviewAuth][dev] Reset URL: http://localhost:3001/reset-password.html?token=${token}`);
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }

  res.json(ok);
});

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password)
    return void res.status(400).json({ error: 'Token and new password are required' });
  if (password.length < 8)
    return void res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!/[A-Z]/.test(password))
    return void res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  if (!/[0-9]/.test(password))
    return void res.status(400).json({ error: 'Password must contain at least one number' });

  const pool = getPool();
  if (!pool) return void res.status(503).json({ error: 'Database not configured' });

  try {
    await ensureTables(pool);
    const r = await pool.query(
      `SELECT username FROM interview_reset_tokens
       WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
      [token]
    );
    if (!r.rows.length)
      return void res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

    const { username } = r.rows[0];
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = pbkdf2(password, salt);

    await pool.query(
      'UPDATE interview_users SET password_hash = $1, salt = $2 WHERE username = $3',
      [hash, salt, username]
    );
    await pool.query(
      'UPDATE interview_reset_tokens SET used = TRUE WHERE token = $1',
      [token]
    );

    res.json({ message: 'Password updated successfully — you can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password — please try again' });
  }
});

// ── POST /question-used ───────────────────────────────────────────────────────
router.post('/question-used', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return void res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(auth.slice(7));
  if (!payload) return void res.status(401).json({ error: 'Session expired' });

  const today = todayKey();
  const pool  = getPool();

  if (pool) {
    try {
      await ensureTables(pool);
      const unlimited = await checkUnlimited(pool, payload);
      if (!unlimited) {
        await pool.query(
          `INSERT INTO interview_questions_used (username, date, count) VALUES ($1, $2, 1)
           ON CONFLICT (username, date)
           DO UPDATE SET count = interview_questions_used.count + 1`,
          [payload.username, today]
        );
      }
      const r = await pool.query(
        'SELECT count FROM interview_questions_used WHERE username = $1 AND date = $2',
        [payload.username, today]
      );
      const used = Number(r.rows[0]?.count ?? 0);
      return void res.json({ used, remaining: unlimited ? 999 : Math.max(0, 10 - used) });
    } catch (err) {
      console.error('question-used error:', err);
      return void res.status(500).json({ error: 'Failed to record usage' });
    }
  } else {
    const user = memUsers.get(payload.username.toLowerCase());
    if (!user) return void res.status(404).json({ error: 'User not found' });
    const unlimited = payload.role === 'admin' || payload.plan === 'pro';
    if (!unlimited) user.questionsUsed[today] = (user.questionsUsed[today] ?? 0) + 1;
    const used = user.questionsUsed[today] ?? 0;
    return void res.json({ used, remaining: unlimited ? 999 : Math.max(0, 10 - used) });
  }
});

// ── GET /quota ────────────────────────────────────────────────────────────────
router.get('/quota', async (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return void res.status(401).json({ error: 'Unauthorized' });
  const payload = verifyToken(auth.slice(7));
  if (!payload) return void res.status(401).json({ error: 'Session expired' });

  const today = todayKey();
  const pool  = getPool();

  if (pool) {
    try {
      await ensureTables(pool);
      const unlimited = await checkUnlimited(pool, payload);
      const r = await pool.query(
        'SELECT count FROM interview_questions_used WHERE username = $1 AND date = $2',
        [payload.username, today]
      );
      const used = Number(r.rows[0]?.count ?? 0);
      return void res.json({ used, remaining: unlimited ? 999 : Math.max(0, 10 - used), unlimited });
    } catch (err) {
      console.error('quota error:', err);
      return void res.status(500).json({ error: 'Failed to get quota' });
    }
  } else {
    const unlimited = payload.role === 'admin' || payload.plan === 'pro';
    const user = memUsers.get(payload.username.toLowerCase());
    const used = user?.questionsUsed[today] ?? 0;
    return void res.json({ used, remaining: unlimited ? 999 : Math.max(0, 10 - used), unlimited });
  }
});

export default router;
