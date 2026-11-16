// src/app/api/shops/nearby/route.ts — Shops by proximity (Haversine)
import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { apiCached, apiError, handleApiError } from "@/lib/api/errors";
import { listNearbyShops } from "@/lib/services/shops/nearby";
import { z } from "zod";

export const dynamic = "force-dynamic";

const nearbyQuerySchema = z.object({
  lat: z.coerce
    .number()
    .min(-90)
    .max(90)
    .refine((v) => isFinite(v), "Latitude invalide"),
  lng: z.coerce
    .number()
    .min(-180)
    .max(180)
    .refine((v) => isFinite(v), "Longitude invalide"),
  radius: z.coerce.number().min(1).max(100).default(15),
});

// The version changes with the shape of the cached cards: an entry of another shape is never read.
const CACHE_VERSION = 2;
const CACHE_TTL_SECONDS = 60;

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parseResult = nearbyQuerySchema.safeParse(params);

    if (!parseResult.success) {
      return apiError("VALIDATION_ERROR", "Paramètres lat/lng requis");
    }

    const { lat, lng, radius } = parseResult.data;

    // Coordinates rounded to ~1 km for cache hits; src/lib/redis.ts absorbs Redis errors.
    const cacheKey = `nearby:v${CACHE_VERSION}:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}`;
    const cached = await redis.get<unknown>(cacheKey);
    if (cached !== null) return apiCached(cached, CACHE_TTL_SECONDS);

    const cards = await listNearbyShops({ lat, lng, radiusKm: radius }, new Date());
    await redis.set(cacheKey, cards, { ex: CACHE_TTL_SECONDS });
    return apiCached(cards, CACHE_TTL_SECONDS);
  } catch (error) {
    return handleApiError(error, "shops/nearby");
  }
}
