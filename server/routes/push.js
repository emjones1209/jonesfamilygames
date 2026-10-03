const express = require('express');
const { requireAuth } = require('../middleware/auth');
const push = require('../notify/push');

const router = express.Router();

// GET /api/push/key — the public key a device needs to switch notifications on
router.get('/key', async (req, res) => {
  try {
    res.json({ key: await push.publicKey() });
  } catch {
    res.status(503).json({ error: 'Notifications aren\'t available right now' });
  }
});

// POST /api/push/subscribe { subscription } — notify this device
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    await push.subscribe(req.user.id, req.body?.subscription);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/push/unsubscribe { endpoint } — stop notifying this device
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    await push.unsubscribe(req.user.id, String(req.body?.endpoint ?? ''));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
