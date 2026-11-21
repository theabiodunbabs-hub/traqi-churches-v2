// Traqi service worker: makes Traqi installable and shows the last copy of a page when the signal drops.
//
// It deliberately leaves the app's own files (/_next/...) and page data alone: the browser and Next.js
// handle those, and serving an old or wrong copy of them is what made screens flicker and jump.
// Only full page loads are handled, always from the network first, and a saved copy is used only
// for that same page, only when there is no network at all.
const CACHE = "traqi-pages-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  // Remove every older cache, including the one that stored app files
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate") return;
  const url = new URL(r.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)).catch(() => {}); }
        return res;
      })
      .catch(async () => (await caches.match(url.pathname)) || new Response(
        "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><title>Offline</title><body style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#1e1b4b'><div style='text-align:center'><h1>You're offline</h1><p>Traqi will be back as soon as the connection is.</p></div>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      )),
  );
});

self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { title: "Traqi", body: "Something needs you today." };
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: "/icon-192.png", badge: "/icon-192.png", data: d.url || "/today" }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(clients.openWindow(e.notification.data || "/today")); });
