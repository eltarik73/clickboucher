// src/app/api/geo/route.ts — Return Vercel edge geo headers (silent IP-based lookup)
// Used by the homepage to pre-sort shops by proximity without triggering the HTML5 prompt.
import { apiSuccess } from "@/lib/api/errors";
import { getVercelGeo } from "@/lib/vercel-geo";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const geo = getVercelGeo();
    return apiSuccess(geo);
  } catch (error) {
    logger.error({ error }, "geo/GET failed");
    return apiSuccess({ city: null, country: null, region: null, lat: null, lng: null });
  }
}
