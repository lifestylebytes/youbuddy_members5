/* YouBuddy 비즈니스 영어 챌린지 8기 · Service Worker v1.2 */
const CACHE_NAME = 'youbuddy-8th-v1';

/* ── 설치: 핵심 앱 셸만 캐시 ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/8th/', '/8th/index.html'])
    ).catch(() => {})
  );
  self.skipWaiting();
});

/* ── 활성화: 이전 캐시 정리 ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: 네트워크 우선, 실패 시 캐시 ── */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // HTML(내비게이션)은 브라우저 HTTP 캐시(GH Pages max-age 10분)를 우회해
  // 배포가 다음 리로드에 바로 반영되게. 나머지 리소스는 기본 캐시 정책.
  const isDoc = e.request.mode === 'navigate' || (e.request.destination === 'document');
  e.respondWith(
    fetch(isDoc ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then((res) => {
        if (res.ok && e.request.url.includes('/8th/')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ── Push: 알림 표시 ── */
self.addEventListener('push', (e) => {
  let data = { title: 'YouBuddy', body: '새 알림이 있어요', tag: 'default', url: '/8th/' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='40' fill='%232E6B4F'/%3E%3Ctext x='96' y='140' font-family='Arial,Helvetica,sans-serif' font-size='130' font-weight='700' fill='%23ffffff' text-anchor='middle'%3Ey%3C/text%3E%3C/svg%3E",
      badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='20' fill='%232E6B4F'/%3E%3Ctext x='48' y='70' font-family='Arial' font-size='64' font-weight='700' fill='white' text-anchor='middle'%3Ey%3C/text%3E%3C/svg%3E",
      tag: data.tag,
      requireInteraction: false,
      data: { url: data.url || '/8th/' }
    })
  );
});

/* ── Notification click: 앱으로 이동 ── */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/8th/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const existing = cs.find((c) => c.url.includes('/8th/'));
      if (existing) { existing.focus(); return; }
      return clients.openWindow(target);
    })
  );
});
