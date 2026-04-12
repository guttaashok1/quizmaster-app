import { Pool } from 'pg';

// Use DATABASE_URL from environment (set by Render when you add a PostgreSQL database)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

// Create tables if they don't exist
export async function initDatabase(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar_emoji VARCHAR(10) DEFAULT '🧠',
        total_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id VARCHAR(20) PRIMARY KEY,
        topic VARCHAR(200) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        questions JSONB NOT NULL,
        creator_name VARCHAR(100) NOT NULL,
        creator_score INTEGER DEFAULT 0,
        challengers JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'waiting'`);
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'`);
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) DEFAULT 'private'`);
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS current_question INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE challenges ADD COLUMN IF NOT EXISTS question_answers JSONB DEFAULT '{}'`);

    console.log('Database tables ready');
  } catch (err) {
    console.error('Database init error:', err);
    throw err;
  }
}

// ---- User functions ----

export async function createUser(
  username: string,
  password: string,
  avatarEmoji: string
): Promise<{ username: string; avatarEmoji: string; totalScore: number }> {
  const result = await pool.query(
    'INSERT INTO users (username, password, avatar_emoji) VALUES ($1, $2, $3) RETURNING username, avatar_emoji, total_score',
    [username.trim(), password, avatarEmoji || '🧠']
  );
  const row = result.rows[0];
  return { username: row.username, avatarEmoji: row.avatar_emoji, totalScore: row.total_score };
}

export async function findUser(username: string): Promise<{
  username: string;
  password: string;
  avatarEmoji: string;
  totalScore: number;
} | null> {
  const result = await pool.query(
    'SELECT username, password, avatar_emoji, total_score FROM users WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    username: row.username,
    password: row.password,
    avatarEmoji: row.avatar_emoji,
    totalScore: row.total_score,
  };
}

