// GET /api/boucher/stats?period=week|month|year — Boucher dashboard statistics
// Thin controller — business logic in src/lib/services/stats/boucher-stats.ts
import { NextRequest } from "next/server";
import { getAuthenticatedBoucher } from "@/lib/boucher-auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { cached } from "@/lib/redis-cache";
import { getBoucherStats, isValidPeriod } from "@/lib/services/stats/boucher-stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedBoucher();
    if (authResult.error) return authResult.error;
    const { shopId } = authResult;

    const periodParam = req.nextUrl.searchParams.get("period") || "week";
    if (!isValidPeriod(periodParam)) {
      return apiError("VALIDATION_ERROR", "Periode invalide (week, month, year)");
    }

    const result = await cached(
      `boucher:stats:${shopId}:${periodParam}`,
      300,
      () => getBoucherStats(shopId, periodParam)
    );

    if (!result.ok) {
      return apiError(result.code, result.message);
    }
    return apiSuccess(result.data);
  } catch (error) {
    return handleApiError(error, "boucher/stats/GET");
  }
}
