/* Tirkha offline shell and immutable map-asset cache. Personalized/API traffic is network-only. */
const VERSION = "tirkha-shell-v1";
const STATIC_CACHE = `${VERSION}-static`;
const MAP_CACHE = `${VERSION}-map-data`;
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/pwa-192.png", "/pwa-512.png", "/apple-touch-icon.png", "/tirkha-mark.svg"];
const STATIC_LIMIT = 240;
const MAP_LIMIT = 180;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(PRECACHE.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if (response.ok) await cache.put(path, response);
    }));
    // Cache only the immutable asset URLs referenced by the landing HTML. The
    // HTML itself is deliberately not stored because it may contain user state.
    try {
      const response = await fetch("/", { cache: "no-store" });
      if (response.ok) {
        const html = await response.text();
        const urls = new Set([...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)].map((match) => match[1]));
        await Promise.allSettled([...urls].slice(0, 120).map(async (path) => {
          const assetUrl = new URL(path, self.location.origin);
          if (assetUrl.origin !== self.location.origin) return;
          const asset = await fetch(assetUrl.href);
          if (asset.ok) await cacheBounded(STATIC_CACHE, assetUrl.href, asset, STATIC_LIMIT);
        }));
      }
    } catch {
      // Install can proceed with the smaller static precache when offline.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("tirkha-") && name !== STATIC_CACHE && name !== MAP_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cacheBounded(cacheName, request, response, limit) {
  if (!response || !response.ok || response.type === "opaque") return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    for (const oldRequest of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(oldRequest);
  } catch {
    // Quota pressure must never break an otherwise successful map asset fetch.
  }
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cacheBounded(STATIC_CACHE, request, response, STATIC_LIMIT);
  return response;
}

async function spatialAsset(request) {
  const cache = await caches.open(MAP_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    void cacheBounded(MAP_CACHE, request, response, MAP_LIMIT).catch(() => undefined);
    return response;
  });
  if (cached) {
    void refresh.catch(() => undefined);
    return cached;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Auth, payments, bookings, Supabase and other API requests are never cached.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.open(STATIC_CACHE)).match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
    return;
  }
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(spatialAsset(request));
    return;
  }
  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/pwa-") || url.pathname === "/apple-touch-icon.png" || url.pathname === "/tirkha-mark.svg") {
    event.respondWith(staticAsset(request));
  }
});

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "WARM_STATIC" || !Array.isArray(message.urls)) return;
  event.waitUntil(Promise.allSettled(message.urls.slice(0, 120).map(async (value) => {
    if (typeof value !== "string") return;
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return;
    const cache = await caches.open(STATIC_CACHE);
    if (await cache.match(url.href)) return;
    const response = await fetch(url.href);
    if (response.ok) await cacheBounded(STATIC_CACHE, url.href, response, STATIC_LIMIT);
  })));
});
