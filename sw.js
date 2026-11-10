// Keeps the whole app on the phone, so it opens at once and works with no
// signal. Everything in offline-files.json is fetched when a version installs
// and served from that copy afterwards; nothing is fetched piecemeal later.
//
// A new version installs in the background and then waits. The page tells it
// when to take over ("activate"), which it does only when no workout is in
// progress (js/platform/updates.js).

// Stamped by tools/app/offline-list.mjs with a hash of every file in the app.
const BUILD = "1d468b5dc97b";

const CACHE_PREFIX = "brin-gym-";
const CACHE = `${CACHE_PREFIX}${BUILD}`;
const LIST_URL = "offline-files.json";
const SHELL_URL = "index.html";

// Opened once for the life of the worker, not once per request.
let opened = null;
const openCache = () => (opened ??= caches.open(CACHE));

async function keepEverything() {
  const response = await fetch(LIST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`The offline list did not load (${response.status}).`);
  const list = await response.json();
  // Mid-publish, the list can belong to a different build than this worker.
  // Failing the install here is safe: the browser tries again on its next check.
  if (list.build !== BUILD) throw new Error("The offline list belongs to another build.");

  const cache = await openCache();
  await cache.addAll(list.files.map((file) => new Request(file, { cache: "reload" })));
}

async function takeOver() {
  const names = await caches.keys();
  const old = names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE);
  await Promise.all(old.map((name) => caches.delete(name)));
  await self.clients.claim();
}

async function fromThePhone(request) {
  const cache = await openCache();
  const kept =
    request.mode === "navigate"
      ? await cache.match(SHELL_URL)
      : await cache.match(request, { ignoreSearch: true });
  return kept ?? fetch(request);
}

self.addEventListener("install", (event) => event.waitUntil(keepEverything()));
self.addEventListener("activate", (event) => event.waitUntil(takeOver()));

self.addEventListener("message", (event) => {
  if (event.data?.type === "activate") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const sameSite = new URL(request.url).origin === self.location.origin;
  if (request.method === "GET" && sameSite) event.respondWith(fromThePhone(request));
});
