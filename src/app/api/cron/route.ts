// ═══════════════════════════════════════════════
// CRON endpoint — called by Vercel Cron or external scheduler
// vercel.json config:
//   { "crons": [{ "path": "/api/cron", "schedule": "*/15 * * * *" }] }
// ═══════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { cleanExpiredOffers, autoCancelStaleOrders, generateDailyStats } from "@/lib/services/cron.service";

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const task = req.nextUrl.searchParams.get("task") || "all";

  try {
    const results: Record<string, unknown> = {};

    if (task === "all" || task === "offers") {
      results.offers = await cleanExpiredOffers();
    }
    if (task === "all" || task === "stale-orders") {
      results.staleOrders = await autoCancelStaleOrders();
    }
    if (task === "daily-stats") {
      results.dailyStats = await generateDailyStats();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[CRON] Error:", error);
    return NextResponse.json(
      { success: false, error: "CRON task failed" },
      { status: 500 }
    );
  }
}
