const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, display_name, avatar, is_admin, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, displayName: user.display_name, avatar: user.avatar, isAdmin: user.is_admin, createdAt: user.created_at });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me — update display name or avatar
router.patch('/me', requireAuth, async (req, res) => {
  const { displayName, avatar } = req.body;
  const fields = [];
  const vals = [];
  let idx = 1;
  if (displayName) { fields.push(`display_name = $${idx++}`); vals.push(displayName.trim()); }
  if (avatar)       { fields.push(`avatar = $${idx++}`);       vals.push(avatar); }
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.user.id);
  try {
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me/password
router.patch('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: GET /api/users — list all users
router.get('/', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT id, email, display_name, avatar, is_admin, created_at FROM users ORDER BY created_at`
  );
  res.json(result.rows.map(u => ({ id: u.id, email: u.email, displayName: u.display_name, avatar: u.avatar, isAdmin: u.is_admin, createdAt: u.created_at })));
});

// Admin: POST /api/users/:id/reset-password
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'newPassword required' });
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.params.id]);
  res.json({ message: 'Password reset' });
});

// Admin: DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
  res.json({ message: 'User deleted' });
});

module.exports = router;
