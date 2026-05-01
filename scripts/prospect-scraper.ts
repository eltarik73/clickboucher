/**
 * KLIK&GO — Prospect Scraper (Google Places)
 *
 * Scrape les boucheries halal d'une ville française via l'API Google Places,
 * exporte en CSV et insère dans la table `prospects` (upsert sur googlePlaceId).
 *
 * Usage:
 *   npm run prospect -- --city="Lyon" --radius=15
 *   npm run prospect -- --city="Lyon" --radius=15 --query="boucherie halal" --output=csv
 *   npm run prospect -- --city="Lyon" --radius=15 --output=db
 *
 * Env requis:
 *   GOOGLE_PLACES_API_KEY (https://console.cloud.google.com/apis/credentials)
 *   DATABASE_URL (pour l'insert en base)
 */

import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client, Language, PlaceType1, Status } from "@googlemaps/google-maps-services-js";
import { prisma } from "../src/lib/prisma";
import { logger } from "../src/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type OutputMode = "csv" | "db" | "both";

interface ScrapedProspect {
  name: string;
  address: string;
  city: string;
  zipCode: string;
  phone: string;
  googleUrl: string;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string;
}

interface CliArgs {
  city: string;
  radiusKm: number;
  query: string;
  output: OutputMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseCli(): CliArgs {
  const { values } = parseArgs({
    options: {
      city: { type: "string" },
      radius: { type: "string" },
      query: { type: "string", default: "boucherie halal" },
      output: { type: "string", default: "both" },
    },
    allowPositionals: false,
    strict: false,
  });

  const city = typeof values.city === "string" ? values.city.trim() : "";
  const radiusStr = typeof values.radius === "string" ? values.radius : "10";
  const query = typeof values.query === "string" ? values.query : "boucherie halal";
  const output = (typeof values.output === "string" ? values.output : "both") as OutputMode;

  if (!city) {
    console.error("Error: --city is required (e.g. --city=\"Lyon\")");
    process.exit(1);
  }
  const radiusKm = Number.parseFloat(radiusStr);
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 50) {
    console.error("Error: --radius must be a positive number ≤ 50 (km)");
    process.exit(1);
  }
  if (!["csv", "db", "both"].includes(output)) {
    console.error("Error: --output must be one of: csv, db, both");
    process.exit(1);
  }

