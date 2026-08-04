const CACHE = "ino-casino-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Runtime cache-as-you-go: no precache manifest to keep in sync with Vite's hashed build output.
// Navigations go network-first (so app updates show up immediately); other GET assets are
// cache-first with a network fallback, so the app shell still loads offline once visited.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;

  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r ?? caches.match("/"))));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ??
        fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
    )
  );
});
