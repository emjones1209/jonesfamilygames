const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/scores — save a score
router.post('/', requireAuth, async (req, res) => {
  const { game, score, durationS, difficulty, metadata } = req.body;
  if (!game || score == null) return res.status(400).json({ error: 'game and score required' });
  try {
    await pool.query(
      `INSERT INTO scores (user_id, game, score, duration_s, difficulty, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, game, score, durationS || null, difficulty || null, JSON.stringify(metadata || {})]
    );
    res.status(201).json({ message: 'Score saved' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/scores/me — current user's scores
router.get('/me', requireAuth, async (req, res) => {
  const { game, limit = 20 } = req.query;
  const conditions = ['user_id = $1'];
  const vals = [req.user.id];
  if (game) { conditions.push(`game = $${vals.length + 1}`); vals.push(game); }
  vals.push(Number(limit));
  const result = await pool.query(
    `SELECT * FROM scores WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${vals.length}`,
    vals
  );
  res.json(result.rows);
});

// GET /api/scores/leaderboard/:game
router.get('/leaderboard/:game', async (req, res) => {
  const { game } = req.params;
  const result = await pool.query(
    `SELECT u.display_name, u.avatar, s.score, s.difficulty, s.created_at
     FROM scores s JOIN users u ON s.user_id = u.id
     WHERE s.game = $1
     ORDER BY s.score DESC
     LIMIT 10`,
    [game]
  );
  res.json(result.rows);
});

// GET /api/scores/daily/:game?date=YYYY-MM-DD — the family's times on a daily puzzle
// (scores posted with metadata.daily = that date): each player's first finish at
// each difficulty, fastest first. Filtered here rather than in SQL because
// metadata is JSONB in PostgreSQL but text in SQLite.
const DAILY_SCAN = 500;
router.get('/daily/:game', requireAuth, async (req, res) => {
  const { game } = req.params;
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  try {
    const result = await pool.query(
      `SELECT s.user_id, u.display_name, u.avatar, s.score, s.duration_s, s.difficulty, s.metadata, s.created_at
       FROM scores s JOIN users u ON s.user_id = u.id
       WHERE s.game = $1
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ${DAILY_SCAN}`,
      [game]
    );
    const firsts = new Map();
    for (const row of result.rows.reverse()) {       // oldest first, so each player's first finish wins
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata ?? {});
      const key = `${row.user_id}:${row.difficulty}`;
      if (meta.daily !== date || firsts.has(key)) continue;
      firsts.set(key, {
        displayName: row.display_name, avatar: row.avatar, difficulty: row.difficulty,
        seconds: row.duration_s, score: row.score, you: row.user_id === req.user.id,
      });
    }
    res.json([...firsts.values()].sort((a, b) => a.seconds - b.seconds));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
