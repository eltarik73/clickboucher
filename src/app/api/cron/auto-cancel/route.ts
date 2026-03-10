// src/app/api/cron/auto-cancel/route.ts — Auto-cancel expired pending orders (Uber Eats style)
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { checkAutoPause } from "@/lib/shop-status";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const now = new Date();

    // Find all PENDING orders whose expiresAt has passed
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        expiresAt: { not: null, lte: now },
      },
      select: { id: true, shopId: true, orderNumber: true },
    });

    if (expiredOrders.length > 0) {
      // Batch update all expired orders at once
      await prisma.order.updateMany({
        where: { id: { in: expiredOrders.map(o => o.id) } },
        data: { status: "AUTO_CANCELLED", autoCancelledAt: now },
      });

      // Check auto-pause for each unique shop
      const uniqueShopIds = [...new Set(expiredOrders.map(o => o.shopId))];
      for (const shopId of uniqueShopIds) {
        await checkAutoPause(shopId);
      }
    }

    return apiSuccess({
      cancelledCount: expiredOrders.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "cron/auto-cancel");
  }
}
