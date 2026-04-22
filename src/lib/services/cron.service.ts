// KLIK&GO — CRON Jobs (stub)
// Schema migration pending

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function cleanExpiredOffers(): Promise<{ expired: number; released: number }> {
  logger.info("[STUB CRON] cleanExpiredOffers - schema migration pending");
  return { expired: 0, released: 0 };
}

export async function autoCancelStaleOrders(): Promise<{ cancelled: number }> {
  const staleCutoff = new Date(Date.now() - 60 * 60_000);
  const staleOrders = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: staleCutoff } },
    select: { id: true, orderNumber: true },
  });

  if (staleOrders.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: staleOrders.map(o => o.id) } },
      data: { status: "CANCELLED" },
    });
    for (const order of staleOrders) {
      logger.info(`[CRON] Auto-cancelled stale order ${order.orderNumber}`);
    }
  }

  return { cancelled: staleOrders.length };
}

export async function generateDailyStats(): Promise<{
  shopId: string; date: string; ordersTotal: number; revenue: number; avgOrderValue: number;
}[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Single query for all shops' completed orders today
  const allOrders = await prisma.order.findMany({
    where: { status: "COMPLETED", createdAt: { gte: today, lt: tomorrow } },
    select: { shopId: true, totalCents: true },
  });

  // Group by shopId in JS
  const byShop = new Map<string, number[]>();
  for (const o of allOrders) {
    if (!byShop.has(o.shopId)) byShop.set(o.shopId, []);
    byShop.get(o.shopId)!.push(o.totalCents);
  }

  // Also include shops with 0 orders
  const shops = await prisma.shop.findMany({ select: { id: true } });
  const dateStr = today.toISOString().slice(0, 10);

  return shops.map(shop => {
    const totals = byShop.get(shop.id) || [];
    const revenue = totals.reduce((s, v) => s + v, 0);
    return {
      shopId: shop.id, date: dateStr,
      ordersTotal: totals.length, revenue,
      avgOrderValue: totals.length > 0 ? Math.round(revenue / totals.length) : 0,
    };
  });
}
