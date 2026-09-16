/*
 * Kibuli Procurement service worker. The build turns this into /sw.js, filling
 * in the version and the exact files it produced (see vite.config.ts).
 *
 * It keeps the app's own files on the device so the installed app opens without
 * internet. Data from the API is left alone here.
 */
const VERSION = "__VERSION__";
const APP_CACHE = `kibuli-app-${VERSION}`;
const FONT_CACHE = "kibuli-fonts";
const PRECACHE = __PRECACHE__;

// Saved files are looked up by address alone. Hosts add Vary headers (Origin,
// Accept, Accept-Encoding) that would otherwise stop a saved copy matching the
// browser's own request for it, and each version's files never change.
const BY_URL = { ignoreVary: true };

self.addEventListener("install", (event) => {
  event.waitUntil(saveApp().then(() => self.skipWaiting()));
});

async function saveApp() {
  const cache = await caches.open(APP_CACHE);
  await Promise.all(
    PRECACHE.map(async (path) => {
      // Skip the browser's own cache so this version saves this version's files.
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error(`Couldn't save ${path} (${response.status})`);
      // A redirected response can't answer a page load, so keep a plain copy.
      const copy = response.redirected
        ? new Response(await response.blob(), { status: response.status, headers: response.headers })
        : response;
      await cache.put(path, copy);
    })
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("kibuli-app-") && k !== APP_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Records come from the API; this worker doesn't touch them.
  if (url.pathname.startsWith("/api/")) return;

  // Pages: the network first, so an update shows as soon as it's deployed;
  // the saved app when there's no connection.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/index.html", BY_URL)) || Response.error())
    );
    return;
  }

  // The app's own files: the saved copy first. Each deploy saves a fresh set
  // under a new version, so the saved copy matches what's live.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request, BY_URL).then((hit) => hit || fetch(request)));
    return;
  }

  // The Inter typeface: keep a copy so text looks the same offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(request, BY_URL);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") cache.put(request, response.clone());
        return response;
      })
    );
  }
});
