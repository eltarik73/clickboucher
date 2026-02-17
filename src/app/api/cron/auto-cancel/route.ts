// src/app/api/cron/auto-cancel/route.ts — Auto-cancel expired pending orders (Uber Eats style)
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkAutoPause } from "@/lib/shop-status";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return apiError("UNAUTHORIZED", "Invalid cron secret");
    }

    const now = new Date();

    // Find all PENDING orders whose expiresAt has passed
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        expiresAt: { not: null, lte: now },
      },
      select: { id: true, shopId: true, orderNumber: true },
    });

    let cancelledCount = 0;

    for (const order of expiredOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "AUTO_CANCELLED", autoCancelledAt: now },
      });
      cancelledCount++;

      // Check if shop should be auto-paused
      await checkAutoPause(order.shopId);
    }

    return apiSuccess({
      cancelledCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/auto-cancel");
  }
}
