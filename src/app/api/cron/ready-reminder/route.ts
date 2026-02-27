import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const readyOrders = await prisma.order.findMany({
      where: {
        status: "READY",
        actualReady: { not: null, lte: thirtyMinAgo, gte: twoHoursAgo },
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        notifSent: true,
        shop: { select: { name: true } },
      },
    });

    let sentCount = 0;
    for (const order of readyOrders) {
      const existing = Array.isArray(order.notifSent) ? order.notifSent : [];
      const alreadyReminded = existing.some(
        (entry) => typeof entry === "object" && entry !== null && (entry as Record<string, unknown>).event === "READY_REMINDER"
      );
      if (alreadyReminded) continue;

      await sendNotification("READY_REMINDER", {
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        shopName: order.shop.name,
      });
      sentCount++;
    }

    return apiSuccess({ sentCount, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/ready-reminder");
  }
}
