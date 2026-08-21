// CACHE versionado: cambiar en cada deploy de Studio para forzar purga de shell viejo.
// El shell incluye index.html que referencia assets hasheados; un CACHE viejo serviria
// index.html viejo con assets viejos o index.html nuevo con assets viejos cacheados.
const CACHE = "solara-studio-shell-v3";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/solara-mark.svg"];
const ASSET_CACHE = "solara-studio-assets-v1";
const SHELL_CACHE_PREFIX = "solara-studio-shell-";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(SHELL_CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/__solara/")) return;
  if (url.pathname.startsWith("/fixtures/")) return;
  if (url.pathname.startsWith("/assets/") && /-[A-Za-z0-9]{8}\./.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request)
            .then((response) => {
              if (response.ok) {
                const copy = response.clone();
                caches
                  .open(ASSET_CACHE)
                  .then((c) => c.put(event.request, copy))
                  .catch(() => undefined);
              }
              return response;
            })
            .catch(() => caches.match(event.request));
        }),
      ),
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => undefined);
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("/index.html")),
      ),
  );
});
