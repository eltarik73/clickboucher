import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { verifyCronAuth } from "@/lib/cron-auth";
import { endExpiredVacations } from "@/lib/shop-vacation";

export const dynamic = "force-dynamic";

// The same end of vacation as the butcher's (src/lib/shop-vacation.ts): the shop is listed and open
// again, unless it was suspended meanwhile (only the admin lifts a suspension).
export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();
    const reopenedCount = await endExpiredVacations(now);

    return apiSuccess({ reopenedCount, timestamp: now.toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/vacation-end");
  }
}
