// src/app/api/cron/unsnooze/route.ts — Auto-unsnooze expired products (Deliveroo style)
import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { unsnoozeExpiredProducts } from "@/lib/product-snooze";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return apiError("UNAUTHORIZED", "Invalid cron secret");
    }

    const count = await unsnoozeExpiredProducts();
    return apiSuccess({
      unsnoozedCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/unsnooze");
  }
}
