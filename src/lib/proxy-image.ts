// src/lib/proxy-image.ts — Helper to route blob/external image URLs through our same-origin proxy
// Why: some browsers / extensions / strict CSPs block direct <img src="https://*.public.blob.vercel-storage.com/...">
// Routing via /api/boucher/images/proxy avoids CORS, ad-blockers, and cross-origin image loads failing silently.

const PROXY_HOSTS = [
  ".public.blob.vercel-storage.com",
  ".replicate.delivery",
  "images.pexels.com",
  "images.unsplash.com",
];

export function proxied(url: string): string {
  if (!url) return url;
  // Leave same-origin and data/blob URIs alone
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  try {
    const u = new URL(url);
    const isExternal = PROXY_HOSTS.some(
      (h) => u.hostname === h.replace(/^\./, "") || u.hostname.endsWith(h)
    );
    if (!isExternal) return url;
    return `/api/boucher/images/proxy?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
