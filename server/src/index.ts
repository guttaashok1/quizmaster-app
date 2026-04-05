import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import quizRouter from './routes/quiz';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/quiz', quizRouter);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Quiz API server running on http://0.0.0.0:${PORT}`);
});
