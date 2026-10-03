/**
 * "Tell me when someone arrives": notifications on this phone or iPad, even
 * when the app is closed (Web Push; the server side is server/notify/push.js).
 *
 * iPhones and iPads only allow them for apps added to the Home Screen
 * (iOS 16.4 or later), so in Safari itself we explain how to do that.
 *
 * The choice is remembered on this device, so after switching it on once,
 * every table you sit at asks the server to tell you.
 */
import api from './api';

const WANT_KEY = 'notifyArrivals';

export const wantsNotify = () => {
  try { return localStorage.getItem(WANT_KEY) === 'on'; } catch { return false; }
};
const setWantsNotify = on => {
  try { localStorage.setItem(WANT_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
};

/**
 * What this device can do: 'ready' (can switch on), 'granted' (already allowed),
 * 'denied' (turned off in the device's settings), 'install' (an iPhone or iPad
 * in Safari: add to the Home Screen first) or 'unsupported'. `win` is the
 * browser's window (passed in by tests).
 */
export function pushStatus(win = globalThis.window) {
  const nav = win?.navigator;
  const supported = !!(nav?.serviceWorker && win.PushManager && win.Notification);
  if (!supported) {
    const apple = /iPhone|iPad|iPod/.test(nav?.userAgent ?? '') || (nav?.platform === 'MacIntel' && nav?.maxTouchPoints > 1);
    const installed = win?.matchMedia?.('(display-mode: standalone)').matches || nav?.standalone === true;
    return apple && !installed ? 'install' : 'unsupported';
  }
  if (win.Notification.permission === 'denied') return 'denied';
  return win.Notification.permission === 'granted' ? 'granted' : 'ready';
}

// The server's public key, as the bytes the push service wants
const keyBytes = base64 => {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

/** Make sure the server has this device's address. Resolves to true if notifications can be sent here. */
async function register() {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { data } = await api.get('/push/key');
    // (A browser that can't reach its push service never answers: give up rather than wait forever)
    subscription = await Promise.race([
      registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(data.key) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('No answer from the push service')), 20000)),
    ]);
  }
  await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  return true;
}

/**
 * Switch notifications on. Call straight from a tap: iPads only show the
 * "Allow notifications?" question in answer to one. Resolves to true if on.
 */
export async function enableNotify() {
  // Ask first, before anything else is awaited, so it still counts as part of the tap
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  try {
    await register();
    setWantsNotify(true);
    return true;
  } catch {
    return false;
  }
}

export function disableNotify() {
  setWantsNotify(false);
}

/** On arriving at a table: if you've switched notifications on, check this device is still signed up. */
export async function stillNotifying() {
  if (!wantsNotify() || pushStatus() !== 'granted') return false;
  try { return await register(); } catch { return false; }
}
