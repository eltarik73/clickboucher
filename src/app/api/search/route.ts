import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/ai-search";
import { apiCached, handleApiError } from "@/lib/api/errors";
import { checkRateLimit, rateLimits } from "@/lib/rate-limit";
import { getServerUserId } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rlKey =
      (await getServerUserId()) ||
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "anon";
    const rl = await checkRateLimit(rateLimits.search, `search:${rlKey}`);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Trop de recherches, ralentissez" },
        { status: 429 }
      );
    }

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim();
    const shopId = searchParams.get("shopId") || undefined;

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Paramètre 'q' requis (min 2 caractères)" },
        { status: 400 }
      );
    }

    const results = await searchProducts(q, shopId, 10);

    return apiCached({ query: q, count: results.length, results }, 30);
  } catch (error) {
    return handleApiError(error, "search");
  }
}
