// Klik&Go — Service Worker
// Network First for API, Cache First for static assets, Offline fallback

const CACHE_NAME = "klikgo-v1";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

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
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes — always network, no cache
  if (url.pathname.startsWith("/api/")) return;

  // Skip Clerk auth routes
  if (url.pathname.startsWith("/v1/") || url.hostname.includes("clerk")) return;

  // Static assets (images, fonts, CSS, JS) — Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot|ico|wav|mp3)$/) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/sounds/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages — Network First with offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
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
