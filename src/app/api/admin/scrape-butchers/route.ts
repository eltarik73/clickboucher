/**
 * POST /api/admin/scrape-butchers
 *
 * Scrape les boucheries halal d'une ville via Google Places API,
 * upsert dans la table `prospects` (source GOOGLE_PLACES).
 *
 * Body : { city: string, radiusKm?: number, query?: string }
 *
 * Auth : admin/webmaster requis.
 *
 * Env requis :
 *   - GOOGLE_PLACES_API_KEY (Vercel env var, server-only)
 *
 * Sprint 10 — annuaire local mai 2026.
 *
 * Note Vercel : si > 60 places à scrape, le timeout 60s peut être atteint.
 * Cas typique = OK car la plupart des villes ont 5-30 boucheries halal.
 */

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro

import { NextResponse } from "next/server";
import { z } from "zod";
import { Client, Language, type PlaceType1, Status } from "@googlemaps/google-maps-services-js";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  city: z.string().min(2).max(50),
  radiusKm: z.number().min(1).max(50).default(15),
  query: z.string().min(2).max(100).default("boucherie halal"),
});

type ScrapedButcher = {
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string | null;
  googleUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string;
};

function extractZipAndCity(formattedAddress: string, fallbackCity: string): { zipCode: string; city: string } {
  const match = formattedAddress.match(/(\d{5})\s+([^,]+)/);
  if (match) return { zipCode: match[1], city: match[2].trim() };
  return { zipCode: "", city: fallbackCity };
}

function extractStreetAddress(formattedAddress: string): string {
  const match = formattedAddress.match(/^(.+?),\s*\d{5}/);
  if (match) return match[1].trim();
  return formattedAddress.split(",")[0].trim();
}

function isButcherShop(types: string[] | undefined): boolean {
  if (!types || types.length === 0) return true;
  return types.some((t) => ["food", "store", "establishment", "point_of_interest"].includes(t));
}

const client = new Client({});

async function geocodeCity(city: string, apiKey: string): Promise<{ lat: number; lng: number }> {
  const res = await client.geocode({
    params: { address: `${city}, France`, key: apiKey, language: "fr" as Language, region: "fr" },
    timeout: 10_000,
  });
  if (res.data.status !== Status.OK || res.data.results.length === 0) {
    throw new Error(`Geocoding failed for "${city}": ${res.data.status}`);
  }
  const loc = res.data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

async function nearbySearchAll(
  location: { lat: number; lng: number },
  radiusMeters: number,
  keyword: string,
  apiKey: string,
): Promise<string[]> {
  const placeIds: string[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const res = await client.placesNearby({
      params: {
        location,
        radius: Math.min(radiusMeters, 50_000),
        keyword,
        type: "food" as unknown as PlaceType1,
        key: apiKey,
        language: "fr" as Language,
        ...(pageToken ? { pagetoken: pageToken } : {}),
      },
      timeout: 10_000,
    });

    if (res.data.status === Status.OVER_QUERY_LIMIT) {
      throw new Error("OVER_QUERY_LIMIT: Google Places quota exceeded");
    }
    if (res.data.status !== Status.OK && res.data.status !== Status.ZERO_RESULTS) {
      throw new Error(`Places Nearby Search failed: ${res.data.status}`);
    }

    for (const result of res.data.results) {
      if (result.place_id && isButcherShop(result.types)) {
        placeIds.push(result.place_id);
      }
    }

    pageToken = res.data.next_page_token;
    page += 1;
    if (pageToken && page < 3) {
      await new Promise((r) => setTimeout(r, 2_500));
    } else {
      pageToken = undefined;
    }
  } while (pageToken);

  return Array.from(new Set(placeIds));
}

async function fetchDetails(
  placeId: string,
  fallbackCity: string,
  apiKey: string,
): Promise<ScrapedButcher | null> {
  const res = await client.placeDetails({
    params: {
      place_id: placeId,
      key: apiKey,
      language: "fr" as Language,
      fields: ["name", "formatted_address", "formatted_phone_number", "url", "rating", "user_ratings_total"],
    },
    timeout: 10_000,
  });

  if (res.data.status !== Status.OK) return null;
  const r = res.data.result;
  if (!r.name || !r.formatted_address) return null;

  const { zipCode, city } = extractZipAndCity(r.formatted_address, fallbackCity);

  return {
    name: r.name,
    address: extractStreetAddress(r.formatted_address),
    city,
    zipCode,
    phone: r.formatted_phone_number ?? null,
    googleUrl: r.url ?? null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviewCount: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    googlePlaceId: placeId,
  };
}

export async function POST(req: Request) {
  // Auth admin
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "GOOGLE_PLACES_API_KEY not configured",
        hint: "Add the env var on Vercel → Project Settings → Environment Variables",
      },
      { status: 500 },
    );
  }

  // Body validation
  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "Invalid body", details: String(err) }, { status: 400 });
  }

  const { city, radiusKm, query } = body;

  try {
    // 1. Geocode city
    const location = await geocodeCity(city, apiKey);

    // 2. Nearby search (up to 60 results across 3 pages)
    const placeIds = await nearbySearchAll(location, radiusKm * 1000, query, apiKey);

    if (placeIds.length === 0) {
      return NextResponse.json({
        ok: true,
        city,
        scraped: 0,
        upserted: 0,
        message: `Aucun résultat Google Places pour "${query}" à ${city}`,
      });
    }

    // 3. Fetch details for each place
    const butchers: ScrapedButcher[] = [];
    for (const placeId of placeIds) {
      const detail = await fetchDetails(placeId, city, apiKey);
      if (detail) butchers.push(detail);
    }

    // 4. Upsert in DB
    let upserted = 0;
    for (const b of butchers) {
      try {
        await prisma.prospect.upsert({
          where: { googlePlaceId: b.googlePlaceId },
          update: {
            name: b.name,
            address: b.address,
            city: b.city,
            zipCode: b.zipCode || undefined,
            phone: b.phone || undefined,
            googleUrl: b.googleUrl || undefined,
            rating: b.rating || undefined,
            reviewCount: b.reviewCount || undefined,
          },
          create: {
            name: b.name,
            address: b.address,
            city: b.city,
            zipCode: b.zipCode || undefined,
            phone: b.phone || undefined,
            googleUrl: b.googleUrl || undefined,
            googlePlaceId: b.googlePlaceId,
            rating: b.rating || undefined,
            reviewCount: b.reviewCount || undefined,
            source: "GOOGLE_PLACES",
            status: "NEW",
          },
        });
        upserted++;
      } catch (err) {
        logger.warn(`[scrape-butchers] upsert failed for ${b.name}: ${String(err)}`);
      }
    }

    logger.info(`[scrape-butchers] city=${city} scraped=${butchers.length} upserted=${upserted}`);

    return NextResponse.json({
      ok: true,
      city,
      query,
      radiusKm,
      placesFound: placeIds.length,
      scraped: butchers.length,
      upserted,
      sample: butchers.slice(0, 5).map((b) => ({ name: b.name, address: b.address, rating: b.rating })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[scrape-butchers] failed for ${city}: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
