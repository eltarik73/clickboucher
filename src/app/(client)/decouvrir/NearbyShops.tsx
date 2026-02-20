// src/app/(client)/decouvrir/NearbyShops.tsx — Client-side geolocation-aware shop list
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import LocationPicker from "@/components/location/LocationPicker";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { StarRating } from "@/components/ui/StarRating";
import { getShopImage } from "@/lib/product-images";
import { MapPin, Loader2 } from "lucide-react";

const SHOP_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' fill='%23e5e7eb'%3E%3Crect width='600' height='400'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='48' fill='%239ca3af'%3E🏪%3C/text%3E%3C/svg%3E";

type ShopData = {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  imageUrl: string | null;
  prepTimeMin: number;
  busyMode: boolean;
  busyExtraMin: number;
  status: string;
  rating: number;
  ratingCount: number;
  distance: number | null;
};

type Props = {
  initialShops: ShopData[];
  favoriteIds: string[];
};

export default function NearbyShops({ initialShops, favoriteIds }: Props) {
  const [shops, setShops] = useState<ShopData[]>(initialShops);
  const [loading, setLoading] = useState(false);
  const [geoActive, setGeoActive] = useState(false);

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
        if (cached.lat && cached.lng && Date.now() - cached.ts < 86400000) {
          fetchNearby(cached.lat, cached.lng);
        }
      }
    } catch {}
  }, [fetchNearby]);

  const handleLocationChange = (lat: number | null, lng: number | null) => {
    if (lat !== null && lng !== null) {
      fetchNearby(lat, lng);
    } else {
      setShops(initialShops);
      setGeoActive(false);
    }
  };

  const favSet = new Set(favoriteIds);

  return (
    <>
      {/* Location picker */}
      <div className="mb-6">
        <LocationPicker
          onLocationChange={(lat, lng) => handleLocationChange(lat, lng)}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          <span className="ml-2 text-sm text-gray-500">Recherche des boucheries proches...</span>
        </div>
      )}

      {/* Subtitle */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-[#DC2626] rounded-full" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
              {geoActive ? "Boucheries proches" : "Boucheries disponibles"}
            </h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {shops.length > 0
              ? `${shops.length} boucherie${shops.length > 1 ? "s" : ""}${geoActive ? " à proximité" : " près de chez vous"}`
              : "Aucune boucherie disponible pour le moment"}
          </p>
        </div>
      </div>

      {/* No shops nearby message */}
      {geoActive && shops.length === 0 && !loading && (
        <div className="text-center py-12 bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.06]">
          <MapPin className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Aucune boucherie trouvée à proximité
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Essayez un rayon plus large ou changez de ville
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {shops.map((shop, i) => (
          <NearbyButcherCard
            key={shop.id}
            shop={shop}
            index={i}
            isFavorite={favSet.has(shop.id)}
          />
        ))}
      </div>
    </>
  );
}

function NearbyButcherCard({
  shop,
  index,
  isFavorite,
}: {
  shop: ShopData;
  index: number;
  isFavorite: boolean;
}) {
  const effectiveTime = shop.prepTimeMin + (shop.busyMode ? shop.busyExtraMin : 0);
  const imgSrc = shop.imageUrl || getShopImage(index);

  const prepBadgeClasses =
    effectiveTime <= 15
      ? "bg-emerald-500/90 text-white"
      : effectiveTime <= 30
        ? "bg-amber-500/90 text-white"
        : "bg-red-500/90 text-white";

  return (
    <Link
      href={`/boutique/${shop.slug}`}
      className={`group bg-white dark:bg-white/[0.03] border border-[#ece8e3] dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
        shop.status === "CLOSED" || shop.status === "VACATION" ? "opacity-60" : ""
      }`}
    >
      {/* Image */}
      <div className="relative h-36 sm:h-48 overflow-hidden">
        <Image
          src={imgSrc}
          alt={shop.name}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          quality={75}
          onError={(e) => { (e.target as HTMLImageElement).src = SHOP_PLACEHOLDER; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {shop.status === "OPEN" || shop.status === "BUSY" ? (
            <span className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${prepBadgeClasses}`}>
              {effectiveTime <= 15 && (
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              )}
              {effectiveTime} min
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-600/90 text-white text-xs font-semibold rounded-lg">
              Fermé
            </span>
          )}
          {shop.status === "BUSY" && (
            <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-semibold rounded-lg">
              Occupé
            </span>
          )}
        </div>

        {/* Top-right: favorite + distance or city */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <FavoriteButton shopId={shop.id} initialFavorite={isFavorite} size={22} />
          {shop.distance !== null ? (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-sm text-gray-800 dark:text-white text-xs font-semibold rounded-lg">
              <MapPin className="w-3 h-3 text-red-600" />
              {shop.distance} km
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-sm text-gray-800 dark:text-white text-xs font-semibold rounded-lg">
              {shop.city}
            </span>
          )}
        </div>

        {/* Hover CTA */}
        {(shop.status === "OPEN" || shop.status === "BUSY") && (
          <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <span className="block w-full py-2.5 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white font-semibold rounded-xl shadow-lg text-center text-sm">
              Voir la boutique
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-[#DC2626] transition-colors font-display">
          {shop.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {shop.address}, {shop.city}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg">
            <StarRating value={Math.round(shop.rating)} size="sm" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {shop.rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">({shop.ratingCount})</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
