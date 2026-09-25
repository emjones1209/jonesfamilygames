/**
 * Keeps the app up to date. The app is saved on the device (so it opens fast
 * and works offline), which means a new version only arrives when it checks
 * for one — and an iPad may keep the app open for days. So check for a new
 * version whenever you're somewhere with no game in progress (the home page,
 * say): on arriving there, when the app comes back on screen, and every 15
 * minutes. A new version installs and reloads straight away, so it never
 * interrupts a game.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 15 * 60 * 1000;
const SAFE_TO_RELOAD = ['/', '/login', '/welcome', '/profile', '/together'];
const safeHere = () => SAFE_TO_RELOAD.includes(window.location.pathname);

export function AppUpdater() {
  const { pathname } = useLocation();
  const registration = useRef(null);
  const check = () => {
    if (registration.current && navigator.onLine && safeHere()) registration.current.update().catch(() => {});
  };

  useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      registration.current = reg;
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });

  // Coming back to the home page from a game is a good moment to look
  useEffect(check, [pathname]);
  return null;
}
