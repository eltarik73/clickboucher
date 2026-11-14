// src/app/api/cron/auto-cancel/route.ts — expires PENDING orders whose acceptance deadline passed.
// Each order goes through the expire command (conditional transition): an order accepted in the
// meantime is left alone, and only the orders this run actually expired are counted and notified.
import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { checkAutoPause } from "@/lib/shop-status";
import { verifyCronAuth } from "@/lib/cron-auth";
import { expireDueOrders } from "@/lib/services/orders/commands/close";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stop taking new orders well before the function limit: below maxDuration and below the 30 s of
// the `src/app/api/**` rule of vercel.json, whichever of the two the platform applies.
const EXPIRY_BUDGET_MS = 25_000;

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();
    const { expiredShopIds, failed, remainingCount } = await expireDueOrders({
      now,
      deadline: new Date(now.getTime() + EXPIRY_BUDGET_MS),
    });

    const shopIds = [...new Set(expiredShopIds)];
    const pauses = await Promise.allSettled(shopIds.map((shopId) => checkAutoPause(shopId)));
    pauses.forEach((pause, index) => {
      if (pause.status === "rejected") {
        logger.error("[cron/auto-cancel] Auto-pause check failed", {
          shopId: shopIds[index],
          error: pause.reason,
        });
      }
    });

    if (remainingCount > 0) {
      logger.warn("[cron/auto-cancel] Expired orders left for the next run", { remainingCount });
    }
    logger.info("[cron/auto-cancel] Run finished", {
      cancelled: expiredShopIds.length,
      failed,
      remainingCount,
    });
    return apiSuccess({
      cancelledCount: expiredShopIds.length,
      remainingCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/auto-cancel");
  }
}
