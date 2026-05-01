"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { MapPin, LocateFixed, Loader2, AlertCircle } from "lucide-react";
import { ShopCard, type ShopCardData } from "@/components/shop/ShopCard";

// Lazy-load la map (Leaflet a besoin de window, ne build pas en SSR)
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 h-[400px] animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-500">Chargement de la carte…</span>
    </div>
  ),
});

type ShopWithGeo = ShopCardData & {
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
};

type Props = {
  shops: ShopWithGeo[];
};

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function GeoLocator({ shops }: Props) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);

  const requestLocation = () => {
    setLoading(true);
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("La géolocalisation n'est pas supportée par votre navigateur.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        const messages: Record<number, string> = {
          1: "Vous avez refusé l'accès à votre position. Activez la géolocalisation dans votre navigateur.",
          2: "Position indisponible. Vérifiez votre connexion ou réessayez.",
          3: "La géolocalisation a expiré. Réessayez.",
        };
        setError(messages[err.code] || "Erreur de géolocalisation.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const sortedShops = useMemo(() => {
    if (!userPos) return [];
    return shops
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        ...s,
        distance: haversineKm(userPos.lat, userPos.lng, s.latitude!, s.longitude!),
      }))
      .filter((s) => s.distance <= maxDistanceKm)
      .sort((a, b) => a.distance - b.distance);
  }, [userPos, shops, maxDistanceKm]);

  return (
    <div className="space-y-6">
      {/* Action button */}
      {!userPos && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3] dark:border-white/[0.06] p-6 text-center">
          <MapPin className="mx-auto text-[#DC2626] mb-3" size={36} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Activer la géolocalisation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-md mx-auto">
            Cliquez ci-dessous pour autoriser Klik&amp;Go à utiliser votre position. Votre localisation reste dans
            votre navigateur.
          </p>
          <button
            type="button"
            onClick={requestLocation}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#DC2626] text-white rounded-xl font-semibold hover:bg-[#b91c1c] transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Localisation en cours…
              </>
            ) : (
              <>
                <LocateFixed size={18} />
                Trouver les boucheries près de moi
              </>
            )}
          </button>
          {error && (
            <div className="mt-4 inline-flex items-start gap-2 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg px-3 py-2 max-w-md text-left">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {userPos && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{sortedShops.length}</strong> boucherie{sortedShops.length > 1 ? "s" : ""} halal dans un
              rayon de <strong>{maxDistanceKm} km</strong>
            </p>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="distance-filter" className="text-gray-600 dark:text-gray-400">
                Rayon :
              </label>
              <select
                id="distance-filter"
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                className="rounded-lg border border-[#ece8e3] dark:border-white/[0.06] bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
                <option value={500}>Toute la région</option>
              </select>
              <button
                type="button"
                onClick={requestLocation}
                className="ml-2 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
              >
                Actualiser
              </button>
            </div>
          </div>

          {sortedShops.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-[#ece8e3] dark:border-white/[0.06]">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                Aucune boucherie halal trouvée dans un rayon de {maxDistanceKm} km.
              </p>
              <p className="text-sm text-gray-400">Essayez d&apos;élargir votre zone de recherche.</p>
            </div>
          ) : (
            <>
              {/* Carte avec markers boucheries + position user */}
              <MapView
                userPos={userPos}
                shops={sortedShops
                  .filter((s) => s.latitude != null && s.longitude != null)
                  .map((s) => ({
                    id: s.id,
                    slug: s.slug,
                    name: s.name,
                    city: s.city,
                    address: s.address,
                    latitude: s.latitude!,
                    longitude: s.longitude!,
                    rating: s.rating,
                    distance: s.distance ?? undefined,
                  }))}
                maxDistanceKm={maxDistanceKm}
              />
              {/* Liste des boucheries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                {sortedShops.map((shop, idx) => (
                  <ShopCard key={shop.id} shop={shop} index={idx} showFavorite={false} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
