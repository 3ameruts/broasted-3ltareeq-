// Order page service worker: shows order notifications and opens the tracking page when tapped.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text */ }
  event.waitUntil(self.registration.showNotification(data.title || 'بروستد عالطريق', {
    body: data.body || '', tag: data.tag, renotify: true, dir: 'rtl', lang: 'ar',
    icon: '/order/icon-192.png', badge: '/order/icon-192.png', data: { url: data.url || '/order/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/order/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url === url);
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
