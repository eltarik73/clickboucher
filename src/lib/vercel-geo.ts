// src/lib/vercel-geo.ts — Read Vercel edge geo headers (no HTML5 prompt)
// Vercel auto-populates these for all requests:
//   x-vercel-ip-city, x-vercel-ip-country, x-vercel-ip-country-region,
//   x-vercel-ip-latitude, x-vercel-ip-longitude
// In dev they may be absent — callers should handle null fields.
import { headers } from "next/headers";

export type VercelGeo = {
  city: string | null;
  country: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
};

function parseFloatOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function getVercelGeo(): VercelGeo {
  const h = headers();
  const rawCity = h.get("x-vercel-ip-city");
  const city = rawCity ? decodeURIComponent(rawCity) : null;
  return {
    city,
    country: h.get("x-vercel-ip-country"),
    region: h.get("x-vercel-ip-country-region"),
    lat: parseFloatOrNull(h.get("x-vercel-ip-latitude")),
    lng: parseFloatOrNull(h.get("x-vercel-ip-longitude")),
  };
}
