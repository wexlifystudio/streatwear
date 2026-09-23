// Streat Wear — Admin notification service worker
// Only used by the admin panel (registered with scope "/admin").
// It has NO fetch handler, so it never touches website requests or caching.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Tapping a chat notification brings the admin panel to the front on the Live Chat tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin.html';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes('/admin')) {
        await client.focus();
        client.postMessage({ type: 'sw-open-chat' });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
