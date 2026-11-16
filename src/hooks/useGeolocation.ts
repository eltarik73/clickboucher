// src/hooks/useGeolocation.ts — GPS + reverse geocoding + localStorage cache
"use client";

import { useEffect, useState, useCallback } from "react";

type GeoState = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  loading: boolean;
  error: string | null;
};

/** A position the visitor has just chosen (GPS or typed city). */
export type GeoPosition = { latitude: number; longitude: number };

// The visitor's last chosen position: written and read in this file only.
const STORAGE_KEY = "klikgo-geo";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The position the visitor chose in the last 24 hours (GPS or typed city), or null: nothing
 * cached, too old, unreadable, (0, 0), or storage blocked. Reads the clock: call it after mount.
 */
export function readCachedPosition(): (GeoPosition & { city: string | null }) | null {
  let entry: unknown;
  try {
    entry = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    // Storage blocked (private browsing) or an entry that is not JSON: no known position.
    return null;
  }
  if (typeof entry !== "object" || entry === null) return null;
  const { lat, lng, city, ts }: { lat?: unknown; lng?: unknown; city?: unknown; ts?: unknown } =
    entry;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || !isFiniteNumber(ts)) return null;
  // (0, 0) is the answer of a failed lookup, in the Gulf of Guinea: never a visitor's position.
  if ((lat === 0 && lng === 0) || Date.now() - ts > CACHE_MAX_AGE_MS) return null;
  return { latitude: lat, longitude: lng, city: typeof city === "string" ? city : null };
}

function saveCache(lat: number, lng: number, city: string | null) {
  if (!isFinite(lat) || !isFinite(lng)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, city, ts: Date.now() }));
  } catch {}
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
      { headers: { "User-Agent": "KlikGo/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.municipality ||
      null
    );
  } catch {
    return null;
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    city: null,
    loading: true,
    error: null,
  });

  // Load from cache on mount
  useEffect(() => {
    const cached = readCachedPosition();
    if (cached) {
      setState({ ...cached, loading: false, error: null });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // requestGPS and setManualCity resolve with the position they obtained, or null on failure, so
  // that the caller can announce an explicit choice; loading the cache at mount announces nothing.
  const requestGPS = useCallback(async (): Promise<GeoPosition | null> => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, loading: false, error: "Géolocalisation non supportée" }));
      return null;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const { latitude, longitude } = position.coords;
      const city = await reverseGeocode(latitude, longitude);

      saveCache(latitude, longitude, city);
      setState({ latitude, longitude, city, loading: false, error: null });

      // Save to server if logged in
      fetch("/api/users/me/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, city }),
      }).catch(() => {});
      return { latitude, longitude };
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      const msg =
        geoErr.code === 1
          ? "Permission refusée"
          : geoErr.code === 2
            ? "Position indisponible"
            : "Délai dépassé";
      setState((s) => ({ ...s, loading: false, error: msg }));
      return null;
    }
  }, []);

  const setManualCity = useCallback(async (city: string): Promise<GeoPosition | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Forward geocode city → lat/lng via Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=fr&accept-language=fr`,
        { headers: { "User-Agent": "KlikGo/1.0" } }
      );
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: "Service de geocodage indisponible" }));
        return null;
      }
      const results = await res.json();
      if (results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          setState((s) => ({ ...s, loading: false, error: "Coordonnees invalides" }));
          return null;
        }
        const resolvedCity = results[0].display_name?.split(",")[0] || city;
        saveCache(lat, lng, resolvedCity);
        setState({
          latitude: lat,
          longitude: lng,
          city: resolvedCity,
          loading: false,
          error: null,
        });

        fetch("/api/users/me/location", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lng, city: resolvedCity }),
        }).catch(() => {});
        return { latitude: lat, longitude: lng };
      }
      // City not found — set error, do NOT set city without coords
      setState((s) => ({ ...s, loading: false, error: "Ville introuvable" }));
      return null;
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Erreur lors du geocodage" }));
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ latitude: null, longitude: null, city: null, loading: false, error: null });
  }, []);

  return { ...state, requestGPS, setManualCity, clear };
}
