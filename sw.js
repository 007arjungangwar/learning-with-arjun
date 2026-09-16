const CACHE_NAME = "asg-tech-__BUILD_VERSION__";
const scopeUrl = new URL(self.registration.scope);
const offlineUrl = new URL("offline.html", scopeUrl).href;

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME)
        .then((cache) => cache.add(offlineUrl))
        .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys()
        .then((names) => Promise.all(names
            .filter((name) => name.startsWith("asg-tech-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name))))
        .then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== scopeUrl.origin ||
        !url.pathname.startsWith(scopeUrl.pathname)) return;
    if (url.pathname.endsWith("/sw.js")) return;

    const isPage = request.mode === "navigate" || url.pathname.endsWith(".html");
    const isVersionedAsset = url.searchParams.has("v") ||
        /\/assets\/.*\.[a-f0-9]{12}\.js$/.test(url.pathname);
    if (!isPage && !isVersionedAsset) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (!isPage && cached) return cached;
        try {
            const response = await fetch(request, {
                signal: AbortSignal.timeout(isPage ? 5000 : 10000)
            });
            if (response.ok) {
                event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
            }
            return response;
        } catch {
            return cached || (isPage && await cache.match(offlineUrl)) ||
                new Response("Temporarily unavailable. Please reconnect and retry.", {
                    status: 503, headers: { "Content-Type": "text/plain" }
                });
        }
    })());
});
