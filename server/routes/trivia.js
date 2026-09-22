const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/trivia?category=bible&difficulty=easy&limit=10
router.get('/', async (req, res) => {
  const { category, difficulty, limit = 10 } = req.query;
  const conditions = [];
  const vals = [];
  if (category)   { conditions.push(`category = $${vals.length + 1}`);   vals.push(category); }
  if (difficulty) { conditions.push(`difficulty = $${vals.length + 1}`); vals.push(difficulty); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  vals.push(Number(limit));
  try {
    const result = await pool.query(
      `SELECT * FROM trivia_questions ${where} ORDER BY RANDOM() LIMIT $${vals.length}`,
      vals
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
