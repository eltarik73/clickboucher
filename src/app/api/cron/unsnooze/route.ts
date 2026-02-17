// src/app/api/cron/unsnooze/route.ts — Auto-unsnooze expired products (Deliveroo style)
import { apiSuccess, handleApiError } from "@/lib/api/errors";
import { unsnoozeExpiredProducts } from "@/lib/product-snooze";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await unsnoozeExpiredProducts();
    return apiSuccess({
      unsnoozedCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/unsnooze");
  }
}
