/**
 * Notifications to a family member's phone or iPad (Web Push), e.g. "Grandma
 * is at your Spades table", even when the app is closed.
 *
 * Each device that switches notifications on sends its push "subscription"
 * (an address at Apple's, Google's or Mozilla's push service), which is kept
 * against the user. To send, we post to every address that user has.
 *
 * The server signs what it sends with a key pair (VAPID). Set VAPID_PUBLIC_KEY
 * and VAPID_PRIVATE_KEY to choose your own; otherwise a pair is made the first
 * time and kept in the database. (Changing keys means everyone switches
 * notifications on again.)
 */
const webpush = require('web-push');
const pool = require('../db/pool');

let ready = null;      // resolves to the public key once web-push is set up

async function storedKeys() {
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE name = $1`, ['vapid']);
  if (rows[0]) return JSON.parse(rows[0].value);
  const keys = webpush.generateVAPIDKeys();
  await pool.query(`INSERT INTO app_settings (name, value) VALUES ($1, $2)`, ['vapid', JSON.stringify(keys)]);
  return keys;
}

/** The address push services contact if something's wrong: an email, or the app's own https address. */
function subject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const site = process.env.CLIENT_URL ?? '';
  // Apple refuses a localhost address
  return site.startsWith('https://') ? site : 'mailto:family-games@example.com';
}

function setUp() {
  if (!ready) {
    ready = (async () => {
      const keys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
        ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
        : await storedKeys();
      webpush.setVapidDetails(subject(), keys.publicKey, keys.privateKey);
      return keys.publicKey;
    })();
    ready.catch(() => { ready = null; });       // try again next time
  }
  return ready;
}

const publicKey = () => setUp();

/** Keep this device's subscription for the user (moving it over if someone else signed in on it before). */
async function subscribe(userId, { endpoint, keys } = {}) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !keys?.p256dh || !keys?.auth) {
    throw new Error('Not a push subscription');
  }
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)`,
    [userId, endpoint, String(keys.p256dh), String(keys.auth)]);
}

async function unsubscribe(userId, endpoint) {
  await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [userId, endpoint]);
}

/**
 * Send `message` ({ title, body, url, tag }) to every device of each user.
 * Never throws: a notification that can't be sent mustn't upset the game.
 */
async function notifyUsers(userIds, message) {
  try {
    await setUp();
    for (const userId of userIds) {
      const { rows } = await pool.query(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [userId]);
      await Promise.all(rows.map(async row => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            JSON.stringify(message),
            { TTL: 60 * 60, urgency: 'high' });       // no use arriving after the table's gone
        } catch (e) {
          // That device switched notifications off or the app was removed
          if (e.statusCode === 404 || e.statusCode === 410) {
            await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [row.endpoint]);
          } else {
            console.error('Push notification failed:', e.statusCode ?? '', e.body ?? e.message);
          }
        }
      }));
    }
  } catch (e) {
    console.error('Push notifications unavailable:', e.message);
  }
}

module.exports = { publicKey, subscribe, unsubscribe, notifyUsers };
