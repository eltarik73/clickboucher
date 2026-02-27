import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/errors";
import { sendNotification } from "@/lib/notifications";
import { verifyCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!verifyCronAuth(req)) return apiError("UNAUTHORIZED", "Invalid cron secret");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const shops = await prisma.shop.findMany({
      where: { visible: true },
      select: { id: true, name: true, ownerId: true, rating: true },
    });

    let sentCount = 0;

    for (const shop of shops) {
      try {
        // Use aggregate instead of fetching raw orders
        const [orderCount, revenue, topProducts] = await Promise.all([
          prisma.order.count({
            where: { shopId: shop.id, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
          }),
          prisma.order.aggregate({
            where: { shopId: shop.id, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
            _sum: { totalCents: true },
          }),
          prisma.orderItem.groupBy({
            by: ["name"],
            where: { order: { shopId: shop.id, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } } },
            _sum: { totalCents: true },
            orderBy: { _sum: { totalCents: "desc" } },
            take: 1,
          }),
        ]);

        const weeklyRevenue = revenue._sum.totalCents || 0;
        const weeklyAvgOrder = orderCount > 0 ? Math.round(weeklyRevenue / orderCount) : 0;
        const topProduct = topProducts[0]?.name;

        const owner = await prisma.user.findFirst({
          where: { OR: [{ clerkId: shop.ownerId }, { id: shop.ownerId }] },
          select: { id: true },
        });

        if (owner) {
          await sendNotification("WEEKLY_REPORT", {
            userId: owner.id,
            shopName: shop.name,
            weeklyRevenue,
            weeklyOrders: orderCount,
            weeklyAvgOrder,
            weeklyRating: shop.rating,
            weeklyTopProduct: topProduct,
          });
          sentCount++;
        }
      } catch {
        // Continue with next shop
      }
    }

    return apiSuccess({ sentCount, timestamp: new Date().toISOString() });
  } catch (error) {
    return handleApiError(error, "cron/weekly-report");
  }
}
