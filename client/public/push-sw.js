/**
 * Notifications from the server (see server/notify/push.js), e.g. "Grandpa is
 * ready to play Spades!" — shown even when the app is closed. Tapping one
 * opens the app at the table. (Loaded into the app's service worker; see
 * vite.config.js.)
 */
self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() ?? {}; } catch { message = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(message.title || 'Family Games', {
    body: message.body || '',
    icon: '/icon-192.png',
    tag: message.tag,                 // a newer notification about the same table replaces the older one
    data: { url: message.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    // The app's already open (in the background, say): bring it up at the table
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of open) {
      try {
        const shown = await client.navigate(url);
        if (shown) return shown.focus();
      } catch { /* not ours to move: open a new one */ }
    }
    return self.clients.openWindow(url);
  })());
});
