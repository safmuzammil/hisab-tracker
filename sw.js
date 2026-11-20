const CACHE_NAME = 'hisab-v25';
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './styles.css',
    './lib/core.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-96.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return; // Pass serverless API requests directly to network
    event.respondWith(
        fetch(event.request)
            .then(response => {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// ---------- Background push (FCM data messages sent by /api/send-reminders) ----------
self.addEventListener('push', event => {
    let p = {};
    try { p = event.data ? event.data.json() : {}; } catch (e) { p = { data: { title: 'Hisab', body: event.data && event.data.text() } }; }
    const d = p.data || p.notification || p;
    const title = d.title || 'Hisab';
    const actions = [];
    if (d.kind === 'task') actions.push({ action: 'done', title: '✓ Done' }, { action: 'snooze10', title: 'Snooze 10m' }, { action: 'snooze60', title: '1 hour' });
    if (d.kind === 'bill') actions.push({ action: 'billpaid', title: 'Mark paid' });
    event.waitUntil(self.registration.showNotification(title, {
        body: d.body || '',
        tag: d.tag || undefined,
        icon: './icons/icon-192.png',
        badge: './icons/icon-96.png',
        requireInteraction: d.kind === 'task',
        vibrate: [200, 100, 200],
        data: d,
        actions
    }));
});

// ---------- Notification clicks & action buttons ----------
self.addEventListener('notificationclick', event => {
    const n = event.notification;
    const d = n.data || {};
    const action = event.action || 'open';
    n.close();

    event.waitUntil((async () => {
        // Snooze from a server push: handled in the background, no need to open the app.
        if ((action === 'snooze10' || action === 'snooze60') && d.sig && d.uid) {
            try {
                const r = await fetch('./api/reminder-action', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: d.uid, taskId: d.taskId, minutes: action === 'snooze10' ? 10 : 60, exp: d.exp, sig: d.sig })
                });
                if (r.ok) return;
            } catch (e) { /* fall through to opening the app */ }
        }
        const msg = { type: 'hisab-notif', action, taskId: d.taskId || null, billId: d.billId || null, kind: d.kind || null };
        const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (list.length) {
            const c = list[0];
            c.postMessage(msg);
            if ('focus' in c) return c.focus();
            return;
        }
        const q = new URLSearchParams();
        q.set('na', action);
        if (msg.taskId) q.set('task', msg.taskId);
        if (msg.billId) q.set('bill', msg.billId);
        if (msg.kind) q.set('kind', msg.kind);
        if (clients.openWindow) return clients.openWindow('./?' + q.toString() + '#dashboard');
    })());
});
