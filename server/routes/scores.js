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

module.exports = router;
