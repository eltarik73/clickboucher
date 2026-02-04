// ═══════════════════════════════════════════════
// CLICKBOUCHER — CRON Jobs
// Meant to be called via Vercel Cron or external scheduler
// ═══════════════════════════════════════════════

import prisma from "@/lib/prisma";

/**
 * Clean up expired last-minute offers
 * Schedule: every 15 minutes
 */
export async function cleanExpiredOffers(): Promise<{ expired: number; released: number }> {
  const now = new Date();

  // Mark expired offers
  const expired = await prisma.offer.updateMany({
    where: {
      expiresAt: { lt: now },
      remainingQty: { gt: 0 },
    },
    data: { remainingQty: 0 },
  });

  // Release cart reservations older than LAST_MINUTE_HOLD_MINUTES
  const holdMinutes = parseInt(process.env.LAST_MINUTE_HOLD_MINUTES || "10");
  const holdCutoff = new Date(now.getTime() - holdMinutes * 60_000);

  // Reset reservedInCart for offers with old reservations
  const releasable = await prisma.offer.findMany({
    where: { reservedInCart: { gt: 0 } },
  });

  let released = 0;
  for (const offer of releasable) {
    // In a real system, we'd track individual reservations with timestamps
    // For MVP, we release all reservations periodically
    if (offer.reservedInCart > 0) {
      await prisma.offer.update({
        where: { id: offer.id },
        data: { reservedInCart: 0 },
      });
      released++;
    }
  }

  console.log(`[CRON] cleanExpiredOffers: ${expired.count} expired, ${released} reservations released`);
  return { expired: expired.count, released };
}

/**
 * Auto-cancel orders stuck in PENDING for too long
 * Schedule: every 30 minutes
 */
export async function autoCancelStaleOrders(): Promise<{ cancelled: number }> {
  const staleCutoff = new Date(Date.now() - 60 * 60_000); // 1 hour

  const staleOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: staleCutoff },
    },
    select: { id: true, orderNumber: true },
  });

  for (const order of staleOrders) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await prisma.timelineEvent.create({
      data: {
        orderId: order.id,
        status: "CANCELLED",
        message: "Commande annulée automatiquement (délai dépassé)",
      },
    });
    console.log(`[CRON] Auto-cancelled stale order ${order.orderNumber}`);
  }

  return { cancelled: staleOrders.length };
}

/**
 * Generate daily stats for boucher dashboard
 * Schedule: every day at 23:59
 */
export async function generateDailyStats(): Promise<{
  shopId: string;
  date: string;
  ordersTotal: number;
  revenue: number;
  avgOrderValue: number;
}[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const shops = await prisma.shop.findMany({ select: { id: true } });
  const results = [];

  for (const shop of shops) {
    const orders = await prisma.order.findMany({
      where: {
        shopId: shop.id,
        status: "COLLECTED",
        createdAt: { gte: today, lt: tomorrow },
      },
      select: { totalCents: true },
    });

    const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
    results.push({
      shopId: shop.id,
      date: today.toISOString().slice(0, 10),
      ordersTotal: orders.length,
      revenue,
      avgOrderValue: orders.length > 0 ? Math.round(revenue / orders.length) : 0,
    });
  }

  console.log(`[CRON] dailyStats: ${results.length} shops processed`);
  return results;
}
