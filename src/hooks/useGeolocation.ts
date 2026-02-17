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

const STORAGE_KEY = "klikgo-geo";

function loadCached(): GeoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Cache valid for 24h
    if (Date.now() - cached.ts > 86400000) return null;
    return {
      latitude: cached.lat,
      longitude: cached.lng,
      city: cached.city,
      loading: false,
      error: null,
    };
  } catch {
    return null;
  }
}

function saveCache(lat: number, lng: number, city: string | null) {
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
    return data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || null;
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
    const cached = loadCached();
    if (cached) {
      setState(cached);
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const requestGPS = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, loading: false, error: "Géolocalisation non supportée" }));
      return;
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
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      const msg =
        geoErr.code === 1
          ? "Permission refusée"
          : geoErr.code === 2
          ? "Position indisponible"
          : "Délai dépassé";
      setState((s) => ({ ...s, loading: false, error: msg }));
    }
  }, []);

  const setManualCity = useCallback(async (city: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // Forward geocode city → lat/lng via Nominatim
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=fr&accept-language=fr`,
        { headers: { "User-Agent": "KlikGo/1.0" } }
      );
      if (res.ok) {
        const results = await res.json();
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          const resolvedCity = results[0].display_name?.split(",")[0] || city;
          saveCache(lat, lng, resolvedCity);
          setState({ latitude: lat, longitude: lng, city: resolvedCity, loading: false, error: null });

          fetch("/api/users/me/location", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng, city: resolvedCity }),
          }).catch(() => {});
          return;
        }
      }
      // Fallback: just set city without coords
      setState({ latitude: null, longitude: null, city, loading: false, error: null });
    } catch {
      setState({ latitude: null, longitude: null, city, loading: false, error: null });
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ latitude: null, longitude: null, city: null, loading: false, error: null });
  }, []);

  return { ...state, requestGPS, setManualCity, clear };
}
