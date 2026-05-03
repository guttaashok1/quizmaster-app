import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import quizRouter from './routes/quiz';
import challengeRouter from './routes/challenge';
import authRouter from './routes/auth';
import interviewRouter from './routes/interview';
import { initDatabase } from './services/database';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Only rate-limit quiz generation (calls Claude API, expensive)
const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api/quiz', quizLimiter);

// General rate limit - generous for polling/lobby
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api/', generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/quiz', quizRouter);
app.use('/api/challenge', challengeRouter);
app.use('/api/auth', authRouter);
app.use('/api/interview', interviewRouter);

// Serve the interview web app (static files bundled via vercel.json includeFiles)
app.use('/interview', express.static(resolve(__dirname, '../public/interview')));

// Export for Vercel serverless — Vercel imports this module directly
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
