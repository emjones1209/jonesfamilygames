// UNFINISHED — multiplayer is hidden: no game uses this yet (see README).
const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/rooms — create a room
router.post('/', requireAuth, async (req, res) => {
  const { gameType } = req.body;
  if (!gameType) return res.status(400).json({ error: 'gameType required' });
  const id = crypto.randomBytes(4).toString('hex').toUpperCase();
  try {
    await pool.query(
      `INSERT INTO game_rooms (id, game_type, host_id, players) VALUES ($1,$2,$3,$4)`,
      [id, gameType, req.user.id, JSON.stringify([{ id: req.user.id, displayName: req.user.displayName, ready: false }])]
    );
    res.status(201).json({ roomId: id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/:id
router.get('/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`SELECT * FROM game_rooms WHERE id = $1`, [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Room not found' });
  res.json(result.rows[0]);
});

// DELETE /api/rooms/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query(`DELETE FROM game_rooms WHERE id = $1 AND host_id = $2`, [req.params.id, req.user.id]);
  res.json({ message: 'Room deleted' });
});

module.exports = router;
