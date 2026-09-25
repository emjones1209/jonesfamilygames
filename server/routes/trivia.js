const express = require('express');
const pool = require('../db/pool');

const router = express.Router();
const MAX_EXCLUDE = 500;

// GET /api/trivia?category=bible&difficulty=easy&limit=10&exclude=4,17,23
// `exclude` lists questions this player has already seen: unseen questions
// come first, and seen ones are only reused once the pool has run out.
router.get('/', async (req, res) => {
  const { category, difficulty } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
  const exclude = String(req.query.exclude ?? '')
    .split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(-MAX_EXCLUDE);

  const conditions = [];
  const vals = [];
  if (category)   { conditions.push(`category = $${vals.length + 1}`);   vals.push(category); }
  if (difficulty) { conditions.push(`difficulty = $${vals.length + 1}`); vals.push(difficulty); }

  const query = async (extra, extraVals, n) => {
    const where = [...conditions, ...extra];
    const params = [...vals, ...extraVals, n];
    const result = await pool.query(
      `SELECT * FROM trivia_questions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY RANDOM() LIMIT $${params.length}`,
      params
    );
    return result.rows;
  };

  try {
    if (!exclude.length) return res.json(await query([], [], limit));
    const list = exclude.map((_, i) => `$${vals.length + i + 1}`).join(',');
    const fresh = await query([`id NOT IN (${list})`], exclude, limit);
    // Pool used up: top the round up with questions already seen
    const reused = fresh.length < limit ? await query([`id IN (${list})`], exclude, limit - fresh.length) : [];
    res.json([...fresh, ...reused]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
