// Minimal service worker: enables PWA installability + a basic offline shell.
// (Registered in production only — see main.jsx — so it never interferes with Vite HMR.)
const CACHE = 'nextlevel-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept API / realtime traffic.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Network-first for page navigations; fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    );
  }
});

// ─── Web Push ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { title: 'NEXT_LEVEL', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'NEXT_LEVEL';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/images/nextlevel-logo.jpg',
    badge: '/images/nextlevel-logo.jpg',
    tag: data.tag || undefined,
    data: { url: data.url || '/dashboard' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { try { c.navigate(url); } catch (e) {} return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
