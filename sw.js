// Service worker sederhana: menyimpan tampilan aplikasi agar bisa dibuka tanpa sinyal.
const C = "stock-master-v1";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (!(u.origin === location.origin || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com")) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(C).then(c => c.put("/", cp)); return res; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(r);
    const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") c.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  }));
});
