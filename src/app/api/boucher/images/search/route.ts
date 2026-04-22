// GET /api/boucher/images/search — Web image search (Pexels + Unsplash)
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { searchImages, isImageSearchConfigured } from "@/lib/image-search";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedBoucher();
    if (auth.error) return auth.error;

    const rl = await checkRateLimit(rateLimits.search, `search-img:${auth.userId}`);
    if (!rl.success) {
      return apiError("RATE_LIMITED", "Trop de recherches, réessayez dans une minute");
    }

    const { searchParams } = new URL(req.url);
    const { q } = querySchema.parse({ q: searchParams.get("q") || "" });

    if (!isImageSearchConfigured()) {
      return apiSuccess({ results: [], configured: false });
    }

    const results = await searchImages(q);
    return apiSuccess({ results, configured: true });
  } catch (err) {
    return handleApiError(err, "boucher/images/search");
  }
}
