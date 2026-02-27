import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const { refreshAllShopMetrics } = await import("@/lib/services/performance");
    await refreshAllShopMetrics();

    return apiSuccess({ refreshed: true, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/performance-refresh");
  }
}
