// GET /api/webmaster/capacity — Shop capacity overview for webmaster
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { apiSuccess, handleApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (admin.error) return admin.error;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // All shops with capacity-related fields
    const shops = await prisma.shop.findMany({
      where: { visible: true },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        busyMode: true,
        busyExtraMin: true,
        busyModeEndsAt: true,
        paused: true,
        pausedAt: true,
        pauseReason: true,
        pauseEndsAt: true,
        autoPaused: true,
        autoPausedAt: true,
        autoPauseThreshold: true,
        missedOrdersCount: true,
        vacationMode: true,
        vacationStart: true,
        vacationEnd: true,
        vacationMessage: true,
        prepTimeMin: true,
        maxOrdersPerSlot: true,
        maxOrdersPerHour: true,
        autoBusyThreshold: true,
        pickupSlots: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });

    // Today's orders per shop (non-cancelled)
    const ordersToday = await prisma.order.groupBy({
      by: ["shopId"],
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED", "DENIED", "AUTO_CANCELLED"] },
      },
      _count: true,
    });
    const orderCountMap = new Map(
      ordersToday.map((o) => [o.shopId, o._count])
    );

    // Today's orders with slot info for capacity calc
    const slotOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { notIn: ["CANCELLED", "DENIED", "AUTO_CANCELLED"] },
        pickupSlotStart: { not: null },
      },
      select: {
        shopId: true,
        pickupSlotStart: true,
        pickupSlotEnd: true,
      },
    });

    // Group slot orders by shop
    const slotOrdersByShop = new Map<string, { start: Date; end: Date }[]>();
    for (const o of slotOrders) {
      if (!o.pickupSlotStart) continue;
      const list = slotOrdersByShop.get(o.shopId) || [];
      list.push({
        start: o.pickupSlotStart,
        end: o.pickupSlotEnd || o.pickupSlotStart,
      });
      slotOrdersByShop.set(o.shopId, list);
    }

    // Status summary
    const statusCounts: Record<string, number> = {
      OPEN: 0,
      BUSY: 0,
      PAUSED: 0,
      AUTO_PAUSED: 0,
      VACATION: 0,
      CLOSED: 0,
    };

    const shopData = shops.map((shop) => {
      statusCounts[shop.status] = (statusCounts[shop.status] || 0) + 1;

      const todayOrders = orderCountMap.get(shop.id) || 0;
      const shopSlotOrders = slotOrdersByShop.get(shop.id) || [];

      // Find busiest slot: count orders per hour
      const hourBuckets: Record<number, number> = {};
      for (const so of shopSlotOrders) {
        const hour = so.start.getHours();
        hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
      }
      const peakHourOrders = Math.max(0, ...Object.values(hourBuckets));
      const peakHour =
        Object.entries(hourBuckets).find(
          ([, v]) => v === peakHourOrders
        )?.[0] || null;

      const capacityPct =
        shop.maxOrdersPerHour > 0
          ? Math.round((peakHourOrders / shop.maxOrdersPerHour) * 100)
          : 0;

      return {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        status: shop.status,
        busyMode: shop.busyMode,
        busyExtraMin: shop.busyExtraMin,
        busyModeEndsAt: shop.busyModeEndsAt,
        paused: shop.paused,
        pauseReason: shop.pauseReason,
        pauseEndsAt: shop.pauseEndsAt,
        autoPaused: shop.autoPaused,
        autoPausedAt: shop.autoPausedAt,
        autoPauseThreshold: shop.autoPauseThreshold,
        missedOrdersCount: shop.missedOrdersCount,
        vacationMode: shop.vacationMode,
        vacationStart: shop.vacationStart,
        vacationEnd: shop.vacationEnd,
        vacationMessage: shop.vacationMessage,
        prepTimeMin: shop.prepTimeMin,
        maxOrdersPerSlot: shop.maxOrdersPerSlot,
        maxOrdersPerHour: shop.maxOrdersPerHour,
        autoBusyThreshold: shop.autoBusyThreshold,
        pickupSlots: shop.pickupSlots,
        productCount: shop._count.products,
        todayOrders,
        peakHourOrders,
        peakHour: peakHour ? Number(peakHour) : null,
        capacityPct,
      };
    });

    // Calendar events (upcoming 30 days)
    const upcoming = new Date();
    upcoming.setDate(upcoming.getDate() + 30);
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        date: { gte: now, lte: upcoming },
        active: true,
      },
      orderBy: { date: "asc" },
      take: 20,
    });

    return apiSuccess({
      shops: shopData,
      statusCounts,
      calendarEvents,
      totalShops: shops.length,
      totalOrdersToday: ordersToday.reduce((s, o) => s + o._count, 0),
    });
  } catch (error) {
    return handleApiError(error, "webmaster/capacity");
  }
}
