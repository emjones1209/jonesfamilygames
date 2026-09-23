const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar      TEXT DEFAULT 'default',
        is_admin    BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game       TEXT NOT NULL,
        score      INTEGER NOT NULL,
        duration_s INTEGER,
        difficulty TEXT,
        metadata   JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trivia_questions (
        id             SERIAL PRIMARY KEY,
        category       TEXT NOT NULL,
        difficulty     TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
        question       TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        wrong_answers  TEXT[] NOT NULL,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dad_jokes (
        id        SERIAL PRIMARY KEY,
        joke      TEXT NOT NULL,
        punchline TEXT NOT NULL,
        used_at   TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        id         TEXT PRIMARY KEY,
        game_type  TEXT NOT NULL,
        host_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        state      JSONB DEFAULT '{}',
        players    JSONB DEFAULT '[]',
        status     TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','playing','finished')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Database migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { migrate };

// Run directly: `node db/migrate.js`
if (require.main === module) migrate().then(() => process.exit(0)).catch(() => process.exit(1));
