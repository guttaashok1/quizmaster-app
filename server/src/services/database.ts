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
}

export async function createChallenge(challenge: Challenge): Promise<Challenge> {
  await pool.query(
    'INSERT INTO challenges (id, topic, difficulty, questions, creator_name, creator_score, challengers) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      challenge.id,
      challenge.topic,
      challenge.difficulty,
      JSON.stringify(challenge.questions),
      challenge.creatorName,
      challenge.creatorScore,
      JSON.stringify(challenge.challengers),
    ]
  );
  return challenge;
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
  };
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
