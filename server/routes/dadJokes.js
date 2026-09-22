const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/dad-jokes/random
router.get('/random', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM dad_jokes ORDER BY RANDOM() LIMIT 1`
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No jokes found' });
    const joke = result.rows[0];
    // Mark as used
    await pool.query(`UPDATE dad_jokes SET used_at = NOW() WHERE id = $1`, [joke.id]);
    res.json(joke);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dad-jokes — get all
router.get('/', async (req, res) => {
  const result = await pool.query(`SELECT * FROM dad_jokes ORDER BY id`);
  res.json(result.rows);
});

module.exports = router;
