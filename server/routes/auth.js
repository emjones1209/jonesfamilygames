const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();
const SALT_ROUNDS = 12;

function signTokens(user) {
  const payload = { id: user.id, email: user.email, displayName: user.display_name, isAdmin: user.is_admin };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

/**
 * Registration needs the family invite code (FAMILY_INVITE_CODE) so strangers
 * who find the site can't sign up. Required in production; optional locally.
 * Returns an error message, or null if the code is acceptable.
 */
function inviteCodeError(given) {
  const expected = process.env.FAMILY_INVITE_CODE?.trim();
  if (!expected) {
    return process.env.NODE_ENV === 'production'
      ? 'Registration is turned off (the site has no family invite code set)'
      : null;
  }
  // Compare hashes so the check takes the same time however much matches
  const hash = s => crypto.createHash('sha256').update(String(s ?? '').trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(hash(given), hash(expected)) ? null : 'That family invite code isn\'t right';
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, displayName, password, inviteCode } = req.body;
  if (!email || !displayName || !password) {
    return res.status(400).json({ error: 'email, displayName, and password are required' });
  }
  const inviteError = inviteCodeError(inviteCode);
  if (inviteError) return res.status(403).json({ error: inviteError });
  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
      [email.toLowerCase().trim(), displayName.trim(), passwordHash]
    );
    const user = result.rows[0];
    const { accessToken, refreshToken } = signTokens(user);

    // Store refresh token
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expires]
    );

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.display_name, avatar: user.avatar, isAdmin: user.is_admin }
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = signTokens(user);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expires]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.display_name, avatar: user.avatar, isAdmin: user.is_admin }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const stored = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
      [refreshToken]
    );
    if (!stored.rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });

    const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [payload.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { accessToken, refreshToken: newRefresh } = signTokens(user);
    // Rotate refresh token
    await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, newRefresh, expires]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]).catch(() => {});
  }
  res.json({ message: 'Logged out' });
});

module.exports = router;
