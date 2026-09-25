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

/** Send an event and wait for the server's reply. */
export const request = (event, data) => new Promise(resolve => getSocket().emit(event, data, resolve));