export async function updateUserScore(
  username: string,
  score: number
): Promise<{ username: string; avatarEmoji: string; totalScore: number } | null> {
  const result = await pool.query(
    'UPDATE users SET total_score = $2 WHERE LOWER(username) = LOWER($1) RETURNING username, avatar_emoji, total_score',
    [username.trim(), score]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { username: row.username, avatarEmoji: row.avatar_emoji, totalScore: row.total_score };
}

export async function getPublicProfile(
  username: string
): Promise<{ username: string; avatarEmoji: string; totalScore: number } | null> {
  const result = await pool.query(
    'SELECT username, avatar_emoji, total_score FROM users WHERE LOWER(username) = LOWER($1)',
    [username.trim()]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { username: row.username, avatarEmoji: row.avatar_emoji, totalScore: row.total_score };
}

// ---- Challenge functions ----

interface Challenger {
  name: string;
  score: number;
}

interface Challenge {
  id: string;
  topic: string;
  difficulty: string;
  questions: any[];
  creatorName: string;
  creatorScore: number;
  challengers: Challenger[];
  createdAt: string;
  status?: string;
  participants?: string[];
  visibility?: string;
}

export async function createChallenge(challenge: Challenge): Promise<Challenge> {
  await pool.query(
    'INSERT INTO challenges (id, topic, difficulty, questions, creator_name, creator_score, challengers, status, participants, visibility) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      challenge.id,
      challenge.topic,
      challenge.difficulty,
      JSON.stringify(challenge.questions),
      challenge.creatorName,
      challenge.creatorScore,
      JSON.stringify(challenge.challengers),
      'waiting',
      JSON.stringify([challenge.creatorName]),
      challenge.visibility || 'private',
    ]
  );
  return { ...challenge, status: 'waiting', participants: [challenge.creatorName], visibility: challenge.visibility || 'private' };
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const result = await pool.query('SELECT * FROM challenges WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty,
    questions: row.questions,
    creatorName: row.creator_name,
    creatorScore: row.creator_score,
    challengers: row.challengers,
    createdAt: row.created_at,
    status: row.status || 'waiting',
    participants: row.participants || [],
    visibility: row.visibility || 'private',
  };
}

export async function getPublicChallenges(): Promise<Omit<Challenge, 'questions'>[]> {
  const result = await pool.query(
    "SELECT id, topic, difficulty, creator_name, creator_score, challengers, created_at, status, participants, visibility FROM challenges WHERE visibility = 'public' AND status = 'waiting' ORDER BY created_at DESC LIMIT 20"
  );
  return result.rows.map(row => ({
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty,
    questions: [],
    creatorName: row.creator_name,
    creatorScore: row.creator_score,
    challengers: row.challengers || [],
    createdAt: row.created_at,
    status: row.status || 'waiting',
    participants: row.participants || [],
    visibility: row.visibility || 'private',
  }));
}

export async function getMyChallenges(username: string): Promise<Omit<Challenge, 'questions'>[]> {
  const result = await pool.query(
    "SELECT id, topic, difficulty, creator_name, creator_score, challengers, created_at, status, participants, visibility FROM challenges WHERE LOWER(creator_name) = LOWER($1) ORDER BY created_at DESC LIMIT 20",
    [username]
  );
  return result.rows.map(row => ({
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty,
    questions: [],
    creatorName: row.creator_name,
    creatorScore: row.creator_score,
    challengers: row.challengers || [],
    createdAt: row.created_at,
    status: row.status || 'waiting',
    participants: row.participants || [],
    visibility: row.visibility || 'private',
  }));
}

export async function addChallengerResult(
  id: string,
  name: string,
  score: number
): Promise<Challenge | null> {
  // Get current challengers, add new one, update
  const challenge = await getChallenge(id);
  if (!challenge) return null;

  challenge.challengers.push({ name, score });
  await pool.query(
    'UPDATE challenges SET challengers = $2 WHERE id = $1',
    [id, JSON.stringify(challenge.challengers)]
  );
  return challenge;
}

export async function joinChallenge(id: string, name: string): Promise<Challenge | null> {
  const challenge = await getChallenge(id);
  if (!challenge) return null;

  if (!challenge.participants) challenge.participants = [];
  if (!(challenge.participants as string[]).includes(name)) {
    (challenge.participants as string[]).push(name);
    await pool.query(
      'UPDATE challenges SET participants = $2 WHERE id = $1',
      [id, JSON.stringify(challenge.participants)]
    );
  }
  return { ...challenge, participants: challenge.participants };
}

export async function startChallenge(id: string): Promise<Challenge | null> {
  const result = await pool.query(
    "UPDATE challenges SET status = 'started' WHERE id = $1 RETURNING *",
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    topic: row.topic,
    difficulty: row.difficulty,
    questions: row.questions,
    creatorName: row.creator_name,
    creatorScore: row.creator_score,
    challengers: row.challengers,
    createdAt: row.created_at,
    status: row.status,
    participants: row.participants,
  };
}

export async function answerChallengeQuestion(
  id: string,
  questionIndex: number,
  username: string,
  correct: boolean,
  timeMs: number
): Promise<{ recorded: boolean; answeredBy?: string; correct?: boolean }> {
  // Get current answers
  const result = await pool.query('SELECT question_answers, current_question FROM challenges WHERE id = $1', [id]);
  if (result.rows.length === 0) return { recorded: false };

  const answers = result.rows[0].question_answers || {};
  const key = String(questionIndex);

  // If someone already answered this question, reject
  if (answers[key]) {
    return { recorded: false, answeredBy: answers[key].answeredBy, correct: answers[key].correct };
  }

  // Record this answer and advance the question
  answers[key] = { answeredBy: username, correct, timeMs, answeredAt: new Date().toISOString() };
  const nextQuestion = questionIndex + 1;

  await pool.query(
    'UPDATE challenges SET question_answers = $2, current_question = $3 WHERE id = $1',
    [id, JSON.stringify(answers), nextQuestion]
  );

  return { recorded: true, answeredBy: username, correct };
}

export async function getChallengeProgress(id: string): Promise<{
  currentQuestion: number;
  questionAnswers: Record<string, { answeredBy: string; correct: boolean; timeMs: number }>;
  status: string;
  participants: string[];
  totalQuestions: number;
} | null> {
  const result = await pool.query(
    'SELECT current_question, question_answers, status, participants, questions FROM challenges WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const questions = row.questions || [];
  return {
    currentQuestion: row.current_question || 0,
    questionAnswers: row.question_answers || {},
    status: row.status || 'waiting',
    participants: row.participants || [],
    totalQuestions: Array.isArray(questions) ? questions.length : 0,
  };
}

export async function getChallengeStatus(id: string): Promise<{ status: string; participants: string[] } | null> {
  const result = await pool.query(
    'SELECT status, participants FROM challenges WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return {
    status: result.rows[0].status || 'waiting',
    participants: result.rows[0].participants || [],
  };
}

export async function deleteChallenge(id: string, username: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM challenges WHERE id = $1 AND LOWER(creator_name) = LOWER($2)',
    [id, username]
  );
  return (result.rowCount ?? 0) > 0;
}