  return { city, radiusKm, query, output };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV helpers
// ─────────────────────────────────────────────────────────────────────────────

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(prospects: ScrapedProspect[]): string {
  const header = "name,address,city,zipCode,phone,googleUrl,rating,reviewCount,googlePlaceId";
  const lines = prospects.map((p) =>
    [
      csvEscape(p.name),
      csvEscape(p.address),
      csvEscape(p.city),
      csvEscape(p.zipCode),
      csvEscape(p.phone),
      csvEscape(p.googleUrl),
      csvEscape(p.rating),
      csvEscape(p.reviewCount),
      csvEscape(p.googlePlaceId),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayDateString(): string {
  // YYYY-MM-DD (UTC for stability across machines)
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Address parsing — extract zipCode + city from formatted_address
// ─────────────────────────────────────────────────────────────────────────────

function extractZipAndCity(formattedAddress: string, fallbackCity: string): { zipCode: string; city: string } {
  // French address pattern: "123 rue X, 69002 Lyon, France"
  const match = formattedAddress.match(/(\d{5})\s+([^,]+)/);
  if (match) {
    return { zipCode: match[1], city: match[2].trim() };
  }
  return { zipCode: "", city: fallbackCity };
}

function extractStreetAddress(formattedAddress: string): string {
  // Take everything before the first ", <zipcode>" segment
  const match = formattedAddress.match(/^(.+?),\s*\d{5}/);
  if (match) return match[1].trim();
  // Fallback: take first comma-separated chunk
  return formattedAddress.split(",")[0].trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards / helpers
// ─────────────────────────────────────────────────────────────────────────────

function isButcherShop(types: string[] | undefined): boolean {
  if (!types || types.length === 0) return true; // be permissive if no types
  return types.some((t) => ["food", "store", "establishment", "point_of_interest"].includes(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places — geocode + nearby search + details
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({});

async function geocodeCity(city: string, apiKey: string): Promise<{ lat: number; lng: number }> {
  const res = await client.geocode({
    params: {
      address: `${city}, France`,
      key: apiKey,
      language: "fr",
      region: "fr",
    },
    timeout: 10_000,
  });

  if (res.data.status !== Status.OK || res.data.results.length === 0) {
    throw new Error(`Geocoding failed for "${city}": ${res.data.status} ${res.data.error_message ?? ""}`);
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
  // Returns up to 60 place IDs (3 pages × 20). Google requires waiting
  // ~2s before next_page_token becomes valid.
  const placeIds: string[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    const res = await client.placesNearby({
      params: {
        location,
        radius: Math.min(radiusMeters, 50_000), // Google max = 50km
        keyword,
        // Use string literal — Google Places type "food" is supported but not in
        // the older PlaceType1 enum exposed by the SDK. The HTTP API accepts it.
        type: "food" as unknown as PlaceType1,
        key: apiKey,
        language: "fr" as Language,
        ...(pageToken ? { pagetoken: pageToken } : {}),
      },
      timeout: 10_000,
    });

    if (res.data.status === Status.OVER_QUERY_LIMIT) {
      throw new Error(
        "OVER_QUERY_LIMIT: Google Places quota exceeded. Check your billing/quota at https://console.cloud.google.com/apis/credentials",
      );
    }
    if (res.data.status !== Status.OK && res.data.status !== Status.ZERO_RESULTS) {
      throw new Error(`Places Nearby Search failed: ${res.data.status} ${res.data.error_message ?? ""}`);
    }

    for (const result of res.data.results) {
      if (result.place_id && isButcherShop(result.types)) {
        placeIds.push(result.place_id);
      }
    }

    pageToken = res.data.next_page_token;
    page += 1;

    if (pageToken && page < 3) {
      // Mandatory wait for next_page_token to activate
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
): Promise<ScrapedProspect | null> {
  const res = await client.placeDetails({
    params: {
      place_id: placeId,
      key: apiKey,
      language: "fr" as Language,
      // Cast: the SDK's Field union is restrictive; these are all valid Places fields.
      fields: [
        "name",
        "formatted_address",
        "formatted_phone_number",
        "international_phone_number",
        "url",
        "website",
        "rating",
        "user_ratings_total",
        "place_id",
        "types",
      ] as never,
    },
    timeout: 10_000,
  });

  if (res.data.status === Status.OVER_QUERY_LIMIT) {
    throw new Error(
      "OVER_QUERY_LIMIT: Google Places quota exceeded. Check your billing/quota at https://console.cloud.google.com/apis/credentials",
    );
  }
  if (res.data.status !== Status.OK) {
    logger.warn(`Place details failed for ${placeId}: ${res.data.status}`);
    return null;
  }

  const r = res.data.result;
  if (!r.name || !r.formatted_address || !r.place_id) return null;
  if (!isButcherShop(r.types)) return null;

  const { zipCode, city } = extractZipAndCity(r.formatted_address, fallbackCity);
  const street = extractStreetAddress(r.formatted_address);

  return {
    name: r.name,
    address: street,
    city,
    zipCode,
    phone: r.international_phone_number ?? r.formatted_phone_number ?? "",
    googleUrl: r.url ?? `https://www.google.com/maps/place/?q=place_id:${r.place_id}`,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviewCount: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    googlePlaceId: r.place_id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

async function writeCsvFile(prospects: ScrapedProspect[], city: string): Promise<string> {
  const outDir = path.resolve(process.cwd(), "prospect-scraper-output");
  await mkdir(outDir, { recursive: true });
  const filename = `${slugify(city)}-${todayDateString()}.csv`;
  const filepath = path.join(outDir, filename);
  await writeFile(filepath, toCsv(prospects), "utf8");
  return filepath;
}

async function upsertProspects(prospects: ScrapedProspect[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const p of prospects) {
    const existing = await prisma.prospect.findUnique({
      where: { googlePlaceId: p.googlePlaceId },
      select: { id: true },
    });

    await prisma.prospect.upsert({
      where: { googlePlaceId: p.googlePlaceId },
      create: {
        name: p.name,
        city: p.city,
        zipCode: p.zipCode || null,
        address: p.address || null,
        phone: p.phone || null,
        googlePlaceId: p.googlePlaceId,
        googleUrl: p.googleUrl,
        rating: p.rating,
        reviewCount: p.reviewCount,
        status: "NEW",
        source: "GOOGLE_PLACES",
      },
      update: {
        name: p.name,
        city: p.city,
        zipCode: p.zipCode || null,
        address: p.address || null,
        phone: p.phone || null,
        googleUrl: p.googleUrl,
        rating: p.rating,
        reviewCount: p.reviewCount,
        // Don't overwrite status / pipeline state on update.
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error(
      [
        "Error: GOOGLE_PLACES_API_KEY env var is missing.",
        "",
        "Create or retrieve a key at:",
        "  https://console.cloud.google.com/apis/credentials",
        "",
        "Enable the following APIs for the project:",
        "  - Places API",
        "  - Geocoding API",
        "",
        "Then export it:",
        '  export GOOGLE_PLACES_API_KEY="your-key-here"',
      ].join("\n"),
    );
    process.exit(1);
  }

  const args = parseCli();
  const radiusMeters = Math.round(args.radiusKm * 1000);

  logger.info("prospect-scraper start", {
    city: args.city,
    radiusKm: args.radiusKm,
    query: args.query,
    output: args.output,
  });

  try {
    // 1. Geocode
    console.log(`Geocoding "${args.city}"...`);
    const location = await geocodeCity(args.city, apiKey);
    console.log(`  → lat=${location.lat.toFixed(5)}, lng=${location.lng.toFixed(5)}`);

    // 2. Nearby search
    console.log(`Searching "${args.query}" within ${args.radiusKm}km...`);
    const placeIds = await nearbySearchAll(location, radiusMeters, args.query, apiKey);

    if (placeIds.length === 0) {
      console.log(`no halal butchers found in ${args.city}`);
      return;
    }
    console.log(`  → found ${placeIds.length} candidate place(s)`);

    // 3. Fetch details for each
    console.log(`Fetching place details...`);
    const prospects: ScrapedProspect[] = [];
    for (let i = 0; i < placeIds.length; i++) {
      const id = placeIds[i];
      try {
        const detail = await fetchDetails(id, args.city, apiKey);
        if (detail) {
          prospects.push(detail);
          process.stdout.write(`  [${i + 1}/${placeIds.length}] ${detail.name}\n`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("OVER_QUERY_LIMIT")) {
          throw err;
        }
        logger.warn(`Skipping ${id} due to error`, err);
      }
    }

    if (prospects.length === 0) {
      console.log(`no halal butchers found in ${args.city} (after filtering)`);
      return;
    }

    console.log(`\nKept ${prospects.length} prospect(s) after filtering.`);

    // 4. Output: CSV
    if (args.output === "csv" || args.output === "both") {
      const filepath = await writeCsvFile(prospects, args.city);
      console.log(`CSV written: ${filepath}`);
    }

    // 5. Output: DB
    if (args.output === "db" || args.output === "both") {
      const { created, updated } = await upsertProspects(prospects);
      console.log(`DB upsert done: ${created} created, ${updated} updated.`);
    }

    logger.info("prospect-scraper done", { kept: prospects.length });
  } catch (err) {
    if (err instanceof Error) {
      console.error(`\nFATAL: ${err.message}`);
      logger.error("prospect-scraper failed", err);
    } else {
      console.error("\nFATAL: unknown error", err);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
