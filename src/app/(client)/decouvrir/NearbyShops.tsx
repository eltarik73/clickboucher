// src/app/(client)/decouvrir/NearbyShops.tsx — Home shop list, sorted by distance once the
// visitor's position is known.
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";
import { MapPin, Loader2 } from "lucide-react";
import { hasTestModeCookie } from "@/lib/test-mode-client";

type Props = {
  initialShops: ShopCardData[];
  favoriteIds: string[];
};

// Written by useGeolocation (src/hooks/useGeolocation.ts) after the visitor asked to be located.
const GEO_CACHE_KEY = "klikgo-geo";
const GEO_CACHE_MAX_AGE_MS = 86_400_000;

/** The position the visitor chose in the last 24 hours, or null. */
function readCachedPosition(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const lat = Number(cached.lat);
    const lng = Number(cached.lng);
    const fresh = Date.now() - Number(cached.ts) < GEO_CACHE_MAX_AGE_MS;
    return isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0 && fresh ? { lat, lng } : null;
  } catch {
    // Storage blocked (private browsing) or an unreadable entry: no known position.
    return null;
  }
}

export default function NearbyShops({ initialShops, favoriteIds }: Props) {
  const [shops, setShops] = useState<ShopCardData[]>(initialShops);
  const [loading, setLoading] = useState(false);
  const [geoActive, setGeoActive] = useState(false);
  // Hydrate favorites client-side so the homepage stays ISR-cacheable (no auth() on server)
  const [hydratedFavorites, setHydratedFavorites] = useState<string[]>(favoriteIds);
  // An anonymous view calls no API at mount (CLAUDE.md, « Coût CPU Vercel »): favorites and the
  // distance sort from a cached position are only loaded for a signed-in visitor or a test session.
  const { isLoaded, isSignedIn } = useAuth();
  const canCallApisAtMount = (isLoaded && !!isSignedIn) || hasTestModeCookie();

  useEffect(() => {
    if (!canCallApisAtMount) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/favorites", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const ids = Array.isArray(json?.data) ? json.data.map((s: { id: string }) => s.id) : [];
        if (!cancelled) setHydratedFavorites(ids);
      } catch {
        // Keep initial favorites on error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canCallApisAtMount]);

  // The verified ratings come with the server list only: a shop of the nearby list keeps the one
  // the server gave it, and never shows the rating fields the nearby API returns.
  const verifiedRatings = useMemo(
    () => new Map(initialShops.map((shop) => [shop.id, shop.verifiedRating ?? null])),
    [initialShops]
  );

  const fetchNearby = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/shops/nearby?lat=${lat}&lng=${lng}&radius=15`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setShops(
            json.data.map((shop: ShopCardData) => ({
              ...shop,
              verifiedRating: verifiedRatings.get(shop.id) ?? null,
            }))
          );
          setGeoActive(true);
        }
      } catch {
        // Network failure: the server-rendered list stays, still correct, only not sorted.
      } finally {
        setLoading(false);
      }
    },
    [verifiedRatings]
  );

  // A position the visitor chose earlier sorts the list at mount, under the same condition as
  // the favorites. Without it the server order stays: no implicit IP lookup.
  useEffect(() => {
    if (!canCallApisAtMount) return;
    const position = readCachedPosition();
    if (position) fetchNearby(position.lat, position.lng);
  }, [canCallApisAtMount, fetchNearby]);

  // Listen for location changes from LocationCard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.lat != null && detail?.lng != null) {
        fetchNearby(detail.lat, detail.lng);
      } else {
        setShops(initialShops);
        setGeoActive(false);
      }
    };
    window.addEventListener("klikgo-location", handler);
    return () => window.removeEventListener("klikgo-location", handler);
  }, [fetchNearby, initialShops]);

  const favSet = new Set(hydratedFavorites);

  return (
    <div className="relative">
      {/* Loading: an overlay out of the flow, so the headings and the grid never move */}
      {loading && (
        <div
          role="status"
          className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-[#f8f6f3]/70 pt-24 dark:bg-[#0a0a0a]/70"
        >
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-gray-600 shadow-md dark:bg-gray-800 dark:text-gray-300">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-red-600" />
            Recherche des boucheries proches…
          </span>
        </div>
      )}

      {/* Split open / closed */}
      {(() => {
        const openShops = shops.filter((s) => s.status === "OPEN" || s.status === "BUSY");
        const closedShops = shops.filter((s) => !["OPEN", "BUSY"].includes(s.status));

        return (
          <>
            {/* ── Open shops ── */}
            <div className="mb-6 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 rounded-full bg-emerald-500" />
                  <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
                    {geoActive ? "Boucheries ouvertes proches" : "Boucheries ouvertes"}
                  </h2>
                  {openShops.length > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {openShops.length}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  {openShops.length > 0
                    ? `${openShops.length} boucherie${openShops.length > 1 ? "s" : ""} prête${openShops.length > 1 ? "s" : ""} à vous servir`
                    : "Aucune boucherie ouverte pour le moment"}
                </p>
              </div>
            </div>

            {openShops.length === 0 && (
              <div className="mb-10 rounded-2xl border border-gray-200 bg-white py-12 text-center dark:border-white/[0.06] dark:bg-gray-800">
                <MapPin className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="font-medium text-gray-600 dark:text-gray-400">
                  Aucune boucherie ouverte en ce moment
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Revenez bientôt ou consultez les boucheries ci-dessous
                </p>
              </div>
            )}

            {openShops.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {openShops.map((shop, i) => (
                  <ShopCard
                    key={shop.id}
                    shop={shop}
                    index={i}
                    isFavorite={favSet.has(shop.id)}
                    priority={i < 2}
                  />
                ))}
              </div>
            )}

            {/* ── Closed shops ── */}
            {closedShops.length > 0 && (
              <div className="mt-12">
                <div className="mb-6 flex items-center gap-2">
                  <div className="h-6 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <h2 className="font-display text-xl font-bold text-gray-500 dark:text-gray-400">
                    Actuellement fermées
                  </h2>
                  <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {closedShops.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 grayscale sm:grid-cols-2">
                  {closedShops.map((shop, i) => (
                    <ShopCard
                      key={shop.id}
                      shop={shop}
                      index={openShops.length + i}
                      isFavorite={favSet.has(shop.id)}
                      priority={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
