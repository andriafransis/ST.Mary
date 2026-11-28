/* إشعارات الموبايل الخارجية — بتتحمّل جوه الـ Service Worker الأساسي */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'كنيسة السيدة العذراء', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'كنيسة السيدة العذراء';
  const options = {
    body: data.body || '',
    icon: data.icon || '/ST.Mary/icon-192.png',
    badge: '/ST.Mary/icon-192.png',
    tag: data.tag || 'church-push',
    renotify: true,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/ST.Mary/' }
  };
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
        return self.navigator.setAppBadge(1).catch(() => {});
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/ST.Mary/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate && c.navigate(target).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
