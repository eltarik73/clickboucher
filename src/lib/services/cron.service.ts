// KLIK&GO — CRON Jobs (stub)
// Schema migration pending

import prisma from "@/lib/prisma";

export async function cleanExpiredOffers(): Promise<{ expired: number; released: number }> {
  console.log("[STUB CRON] cleanExpiredOffers - schema migration pending");
  return { expired: 0, released: 0 };
}

export async function autoCancelStaleOrders(): Promise<{ cancelled: number }> {
  const staleCutoff = new Date(Date.now() - 60 * 60_000);
  const staleOrders = await prisma.order.findMany({
    where: { status: "PENDING", createdAt: { lt: staleCutoff } },
    select: { id: true, orderNumber: true },
  });
  for (const order of staleOrders) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    console.log(`[CRON] Auto-cancelled stale order ${order.orderNumber}`);
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
  const shops = await prisma.shop.findMany({ select: { id: true } });
  const results = [];
  for (const shop of shops) {
    const orders = await prisma.order.findMany({
      where: { shopId: shop.id, status: "COMPLETED", createdAt: { gte: today, lt: tomorrow } },
      select: { totalCents: true },
    });
    const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
    results.push({
      shopId: shop.id, date: today.toISOString().slice(0, 10),
      ordersTotal: orders.length, revenue,
      avgOrderValue: orders.length > 0 ? Math.round(revenue / orders.length) : 0,
    });
  }
  return results;
}
