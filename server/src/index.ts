import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import quizRouter from './routes/quiz';
import challengeRouter from './routes/challenge';
import authRouter from './routes/auth';
import interviewRouter from './routes/interview';
import interviewAuthRouter from './routes/interviewAuth';
import profilesRouter from './routes/profiles';
import stripeRouter from './routes/stripe';
import { initDatabase } from './services/database';

// ── Sentry error monitoring (optional — set SENTRY_DSN to enable) ─────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL ? 'production' : 'development',
  });
  console.log('[sentry] Initialized');
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:     ["'self'", 'fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      mediaSrc:    ["'self'", 'blob:'],
      frameSrc:    ["'self'", 'https://www.youtube.com', 'https://js.stripe.com'],
      connectSrc:  ["'self'", 'huggingface.co', '*.huggingface.co', 'cdn.jsdelivr.net',
                    'https://api.resend.com'],
      workerSrc:   ["'self'", 'blob:'],
      scriptSrcElem: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net',
                      'https://js.stripe.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip compression ───────────────────────────────────────────────────────
app.use(compression());

// ── CORS — restrict to known origins in production ─────────────────────────
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  process.env.PRODUCTION_URL,        // e.g. https://interviewcoach.ai
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, same-origin SSE)
    if (!origin) return cb(null, true);
    // Allow any vercel.app preview + known production origins
    if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Stripe webhook raw-body pre-parser ─────────────────────────────────────
// express.raw() runs first for webhook path and sets req._body=true,
// so the express.json() below skips it — preserving the raw buffer Stripe needs.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '5mb' })); // profiles can contain large resume/JD text

// ── Static files with cache headers ───────────────────────────────────────
app.use(express.static(resolve(__dirname, '../public'), {
  maxAge: '1d',          // Cache static assets for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // HTML pages: no cache (always fresh)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Strict limit on interview answer endpoint (calls Claude API)
const answerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: { message: 'Hourly answer limit reached — upgrade to Pro for unlimited', code: 'RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/interview/answer-stream', answerLimiter);

// Quiz generation limit
const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api/quiz', quizLimiter);

// General API limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api/', generalLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/quiz', quizRouter);
app.use('/api/challenge', challengeRouter);
app.use('/api/auth', authRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/interview-auth', interviewAuthRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/stripe', stripeRouter);

// ── 404 fallback for unknown API routes ───────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ message: 'API route not found', code: 'NOT_FOUND' });
});

// ── Custom 404 for all other routes ───────────────────────────────────────
app.use((_req, res) => {
  res.status(404).sendFile(resolve(__dirname, '../public/404.html'));
});

// ── Sentry error handler (must be AFTER all routes) ───────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ── Export for Vercel serverless ───────────────────────────────────────────
export default app;

// Only start a listening server when running locally (not on Vercel)
if (!process.env.VERCEL) {
  initDatabase()
    .catch((err) => {
      console.warn('Database unavailable — quiz/challenge/auth routes will fail, interview routes still work:', err.message);
    })
    .finally(() => {
      app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
        console.log(`Interview Coach: http://0.0.0.0:${PORT}/interview`);
      });
    });
}
