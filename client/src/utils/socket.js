/**
 * The live connection used by play-together tables (one per browser tab).
 *
 * iPads drop connections whenever the screen locks or you switch apps, so this
 * reconnects by itself: straight away when the page becomes visible again,
 * and with a fresh login token if the old one has expired.
 */
import { io } from 'socket.io-client';
import { refreshTokens } from './api';

let socket = null;

export function getSocket() {
  if (socket) return socket;
  socket = io('/', {
    // A function, so every reconnect sends the latest token
    auth: cb => cb({ token: localStorage.getItem('accessToken') }),
    transports: ['websocket'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  socket.on('connect_error', async err => {
    if (err.message !== 'Invalid token' && err.message !== 'Authentication required') return;
    try {
      await refreshTokens();
      socket.connect();
    } catch {
      window.location.href = '/login';
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
  });
  return socket;
}

export const OFFLINE = 'Couldn\'t reach the game server — check your internet connection and try again.';

/**
 * Send an event and wait for the server's reply. If none comes (the device
 * can't reach the server), give up after `ms` with `{ error, offline: true }`
 * rather than waiting for ever.
 */
export const request = (event, data, ms = 10000) => new Promise(resolve => {
  const timer = setTimeout(() => resolve({ error: OFFLINE, offline: true }), ms);
  getSocket().emit(event, data, reply => { clearTimeout(timer); resolve(reply); });
});
