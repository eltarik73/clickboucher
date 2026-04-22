// src/app/(client)/decouvrir/NearbyShops.tsx — Client-side geolocation-aware shop list
"use client";

import { useEffect, useState, useCallback } from "react";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";
import { MapPin, Loader2 } from "lucide-react";

type Props = {
  initialShops: ShopCardData[];
  favoriteIds: string[];
};

export default function NearbyShops({ initialShops, favoriteIds }: Props) {
  const [shops, setShops] = useState<ShopCardData[]>(initialShops);
  const [loading, setLoading] = useState(false);
  const [geoActive, setGeoActive] = useState(false);
  // Hydrate favorites client-side so the homepage stays ISR-cacheable (no auth() on server)
  const [hydratedFavorites, setHydratedFavorites] = useState<string[]>(favoriteIds);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/favorites", { credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const ids = Array.isArray(json?.data)
          ? json.data.map((s: { id: string }) => s.id)
          : [];
        if (!cancelled) setHydratedFavorites(ids);
      } catch {
        // Keep initial favorites on error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shops/nearby?lat=${lat}&lng=${lng}&radius=15`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setShops(json.data);
        setGeoActive(true);
      }
    } catch {
      // Keep initial shops on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Check localStorage for cached position on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("klikgo-geo");
      if (raw) {
        const cached = JSON.parse(raw);
        const lat = Number(cached.lat);
        const lng = Number(cached.lng);
        if (isFinite(lat) && isFinite(lng) && lat !== 0 && lng !== 0 && Date.now() - cached.ts < 86400000) {
          fetchNearby(lat, lng);
        }
      }
    } catch {}
  }, [fetchNearby]);

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
    <>
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Recherche des boucheries proches...</span>
        </div>
      )}

      {/* Split open / closed */}
      {(() => {
        const openShops = shops.filter(s => s.status === "OPEN" || s.status === "BUSY");
        const closedShops = shops.filter(s => !["OPEN", "BUSY"].includes(s.status));

        return (
          <>
            {/* ── Open shops ── */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
                    {geoActive ? "Boucheries ouvertes proches" : "Boucheries ouvertes"}
                  </h2>
                  {openShops.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
                      {openShops.length}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  {openShops.length > 0
                    ? `${openShops.length} boucherie${openShops.length > 1 ? "s" : ""} prête${openShops.length > 1 ? "s" : ""} à vous servir`
                    : "Aucune boucherie ouverte pour le moment"}
                </p>
              </div>
            </div>

            {openShops.length === 0 && !loading && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-white/[0.06] mb-10">
                <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  Aucune boucherie ouverte en ce moment
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Revenez bientôt ou consultez les boucheries ci-dessous
                </p>
              </div>
            )}

            {openShops.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1 h-6 bg-gray-300 dark:bg-gray-600 rounded-full" />
                  <h2 className="text-xl font-bold text-gray-500 dark:text-gray-400 font-display">
                    Actuellement fermées
                  </h2>
                  <span className="ml-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold rounded-full">
                    {closedShops.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 opacity-60 grayscale">
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
    </>
  );
}

