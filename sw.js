// BooBly Service Worker (v1_4_3_Alpha)
const VERSION = 'v1_4_3_Alpha';
const STATIC_CACHE = `boobly-static-${VERSION}`;
const RUNTIME_CACHE = `boobly-runtime-${VERSION}`;

// App shell assets (precache)
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.v1_4_3_Alpha.js",
  "./database.json",
  "./prompts.json",
  "./changelog.json",
  "./presets.json",
  "./master_file_v1_4_3_Alpha.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/favicon.png",
  "./icons/preset.png",
  "./assets/presets/preset_01.png",
  "./assets/presets/preset_02.png",
  "./assets/presets/preset_03.png",
  "./assets/presets/preset_04.png",
  "./assets/presets/preset_05.png",
  "./assets/presets/preset_06.png",
  "./assets/presets/preset_07.png"
];

// Runtime cache size cap (best-effort)
const RUNTIME_MAX_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== STATIC_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

async function trimRuntimeCache() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    if (keys.length <= RUNTIME_MAX_ENTRIES) return;
    const toDelete = keys.slice(0, keys.length - RUNTIME_MAX_ENTRIES);
    await Promise.all(toDelete.map((req) => cache.delete(req)));
  } catch {
    // ignore
  }
}

function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fallback to cached app shell
  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        // Serve cached app shell; ignore querystring via explicit match list
        const cached = await caches.match('./index.html');
        return cached || caches.match('./');
      }
    })());
    return;
  }

  // Static assets: cache-first
  if (ASSETS.includes(url.pathname === '/' ? './' : `.${url.pathname}`)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    })());
    return;
  }

  // Other same-origin GET: stale-while-revalidate into runtime cache
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then(async (resp) => {
      if (resp.ok) {
        await cache.put(req, resp.clone());
        trimRuntimeCache();
      }
      return resp;
    }).catch(() => null);

    return cached || (await fetchPromise) || cached;
  })());
});
