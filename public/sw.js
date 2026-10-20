// Bump on any change to this file: activate() wipes every other cache, so a stale app shell from
// a previous deploy can never be served again.
const CACHE = "ino-casino-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigations: always network-first, keeping the last good HTML only as an offline fallback.
// Assets: only Vite's hashed /assets/* files are cached (their content never changes for a given
// name), so a cached index can never point at chunks a newer deploy has removed.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone(); // clone synchronously, before the page consumes the body
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r ?? Response.error()))
    );
    return;
  }

  if (!url.pathname.startsWith("/assets/")) return;

  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
