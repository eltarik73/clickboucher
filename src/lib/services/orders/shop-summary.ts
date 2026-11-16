// src/lib/services/orders/shop-summary.ts — the figures of the butcher's dashboard home, computed by
// the database for one shop: today's orders and takings (today = the Paris calendar day), and the
// five newest orders. Never derived from a truncated list of orders.
import type { OrderStatus } from "@prisma/client";
import { COLLECTED_ORDER_STATUSES } from "@/lib/order-state-machine";
import prisma from "@/lib/prisma";
import { getParisWallClock, parisWallClockToUtc } from "@/lib/paris-time";
import { settleDueAdjustmentsWithin } from "@/lib/services/orders/adjustment-answers";
import { orderPersonColumns, withOrderPersonName } from "@/lib/services/orders/order-person";

export const RECENT_ORDERS_LIMIT = 5;

const MINUTES_PER_DAY = 24 * 60;

export interface ShopDaySummary {
  /** Orders created today, whatever their status. */
  ordersToday: number;
  /** Sum of totalCents of today's orders that were collected. */
  revenueTodayCents: number;
  recent: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalCents: number;
    createdAt: Date;
    expiresAt: Date | null;
    itemCount: number;
    user: { firstName: string; lastName: string };
  }[];
}

export async function getShopDaySummary(shopId: string, now: Date): Promise<ShopDaySummary> {
  // Due price adjustments are settled first, so the totals shown are the settled ones.
  await settleDueAdjustmentsWithin({ shopId }, now);

  const { dateKey } = getParisWallClock(now);
  const createdToday = {
    gte: parisWallClockToUtc(dateKey, 0),
    lt: parisWallClockToUtc(dateKey, MINUTES_PER_DAY),
  };

  const [ordersToday, revenue, recent] = await Promise.all([
    prisma.order.count({ where: { shopId, createdAt: createdToday } }),
    prisma.order.aggregate({
      // The takings of the day: orders whose goods were handed over.
      where: { shopId, createdAt: createdToday, status: { in: [...COLLECTED_ORDER_STATUSES] } },
      _sum: { totalCents: true },
    }),
    prisma.order.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: RECENT_ORDERS_LIMIT,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        createdAt: true,
        expiresAt: true,
        _count: { select: { items: true } },
        user: { select: { firstName: true, lastName: true } },
        ...orderPersonColumns,
      },
    }),
  ]);

  return {
    ordersToday,
    revenueTodayCents: revenue._sum.totalCents ?? 0,
    recent: recent.map((row) => {
      const { _count, ...order } = withOrderPersonName(row);
      return { ...order, itemCount: _count.items };
    }),
  };
}
