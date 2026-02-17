// src/app/api/cron/route.ts — Master cron endpoint (runs all sub-crons)
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

    const unsnoozed = await unsnoozeExpiredProducts();
    return apiSuccess({
      unsnoozed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron");
  }
}
