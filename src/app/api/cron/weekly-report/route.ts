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

    const shopIds = shops.map(s => s.id);

    // Batch fetch ALL data in 3 queries instead of 4*N
    const [orderStats, revenueStats, topProducts] = await Promise.all([
      prisma.order.groupBy({
        by: ["shopId"],
        where: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["shopId"],
        where: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } },
        _sum: { totalCents: true },
      }),
      prisma.orderItem.groupBy({
        by: ["name"],
        where: { order: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } } },
        _sum: { totalCents: true },
        orderBy: { _sum: { totalCents: "desc" } },
        take: 50,
      }),
    ]);

    const countMap = new Map(orderStats.map(c => [c.shopId, c._count]));
    const revenueMap = new Map(revenueStats.map(r => [r.shopId, r._sum.totalCents || 0]));

    // Batch fetch ALL owners at once
    const ownerIds = [...new Set(shops.map(s => s.ownerId).filter(Boolean))];
    const owners = ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { OR: [{ clerkId: { in: ownerIds } }, { id: { in: ownerIds } }] },
          select: { id: true, clerkId: true },
        })
      : [];
    const ownerMap = new Map<string, string>();
    for (const u of owners) {
      if (u.clerkId) ownerMap.set(u.clerkId, u.id);
      ownerMap.set(u.id, u.id);
    }

    // For top products per shop, we need per-shop data — fetch all items grouped
    const allItems = await prisma.orderItem.findMany({
      where: { order: { shopId: { in: shopIds }, status: { in: ["COMPLETED", "PICKED_UP"] }, createdAt: { gte: weekAgo } } },
      select: { name: true, totalCents: true, order: { select: { shopId: true } } },
    });
    const topByShop = new Map<string, string>();
    const productTotals = new Map<string, Map<string, number>>();
    for (const item of allItems) {
      const sid = item.order.shopId;
      if (!productTotals.has(sid)) productTotals.set(sid, new Map());
      const shopMap = productTotals.get(sid)!;
      shopMap.set(item.name, (shopMap.get(item.name) || 0) + item.totalCents);
    }
    for (const [sid, map] of productTotals) {
      const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) topByShop.set(sid, top[0]);
    }

    let sentCount = 0;
    for (const shop of shops) {
      try {
        const weeklyOrders = countMap.get(shop.id) || 0;
        const weeklyRevenue = revenueMap.get(shop.id) || 0;
        const weeklyAvgOrder = weeklyOrders > 0 ? Math.round(weeklyRevenue / weeklyOrders) : 0;
        const topProduct = topByShop.get(shop.id);

        const ownerId = ownerMap.get(shop.ownerId);
        if (ownerId) {
          await sendNotification("WEEKLY_REPORT", {
            userId: ownerId,
            shopName: shop.name,
            weeklyRevenue,
            weeklyOrders,
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
