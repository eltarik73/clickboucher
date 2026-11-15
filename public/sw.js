// Klik&Go — Service Worker
// Navigations : réseau seul, /offline.html si le réseau manque ; aucune page n'est stockée.
// Fichiers statiques de même origine : cache d'abord, stockés seulement si la réponse le permet.
// Tout le reste (API, charges RSC, /_next/image, autres origines) n'est pas intercepté.

// Incrémenter à chaque modification de ce fichier : activate supprime tout autre cache.
const CACHE_NAME = "klikgo-v2";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const STATIC_EXTENSION = /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico|wav|mp3)$/;
const STATIC_PREFIXES = ["/icons/", "/images/", "/sounds/", "/_next/static/"];

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (STATIC_EXTENSION.test(url.pathname) ||
      STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)))
  );
}

// Seule une réponse 200 de même origine, ni `private` ni `no-store`, entre dans Cache Storage.
function isStorable(response) {
  if (response.status !== 200 || response.type !== "basic") return false;
  const cacheControl = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !cacheControl.includes("no-store") && !cacheControl.includes("private");
}

// ── Install: pre-cache essentials ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/v1/") || url.hostname.includes("clerk")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (isStorable(response)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
    )
  );
});

// ── Push Notifications ──
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "Klik&Go";
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
      vibrate: [200, 100, 200],
    };

    // Tag for grouping/replacing notifications per order
    if (payload.tag) {
      options.tag = payload.tag;
      options.renotify = true; // Re-alert even if replacing same tag
    }

    // Action buttons (max 2 on most platforms)
    if (payload.actions && payload.actions.length > 0) {
      options.actions = payload.actions.slice(0, 2);
    }

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error("[SW] Push parse error:", e);
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = event.notification.data?.url || "/";

  // Handle action button clicks
  if (event.action === "track" || event.action === "view" || event.action === "rate") {
    // All actions navigate to the notification URL (order page)
    url = event.notification.data?.url || "/commandes";
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Try to focus an existing tab with this URL
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Try to navigate an existing tab
        for (var j = 0; j < clientList.length; j++) {
          var client2 = clientList[j];
          if ("navigate" in client2) {
            return client2.navigate(url).then(function (c) {
              return c.focus();
            });
          }
        }
        // Open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
